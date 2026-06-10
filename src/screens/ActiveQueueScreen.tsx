import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { SharedList } from '../types';

interface ActiveQueueScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onAdvanceQueue: () => Promise<void>;
}

const ActiveQueueScreen: React.FC<ActiveQueueScreenProps> = ({
  activeList,
  onBack,
  onAdvanceQueue,
}) => {
  const [viewingRoundOffset, setViewingRoundOffset] = useState(0);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Reset offset if activeList changes
  useEffect(() => {
    setViewingRoundOffset(0);
  }, [activeList?.id]);

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

  const N = activeList.queueState?.participantsCount || activeList.participants.length;

  if (N === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <NavigationIcon name="arrow-forward" size={26} color="#1E1B4B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            תור פעיל: {activeList.name}
          </Text>
          <TouchableOpacity onPress={() => setIsHelpModalOpen(true)} style={styles.backButton}>
            <NavigationIcon name="help-circle-outline" size={26} color="#6366F1" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <NavigationIcon name="people-outline" size={64} color="#64748B" />
          <Text style={styles.errorText}>אין משתתפים ברשימה זו</Text>
          <Text style={styles.errorSubtext}>
            אנא הוסף משתתפים דרך מסך ניהול הרשימות כדי להשתמש בתור הפעיל.
          </Text>
          <TouchableOpacity style={styles.backButtonInline} onPress={onBack}>
            <Text style={styles.backButtonInlineText}>חזרה</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentGlobalIndex = activeList.queueState?.currentGlobalIndex || 0;
  const targetIndex = currentGlobalIndex + (viewingRoundOffset * N);
  const previewRoundIndex = Math.floor(targetIndex / N);

  const matrixSequence = (activeList.queueState?.matrixSequence && activeList.queueState.matrixSequence.length > 0)
    ? activeList.queueState.matrixSequence
    : activeList.participants.map(p => p.id);

  const isRightArrowDisabled = targetIndex - N < 0;
  const isLeftArrowDisabled = targetIndex + N >= matrixSequence.length;

  // Slice N elements from sequence starting at targetIndex
  const currentSlice = matrixSequence.slice(targetIndex, targetIndex + N);

  const participantsMap = new Map(activeList.participants.map(p => [p.id, p]));

  const handleAdvance = async () => {
    await onAdvanceQueue();
    setViewingRoundOffset(0);
  };

  const renderStatusBanner = () => {
    let text = "🟢 הסבב הפעיל עכשיו";
    let bg = "#ECFDF5";
    let color = "#047857";

    if (viewingRoundOffset < 0) {
      text = "👁️ צפייה בהיסטוריה של התור";
      bg = "#F1F5F9";
      color = "#475569";
    } else if (viewingRoundOffset > 0) {
      text = "🔮 הצצה לסבבים הבאים";
      bg = "#EEF2FF";
      color = "#4F46E5";
    }

    return (
      <View style={[styles.statusBanner, { backgroundColor: bg }]}>
        <Text style={[styles.statusBannerText, { color: color }]}>{text}</Text>
      </View>
    );
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
          תור פעיל: {activeList.name}
        </Text>
        <TouchableOpacity onPress={() => setIsHelpModalOpen(true)} style={styles.backButton}>
          <NavigationIcon name="help-circle-outline" size={26} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Navigation Controls */}
        <View style={styles.timelineRow}>
          {/* Left Arrow Button (Left side) -> Increments Offset (Advances) */}
          <TouchableOpacity
            style={[
              styles.navArrowButton,
              isLeftArrowDisabled && styles.navArrowButtonDisabled,
            ]}
            disabled={isLeftArrowDisabled}
            onPress={() => setViewingRoundOffset(prev => prev + 1)}
          >
            <NavigationIcon
              name="chevron-back"
              size={20}
              color={isLeftArrowDisabled ? '#CBD5E1' : '#6366F1'}
            />
          </TouchableOpacity>

          <View style={styles.roundIndicatorContainer}>
            <Text style={styles.roundIndicatorText}>
              סבב {previewRoundIndex + 1} מתוך {N}
            </Text>
            {viewingRoundOffset === 0 && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>נוכחי</Text>
              </View>
            )}
          </View>

          {/* Right Arrow Button (Right side) -> Decrements Offset (Goes Back) */}
          <TouchableOpacity
            style={[
              styles.navArrowButton,
              isRightArrowDisabled && styles.navArrowButtonDisabled,
            ]}
            disabled={isRightArrowDisabled}
            onPress={() => setViewingRoundOffset(prev => prev - 1)}
          >
            <NavigationIcon
              name="chevron-forward"
              size={20}
              color={isRightArrowDisabled ? '#CBD5E1' : '#6366F1'}
            />
          </TouchableOpacity>
        </View>

        {/* Status Banner */}
        {renderStatusBanner()}

        {/* Scrollable Lineup */}
        <ScrollView
          style={[styles.lineupScrollView, viewingRoundOffset !== 0 && { opacity: 0.55 }]}
          contentContainerStyle={styles.lineupContent}
          showsVerticalScrollIndicator={false}
        >
          {currentSlice.map((id, index) => {
            const p = participantsMap.get(id);
            const displayName = p ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : 'משתתף לא ידוע';
            const nickname = p?.nickname;
            
            // Highlight the first element of the list in the current active round
            const isFirst = index === 0;

            return (
              <View key={`${id}-${index}`} style={[styles.participantCard, isFirst && styles.participantCardFirst]}>
                <View style={styles.numberBadge}>
                  <Text style={[styles.numberBadgeText, isFirst && styles.numberBadgeTextFirst]}>
                    {index + 1}
                  </Text>
                </View>
                
                <View style={styles.detailsContainer}>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {nickname && (
                    <Text style={styles.participantNickname} numberOfLines={1}>
                      "{nickname}"
                    </Text>
                  )}
                </View>

                {p?.gender && (
                  <View
                    style={[
                      styles.genderDot,
                      { backgroundColor: p.gender === 'boy' ? '#3B82F6' : '#EC4899' },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Main Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.advanceButton}
            onPress={handleAdvance}
            activeOpacity={0.8}
          >
            <Text style={styles.advanceButtonText}>קדם לפעילות הבאה ➡️</Text>
          </TouchableOpacity>
        </View>
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
              <Text style={styles.helpModalTitle}>תור הוגן 🔄</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                ניהול תור דינמי וצודק בתוך אותה הקבוצה לאורך זמן. המערכת שומרת על הסדר המצטבר ומוודאת שאף אחד לא ירגיש שהוא תמיד נשאר אחרון!
              </Text>
              
              <Text style={[styles.helpModalSectionTitle, { marginTop: 16 }]}>דוגמה:</Text>
              <Text style={styles.helpModalText}>
                מעולה להעמדת כיתות או קבוצות לפעילויות שונות, חלוקת תפקידים קבועים, או קביעת סדר העלייה למתקן בין הילדים בבית.
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
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  navArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navArrowButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
  },
  roundIndicatorContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundIndicatorText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  currentBadge: {
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  lineupScrollView: {
    flex: 1,
  },
  lineupContent: {
    paddingBottom: 20,
  },
  participantCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  participantCardFirst: {
    borderColor: '#818CF8',
    borderWidth: 2,
    backgroundColor: '#F5F7FF',
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  numberBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  numberBadgeTextFirst: {
    color: '#4F46E5',
  },
  detailsContainer: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  participantNickname: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'right',
  },
  genderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  footer: {
    paddingVertical: 12,
    backgroundColor: '#FAF9FF',
  },
  advanceButton: {
    height: 52,
    backgroundColor: '#6366F1',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  advanceButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
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
  statusBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
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

export default ActiveQueueScreen;
