import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "./firebase";

export type WorkspaceRole = "owner" | "admin" | "member";
export interface WorkspaceContext { workspaceId: string; role: WorkspaceRole; }
export interface WorkspaceSummary { id: string; name: string; ownerId: string; archived?: boolean; createdAt?: unknown; updatedAt?: unknown; }
export interface Membership { workspaceId: string; userId: string; role: WorkspaceRole; createdAt?: unknown; }

export async function listUserWorkspaces(userId: string): Promise<Array<WorkspaceSummary & { role: WorkspaceRole }>> {
  if (!db) throw new Error("Firebase is not configured.");
  const memberships = await getDocs(query(collection(db, "memberships"), where("userId", "==", userId)));
  if (memberships.empty) return [];
  const results = await Promise.all(memberships.docs.map(async membershipDoc => {
    const membership = membershipDoc.data() as Membership;
    const snap = await getDoc(doc(db!, "workspaces", membership.workspaceId));
    if (!snap.exists()) return null;
    const data = snap.data() as WorkspaceSummary;
    return { ...data, id: snap.id, role: membership.role };
  }));
  return results.filter(Boolean) as Array<WorkspaceSummary & { role: WorkspaceRole }>;
}

export async function createWorkspace(userId: string, name: string): Promise<WorkspaceContext> {
  if (!db) throw new Error("Firebase is not configured.");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("اسم الـSpace مطلوب.");
  const workspaceRef = await addDoc(collection(db, "workspaces"), {
    name: trimmed, ownerId: userId, archived: false, defaultCurrency: "TRY",
    merchantArchiveDays: 90,
    paymentMethods: [{ id: "cash", name: "Cash", active: true }],
    workerPermissions: { editDeleteTransactions: true, manageMaterials: true, manageReferencePrices: true, managePaymentMethods: true, manageMerchants: true },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "memberships", workspaceRef.id + "_" + userId), { workspaceId: workspaceRef.id, userId, role: "owner", createdAt: serverTimestamp() });
  return { workspaceId: workspaceRef.id, role: "owner" };
}

export async function getOrCreateWorkspace(userId: string, displayName?: string): Promise<WorkspaceContext> {
  const spaces = await listUserWorkspaces(userId);
  if (spaces.length) return { workspaceId: spaces[0].id, role: spaces[0].role };
  return createWorkspace(userId, displayName?.trim() ? displayName.trim() + " — حسابات التجار" : "حسابات التجار");
}

export async function updateWorkspaceSettings(workspaceId: string, patch: Record<string, unknown>) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "workspaces", workspaceId), { ...patch, updatedAt: serverTimestamp() });
}
export async function transferOwnership(workspaceId: string, currentOwnerId: string, newOwnerMembershipId: string, newOwnerUserId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);
  batch.update(doc(db, "workspaces", workspaceId), { ownerId: newOwnerUserId, updatedAt: serverTimestamp() });
  batch.update(doc(db, "memberships", workspaceId + "_" + currentOwnerId), { role: "admin" });
  batch.update(doc(db, "memberships", newOwnerMembershipId), { role: "owner" });
  await batch.commit();
}

export async function setDeputy(workspaceId: string, deputyUserId: string | null) {
  if (!db) throw new Error("Firebase is not configured.");
  const workspaceRef = doc(db, "workspaces", workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);
  if (!workspaceSnap.exists()) throw new Error("Space not found.");
  if (deputyUserId) {
    const membershipSnap = await getDoc(doc(db, "memberships", workspaceId + "_" + deputyUserId));
    if (!membershipSnap.exists()) throw new Error("Deputy must be an existing member.");
    const role = (membershipSnap.data() as { role?: string }).role;
    if (role === "owner") throw new Error("Owner cannot be deputy.");
  }
  await updateDoc(workspaceRef, { deputyId: deputyUserId, updatedAt: serverTimestamp() });
}

export async function archiveWorkspace(workspaceId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "workspaces", workspaceId), {
    archived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreWorkspace(workspaceId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "workspaces", workspaceId), {
    archived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function leaveWorkspace(workspaceId: string, userId: string, role: WorkspaceRole) {
  if (!db) throw new Error("Firebase is not configured.");
  if (role === "owner") throw new Error("Owner must transfer ownership before leaving.");
  const membershipRef = doc(db, "memberships", workspaceId + "_" + userId);
  const membershipSnap = await getDoc(membershipRef);
  if (!membershipSnap.exists()) throw new Error("Membership not found.");
  await deleteDoc(membershipRef);
}
