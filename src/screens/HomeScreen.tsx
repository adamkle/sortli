import React, { useState, useMemo, useEffect } from 'react';
import {
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationIcon from '../components/NavigationIcon';
import BottomAdBanner from '../components/BottomAdBanner';

import { UserTier, SharedList } from '../types';
export type { UserTier };

interface MenuItem {
  key: string;
  title: string;
  subtitle?: string;
  iconName: string;
  backgroundColor: string;
  lockedFor: UserTier[];
}

interface HomeScreenProps {
  userTier: UserTier;
  setUserTier: (tier: UserTier) => void;
  onNavigateToLists: () => void;
  onNavigateToAuth: () => void;
  onLogout: () => void;
  onOpenMenu: () => void;
  userProfile: any;
  activeList: SharedList | null;
  activeProfileType: 'private' | 'institutional';
  onNavigateToActiveQueue: () => void;
  onNavigateToSecretDraw: () => void;
  onNavigateToRandomChooser: () => void;
  onNavigateToGroups: () => void;
  onNavigateToGroupAllocation: () => void;
  onNavigateToGifts: () => void;
  onNavigateToRandomOrder: () => void;
  onNavigateToSplitExpenses: () => void;
  onNavigateToTaskAllocation: () => void;
  absentParticipantIds: string[];
  setAbsentParticipantIds: (ids: string[]) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  userTier,
  setUserTier,
  onNavigateToLists,
  onNavigateToAuth,
  onLogout,
  onOpenMenu,
  userProfile,
  activeList,
  activeProfileType,
  onNavigateToActiveQueue,
  onNavigateToSecretDraw,
  onNavigateToRandomChooser,
  onNavigateToGroups,
  onNavigateToGroupAllocation,
  onNavigateToGifts,
  onNavigateToRandomOrder,
  onNavigateToSplitExpenses,
  onNavigateToTaskAllocation,
  absentParticipantIds,
  setAbsentParticipantIds,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (userProfile && userProfile.uid && userTier !== 'guest') {
        try {
          const value = await AsyncStorage.getItem(`hasSeenOnboarding_${userProfile.uid}`);
          if (value !== 'true') {
            setShowWelcomeModal(true);
          }
        } catch (e) {
          console.error('Failed to read hasSeenOnboarding flag', e);
        }
      }
    };
    checkOnboarding();
  }, [userProfile, userTier]);

  const handleDismissWelcomeModal = async (navigateToCreateList: boolean) => {
    setShowWelcomeModal(false);
    if (userProfile && userProfile.uid) {
      try {
        await AsyncStorage.setItem(`hasSeenOnboarding_${userProfile.uid}`, 'true');
      } catch (e) {
        console.error('Failed to save hasSeenOnboarding flag', e);
      }
    }
    if (navigateToCreateList) {
      onNavigateToLists();
    }
  };

  const participants = useMemo(() => activeList?.participants || [], [activeList]);
  const N = participants.length;

  const presentParticipants = useMemo(() => {
    return participants.filter(p => !absentParticipantIds.includes(p.id));
  }, [participants, absentParticipantIds]);

  const presentN = presentParticipants.length;

  // התיקון המדויק: החזרת האייקון הייחודי והנכון לכל כפתור ברשת
  const menuItems: MenuItem[] = [
    {
      key: 'fairTurn',
      title: 'תור הוגן',
      iconName: 'repeat', // חצים מחזוריים לתור הוגן
      backgroundColor: '#EF4444', // Red
      lockedFor: [],
    },
    {
      key: 'randomChooser',
      title: 'הגרלה',
      iconName: 'slot-machine-outline', // מכונת מזל להגרלת תורן
      backgroundColor: '#06B6D4', // Teal/Cyan
      lockedFor: [],
    },
    {
      key: 'secretDraw',
      title: 'הגרלה סודית',
      subtitle: '(גמד וענק, משחק הרוצח)',
      iconName: 'eye-off-outline', // עין מוסתרת (גלישה בסתר/דיסקרטיות) להגרלה סודית
      backgroundColor: '#4F46E5', // Indigo
      lockedFor: [],
    },
    {
      key: 'groupSplit',
      title: 'חלוקה לקבוצות',
      subtitle: '(צוותי עבודה, משחקים או שולחנות)',
      iconName: 'grid', // גריד/ריבועים שמייצגים קבוצות
      backgroundColor: '#10B981', // Green
      lockedFor: ['guest'],
    },
    {
      key: 'groupAllocation',
      title: 'חלוקה לפי מובילים',
      subtitle: '(שיוך שווה של חברים לראשי קבוצה)',
      iconName: 'creation',
      backgroundColor: '#EAB308', // Yellow
      lockedFor: ['guest'],
    },
    {
      key: 'gifts',
      title: 'חלוקה וקבלה הדדית',
      subtitle: '(משלוחי מנות)',
      iconName: 'sync-outline', // חצים עגולים בסירקולציה להחלפה הדדית
      backgroundColor: '#3B82F6', // Blue
      lockedFor: ['guest'],
    },
    {
      key: 'splitExpenses',
      title: 'תשלום שווה',
      subtitle: '(חישוב מי משלם למי וכמה)',
      iconName: 'wallet', // אייקון של ארנק
      backgroundColor: '#8B5CF6', // Purple
      lockedFor: [],
    },
    {
      key: 'randomOrder',
      title: 'סדר אקראי',
      subtitle: '(שיבוץ משימות, תורנות קבועה)',
      iconName: 'list-sharp', // רשימה מסודרת
      backgroundColor: '#F97316', // Orange
      lockedFor: [],
    },
    {
      key: 'taskAllocation',
      title: 'חלוקת משימות',
      subtitle: '(שיבוץ משימות שוויוני ומאוזן)',
      iconName: 'calculator-outline', // אייקון מחשבון לחלוקה
      backgroundColor: '#6366F1', // Indigo
      lockedFor: [],
    },
  ];

  const handleTilePress = (item: MenuItem) => {
    const isLocked = item.lockedFor.includes(userTier);

    if (isLocked) {
      Alert.alert('', 'אפשרות זו פתוחה למשתמשים רשומים בלבד', [{ text: 'אישור' }]);
      return;
    }

    if (item.key === 'fairTurn') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToActiveQueue();
    } else if (item.key === 'secretDraw') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToSecretDraw();
    } else if (item.key === 'randomChooser') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToRandomChooser();
    } else if (item.key === 'groupSplit') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToGroups();
    } else if (item.key === 'groupAllocation') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToGroupAllocation();
    } else if (item.key === 'gifts') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToGifts();
    } else if (item.key === 'randomOrder') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToRandomOrder();
    } else if (item.key === 'splitExpenses') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToSplitExpenses();
    } else if (item.key === 'taskAllocation') {
      if (!activeList) {
         Alert.alert('רשימה לא נבחרה', 'אנא בחר רשימה פעילה מהתפריט הצדי תחילה.', [{ text: 'אישור' }]);
        return;
      }
      onNavigateToTaskAllocation();
    } else {
      onNavigateToLists();
    }
  };

  const getTierLabel = (tier: UserTier) => {
    switch (tier) {
      case 'guest':
        return 'אורח';
      case 'registered':
        return 'רשום';
      case 'lite':
        return 'לייט (ללא פרסומות)';
      case 'gold':
        return 'גולד (פרימיום)';
    }
  };

  const isPremiumActive = (() => {
    if (!userProfile || !userProfile.premiumExpiryDate) return false;
    const expiryVal = userProfile.premiumExpiryDate;
    const expiryDate = (expiryVal && typeof expiryVal.toDate === 'function')
      ? expiryVal.toDate()
      : new Date(expiryVal);
    return new Date() < expiryDate;
  })();

  const showAds = activeProfileType === 'private' && (userTier === 'guest' || userTier === 'registered') && !isPremiumActive;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        {/* Header Section */}
        <View style={[styles.headerWrapper, { zIndex: 999 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onOpenMenu} style={styles.menuButton}>
              <NavigationIcon name="menu" size={30} color="#1E1B4B" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Text style={styles.logoLetterS}>S</Text>
              <Text style={styles.logoLettersRest}>ortli</Text>
            </View>
            {userTier !== 'guest' ? (
              <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
                <NavigationIcon name="log-out-outline" size={28} color="#EF4444" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onNavigateToAuth} style={styles.logoutButton}>
                <NavigationIcon name="log-in" size={28} color="#4F46E5" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContentContainer}>

          {userTier === 'guest' && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ הרשימה לא תישמר ביציאה מהאפליקציה, לשמירה יש להירשם
              </Text>
              <TouchableOpacity onPress={onNavigateToAuth} style={styles.warningLink}>
                <Text style={styles.warningLinkText}>להרשמה / התחברות לחץ כאן</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Dashboard Greeting Section */}
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingText}>
              שלום {userProfile?.firstName || (userTier === 'guest' ? 'אורח' : 'משתמש')}, מה ברצונך לעשות?
            </Text>
            <View style={styles.activeListRow}>
              <Text style={styles.activeListText}>
                רשימה פעילה: {activeList ? activeList.name : 'אין'}
              </Text>
              {activeList && (
                <TouchableOpacity
                  style={styles.attendanceShortcut}
                  onPress={() => setIsModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <NavigationIcon name="people-sharp" size={18} color="#6366F1" style={{ marginLeft: 6 }} />
                  <Text style={styles.attendanceShortcutText}>
                    ({presentN}/{N})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

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
                            color={isPresent ? "#6366F1" : "#94A3B8"}
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
          </View>

          {/* Dashboard Grid (Exactly 6 tiles, 2 columns) */}
          <View style={styles.gridContainer}>
            {menuItems.map((item) => {
              const isLocked = item.lockedFor.includes(userTier);
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.8}
                  style={[
                    styles.tile,
                    { backgroundColor: item.backgroundColor },
                  ]}
                  onPress={() => handleTilePress(item)}
                >
                  <View style={styles.tileContent}>
                    <NavigationIcon name={item.iconName as any} size={36} color="#FFFFFF" style={styles.tileIcon} />
                    <Text style={styles.tileTitle}>{item.title}</Text>
                    {item.subtitle && <Text style={styles.tileSubtitle}>{item.subtitle}</Text>}
                  </View>

                  {isLocked && (
                    <View style={styles.lockBadge}>
                      <NavigationIcon name="lock-closed" size={14} color="#EF4444" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        </ScrollView>
        {showAds && <BottomAdBanner />}
      </View>

      {/* Welcome Onboarding Modal */}
      <Modal
        visible={showWelcomeModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => handleDismissWelcomeModal(false)}
      >
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeCard}>
            {/* Elegant Top Close button */}
            <TouchableOpacity 
              style={styles.welcomeCloseButton} 
              onPress={() => handleDismissWelcomeModal(false)}
              activeOpacity={0.7}
            >
              <NavigationIcon name="close" size={22} color="#64748B" />
            </TouchableOpacity>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.welcomeScrollContent}
            >
              {/* Header */}
              <Text style={styles.welcomeTitle}>ברוך הבא ל-Sortli! 🎉</Text>
              <Text style={styles.welcomeSubtitle}>המקום שבו הרשימות שלך הופכות לסדר מופתי.</Text>

              {/* YouTube Video Placeholder (16:9) */}
              <View style={styles.videoPlaceholder}>
                <View style={styles.videoPlayCircle}>
                  <NavigationIcon name="play" size={20} color="#FFFFFF" style={{ marginRight: -2 }} />
                </View>
                <Text style={styles.videoPlaceholderText}>[כאן ישולב סרטון הסבר קצר]</Text>
              </View>

              {/* Onboarding Steps */}
              <Text style={styles.stepsSectionTitle}>מה עושים עכשיו?</Text>
              
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <View style={styles.stepTextContainer}>
                  <Text style={styles.stepTitle}>יוצרים רשימה</Text>
                  <Text style={styles.stepDesc}>נותנים שם לרשימה החדשה שלך.</Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <View style={styles.stepTextContainer}>
                  <Text style={styles.stepTitle}>ממלאים את הרשימה בשמות</Text>
                  <Text style={styles.stepDesc}>מכניסים את כל החברים, המשימות או הפריטים.</Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <View style={styles.stepTextContainer}>
                  <Text style={styles.stepTitle}>ויאללה מתחילים לעבוד על הרשימה!</Text>
                  <Text style={styles.stepDesc}>ממיינים, מסדרים או מפעילים את מנגנון ההגרלה החכם שלנו.</Text>
                </View>
              </View>

              {/* Free Tier Info inner Card */}
              <View style={styles.freeTierCard}>
                <Text style={styles.freeTierHeader}>🎁 מה מחכה לך בחשבון החינמי?</Text>
                <Text style={styles.freeTierLine}>• 2 רשימות מלאות לשימוש במקביל.</Text>
                <Text style={styles.freeTierLine}>• שמירה מאובטחת בענן למשך 30 ימים.</Text>
                <Text style={styles.freeTierFooter}>
                  רוצה יותר? 💖 צבור לבבות באפליקציה כדי לפתוח רשימות נוספות ואפשרויות מתקדמות לחלוטין בחינם!
                </Text>
              </View>
            </ScrollView>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.welcomeCTAButton}
              onPress={() => handleDismissWelcomeModal(true)}
              activeOpacity={0.9}
            >
              <Text style={styles.welcomeCTAButtonText}>קדימה, בוא ניצור את הרשימה הראשונה! 🚀</Text>
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
    paddingBottom: 40,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  mainContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetterS: {
    fontSize: 38,
    fontWeight: '900',
    color: '#4F46E5',
  },
  logoLettersRest: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 6,
    letterSpacing: 4,
  },
  menuButton: {
    padding: 4,
  },
  logoutButton: {
    padding: 4,
  },
  greetingContainer: {
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
    lineHeight: 30,
  },
  gridContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tile: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    height: 145,
    width: '47.5%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
  },
  tileContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIcon: {
    marginBottom: 8,
  },
  tileTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  tileSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  lockBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  adBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 10,
  },
  adIcon: {
    marginLeft: 10,
  },
  adText: {
    flex: 1,
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  adRemoveButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  adRemoveText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  activeListText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
    textAlign: 'right',
  },
  activeListRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 8,
  },
  attendanceShortcut: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  attendanceShortcutText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366F1',
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
    backgroundColor: '#6366F1',
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
  warningBanner: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  warningLink: {
    marginTop: 4,
  },
  warningLinkText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  welcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    padding: 22,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeCloseButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 10,
    padding: 6,
  },
  welcomeScrollContent: {
    paddingTop: 10,
    paddingBottom: 16,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 1.777,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  videoPlayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  videoPlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  stepsSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    alignSelf: 'stretch',
    textAlign: 'right',
    marginBottom: 12,
    marginTop: 4,
  },
  stepItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 2,
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  stepTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'right',
  },
  stepDesc: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 16,
  },
  freeTierCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 10,
  },
  freeTierHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#7E22CE',
    textAlign: 'right',
    marginBottom: 8,
  },
  freeTierLine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#581C87',
    textAlign: 'right',
    marginBottom: 4,
  },
  freeTierFooter: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B21A8',
    textAlign: 'right',
    marginTop: 8,
    lineHeight: 18,
  },
  welcomeCTAButton: {
    height: 50,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeCTAButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default HomeScreen;