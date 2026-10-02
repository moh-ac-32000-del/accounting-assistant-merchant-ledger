import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Currency, Transaction } from "./types";

const transactionsCollection = (workspaceId: string, merchantId: string) =>
  collection(db!, "workspaces", workspaceId, "merchants", merchantId, "transactions");

export interface PurchaseInput {
  date: string;
  currency: Currency;
  materialId?: string;
  materialNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

export interface PaymentInput {
  date: string;
  currency: Currency;
  paymentMethod: string;
  amount: number;
  note?: string;
}

export function subscribeToTransactions(
  workspaceId: string,
  merchantId: string,
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  if (!db) return () => undefined;
  const q = query(transactionsCollection(workspaceId, merchantId), orderBy("date", "desc"));
  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Transaction)));
  });
}

export async function createPurchase(workspaceId: string, merchantId: string, userId: string, input: PurchaseInput) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!input.materialNameSnapshot.trim() || input.quantity <= 0 || input.unitPrice < 0) {
    throw new Error("بيانات الشراء غير صالحة.");
  }

  const total = input.quantity * input.unitPrice;
  const batch = writeBatch(db);
  const ref = doc(transactionsCollection(workspaceId, merchantId));
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));

  batch.set(ref, {
    workspaceId, merchantId, type: "purchase", ...input,
    materialNameSnapshot: input.materialNameSnapshot.trim(), total,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    createdBy: userId, updatedBy: userId,
  });
  batch.set(auditRef, {
    workspaceId, merchantId, transactionId: ref.id, actorId: userId,
    action: "created", summary: "إضافة شراء", before: null,
    after: { ...input, total }, createdAt: serverTimestamp(),
  });

  await batch.commit();
  return ref;
}

export async function createPayment(workspaceId: string, merchantId: string, userId: string, input: PaymentInput) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!input.paymentMethod.trim() || input.amount <= 0) throw new Error("بيانات الدفع غير صالحة.");

  const batch = writeBatch(db);
  const ref = doc(transactionsCollection(workspaceId, merchantId));
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));

  batch.set(ref, {
    workspaceId, merchantId, type: "payment", ...input,
    paymentMethod: input.paymentMethod.trim(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    createdBy: userId, updatedBy: userId,
  });
  batch.set(auditRef, {
    workspaceId, merchantId, transactionId: ref.id, actorId: userId,
    action: "created", summary: "إضافة دفعة", before: null,
    after: input, createdAt: serverTimestamp(),
  });

  await batch.commit();
  return ref;
}

export async function updateTransaction(
  workspaceId: string,
  merchantId: string,
  userId: string,
  transactionId: string,
  before: Transaction,
  patch: Record<string, unknown>,
) {
  if (!db) throw new Error("Firebase is not configured.");

  const next = { ...before, ...patch };
  if (next.type === "purchase") {
    const quantity = Number(next.quantity);
    const unitPrice = Number(next.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("بيانات الشراء المعدلة غير صالحة.");
    }
    next.total = quantity * unitPrice;
  } else if (next.type === "payment") {
    const amount = Number(next.amount);
    if (!Number.isFinite(amount) || amount <= 0 || typeof next.paymentMethod !== "string" || !next.paymentMethod.trim()) {
      throw new Error("بيانات الدفعة المعدلة غير صالحة.");
    }
  } else {
    throw new Error("نوع العملية غير صالح.");
  }

  const batch = writeBatch(db);
  const transactionRef = doc(db, "workspaces", workspaceId, "merchants", merchantId, "transactions", transactionId);
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));

  batch.update(transactionRef, {
    ...patch,
    ...(next.type === "purchase" ? { total: next.total } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  batch.set(auditRef, {
    workspaceId, merchantId, transactionId, actorId: userId,
    action: "updated", summary: "تم تعديل العملية",
    before, after: next, createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function deleteTransaction(
  workspaceId: string,
  merchantId: string,
  userId: string,
  transaction: Transaction,
) {
  if (!db) throw new Error("Firebase is not configured.");

  const batch = writeBatch(db);
  const transactionRef = doc(db, "workspaces", workspaceId, "merchants", merchantId, "transactions", transaction.id);
  const auditRef = doc(collection(db, "workspaces", workspaceId, "auditEvents"));

  batch.delete(transactionRef);
  batch.set(auditRef, {
    workspaceId, merchantId, transactionId: transaction.id, actorId: userId,
    action: "deleted", summary: "حذف العملية",
    before: transaction, after: null, createdAt: serverTimestamp(),
  });

  await batch.commit();
}
