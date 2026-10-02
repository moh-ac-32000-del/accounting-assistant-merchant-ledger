import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider, firebaseConfigured } from "./firebase";

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth || !firebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured.");
  await signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}
