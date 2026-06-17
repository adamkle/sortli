import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NavigationIcon from '../components/NavigationIcon';
import { UserTier } from '../types';
import { auth, db, functions } from '../config/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

interface AuthScreenProps {
  onBack: () => void;
  onLoginSuccess: (tier: UserTier, isSignUp?: boolean) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onBack, onLoginSuccess }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  const handleTabChange = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setResetStatusMessage('');
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Step 2 profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');

  // Email verification modal states
  const [isEmailVerificationModalOpen, setIsEmailVerificationModalOpen] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerificationError, setEmailVerificationError] = useState('');

  // Password reset inline state
  const [resetStatusMessage, setResetStatusMessage] = useState('');
  const [resetStatusColor, setResetStatusColor] = useState('#10B981');

  // Local state error variables
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [institutionCodeError, setInstitutionCodeError] = useState('');

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    let hasError = false;
    if (!trimmedEmail) {
      setEmailError('יש להזין אימייל');
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setEmailError('כתובת אימייל לא תקינה');
      hasError = true;
    } else {
      setEmailError('');
    }

    if (!trimmedPassword) {
      setPasswordError('יש להזין סיסמה');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (hasError) return;

    setIsLoading(true);
    setResetStatusMessage('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const user = userCredential.user;
      
      // Fetch user profile from Firestore users/{uid}
      let tier: UserTier = 'registered';
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          tier = userData.tier || 'registered';
        } else {
          // User logged in but profile document doesn't exist yet, go to Step 2
          setFirstName('');
          setLastName('');
          setPhone('');
          setStep(2);
          return;
        }
      } catch (fsError) {
        console.error("Firestore getDoc failed on sign in, bypassing to list page:", fsError);
      }
      
      Alert.alert('הצלחה', 'התחברת בהצלחה!', [{ text: 'אישור' }]);
      onLoginSuccess(tier);
    } catch (error: any) {
      console.error(error);
      const code = error.code;
      if (code === 'auth/invalid-email') {
        setEmailError('כתובת אימייל לא תקינה');
      } else if (code === 'auth/user-not-found' || error.message?.includes('user-not-found')) {
        setEmailError('משתמש לא קיים במערכת, אנא הירשם');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setEmailError('פרטי התחברות שגויים');
        setPasswordError('פרטי התחברות שגויים');
      } else {
        Alert.alert('שגיאה בהתחברות', error.message || 'פרטי התחברות שגויים', [{ text: 'אישור' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    let hasError = false;
    if (!trimmedEmail) {
      setEmailError('יש להזין אימייל');
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setEmailError('כתובת אימייל לא תקינה');
      hasError = true;
    } else {
      setEmailError('');
    }

    if (!trimmedPassword) {
      setPasswordError('יש להזין סיסמה');
      hasError = true;
    } else if (trimmedPassword.length < 6) {
      setPasswordError('הסיסמה חייבת להכיל 6 תווים לפחות');
      hasError = true;
    } else if (!/^[a-zA-Z0-9]+$/.test(trimmedPassword)) {
      setPasswordError('הסיסמה חייבת להכיל אותיות באנגלית ו/או מספרים בלבד');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (!trimmedConfirmPassword) {
      setConfirmPasswordError('יש להזין אימות סיסמה');
      hasError = true;
    } else if (trimmedPassword !== trimmedConfirmPassword) {
      setConfirmPasswordError('הסיסמאות אינן תואמות');
      hasError = true;
    } else {
      setConfirmPasswordError('');
    }

    if (hasError) return;

    setIsLoading(true);
    setResetStatusMessage('');
    try {
      // Call standard sendVerificationEmail HTTPS Cloud Function
      const sendEmailFn = httpsCallable(functions, 'sendVerificationEmail');
      await sendEmailFn({ email: trimmedEmail });

      // Open email verification modal
      setEmailVerificationCode('');
      setEmailVerificationError('');
      setIsEmailVerificationModalOpen(true);
    } catch (error: any) {
      const isEmailAlreadyInUse = 
        error.code === 'functions/already-exists' ||
        error.code === 'already-exists' ||
        error.message?.includes('email-already-in-use') ||
        error.message?.includes('already-exists');
      
      const isNotFoundError = 
        error.code === 'functions/not-found' ||
        error.code === 'not-found' ||
        error.message?.includes('not-found');

      if (isEmailAlreadyInUse) {
        console.error("Sign up warning (Email already in use):", error);
        setEmailError('מייל זה כבר רשום, יש להתחבר');
      } else if (isNotFoundError) {
        // IGNORE IT as an error! This is CORRECT for a new user. Proceed immediately to open the 6-digit verification code input modal.
        console.log("Not-found status ignored (correct for a new user). Displaying verification modal.");
        setEmailVerificationCode('');
        setEmailVerificationError('');
        setIsEmailVerificationModalOpen(true);
      } else {
        console.error("Sign up error:", error);
        setEmailError(error.message || 'שגיאה בשליחת קוד אימות במייל. אנא נסה שנית.');
        Alert.alert(
          'שגיאת רישום / תקשורת',
          `פרטי השגיאה: ${error.message || error.toString()}\nקוד שגיאה: ${error.code || 'לא ידוע'}\nאנא ודא חיבור לאינטרנט ונסה שוב.`,
          [{ text: 'אישור' }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setResetStatusMessage('נא להזין כתובת אימייל תקינה בשדה למעלה');
      setResetStatusColor('#EF4444');
      return;
    }

    setIsLoading(true);
    setResetStatusMessage('');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setResetStatusMessage('הוראות לאיפוס סיסמה נשלחו לתיבת המייל! 📧');
      setResetStatusColor('#10B981'); // Green
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'נכשל בשליחת אימייל לאיפוס סיסמה.';
      if (error.code === 'auth/user-not-found') {
        errorMsg = 'משתמש זה אינו קיים במערכת.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'כתובת אימייל לא תקינה.';
      }
      setResetStatusMessage(errorMsg);
      setResetStatusColor('#EF4444'); // Red
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async (
    user: any,
    trimmedFirstName: string,
    trimmedLastName: string,
    trimmedPhone: string,
    codeUpper: string
  ) => {
    setIsLoading(true);
    if (codeUpper) {
      try {
        await runTransaction(db, async (transaction) => {
          const instDocRef = doc(db, 'institutions', codeUpper);
          const instDocSnap = await transaction.get(instDocRef);
          
          if (!instDocSnap.exists()) {
            throw new Error('INST_NOT_FOUND');
          }
          
          const instData = instDocSnap.data();
          
          // Verify expiration
          const expiresAt = instData.expiresAt;
          let isExpired = false;
          if (expiresAt) {
            const expiresDate = typeof expiresAt.toDate === 'function' ? expiresAt.toDate() : new Date(expiresAt);
            if (expiresDate < new Date()) {
              isExpired = true;
            }
          }
          
          if (instData.subscriptionStatus !== 'active' || isExpired) {
            throw new Error('INST_EXPIRED');
          }
          
          // Verify limits
          const maxUsers = instData.maxUsers || 0;
          const currentUserCount = instData.currentUserCount || 0;
          if (currentUserCount >= maxUsers) {
            throw new Error('INST_LIMIT_BREACHED');
          }
          
          // Write the profile under the user's UID
          const userDocRef = doc(db, 'users', user.uid);
          const newProfile = {
            uid: user.uid,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: user.email || '',
            phone: trimmedPhone,
            tier: 'registered' as UserTier,
            institutionCodes: [codeUpper],
            createdAt: new Date(),
            listsCount: 0,
            hearts: 3,
            isPremium: false,
            premiumStartDate: null,
            premiumExpiryDate: null,
          };
          
          transaction.set(userDocRef, newProfile);
          
          // Increment currentUserCount inside the institution doc
          transaction.update(instDocRef, {
            currentUserCount: currentUserCount + 1,
            updatedAt: new Date()
          });
        });
        
        Alert.alert(
          'ברוך הבא לאפליקציית Sortli! ❤️',
          'קיבלת 3 לבבות להתחלת הפעילות במערכת.',
          [{ text: 'המשך' }]
        );
        onLoginSuccess('registered', true);
      } catch (error: any) {
        console.error("Profile creation transaction failed:", error);
        if (error.message === 'INST_NOT_FOUND') {
          setInstitutionCodeError("קוד המוסד שהוזן אינו קיים במערכת.");
        } else if (error.message === 'INST_EXPIRED') {
          setInstitutionCodeError("המנוי השנתי של מוסד זה פג. אנא פנה למנהל המערכת.");
        } else if (error.message === 'INST_LIMIT_BREACHED') {
          setInstitutionCodeError("המוסד הגיע למגבלת המשתמשים המקסימלית שלו.");
        } else {
          Alert.alert("שגיאת שמירה", error.message || error.toString());
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Default flow: No access code entered
    const newProfile = {
      uid: user.uid,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: user.email || '',
      phone: trimmedPhone,
      tier: 'registered' as UserTier,
      institutionCodes: [],
      createdAt: new Date(),
      listsCount: 0,
      hearts: 3,
      isPremium: false,
      premiumStartDate: null,
      premiumExpiryDate: null,
    };

    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      Alert.alert(
        'ברוך הבא לאפליקציית Sortli! ❤️',
        'קיבלת 3 לבבות להתחלת הפעילות במערכת.',
        [{ text: 'המשך' }]
      );
      onLoginSuccess('registered', true);
    } catch (firestoreError: any) {
      console.error("Firestore setDoc failed during profile creation:", firestoreError);
      Alert.alert("שגיאת שמירה", firestoreError.message || firestoreError.toString());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const codeUpper = institutionCode.trim().toUpperCase();

    let hasError = false;
    if (!trimmedFirstName) {
      setFirstNameError('נא למלא שם פרטי');
      hasError = true;
    } else {
      setFirstNameError('');
    }

    if (!trimmedLastName) {
      setLastNameError('נא למלא שם משפחה');
      hasError = true;
    } else {
      setLastNameError('');
    }

    if (!trimmedPhone) {
      setPhoneError('נא למלא מספר טלפון');
      hasError = true;
    } else {
      const isPhoneValid = /^\d+$/.test(trimmedPhone) && trimmedPhone.length >= 9 && trimmedPhone.length <= 10;
      if (!isPhoneValid) {
        setPhoneError('נא להזין מספר טלפון תקין (9-10 ספרות)');
        hasError = true;
      } else {
        setPhoneError('');
      }
    }

    if (hasError) return;

    setIsLoading(true);
    
    // Retrieve actual authenticated user details
    const user = auth.currentUser;
    if (!user) {
      setIsLoading(false);
      Alert.alert('שגיאה', 'משתמש לא מחובר במערכת. אנא נסה להירשם שוב.');
      return;
    }

    // Directly save profile, since email verification occurred at Step 1
    await completeRegistration(user, trimmedFirstName, trimmedLastName, trimmedPhone, codeUpper);
  };

  const handleVerifyEmailCode = async () => {
    const codeTrimmed = emailVerificationCode.trim();
    if (!codeTrimmed || codeTrimmed.length !== 6) {
      setEmailVerificationError("נא להזין קוד אימות תקין בן 6 ספרות.");
      return;
    }

    setIsLoading(true);
    try {
      const verifyFn = httpsCallable(functions, 'verifyCode');
      const response = await verifyFn({ email: email.trim(), code: codeTrimmed });
      const result = response.data as { success: boolean; message?: string };

      if (!result.success) {
        setEmailVerificationError(result.message || "קוד אימות שגוי או פג תוקף.");
        setIsLoading(false);
        return;
      }

      // Code validated! Create user inside Firebase Auth on client
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
      const user = userCredential.user;

      setIsEmailVerificationModalOpen(false);
      setStep(2);
    } catch (error: any) {
      console.error(error);
      setEmailVerificationError(error.message || "אימות הקוד נכשל.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <NavigationIcon name="arrow-forward-sharp" size={24} color="#1E1B4B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 1 ? 'התחברות / הרשמה' : 'פרטי פרופיל משתמש'}
          </Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <NavigationIcon 
                name={step === 1 ? "lock-open-outline" : "person-add-outline"} 
                size={56} 
                color="#6366F1" 
              />
              <Text style={styles.logoTitle}>
                {step === 1 ? 'שמירה בענן' : 'בוא נכיר אותך'}
              </Text>
              <Text style={styles.logoSubtitle}>
                {step === 1 
                  ? 'התחבר כדי לשמור ולסנכרן את הרשימות שלך מכל מכשיר'
                  : 'אנא מלא את פרטי הפרופיל שלך להשלמת ההרשמה'
                }
              </Text>
            </View>

            {/* Step 1: Sign In / Sign Up Form */}
            {step === 1 && (
              <View style={styles.form}>
                
                {/* Visual Tab Toggle Bar */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'login' && styles.tabButtonActive]}
                    onPress={() => handleTabChange('login')}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'login' && styles.tabButtonTextActive]}>
                      התחברות
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'signup' && styles.tabButtonActive]}
                    onPress={() => handleTabChange('signup')}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'signup' && styles.tabButtonTextActive]}>
                      הרשמה
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email Field */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>אימייל</Text>
                  <TextInput
                    style={[styles.input, emailError ? styles.inputError : null]}
                    placeholder="email@example.com"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text.trim());
                      if (emailError) setEmailError('');
                      if (resetStatusMessage) setResetStatusMessage('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  {!!emailError && <Text style={styles.errorTextInline}>{emailError}</Text>}
                </View>

                {/* Password Field */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>סיסמה</Text>
                  <TextInput
                    style={[styles.input, passwordError ? styles.inputError : null]}
                    placeholder="הזן סיסמה..."
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (passwordError) setPasswordError('');
                      if (resetStatusMessage) setResetStatusMessage('');
                    }}
                    secureTextEntry
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  {!!passwordError && <Text style={styles.errorTextInline}>{passwordError}</Text>}
                  
                  {activeTab === 'login' && (
                    <>
                      <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordContainer}>
                        <Text style={styles.forgotPasswordText}>שכחתי סיסמה?</Text>
                      </TouchableOpacity>
                      {!!resetStatusMessage && (
                        <Text style={[styles.errorTextInline, { color: resetStatusColor, textAlign: 'right', marginTop: 4 }]}>
                          {resetStatusMessage}
                        </Text>
                      )}
                    </>
                  )}
                </View>

                {/* Confirm Password Field (Only during signup) */}
                {activeTab === 'signup' && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>אימות סיסמה</Text>
                    <TextInput
                      style={[styles.input, confirmPasswordError ? styles.inputError : null]}
                      placeholder="הזן סיסמה שנית..."
                      placeholderTextColor="#94A3B8"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (confirmPasswordError) setConfirmPasswordError('');
                      }}
                      secureTextEntry
                      autoCapitalize="none"
                      textAlign="right"
                    />
                    {!!confirmPasswordError && <Text style={styles.errorTextInline}>{confirmPasswordError}</Text>}
                  </View>
                )}

                {isLoading ? (
                  <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
                ) : (
                  <View style={styles.buttonRow}>
                    {activeTab === 'login' ? (
                      <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={handleSignIn}>
                        <Text style={styles.buttonText}>התחברות</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={handleSignUp}>
                        <Text style={styles.buttonText}>הרשמה</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 2: User Profile Details Form */}
            {step === 2 && (
              <View style={styles.form}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>שם פרטי *</Text>
                  <TextInput
                    style={[styles.input, firstNameError ? styles.inputError : null]}
                    placeholder="הזן שם פרטי..."
                    placeholderTextColor="#94A3B8"
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (firstNameError) setFirstNameError('');
                    }}
                    textAlign="right"
                  />
                  {!!firstNameError && <Text style={styles.errorTextInline}>{firstNameError}</Text>}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>שם משפחה *</Text>
                  <TextInput
                    style={[styles.input, lastNameError ? styles.inputError : null]}
                    placeholder="הזן שם משפחה..."
                    placeholderTextColor="#94A3B8"
                    value={lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      if (lastNameError) setLastNameError('');
                    }}
                    textAlign="right"
                  />
                  {!!lastNameError && <Text style={styles.errorTextInline}>{lastNameError}</Text>}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>טלפון *</Text>
                  <TextInput
                    style={[styles.input, phoneError ? styles.inputError : null]}
                    placeholder="הזן מספר טלפון..."
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (phoneError) setPhoneError('');
                    }}
                    keyboardType="numeric"
                    textAlign="right"
                  />
                  {!!phoneError && <Text style={styles.errorTextInline}>{phoneError}</Text>}
                </View>



                {isLoading ? (
                  <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
                ) : (
                  <TouchableOpacity style={styles.saveProfileButton} onPress={handleSaveProfile}>
                    <Text style={styles.saveProfileButtonText}>שמור והמשך</Text>
                    <NavigationIcon name="checkmark-circle-outline" size={20} color="#FFFFFF" style={styles.saveProfileIcon} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Email Verification Modal */}
      <Modal
        visible={isEmailVerificationModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEmailVerificationModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetModalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsEmailVerificationModalOpen(false)}
              >
                <NavigationIcon name="close" size={24} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>אימות כתובת אימייל</Text>
              <View style={styles.headerPlaceholder} />
            </View>
            
            <View style={styles.resetModalForm}>
              <Text style={styles.resetModalSubtitle}>
                שלחנו קוד אימות בן 6 ספרות לכתובת {email}. אנא הזן אותו כאן:
              </Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 22, letterSpacing: 6, fontWeight: '800', textAlign: 'center' }]}
                placeholder="000000"
                placeholderTextColor="#94A3B8"
                value={emailVerificationCode}
                onChangeText={(text) => {
                  setEmailVerificationCode(text);
                  if (emailVerificationError) setEmailVerificationError('');
                }}
                keyboardType="numeric"
                maxLength={6}
              />
              
              {!!emailVerificationError && (
                <Text style={[styles.errorTextInline, { marginBottom: 12, textAlign: 'center' }]}>
                  {emailVerificationError}
                </Text>
              )}

              {isLoading ? (
                <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
              ) : (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleVerifyEmailCode}
                >
                  <Text style={styles.saveButtonText}>אמת קוד והרשם</Text>
                </TouchableOpacity>
              )}
            </View>
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
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    height: 60,
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
  content: {
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 12,
  },
  logoSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 0.48,
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextOutline: {
    color: '#6366F1',
  },
  saveProfileButton: {
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  saveProfileIcon: {
    marginRight: 6,
  },
  loader: {
    marginVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resetModalContent: {
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
  resetModalForm: {
    padding: 20,
  },
  resetModalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 20,
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
    marginBottom: 16,
  },
  saveButton: {
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorTextInline: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 4,
    paddingRight: 4,
  },
  tabContainer: {
    flexDirection: 'row-reverse',
    marginBottom: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#6366F1',
  },
});

export default AuthScreen;
