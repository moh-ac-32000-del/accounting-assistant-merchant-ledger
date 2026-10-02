import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // Firebase Web configuration is public client configuration.
  // Environment variables remain supported for future deployments.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyAI3Njx9yCrjB-JLrz8vR9uWtJG-2LbAV4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "assistant-merchant-ledger.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "assistant-merchant-ledger",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "assistant-merchant-ledger.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "876840602957",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:876840602957:web:517596e65a2a0976993b84",
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const firebaseApp = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();
