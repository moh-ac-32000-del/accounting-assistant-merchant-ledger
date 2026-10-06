import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where, type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Currency, Merchant } from "./types";

const merchantsCollection = (workspaceId: string) =>
  collection(db!, "workspaces", workspaceId, "merchants");

export function subscribeToMerchants(
  workspaceId: string,
  callback: (merchants: Merchant[]) => void,
): Unsubscribe {
  if (!db) return () => undefined;
  // Keep the query single-index friendly: filter in Firestore, then sort locally.
  // This avoids requiring a composite index for status + createdAt.
  const q = query(
    merchantsCollection(workspaceId),
    where("status", "==", "active"),
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Merchant));
    items.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    callback(items);
  });
}

export async function createMerchant(
  workspaceId: string,
  name: string,
  currency: Currency,
) {
  if (!db) throw new Error("Firebase is not configured.");
  return addDoc(merchantsCollection(workspaceId), {
    workspaceId,
    name: name.trim(),
    defaultCurrency: currency,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveMerchant(workspaceId: string, merchantId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "workspaces", workspaceId, "merchants", merchantId), {
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
