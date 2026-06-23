import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  TextInput,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { SharedList, Participant, UserTier } from '../types';
import { shuffle } from '../utils/queueEngine';

interface GroupsScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateGroups: (
    shuffledSequence: string[],
    allocationType: 'numberOfGroups' | 'countPerGroup',
    targetValue: number,
    groupLeaders?: string[]
  ) => Promise<void>;
  absentParticipantIds: string[];
  setAbsentParticipantIds: (ids: string[]) => void;
  userTier: UserTier;
}

const GroupsScreen: React.FC<GroupsScreenProps> = ({
  activeList,
  onBack,
  onUpdateGroups,
  absentParticipantIds,
  setAbsentParticipantIds,
  userTier,
}) => {
  if (!activeList) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <NavigationIcon name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>רשימה לא נמצאה</Text>
          <TouchableOpacity style={styles.backButtonInline} onPress={onBack}>
            <Text style={styles.backButtonInlineText}>חזרה למסך הבית</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(5);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  const participants = activeList.participants;
  const N = participants.length;

  const presentParticipants = useMemo(() => {
    return participants.filter(p => !absentParticipantIds.includes(p.id));
  }, [participants, absentParticipantIds]);

  const presentN = presentParticipants.length;

  const groupsState = activeList.groupsState;
  const hasDraw = groupsState && groupsState.shuffledSequence && groupsState.shuffledSequence.length > 0;

  // Local control state
  const [allocationType, setAllocationType] = useState<'numberOfGroups' | 'countPerGroup'>(
    groupsState?.allocationType || 'numberOfGroups'
  );
  const [targetValue, setTargetValue] = useState<number>(
    groupsState?.targetValue || 2
  );

  const isMounted = useRef(false);

  // Automatic recalculation when targetValue or allocationType changes
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (presentN === 0) return;

    const runAutoSplit = async () => {
      const currentSequence = (groupsState && groupsState.shuffledSequence && groupsState.shuffledSequence.length > 0)
        ? groupsState.shuffledSequence
        : shuffle(presentParticipants.map(p => p.id));
      await onUpdateGroups(currentSequence, allocationType, targetValue);
    };

    runAutoSplit();
  }, [targetValue, allocationType]);

  // Compute synchronized sequence immediately for local rendering
  const synchronizedSequence = useMemo(() => {
    if (!activeList || !activeList.groupsState || !activeList.groupsState.shuffledSequence) {
      return [];
    }
    const currentSequence = activeList.groupsState.shuffledSequence;
    const participantIds = activeList.participants.map(p => p.id);
    
    // Find newly added participants
    const addedIds = participantIds.filter(id => !currentSequence.includes(id));
    // Find deleted participants
    const deletedIds = currentSequence.filter(id => !participantIds.includes(id));
    
    if (addedIds.length > 0 || deletedIds.length > 0) {
      const cleanSequence = currentSequence.filter(id => !deletedIds.includes(id));
      return [...cleanSequence, ...addedIds];
    }
    return currentSequence;
  }, [activeList?.participants, activeList?.groupsState?.shuffledSequence]);

  // Synchronize new/deleted participants with the existing groupsState sequence on mount or updates
  useEffect(() => {
    if (!activeList || !activeList.groupsState || !activeList.groupsState.shuffledSequence) return;
    
    const currentSequence = activeList.groupsState.shuffledSequence;
    if (synchronizedSequence.length > 0 && JSON.stringify(synchronizedSequence) !== JSON.stringify(currentSequence)) {
      onUpdateGroups(
        synchronizedSequence,
        activeList.groupsState.allocationType,
        activeList.groupsState.targetValue
      );
    }
  }, [synchronizedSequence, activeList?.groupsState?.allocationType, activeList?.groupsState?.targetValue]);

  const handleIncrement = () => {
    setTargetValue(prev => prev + 1);
  };

  const handleDecrement = () => {
    setTargetValue(prev => (prev > 1 ? prev - 1 : 1));
  };

  // Perform split and update state
  const handleSplit = async () => {
    if (presentN === 0) {
      Alert.alert("שגיאה", "אין משתתפים נוכחים על מנת לבצע חלוקה לקבוצות.");
      return;
    }

    const ids = presentParticipants.map(p => p.id);
    const shuffled = shuffle(ids);
    await onUpdateGroups(shuffled, allocationType, targetValue);
  };

  // Handle random selection of a group leader for each group
  const handleDrawLeaders = async () => {
    if (activeGroups.length === 0) {
      Alert.alert("שגיאה", "יש לחלק את המשתתפים לקבוצות תחילה.");
      return;
    }

    const leaders: string[] = [];
    activeGroups.forEach((group) => {
      if (group.length > 0) {
        const randomIndex = Math.floor(Math.random() * group.length);
        leaders.push(group[randomIndex].id);
      } else {
        leaders.push('');
      }
    });

    if (groupsState) {
      await onUpdateGroups(
        synchronizedSequence,
        groupsState.allocationType,
        groupsState.targetValue,
        leaders
      );
    }
  };

  const participantsMap = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const getHebrewGroupComparison = (val: number) => {
    switch (val) {
      case 2: return 'זוג ייהפך לשלישייה';
      case 3: return 'שלישייה תהפוך לרביעייה';
      case 4: return 'רביעייה תהפוך לחמישייה';
      case 5: return 'חמישייה תהפוך לשישייה';
      case 6: return 'שישייה תהפוך לשביעייה';
      default: return `קבוצה של ${val} תהפוך ל-${val + 1}`;
    }
  };

  // Calculate allocation lists
  const distributeParticipants = (
    sequence: string[],
    type: 'numberOfGroups' | 'countPerGroup',
    val: number
  ) => {
    if (sequence.length === 0 || val <= 0) return [];
    
    const mapped = sequence
      .filter(id => !absentParticipantIds.includes(id)) // Exclude absentees
      .map(id => participantsMap.get(id))
      .filter((p): p is Participant => !!p);

    if (type === 'numberOfGroups') {
      const G = Math.min(val, mapped.length);
      const groups: Participant[][] = Array.from({ length: G }, () => []);
      for (let i = 0; i < mapped.length; i++) {
        groups[i % G].push(mapped[i]);
      }
      return groups;
    } else {
      const Y = val;
      const groups: Participant[][] = [];
      
      if (mapped.length <= Y) {
        if (mapped.length > 0) {
          groups.push(mapped);
        }
        return groups;
      }

      const remainder = mapped.length % Y;
      if (Y > 1 && remainder === 1) {
        const mainCount = mapped.length - 1;
        for (let i = 0; i < mainCount; i += Y) {
          groups.push(mapped.slice(i, i + Y));
        }
        if (groups.length > 0) {
          groups[0].push(mapped[mapped.length - 1]);
        }
      } else {
        for (let i = 0; i < mapped.length; i += Y) {
          groups.push(mapped.slice(i, i + Y));
        }
      }
      return groups;
    }
  };

  // Saved draw output
  const activeGroups = useMemo(() => {
    if (!hasDraw || !groupsState || synchronizedSequence.length === 0) return [];
    return distributeParticipants(
      synchronizedSequence,
      groupsState.allocationType,
      groupsState.targetValue
    );
  }, [hasDraw, groupsState, synchronizedSequence, absentParticipantIds, participantsMap]);

  // Live preview calculations
  const previewGroupsInfo = useMemo(() => {
    if (presentN === 0) return { count: 0, minSize: 0, maxSize: 0 };
    
    // Simulate distribution using current participant order
    const simulated = distributeParticipants(
      presentParticipants.map(p => p.id),
      allocationType,
      targetValue
    );

    const sizes = simulated.map(g => g.length);
    return {
      count: simulated.length,
      minSize: Math.min(...sizes) || 0,
      maxSize: Math.max(...sizes) || 0,
    };
  }, [presentN, presentParticipants, allocationType, targetValue, absentParticipantIds]);

  const absentNames = useMemo(() => {
    return absentParticipantIds
      .map(id => {
        const p = participants.find(part => part.id === id);
        return p ? `${p.firstName}${p.nickname ? ` (${p.nickname})` : ''}` : '';
      })
      .filter(name => name.length > 0)
      .join(', ');
  }, [absentParticipantIds, participants]);

  const handleShareWhatsApp = () => {
    if (userTier === 'guest') {
      Alert.alert('', 'כדי לשתף בוואטסאפ יש להתחבר למערכת!');
      return;
    }
    setShowAdModal(true);
    setAdCountdown(5);
    
    const interval = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const executeShare = async () => {
    try {
      let message = `👥 *חלוקת הקבוצות ההוגנת של Sortli 🎯*\n*הקבוצות שנקבעו לפעילות שלנו:*\n\n`;
      activeGroups.forEach((group, gIdx) => {
        message += `*קבוצה ${gIdx + 1}:* (${group.length} משתתפים)\n`;
        group.forEach((p, pIdx) => {
          const isLeader = groupsState?.groupLeaders && groupsState.groupLeaders[gIdx] === p.id;
          const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
          const leaderSuffix = isLeader ? ' 👑 (ראש קבוצה)' : '';
          message += `  ${pIdx + 1}. ${name}${leaderSuffix}\n`;
        });
        message += `\n`;
      });
      message += `נוצר באמצעות אפליקציית Sortli - בחירה הוגנת בסיבובים 🔄`;
      await Share.share({ message });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <NavigationIcon name="arrow-forward" size={26} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          חלוקה לקבוצות: {activeList.name}
        </Text>
        <TouchableOpacity onPress={() => setIsHelpModalOpen(true)} style={styles.backButton}>
          <NavigationIcon name="help-circle-outline" size={26} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {N === 0 ? (
          <View style={styles.errorContainer}>
            <NavigationIcon name="people-outline" size={64} color="#64748B" />
            <Text style={styles.errorText}>אין משתתפים ברשימה</Text>
            <Text style={styles.errorSubtext}>
              יש להוסיף משתתפים ברשימה במסך ניהול רשימה על מנת לבצע חלוקה לקבוצות.
            </Text>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            
            {/* Temporary Attendance Management Button */}
            <TouchableOpacity
              style={styles.attendanceButton}
              onPress={() => setIsModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.attendanceButtonText}>
                👥 עדכון נוכחות ({presentN}/{N})
              </Text>
            </TouchableOpacity>

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
                    {participants.map(p => {
                      const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
                      const isAbsent = absentParticipantIds.includes(p.id);
                      const isPresent = !isAbsent;

                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.checkRow}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isPresent) {
                              setAbsentParticipantIds([...absentParticipantIds, p.id]);
                            } else {
                              setAbsentParticipantIds(absentParticipantIds.filter(id => id !== p.id));
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
                    onPress={() => setIsModalOpen(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalConfirmButtonText}>אישור</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Fullscreen Test Ad Simulation Modal */}
            <Modal
              visible={showAdModal}
              animationType="slide"
              transparent={false}
              onRequestClose={() => {
                if (adCountdown === 0) {
                  setShowAdModal(false);
                  executeShare();
                }
              }}
            >
              <SafeAreaView style={styles.adModalContainer}>
                <StatusBar style="dark" />
                <View style={styles.adModalHeader}>
                  {adCountdown > 0 ? (
                    <View style={styles.adTimerBadge}>
                      <Text style={styles.adTimerText}>המודעה תיסגר בעוד {adCountdown} שניות...</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.adCloseButton}
                      onPress={() => {
                        setShowAdModal(false);
                        executeShare();
                      }}
                    >
                      <NavigationIcon name="close-circle" size={32} color="#1E1B4B" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.adContentContainer}>
                  <Text style={styles.adTagline}>פרסומת ממומנת</Text>
                  
                  {/* Stylized Placeholder Card */}
                  <View style={styles.adCard}>
                    <NavigationIcon name="logo-google" size={48} color="#4285F4" style={{ marginBottom: 16 }} />
                    <Text style={styles.adTitle}>Google AdMob Test Ad</Text>
                    <Text style={styles.adSubtitle}>מודעת בדיקה לדוגמה - שילוב מוניטיזציה עתידית</Text>
                    <View style={styles.adButtonMock}>
                      <Text style={styles.adButtonMockText}>הורד עכשיו</Text>
                    </View>
                  </View>

                  <Text style={styles.adDisclaimer}>
                    רכישת מנוי פרימיום תסיר פרסומות אלו לחלוטין ותאפשר שיתוף ישיר ללא עיכובים.
                  </Text>
                </View>
              </SafeAreaView>
            </Modal>

            {/* Mode Segmented Controls */}
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  allocationType === 'numberOfGroups' && styles.segmentButtonActive,
                ]}
                onPress={() => {
                  setAllocationType('numberOfGroups');
                  setTargetValue(2);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    allocationType === 'numberOfGroups' && styles.segmentTextActive,
                  ]}
                >
                  לפי מספר קבוצות 📊
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  allocationType === 'countPerGroup' && styles.segmentButtonActive,
                ]}
                onPress={() => {
                  setAllocationType('countPerGroup');
                  setTargetValue(3);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    allocationType === 'countPerGroup' && styles.segmentTextActive,
                  ]}
                >
                  לפי כמות בקבוצה 🧑‍🤝‍🧑
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stepper Controls */}
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperLabel}>
                {allocationType === 'numberOfGroups' ? 'כמות קבוצות רצויה:' : 'כמות משתתפים בקבוצה:'}
              </Text>
              <View style={styles.stepperActionRow}>
                <TouchableOpacity onPress={handleIncrement} style={styles.stepperButton}>
                  <NavigationIcon name="add" size={24} color="#6366F1" />
                </TouchableOpacity>
                <View style={styles.stepperValueContainer}>
                  <Text style={styles.stepperValueText}>{targetValue}</Text>
                </View>
                <TouchableOpacity onPress={handleDecrement} style={styles.stepperButton}>
                  <NavigationIcon name="remove" size={24} color="#6366F1" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Calculator Preview Badge */}
            <View style={styles.previewBadge}>
              <NavigationIcon name="calculator-outline" size={20} color="#047857" style={styles.previewBadgeIcon} />
              <Text style={styles.previewBadgeText}>
                חישוב צפוי: {previewGroupsInfo.count} קבוצות (בגודל {previewGroupsInfo.minSize === previewGroupsInfo.maxSize ? previewGroupsInfo.minSize : `${previewGroupsInfo.minSize}-${previewGroupsInfo.maxSize}`} משתתפים)
              </Text>
            </View>

            {/* Remainder Alert warning box */}
            {allocationType === 'countPerGroup' && targetValue > 1 && presentN > targetValue && presentN % targetValue === 1 && (
              <View style={styles.remainderAlert}>
                <NavigationIcon name="warning-outline" size={20} color="#D97706" style={styles.remainderAlertIcon} />
                <Text style={styles.remainderAlertText}>
                  התראת שארית: כדי שאף ילד לא יישאר לבד, ייווצרו קבוצות של {targetValue} משתתפים, וקבוצה אחת תהיה עם משתתף אחד נוסף ({getHebrewGroupComparison(targetValue)}).
                </Text>
              </View>
            )}

            {/* Action Trigger Button */}
            <TouchableOpacity
              style={styles.splitButton}
              onPress={handleSplit}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.splitButtonText}>
                  {hasDraw ? 'ערבב וחלק מחדש' : 'בצע חלוקה לקבוצות'}
                </Text>
                <NavigationIcon name="dice" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>

            {/* Active Output Section */}
            {hasDraw && activeGroups.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsSubtitle}>תוצאות החלוקה הנוכחית 📋</Text>

                {/* Draw Group Leaders Button */}
                <TouchableOpacity
                  style={styles.drawLeadersButton}
                  onPress={handleDrawLeaders}
                  activeOpacity={0.8}
                >
                  <NavigationIcon name="crown" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  <Text style={styles.drawLeadersButtonText}>הגרל ראש קבוצה 👑</Text>
                </TouchableOpacity>
                
                {activeGroups.map((group, gIdx) => (
                  <View key={gIdx} style={styles.groupCard}>
                    <View style={styles.groupCardHeader}>
                      <Text style={styles.groupCardHeaderCount}>{group.length} משתתפים</Text>
                      <Text style={styles.groupCardHeaderTitle}>קבוצה {gIdx + 1}</Text>
                    </View>
                    <View style={styles.groupListContainer}>
                      {group.map((p, pIdx) => {
                        const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
                        const isLeader = groupsState?.groupLeaders && groupsState.groupLeaders[gIdx] === p.id;
                        return (
                          <View key={p.id} style={[styles.memberRow, isLeader && styles.leaderMemberRow]}>
                            <View style={styles.memberNameContainer}>
                              {isLeader && (
                                <View style={styles.leaderBadge}>
                                  <NavigationIcon name="crown" size={14} color="#F59E0B" style={{ marginLeft: 4 }} />
                                  <Text style={styles.leaderText}>ראש קבוצה</Text>
                                </View>
                              )}
                              <Text style={[styles.memberName, isLeader && styles.leaderName]} numberOfLines={1}>
                                {name}
                              </Text>
                            </View>
                            <Text style={[styles.memberNumber, isLeader && styles.leaderNumber]}>{pIdx + 1}.</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* WhatsApp Share Button */}
                <TouchableOpacity
                  style={styles.shareWhatsAppButton}
                  onPress={handleShareWhatsApp}
                  activeOpacity={0.8}
                >
                  <NavigationIcon name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  <Text style={styles.shareWhatsAppButtonText}>שליחת רשימה לוואטסאפ 📝</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom Excluded/Absentee Banner */}
            {absentParticipantIds.length > 0 && (
              <View style={styles.absentBanner}>
                <Text style={styles.absentBannerText}>
                  💡 מחוץ להגרלה זמנית: {absentNames}
                </Text>
              </View>
            )}

          </View>
        )}
      </ScrollView>

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
              <Text style={styles.helpModalTitle}>חלוקה לקבוצות 👥</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                מזינים רשימת שמות, בוחרים כמה קבוצות תרצו ליצור, והאפליקציה מחלקת את כולם באופן אקראי, שווה ומאוזן לחלוטין.
              </Text>
              
              <Text style={[styles.helpModalSectionTitle, { marginTop: 16 }]}>דוגמה:</Text>
              <Text style={styles.helpModalText}>
                חלוקת תלמידים בכיתה לצוותי עבודה לפרויקט, או חלוקת חברים לקבוצות כדורגל מאוזנות.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.helpModalCloseButton} onPress={() => setIsHelpModalOpen(false)}>
              <Text style={styles.helpModalCloseButtonText}>הבנתי, תודה!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9FF',
    paddingTop: Platform.OS === 'android' ? 35 : 15,
  },
  header: {
    height: 60,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E1B4B',
    textAlign: 'center',
    flex: 1,
  },
  headerPlaceholder: {
    width: 40,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    paddingBottom: 40,
  },
  segmentContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#1E1B4B',
    fontWeight: '900',
  },
  stepperContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepperLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 16,
  },
  stepperActionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueContainer: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  previewBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  previewBadgeIcon: {
    marginLeft: 8,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    textAlign: 'center',
  },
  remainderAlert: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  remainderAlertIcon: {
    marginLeft: 8,
  },
  remainderAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    textAlign: 'right',
    flex: 1,
    lineHeight: 18,
  },
  splitButton: {
    height: 52,
    backgroundColor: '#10B981', // Emerald green
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 24,
  },
  splitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  resultsContainer: {
    width: '100%',
  },
  resultsSubtitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
    marginBottom: 16,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  groupCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  groupCardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  groupCardHeaderCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  groupListContainer: {
    padding: 12,
  },
  memberRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 80,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 24,
  },
  backButtonInline: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backButtonInlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
  },
  attendanceButton: {
    height: 44,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    paddingHorizontal: 16,
    marginBottom: 20,
    width: '100%',
  },
  attendanceButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  absentBanner: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  absentBannerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  shareWhatsAppButton: {
    height: 48,
    backgroundColor: '#25D366', // WhatsApp Green
    borderRadius: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  shareWhatsAppButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adModalContainer: {
    flex: 1,
    backgroundColor: '#FAF9FF',
    paddingTop: Platform.OS === 'android' ? 35 : 15,
  },
  adModalHeader: {
    height: 50,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  adTimerBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  adTimerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366F1',
  },
  adCloseButton: {
    padding: 4,
  },
  adContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  adTagline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  adCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    marginBottom: 30,
  },
  adTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 8,
    textAlign: 'center',
  },
  adSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  adButtonMock: {
    width: '100%',
    height: 48,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adButtonMockText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adDisclaimer: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
  },
  helpModalBody: {
    maxHeight: 250,
  },
  helpModalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6366F1',
    textAlign: 'right',
    marginBottom: 4,
  },
  helpModalText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 20,
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
    fontSize: 15,
    fontWeight: '700',
  },
  drawLeadersButton: {
    height: 48,
    backgroundColor: '#8B5CF6', // Purple
    borderRadius: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
  },
  drawLeadersButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberNameContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  leaderBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  leaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  leaderName: {
    color: '#B45309',
    fontWeight: '900',
  },
  leaderNumber: {
    color: '#F59E0B',
  },
  leaderMemberRow: {
    backgroundColor: '#FFFBEB',
  },
});

export default GroupsScreen;
