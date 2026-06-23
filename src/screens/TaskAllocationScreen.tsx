import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { SharedList, UserTier } from '../types';
import { Task, ParticipantAllocation, allocateTasksFairly } from '../utils/taskAllocation';
import * as Print from 'expo-print';

interface TaskAllocationScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateTasksState: (
    tasks: Task[],
    allocations: ParticipantAllocation[],
    allocationType: 'one-time' | 'recurring' | 'weekly',
    absentParticipantIds?: string[],
    history?: Record<string, string[]>,
    currentRotationIndex?: number,
    taskPackages?: { tasks: Task[] }[]
  ) => Promise<void>;
  userTier: UserTier;
}

export default function TaskAllocationScreen({
  activeList,
  onBack,
  onUpdateTasksState,
  userTier
}: TaskAllocationScreenProps) {
  // Local state for tasks list
  const [tasks, setTasks] = useState<Task[]>(() => {
    return activeList?.taskAllocationState?.tasks || [];
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Result state
  const [allocations, setAllocations] = useState<ParticipantAllocation[]>(() => {
    return activeList?.taskAllocationState?.allocations || [];
  });
  const [showCalculation, setShowCalculation] = useState(() => {
    return !!(activeList?.taskAllocationState?.allocations && activeList.taskAllocationState.allocations.length > 0);
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  // Selector for allocation type
  const [allocationType, setAllocationType] = useState<'one-time' | 'recurring' | 'weekly'>(() => {
    return activeList?.taskAllocationState?.allocationType || 'one-time';
  });

  // Modal and attendance states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [absentIds, setAbsentIds] = useState<string[]>(() => {
    return activeList?.taskAllocationState?.absentParticipantIds || [];
  });
  const [tempAbsentIds, setTempAbsentIds] = useState<string[]>([]);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Time-travel carousel state
  const [viewOffset, setViewOffset] = useState(0);

  // Derive rotation parameters
  const currentRotationIndex = activeList?.taskAllocationState?.currentRotationIndex || 0;
  const taskPackages = activeList?.taskAllocationState?.taskPackages || [];

  // Initialize/sync states from activeList when it changes
  useEffect(() => {
    if (activeList?.taskAllocationState) {
      setTasks(activeList.taskAllocationState.tasks || []);
      setAllocations(activeList.taskAllocationState.allocations || []);
      setAllocationType(activeList.taskAllocationState.allocationType || 'one-time');
      setAbsentIds(activeList.taskAllocationState.absentParticipantIds || []);
      setShowCalculation(!!(activeList.taskAllocationState.allocations && activeList.taskAllocationState.allocations.length > 0));
    } else {
      setTasks([]);
      setAllocations([]);
      setAllocationType('one-time');
      setAbsentIds([]);
      setShowCalculation(false);
    }
  }, [activeList?.id]);

  // Reset viewOffset when list or its rotation index changes
  useEffect(() => {
    setViewOffset(0);
  }, [activeList?.id, activeList?.taskAllocationState?.currentRotationIndex]);

  // Compute present participants list
  const presentParticipants = useMemo(() => {
    if (!activeList || !activeList.participants) return [];
    return activeList.participants
      .filter(p => !absentIds.includes(p.id))
      .map(p => ({
        id: p.id,
        name: `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`
      }));
  }, [activeList?.participants, absentIds]);

  // Compute the virtual/displayed allocations (in-memory carousel preview)
  const displayedAllocations = useMemo(() => {
    if (allocationType !== 'recurring') {
      return allocations;
    }
    const N = presentParticipants.length;
    if (N === 0 || !taskPackages || taskPackages.length === 0) {
      return allocations;
    }
    // Correct modulo in JS/TS
    const displayRotationIndex = (((currentRotationIndex + viewOffset) % N) + N) % N;
    
    return presentParticipants.map((p, i) => {
      const packageIndex = (i + displayRotationIndex) % N;
      const packageTasks = taskPackages[packageIndex]?.tasks || [];
      const totalWeight = packageTasks.reduce((sum, t) => sum + t.weight, 0);
      return {
        participantId: p.id,
        name: p.name,
        tasks: packageTasks,
        totalWeight
      };
    });
  }, [allocationType, allocations, presentParticipants, taskPackages, currentRotationIndex, viewOffset]);

  const handleOpenModal = () => {
    setTempAbsentIds(absentIds);
    setIsModalOpen(true);
  };

  const handleConfirmAttendance = async (newAbsentIds: string[]) => {
    setAbsentIds(newAbsentIds);
    setIsModalOpen(false);
    setShowCalculation(false);
    setAllocations([]);
    setViewOffset(0);
    await onUpdateTasksState(tasks, [], allocationType, newAbsentIds, undefined, 0, []);
  };

  const handleUpdateAllocationType = async (type: 'one-time' | 'recurring' | 'weekly') => {
    setAllocationType(type);
    setShowCalculation(false);
    setAllocations([]);
    setViewOffset(0);
    await onUpdateTasksState(tasks, [], type, absentIds, undefined, 0, []);
  };

  // Add task
  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) {
      Alert.alert('שגיאה', 'נא להזין תיאור משימה.');
      return;
    }
    const newId = `task-${Date.now()}`;
    const newTasks = [...tasks, { id: newId, title, weight: 1 }];
    setTasks(newTasks);
    setNewTaskTitle('');
    setShowCalculation(false);
    setAllocations([]);
    setViewOffset(0);

    await onUpdateTasksState(newTasks, [], allocationType, absentIds, undefined, 0, []);
  };

  // Remove task
  const handleRemoveTask = async (id: string) => {
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    setShowCalculation(false);
    setAllocations([]);
    setViewOffset(0);

    await onUpdateTasksState(newTasks, [], allocationType, absentIds, undefined, 0, []);
  };

  // Update task weight
  const handleUpdateTaskWeight = async (id: string, weight: number) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, weight } : t);
    setTasks(newTasks);
    setShowCalculation(false);
    setAllocations([]);
    setViewOffset(0);

    await onUpdateTasksState(newTasks, [], allocationType, absentIds, undefined, 0, []);
  };

  // Execute fair allocation
  const handleCalculateAllocation = async () => {
    if (presentParticipants.length === 0) {
      Alert.alert('שגיאה', 'נא להוסיף לפחות משתתף אחד לחלוקה.');
      return;
    }
    if (tasks.length === 0) {
      Alert.alert('שגיאה', 'נא להוסיף לפחות משימה אחת לחלוקה.');
      return;
    }

    let result: ParticipantAllocation[] = [];

    if (allocationType === 'recurring') {
      result = allocateTasksFairly(presentParticipants, tasks);
      const packages = result.map(alloc => ({ tasks: alloc.tasks }));
      setAllocations(result);
      setShowCalculation(true);
      setIsTasksExpanded(false);
      setViewOffset(0);
      Keyboard.dismiss();

      await onUpdateTasksState(tasks, result, allocationType, absentIds, undefined, 0, packages);
    } else {
      // 'one-time' or 'weekly'
      result = allocateTasksFairly(presentParticipants, tasks);
      setAllocations(result);
      setShowCalculation(true);
      setIsTasksExpanded(false);
      setViewOffset(0);
      Keyboard.dismiss();

      await onUpdateTasksState(tasks, result, allocationType, absentIds, undefined, 0, []);
    }
  };

  // Carousel navigation handlers
  const handlePrevRound = () => {
    const N = presentParticipants.length;
    if (N === 0) return;
    setViewOffset(prev => prev - 1);
  };

  const handleNextRound = () => {
    const N = presentParticipants.length;
    if (N === 0) return;
    setViewOffset(prev => prev + 1);
  };

  const handleAdvanceRotation = async () => {
    const N = presentParticipants.length;
    if (N === 0 || !taskPackages || taskPackages.length === 0) return;

    const nextRotationIndex = (currentRotationIndex + 1) % N;
    
    // Calculate new active allocations based on nextRotationIndex
    const nextAllocations = presentParticipants.map((p, i) => {
      const packageIndex = (i + nextRotationIndex) % N;
      const packageTasks = taskPackages[packageIndex]?.tasks || [];
      const totalWeight = packageTasks.reduce((sum, t) => sum + t.weight, 0);
      return {
        participantId: p.id,
        name: p.name,
        tasks: packageTasks,
        totalWeight
      };
    });

    setAllocations(nextAllocations);
    setViewOffset(0); // Reset UI offset to 0

    await onUpdateTasksState(
      tasks,
      nextAllocations,
      allocationType,
      absentIds,
      undefined,
      nextRotationIndex,
      taskPackages
    );
  };

  // Share allocation result
  const handleShareResult = async () => {
    if (displayedAllocations.length === 0) return;

    let shareText = `📋 *חלוקת משימות הוגנת מבית Sortli 🎯*\n`;
    if (activeList) {
      shareText += `*פעילות:* ${activeList.name}\n`;
    }
    shareText += `\n`;

    displayedAllocations.forEach(alloc => {
      shareText += `👤 *${alloc.name}* (עומס כולל: ${alloc.totalWeight}):\n`;
      if (alloc.tasks.length === 0) {
        shareText += `  - ללא משימות 🎉\n`;
      } else {
        alloc.tasks.forEach(task => {
          shareText += `  • ${task.title} (קושי: ${task.weight})\n`;
        });
      }
      shareText += `\n`;
    });

    shareText += `נוצר באמצעות אפליקציית Sortli - חלוקה שוויונית ומאוזנת 🔄`;

    try {
      await Share.share({
        message: shareText,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Generate PDF and open system Print/Share interface
  const handleGeneratePdf = async () => {
    if (displayedAllocations.length === 0) return;
    setIsGeneratingPdf(true);

    try {
      const listName = activeList?.name || 'ללא שם';
      
      // Generate table rows dynamically
      let tableRows = '';
      displayedAllocations.forEach(alloc => {
        let taskListHtml = '';
        if (alloc.tasks.length === 0) {
          taskListHtml = '<span style="color: #10B981; font-style: italic;">ללא משימות 🎉</span>';
        } else {
          taskListHtml = '<ul class="task-list">';
          alloc.tasks.forEach(t => {
            taskListHtml += `<li class="task-item">${t.title} <span class="difficulty-label">(קושי: ${t.weight})</span></li>`;
          });
          taskListHtml += '</ul>';
        }

        tableRows += `
          <tr>
            <td style="font-weight: 600;">${alloc.name}</td>
            <td><span class="load-badge">עומס: ${alloc.totalWeight}</span></td>
            <td>${taskListHtml}</td>
          </tr>
        `;
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="utf-8">
          <title>חלוקת משימות הוגנת</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 40px;
              color: #1e1b4b;
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #6366f1;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            h1 {
              font-size: 24px;
              margin: 0;
              color: #1e1b4b;
            }
            .subtitle {
              font-size: 14px;
              color: #64748b;
              margin-top: 5px;
            }
            .summary {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 25px;
              font-size: 14px;
            }
            .summary-item {
              margin-bottom: 8px;
            }
            .summary-item strong {
              color: #4f46e5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 12px;
              text-align: right;
            }
            th {
              background-color: #f1f5f9;
              color: #1e1b4b;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .load-badge {
              background-color: #e0e7ff;
              color: #4338ca;
              padding: 3px 8px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 12px;
              display: inline-block;
            }
            .task-list {
              margin: 0;
              padding-right: 20px;
            }
            .task-item {
              margin-bottom: 4px;
            }
            .difficulty-label {
              color: #64748b;
              font-size: 12px;
            }
            .footer {
              text-align: center;
              margin-top: 50px;
              font-size: 12px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>חלוקת משימות הוגנת 🎯</h1>
            <div class="subtitle">רשימה: ${listName}</div>
          </div>

          <div class="summary">
            <div class="summary-item"><strong>תאריך יצירה:</strong> ${new Date().toLocaleDateString('he-IL')}</div>
            <div class="summary-item"><strong>סה"כ משתתפים:</strong> ${displayedAllocations.length}</div>
            <div class="summary-item"><strong>סה"כ משימות:</strong> ${tasks.length}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%;">שם משתתף</th>
                <th style="width: 20%;">עומס כולל</th>
                <th style="width: 55%;">משימות שהוקצו</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            נוצר באמצעות אפליקציית Sortli - חלוקה שוויונית ומאוזנת 🔄
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('שגיאה', 'נכשל ג\'ינרוט קובץ PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Check if all task weights are equal (standard lottery)
  const isStandardLottery = useMemo(() => {
    if (tasks.length === 0) return true;
    const firstWeight = tasks[0].weight;
    return tasks.every(t => t.weight === firstWeight);
  }, [tasks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <NavigationIcon name="arrow-forward" size={26} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          חלוקת משימות
        </Text>
        <TouchableOpacity onPress={() => setIsHelpModalOpen(true)} style={styles.backButton}>
          <NavigationIcon name="help-circle-outline" size={26} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Active List Row with Edit Icon */}
          {activeList && (
            <TouchableOpacity
              style={styles.activeListRow}
              onPress={handleOpenModal}
              activeOpacity={0.7}
            >
              <NavigationIcon name="pencil" size={18} color="#4F46E5" style={{ marginLeft: 8 }} />
              <Text style={styles.activeListText}>רשימה פעילה: {activeList.name}</Text>
            </TouchableOpacity>
          )}

          {showCalculation && (
            <TouchableOpacity
              style={styles.toggleTasksButton}
              onPress={() => setIsTasksExpanded(prev => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.toggleTasksButtonText}>
                {isTasksExpanded ? 'הסתר עריכת משימות 🔼' : 'עריכת משימות / דירוגים 🔽'}
              </Text>
            </TouchableOpacity>
          )}

          {(!showCalculation || isTasksExpanded) && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <NavigationIcon name="calculator-outline" size={20} color="#6366F1" />
                <Text style={styles.sectionTitle}>משימות ודירוג מאמץ ({tasks.length})</Text>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="תיאור משימה חדשה..."
                  placeholderTextColor="#94A3B8"
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                  textAlign="right"
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
                  <NavigationIcon name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {tasks.length === 0 ? (
                <Text style={styles.emptyListText}>אין משימות ברשימה. רשום משימה למעלה ולחץ על כפתור ה- +</Text>
              ) : (
                <View style={styles.tasksList}>
                  {tasks.map(task => (
                    <View key={task.id} style={styles.taskRow}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <TouchableOpacity onPress={() => handleRemoveTask(task.id)} style={styles.taskRemoveButton}>
                          <NavigationIcon name="close" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Weight selector (1 to 5 chips) */}
                      <View style={styles.weightSelectorContainer}>
                        <Text style={styles.weightLabel}>רמת קושי / מאמץ:</Text>
                        <View style={styles.chipsRow}>
                          {[1, 2, 3, 4, 5].map(val => {
                            const isSelected = task.weight === val;
                            return (
                              <TouchableOpacity
                                key={val}
                                style={[
                                  styles.weightChip,
                                  isSelected && styles.weightChipSelected
                                ]}
                                onPress={() => handleUpdateTaskWeight(task.id, val)}
                              >
                                <Text style={[
                                  styles.weightChipText,
                                  isSelected && styles.weightChipTextSelected
                                ]}>
                                  {val}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Allocation Type Selector */}
          <View style={styles.selectorCard}>
            <Text style={styles.selectorLabel}>סוג חלוקת המשימות:</Text>
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  allocationType === 'one-time' && styles.segmentButtonActive,
                ]}
                onPress={() => handleUpdateAllocationType('one-time')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    allocationType === 'one-time' && styles.segmentTextActive,
                  ]}
                >
                  חד פעמית 🎲
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  allocationType === 'recurring' && styles.segmentButtonActive,
                ]}
                onPress={() => handleUpdateAllocationType('recurring')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    allocationType === 'recurring' && styles.segmentTextActive,
                  ]}
                >
                  חוזרת 🔄
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  allocationType === 'weekly' && styles.segmentButtonActive,
                ]}
                onPress={() => handleUpdateAllocationType('weekly')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    allocationType === 'weekly' && styles.segmentTextActive,
                  ]}
                >
                  שבועית 📅
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              (presentParticipants.length === 0 || tasks.length === 0) && styles.actionButtonDisabled
            ]}
            onPress={handleCalculateAllocation}
            disabled={presentParticipants.length === 0 || tasks.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {allocationType === 'weekly'
                ? 'חלוקה שבועית (בקרוב) 📅'
                : isStandardLottery
                  ? 'בצע הגרלת משימות שוויונית 🎲'
                  : 'חשב חלוקת משימות הוגנת 🎯'}
            </Text>
          </TouchableOpacity>

          {/* Section 3: Results */}
          {showCalculation && displayedAllocations.length > 0 && (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>תוצאת החלוקה האופטימלית 📊</Text>

              {isStandardLottery && (
                <View style={styles.lotteryNotice}>
                  <Text style={styles.lotteryNoticeText}>
                    💡 המשימות חולקו בהגרלה שוויונית רגילה מכיוון שכל המשימות בעלות אותו המשקל.
                  </Text>
                </View>
              )}

              {/* Carousel Navigation (only for Recurring mode) */}
              {allocationType === 'recurring' && taskPackages.length > 0 && (
                <View style={styles.carouselCard}>
                  <View style={styles.carouselHeaderRow}>
                    <TouchableOpacity
                      onPress={handlePrevRound}
                      style={styles.carouselArrowButton}
                      activeOpacity={0.7}
                    >
                      <NavigationIcon name="chevron-forward" size={24} color="#6366F1" />
                    </TouchableOpacity>

                    <View style={styles.carouselStatusBadge}>
                      <Text style={styles.carouselStatusText}>
                        {viewOffset === 0
                          ? 'סבב פעיל נוכחי 🟢'
                          : viewOffset > 0
                            ? `סבב עתידי (+${viewOffset}) 🔮`
                            : `סבב עבר (${viewOffset}) ⏳`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleNextRound}
                      style={styles.carouselArrowButton}
                      activeOpacity={0.7}
                    >
                      <NavigationIcon name="chevron-back" size={24} color="#6366F1" />
                    </TouchableOpacity>
                  </View>

                  {/* Advance Turn Button */}
                  <TouchableOpacity
                    style={styles.advanceTurnButton}
                    onPress={handleAdvanceRotation}
                    activeOpacity={0.8}
                  >
                    <NavigationIcon name="refresh-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    <Text style={styles.advanceTurnButtonText}>קדם תור סבב 🔄</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.allocationsContainer}>
                {displayedAllocations.map(alloc => (
                  <View key={alloc.participantId} style={styles.allocationRow}>
                    <View style={styles.allocHeader}>
                      <Text style={styles.allocName}>{alloc.name}</Text>
                      <View style={styles.allocLoadBadge}>
                        <Text style={styles.allocLoadText}>עומס כולל: {alloc.totalWeight}</Text>
                      </View>
                    </View>

                    {alloc.tasks.length === 0 ? (
                      <Text style={styles.noTasksAssigned}>ללא משימות מוקצות 🎉</Text>
                    ) : (
                      <View style={styles.allocTaskList}>
                        {alloc.tasks.map(t => (
                          <View key={t.id} style={styles.allocTaskItem}>
                            <Text style={styles.allocTaskTitle}>{t.title}</Text>
                            <Text style={styles.allocTaskWeight}>[מאמץ: {t.weight}]</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.resultButton, styles.whatsappButton]}
                  onPress={handleShareResult}
                  activeOpacity={0.8}
                  disabled={isGeneratingPdf}
                >
                  <NavigationIcon name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  <Text style={styles.resultButtonText}>שתף בוואטסאפ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resultButton, styles.pdfButton]}
                  onPress={handleGeneratePdf}
                  activeOpacity={0.8}
                  disabled={isGeneratingPdf}
                >
                  <NavigationIcon name="print" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  <Text style={styles.resultButtonText}>
                    {isGeneratingPdf ? 'מייצר PDF...' : 'שמור PDF / הדפסה'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Help Modal */}
      <Modal
        visible={isHelpModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsHelpModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContent}>
            <View style={styles.helpModalHeader}>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.helpModalTitle}>הסבר על חלוקת משימות הוגנת</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.helpModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.helpModalSectionTitle}>מה זה עושה?</Text>
              <Text style={styles.helpModalText}>
                הפיצ'ר מאפשר להגדיר רשימת משתתפים ומשימות, לדרג את רמת הקושי של כל משימה (מ-1 הכי קל עד 5 הכי קשה), ולחלק אותן בצורה הכי מאוזנת שאפשר בין המשתתפים.
              </Text>

              <Text style={[styles.helpModalSectionTitle, { marginTop: 14 }]}>איך עובד האלגוריתם?</Text>
              <Text style={styles.helpModalText}>
                אם משאירים את הדירוגים כברירת מחדל (כולם 1), מתבצעת הגרלה שוויונית ומאוזנת בה כולם מקבלים כמות משימות שווה ככל הניתן.
                {"\n\n"}
                אם משנים את דרגות המאמץ, האלגוריתם שואף לצמצם את ההבדלים בעומס המצטבר בין המשתתפים (עומס מחושב כסכום דירוגי המשימות של המשתתף). המערכת מחפשת את השיבוץ שממזער את הפער המקסימלי ויוצר את החלוקה הכי הוגנת שיש.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.helpModalCloseButton}
              onPress={() => setIsHelpModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.helpModalCloseButtonText}>הבנתי, תודה!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Attendance Check List Modal */}
      <Modal
        visible={isModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>עדכון נוכחות זמני</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {activeList?.participants?.map(p => {
                const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
                const isAbsent = tempAbsentIds.includes(p.id);
                const isPresent = !isAbsent;

                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.checkRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (isPresent) {
                        setTempAbsentIds([...tempAbsentIds, p.id]);
                      } else {
                        setTempAbsentIds(tempAbsentIds.filter(id => id !== p.id));
                      }
                    }}
                  >
                    <NavigationIcon
                      name={isPresent ? "checkbox" : "square-outline"}
                      size={22}
                      color={isPresent ? "#4F46E5" : "#94A3B8"}
                      style={{ marginLeft: 12 }}
                    />
                    <Text style={[styles.checkText, !isPresent && styles.absentText]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => handleConfirmAttendance(tempAbsentIds)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmButtonText}>אישור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 56,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E1B4B',
    marginRight: 8,
  },
  inputRow: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1E1B4B',
  },
  addButton: {
    width: 46,
    height: 46,
    backgroundColor: '#6366F1',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emptyListText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 12,
  },
  badgeContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin: 4,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  badgeCloseButton: {
    marginRight: 6,
    padding: 2,
  },
  tasksList: {
    marginTop: 8,
  },
  taskRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  taskInfo: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
    flex: 1,
    textAlign: 'right',
  },
  taskRemoveButton: {
    padding: 4,
  },
  weightSelectorContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
  },
  weightChip: {
    width: 32,
    height: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  weightChipSelected: {
    backgroundColor: '#6366F1',
  },
  weightChipText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
  },
  weightChipTextSelected: {
    color: '#FFFFFF',
  },
  actionButton: {
    height: 50,
    backgroundColor: '#6366F1',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  actionButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E1B4B',
    textAlign: 'center',
    marginBottom: 16,
  },
  lotteryNotice: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  lotteryNoticeText: {
    fontSize: 13,
    color: '#166534',
    textAlign: 'right',
  },
  allocationsContainer: {
    gap: 12,
  },
  allocationRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  allocHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  allocName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  allocLoadBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  allocLoadText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4338CA',
  },
  noTasksAssigned: {
    fontSize: 13,
    color: '#10B981',
    textAlign: 'right',
    fontStyle: 'italic',
  },
  allocTaskList: {
    gap: 6,
  },
  allocTaskItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allocTaskTitle: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    textAlign: 'right',
  },
  allocTaskWeight: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 6,
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  resultButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  pdfButton: {
    backgroundColor: '#6366F1',
  },
  resultButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 360,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  helpModalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  helpModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E1B4B',
    textAlign: 'right',
  },
  helpModalBody: {
    maxHeight: 250,
  },
  helpModalSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366F1',
    textAlign: 'right',
    marginBottom: 6,
  },
  helpModalText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 18,
  },
  helpModalCloseButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  helpModalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleTasksButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  toggleTasksButtonText: {
    color: '#4338CA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeListRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  activeListText: {
    color: '#4338CA',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E1B4B',
    textAlign: 'right',
    marginBottom: 10,
  },
  segmentContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#4338CA',
    fontWeight: 'bold',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  modalList: {
    marginVertical: 10,
  },
  checkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
    flex: 1,
  },
  absentText: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  modalConfirmButton: {
    height: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  carouselCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  carouselHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  carouselArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
  },
  carouselStatusBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  carouselStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4338CA',
    textAlign: 'center',
  },
  advanceTurnButton: {
    flexDirection: 'row-reverse',
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  advanceTurnButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
