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
  const q = query(
    merchantsCollection(workspaceId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Merchant)));
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
