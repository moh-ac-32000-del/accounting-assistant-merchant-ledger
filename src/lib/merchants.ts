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

import { getDocs } from "firebase/firestore";

export async function autoArchiveInactiveMerchants(workspaceId: string, merchants: Merchant[], inactiveDays: number, actorId: string) {
  if (!db || inactiveDays <= 0) return;
  const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
  for (const merchant of merchants) {
    if (merchant.status !== "active") continue;
    const snap = await getDocs(collection(db, "workspaces", workspaceId, "merchants", merchant.id, "transactions"));
    let tryBalance = 0;
    let usdBalance = 0;
    let latest = merchant.createdAt;
    for (const d of snap.docs) {
      const t = d.data() as { type?: string; currency?: string; total?: number; amount?: number; date?: string; createdAt?: unknown; deleted?: boolean };
      if (t.deleted) continue;
      const value = Number(t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0);
      if (t.currency === "TRY") tryBalance += t.type === "purchase" ? value : -value;
      if (t.currency === "USD") usdBalance += t.type === "purchase" ? value : -value;
      if (String(t.date ?? "") > String(latest ?? "")) latest = t.date;
    }
    const latestMs = typeof latest === "string" && /^\d{4}-\d{2}-\d{2}$/.test(latest) ? new Date(latest + "T23:59:59").getTime() : 0;
    if (tryBalance === 0 && usdBalance === 0 && latestMs > 0 && latestMs < cutoff) {
      await archiveMerchant(workspaceId, merchant.id, actorId);
    }
  }
}
