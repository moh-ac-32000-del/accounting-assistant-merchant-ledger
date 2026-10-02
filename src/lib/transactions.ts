import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, type Unsubscribe,
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
  const ref = await addDoc(transactionsCollection(workspaceId, merchantId), {
    workspaceId, merchantId, type: "purchase", ...input,
    materialNameSnapshot: input.materialNameSnapshot.trim(), total,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    createdBy: userId, updatedBy: userId,
  });
  await addAudit(workspaceId, merchantId, ref.id, userId, "created", "إضافة شراء", null, { ...input, total });
  return ref;
}

export async function createPayment(workspaceId: string, merchantId: string, userId: string, input: PaymentInput) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!input.paymentMethod.trim() || input.amount <= 0) throw new Error("بيانات الدفع غير صالحة.");
  const ref = await addDoc(transactionsCollection(workspaceId, merchantId), {
    workspaceId, merchantId, type: "payment", ...input,
    paymentMethod: input.paymentMethod.trim(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    createdBy: userId, updatedBy: userId,
  });
  await addAudit(workspaceId, merchantId, ref.id, userId, "created", "إضافة دفعة", null, input);
  return ref;
}

export async function updateTransaction(workspaceId: string, merchantId: string, userId: string, transactionId: string, before: Transaction, patch: Record<string, unknown>) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "workspaces", workspaceId, "merchants", merchantId, "transactions", transactionId), {
    ...patch, updatedAt: serverTimestamp(), updatedBy: userId,
  });
  await addAudit(workspaceId, merchantId, transactionId, userId, "updated", "تم تعديل العملية", before, { ...before, ...patch });
}

export async function deleteTransaction(workspaceId: string, merchantId: string, userId: string, transaction: Transaction) {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, "workspaces", workspaceId, "merchants", merchantId, "transactions", transaction.id));
  await addAudit(workspaceId, merchantId, transaction.id, userId, "deleted", "حذف العملية", transaction, null);
}

async function addAudit(
  workspaceId: string, merchantId: string, transactionId: string, actorId: string,
  action: "created" | "updated" | "deleted", summary: string, before: unknown, after: unknown,
) {
  if (!db) return;
  await addDoc(collection(db, "workspaces", workspaceId, "auditEvents"), {
    workspaceId, merchantId, transactionId, actorId, action, summary, before, after,
    createdAt: serverTimestamp(),
  });
}
