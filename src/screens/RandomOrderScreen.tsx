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
import { shuffle } from '../utils/queueEngine';

interface RandomOrderScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateRandomOrder: (shuffledSequence: string[]) => Promise<void>;
  absentParticipantIds: string[];
  setAbsentParticipantIds: (ids: string[]) => void;
  userTier: UserTier;
}

const RandomOrderScreen: React.FC<RandomOrderScreenProps> = ({
  activeList,
  onBack,
  onUpdateRandomOrder,
  absentParticipantIds,
  setAbsentParticipantIds,
  userTier,
}) => {
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(5);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

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

  const participants = activeList.participants;
  const N = participants.length;

  const presentParticipants = useMemo(() => {
    return participants.filter(p => !absentParticipantIds.includes(p.id));
  }, [participants, absentParticipantIds]);

  const presentN = presentParticipants.length;

  const randomOrderState = activeList.randomOrderState;
  const shuffledSequence = useMemo(() => {
    const rawSeq = randomOrderState?.shuffledSequence || [];
    // Sanitize sequence to only include active participants
    return rawSeq.filter(id => participants.some(p => p.id === id));
  }, [randomOrderState?.shuffledSequence, participants]);

  const hasDraw = shuffledSequence.length > 0;

  const handleShuffle = async () => {
    if (presentN < 2) {
      Alert.alert("שגיאה", "יש לסמן לפחות 2 משתתפים נוכחים על מנת ליצור סדר אקראי.");
      return;
    }

    setIsShuffling(true);
    try {
      const ids = presentParticipants.map(p => p.id);
      const shuffled = shuffle(ids);
      await onUpdateRandomOrder(shuffled);
    } catch (err) {
      console.error(err);
    } finally {
      setIsShuffling(false);
    }
  };

  const participantsMap = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const orderedParticipants = useMemo(() => {
    return shuffledSequence
      .filter(id => !absentParticipantIds.includes(id)) // Filter out absent IDs dynamically
      .map(id => participantsMap.get(id))
      .filter((p): p is Participant => !!p);
  }, [shuffledSequence, absentParticipantIds, participantsMap]);

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
      let message = `📋 *סדר התורנות ההוגן מבית Sortli 🎯*\n*פעילות: ${listName}*\n\n`;
      orderedParticipants.forEach((p, idx) => {
        const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
        message += `${idx + 1}. ${name}\n`;
      });
      message += `\nנוצר באמצעות אפליקציית Sortli - בחירה הוגנת בסיבובים 🔄`;
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
          סדר אקראי: {activeList.name}
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
        {N < 2 ? (
          <View style={styles.errorContainer}>
            <NavigationIcon name="list-outline" size={64} color="#64748B" />
            <Text style={styles.errorText}>אין מספיק משתתפים</Text>
            <Text style={styles.errorSubtext}>
              יש להוסיף לפחות 2 משתתפים ברשימה (במסך ניהול רשימה) על מנת לקבוע סדר אקראי.
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
                            color={isPresent ? "#F97316" : "#94A3B8"}
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

            {/* Shuffle Button */}
            <TouchableOpacity
              style={[styles.actionButton, isShuffling && styles.disabledOpacity]}
              onPress={handleShuffle}
              disabled={isShuffling}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.actionButtonText}>
                  {isShuffling ? 'מגריל מחדש...' : (hasDraw ? 'הגרל סדר אקראי מחדש' : 'הגרל סדר אקראי')}
                </Text>
                {!isShuffling && (
                  <NavigationIcon name="dice" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                )}
              </View>
            </TouchableOpacity>

            {/* Results or Placeholder */}
            {!hasDraw ? (
              <View style={styles.drawPlaceholder}>
                <NavigationIcon name="list-sharp" size={72} color="#F97316" />
                <Text style={styles.drawPlaceholderText}>טרם נקבע סדר אקראי</Text>
                <Text style={styles.drawPlaceholderSub}>
                  לחץ על הכפתור למעלה כדי להגריל רשימת סדר אקראי כרונולוגי לכל המשתתפים.
                </Text>
              </View>
            ) : (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsSubtitle}>סדר המשתתפים שנקבע 📋</Text>
                
                {orderedParticipants.map((p, index) => {
                  const name = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
                  return (
                    <View key={p.id} style={styles.participantRowCard}>
                      <View style={styles.indexContainer}>
                        <Text style={styles.indexText}>{index + 1}.</Text>
                      </View>
                      <View style={styles.infoContainer}>
                        <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
                      </View>
                      <NavigationIcon name="arrow-back-outline" size={16} color="#94A3B8" />
                    </View>
                  );
                })}

                {/* WhatsApp Share Button */}
                <TouchableOpacity
                  style={styles.shareWhatsAppButton}
                  onPress={handleShareWhatsApp}
                  activeOpacity={0.8}
                >
                  <NavigationIcon name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  <Text style={styles.shareWhatsAppButtonText}>שילוח קבוצה לוואטסאפ 📝</Text>
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
              <Text style={styles.helpModalTitle}>סדר אקראי 🎲</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                מערבב רשימת שמות או משימות ויוצר סדר כרונולוגי אקראי לחלוטין ברגע אחד.
              </Text>
              
              <Text style={[styles.helpModalSectionTitle, { marginTop: 16 }]}>דוגמה:</Text>
              <Text style={styles.helpModalText}>
                קביעת סדר שמירות ותורנויות, קביעת סדר הפרזנטציות של סטודנטים, או החלטה הוגנת מי מציג ראשון בישיבה.
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
  actionButton: {
    height: 52,
    backgroundColor: '#F97316', // Vibrant Orange matching our dashboard tile
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 24,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabledOpacity: {
    opacity: 0.65,
  },
  resultsContainer: {
    width: '100%',
  },
  resultsSubtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 16,
  },
  participantRowCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  indexContainer: {
    width: 40,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFF7ED', // Very light orange
    borderWidth: 1,
    borderColor: '#FED7AA', // Orange border tint
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  indexText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F97316',
  },
  infoContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  drawPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 40,
  },
  drawPlaceholderText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 20,
    textAlign: 'center',
  },
  drawPlaceholderSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    paddingHorizontal: 20,
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
    backgroundColor: '#FFF7ED', // Very light orange/peach to match the theme!
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FED7AA', // Orange border tint
    paddingHorizontal: 16,
    marginBottom: 20,
    width: '100%',
  },
  attendanceButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F97316', // Orange theme text!
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
    backgroundColor: '#F97316',
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

export default RandomOrderScreen;
