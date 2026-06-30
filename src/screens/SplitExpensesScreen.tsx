import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { SharedList, UserTier } from '../types';

interface SplitExpensesScreenProps {
  activeList: SharedList | null;
  onBack: () => void;
  onUpdateExpenses: (payments: Record<string, number>, excludedParticipantIds: string[]) => Promise<void>;
  userTier: UserTier;
}

interface Transaction {
  from: string;
  to: string;
  amount: number;
}

const evaluateExpression = (input: string): number => {
  if (!input) return 0;
  // Clean up input: keep digits, '+', and dots (for decimals). Remove spaces and other characters.
  const cleaned = input.replace(/[^0-9+.]/g, '');
  // Split by '+'
  const parts = cleaned.split('+');
  // Sum up all valid numbers
  const sum = parts.reduce((acc, part) => {
    const num = parseFloat(part);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
  return sum;
};

export default function SplitExpensesScreen({
  activeList,
  onBack,
  onUpdateExpenses,
  userTier
}: SplitExpensesScreenProps) {
  const [payments, setPayments] = useState<Record<string, number>>(() => {
    return activeList?.expensesState?.payments || {};
  });
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [excludedParticipantIds, setExcludedParticipantIds] = useState<string[]>(() => {
    return activeList?.expensesState?.excludedParticipantIds || [];
  });
  const [amountText, setAmountText] = useState('');
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Load initial expenses state when activeList changes
  useEffect(() => {
    if (activeList?.expensesState) {
      setPayments(activeList.expensesState.payments || {});
      setExcludedParticipantIds(activeList.expensesState.excludedParticipantIds || []);
    } else {
      setPayments({});
      setExcludedParticipantIds([]);
    }
  }, [activeList?.id]);

  // Extract participants from the active list
  const listParticipants = useMemo(() => {
    if (!activeList || !activeList.participants) return [];
    return activeList.participants.map(p => {
      const fullName = `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}${p.nickname ? ` (${p.nickname})` : ''}`;
      return {
        id: p.id,
        name: fullName
      };
    });
  }, [activeList]);

  // Filter out excluded participants for the dropdown options
  const activeParticipants = useMemo(() => {
    return listParticipants.filter(p => !excludedParticipantIds.includes(p.id));
  }, [listParticipants, excludedParticipantIds]);

  // Filter active participants in dropdown by search query
  const filteredParticipants = useMemo(() => {
    return activeParticipants.filter(p => 
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [activeParticipants, searchQuery]);

  // Reset input amount field whenever selected participant changes
  useEffect(() => {
    setAmountText('');
  }, [selectedParticipantId]);

  // Toggle participant exclusion from calculation
  const toggleParticipantInclusion = async (id: string) => {
    const isExcluded = excludedParticipantIds.includes(id);
    let newExcluded: string[];
    let newPayments = { ...payments };

    if (isExcluded) {
      // Include back
      newExcluded = excludedParticipantIds.filter(item => item !== id);
    } else {
      // Exclude and clear their payment
      newExcluded = [...excludedParticipantIds, id];
      delete newPayments[id];
      setPayments(newPayments);
      
      // If they were currently selected in dropdown, deselect them
      if (selectedParticipantId === id) {
        setSelectedParticipantId(null);
        setAmountText('');
      }
    }

    setExcludedParticipantIds(newExcluded);
    setShowCalculation(false);
    await onUpdateExpenses(newPayments, newExcluded);
  };

  // Handle adding payment amount
  const handleAddPayment = async () => {
    if (!selectedParticipantId) return;
    
    const amount = evaluateExpression(amountText);
    if (amount <= 0) {
      Alert.alert('שגיאה', 'נא להזין סכום תקין הגדול מ-0.');
      return;
    }

    const currentAmount = payments[selectedParticipantId] || 0;
    const newPayments = {
      ...payments,
      [selectedParticipantId]: currentAmount + amount
    };

    setPayments(newPayments);
    setAmountText('');
    setShowCalculation(false);
    Keyboard.dismiss();

    await onUpdateExpenses(newPayments, excludedParticipantIds);
  };

  // Handle subtracting payment amount
  const handleSubtractPayment = async () => {
    if (!selectedParticipantId) return;
    
    const amount = evaluateExpression(amountText);
    if (amount <= 0) {
      Alert.alert('שגיאה', 'נא להזין סכום תקין הגדול מ-0.');
      return;
    }

    const currentAmount = payments[selectedParticipantId] || 0;
    const newAmount = Math.max(0, currentAmount - amount);
    
    const newPayments = { ...payments };
    if (newAmount === 0) {
      delete newPayments[selectedParticipantId];
    } else {
      newPayments[selectedParticipantId] = newAmount;
    }

    setPayments(newPayments);
    setAmountText('');
    setShowCalculation(false);
    Keyboard.dismiss();

    await onUpdateExpenses(newPayments, excludedParticipantIds);
  };

  // Remove payment for a participant
  const handleRemovePayment = async (id: string) => {
    const newPayments = { ...payments };
    delete newPayments[id];

    setPayments(newPayments);
    setShowCalculation(false);

    await onUpdateExpenses(newPayments, excludedParticipantIds);
  };

  // Reset all payments to 0 and clear inputs
  const handleResetExpenses = () => {
    Alert.alert(
      'איפוס סכומים',
      'האם אתה בטוח שברצונך לאפס את כל הסכומים שהוזנו ולהתחיל סבב חדש?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס סכומים',
          style: 'destructive',
          onPress: async () => {
            setPayments({});
            setAmountText('');
            setSelectedParticipantId(null);
            setShowCalculation(false);
            await onUpdateExpenses({}, excludedParticipantIds);
          }
        }
      ],
      { cancelable: true }
    );
  };

  // Map entered expenses for active participants
  const enteredExpenses = useMemo(() => {
    return activeParticipants
      .map(p => ({
        ...p,
        amount: payments[p.id] || 0
      }))
      .filter(p => p.amount > 0);
  }, [activeParticipants, payments]);

  // Calculations
  const calculations = useMemo(() => {
    const total = activeParticipants.reduce((sum, p) => sum + (payments[p.id] || 0), 0);
    const count = activeParticipants.length;
    const average = count > 0 ? total / count : 0;

    // Calculate balances (paid - average)
    const activeBalances = activeParticipants.map(p => ({
      name: p.name,
      balance: (payments[p.id] || 0) - average
    }));

    const transactions: Transaction[] = [];

    // Run max 100 times to prevent infinite loops from float rounding issues
    for (let iter = 0; iter < 100; iter++) {
      // 1. Look for an exact match first
      let exactDebtorIdx = -1;
      let exactCreditorIdx = -1;

      for (let i = 0; i < activeBalances.length; i++) {
        const dBal = activeBalances[i].balance;
        if (dBal < -0.01) {
          for (let j = 0; j < activeBalances.length; j++) {
            const cBal = activeBalances[j].balance;
            if (cBal > 0.01 && Math.abs(Math.abs(dBal) - cBal) < 0.05) {
              exactDebtorIdx = i;
              exactCreditorIdx = j;
              break;
            }
          }
        }
        if (exactDebtorIdx !== -1) break;
      }

      let debtorIdx = -1;
      let creditorIdx = -1;

      if (exactDebtorIdx !== -1 && exactCreditorIdx !== -1) {
        debtorIdx = exactDebtorIdx;
        creditorIdx = exactCreditorIdx;
      } else {
        // 2. Fall back to largest debtor/creditor (Greedy Max-Min)
        let minVal = 0;
        let maxVal = 0;

        for (let i = 0; i < activeBalances.length; i++) {
          const bal = activeBalances[i].balance;
          if (bal < -0.01 && (debtorIdx === -1 || bal < minVal)) {
            debtorIdx = i;
            minVal = bal;
          }
          if (bal > 0.01 && (creditorIdx === -1 || bal > maxVal)) {
            creditorIdx = i;
            maxVal = bal;
          }
        }
      }

      if (debtorIdx === -1 || creditorIdx === -1) {
        break;
      }

      const debtor = activeBalances[debtorIdx];
      const creditor = activeBalances[creditorIdx];

      const debtAmount = -debtor.balance;
      const creditAmount = creditor.balance;
      const transferAmount = Math.min(debtAmount, creditAmount);

      transactions.push({
        from: debtor.name,
        to: creditor.name,
        amount: Number(transferAmount.toFixed(2))
      });

      debtor.balance += transferAmount;
      creditor.balance -= transferAmount;
    }

    return {
      total,
      average,
      transactions
    };
  }, [activeParticipants, payments]);

  // Share results
  const handleShare = async () => {
    if (activeParticipants.length === 0) return;
    
    let shareText = `💰 *חלוקה הוגנת - תשלום שווה של Sortli 🎯*\n`;
    shareText += `📊 *סה"כ הוצאות:* ₪${calculations.total.toFixed(2)}\n`;
    shareText += `👥 *משתתפים בתשלום:* ${activeParticipants.length}\n`;
    shareText += `👤 *חלקו של כל משתתף:* ₪${calculations.average.toFixed(2)}\n\n`;

    if (calculations.transactions.length === 0) {
      shareText += `🎉 כולם מאוזנים! אין צורך בהעברת כספים.`;
    } else {
      shareText += `*הסדרי תשלום מומלצים (מינימום העברות):*\n`;
      calculations.transactions.forEach((tx) => {
        shareText += `👈 *${tx.from}* מעביר/ה *₪${tx.amount.toFixed(2)}* אל *${tx.to}*\n`;
      });
    }

    shareText += `\nנוצר באמצעות אפליקציית Sortli 🔄`;

    try {
      await Share.share({
        message: shareText,
      });
    } catch (error) {
      console.error('Error sharing:', error);
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
          תשלום שווה
        </Text>
        <TouchableOpacity onPress={() => setIsHelpModalOpen(true)} style={styles.backButton}>
          <NavigationIcon name="help-circle-outline" size={26} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {listParticipants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <NavigationIcon name="people-outline" size={64} color="#94A3B8" />
              <Text style={styles.emptyText}>אין חברים ברשימה</Text>
              <Text style={styles.emptySubtext}>יש להוסיף חברים ברשימה דרך מסך ניהול רשימה.</Text>
            </View>
          ) : (
            <>
              {/* Dropdown Selector Card */}
              {!showCalculation && (
                <View style={styles.card}>
                  <TouchableOpacity 
                    style={styles.participantHeaderTrigger}
                    onPress={() => {
                      setSearchQuery('');
                      setShowParticipantsModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.participantHeaderText}>
                      עריכת משתתפים
                    </Text>
                    <Text style={styles.participantHeaderCount}>
                      ({activeParticipants.length}/{listParticipants.length})
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.cardTitle}>בחר משתתף להזנת תשלום</Text>
                  
                  <TouchableOpacity 
                    style={styles.dropdownTrigger}
                    onPress={() => {
                      setSearchQuery('');
                      setShowDropdownModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dropdownTriggerText, !selectedParticipantId && styles.placeholderText]}>
                      {selectedParticipantId 
                        ? listParticipants.find(p => p.id === selectedParticipantId)?.name 
                        : 'בחר חבר מהקבוצה...'}
                    </Text>
                    <NavigationIcon name="chevron-down" size={22} color="#6366F1" />
                  </TouchableOpacity>

                  {/* Amount input form when user is selected */}
                  {selectedParticipantId && (
                    <View style={styles.inputForm}>
                      <Text style={styles.inputLabel}>
                        כמה שילם {listParticipants.find(p => p.id === selectedParticipantId)?.name}?
                      </Text>

                      <View style={styles.currentAmountRow}>
                        <Text style={styles.currentAmountLabel}>סכום מצטבר נוכחי:</Text>
                        <Text style={styles.currentAmountValue}>₪{(payments[selectedParticipantId] || 0).toFixed(2)}</Text>
                      </View>
                      
                      <View style={styles.inputRow}>
                        <View style={styles.inputContainer}>
                          <Text style={styles.currencySymbol}>₪</Text>
                          <TextInput
                            style={styles.textInput}
                            keyboardType="numbers-and-punctuation"
                            value={amountText}
                            onChangeText={(text) => setAmountText(text.replace(/[^0-9.+]/g, ''))}
                            onBlur={() => {
                              const calculated = evaluateExpression(amountText);
                              setAmountText(calculated > 0 ? calculated.toString() : '');
                            }}
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            autoFocus
                            selectTextOnFocus
                          />
                        </View>
                        
                        <View style={styles.actionButtonsContainer}>
                          {(payments[selectedParticipantId] || 0) > 0 && (
                            <TouchableOpacity style={[styles.actionBtn, styles.minusBtn]} onPress={handleSubtractPayment}>
                              <Text style={styles.actionBtnText}>-</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[styles.actionBtn, styles.plusBtn]} onPress={handleAddPayment}>
                            <Text style={styles.actionBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Entered Expenses Section */}
              {!showCalculation && enteredExpenses.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>הוצאות שהוזנו בפועל</Text>
                    <TouchableOpacity onPress={handleResetExpenses} activeOpacity={0.7} style={styles.resetBtnContainer}>
                      <NavigationIcon name="refresh-outline" size={16} color="#8B5CF6" style={{ marginLeft: 4 }} />
                      <Text style={styles.resetTextLinkText}>התחל סבב חדש</Text>
                    </TouchableOpacity>
                  </View>
                  {enteredExpenses.map((exp) => (
                    <TouchableOpacity 
                      key={exp.id} 
                      style={styles.expenseRow} 
                      onPress={() => setSelectedParticipantId(exp.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.expenseName}>{exp.name}</Text>
                      <View style={styles.expenseAmountContainer}>
                        <Text style={styles.expenseAmount}>₪{exp.amount.toFixed(2)}</Text>
                        <TouchableOpacity 
                          style={styles.deleteBtn}
                          onPress={() => handleRemovePayment(exp.id)}
                        >
                          <NavigationIcon name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Show Calculations Button */}
              {!showCalculation && (
                <TouchableOpacity 
                  style={styles.calculateButton} 
                  onPress={() => {
                    if (activeParticipants.length < 2) {
                      Alert.alert('שגיאה', 'יש צורך בלפחות 2 משתתפים פעילים בחישוב כדי לבצע חלוקה.');
                      return;
                    }
                    setShowCalculation(true);
                  }}
                  activeOpacity={0.8}
                >
                  <NavigationIcon name="coins" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  <Text style={styles.calculateButtonText}>הצגת חלוקת התשלום</Text>
                </TouchableOpacity>
              )}

              {/* Result card */}
              {showCalculation && activeParticipants.length >= 2 && (
                <View style={styles.resultsCard}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={[styles.resultsTitle, { marginBottom: 0, textAlign: 'right' }]}>חלוקת התשלום 💰</Text>
                    <TouchableOpacity 
                      onPress={() => setShowCalculation(false)}
                      activeOpacity={0.7}
                      style={styles.resetBtnContainer}
                    >
                      <NavigationIcon name="create-outline" size={16} color="#8B5CF6" style={{ marginLeft: 4 }} />
                      <Text style={styles.resetTextLinkText}>ערוך תשלומים</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>סה"כ הוצאות:</Text>
                    <Text style={styles.summaryValue}>₪{calculations.total.toFixed(2)}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>חלקו של כל משתתף:</Text>
                    <Text style={styles.summaryValue}>₪{calculations.average.toFixed(2)}</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.transactionsTitle}>הסדרי תשלום מומלצים:</Text>

                  {calculations.transactions.length === 0 ? (
                    <Text style={styles.noTransactionsText}>🎉 כולם מאוזנים, אין צורך בהעברות!</Text>
                  ) : (
                    calculations.transactions.map((tx, idx) => (
                      <View key={idx} style={styles.transactionRow}>
                        <View style={styles.txParticipant}>
                          <Text style={styles.txName} numberOfLines={1}>{tx.from}</Text>
                          <Text style={styles.txAction}>מעביר/ה ל-</Text>
                        </View>
                        <View style={styles.txAmountContainer}>
                          <Text style={styles.txAmount}>₪{tx.amount.toFixed(2)}</Text>
                          <NavigationIcon name="arrow-back-outline" size={16} color="#6366F1" />
                        </View>
                        <Text style={styles.txRecipient} numberOfLines={1}>{tx.to}</Text>
                      </View>
                    ))
                  )}

                  <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <NavigationIcon name="share-social-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.shareButtonText}>שתף סיכום בוואטסאפ</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dropdown Picker Modal */}
      <Modal
        visible={showDropdownModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdownModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>בחר חבר מהרשימה</Text>
              <TouchableOpacity onPress={() => setShowDropdownModal(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input for filtering */}
            <TextInput
              style={styles.searchBar}
              placeholder="חפש שם..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {filteredParticipants.length === 0 ? (
                <Text style={styles.noResultsText}>לא נמצאו תוצאות</Text>
              ) : (
                filteredParticipants.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedParticipantId(p.id);
                      setShowDropdownModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{p.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Active Participants Modal */}
      <Modal
        visible={showParticipantsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>משתתפים בתשלום</Text>
              <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              סמן את האנשים המשתתפים בחלוקת התשלום הנוכחית. מי שלא יסומן יוסר מהחישוב.
            </Text>

            <ScrollView style={styles.modalList}>
              {listParticipants.map((p) => {
                const isIncluded = !excludedParticipantIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.checkRow}
                    activeOpacity={0.7}
                    onPress={() => toggleParticipantInclusion(p.id)}
                  >
                    <NavigationIcon
                      name={isIncluded ? "checkbox" : "square-outline"}
                      size={22}
                      color={isIncluded ? "#6366F1" : "#94A3B8"}
                      style={{ marginLeft: 12 }}
                    />
                    <Text style={[styles.checkText, !isIncluded && styles.excludedText]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowParticipantsModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmButtonText}>אישור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.helpModalTitle}>תשלום שווה 💰</Text>
              <TouchableOpacity onPress={() => setIsHelpModalOpen(false)}>
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.helpModalBody}>
              <Text style={styles.helpModalSectionTitle}>הסבר:</Text>
              <Text style={styles.helpModalText}>
                מנגנון חכם לחלוקת הוצאות קבוצתית בצורה שווה והוגנת. המערכת מחשבת את סך ההוצאות של האירוע, מוצאת כמה כל אחד צריך לשלם, ומציגה פלט מזוקק במינימום שלבים של "מי צריך להעביר למי וכמה" כדי שכולם יתאזנו לחלוטין.
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
}

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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E1B4B',
    textAlign: 'center',
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E1B4B',
    textAlign: 'right',
  },
  participantsCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  selectorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTrigger: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  dropdownTriggerText: {
    fontSize: 16,
    color: '#1E1B4B',
    fontWeight: '600',
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: 'normal',
  },
  participantHeaderTrigger: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  participantHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4F46E5',
    textAlign: 'right',
  },
  participantHeaderCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  inputForm: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
    marginLeft: 4,
  },
  textInput: {
    flex: 1,
    height: '100%',
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
    padding: 0,
  },
  saveButton: {
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginRight: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentAmountRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentAmountLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  currentAmountValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  actionButtonsContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginRight: 8,
  },
  actionBtn: {
    height: 48,
    width: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  plusBtn: {
    backgroundColor: '#10B981',
  },
  minusBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  expenseRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  expenseName: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  },
  expenseAmountContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#059669',
    marginLeft: 12,
  },
  deleteBtn: {
    padding: 6,
  },
  calculateButton: {
    height: 52,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 20,
  },
  calculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E1B4B',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  transactionsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 12,
    textAlign: 'right',
  },
  noTransactionsText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 10,
  },
  transactionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txParticipant: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  txName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  txAction: {
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 4,
  },
  txAmountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  txRecipient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E1B4B',
    flex: 0.8,
    textAlign: 'left',
  },
  shareButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366', // Green for WhatsApp
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 12,
  },
  searchBar: {
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E1B4B',
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 250,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'right',
  },
  noResultsText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
  },
  checkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
    flex: 1,
  },
  excludedText: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  modalConfirmButton: {
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
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
  resetTextLinkText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  resetBtnContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  }
});
