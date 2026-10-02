import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
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

  // Mobile browsers commonly block or interrupt popup-based OAuth.
  // Use the full-page redirect flow on mobile; keep the popup flow on desktop.
  const isMobile =
    typeof window !== "undefined" &&
    (window.matchMedia("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  if (isMobile) {
    await signInWithRedirect(auth, googleProvider);
  } else {
    await signInWithPopup(auth, googleProvider);
  }
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}
