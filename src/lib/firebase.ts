import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase Web configuration confirmed from the Firebase Console.
// These values are public client configuration, not service-account credentials.
const firebaseConfig = {
  apiKey: AIzaSyAl3NjX9yCrjB-Jlrz8vR9uWtJG-2lbAv4
  authDomain: "assistant-merchant-ledger.firebaseapp.com",
  projectId: "assistant-merchant-ledger",
  storageBucket: "assistant-merchant-ledger.firebasestorage.app",
  messagingSenderId: "876840602957",
  appId: "1:876840602957:web:517596e65a2a0976993b84",
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const firebaseApp = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();
