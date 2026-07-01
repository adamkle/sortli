import React, { useState, useMemo, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { SharedList, Participant, UserTier } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GroupAllocationScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  absentParticipantIds: string[];
  setAbsentParticipantIds: (ids: string[]) => void;
  userTier: UserTier;
}

interface AllocationResult {
  leader: Participant;
  members: Participant[];
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const GroupAllocationScreen: React.FC<GroupAllocationScreenProps> = ({
  activeList,
  onBack,
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

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [allocationResult, setAllocationResult] = useState<AllocationResult[] | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedForSwap, setSelectedForSwap] = useState<{ participantId: string; leaderId: string }[]>([]);

  const participants = activeList.participants;
  const N = participants.length;

  const presentParticipants = useMemo(() => {
    return participants.filter(p => !absentParticipantIds.includes(p.id));
  }, [participants, absentParticipantIds]);

  const presentN = presentParticipants.length;

  // Load saved allocation from AsyncStorage on mount/activeList change
  useEffect(() => {
    const loadSavedAllocation = async () => {
      try {
        const saved = await AsyncStorage.getItem(`fairturn_group_allocation_${activeList.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setAllocationResult(parsed);
          
          // Also rebuild selectedLeaderIds if we have saved allocation
          const leaderIds = parsed.map((g: AllocationResult) => g.leader.id);
          setSelectedLeaderIds(leaderIds);
        }
      } catch (e) {
        console.error("Failed to load saved allocation result:", e);
      }
    };
    loadSavedAllocation();
  }, [activeList.id]);

  // Clear selected leaders if they become absent
  useEffect(() => {
    setSelectedLeaderIds(prev => prev.filter(id => !absentParticipantIds.includes(id)));
    setSelectedForSwap(prev => prev.filter(item => !absentParticipantIds.includes(item.participantId)));
  }, [absentParticipantIds]);

  const saveAllocation = async (result: AllocationResult[]) => {
    try {
      await AsyncStorage.setItem(
        `fairturn_group_allocation_${activeList.id}`,
        JSON.stringify(result)
      );
    } catch (e) {
      console.error("Failed to save allocation result:", e);
    }
  };

  const toggleLeaderSelection = (id: string) => {
    setSelectedLeaderIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(leaderId => leaderId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSplit = () => {
    if (selectedLeaderIds.length === 0) {
      Alert.alert("שגיאה", "אנא בחר לפחות מוביל אחד מתוך הרשימה.");
      return;
    }

    if (selectedLeaderIds.length >= presentN) {
      Alert.alert(
        "שגיאה",
        "לא ניתן להגדיר את כל המשתתפים כראשי קבוצה. יש להשאיר חברים לחלוקה."
      );
      return;
    }

    const participantsMap = new Map(presentParticipants.map(p => [p.id, p]));
    const leaders = selectedLeaderIds
      .map(id => participantsMap.get(id))
      .filter((p): p is Participant => !!p);

    const nonLeaders = presentParticipants.filter(p => !selectedLeaderIds.includes(p.id));
    const shuffledNonLeaders = shuffleArray(nonLeaders);

    const result: AllocationResult[] = leaders.map(leader => ({
      leader,
      members: []
    }));

    shuffledNonLeaders.forEach((member, index) => {
      const targetGroup = result[index % result.length];
      targetGroup.members.push(member);
    });

    setAllocationResult(result);
    saveAllocation(result);
  };

  const performSwap = (
    first: { participantId: string; leaderId: string },
    second: { participantId: string; leaderId: string }
  ) => {
    if (!allocationResult) return;

    const newAllocation = allocationResult.map(group => {
      let newMembers = [...group.members];

      if (group.leader.id === first.leaderId) {
        const secondParticipant = allocationResult
          .find(g => g.leader.id === second.leaderId)
          ?.members.find(m => m.id === second.participantId);

        if (secondParticipant) {
          newMembers = newMembers.map(m => m.id === first.participantId ? secondParticipant : m);
        }
      }

      if (group.leader.id === second.leaderId) {
        const firstParticipant = allocationResult
          .find(g => g.leader.id === first.leaderId)
          ?.members.find(m => m.id === first.participantId);

        if (firstParticipant) {
          newMembers = newMembers.map(m => m.id === second.participantId ? firstParticipant : m);
        }
      }

      return {
        ...group,
        members: newMembers
      };
    });

    setAllocationResult(newAllocation);
    saveAllocation(newAllocation);
  };

  const handleSelectMemberForSwap = (participantId: string, leaderId: string) => {
    setSelectedForSwap(prev => {
      const isAlreadySelected = prev.some(item => item.participantId === participantId);
      if (isAlreadySelected) {
        return prev.filter(item => item.participantId !== participantId);
      }

      if (prev.length === 1) {
        const firstSelection = prev[0];
        // Same group: cancel first selection and transfer focus to the newly clicked member
        if (firstSelection.leaderId === leaderId) {
          return [{ participantId, leaderId }];
        }

        // Different groups: swap immediately
        setTimeout(() => {
          performSwap(firstSelection, { participantId, leaderId });
        }, 150);
        return [];
      }

      return [{ participantId, leaderId }];
    });
  };

  const handleShare = async () => {
    if (!allocationResult) return;

    if (userTier === 'guest') {
      Alert.alert('', 'כדי לשתף יש להתחבר למערכת!');
      return;
    }

    try {
      let message = `👥 *חלוקה לפי מובילים של Sortli 🎯*\n*הקבוצות שנקבעו לפעילות שלנו:*\n\n`;
      allocationResult.forEach((group, index) => {
        const leaderName = `${group.leader.firstName}${group.leader.lastName ? ' ' + group.leader.lastName : ''}${group.leader.nickname ? ` (${group.leader.nickname})` : ''}`;
        message += `👑 *מוביל/ה: ${leaderName}* (${group.members.length} חברים)\n`;
        if (group.members.length === 0) {
          message += `  (אין חברי קבוצה)\n`;
        } else {
          group.members.forEach((member, mIdx) => {
            const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}${member.nickname ? ` (${member.nickname})` : ''}`;
            message += `  ${mIdx + 1}. ${memberName}\n`;
          });
        }
        message += `\n`;
      });
      message += `נוצר באמצעות אפליקציית Sortli - בחירה הוגנת בסיבובים 🔄`;
      await Share.share({ message });
    } catch (error) {
      console.error("Error sharing allocation result:", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <NavigationIcon name="arrow-forward" size={24} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>חלוקה לפי מובילים 👑</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          !allocationResult ? { paddingBottom: 130 } : { paddingBottom: 80 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Attendance Button */}
        {!allocationResult && (
          <TouchableOpacity
            style={styles.attendanceButton}
            onPress={() => setIsAttendanceModalOpen(true)}
          >
            <NavigationIcon name="people-outline" size={18} color="#4F46E5" style={{ marginLeft: 8 }} />
            <Text style={styles.attendanceButtonText}>
              עריכת נוכחות ({presentN}/{N})
            </Text>
          </TouchableOpacity>
        )}

        {!allocationResult ? (
          <>
            {/* Selection Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>בחירת מובילים (ראשי קבוצות)</Text>
              <Text style={styles.cardSubtitle}>
                סמן בכתר 👑 את המשתתפים שיובילו את הקבוצות. שאר המשתתפים יחולקו ביניהם באופן שווה.
              </Text>

              {presentParticipants.length === 0 ? (
                <Text style={styles.noParticipantsText}>אין משתתפים נוכחים בקבוצה.</Text>
              ) : (
                <View style={styles.participantsList}>
                  {presentParticipants.map(p => {
                    const isSelected = selectedLeaderIds.includes(p.id);
                    const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;

                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.participantRow, isSelected && styles.participantRowSelected]}
                        onPress={() => toggleLeaderSelection(p.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.participantName, isSelected && styles.participantNameSelected]}>
                          {name}
                        </Text>
                        <NavigationIcon
                          name={isSelected ? "ribbon" : "ribbon-outline"}
                          size={24}
                          color={isSelected ? "#EAB308" : "#94A3B8"}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            {/* Results Header */}
            <View style={styles.resultsHeaderContainer}>
              <Text style={styles.resultsTitleCentred}>תוצאות החלוקה לקבוצות</Text>
            </View>

            {/* Results Sub-Header Row */}
            <View style={styles.resultsSubHeaderRow}>
              <TouchableOpacity
                style={styles.editBtnLink}
                onPress={() => {
                  setAllocationResult(null);
                  setIsEditMode(false);
                  setSelectedForSwap([]);
                  AsyncStorage.removeItem(`fairturn_group_allocation_${activeList.id}`).catch(err => console.error(err));
                }}
                activeOpacity={0.7}
              >
                <NavigationIcon name="refresh-outline" size={14} color="#EF4444" style={{ marginLeft: 4 }} />
                <Text style={[styles.editBtnLinkText, { color: '#EF4444' }]}>בחירה מחדש</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smallAttendanceLink}
                onPress={() => setIsAttendanceModalOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.smallAttendanceLinkText}>עריכת נוכחות ({presentN}/{N})</Text>
              </TouchableOpacity>
            </View>

            {/* Control Buttons Row */}
            <View style={styles.controlButtonsRow}>
              <TouchableOpacity
                style={[styles.iconControlButton, isEditMode && styles.iconControlButtonActive]}
                onPress={() => setIsEditMode(prev => {
                  if (prev) {
                    setSelectedForSwap([]);
                  }
                  return !prev;
                })}
                activeOpacity={0.8}
              >
                <NavigationIcon
                  name={isEditMode ? "close" : "pencil"}
                  size={16}
                  color={isEditMode ? "#FFFFFF" : "#4F46E5"}
                  style={{ marginLeft: 6 }}
                />
                <Text style={[styles.iconControlButtonText, isEditMode && styles.iconControlButtonTextActive]}>
                  {isEditMode ? "סגירת עריכה" : "עריכה ידנית"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconControlButton}
                onPress={() => {
                  setIsEditMode(false);
                  setSelectedForSwap([]);
                  handleSplit();
                }}
                activeOpacity={0.8}
              >
                <NavigationIcon name="refresh-outline" size={16} color="#4F46E5" style={{ marginLeft: 6 }} />
                <Text style={styles.iconControlButtonText}>חלוקה מחדש</Text>
              </TouchableOpacity>
            </View>

            {/* Swap Hint Banner */}
            {isEditMode && (
              <View style={styles.swapHintContainer}>
                <NavigationIcon name="help-circle-outline" size={18} color="#4F46E5" style={{ marginLeft: 8 }} />
                <Text style={styles.swapHintText}>
                  {selectedForSwap.length === 0 
                    ? "בחר משתתף ראשון להחלפה..." 
                    : selectedForSwap.length === 1 
                      ? "בחר משתתף שני מקבוצה אחרת כדי לבצע את ההחלפה" 
                      : "מבצע החלפה..."}
                </Text>
              </View>
            )}

            {/* Allocation results cards */}
            <View style={styles.resultsContainer}>
              {allocationResult.map((group, index) => {
                const leaderName = `${group.leader.firstName}${group.leader.lastName ? ' ' + group.leader.lastName : ''}${group.leader.nickname ? ` (${group.leader.nickname})` : ''}`;

                return (
                  <View key={group.leader.id} style={styles.groupCard}>
                    <View style={styles.groupHeader}>
                      <NavigationIcon name="ribbon" size={20} color="#EAB308" style={{ marginLeft: 8 }} />
                      <Text style={styles.groupLeaderName} numberOfLines={1}>
                        {leaderName}
                      </Text>
                      <View style={styles.groupCountBadge}>
                        <Text style={styles.groupCountText}>{group.members.length} חברים</Text>
                      </View>
                    </View>

                    <View style={styles.groupMembersList}>
                      {group.members.length === 0 ? (
                        <Text style={styles.noMembersText}>אין חברים בקבוצה זו</Text>
                      ) : (
                        group.members.map((member, mIdx) => {
                          const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}${member.nickname ? ` (${member.nickname})` : ''}`;
                          const isSelectedForSwap = selectedForSwap.some(item => item.participantId === member.id);

                          if (isEditMode) {
                            return (
                              <TouchableOpacity
                                key={member.id}
                                style={[
                                  styles.memberRow, 
                                  styles.memberRowEditable,
                                  isSelectedForSwap && styles.memberRowSelectedForSwap
                                ]}
                                onPress={() => handleSelectMemberForSwap(member.id, group.leader.id)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.memberNumber}>{mIdx + 1}.</Text>
                                <Text style={styles.memberName} numberOfLines={1}>{memberName}</Text>
                              </TouchableOpacity>
                            );
                          }

                          return (
                            <View key={member.id} style={styles.memberRow}>
                              <Text style={styles.memberNumber}>{mIdx + 1}.</Text>
                              <Text style={styles.memberName} numberOfLines={1}>{memberName}</Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Results Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.shareButton, { flex: 1, width: '100%' }]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <NavigationIcon name="share-social-outline" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                <Text style={styles.shareButtonText}>שתף תוצאה 📱</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Temporary Attendance Modal */}
      <Modal
        visible={isAttendanceModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsAttendanceModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsAttendanceModalOpen(false)}>
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
              onPress={() => setIsAttendanceModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmButtonText}>אישור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Floating Split Button */}
      {!allocationResult && (
        <TouchableOpacity
          style={[
            styles.floatingSplitButton,
            (selectedLeaderIds.length === 0 || selectedLeaderIds.length >= presentN) && styles.splitButtonDisabled
          ]}
          onPress={handleSplit}
          activeOpacity={0.8}
          disabled={selectedLeaderIds.length === 0 || selectedLeaderIds.length >= presentN}
        >
          <NavigationIcon name="grid-outline" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
          <Text style={styles.splitButtonText}>חלק קבוצות לקבוצות שוות</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 16,
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
    marginBottom: 16,
    width: '100%',
  },
  attendanceButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 18,
  },
  noParticipantsText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
  },
  participantsList: {
    width: '100%',
  },
  participantRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  participantRowSelected: {
    borderColor: '#FEF08A',
    backgroundColor: '#FEFDE8',
  },
  participantName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    flex: 1,
  },
  participantNameSelected: {
    color: '#854D0E',
  },
  splitButton: {
    height: 52,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    width: '100%',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  splitButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowColor: 'transparent',
    elevation: 0,
  },
  splitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  resultsHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  editBtnLink: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  editBtnLinkText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  resultsContainer: {
    width: '100%',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  groupLeaderName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
    flex: 1,
    marginRight: 6,
  },
  groupCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  groupCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  groupMembersList: {
    width: '100%',
  },
  noMembersText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 12,
  },
  memberRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  memberRowEditable: {
    paddingHorizontal: 8,
    borderRadius: 8,
    marginVertical: 2,
  },
  memberRowSelectedForSwap: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
  },
  swapHintContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  swapHintText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
    textAlign: 'right',
    flex: 1,
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
    color: '#475569',
    textAlign: 'right',
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row-reverse',
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  recalculateButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  recalculateButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  shareButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingSplitButton: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    zIndex: 999,
    height: 52,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resultsHeaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  resultsTitleCentred: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    width: '100%',
  },
  resultsSubHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
    width: '100%',
  },
  segmentedControl: {
    flexDirection: 'row-reverse',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    overflow: 'hidden',
    alignItems: 'center',
  },
  segmentedButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentedButtonActive: {
    backgroundColor: '#4F46E5',
  },
  segmentedButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  segmentedButtonTextActive: {
    color: '#FFFFFF',
  },
  segmentedSeparator: {
    width: 1.5,
    height: 24,
    backgroundColor: '#C7D2FE',
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
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  modalList: {
    maxHeight: 300,
  },
  checkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkText: {
    fontSize: 14,
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  smallAttendanceLink: {
    marginTop: 4,
    paddingVertical: 2,
  },
  smallAttendanceLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    textDecorationLine: 'underline',
  },
  controlButtonsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  iconControlButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
  },
  iconControlButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  iconControlButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  iconControlButtonTextActive: {
    color: '#FFFFFF',
  },
});

export default GroupAllocationScreen;
