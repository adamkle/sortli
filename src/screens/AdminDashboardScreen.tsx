import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

interface PromoCodeData {
  id: string;
  code: string;
  createdBy: string;
  createdAt: any;
  usageCount: number;
  usedBy: string[];
}

interface AdminDashboardScreenProps {
  onBack: () => void;
}

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onBack }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Real-time subscription to promo codes
  useEffect(() => {
    const q = query(collection(db, 'promoCodes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const codes: PromoCodeData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        codes.push({
          id: doc.id,
          code: data.code || doc.id,
          createdBy: data.createdBy || '',
          createdAt: data.createdAt,
          usageCount: data.usageCount || 0,
          usedBy: data.usedBy || [],
        });
      });
      setPromoCodes(codes);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching promo codes:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreatePromoCode = async () => {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      Alert.alert("שגיאה", "אנא הזן קוד קופון.");
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'promoCodes', trimmedCode);
      
      // Save promo code doc
      await setDoc(docRef, {
        code: trimmedCode,
        createdBy: null,
        createdAt: serverTimestamp(),
        usageCount: 0,
        usedBy: [],
      });

      Alert.alert("הצלחה", `קוד ההטבה "${trimmedCode}" נוצר בהצלחה!`);
      setCode('');
    } catch (error: any) {
      console.error("Failed to create promo code:", error);
      Alert.alert("שגיאה", "שגיאה במהלך יצירת הקוד: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePromoCode = (codeId: string) => {
    Alert.alert(
      "מחיקת קוד הטבה",
      `האם אתה בטוח שברצונך למחוק את קוד ההטבה "${codeId}"?`,
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'promoCodes', codeId));
            } catch (error: any) {
              console.error("Failed to delete promo code:", error);
              Alert.alert("שגיאה", "שגיאה במחיקת הקוד: " + error.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>לוח בקרה מנהל (Admin)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Creation Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>יצירת קוד הטבה חדש 🎁</Text>
          
          <Text style={styles.label}>קוד הקופון (למשל NoaK83):</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="הזן קוד..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.createButton, isSubmitting && styles.disabledButton]}
            onPress={handleCreatePromoCode}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.createButtonText}>צור קוד הטבה ✨</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Promo Codes List Section */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>קודים קיימים במערכת ({promoCodes.length})</Text>
          
          {isLoading ? (
            <ActivityIndicator color="#6366F1" size="large" style={{ marginTop: 20 }} />
          ) : promoCodes.length === 0 ? (
            <Text style={styles.noCodesText}>אין קודים פעילים כרגע.</Text>
          ) : (
            promoCodes.map((item) => (
              <View key={item.id} style={styles.codeItemCard}>
                <View style={styles.codeItemHeader}>
                  <View>
                    <Text style={styles.codeText}>{item.code}</Text>
                    <Text style={styles.createdByText}>
                      {item.createdBy ? `הופעל על ידי: ${item.createdBy}` : 'טרם הופעל (לא מקושר)'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeletePromoCode(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.codeItemDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>כמות שימושים:</Text>
                    <Text style={styles.detailValue}>{item.usageCount}</Text>
                  </View>
                  
                  {item.usedBy.length > 0 && (
                    <View style={styles.usedByContainer}>
                      <Text style={styles.detailLabel}>הופעל על ידי UIDs:</Text>
                      {item.usedBy.map((uid, idx) => (
                        <Text key={idx} style={styles.uidText}>• {uid}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  container: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'right',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
    textAlign: 'right',
  },
  createButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  listContainer: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'right',
  },
  noCodesText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
    marginTop: 20,
  },
  codeItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  codeItemHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6366F1',
    textAlign: 'right',
  },
  createdByText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'right',
  },
  codeItemDetails: {
    alignItems: 'stretch',
  },
  detailRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'right',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  usedByContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  uidText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'right',
    marginTop: 2,
  },
});

export default AdminDashboardScreen;
