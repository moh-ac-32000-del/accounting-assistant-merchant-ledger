import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
  writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Currency, Merchant } from "./types";

const merchantsCollection = (workspaceId: string) =>
  collection(db!, "workspaces", workspaceId, "merchants");

function subscribeByStatus(
  workspaceId: string,
  status: Merchant["status"],
  callback: (merchants: Merchant[]) => void,
): Unsubscribe {
  if (!db) return () => undefined;
  const q = query(merchantsCollection(workspaceId), where("status", "==", status));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Merchant));
    items.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    callback(items);
  });
}

export function subscribeToMerchants(
  workspaceId: string,
  callback: (merchants: Merchant[]) => void,
): Unsubscribe {
  return subscribeByStatus(workspaceId, "active", callback);
}

export function subscribeToArchivedMerchants(
  workspaceId: string,
  callback: (merchants: Merchant[]) => void,
): Unsubscribe {
  return subscribeByStatus(workspaceId, "archived", callback);
}

export async function createMerchant(
  workspaceId: string,
  userId: string,
  name: string,
  currency: Currency,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("بيانات التاجر غير صالحة.");

  const batch = writeBatch(db);
  const ref = doc(merchantsCollection(workspaceId));
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));

  batch.set(ref, {
    workspaceId,
    name: trimmed,
    defaultCurrency: currency,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId: ref.id,
    actorId: userId,
    action: "created",
    summary: "إضافة تاجر",
    before: null,
    after: { name: trimmed, defaultCurrency: currency, status: "active" },
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return ref;
}

export async function archiveMerchant(workspaceId: string, merchantId: string, userId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const merchantRef = doc(db, "workspaces", workspaceId, "merchants", merchantId);
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));
  const batch = writeBatch(db);

  batch.update(merchantRef, {
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId,
    actorId: userId,
    action: "archived",
    summary: "أرشفة التاجر",
    before: { status: "active" },
    after: { status: "archived" },
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function restoreMerchant(workspaceId: string, merchantId: string, userId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const merchantRef = doc(db, "workspaces", workspaceId, "merchants", merchantId);
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));
  const batch = writeBatch(db);

  batch.update(merchantRef, {
    status: "active",
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId,
    actorId: userId,
    action: "restored",
    summary: "استعادة التاجر",
    before: { status: "archived" },
    after: { status: "active" },
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}
