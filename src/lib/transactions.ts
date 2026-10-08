import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
  writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AuditEvent, Currency, Transaction } from "./types";

const transactionsCollection = (workspaceId: string, merchantId: string) =>
  collection(db!, "workspaces", workspaceId, "merchants", merchantId, "transactions");

const auditCollection = (workspaceId: string) =>
  collection(db!, "workspaces", workspaceId, "auditEvents");

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

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validCurrency(value: unknown): value is Currency {
  return value === "TRY" || value === "USD";
}

function requireOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("لا يمكن تسجيل البيانات المالية دون اتصال بالإنترنت.");
  }
}

function sortNewestFirst(items: Transaction[]) {
  items.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare) return dateCompare;
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });
  return items;
}

export function subscribeToTransactions(
  workspaceId: string,
  merchantId: string,
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  if (!db) return () => undefined;
  const q = query(transactionsCollection(workspaceId, merchantId), orderBy("date", "desc"));
  return onSnapshot(q, snapshot => {
    const items = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() } as Transaction))
      .filter(item => item.deleted !== true);
    callback(sortNewestFirst(items));
  });
}

export function subscribeToAuditEvents(
  workspaceId: string,
  merchantId: string,
  callback: (events: AuditEvent[]) => void,
): Unsubscribe {
  if (!db) return () => undefined;
  const q = query(auditCollection(workspaceId));
  return onSnapshot(q, snapshot => {
    const events = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() } as AuditEvent))
      .filter(item => item.merchantId === merchantId);
    events.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    callback(events);
  });
}

export async function createPurchase(
  workspaceId: string,
  merchantId: string,
  userId: string,
  input: PurchaseInput,
) {
  requireOnline();
  if (!db) throw new Error("Firebase is not configured.");
  if (
    !input.materialNameSnapshot.trim() ||
    !validDate(input.date) ||
    !validCurrency(input.currency) ||
    !Number.isFinite(input.quantity) || input.quantity <= 0 ||
    !Number.isFinite(input.unitPrice) || input.unitPrice < 0
  ) {
    throw new Error("بيانات الشراء غير صالحة.");
  }

  const total = input.quantity * input.unitPrice;
  const batch = writeBatch(db);
  const ref = doc(transactionsCollection(workspaceId, merchantId));
  const auditRef = doc(auditCollection(workspaceId));
  const merchantRef = doc(db, "workspaces", workspaceId, "merchants", merchantId);
  const merchantSnap = await getDoc(merchantRef);
  if (!merchantSnap.exists()) throw new Error("التاجر غير موجود.");
  const merchantData = merchantSnap.data() as { status?: string };
  if (merchantData.status === "archived") {
    batch.update(merchantRef, { status: "active", archivedAt: null, updatedAt: serverTimestamp() });
    batch.set(doc(auditCollection(workspaceId)), {
      workspaceId,
      merchantId,
      actorId: userId,
      action: "restored",
      summary: "إعادة تفعيل التاجر تلقائياً بعد تسجيل عملية جديدة",
      before: { status: "archived" },
      after: { status: "active", reason: "new_transaction" },
      createdAt: serverTimestamp(),
    });
  }

  batch.set(ref, {
    workspaceId,
    merchantId,
    type: "purchase",
    ...input,
    materialNameSnapshot: input.materialNameSnapshot.trim(),
    total,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId,
    transactionId: ref.id,
    actorId: userId,
    action: "created",
    summary: "إضافة شراء",
    before: null,
    after: { ...input, total },
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return ref;
}

export async function createPayment(
  workspaceId: string,
  merchantId: string,
  userId: string,
  input: PaymentInput,
) {
  requireOnline();
  if (!db) throw new Error("Firebase is not configured.");
  if (
    !input.paymentMethod.trim() ||
    !validDate(input.date) ||
    !validCurrency(input.currency) ||
    !Number.isFinite(input.amount) || input.amount <= 0
  ) {
    throw new Error("بيانات الدفع غير صالحة.");
  }

  const batch = writeBatch(db);
  const ref = doc(transactionsCollection(workspaceId, merchantId));
  const auditRef = doc(auditCollection(workspaceId));
  const merchantRef = doc(db, "workspaces", workspaceId, "merchants", merchantId);
  const merchantSnap = await getDoc(merchantRef);
  if (!merchantSnap.exists()) throw new Error("التاجر غير موجود.");
  const merchantData = merchantSnap.data() as { status?: string };
  if (merchantData.status === "archived") {
    batch.update(merchantRef, { status: "active", archivedAt: null, updatedAt: serverTimestamp() });
    batch.set(doc(auditCollection(workspaceId)), {
      workspaceId,
      merchantId,
      actorId: userId,
      action: "restored",
      summary: "إعادة تفعيل التاجر تلقائياً بعد تسجيل عملية جديدة",
      before: { status: "archived" },
      after: { status: "active", reason: "new_transaction" },
      createdAt: serverTimestamp(),
    });
  }

  batch.set(ref, {
    workspaceId,
    merchantId,
    type: "payment",
    ...input,
    paymentMethod: input.paymentMethod.trim(),
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId,
    transactionId: ref.id,
    actorId: userId,
    action: "created",
    summary: "إضافة دفعة",
    before: null,
    after: input,
    createdAt: serverTimestamp(),
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
  requireOnline();
  if (!db) throw new Error("Firebase is not configured.");
  if (before.deleted === true) throw new Error("لا يمكن تعديل عملية محذوفة.");

  const next = { ...before, ...patch, deleted: false };
  if (!validDate(next.date) || !validCurrency(next.currency)) {
    throw new Error("التاريخ أو العملة غير صالحين.");
  }

  if (next.type === "purchase") {
    const quantity = Number(next.quantity);
    const unitPrice = Number(next.unitPrice);
    if (
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(unitPrice) || unitPrice < 0 ||
      typeof next.materialNameSnapshot !== "string" || !next.materialNameSnapshot.trim()
    ) {
      throw new Error("بيانات الشراء المعدلة غير صالحة.");
    }
    next.total = quantity * unitPrice;
  } else if (next.type === "payment") {
    const amount = Number(next.amount);
    if (
      !Number.isFinite(amount) || amount <= 0 ||
      typeof next.paymentMethod !== "string" || !next.paymentMethod.trim()
    ) {
      throw new Error("بيانات الدفعة المعدلة غير صالحة.");
    }
  } else {
    throw new Error("نوع العملية غير صالح.");
  }

  const batch = writeBatch(db);
  const transactionRef = doc(
    db, "workspaces", workspaceId, "merchants", merchantId, "transactions", transactionId,
  );
  const auditRef = doc(auditCollection(workspaceId));

  batch.update(transactionRef, {
    ...patch,
    ...(next.type === "purchase" ? { total: next.total } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
    deleted: false,
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId,
    transactionId,
    actorId: userId,
    action: "updated",
    summary: "تم تعديل العملية",
    before,
    after: next,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function deleteTransaction(
  workspaceId: string,
  merchantId: string,
  userId: string,
  transaction: Transaction,
) {
  requireOnline();
  if (!db) throw new Error("Firebase is not configured.");
  if (transaction.deleted === true) return;

  const batch = writeBatch(db);
  const transactionRef = doc(
    db, "workspaces", workspaceId, "merchants", merchantId, "transactions", transaction.id,
  );
  const auditRef = doc(auditCollection(workspaceId));

  batch.update(transactionRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  batch.set(auditRef, {
    workspaceId,
    merchantId,
    transactionId: transaction.id,
    actorId: userId,
    action: "deleted",
    summary: "حذف العملية",
    before: transaction,
    after: null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}
