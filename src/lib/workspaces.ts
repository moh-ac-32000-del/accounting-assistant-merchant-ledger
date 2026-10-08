import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export type WorkspaceRole = "owner" | "admin" | "member";
export interface WorkspaceContext { workspaceId: string; role: WorkspaceRole; }
export interface WorkspaceSummary {
  id: string;
  name: string;
  ownerId: string;
  archived?: boolean;
  archivedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}
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
    name: trimmed,
    ownerId: userId,
    archived: false,
    merchantArchiveDays: 90,
    ownerInactivityDays: 0,
    ownerLastActiveAt: serverTimestamp(),
    defaultCurrency: "TRY",
    paymentMethods: [{ id: "cash", name: "Cash", active: true }],
    workerPermissions: {
      editDeleteTransactions: true,
      manageMaterials: true,
      manageReferencePrices: true,
      managePaymentMethods: true,
      manageMerchants: true,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "memberships", workspaceRef.id + "_" + userId), {
    workspaceId: workspaceRef.id,
    userId,
    role: "owner",
    createdAt: serverTimestamp(),
  });
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

export async function transferOwnership(
  workspaceId: string,
  currentOwnerId: string,
  newOwnerMembershipId: string,
  newOwnerUserId: string,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const newOwnerMembershipRef = doc(db, "memberships", newOwnerMembershipId);
  const newOwnerSnap = await getDoc(newOwnerMembershipRef);
  if (!newOwnerSnap.exists()) throw new Error("New owner must be an existing member.");
  const newOwnerData = newOwnerSnap.data() as { workspaceId?: string; userId?: string; role?: WorkspaceRole };
  if (newOwnerData.workspaceId !== workspaceId || newOwnerData.userId !== newOwnerUserId || newOwnerData.role === "owner") {
    throw new Error("Invalid ownership target.");
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "workspaces", workspaceId), { ownerId: newOwnerUserId, updatedAt: serverTimestamp() });
  batch.update(doc(db, "memberships", workspaceId + "_" + currentOwnerId), { role: "admin" });
  batch.update(newOwnerMembershipRef, { role: "owner" });
  batch.set(doc(collection(db, "workspaces", workspaceId, "auditEvents")), {
    workspaceId,
    actorId: currentOwnerId,
    action: "ownership_transferred",
    summary: "نقل ملكية المساحة",
    before: { ownerId: currentOwnerId },
    after: { ownerId: newOwnerUserId },
    createdAt: serverTimestamp(),
  });
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
  const batch = writeBatch(db);
  batch.update(workspaceRef, { deputyId: deputyUserId, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "workspaces", workspaceId, "auditEvents")), {
    workspaceId,
    actorId: (workspaceSnap.data() as { ownerId?: string }).ownerId,
    action: "deputy_changed",
    summary: "تغيير نائب المساحة",
    before: null,
    after: { deputyId: deputyUserId },
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function archiveWorkspace(workspaceId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const batch = writeBatch(db);
  batch.update(doc(db, "workspaces", workspaceId), {
    archived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "workspaces", workspaceId, "auditEvents")), {
    workspaceId,
    actorId: (await getDoc(doc(db, "workspaces", workspaceId))).data()?.ownerId,
    action: "space_archived",
    summary: "أرشفة المساحة",
    before: { archived: false },
    after: { archived: true },
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function restoreWorkspace(workspaceId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const workspaceRef = doc(db, "workspaces", workspaceId);
  const snap = await getDoc(workspaceRef);
  const batch = writeBatch(db);
  batch.update(workspaceRef, {
    archived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "workspaces", workspaceId, "auditEvents")), {
    workspaceId,
    actorId: snap.data()?.ownerId,
    action: "space_restored",
    summary: "استعادة المساحة",
    before: { archived: true },
    after: { archived: false },
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function leaveWorkspace(workspaceId: string, userId: string, role: WorkspaceRole) {
  if (!db) throw new Error("Firebase is not configured.");
  if (role === "owner") throw new Error("Owner must transfer ownership before leaving.");
  await deleteDoc(doc(db, "memberships", workspaceId + "_" + userId));
}


async function deleteInChunks(refs: Array<ReturnType<typeof doc>>) {
  if (!db || refs.length === 0) return;
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

export async function permanentlyDeleteWorkspace(workspaceId: string, ownerId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("لا يمكن حذف المساحة دون اتصال بالإنترنت.");
  }

  const workspaceRef = doc(db, "workspaces", workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);
  if (!workspaceSnap.exists()) throw new Error("Space not found.");
  const workspace = workspaceSnap.data() as { ownerId?: string; archived?: boolean };
  if (workspace.ownerId !== ownerId) throw new Error("Only the Owner can permanently delete a Space.");
  if (workspace.archived !== true) throw new Error("Archive the Space before permanent deletion.");

  await updateDoc(workspaceRef, {
    archived: true,
    deletionArmed: true,
    updatedAt: serverTimestamp(),
  });

  const membershipSnap = await getDocs(query(
    collection(db, "memberships"),
    where("workspaceId", "==", workspaceId),
  ));
  const invitationSnap = await getDocs(query(
    collection(db, "invitations"),
    where("workspaceId", "==", workspaceId),
  ));
  const materialsSnap = await getDocs(collection(db, "workspaces", workspaceId, "materials"));
  const auditSnap = await getDocs(collection(db, "workspaces", workspaceId, "auditEvents"));
  const merchantsSnap = await getDocs(collection(db, "workspaces", workspaceId, "merchants"));

  const refs: Array<ReturnType<typeof doc>> = [];
  membershipSnap.docs
    .filter(d => d.id !== workspaceId + "_" + ownerId)
    .forEach(d => refs.push(d.ref));
  invitationSnap.docs.forEach(d => refs.push(d.ref));
  materialsSnap.docs.forEach(d => refs.push(d.ref));
  auditSnap.docs.forEach(d => refs.push(d.ref));

  for (const merchant of merchantsSnap.docs) {
    const transactionsSnap = await getDocs(collection(
      db,
      "workspaces",
      workspaceId,
      "merchants",
      merchant.id,
      "transactions",
    ));
    transactionsSnap.docs.forEach(d => refs.push(d.ref));
    refs.push(merchant.ref);
  }

  await deleteInChunks(refs);

  const finalBatch = writeBatch(db);
  finalBatch.delete(doc(db, "memberships", workspaceId + "_" + ownerId));
  finalBatch.delete(workspaceRef);
  await finalBatch.commit();
}


export async function touchOwnerActivity(workspaceId: string, userId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const workspaceRef = doc(db, "workspaces", workspaceId);
  const snap = await getDoc(workspaceRef);
  if (!snap.exists() || (snap.data() as { ownerId?: string }).ownerId !== userId) return;
  await updateDoc(workspaceRef, { ownerLastActiveAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function activateDeputyOwnership(workspaceId: string, deputyUserId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const workspaceRef = doc(db, "workspaces", workspaceId);
  const snap = await getDoc(workspaceRef);
  if (!snap.exists()) throw new Error("Space not found.");
  const data = snap.data() as {
    ownerId?: string;
    deputyId?: string | null;
    ownerInactivityDays?: number;
    ownerLastActiveAt?: { toMillis?: () => number };
  };
  if (data.deputyId !== deputyUserId) throw new Error("You are not the configured deputy.");
  if (!data.ownerInactivityDays || data.ownerInactivityDays <= 0) {
    throw new Error("Emergency ownership is not configured.");
  }
  const lastActive = data.ownerLastActiveAt?.toMillis?.() ?? 0;
  if (!lastActive || Date.now() - lastActive < data.ownerInactivityDays * 24 * 60 * 60 * 1000) {
    throw new Error("Owner inactivity period has not elapsed.");
  }

  const oldOwnerId = data.ownerId;
  if (!oldOwnerId || oldOwnerId === deputyUserId) throw new Error("Invalid ownership state.");
  const deputyMembershipRef = doc(db, "memberships", workspaceId + "_" + deputyUserId);
  const oldOwnerMembershipRef = doc(db, "memberships", workspaceId + "_" + oldOwnerId);
  const batch = writeBatch(db);
  batch.update(workspaceRef, {
    ownerId: deputyUserId,
    deputyId: null,
    emergencyOwnershipActivatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(oldOwnerMembershipRef, { role: "admin" });
  batch.update(deputyMembershipRef, { role: "owner" });
  batch.set(doc(collection(db, "workspaces", workspaceId, "auditEvents")), {
    workspaceId,
    actorId: deputyUserId,
    action: "ownership_emergency_activated",
    summary: "تفعيل ملكية الطوارئ بواسطة النائب",
    before: { ownerId: oldOwnerId },
    after: { ownerId: deputyUserId },
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
