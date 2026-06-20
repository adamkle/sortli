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

interface TaskAllocationScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  userTier: UserTier;
}

export default function TaskAllocationScreen({
  activeList,
  onBack,
  userTier
}: TaskAllocationScreenProps) {
  // Local state for participants list for this session
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');

  // Local state for tasks list
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Result state
  const [allocations, setAllocations] = useState<ParticipantAllocation[]>([]);
  const [showCalculation, setShowCalculation] = useState(false);

  // Modal helpers
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Initialize participants from activeList if available
  useEffect(() => {
    if (activeList && activeList.participants) {
      const initialParts = activeList.participants.map(p => ({
        id: p.id,
        name: `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`
      }));
      setParticipants(initialParts);
    }
  }, [activeList]);

  // Add custom participant
  const handleAddParticipant = () => {
    const name = newParticipantName.trim();
    if (!name) {
      Alert.alert('שגיאה', 'נא להזין שם משתתף.');
      return;
    }
    const newId = `custom-p-${Date.now()}`;
    setParticipants(prev => [...prev, { id: newId, name }]);
    setNewParticipantName('');
    setShowCalculation(false);
  };

  // Remove participant
  const handleRemoveParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    setShowCalculation(false);
  };

  // Add task
  const handleAddTask = () => {
    const title = newTaskTitle.trim();
    if (!title) {
      Alert.alert('שגיאה', 'נא להזין תיאור משימה.');
      return;
    }
    const newId = `task-${Date.now()}`;
    setTasks(prev => [...prev, { id: newId, title, weight: 1 }]);
    setNewTaskTitle('');
    setShowCalculation(false);
  };

  // Remove task
  const handleRemoveTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setShowCalculation(false);
  };

  // Update task weight
  const handleUpdateTaskWeight = (id: string, weight: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, weight } : t));
    setShowCalculation(false);
  };

  // Execute fair allocation
  const handleCalculateAllocation = () => {
    if (participants.length === 0) {
      Alert.alert('שגיאה', 'נא להוסיף לפחות משתתף אחד לחלוקה.');
      return;
    }
    if (tasks.length === 0) {
      Alert.alert('שגיאה', 'נא להוסיף לפחות משימה אחת לחלוקה.');
      return;
    }

    const result = allocateTasksFairly(participants, tasks);
    setAllocations(result);
    setShowCalculation(true);
    Keyboard.dismiss();
  };

  // Share allocation result
  const handleShareResult = async () => {
    if (allocations.length === 0) return;

    let shareText = `📋 *חלוקת משימות הוגנת מבית Sortli 🎯*\n`;
    if (activeList) {
      shareText += `*פעילות:* ${activeList.name}\n`;
    }
    shareText += `\n`;

    allocations.forEach(alloc => {
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
          חלוקת משימות הוגנת
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
          {/* Section 1: Participants */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <NavigationIcon name="people-outline" size={20} color="#6366F1" />
              <Text style={styles.sectionTitle}>משתתפים בחלוקה ({participants.length})</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="הוסף שם משתתף..."
                placeholderTextColor="#94A3B8"
                value={newParticipantName}
                onChangeText={setNewParticipantName}
                textAlign="right"
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
                <NavigationIcon name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {participants.length === 0 ? (
              <Text style={styles.emptyListText}>טרם נוספו משתתפים. השתמש בתיבה מעל כדי להוסיף.</Text>
            ) : (
              <View style={styles.badgeContainer}>
                {participants.map(p => (
                  <View key={p.id} style={styles.badge}>
                    <Text style={styles.badgeText}>{p.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveParticipant(p.id)} style={styles.badgeCloseButton}>
                      <NavigationIcon name="close" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section 2: Tasks */}
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

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              (participants.length === 0 || tasks.length === 0) && styles.actionButtonDisabled
            ]}
            onPress={handleCalculateAllocation}
            disabled={participants.length === 0 || tasks.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {isStandardLottery ? 'בצע הגרלת משימות שוויונית 🎲' : 'חשב חלוקת משימות הוגנת 🎯'}
            </Text>
          </TouchableOpacity>

          {/* Section 3: Results */}
          {showCalculation && allocations.length > 0 && (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>תוצאת החלוקה האופטימלית 📊</Text>

              {isStandardLottery && (
                <View style={styles.lotteryNotice}>
                  <Text style={styles.lotteryNoticeText}>
                    💡 המשימות חולקו בהגרלה שוויונית רגילה מכיוון שכל המשימות בעלות אותו המשקל.
                  </Text>
                </View>
              )}

              <View style={styles.allocationsContainer}>
                {allocations.map(alloc => (
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

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareResult}
                activeOpacity={0.8}
              >
                <NavigationIcon name="logo-whatsapp" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
                <Text style={styles.shareButtonText}>שתף תוצאות בוואטסאפ</Text>
              </TouchableOpacity>
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
                {'\n\n'}
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
  shareButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  }
});
