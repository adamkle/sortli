import React, { useState, useMemo } from 'react';
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

interface GiftExchangeScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateGifts: (shuffledSequence: string[]) => Promise<void>;
  userTier: UserTier;
}

const GiftExchangeScreen: React.FC<GiftExchangeScreenProps> = ({
  activeList,
  onBack,
  onUpdateGifts,
  userTier,
}) => {
  const [giftCountK, setGiftCountK] = useState<number>(1);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [activeGiverId, setActiveGiverId] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isMasterRevealed, setIsMasterRevealed] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(5);

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

  const giftExchangeState = activeList.giftExchangeState;
  const shuffledSequence = giftExchangeState?.shuffledSequence || [];
  const hasDraw = shuffledSequence.length > 0;

  // Bound giftCountK between 1 and N-1
  const maxK = Math.max(1, N - 1);
  const currentK = Math.min(giftCountK, maxK);

  const handleIncrement = () => {
    setGiftCountK(prev => (prev < maxK ? prev + 1 : maxK));
  };

  const handleDecrement = () => {
    setGiftCountK(prev => (prev > 1 ? prev - 1 : 1));
  };

  const handleShuffle = async () => {
    if (N < 2) return;
    setIsShuffling(true);
    try {
      const ids = participants.map(p => p.id);
      const shuffledIds = shuffle(ids);
      setActiveGiverId(null); // Reset reveal state
      setIsMasterRevealed(false); // Reset master reveal
      await onUpdateGifts(shuffledIds);
    } catch (err) {
      console.error(err);
    } finally {
      setIsShuffling(false);
    }
  };

  const participantsMap = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  // Map base shuffledIds array to K distinct cyclic gift assignments
  const assignments = useMemo(() => {
    if (!hasDraw || N < 2) return new Map<string, string[]>();

    const targetsMap = new Map<string, string[]>();
    shuffledSequence.forEach((id, i) => {
      const targets: string[] = [];
      for (let step = 1; step <= currentK; step++) {
        const targetId = shuffledSequence[(i + step) % N];
        targets.push(targetId);
      }
      targetsMap.set(id, targets);
    });

    return targetsMap;
  }, [hasDraw, shuffledSequence, N, currentK]);

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
      let message = `🎁 *סבב חלוקת המתנות ההוגן של Sortli 🎯*\n📊 *כל אחד נותן ומקבל ${currentK} מתנות באופן שוויוני:*\n\n`;
      participants.forEach(p => {
        const giverName = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
        const targetIds = assignments.get(p.id) || [];
        const receiverNames = targetIds.map(tid => {
          const target = participantsMap.get(tid);
          return target ? `${target.firstName}${target.nickname ? ` (${target.nickname})` : ''}` : '';
        }).filter(name => name.length > 0);
        
        if (receiverNames.length > 0) {
          message += `• ${giverName} מביא ל: ${receiverNames.join(', ')}\n`;
        }
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
          חילופי מתנות: {activeList.name}
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
            <NavigationIcon name="swap-horizontal" size={64} color="#64748B" />
            <Text style={styles.errorText}>אין מספיק משתתפים</Text>
            <Text style={styles.errorSubtext}>
              יש להוסיף לפחות 2 משתתפים ברשימה (במסך ניהול רשימה) על מנת לבצע חלוקה וקבלה הדדית.
            </Text>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            
            {/* Control Panel */}
            <View style={styles.controlCard}>
              <Text style={styles.stepperLabel}>כמות מתנות לכל משתתף (K):</Text>
              
              <View style={styles.stepperActionRow}>
                <TouchableOpacity 
                  onPress={handleIncrement} 
                  style={[styles.stepperButton, currentK >= maxK && styles.disabledButton]}
                  disabled={currentK >= maxK}
                >
                  <NavigationIcon name="add" size={24} color={currentK >= maxK ? "#94A3B8" : "#6366F1"} />
                </TouchableOpacity>
                <View style={styles.stepperValueContainer}>
                  <Text style={styles.stepperValueText}>{currentK}</Text>
                </View>
                <TouchableOpacity 
                  onPress={handleDecrement} 
                  style={[styles.stepperButton, currentK <= 1 && styles.disabledButton]}
                  disabled={currentK <= 1}
                >
                  <NavigationIcon name="remove" size={24} color={currentK <= 1 ? "#94A3B8" : "#6366F1"} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.stepperRangeHelp}>
                טווח מותר: 1 עד {maxK} מתנות
              </Text>
            </View>

            {/* Shuffle/Generate Action Button */}
            <TouchableOpacity
              style={[styles.actionButton, isShuffling && styles.disabledOpacity]}
              onPress={handleShuffle}
              disabled={isShuffling}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>
                {isShuffling ? 'מגריל מחדש...' : 'הגרל משלוחי מנות 🎁'}
              </Text>
            </TouchableOpacity>

            {/* Master Reveal Toggle Button */}
            {hasDraw && (
              <TouchableOpacity
                style={[styles.masterRevealButton, isMasterRevealed && styles.masterRevealButtonActive]}
                onPress={() => setIsMasterRevealed(prev => !prev)}
                activeOpacity={0.8}
              >
                <Text style={[styles.masterRevealButtonText, isMasterRevealed && styles.masterRevealButtonTextActive]}>
                  {isMasterRevealed ? "🔒 הסתר את כל הרשימה" : "👁️ חשוף את כל הרשימה"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Participants assignment list */}
            {!hasDraw ? (
              <View style={styles.drawPlaceholder}>
                <NavigationIcon name="gift-outline" size={72} color="#6366F1" />
                <Text style={styles.drawPlaceholderText}>טרם בוצעה הגרלת מתנות</Text>
                <Text style={styles.drawPlaceholderSub}>
                  לחץ על הכפתור למעלה כדי להגריל משלוחי מתנות לכל המשתתפים.
                </Text>
              </View>
            ) : (
              <View style={styles.resultsContainer}>
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

                {!isMasterRevealed && (
                  <Text style={styles.resultsSubtitle}>
                    לחץ והחזק על שורה להצגת הנמענים 🤫
                  </Text>
                )}
                
                {participants.map(p => {
                  const giverName = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
                  const targetIds = assignments.get(p.id) || [];
                  
                  const receiverNames = targetIds.map(tid => {
                    const target = participantsMap.get(tid);
                    return target ? `${target.firstName}${target.nickname ? ` (${target.nickname})` : ''}` : '';
                  });

                  const isRevealed = activeGiverId === p.id || isMasterRevealed;

                  return (
                    <View 
                      key={p.id} 
                      style={isMasterRevealed ? styles.giverRowCardTable : styles.giverRowCard}
                    >
                      <View style={styles.giverInfo}>
                        <Text style={styles.giverTitle}>נותן 👤</Text>
                        <Text style={styles.giverName} numberOfLines={1}>{giverName}</Text>
                      </View>

                      <View style={styles.dividerArrow}>
                        <NavigationIcon name="arrow-back" size={16} color="#94A3B8" />
                      </View>

                      <TouchableOpacity
                        style={styles.receiverInteractionArea}
                        onPressIn={() => setActiveGiverId(p.id)}
                        onPressOut={() => setActiveGiverId(null)}
                        activeOpacity={isMasterRevealed ? 1 : 0.8}
                        disabled={isMasterRevealed}
                      >
                        <View style={isMasterRevealed ? styles.assignmentBoxTable : styles.assignmentBox}>
                          {isRevealed ? (
                            <View style={styles.revealedContainer}>
                              {receiverNames.map((name, idx) => (
                                <View key={idx} style={isMasterRevealed ? styles.receiverBadgeTable : styles.receiverBadge}>
                                  <Text style={styles.receiverText} numberOfLines={1}>
                                    {idx + 1}. {name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <View style={styles.hiddenContainer}>
                              <View style={styles.giftBadgeRow}>
                                {Array.from({ length: currentK }).map((_, idx) => (
                                  <View key={idx} style={styles.giftBadge}>
                                    <NavigationIcon name="gift" size={14} color="#FFFFFF" />
                                  </View>
                                ))}
                              </View>
                              <Text style={styles.holdInstruction}>החזק לחשיפה 👁️</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
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
              <Text style={styles.helpModalTitle}>חלוקה וקבלה הדדית 🎁</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                מנגנון מתקדם המבטיח החלפה מאוזנת ואטומה. כל משתתף מכין או נותן מספר פריטים מוגדר (למשל 3), ומובטח שיקבל את אותו מספר מאנשים שונים ברשימה. אף אחד לא מקבל מעצמו והסבב סגור והוגן לחלוטין.
              </Text>
              
              <Text style={[styles.helpModalSectionTitle, { marginTop: 16 }]}>דוגמה:</Text>
              <Text style={styles.helpModalText}>
                מושלם לארגון משלוחי מנות בפורים, חילופי ספרי קריאה, או חלוקת מתנות סוף שנה.
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
  controlCard: {
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
  disabledButton: {
    backgroundColor: '#F1F5F9',
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
  stepperRangeHelp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 12,
  },
  actionButton: {
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
    textAlign: 'center',
    marginBottom: 16,
  },
  giverRowCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  giverInfo: {
    width: '32%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giverTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  giverName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  dividerArrow: {
    width: '8%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiverInteractionArea: {
    width: '58%',
  },
  assignmentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    padding: 8,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBadgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    marginVertical: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  holdInstruction: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
    marginTop: 4,
  },
  revealedContainer: {
    width: '100%',
    alignItems: 'stretch',
  },
  receiverBadge: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 2,
    width: '100%',
  },
  receiverText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
    textAlign: 'right',
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
  drawPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 20,
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
  masterRevealButton: {
    height: 48,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    marginBottom: 16,
  },
  masterRevealButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  masterRevealButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  masterRevealButtonTextActive: {
    color: '#FFFFFF',
  },
  giverRowCardTable: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  assignmentBoxTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 4,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiverBadgeTable: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 0.5,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginVertical: 1,
    width: '100%',
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

export default GiftExchangeScreen;
