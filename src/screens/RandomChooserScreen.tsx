import React, { useMemo, useState } from 'react';
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

interface RandomChooserScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateChooser: (chosenIds: string[], lastChosenId: string | null) => Promise<void>;
  absentParticipantIds: string[];
  setAbsentParticipantIds: (ids: string[]) => void;
  userTier: UserTier;
}

const RandomChooserScreen: React.FC<RandomChooserScreenProps> = ({
  activeList,
  onBack,
  onUpdateChooser,
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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(5);

  const participants = activeList.participants;
  const N = participants.length;

  const presentParticipants = useMemo(() => {
    return participants.filter(p => !absentParticipantIds.includes(p.id));
  }, [participants, absentParticipantIds]);

  const presentN = presentParticipants.length;
  
  // Extract and sanitize state
  const chooserState = activeList.randomChooserState;
  
  // Filter out any chosen IDs that are no longer in the participants list (mid-cycle removal safety)
  const chosenIds = useMemo(() => {
    const rawIds = chooserState?.chosenIds || [];
    return rawIds.filter(id => participants.some(p => p.id === id));
  }, [chooserState?.chosenIds, participants]);

  const lastChosenId = useMemo(() => {
    const rawLast = chooserState?.lastChosenId || null;
    return rawLast && participants.some(p => p.id === rawLast) ? rawLast : null;
  }, [chooserState?.lastChosenId, participants]);

  // Derived participant lists
  const participantsMap = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);
  
  const lastChosenParticipant = useMemo(() => {
    return lastChosenId && !absentParticipantIds.includes(lastChosenId) ? participantsMap.get(lastChosenId) : null;
  }, [lastChosenId, absentParticipantIds, participantsMap]);

  const remainingParticipants = useMemo(() => {
    return presentParticipants.filter(p => !chosenIds.includes(p.id));
  }, [presentParticipants, chosenIds]);

  const chosenParticipants = useMemo(() => {
    return chosenIds
      .filter(id => !absentParticipantIds.includes(id))
      .map(id => participantsMap.get(id))
      .filter((p): p is Participant => !!p);
  }, [chosenIds, absentParticipantIds, participantsMap]);

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
      const listName = activeList?.name || '';
      let message = `🏆 *הגרלת תורן הוגנת מבית Sortli 🎯*\n*פעילות: ${listName}*\n\n`;
      
      if (lastChosenParticipant) {
        const name = `${lastChosenParticipant.firstName}${lastChosenParticipant.lastName ? ' ' + lastChosenParticipant.lastName : ''}${lastChosenParticipant.nickname ? ` (${lastChosenParticipant.nickname})` : ''}`;
        message += `👑 *הנבחר הנוכחי:* ${name}\n\n`;
      }
      
      message += `✅ *כבר נבחרו:* (${chosenParticipants.length})\n`;
      if (chosenParticipants.length === 0) {
        message += `- טרם נבחרו משתתפים\n`;
      } else {
        chosenParticipants.forEach(p => {
          const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
          message += `- ${name}\n`;
        });
      }
      
      message += `\n⏳ *ממתינים בתור:* (${remainingParticipants.length})\n`;
      if (remainingParticipants.length === 0) {
        message += `- כולם נבחרו בסבב זה!\n`;
      } else {
        remainingParticipants.forEach(p => {
          const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
          message += `- ${name}\n`;
        });
      }
      
      message += `\nנוצר באמצעות אפליקציית Sortli - בחירה הוגנת בסיבובים 🔄`;
      await Share.share({ message });
    } catch (error) {
      console.error(error);
    }
  };

  // Main draw handler
  const handleDraw = async () => {
    if (presentN === 0) {
      Alert.alert("שגיאה", "אין משתתפים נוכחים לביצוע ההגרלה.");
      return;
    }

    let nextChosenIds = chosenIds.filter(id => !absentParticipantIds.includes(id));
    let pool = remainingParticipants;

    // Cycle completion logic
    if (pool.length === 0) {
      // If cycle is complete, reset and make all eligible,
      // but try to prevent drawing the lastChosenId immediately if N > 1
      nextChosenIds = [];
      pool = presentN > 1 ? presentParticipants.filter(p => p.id !== lastChosenId) : presentParticipants;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const selected = pool[randomIndex];

    const finalChosenIds = [...nextChosenIds, selected.id];
    await onUpdateChooser(finalChosenIds, selected.id);
  };

  // Reset handler
  const handleReset = async () => {
    if (chosenIds.length === 0 && lastChosenId === null) return;
    
    Alert.alert(
      "איפוס הגרלה",
      "האם אתה בטוח שברצונך לאפס את סבב הבחירה הנוכחי?",
      [
        { text: "ביטול", style: "cancel" },
        { 
          text: "כן, אפס", 
          onPress: () => onUpdateChooser([], null),
          style: "destructive"
        }
      ]
    );
  };

  // Calculate progress percentage
  const progressPercent = presentN > 0 ? (chosenParticipants.length / presentN) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <NavigationIcon name="arrow-forward" size={26} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          הגרלת תורן: {activeList.name}
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
              יש להוסיף משתתפים ברשימה במסך ניהול רשימה על מנת לבצע הגרלת תורן.
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

            {/* Prominent Current Draw Section */}
            <View style={styles.drawDisplayCard}>
              <Text style={styles.drawDisplayLabel}>הנבחר הנוכחי 🏆</Text>
              {lastChosenParticipant ? (
                <View style={styles.drawnParticipantContainer}>
                  <Text style={styles.drawnParticipantName}>
                    {lastChosenParticipant.firstName} {lastChosenParticipant.lastName || ''}
                  </Text>
                  {lastChosenParticipant.nickname && (
                    <Text style={styles.drawnParticipantNickname}>
                      ({lastChosenParticipant.nickname})
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.drawnPlaceholderContainer}>
                  <NavigationIcon name="help-circle-outline" size={54} color="#94A3B8" />
                  <Text style={styles.drawnPlaceholderText}>לחץ על הכפתור למטה כדי להגריל</Text>
                </View>
              )}
            </View>

            {/* Cycle Progress Tracker */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    onPress={handleReset}
                    disabled={chosenIds.length === 0 && !lastChosenId}
                    style={[
                      styles.inlineResetButton,
                      (chosenIds.length === 0 && !lastChosenId) && styles.disabledOpacity
                    ]}
                  >
                    <NavigationIcon name="refresh-outline" size={12} color="#EF4444" />
                    <Text style={styles.inlineResetText}>איפוס</Text>
                  </TouchableOpacity>
                  <Text style={styles.progressSub}>
                    הושלם: {chosenParticipants.length} מתוך {presentN}
                  </Text>
                </View>
                <Text style={styles.progressTitle}>התקדמות סבב הבחירה</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
              {chosenParticipants.length === presentN && presentN > 0 && (
                <View style={styles.roundCompletedBadge}>
                  <NavigationIcon name="checkmark-done-circle" size={18} color="#10B981" />
                  <Text style={styles.roundCompletedText}>הסבב הושלם! הבחירה הבאה תפתח סבב חדש 🎉</Text>
                </View>
              )}
            </View>

            {/* Columns split for Givers/Receivers */}
            <View style={styles.listsContainer}>
              {/* Column 1: Remaining (Waitlist) */}
              <View style={styles.listColumn}>
                <Text style={styles.columnTitle}>ממתינים בתור ({remainingParticipants.length})</Text>
                {remainingParticipants.length === 0 ? (
                  <View style={styles.emptyColumnBox}>
                    <NavigationIcon name="happy-outline" size={28} color="#10B981" />
                    <Text style={styles.emptyColumnText}>כולם נבחרו בסבב זה!</Text>
                  </View>
                ) : (
                  remainingParticipants.map(p => (
                    <View key={p.id} style={styles.participantRowCard}>
                      <NavigationIcon name="hourglass-outline" size={16} color="#6366F1" style={styles.rowIcon} />
                      <Text style={styles.rowText} numberOfLines={1}>
                        {p.firstName} {p.lastName || ''}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              {/* Column 2: Already Chosen */}
              <View style={styles.listColumn}>
                <Text style={styles.columnTitle}>כבר נבחרו ({chosenParticipants.length})</Text>
                {chosenParticipants.length === 0 ? (
                  <View style={styles.emptyColumnBox}>
                    <NavigationIcon name="ellipse-outline" size={28} color="#94A3B8" />
                    <Text style={styles.emptyColumnText}>טרם נבחרו משתתפים</Text>
                  </View>
                ) : (
                  chosenParticipants.map(p => (
                    <View key={p.id} style={[styles.participantRowCard, styles.chosenOpacity]}>
                      <NavigationIcon name="checkmark-circle" size={16} color="#10B981" style={styles.rowIcon} />
                      <Text style={[styles.rowText, styles.chosenLineThrough]} numberOfLines={1}>
                        {p.firstName} {p.lastName || ''}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* WhatsApp Share Button */}
            {(chosenIds.length > 0 || lastChosenId !== null) && (
              <TouchableOpacity
                style={styles.shareWhatsAppButton}
                onPress={handleShareWhatsApp}
                activeOpacity={0.8}
              >
                <NavigationIcon name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                <Text style={styles.shareWhatsAppButtonText}>שילוח קבוצה לוואטסאפ 📝</Text>
              </TouchableOpacity>
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

      {/* Footer Draw Button */}
      {N > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.drawButton}
            onPress={handleDraw}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.drawButtonText}>
                {chosenIds.length === N ? 'התחל סבב חדש והגרל' : 'הגרל תורן הבא'}
              </Text>
              <NavigationIcon name="dice" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        </View>
      )}

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
              <Text style={styles.helpModalTitle}>הגרלת תורן 📋</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                צריכים לבחור מישהו לביצוע משימה או קבלת זכות ברגע זה? המערכת תבצע הגרלה שקופה מתוך הרשימה.{"\n"}
                <Text style={{ fontWeight: '800' }}>חשוב לדעת:</Text> המערכת מוודאת שכולם בסוף יוגרלו! משתתף שכבר נבחר לא יכול לצאת פעמיים עד שכולם יקבלו הזדמנות.
              </Text>
              
              <Text style={[styles.helpModalSectionTitle, { marginTop: 16 }]}>לדוגמה:</Text>
              <Text style={styles.helpModalText}>
                • מי זוכה לקבל את גביע מצטיין השבוע או לשמור על חיית המחמד הכיתתית בסופ"ש.{"\n"}
                • מי תורן לנקות את הלוח בסוף השיעור או מי צריך לצאת לזרוק את הזבל היום.
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
  resetButtonHeader: {
    padding: 8,
  },
  inlineResetButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 4,
  },
  inlineResetText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  disabledOpacity: {
    opacity: 0.35,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    paddingBottom: 40,
  },
  drawDisplayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 20,
  },
  drawDisplayLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 10,
  },
  drawnParticipantContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  drawnParticipantName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  drawnParticipantNickname: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 4,
  },
  drawnPlaceholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  drawnPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  progressSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 5,
  },
  roundCompletedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  roundCompletedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    marginRight: 6,
    textAlign: 'center',
  },
  listsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
  },
  listColumn: {
    width: '48.5%',
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
    marginBottom: 10,
    paddingRight: 4,
  },
  emptyColumnBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyColumnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  participantRowCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  rowIcon: {
    marginLeft: 8,
  },
  rowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
    textAlign: 'right',
  },
  chosenOpacity: {
    opacity: 0.5,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  chosenLineThrough: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FAF9FF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  drawButton: {
    height: 52,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  drawButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
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
});

export default RandomChooserScreen;
