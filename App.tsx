import React, { useState, useEffect, useRef } from 'react';
import { Alert, StyleSheet, View, Text, TouchableOpacity, ScrollView, Animated, TextInput, Modal, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

// Dynamic require to prevent expo-notifications evaluation inside Expo Go (which crashes on SDK 53+)
const Notifications: any = isExpoGo
  ? {
      setNotificationHandler: () => {},
      setNotificationChannelAsync: async () => ({}),
      getPermissionsAsync: async () => ({ status: 'granted' }),
      requestPermissionsAsync: async () => ({ status: 'granted' }),
      getExpoPushTokenAsync: async () => ({ data: 'mock-token' }),
      addNotificationReceivedListener: () => ({ remove: () => {} }),
      addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
      cancelScheduledNotificationAsync: async () => {},
      scheduleNotificationAsync: async () => 'mock-id',
      AndroidImportance: { MAX: 4 },
      SchedulableTriggerInputTypes: { DATE: 'date' },
    }
  : require('expo-notifications');
import HomeScreen from './src/screens/HomeScreen';
import ListManagementScreen from './src/screens/ListManagementScreen';
import AuthScreen from './src/screens/AuthScreen';
import ActiveQueueScreen from './src/screens/ActiveQueueScreen';
import SecretDrawScreen from './src/screens/SecretDrawScreen';
import RandomChooserScreen from './src/screens/RandomChooserScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import GiftExchangeScreen from './src/screens/GiftExchangeScreen';
import RandomOrderScreen from './src/screens/RandomOrderScreen';
import { auth, db } from './src/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Participant, UserTier, SharedList } from './src/types';
import { generateFairRotationSequence } from './src/utils/queueEngine';

const DEFAULT_GUEST_PARTICIPANTS: Participant[] = [
  {
    id: '1',
    firstName: 'נועם',
    lastName: 'כהן',
    nickname: 'נומי',
    gender: 'boy',
    phone: '0501234567',
    notes: 'משתתף קבוע',
  },
  {
    id: '2',
    firstName: 'שירה',
    lastName: 'לוי',
    gender: 'girl',
    phone: '0547654321',
  },
  {
    id: '3',
    firstName: 'איתי',
    nickname: 'תותי',
  },
];

const createGuestList = (): SharedList => {
  const participantIds = DEFAULT_GUEST_PARTICIPANTS.map(p => p.id);
  const now = new Date();
  return {
    id: 'guest_list_id',
    name: 'הרשימה שלי (אורח)',
    creatorId: 'guest',
    allowedUsers: ['guest'],
    participants: DEFAULT_GUEST_PARTICIPANTS,
    queueState: {
      matrixSequence: generateFairRotationSequence(participantIds),
      participantsCount: participantIds.length,
      currentGlobalIndex: 0,
      currentRound: 1,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    isPremiumAccount: false,
  };
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'Home' | 'ListManagement' | 'Auth' | 'ActiveQueue' | 'SecretDraw' | 'RandomChooser' | 'Groups' | 'Gifts' | 'RandomOrder'>('Home');
  const [previousScreen, setPreviousScreen] = useState<'Home' | 'ListManagement' | 'ActiveQueue'>('Home');
  const [userTier, setUserTier] = useState<UserTier>('guest');
  const [isInitialSync, setIsInitialSync] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Standalone list management state
  const [lists, setLists] = useState<SharedList[]>([]);
  const [activeList, setActiveList] = useState<SharedList | null>(null);
  const [absentParticipantIds, setAbsentParticipantIds] = useState<string[]>([]);

  // Notifications initialization, permissions & channels config
  useEffect(() => {
    const initNotifications = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('Push/local notification permissions denied.');
          return;
        }

        // Only register remote push token if we are NOT running in Expo Go
        if (Constants.appOwnership !== 'expo') {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
          const tokenResult = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          console.log('Remote push token registered successfully:', tokenResult.data);
        } else {
          console.log('Running inside Expo Go. Bypassing remote push token registration to avoid runtime errors, local notifications remain active.');
        }
      } catch (err) {
        console.warn("Notifications registration failed:", err);
      }
    };

    initNotifications();

    // Foreground listener
    const notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('Foreground notification received:', notification);
      const { title, body, data } = notification.request.content;
      
      // Handle incoming remote updates or other messages cleanly
      if (data?.type === 'system_update') {
        Alert.alert(title || "עדכון מערכת", body || "ישנו עדכון מערכת חדש מהשרת.");
      }
    });

    // Interaction/response click listener
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log('Notification response received:', response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Helper to schedule list expiration notifications
  const scheduleListExpirationNotification = async (list: SharedList) => {
    try {
      if (!list.expiresAt) return;

      const notificationId = `list-expiration-${list.id}`;
      // Cancel previous schedule for this specific list to prevent duplicate fire times
      await Notifications.cancelScheduledNotificationAsync(notificationId);

      const rawExpires = list.expiresAt;
      const expiresAt = (rawExpires && typeof (rawExpires as any).toDate === 'function')
        ? (rawExpires as any).toDate()
        : (rawExpires instanceof Date ? rawExpires : new Date(rawExpires as any));

      const now = new Date();
      // Schedule alert 36 hours before expiration (which is in the 24-48h window)
      const alertTime = new Date(expiresAt.getTime() - 36 * 60 * 60 * 1000);

      if (alertTime > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content: {
            title: "תוקף הרשימה עומד לפוג! ⚠️",
            body: `התוקף של הרשימה "${list.name}" עומד לפוג! כנס להרחיב אותו ❤️`,
            data: { listId: list.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: alertTime,
          },
        });
        console.log(`Scheduled expiration alert for "${list.name}" successfully.`);
      }
    } catch (err) {
      console.warn("Failed to schedule list expiration notification:", err);
    }
  };

  // Sync list state changes to schedule expiration notifications
  useEffect(() => {
    lists.forEach((list) => {
      scheduleListExpirationNotification(list);
    });
  }, [lists]);

  // Sidebar navigation & context switcher states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeProfileType, setActiveProfileType] = useState<'private' | 'institutional'>('private');
  const [activeInstitutionCode, setActiveInstitutionCode] = useState<string | null>(null);

  // Global action modals
  const [isCreateListOpenGlobal, setIsCreateListOpenGlobal] = useState(false);
  const [newListNameGlobal, setNewListNameGlobal] = useState('');

  // Hearts & Video Ad states
  const [hearts, setHearts] = useState<number>(3);
  const [actionClicks, setActionClicks] = useState<number>(0);
  const [isAdModalOpen, setIsAdModalOpen] = useState<boolean>(false);
  const [adTimer, setAdTimer] = useState<number>(5);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState<boolean>(false);
  const [selectedSubPlan, setSelectedSubPlan] = useState<'yearly' | 'two_years' | 'lifetime'>('yearly');

  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Sidebar animated value (slides in from the right: width is 280, starts at 280)
  const sidebarAnim = useRef(new Animated.Value(280)).current;
  const newlyCreatedListIdRef = useRef<string | null>(null);

  // Sidebar slide-in animation trigger
  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isSidebarOpen ? 0 : 280,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isSidebarOpen]);

  // Auto-reset hearts to 0 on Guest userTier
  useEffect(() => {
    if (userTier === 'guest') {
      setHearts(0);
    }
  }, [userTier]);

  // Rewarded Video Ad countdown simulation
  useEffect(() => {
    let interval: any;
    if (isAdModalOpen) {
      setAdTimer(5);
      interval = setInterval(() => {
        setAdTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsAdModalOpen(false);
            if (userTier !== 'guest') {
              setHearts((h) => Math.min(5, h + 1));
              Alert.alert("הצלחה", "צפית בסרטון בהצלחה וקיבלת לב במתנה! ❤️");
            } else {
              Alert.alert("מודעה הושלמה", "תודה על הצפייה במודעה!");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAdModalOpen, userTier]);

  // Sync active institution code when profile changes
  useEffect(() => {
    if (userProfile && Array.isArray(userProfile.institutionCodes) && userProfile.institutionCodes.length > 0) {
      setActiveInstitutionCode(userProfile.institutionCodes[0]);
    } else {
      setActiveInstitutionCode(null);
      setActiveProfileType('private');
    }
  }, [userProfile]);

  // Keep track of lists Firestore listener
  const listListenerUnsubscribeRef = useRef<(() => void) | null>(null);

  // Helper to safely unsubscribe from active queries
  const unsubscribeFromLists = () => {
    if (listListenerUnsubscribeRef.current) {
      listListenerUnsubscribeRef.current();
      listListenerUnsubscribeRef.current = null;
    }
  };

  // Auth State Listener & Cloud State Loader
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous listeners if user changes or logs out
      unsubscribeFromLists();

      if (user) {
        setIsInitialSync(true);
        try {
          // 1. Check if user profile document is fully created in Firestore
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserProfile(userData);
            const fetchedTier = (userData.tier || 'registered') as UserTier;
            setUserTier(fetchedTier);
            if (fetchedTier !== 'guest') {
              setHearts(userData.hearts !== undefined ? userData.hearts : 3);
            }

            // 2. Establish real-time query listener for lists where user is allowed
            const listsQuery = query(
              collection(db, 'lists'),
              where('allowedUsers', 'array-contains', user.uid)
            );

            listListenerUnsubscribeRef.current = onSnapshot(listsQuery, async (snapshot) => {
              const fetchedLists: SharedList[] = [];
              snapshot.forEach((d) => {
                fetchedLists.push({ id: d.id, ...d.data() } as SharedList);
              });

              if (fetchedLists.length > 0) {
                setLists(fetchedLists);
                setActiveList((prevActive) => {
                  if (newlyCreatedListIdRef.current) {
                    const newlyCreated = fetchedLists.find((l) => l.id === newlyCreatedListIdRef.current);
                    if (newlyCreated) {
                      newlyCreatedListIdRef.current = null;
                      return newlyCreated;
                    }
                  }
                  if (prevActive) {
                    const updatedActive = fetchedLists.find((l) => l.id === prevActive.id);
                    return updatedActive || fetchedLists[0];
                  }
                  return fetchedLists[0];
                });
              } else {
                // No lists found. Check for legacy single-user list under lists/{uid} and migrate it
                try {
                  const legacyDocRef = doc(db, 'lists', user.uid);
                  const legacyDocSnap = await getDoc(legacyDocRef);
                  
                  let participantsToMigrate: Participant[] = [];
                  if (legacyDocSnap.exists()) {
                    const legacyData = legacyDocSnap.data();
                    if (legacyData && Array.isArray(legacyData.participants)) {
                      participantsToMigrate = legacyData.participants;
                    }
                  }

                  // Create new document in lists collection
                  const newListRef = doc(collection(db, 'lists'));
                  const now = new Date();
                  const newList: SharedList = {
                    id: newListRef.id,
                    name: 'הרשימה שלי',
                    creatorId: user.uid,
                    allowedUsers: [user.uid],
                    participants: participantsToMigrate,
                    queueState: {
                      matrixSequence: generateFairRotationSequence(participantsToMigrate.map(p => p.id)),
                      participantsCount: participantsToMigrate.length,
                      currentGlobalIndex: 0,
                      currentRound: 1,
                      updatedAt: now,
                    },
                    createdAt: now,
                    updatedAt: now,
                    expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
                    isPremiumAccount: false,
                  };

                  await setDoc(newListRef, newList);
                  // Legacy cleanup is skipped or handled on migration verification
                } catch (migrationError) {
                  console.error("Failed to migrate legacy list or create new active list:", migrationError);
                }
              }
            }, (error) => {
              console.error("Firestore onSnapshot subscription error on lists query:", error);
            });

          } else {
            // Profile does NOT exist yet (onboarding Step 2)
            setUserTier('guest');
            setUserProfile(null);
            setLists([]);
            setActiveList(null);
          }
        } catch (error) {
          console.error("Error loading user profile or establishing subscription:", error);
          setUserTier('guest');
          setUserProfile(null);
          setLists([]);
          setActiveList(null);
        } finally {
          setIsInitialSync(false);
        }
      } else {
        // User logged out - fallback to local guest state
        setUserTier('guest');
        setUserProfile(null);
        const guestList = createGuestList();
        setLists([guestList]);
        setActiveList(guestList);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFromLists();
    };
  }, []);

  // Helper to get filtered lists based on active switcher context (private vs. institutional)
  const getFilteredLists = () => {
    return lists.filter((list) => {
      if (activeProfileType === 'private') {
        return !list.institutionCode;
      } else {
        return list.institutionCode === activeInstitutionCode;
      }
    });
  };

  const filteredLists = getFilteredLists();

  // Sync activeList when the switcher context filters change
  useEffect(() => {
    if (userTier === 'guest') return;
    const fLists = getFilteredLists();
    if (fLists.length > 0) {
      setActiveList((prevActive) => {
        if (prevActive && fLists.some((l) => l.id === prevActive.id)) {
          return prevActive;
        }
        setAbsentParticipantIds([]);
        return fLists[0];
      });
    } else {
      setActiveList(null);
      setAbsentParticipantIds([]);
    }
  }, [activeProfileType, activeInstitutionCode, lists]);

  const handleSelectActiveList = (listId: string) => {
    const target = lists.find((l) => l.id === listId);
    if (target) {
      setActiveList(target);
      setAbsentParticipantIds([]);
    }
  };

  const executeCreateList = async (listName: string, isExtraList: boolean = false) => {
    const user = auth.currentUser;
    const isGuest = !user || userTier === 'guest';
    
    try {
      const newListId = isGuest ? `guest_list_${Date.now()}` : doc(collection(db, 'lists')).id;
      const now = new Date();
      const listData: SharedList = {
        id: newListId,
        name: listName.trim() || 'הרשימה שלי',
        creatorId: isGuest ? 'guest' : user.uid,
        allowedUsers: [isGuest ? 'guest' : user.uid],
        participants: [],
        queueState: {
          matrixSequence: [],
          participantsCount: 0,
          currentGlobalIndex: 0,
          currentRound: 1,
          updatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        isPremiumAccount: false,
      };

      newlyCreatedListIdRef.current = newListId;

      const formattedExp = (() => {
        const d = listData.expiresAt as Date;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      })();

      if (!isGuest) {
        if (activeProfileType === 'institutional' && activeInstitutionCode) {
          listData.institutionCode = activeInstitutionCode;
        }
        await setDoc(doc(db, 'lists', newListId), listData);
        setActiveList(listData);
        if (isExtraList) {
          setHearts((h) => Math.max(0, h - 3));
        }
        Alert.alert("הרשימה נוצרה בהצלחה!", `הרשימה תהיה בתוקף עד: ${formattedExp}`);
      } else {
        setLists((prev) => [...prev, listData]);
        setActiveList(listData);
        if (isExtraList) {
          setHearts((h) => Math.max(0, h - 3));
        }
        Alert.alert("הרשימה נוצרה בהצלחה!", `הרשימה תהיה בתוקף עד: ${formattedExp}`);
      }
    } catch (error: any) {
      console.error("Error executing list creation:", error);
      Alert.alert("שגיאה ביצירת רשימה", error.message || error.toString());
    }
  };

  const handleCreateNewList = async (listName: string) => {
    if (userTier === 'guest') {
      const privateLists = lists.filter(l => !l.institutionCode);
      if (privateLists.length >= 1) {
        Alert.alert("", "במצב אורח ניתן ליצור רשימה אחת בלבד. כדי ליצור רשימות נוספות, יש להירשם!");
        return;
      }
    }

    const privateLists = lists.filter(l => !l.institutionCode);
    const isExtraList = privateLists.length >= 2;

    if (isExtraList && hearts < 3) {
      Alert.alert(
        "נדרשים 3 לבבות ליצירת רשימה נוספת",
        "כדי לפתוח רשימה חדשה יש צורך ב-3 לבבות. צפה בסרטונים כדי למלא את המאגר!",
        [
          { text: "ביטול", style: "cancel" },
          {
            text: "צפה בסרטון לקבלת ❤️",
            onPress: () => {
              setIsCreateListOpenGlobal(false);
              setIsAdModalOpen(true);
            }
          }
        ]
      );
      return;
    }

    await executeCreateList(listName, isExtraList);
  };

  const handleDeleteList = async (listId: string) => {
    const user = auth.currentUser;
    const isGuest = !user || userTier === 'guest';

    Alert.alert(
      "מחיקת רשימה",
      "האם אתה בטוח שברצונך למחוק רשימה זו לצמיתות?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: async () => {
            const remaining = lists.filter(l => l.id !== listId);
            const nextActiveList = remaining.length > 0 ? remaining[0] : null;

            if (!isGuest) {
              try {
                const listDocRef = doc(db, 'lists', listId);
                await deleteDoc(listDocRef);
                Alert.alert(
                  "הצלחה", 
                  "הרשימה נמחקה בהצלחה!",
                  [
                    {
                      text: "אישור",
                      onPress: () => {
                        setActiveList(nextActiveList);
                        setCurrentScreen('Home');
                      }
                    }
                  ]
                );
              } catch (error: any) {
                console.error("Failed to delete list from Firestore:", error);
                Alert.alert("שגיאה", error.message || error.toString());
              }
            } else {
              setLists(remaining);
              Alert.alert(
                "הצלחה", 
                "הרשימה נמחקה בהצלחה!",
                [
                  {
                    text: "אישור",
                    onPress: () => {
                      setActiveList(nextActiveList);
                      setCurrentScreen('Home');
                    }
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };

  const handleRenameList = async (listId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert("שגיאה", "אנא הזן שם תקין לרשימה.");
      return;
    }
    const user = auth.currentUser;
    if (!user || userTier === 'guest') return;

    try {
      const listDocRef = doc(db, 'lists', listId);
      await updateDoc(listDocRef, {
        name: trimmed,
        updatedAt: new Date(),
      });
      Alert.alert("הצלחה", "שם הרשימה עודכן בהצלחה!");
      if (activeList?.id === listId) {
        setActiveList(prev => prev ? { ...prev, name: trimmed } : null);
      }
    } catch (error: any) {
      console.error("Failed to rename list:", error);
      Alert.alert("שגיאה", error.message || error.toString());
    }
  };

  const handleUpdateProfile = async (firstNameInput: string, lastNameInput: string, phoneInput: string) => {
    const fName = firstNameInput.trim();
    const lName = lastNameInput.trim();
    const phone = phoneInput.trim();

    if (!fName || !lName || !phone) {
      Alert.alert("שגיאה", "נא למלא את כל שדות החובה.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        firstName: fName,
        lastName: lName,
        phone: phone,
        updatedAt: new Date(),
      });
      
      // Update local profile state
      setUserProfile((prev: any) => ({
        ...prev,
        firstName: fName,
        lastName: lName,
        phone: phone,
      }));

      Alert.alert("הצלחה", "הפרופיל עודכן בהצלחה!");
      setIsProfileEditOpen(false);
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      Alert.alert("שגיאה", error.message || error.toString());
    }
  };

  // Sync / mutate participants list either locally or in Firestore
  const handleUpdateParticipants = async (
    updater: Participant[] | ((prev: Participant[]) => Participant[])
  ) => {
    if (!activeList) return;

    let newParticipants: Participant[];
    if (typeof updater === 'function') {
      newParticipants = updater(activeList.participants);
    } else {
      newParticipants = updater;
    }

    // Determine if we are adding or removing a participant
    const isAddition = newParticipants.length > activeList.participants.length;
    const isDeletion = newParticipants.length < activeList.participants.length;

    let addedParticipant: Participant | undefined;
    if (isAddition) {
      addedParticipant = newParticipants.find(
        (np) => !activeList.participants.some((ap) => ap.id === np.id)
      );
    }

    let removedParticipant: Participant | undefined;
    if (isDeletion) {
      removedParticipant = activeList.participants.find(
        (ap) => !newParticipants.some((np) => np.id === ap.id)
      );
    }

    const newIds = newParticipants.map(p => p.id);
    const newSequence = (isAddition || isDeletion)
      ? generateFairRotationSequence(newIds)
      : (activeList.queueState.matrixSequence || []);

    const newIndex = (isAddition || isDeletion) ? 0 : (activeList.queueState.currentGlobalIndex || 0);
    const newRound = (isAddition || isDeletion) ? 1 : (activeList.queueState.currentRound || 1);
    const newCount = (isAddition || isDeletion) ? newIds.length : (activeList.queueState.participantsCount || newIds.length);

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);

        // Safeguard document reference: Ensure we do not use the user's UID as the document key
        if (activeList.id === user.uid) {
          console.warn("Attempted to update list using user UID as document key. Active list ID:", activeList.id);
          Alert.alert("שגיאת מערכת", "מזהה הרשימה אינו תקין (מזהה משתמש במקום מזהה רשימה).");
          return;
        }

        if (isAddition && addedParticipant) {
          // Add participant: use arrayUnion to push participant object atomically
          // and update the queueState since we regenerated the Latin Square
          await updateDoc(listDocRef, {
            participants: arrayUnion(addedParticipant),
            'queueState.matrixSequence': newSequence,
            'queueState.participantsCount': newCount,
            'queueState.currentGlobalIndex': newIndex,
            'queueState.currentRound': newRound,
            'queueState.updatedAt': new Date(),
            updatedAt: new Date(),
          });
        } else if (isDeletion && removedParticipant) {
          // Delete participant: use arrayRemove to remove participant object atomically
          // and update the queueState since we regenerated the Latin Square
          await updateDoc(listDocRef, {
            participants: arrayRemove(removedParticipant),
            'queueState.matrixSequence': newSequence,
            'queueState.participantsCount': newCount,
            'queueState.currentGlobalIndex': newIndex,
            'queueState.currentRound': newRound,
            'queueState.updatedAt': new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Edit/fallback update (replaces the entire payload)
          await updateDoc(listDocRef, {
            participants: newParticipants,
            'queueState.matrixSequence': newSequence,
            'queueState.participantsCount': newCount,
            'queueState.currentGlobalIndex': newIndex,
            'queueState.currentRound': newRound,
            'queueState.updatedAt': new Date(),
            updatedAt: new Date(),
          });
        }
      } catch (error) {
        console.error("Firestore update failed on updating list participants:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        participants: newParticipants,
        queueState: {
          matrixSequence: newSequence,
          participantsCount: newCount,
          currentGlobalIndex: newIndex,
          currentRound: newRound,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleCoreActionClick = async () => {
    if (userTier === 'guest') return;
    
    const nextClicks = actionClicks + 1;
    setActionClicks(nextClicks);
    
    if (nextClicks > 0 && nextClicks % 5 === 0) {
      const newHearts = Math.min(5, hearts + 1);
      setHearts(newHearts);
      
      Alert.alert("כל הכבוד!", "צברת לב נוסף על פעילות באפליקציה ❤️");
      
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            hearts: newHearts
          });
        } catch (e) {
          console.error("Error saving hearts to DB:", e);
        }
      }
    }
  };

  const handleAdvanceQueue = async () => {
    await handleCoreActionClick();
    if (!activeList) return;
    const N = activeList.queueState?.participantsCount || activeList.participants.length;
    if (N === 0) return;

    let newIndex = (activeList.queueState?.currentGlobalIndex || 0) + N;
    let newRound = (activeList.queueState?.currentRound || 1) + 1;
    let newSequence = activeList.queueState?.matrixSequence || [];

    if (newSequence.length === 0 || newIndex >= N * N) {
      // Completed macro-round or matrix was uninitialized, regenerate sequence and reset pointers
      newSequence = generateFairRotationSequence(activeList.participants.map(p => p.id));
      newIndex = 0;
      newRound = 1;
    }

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          'queueState.matrixSequence': newSequence,
          'queueState.participantsCount': N,
          'queueState.currentGlobalIndex': newIndex,
          'queueState.currentRound': newRound,
          'queueState.updatedAt': new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on advancing queue:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        queueState: {
          matrixSequence: newSequence,
          participantsCount: N,
          currentGlobalIndex: newIndex,
          currentRound: newRound,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleUpdateSecretDraw = async (shuffledSequence: string[]) => {
    await handleCoreActionClick();
    if (!activeList) return;

    const secretDrawState = {
      shuffledSequence,
      updatedAt: new Date(),
    };

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          secretDrawState,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on updating secretDrawState:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        secretDrawState,
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleUpdateChooser = async (chosenIds: string[], lastChosenId: string | null) => {
    await handleCoreActionClick();
    if (!activeList) return;

    const randomChooserState = {
      chosenIds,
      lastChosenId,
      updatedAt: new Date(),
    };

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          randomChooserState,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on updating randomChooserState:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        randomChooserState,
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleUpdateGroups = async (
    shuffledSequence: string[],
    allocationType: 'numberOfGroups' | 'countPerGroup',
    targetValue: number
  ) => {
    await handleCoreActionClick();
    if (!activeList) return;

    const groupsState = {
      shuffledSequence,
      allocationType,
      targetValue,
      updatedAt: new Date(),
    };

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          groupsState,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on updating groupsState:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        groupsState,
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleUpdateGifts = async (shuffledSequence: string[]) => {
    await handleCoreActionClick();
    if (!activeList) return;

    const giftExchangeState = {
      shuffledSequence,
      updatedAt: new Date(),
    };

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          giftExchangeState,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on updating giftExchangeState:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        giftExchangeState,
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleUpdateRandomOrder = async (shuffledSequence: string[]) => {
    await handleCoreActionClick();
    if (!activeList) return;

    const randomOrderState = {
      shuffledSequence,
      updatedAt: new Date(),
    };

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          randomOrderState,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on updating randomOrderState:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        randomOrderState,
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  const handleRegenerateQueue = async () => {
    if (!activeList) return;
    const N = activeList.participants.length;
    if (N === 0) return;

    const newSequence = generateFairRotationSequence(activeList.participants.map(p => p.id));

    const user = auth.currentUser;
    if (user && userTier !== 'guest') {
      try {
        const listDocRef = doc(db, 'lists', activeList.id);
        await updateDoc(listDocRef, {
          'queueState.matrixSequence': newSequence,
          'queueState.currentGlobalIndex': 0,
          'queueState.currentRound': 1,
          'queueState.updatedAt': new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Firestore update failed on regenerating queue sequence:", error);
      }
    } else {
      // Local updates for Guest mode
      const updatedActiveList: SharedList = {
        ...activeList,
        queueState: {
          matrixSequence: newSequence,
          participantsCount: N,
          currentGlobalIndex: 0,
          currentRound: 1,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      };
      setActiveList(updatedActiveList);
      setLists((prev) =>
        prev.map((l) => (l.id === activeList.id ? updatedActiveList : l))
      );
    }
  };

  // List Validity Helpers
  const getValidityDetails = (expiresAtProp: any, isListPremium?: boolean) => {
    if (userTier === 'gold' || userTier === 'lite' || isListPremium) {
      return { percentage: 100, color: '#10B981', label: 'מנוי פעיל (ללא הגבלה)', isExpired: false };
    }
    if (!expiresAtProp) return { percentage: 100, color: '#10B981', label: 'פעיל', isExpired: false };
    
    const expiresAt = (expiresAtProp && typeof expiresAtProp.toDate === 'function')
      ? expiresAtProp.toDate()
      : new Date(expiresAtProp);
      
    const now = new Date();
    const totalDuration = 14 * 24 * 60 * 60 * 1000; // 14 days in ms
    const remaining = expiresAt.getTime() - now.getTime();
    
    if (remaining <= 0) {
      return { percentage: 0, color: '#EF4444', label: 'פג תוקף', isExpired: true };
    }
    
    const percentage = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
    
    let color = '#10B981'; // Green
    let label = 'פעיל';
    if (percentage <= 30) {
      color = '#F59E0B'; // Orange
      label = 'פג בקרוב';
    }
    
    return { percentage, color, label, isExpired: false };
  };

  const handleExtendValidity = async (list: SharedList) => {
    if (hearts < 1) {
      Alert.alert("אין מספיק לבבות", "צפה בסרטון כדי לקבל לב נוסף! ❤️");
      return;
    }

    Alert.alert(
      "הרחבת תוקף רשימה",
      "האם ברצונך להשתמש בלב אחד (❤️) כדי להאריך את תוקף הרשימה ב-14 ימים נוספים?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "הרחב תוקף",
          onPress: async () => {
            setHearts((h) => h - 1);
            
            const expiresAtVal = list.expiresAt as any;
            const currentExpiresAt = (expiresAtVal && typeof expiresAtVal.toDate === 'function')
              ? expiresAtVal.toDate()
              : new Date(expiresAtVal || new Date());
              
            const now = new Date();
            const newExpiresAt = new Date(Math.max(now.getTime(), currentExpiresAt.getTime()) + 14 * 24 * 60 * 60 * 1000);
            
            if (userTier !== 'guest') {
              try {
                const listDocRef = doc(db, 'lists', list.id);
                await updateDoc(listDocRef, {
                  expiresAt: newExpiresAt,
                  updatedAt: now,
                });
                Alert.alert("הצלחה", "תוקף הרשימה הוארך ב-14 ימים בענן! 🎉");
              } catch (error: any) {
                console.error("Failed to extend list validity in Firestore:", error);
                Alert.alert("שגיאה", "שגיאה בעדכון השרת: " + error.toString());
              }
            } else {
              // Local update for Guest mode
              const updatedList: SharedList = {
                ...list,
                expiresAt: newExpiresAt,
                updatedAt: now,
              };
              if (activeList?.id === list.id) {
                setActiveList(updatedList);
              }
              setLists((prev) => prev.map((l) => (l.id === list.id ? updatedList : l)));
              Alert.alert("הצלחה", "תוקף הרשימה הוארך ב-14 ימים מקומית! 🎉");
            }
          }
        }
      ]
    );
  };

  const renderValidityBar = (list: SharedList) => {
    const { percentage, color, label } = getValidityDetails(list.expiresAt, list.isPremiumAccount);
    
    return (
      <View style={styles.validityContainer}>
        <View style={styles.validityBarOuter}>
          <View style={[styles.validityBarInner, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.validityLabel, { color }]}>{label}</Text>
        {percentage < 50 && (
          <TouchableOpacity
            style={styles.extendValidityButton}
            onPress={() => handleExtendValidity(list)}
            activeOpacity={0.7}
          >
            <Text style={styles.extendValidityText}>הרחב ❤️</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const navigateToAuth = (fromScreen: 'Home' | 'ListManagement') => {
    setPreviousScreen(fromScreen);
    setCurrentScreen('Auth');
  };

  const handleLogout = async () => {
    try {
      unsubscribeFromLists();
      await auth.signOut();
      setUserTier('guest');
      setUserProfile(null);
      const guestList = createGuestList();
      setLists([guestList]);
      setActiveList(guestList);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const renderActiveScreen = () => {
    if (currentScreen === 'ListManagement') {
      return (
        <ListManagementScreen
          userTier={userTier}
          userProfile={userProfile}
          participants={activeList ? activeList.participants : []}
          setParticipants={handleUpdateParticipants}
          onBack={() => setCurrentScreen('Home')}
          onRedirectToAuth={() => navigateToAuth('ListManagement')}
          lists={filteredLists}
          activeList={activeList}
          onSelectActiveList={handleSelectActiveList}
          onCreateNewList={handleCreateNewList}
          onOpenMenu={() => setIsSidebarOpen(true)}
          onRenameList={handleRenameList}
          onDeleteList={handleDeleteList}
          activeProfileType={activeProfileType}
        />
      );
    }

    if (currentScreen === 'Auth') {
      return (
        <AuthScreen
          onBack={() => setCurrentScreen(previousScreen)}
          onLoginSuccess={async (tier) => {
            setUserTier(tier);
            const user = auth.currentUser;
            if (user) {
              try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  const userData = userDocSnap.data();
                  setUserProfile(userData);
                }
              } catch (e) {
                console.error("Error fetching user profile in onLoginSuccess:", e);
              }
            }
            if (tier !== 'guest') {
              setHearts(3);
            }
            setCurrentScreen(previousScreen);
          }}
        />
      );
    }

    if (currentScreen === 'ActiveQueue') {
      return (
        <ActiveQueueScreen
          activeList={activeList}
          onBack={() => setCurrentScreen('Home')}
          onAdvanceQueue={handleAdvanceQueue}
          userTier={userTier}
        />
      );
    }

    if (currentScreen === 'SecretDraw') {
      return (
        <SecretDrawScreen
          activeList={activeList}
          onBack={() => setCurrentScreen('Home')}
          onUpdateSecretDraw={handleUpdateSecretDraw}
          userTier={userTier}
        />
      );
    }

    if (currentScreen === 'RandomChooser') {
      return (
        <RandomChooserScreen
          activeList={activeList}
          onBack={() => setCurrentScreen('Home')}
          onUpdateChooser={handleUpdateChooser}
          absentParticipantIds={absentParticipantIds}
          setAbsentParticipantIds={setAbsentParticipantIds}
          userTier={userTier}
        />
      );
    }

    if (currentScreen === 'Groups') {
      return (
        <GroupsScreen
          activeList={activeList}
          onBack={() => setCurrentScreen('Home')}
          onUpdateGroups={handleUpdateGroups}
          absentParticipantIds={absentParticipantIds}
          setAbsentParticipantIds={setAbsentParticipantIds}
          userTier={userTier}
        />
      );
    }

    if (currentScreen === 'Gifts') {
      return (
        <GiftExchangeScreen
          activeList={activeList}
          onBack={() => setCurrentScreen('Home')}
          onUpdateGifts={handleUpdateGifts}
          userTier={userTier}
        />
      );
    }

    if (currentScreen === 'RandomOrder') {
      return (
        <RandomOrderScreen
          activeList={activeList}
          onBack={() => setCurrentScreen('Home')}
          onUpdateRandomOrder={handleUpdateRandomOrder}
          absentParticipantIds={absentParticipantIds}
          setAbsentParticipantIds={setAbsentParticipantIds}
          userTier={userTier}
        />
      );
    }

    return (
      <HomeScreen
        userTier={userTier}
        setUserTier={setUserTier}
        onNavigateToLists={() => setCurrentScreen('ListManagement')}
        onNavigateToAuth={() => navigateToAuth('Home')}
        onLogout={handleLogout}
        onOpenMenu={() => setIsSidebarOpen(true)}
        userProfile={userProfile}
        activeList={activeList}
        activeProfileType={activeProfileType}
        onNavigateToActiveQueue={() => setCurrentScreen('ActiveQueue')}
        onNavigateToSecretDraw={() => setCurrentScreen('SecretDraw')}
        onNavigateToRandomChooser={() => setCurrentScreen('RandomChooser')}
        onNavigateToGroups={() => setCurrentScreen('Groups')}
        onNavigateToGifts={() => setCurrentScreen('Gifts')}
        onNavigateToRandomOrder={() => setCurrentScreen('RandomOrder')}
        absentParticipantIds={absentParticipantIds}
        setAbsentParticipantIds={setAbsentParticipantIds}
      />
    );
  };

  // Profile switches list
  const institutionCodes = userProfile?.institutionCodes || [];

  return (
    <View style={{ flex: 1 }}>
      {renderActiveScreen()}

      {/* Global Sidebar Drawer */}
      {isSidebarOpen && (
        <View style={StyleSheet.absoluteFill}>
          {/* Backdrop */}
          <TouchableOpacity 
            style={styles.drawerBackdrop} 
            activeOpacity={1} 
            onPress={() => setIsSidebarOpen(false)} 
          />
          
          {/* Slide-in Menu Panel */}
          <Animated.View style={[styles.drawerPanel, { transform: [{ translateX: sidebarAnim }] }]}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <TouchableOpacity onPress={() => setIsSidebarOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" style={{ padding: 4 }} />
              </TouchableOpacity>
              <View style={styles.drawerLogoContainer}>
                <Text style={styles.drawerLogoLetterS}>S</Text>
                <Text style={styles.drawerLogoLettersRest}>ortli</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Hearts Status Row */}
              {userTier !== 'guest' && (
                <View style={styles.heartsStatusRow}>
                  {[1, 2, 3, 4, 5].map((index) => {
                    const isFilled = index <= hearts;
                    return (
                      <Ionicons
                        key={index}
                        name={isFilled ? "heart" : "heart-outline"}
                        size={28}
                        color="#EF4444"
                        style={{ marginHorizontal: 4 }}
                      />
                    );
                  })}
                </View>
              )}

              {/* Guest Login Option */}
              {userTier === 'guest' && (
                <View style={styles.guestCard}>
                  <Ionicons name="person-circle-outline" size={42} color="#6366F1" style={{ marginBottom: 6 }} />
                  <Text style={styles.guestCardTitle}>שלום, אורח</Text>
                  <Text style={styles.guestCardSubtitle}>התחבר כדי לשמור ולשתף רשימות בענן</Text>
                  <TouchableOpacity
                    style={styles.guestLoginButton}
                    onPress={() => {
                      setIsSidebarOpen(false);
                      navigateToAuth('Home');
                    }}
                  >
                    <Ionicons name="log-in" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    <Text style={styles.guestLoginButtonText}>Login / התחברות</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* List Management Section */}
              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionTitle}>ניהול רשימות</Text>
                
                {/* Dynamically list standalone lists */}
                <View style={{ maxHeight: 170 }}>
                  <ScrollView 
                    nestedScrollEnabled={true} 
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                  >
                    {filteredLists.map((list) => {
                      const isActive = activeList?.id === list.id;
                      return (
                        <View
                          key={list.id}
                          style={[styles.drawerItemRow, isActive && styles.drawerItemRowActive]}
                        >
                          <TouchableOpacity
                            style={styles.drawerItemSelectArea}
                            onPress={() => {
                              handleSelectActiveList(list.id);
                              setCurrentScreen('Home');
                              setIsSidebarOpen(false);
                            }}
                          >
                            <Ionicons 
                              name="list-sharp" 
                              size={16} 
                              color={isActive ? "#6366F1" : "#64748B"} 
                              style={{ marginLeft: 8 }}
                            />
                            <View style={{ flex: 1, alignItems: 'stretch' }}>
                              <Text style={[styles.drawerItemText, isActive && styles.drawerItemTextActive, { textAlign: 'right' }]}>
                                {list.name}
                              </Text>
                              {renderValidityBar(list)}
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.drawerItemEditButton}
                            onPress={() => {
                              handleSelectActiveList(list.id);
                              setCurrentScreen('ListManagement');
                              setIsSidebarOpen(false);
                            }}
                          >
                            <Ionicons 
                              name="pencil" 
                              size={16} 
                              color={isActive ? "#6366F1" : "#64748B"} 
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                {filteredLists.length === 0 && (
                  <Text style={{ textAlign: 'right', fontSize: 13, color: '#94A3B8', marginVertical: 6 }}>
                    אין רשימות בקטגוריה זו.
                  </Text>
                )}

                {/* + יצירת רשימה חדשה */}
                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => {
                    if (userTier === 'guest') {
                      const privateLists = lists.filter(l => !l.institutionCode);
                      if (privateLists.length >= 1) {
                        Alert.alert("", "במצב אורח ניתן ליצור רשימה אחת בלבד. כדי ליצור רשימות נוספות, יש להירשם!");
                        return;
                      }
                    }
                    const privateLists = lists.filter(l => !l.institutionCode);
                    if (privateLists.length >= 2 && hearts < 3) {
                      Alert.alert(
                        "נדרשים 3 לבבות ליצירת רשימה נוספת",
                        "כדי לפתוח רשימה חדשה יש צורך ב-3 לבבות. צפה בסרטונים כדי למלא את המאגר!",
                        [
                          { text: "ביטול", style: "cancel" },
                          {
                            text: "צפה בסרטון לקבלת ❤️",
                            onPress: () => {
                              setIsSidebarOpen(false);
                              setTimeout(() => {
                                setIsAdModalOpen(true);
                              }, 250);
                            }
                          }
                        ]
                      );
                      return;
                    }

                    setIsSidebarOpen(false);
                    setTimeout(() => {
                      setNewListNameGlobal('');
                      setIsCreateListOpenGlobal(true);
                    }, 250);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#10B981" style={{ marginLeft: 8 }} />
                  <Text style={[styles.drawerItemText, { color: '#10B981' }]}>+ יצירת רשימה חדשה</Text>
                </TouchableOpacity>
              </View>

              {/* הגדרות חשבון Section */}
              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionTitle}>הגדרות חשבון</Text>

                {userTier !== 'guest' && (
                  <>
                    <TouchableOpacity
                      style={styles.drawerItem}
                      onPress={() => {
                        setIsSidebarOpen(false);
                        setTimeout(() => {
                          setEditFirstName(userProfile?.firstName || '');
                          setEditLastName(userProfile?.lastName || '');
                          setEditPhone(userProfile?.phone || '');
                          setIsProfileEditOpen(true);
                        }, 250);
                      }}
                    >
                      <Ionicons name="person-outline" size={18} color="#475569" style={{ marginLeft: 8 }} />
                      <Text style={styles.drawerItemText}>אזור אישי / עריכת פרופיל</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.drawerItem}
                      onPress={() => {
                        setIsSidebarOpen(false);
                        setTimeout(() => {
                          setIsSubscriptionModalOpen(true);
                        }, 250);
                      }}
                    >
                      <Ionicons name="star-outline" size={18} color="#FBBF24" style={{ marginLeft: 8 }} />
                      <Text style={[styles.drawerItemText, { color: '#FBBF24', fontWeight: '800' }]}>רכישת מנוי שנתי ⭐️</Text>
                    </TouchableOpacity>

                    <View style={[styles.drawerItem, { opacity: 0.5 }]}>
                      <Ionicons name="business-outline" size={18} color="#94A3B8" style={{ marginLeft: 8 }} />
                      <Text style={[styles.drawerItemText, { color: '#94A3B8' }]}>הצטרפות למוסד (בקרוב)</Text>
                    </View>
                  </>
                )}

                {/* צפה בסרטון לקבלת ❤️ */}
                {userTier !== 'guest' && (
                  <TouchableOpacity
                    style={[styles.drawerItem, { marginTop: 6 }]}
                    onPress={() => {
                      if (hearts >= 5) {
                        Alert.alert("מכסת לבבות מלאה", "כבר יש לך את כמות הלבבות המקסימלית (5)! ❤️");
                        return;
                      }
                      setIsSidebarOpen(false);
                      setTimeout(() => {
                        setIsAdModalOpen(true);
                      }, 250);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="videocam-outline" size={18} color="#EF4444" style={{ marginLeft: 8 }} />
                    <Text style={[styles.drawerItemText, { color: '#EF4444', fontWeight: '800' }]}>צפה בסרטון לקבלת ❤️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Sticky footer login button at the bottom of the sidebar for guest */}
            {userTier === 'guest' && (
              <View style={styles.drawerFooter}>
                <TouchableOpacity
                  style={styles.drawerFooterLoginButton}
                  onPress={() => {
                    setIsSidebarOpen(false);
                    navigateToAuth('Home');
                  }}
                >
                  <Ionicons name="log-in" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  <Text style={styles.drawerFooterLoginButtonText}>Login / התחברות</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      )}

      {/* Global List Creation Modal */}
      <Modal
        visible={isCreateListOpenGlobal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCreateListOpenGlobal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsCreateListOpenGlobal(false)}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>יצירת רשימה חדשה</Text>
              <View style={styles.headerPlaceholder} />
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.formLabel}>שם הרשימה:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="למשל: כיתה ב' 3"
                placeholderTextColor="#94A3B8"
                value={newListNameGlobal}
                onChangeText={setNewListNameGlobal}
                textAlign="right"
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={async () => {
                  const trimmed = newListNameGlobal.trim();
                  if (!trimmed) {
                    Alert.alert("שגיאה", "אנא הזן שם לרשימה.");
                    return;
                  }
                  await handleCreateNewList(trimmed);
                  setIsCreateListOpenGlobal(false);
                  setCurrentScreen('ListManagement');
                }}
              >
                <Text style={styles.saveButtonText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Profile Editing Modal */}
      <Modal
        visible={isProfileEditOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsProfileEditOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsProfileEditOpen(false)}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>עריכת פרופיל משתמש</Text>
              <View style={styles.headerPlaceholder} />
            </View>

            <View style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>שם פרטי *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="שם פרטי..."
                  placeholderTextColor="#94A3B8"
                  textAlign="right"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>שם משפחה *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="שם משפחה..."
                  placeholderTextColor="#94A3B8"
                  textAlign="right"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>טלפון *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="מספר טלפון..."
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  textAlign="right"
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={async () => {
                  await handleUpdateProfile(editFirstName, editLastName, editPhone);
                }}
              >
                <Text style={styles.saveButtonText}>שמור שינויים</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Simulated Video Ad Modal */}
      <Modal
        visible={isAdModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (adTimer === 0) {
            setIsAdModalOpen(false);
          }
        }}
      >
        <SafeAreaView style={styles.adModalContainer}>
          <StatusBar style="light" />
          <View style={styles.adVideoPlayer}>
            <View style={styles.adCountdownCircle}>
              <Text style={styles.adCountdownText}>{adTimer}</Text>
            </View>
            <Text style={styles.adModalTitle}>סרטון ממומן</Text>
            <Text style={styles.adModalDesc}>
              הסרטון מדגים קבלת פרס. אנא המתן לסיום הצפייה כדי לקבל את הלב שלך.
            </Text>
            
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Text style={styles.adRewardLabel}>הפרס: 1 לב במתנה</Text>
              <View style={styles.adHeartIndicator}>
                <Ionicons name="heart" size={32} color="#EF4444" />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Premium Subscription Placeholder Modal */}
      <Modal
        visible={isSubscriptionModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSubscriptionModalOpen(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            {/* Header / Icon */}
            <View style={styles.subModalHeader}>
              <Ionicons name="star" size={40} color="#FBBF24" />
              <Text style={styles.subModalTitle}>מנוי שנתי Premium ⭐️</Text>
            </View>

            {/* Description */}
            <Text style={styles.subModalDesc}>
              הפוך לגרסה המתקדמת של Sortli ותהנה מכל היתרונות הבאים ללא הגבלה:
            </Text>

            {/* Features List */}
            <View style={styles.subFeaturesList}>
              <View style={styles.subFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginLeft: 8 }} />
                <Text style={styles.subFeatureText}>יצירת רשימות ללא הגבלה</Text>
              </View>
              <View style={styles.subFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginLeft: 8 }} />
                <Text style={styles.subFeatureText}>תוקף רשימה ללא הגבלת זמן</Text>
              </View>
              <View style={styles.subFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginLeft: 8 }} />
                <Text style={styles.subFeatureText}>ללא פרסומות או מגבלות לבבות</Text>
              </View>
              <View style={styles.subFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginLeft: 8 }} />
                <Text style={styles.subFeatureText}>סנכרון מלא ועבודה בענן</Text>
              </View>
            </View>

            {/* Plan Selector Grid */}
            <View style={styles.subPlansContainer}>
              <TouchableOpacity
                style={[styles.subPlanCard, selectedSubPlan === 'yearly' && styles.subPlanCardSelected]}
                onPress={() => setSelectedSubPlan('yearly')}
              >
                <Text style={styles.subPlanTitle}>מנוי שנתי ⭐️</Text>
                <Text style={styles.subPlanPrice}>₪49.90</Text>
                <Text style={styles.subPlanPeriod}>לשנה אחת</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subPlanCard, selectedSubPlan === 'two_years' && styles.subPlanCardSelected]}
                onPress={() => setSelectedSubPlan('two_years')}
              >
                <View style={styles.subPlanBadge}>
                  <Text style={styles.subPlanBadgeText}>חסוך 20%</Text>
                </View>
                <Text style={styles.subPlanTitle}>מנוי דו-שנתי 💎</Text>
                <Text style={styles.subPlanPrice}>₪79.90</Text>
                <Text style={styles.subPlanPeriod}>לשנתיים</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subPlanCard, selectedSubPlan === 'lifetime' && styles.subPlanCardSelected]}
                onPress={() => setSelectedSubPlan('lifetime')}
              >
                <View style={styles.subPlanBadgeBest}>
                  <Text style={styles.subPlanBadgeText}>הכי משתלם</Text>
                </View>
                <Text style={styles.subPlanTitle}>לכל החיים 👑</Text>
                <Text style={styles.subPlanPrice}>₪149.90</Text>
                <Text style={styles.subPlanPeriod}>חד-פעמי</Text>
              </TouchableOpacity>
            </View>

            {/* Simulated Purchase Button */}
            <TouchableOpacity
              style={styles.subModalBuyButton}
              onPress={async () => {
                if (userTier === 'guest') {
                  Alert.alert("התחברות נדרשת", "על מנת לרכוש מנוי פרימיום, יש להירשם או להתחבר למערכת תחילה.");
                  return;
                }
                
                try {
                  const user = auth.currentUser;
                  if (user) {
                    const newTier = selectedSubPlan === 'lifetime' ? 'gold' : 'lite';
                    const userDocRef = doc(db, 'users', user.uid);
                    
                    const subscriptionData = {
                      tier: newTier,
                      subscriptionType: selectedSubPlan,
                      subscriptionExpiresAt: selectedSubPlan === 'lifetime' 
                        ? new Date(new Date().setFullYear(new Date().getFullYear() + 100))
                        : (selectedSubPlan === 'two_years' 
                          ? new Date(new Date().setFullYear(new Date().getFullYear() + 2)) 
                          : new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
                      updatedAt: new Date(),
                    };
                    
                    await updateDoc(userDocRef, subscriptionData);
                    
                    setUserTier(newTier);
                    if (userProfile) {
                      setUserProfile({
                        ...userProfile,
                        ...subscriptionData
                      });
                    }
                    
                    Alert.alert("ברכות! 🎉", `רכישת המנוי בוצעה בהצלחה. חשבונך שודרג ל-Premium.`);
                    setIsSubscriptionModalOpen(false);
                  }
                } catch (e: any) {
                  console.error("Subscription simulation upgrade failed:", e);
                  Alert.alert("שגיאה", "שגיאה במהלך רכישת מנוי: " + e.message);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.subModalBuyButtonText}>רכוש מנוי עכשיו 🚀</Text>
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.subModalCloseButton}
              onPress={() => setIsSubscriptionModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.subModalCloseButtonText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 20,
  },
  drawerLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerLogoLetterS: {
    fontSize: 38,
    fontWeight: '900',
    color: '#4F46E5',
  },
  drawerLogoLettersRest: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 6,
    letterSpacing: 4,
  },
  drawerSection: {
    marginBottom: 24,
  },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  drawerItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  drawerItemActive: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
  },
  drawerItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'right',
  },
  drawerItemTextActive: {
    color: '#6366F1',
    fontWeight: '800',
  },
  drawerItemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  drawerItemRowActive: {
    backgroundColor: '#EEF2FF',
  },
  drawerItemSelectArea: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
  },
  drawerItemEditButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerSubItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 16,
  },
  drawerSubItemText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'right',
  },
  drawerSubItemTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  profileToggleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  profileToggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  profileToggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  profileToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  profileToggleTextActive: {
    color: '#6366F1',
  },
  guestCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guestCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
    textAlign: 'center',
  },
  guestCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  guestLoginButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  guestLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 16,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  drawerFooterLoginButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  drawerFooterLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  headerPlaceholder: {
    width: 40,
  },
  modalForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  modalInput: {
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
    textAlign: 'right',
  },
  saveButton: {
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteButton: {
    height: 48,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  heartsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  heartsCountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E11D48',
    flex: 1,
    textAlign: 'right',
    marginRight: 6,
  },
  earnHeartsButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  earnHeartsButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  validityContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
  },
  validityBarOuter: {
    height: 6,
    flex: 1,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 6,
  },
  validityBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  validityLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 8,
  },
  extendValidityButton: {
    backgroundColor: '#FFE4E6',
    borderWidth: 0.5,
    borderColor: '#FDA4AF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  extendValidityText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E11D48',
  },
  adModalContainer: {
    flex: 1,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adVideoPlayer: {
    width: '85%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  adCountdownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 4,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  adCountdownText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#EF4444',
  },
  adModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  adModalDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  adRewardLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  adHeartIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subModalContent: {
    width: '90%',
    backgroundColor: '#1E1B4B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  subModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  subModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
  },
  subModalDesc: {
    fontSize: 14,
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  subFeaturesList: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  subFeatureRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginVertical: 6,
  },
  subFeatureText: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'right',
    flex: 1,
  },
  subModalPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FBBF24',
    marginBottom: 4,
  },
  subModalNotice: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  subModalCloseButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  subModalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  subPlansContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 16,
  },
  subPlanCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    padding: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  subPlanCardSelected: {
    borderColor: '#FBBF24',
    backgroundColor: '#334155',
  },
  subPlanTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subPlanPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FBBF24',
    marginBottom: 2,
    textAlign: 'center',
  },
  subPlanPeriod: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  subPlanBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subPlanBadgeBest: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subPlanBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subModalBuyButton: {
    backgroundColor: '#FBBF24',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  subModalBuyButtonText: {
    color: '#1E1B4B',
    fontSize: 15,
    fontWeight: '900',
  },
});
