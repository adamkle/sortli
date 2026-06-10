import React, { useState, useEffect } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { UserTier, Participant, SharedList } from '../types';
import BottomAdBanner from '../components/BottomAdBanner';
export type { Participant };

interface ListManagementScreenProps {
  userTier: UserTier;
  userProfile: any;
  participants: Participant[];
  setParticipants: (updater: Participant[] | ((prev: Participant[]) => Participant[])) => void;
  onBack: () => void;
  onRedirectToAuth: () => void;
  lists: SharedList[];
  activeList: SharedList | null;
  onSelectActiveList: (listId: string) => void;
  onCreateNewList: (listName: string) => Promise<void>;
  onOpenMenu: () => void;
  onRenameList?: (listId: string, newName: string) => Promise<void>;
  onDeleteList?: (listId: string) => Promise<void>;
  activeProfileType: 'private' | 'institutional';
}

const ListManagementScreen: React.FC<ListManagementScreenProps> = ({
  userTier,
  userProfile,
  participants,
  setParticipants,
  onBack,
  onRedirectToAuth,
  lists,
  activeList,
  onSelectActiveList,
  onCreateNewList,
  onOpenMenu,
  onRenameList,
  onDeleteList,
  activeProfileType,
}) => {
  const formatDate = (dateVal: any) => {
    if (!dateVal) return '';
    const date = typeof dateVal.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const showAds = activeProfileType === 'private' && (userTier === 'guest' || userTier === 'registered');
  const [isListSelectorOpen, setIsListSelectorOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [editListName, setEditListName] = useState('');
  // Main input state (only firstName is entered here)
  const [newFirstName, setNewFirstName] = useState('');
  
  // Main inputs for optional fields (visible when newFirstName is not empty)
  const [newLastName, setNewLastName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newGender, setNewGender] = useState<'boy' | 'girl' | undefined>(undefined);
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  // Form states for the modal
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editGender, setEditGender] = useState<'boy' | 'girl' | undefined>(undefined);
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');



  // Add participant (fast input)
  const handleAddParticipant = () => {
    const trimmedName = newFirstName.trim();
    if (!trimmedName) {
      Alert.alert('שגיאה', 'יש להזין שם פרטי', [{ text: 'אישור' }]);
      return;
    }

    const maxLimit = userTier === 'guest' ? 40 : (userTier === 'gold' ? 150 : 100);
    if (participants.length >= maxLimit) {
      Alert.alert(
        'מגבלת רשימה',
        userTier === 'guest'
          ? 'הגעת למגבלה של 40 משתתפים עבור משתמש אורח'
          : `הגעת למגבלת המשתתפים (${maxLimit} משתתפים) עבור סוג מנוי זה`,
        [{ text: 'אישור' }]
      );
      return;
    }

    const newParticipant: Participant = {
      id: String(Date.now()),
      firstName: trimmedName,
      lastName: newLastName ? newLastName.trim() : "",
      nickname: newNickname ? newNickname.trim() : "",
      gender: newGender || "boy",
      phone: newPhone ? newPhone.trim() : "",
      notes: newNotes ? newNotes.trim() : "",
    };

    setParticipants((prev) => [newParticipant, ...prev]);
    
    // Clear all fields to collapse the sub-panel
    setNewFirstName('');
    setNewLastName('');
    setNewNickname('');
    setNewGender(undefined);
    setNewPhone('');
    setNewNotes('');
  };

  // Delete participant
  const handleDeleteParticipant = (id: string, name: string) => {
    Alert.alert(
      'מחיקת משתתף',
      `האם אתה בטוח שברצונך למחוק את ${name}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            setParticipants((prev) => prev.filter((p) => p.id !== id));
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Open edit modal
  const handleOpenEditModal = (participant: Participant) => {
    setEditingParticipant(participant);
    setEditFirstName(participant.firstName || '');
    setEditLastName(participant.lastName || '');
    setEditNickname(participant.nickname || '');
    setEditGender(participant.gender);
    setEditPhone(participant.phone || '');
    setEditNotes(participant.notes || '');
    setIsEditModalOpen(true);
  };

  // Save participant changes
  const handleSaveParticipantDetails = () => {
    const trimmedFirstName = editFirstName.trim();
    if (!trimmedFirstName) {
      Alert.alert('שגיאה', 'שם פרטי אינו יכול להיות ריק', [{ text: 'אישור' }]);
      return;
    }

    if (!editingParticipant) return;

    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id === editingParticipant.id) {
          return {
            id: p.id,
            firstName: trimmedFirstName,
            lastName: editLastName ? editLastName.trim() : "",
            nickname: editNickname ? editNickname.trim() : "",
            gender: editGender || "boy",
            phone: editPhone ? editPhone.trim() : "",
            notes: editNotes ? editNotes.trim() : "",
          };
        }
        return p;
      })
    );

    setIsEditModalOpen(false);
    setEditingParticipant(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <NavigationIcon name="arrow-forward-sharp" size={24} color="#1E1B4B" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            {/* Row 1: Standalone text label */}
            <Text style={styles.headerSubtitle}>ניהול רשימה</Text>
            
            {/* Row 2: Dynamic listName and icons */}
            {activeList && (
              <View style={styles.headerNameRow}>
                <Text style={styles.headerListName} numberOfLines={2}>
                  {activeList.name}
                </Text>
                {userTier !== 'guest' && (
                  <View style={styles.headerActionsRow}>
                    <TouchableOpacity 
                      style={styles.headerActionIcon} 
                      onPress={() => {
                        setEditListName(activeList.name);
                        setIsEditListOpen(true);
                      }}
                    >
                      <NavigationIcon name="create-outline" size={18} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.headerActionIcon} 
                      onPress={() => {
                        if (onDeleteList) {
                          onDeleteList(activeList.id);
                        }
                      }}
                    >
                      <NavigationIcon name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={styles.headerPlaceholder}>
            {userTier !== 'guest' && (
              <TouchableOpacity onPress={onOpenMenu} style={styles.headerListsIcon}>
                <NavigationIcon name="menu" size={28} color="#1E1B4B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Guest Warning Banner */}
        {userTier === 'guest' && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ הרשימה לא תישמר ביציאה מהאפליקציה, לשמירה יש להירשם
            </Text>
            <TouchableOpacity onPress={onRedirectToAuth} style={styles.warningLink}>
              <Text style={styles.warningLinkText}>להרשמה / התחברות לחץ כאן</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty list prompt if registered user has no lists */}
        {userTier !== 'guest' && lists.length === 0 && (
          <View style={styles.noListsPrompt}>
            <Text style={styles.noListsPromptText}>לא נמצאו רשימות במערכת.</Text>
            <TouchableOpacity
              style={styles.createFirstListButton}
              onPress={() => setIsCreateListOpen(true)}
            >
              <Text style={styles.createFirstListButtonText}>+ יצירת רשימה ראשונה</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeList ? (
          <>
            <View style={styles.metaInfoBar}>
              <Text style={styles.metaInfoText}>נוצרה ב-: {formatDate(activeList.createdAt)}</Text>
              <Text style={styles.metaInfoText}>בתוקף עד: {formatDate(activeList.expiresAt)}</Text>
            </View>
            {/* Block A: Top Form Container (Static height, auto-expanding) */}
            <View style={styles.topFormContainer}>
              <View style={styles.fastInputContainer}>
                <Text style={styles.inputLabel}>הוספה מהירה:</Text>
                <View style={styles.inputRow}>
                  <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
                    <NavigationIcon name="add" size={26} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.textInput}
                    placeholder="הזן שם פרטי..."
                    placeholderTextColor="#94A3B8"
                    value={newFirstName}
                    onChangeText={setNewFirstName}
                    textAlign="right"
                    returnKeyType="done"
                    onSubmitEditing={handleAddParticipant}
                  />
                </View>

                {/* Dynamic sub-panel for optional bonus fields */}
                {newFirstName.trim() !== '' && (
                  <View style={styles.subPanelContainer}>
                    {/* Row 1: Nickname & LastName side-by-side */}
                    <View style={styles.subPanelRow}>
                      <View style={[styles.subPanelFormGroup, { marginRight: 8 }]}>
                        <Text style={styles.subPanelLabel}>כינוי</Text>
                        <TextInput
                          style={styles.subPanelInput}
                          placeholder="כינוי..."
                          placeholderTextColor="#94A3B8"
                          value={newNickname}
                          onChangeText={setNewNickname}
                          textAlign="right"
                        />
                      </View>
                      <View style={[styles.subPanelFormGroup, { marginLeft: 8 }]}>
                        <Text style={styles.subPanelLabel}>שם משפחה</Text>
                        <TextInput
                          style={styles.subPanelInput}
                          placeholder="שם משפחה..."
                          placeholderTextColor="#94A3B8"
                          value={newLastName}
                          onChangeText={setNewLastName}
                          textAlign="right"
                        />
                      </View>
                    </View>

                    {/* Row 2: Phone & Gender side-by-side */}
                    <View style={styles.subPanelRow}>
                      <View style={[styles.subPanelFormGroup, { marginRight: 8 }]}>
                        <Text style={styles.subPanelLabel}>טלפון</Text>
                        <TextInput
                          style={styles.subPanelInput}
                          placeholder="טלפון..."
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={newPhone}
                          onChangeText={setNewPhone}
                          textAlign="right"
                        />
                      </View>
                      <View style={[styles.subPanelFormGroup, { marginLeft: 8 }]}>
                        <Text style={styles.subPanelLabel}>מין / מגדר</Text>
                        <View style={styles.genderToggleContainer}>
                          <TouchableOpacity
                            style={[
                              styles.genderOption,
                              styles.genderGirl,
                              newGender === 'girl' && styles.genderGirlActive,
                              { height: 42, marginHorizontal: 3 },
                            ]}
                            onPress={() => setNewGender(newGender === 'girl' ? undefined : 'girl')}
                          >
                            <NavigationIcon
                              name="female"
                              size={14}
                              color={newGender === 'girl' ? '#FFFFFF' : '#EC4899'}
                            />
                            <Text
                              style={[
                                styles.genderText,
                                { fontSize: 13, color: newGender === 'girl' ? '#FFFFFF' : '#EC4899', marginLeft: 4 },
                              ]}
                            >
                              ילדה
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.genderOption,
                              styles.genderBoy,
                              newGender === 'boy' && styles.genderBoyActive,
                              { height: 42, marginHorizontal: 3 },
                            ]}
                            onPress={() => setNewGender(newGender === 'boy' ? undefined : 'boy')}
                          >
                            <NavigationIcon
                              name="male"
                              size={14}
                              color={newGender === 'boy' ? '#FFFFFF' : '#3B82F6'}
                            />
                            <Text
                              style={[
                                styles.genderText,
                                { fontSize: 13, color: newGender === 'boy' ? '#FFFFFF' : '#3B82F6', marginLeft: 4 },
                              ]}
                            >
                              ילד
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Row 3: Notes (Full width) */}
                    <View style={styles.subPanelFormGroup}>
                      <Text style={styles.subPanelLabel}>הערות</Text>
                      <TextInput
                        style={[styles.subPanelInput, styles.subPanelTextArea]}
                        placeholder="הערות מיוחדות..."
                        placeholderTextColor="#94A3B8"
                        value={newNotes}
                        onChangeText={setNewNotes}
                        multiline={true}
                        numberOfLines={2}
                        textAlign="right"
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Block B: Bottom List Container (Takes remaining space dynamically) */}
            <View style={styles.bottomListContainer}>
              {/* Title & Count Row for List */}
              <View style={styles.listHeaderRow}>
                <Text style={styles.listCount}>
                  סה״כ: {participants.length} / {userTier === 'guest' ? 40 : (userTier === 'gold' ? 150 : 100)}
                </Text>
                <Text style={styles.listTitle}>רשימת משתתפים</Text>
              </View>

              <FlatList
                data={participants}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                  styles.listFlatListContent,
                  showAds && { paddingBottom: 100 }
                ]}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const displayName = `${item.firstName}${item.lastName ? ' ' + item.lastName : ''}${
                    item.nickname ? ` (${item.nickname})` : ''
                  }`;

                  return (
                    <View style={styles.itemRow}>
                      {/* Delete Action (Left) */}
                      <TouchableOpacity
                        style={styles.actionButtonDelete}
                        onPress={() => handleDeleteParticipant(item.id, item.firstName)}
                      >
                        <NavigationIcon name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>

                      {/* Edit Action (Middle Left) */}
                      <TouchableOpacity
                        style={styles.actionButtonEdit}
                        onPress={() => handleOpenEditModal(item)}
                      >
                        <NavigationIcon name="pencil-sharp" size={18} color="#4F4A8B" />
                      </TouchableOpacity>

                      {/* Participant Details (Right) */}
                      <View style={styles.itemDetailsContainer}>
                        <Text style={styles.itemText} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {item.gender && (
                          <View
                            style={[
                              styles.genderDot,
                              { backgroundColor: item.gender === 'boy' ? '#3B82F6' : '#EC4899' },
                            ]}
                          />
                        )}
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <NavigationIcon name="people-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyText}>אין משתתפים ברשימה</Text>
                    <Text style={styles.emptySubtext}>הקלד שם למעלה והוסף בלחיצה על +</Text>
                  </View>
                }
              />
            </View>
          </>
        ) : (
          <View style={styles.noActiveListContainer}>
            <NavigationIcon name="list-outline" size={64} color="#94A3B8" />
            <Text style={styles.noActiveListText}>אנא בחר רשימה כדי להתחיל להוסיף שמות</Text>
            {userTier !== 'guest' && lists.length > 0 && (
              <TouchableOpacity
                style={styles.selectListTriggerButton}
                onPress={() => setIsListSelectorOpen(true)}
              >
                <Text style={styles.selectListTriggerButtonText}>בחר רשימה מהרשימות שלי</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Sliding Modal for Editing Details */}
        <Modal
          visible={isEditModalOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsEditModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <NavigationIcon name="close" size={24} color="#64748B" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>עריכת פרטים</Text>
                <View style={styles.headerPlaceholder} />
              </View>

              <FlatList
                data={[1]}
                keyExtractor={() => 'form'}
                contentContainerStyle={styles.modalScrollContent}
                renderItem={() => (
                  <View style={styles.modalForm}>
                    {/* First Name Input */}
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

                    {/* Last Name Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>שם משפחה</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editLastName}
                        onChangeText={setEditLastName}
                        placeholder="שם משפחה..."
                        placeholderTextColor="#94A3B8"
                        textAlign="right"
                      />
                    </View>

                    {/* Nickname Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>כינוי</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editNickname}
                        onChangeText={setEditNickname}
                        placeholder="כינוי..."
                        placeholderTextColor="#94A3B8"
                        textAlign="right"
                      />
                    </View>

                    {/* Gender Selection */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>מין / מגדר</Text>
                      <View style={styles.genderToggleContainer}>
                        <TouchableOpacity
                          style={[
                            styles.genderOption,
                            styles.genderGirl,
                            editGender === 'girl' && styles.genderGirlActive,
                          ]}
                          onPress={() => setEditGender(editGender === 'girl' ? undefined : 'girl')}
                        >
                          <NavigationIcon
                            name="female"
                            size={18}
                            color={editGender === 'girl' ? '#FFFFFF' : '#EC4899'}
                          />
                          <Text
                            style={[
                              styles.genderText,
                              { color: editGender === 'girl' ? '#FFFFFF' : '#EC4899' },
                            ]}
                          >
                            ילדה
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.genderOption,
                            styles.genderBoy,
                            editGender === 'boy' && styles.genderBoyActive,
                          ]}
                          onPress={() => setEditGender(editGender === 'boy' ? undefined : 'boy')}
                        >
                          <NavigationIcon
                            name="male"
                            size={18}
                            color={editGender === 'boy' ? '#FFFFFF' : '#3B82F6'}
                          />
                          <Text
                            style={[
                              styles.genderText,
                              { color: editGender === 'boy' ? '#FFFFFF' : '#3B82F6' },
                            ]}
                          >
                            ילד
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Phone Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>טלפון</Text>
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

                    {/* Notes Input */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>הערות</Text>
                      <TextInput
                        style={[styles.modalInput, styles.textArea]}
                        value={editNotes}
                        onChangeText={setEditNotes}
                        placeholder="הוסף הערות או פרטים מזהים נוספים..."
                        placeholderTextColor="#94A3B8"
                        multiline={true}
                        numberOfLines={3}
                        textAlign="right"
                      />
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveParticipantDetails}
                    >
                      <Text style={styles.saveButtonText}>שמור שינויים</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Lists Selector Modal */}
        <Modal
          visible={isListSelectorOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsListSelectorOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.listSelectorContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsListSelectorOpen(false)}
                >
                  <NavigationIcon name="close" size={24} color="#64748B" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>בחירת רשימה</Text>
                <View style={styles.headerPlaceholder} />
              </View>

              <FlatList
                data={lists}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listSelectorScroll}
                renderItem={({ item }) => {
                  const isActive = activeList?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.listSelectorItem,
                        isActive && styles.listSelectorItemActive
                      ]}
                      onPress={() => {
                        onSelectActiveList(item.id);
                        setIsListSelectorOpen(false);
                      }}
                    >
                      <View style={styles.listSelectorItemTextContainer}>
                        <Text style={[
                          styles.listSelectorItemName,
                          isActive && styles.listSelectorItemNameActive
                        ]}>
                          {item.name}
                        </Text>
                        <Text style={styles.listSelectorItemSub}>
                          {item.participants.length} משתתפים
                        </Text>
                      </View>
                      {isActive ? (
                        <NavigationIcon name="checkmark-circle" size={22} color="#6366F1" />
                      ) : (
                        <NavigationIcon name="chevron-back" size={20} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.createListButton}
                    onPress={() => {
                      if (userTier === 'guest') {
                        const privateLists = lists.filter(l => !l.institutionCode);
                        if (privateLists.length >= 1) {
                          Alert.alert("", "במצב אורח ניתן ליצור רשימה אחת בלבד. כדי ליצור רשימות נוספות, יש להירשם!");
                          return;
                        }
                      }
                      setIsListSelectorOpen(false);
                      setTimeout(() => setIsCreateListOpen(true), 300);
                    }}
                  >
                    <Text style={styles.createListButtonText}>+ יצירת רשימה חדשה</Text>
                  </TouchableOpacity>
                }
              />
            </View>
          </View>
        </Modal>

        {/* Edit List Modal */}
        <Modal
          visible={isEditListOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsEditListOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsEditListOpen(false)}
                >
                  <NavigationIcon name="close" size={24} color="#64748B" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {activeList ? `ניהול רשימה: ${activeList.name}` : 'ניהול רשימה'}
                </Text>
                <View style={styles.headerPlaceholder} />
              </View>

              <View style={styles.modalForm}>
                <Text style={styles.formLabel}>שם הרשימה:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editListName}
                  onChangeText={setEditListName}
                  placeholder="ערוך שם רשימה..."
                  placeholderTextColor="#94A3B8"
                  textAlign="right"
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={async () => {
                    if (activeList && onRenameList) {
                      await onRenameList(activeList.id, editListName);
                      setIsEditListOpen(false);
                    }
                  }}
                >
                  <Text style={styles.saveButtonText}>עדכן שם</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={async () => {
                    if (activeList && onDeleteList) {
                      await onDeleteList(activeList.id);
                      setIsEditListOpen(false);
                    }
                  }}
                >
                  <Text style={styles.deleteButtonText}>מחק רשימה לצמיתות</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create New List Modal */}
        <Modal
          visible={isCreateListOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsCreateListOpen(false)}
        >
          <View style={styles.modalOverlayTop}>
            <View style={styles.createListContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsCreateListOpen(false)}
                >
                  <NavigationIcon name="close" size={24} color="#64748B" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>יצירת רשימה חדשה</Text>
                <View style={styles.headerPlaceholder} />
              </View>

              <View style={styles.createListForm}>
                <Text style={styles.createListLabel}>שם הרשימה:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="למשל: כיתה ב' 3"
                  placeholderTextColor="#94A3B8"
                  value={newListName}
                  onChangeText={setNewListName}
                  textAlign="right"
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={async () => {
                    const trimmedName = newListName.trim();
                    if (!trimmedName) {
                      Alert.alert("שגיאה", "נא להזין שם לרשימה");
                      return;
                    }
                    await onCreateNewList(trimmedName);
                    setNewListName('');
                    setIsCreateListOpen(false);
                  }}
                >
                  <Text style={styles.saveButtonText}>שמור</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
          {showAds && <BottomAdBanner />}
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    minHeight: 70,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  headerPlaceholder: {
    width: 40,
  },
  warningBanner: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    padding: 12,
    alignItems: 'center',
  },
  warningText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  warningLink: {
    marginTop: 4,
  },
  warningLinkText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  topFormContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  bottomListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listFlatListContent: {
    paddingBottom: 40,
  },
  fastInputContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#F8FAFC',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
  },
  addButton: {
    width: 50,
    height: 50,
    backgroundColor: '#6366F1',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  subPanelContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1.5,
    borderTopColor: '#F1F5F9',
  },
  subPanelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subPanelFormGroup: {
    flex: 1,
    marginBottom: 12,
  },
  subPanelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 6,
  },
  subPanelInput: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  subPanelTextArea: {
    height: 60,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  listHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  listCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemDetailsContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  genderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  actionButtonEdit: {
    width: 34,
    height: 34,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonDelete: {
    width: 34,
    height: 34,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
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
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  modalForm: {
    paddingBottom: 20,
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
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  genderToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  genderBoy: {
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  genderBoyActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F6',
  },
  genderGirl: {
    borderColor: '#FCE7F3',
    backgroundColor: '#FDF2F8',
  },
  genderGirlActive: {
    borderColor: '#EC4899',
    backgroundColor: '#EC4899',
  },
  genderText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  saveButton: {
    height: 52,
    backgroundColor: '#6366F1',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerTitleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B', // Slate gray
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  headerNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerListName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  headerActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginRight: 6,
  },
  headerActionIcon: {
    padding: 4,
    marginHorizontal: 2,
  },
  headerListsIcon: {
    padding: 4,
  },
  listSelectorContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  listSelectorScroll: {
    padding: 20,
  },
  listSelectorItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  listSelectorItemActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  listSelectorItemTextContainer: {
    alignItems: 'flex-end',
  },
  listSelectorItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  listSelectorItemNameActive: {
    color: '#6366F1',
  },
  listSelectorItemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  createListButton: {
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  createListButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  createListContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 340,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  createListForm: {
    padding: 20,
  },
  createListLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  listActionHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  createNewListButtonTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createNewListButtonTopText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlayTop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-start',
    paddingTop: 80,
    alignItems: 'center',
  },
  greetingSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
    textAlign: 'right',
  },
  listSelectionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 8,
  },
  horizontalSelectorContainer: {
    marginVertical: 4,
  },
  horizontalSelectorScroll: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingLeft: 16,
  },
  listSelectionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginLeft: 8,
  },
  listSelectionChipActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  listSelectionChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  listSelectionChipTextActive: {
    color: '#6366F1',
    fontWeight: '800',
  },
  listSelectionChipCount: {
    fontSize: 12,
    color: '#94A3B8',
    marginRight: 4,
  },
  listSelectionChipCountActive: {
    color: '#818CF8',
    fontWeight: '700',
  },
  noActiveListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 60,
  },
  noActiveListText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  selectListTriggerButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#6366F1',
    borderRadius: 12,
  },
  selectListTriggerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  noListsPrompt: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  noListsPromptText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
  },
  createFirstListButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  createFirstListButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteButton: {
    height: 48,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  metaInfoBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  metaInfoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});

export default ListManagementScreen;
