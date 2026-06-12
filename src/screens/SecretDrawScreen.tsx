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

interface SecretDrawScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateSecretDraw: (shuffledSequence: string[]) => Promise<void>;
  userTier: UserTier;
}

interface PairItem {
  giver: Participant;
  receiver: Participant;
}

const SecretDrawScreen: React.FC<SecretDrawScreenProps> = ({
  activeList,
  onBack,
  onUpdateSecretDraw,
  userTier,
}) => {
  const [activeRevealedGiverId, setActiveRevealedGiverId] = useState<string | null>(null);
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
  const secretDrawState = activeList.secretDrawState;
  const hasDraw = secretDrawState && secretDrawState.shuffledSequence && secretDrawState.shuffledSequence.length > 0;

  const handleDraw = async () => {
    if (N < 2) {
      Alert.alert("שגיאה", "יש להוסיף לפחות 2 משתתפים ברשימה על מנת לבצע הגרלה סודית.");
      return;
    }

    const ids = participants.map(p => p.id);
    const shuffled = shuffle(ids);
    setActiveRevealedGiverId(null); // Secure reset on new draw
    await onUpdateSecretDraw(shuffled);
  };

  const participantsMap = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  // Derive stable shuffled assignment pairs for display
  const shuffledPairs = useMemo<PairItem[]>(() => {
    if (!hasDraw || !secretDrawState?.shuffledSequence) return [];
    
    const seq = secretDrawState.shuffledSequence;
    const seqLength = seq.length;
    const pairs: PairItem[] = [];

    for (let i = 0; i < seqLength; i++) {
      const giverId = seq[i];
      const receiverId = seq[(i + 1) % seqLength];
      const giver = participantsMap.get(giverId);
      const receiver = participantsMap.get(receiverId);
      if (giver && receiver) {
        pairs.push({ giver, receiver });
      }
    }
    
    // Shuffling the array of pair objects randomly to break the chain visual flow
    return shuffle(pairs);
  }, [secretDrawState?.shuffledSequence, participantsMap, hasDraw]);

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
      let message = `🤫 *שרשרת ההגרלה הסודית שלנו (Sortli) 🎯*:\n\n`;
      shuffledPairs.forEach(pair => {
        const giverName = `${pair.giver.firstName}${pair.giver.lastName ? ' ' + pair.giver.lastName : ''}${pair.giver.nickname ? ` (${pair.giver.nickname})` : ''}`;
        const receiverName = `${pair.receiver.firstName}${pair.receiver.lastName ? ' ' + pair.receiver.lastName : ''}${pair.receiver.nickname ? ` (${pair.receiver.nickname})` : ''}`;
        message += `• ${giverName} ⬅️ ${receiverName}\n`;
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
          הגרלה סודית: {activeList.name}
        </Text>
        <TouchableOpacity onPress={() => setIsHelpModalOpen(true)} style={styles.backButton}>
          <NavigationIcon name="help-circle-outline" size={26} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.contentContainer}>
        {N < 2 ? (
          <View style={styles.errorContainer}>
            <NavigationIcon name="people-outline" size={64} color="#64748B" />
            <Text style={styles.errorText}>אין מספיק משתתפים</Text>
            <Text style={styles.errorSubtext}>
              יש להוסיף לפחות 2 משתתפים ברשימה (במסך ניהול רשימה) על מנת לבצע הגרלה סודית.
            </Text>
          </View>
        ) : !hasDraw ? (
          <View style={styles.drawPlaceholder}>
            <NavigationIcon name="help-circle-outline" size={80} color="#6366F1" />
            <Text style={styles.drawPlaceholderText}>טרם בוצעה הגרלה לרשימה זו</Text>
            <Text style={styles.drawPlaceholderSub}>
              לחץ על הכפתור למטה על מנת לבצע שרשרת הגרלה סודית וסגורה (גמד וענק, משחק הרוצח וכד') בין כל המשתתפים.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.drawScrollView}
            contentContainerStyle={styles.drawContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>שרשרת ההקצאות הסודית 🔗</Text>
            
            {shuffledPairs.map((pair, index) => {
              const giverName = `${pair.giver.firstName}${pair.giver.lastName ? ' ' + pair.giver.lastName : ''}${pair.giver.nickname ? ` (${pair.giver.nickname})` : ''}`;
              const receiverName = `${pair.receiver.firstName}${pair.receiver.lastName ? ' ' + pair.receiver.lastName : ''}${pair.receiver.nickname ? ` (${pair.receiver.nickname})` : ''}`;
              const isRevealed = activeRevealedGiverId === pair.giver.id;

              return (
                <View key={pair.giver.id} style={styles.pairCard}>
                  <View style={styles.roleContainer}>
                    <Text style={styles.roleTitle}>משתתף 👤</Text>
                    <Text style={styles.roleName} numberOfLines={1}>{giverName}</Text>
                  </View>

                  <View style={styles.arrowContainer}>
                    <NavigationIcon name="link-outline" size={20} color="#6366F1" />
                    <NavigationIcon name="arrow-back" size={14} color="#94A3B8" style={{ marginTop: 2 }} />
                  </View>

                  <View style={styles.roleContainer}>
                    <Text style={styles.roleTitle}>יעד סודי 🎯</Text>
                    {isRevealed ? (
                      <Text style={styles.roleName} numberOfLines={1}>{receiverName}</Text>
                    ) : (
                      <Text style={styles.hiddenText}>סודי ביותר 🤫</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPressIn={() => setActiveRevealedGiverId(pair.giver.id)}
                    onPressOut={() => setActiveRevealedGiverId(null)}
                    activeOpacity={0.7}
                  >
                    <NavigationIcon
                      name={isRevealed ? "eye-outline" : "eye-off-outline"}
                      size={22}
                      color={isRevealed ? "#6366F1" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

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

        {/* Footer Action Button */}
        {N >= 2 && (
          <View style={styles.footer}>
            {hasDraw && (
              <TouchableOpacity
                style={styles.shareWhatsAppButton}
                onPress={handleShareWhatsApp}
                activeOpacity={0.8}
              >
                <NavigationIcon name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                <Text style={styles.shareWhatsAppButtonText}>שליחת רשימה לוואטסאפ 📝</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.drawButton}
              onPress={handleDraw}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.drawButtonText}>
                  {hasDraw ? 'הגרל מחדש' : 'בצע הגרלה סודית'}
                </Text>
                <NavigationIcon name="dice" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
              <Text style={styles.helpModalTitle}>הגרלה סודית (ענק וגמד) 🤫</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                הגרלה עיוורת שבה כל משתתף מוגרל באופן אקראי לתת משהו למשתתף אחר, מבלי שאף אחד יודע מי קיבל את מי! המערכת שולחת את התוצאות בצורה חסויה.
              </Text>
              
              <Text style={[styles.helpModalSectionTitle, { marginTop: 16 }]}>דוגמה:</Text>
              <Text style={styles.helpModalText}>
                משחק "גמד וענק" מסורתי בפורים, או חלוקת מתנות סודית בין חברים לחג.
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
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  drawScrollView: {
    flex: 1,
  },
  drawContent: {
    paddingBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
    marginBottom: 16,
  },
  pairCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  roleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  hiddenText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
  },
  arrowContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  footer: {
    paddingVertical: 12,
    backgroundColor: '#FAF9FF',
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
  drawPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  shareWhatsAppButton: {
    height: 48,
    backgroundColor: '#25D366', // WhatsApp Green
    borderRadius: 16,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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

export default SecretDrawScreen;
