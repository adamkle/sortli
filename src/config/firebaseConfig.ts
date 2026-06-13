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

// Toggle this constant to switch between local Firebase Emulators and Live Production Firebase services.
// Set to true to use local emulators, or false to use live cloud production database & services.
const USE_EMULATORS = false;

if (__DEV__ && USE_EMULATORS) {
  let localIp = '192.168.68.65'; // Fallback PC IP (Updated to match current Wi-Fi IP)
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const matches = scriptURL.match(/^https?:\/\/([^:/]+)(:\d+)?/);
      if (matches && matches[1]) {
        const host = matches[1];
        // If the resolved host is localhost, 127.0.0.1 or IPv6 local loop, keep the fallback PC IP
        if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
          localIp = host;
        }
      }
    }
  } catch (e) {
    console.log('Error resolving debug host IP:', e);
  }
  
  console.log(`Firebase Functions routing to local emulator at ${localIp}:5001`);
  connectFunctionsEmulator(functions, localIp, 5001);

  // Startup network diagnostic check
  fetch(`http://${localIp}:5001/`).then(res => {
    console.log(`[Diagnostics] Successfully reached functions emulator at http://${localIp}:5001/ (status: ${res.status})`);
  }).catch(err => {
    console.warn(`[Diagnostics WARNING] Unable to connect to functions emulator at http://${localIp}:5001/. Error: ${err.message}.
    This means the device cannot talk to the PC over the network. Please verify:
    1. Both PC and phone are on the EXACT same Wi-Fi network.
    2. Your Wi-Fi router doesn't have "Client Isolation" enabled.
    3. Windows Firewall on the PC is allowing incoming traffic on port 5001.
       (Try opening Advanced Settings -> Inbound Rules -> New Rule -> Port 5001 -> Allow Connection)`);
  });
} else {
  console.log("Firebase Functions routing to Production");
}

export { app, auth, db, functions };