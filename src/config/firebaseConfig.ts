import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyBxTg03lil_WMGDSIW9b4Z0e3iXXmReacI",
  authDomain: "randomlistapp.firebaseapp.com",
  databaseURL: "https://randomlistapp-default-rtdb.firebaseio.com",
  projectId: "randomlistapp",
  storageBucket: "randomlistapp.firebasestorage.app",
  messagingSenderId: "814149951956",
  appId: "1:814149951956:web:48883b28465eb261d8f641",
  measurementId: "G-VTNS3S4LFJ"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with standard React Native Persistence casting to bypass Expo strict type checks
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage as any)
});

const db = getFirestore(app);
const functions = getFunctions(app);

if (__DEV__) {
  let localIp = '192.168.68.62'; // Fallback PC IP
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const matches = scriptURL.match(/^https?:\/\/([^:/]+)(:\d+)?/);
      if (matches && matches[1]) {
        localIp = matches[1];
      }
    }
  } catch (e) {
    console.log('Error resolving debug host IP:', e);
  }
  
  console.log(`Firebase Functions routing to local emulator at ${localIp}:5001`);
  connectFunctionsEmulator(functions, localIp, 5001);
} else {
  console.log("Firebase Functions routing to Production");
}

export { app, auth, db, functions };