import React, { useState, useMemo } from 'react';
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
  onNavigateToGifts: () => void;
  onNavigateToRandomOrder: () => void;
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
  onNavigateToGifts,
  onNavigateToRandomOrder,
  absentParticipantIds,
  setAbsentParticipantIds,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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
      title: 'הגרלת תורן',
      subtitle: '(בחירה רנדומלית ללא חזרות)',
      iconName: 'shuffle', // חצי קרוס של ערבוב/הגרלה רנדומלית
      backgroundColor: '#06B6D4', // Teal/Cyan
      lockedFor: [],
    },
    {
      key: 'secretDraw',
      title: 'הגרלה סודית',
      subtitle: '(גמד וענק, משחק הרוצח)',
      iconName: 'people-circle', // קבוצת אנשים להגרלה חברתית
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
      key: 'gifts',
      title: 'חלוקה וקבלה הדדית',
      subtitle: '(משלוחי מנות)',
      iconName: 'swap-horizontal', // חצים אופקיים להחלפה הדדית
      backgroundColor: '#3B82F6', // Blue
      lockedFor: ['guest'],
    },
    {
      key: 'randomOrder',
      title: 'סדר אקראי',
      subtitle: '(שיבוץ משימות, תורנות קבועה)',
      iconName: 'list-sharp', // רשימה מסודרת
      backgroundColor: '#F97316', // Orange
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

  const showAds = activeProfileType === 'private' && (userTier === 'guest' || userTier === 'registered');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
        >
          {/* Header Section */}
          <View style={styles.headerWrapper}>
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
                <View style={{ width: 30 }} />
              )}
            </View>
          </View>

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
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  mainContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    marginBottom: 25,
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
    marginBottom: 16,
    height: 135,
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
});

export default HomeScreen;