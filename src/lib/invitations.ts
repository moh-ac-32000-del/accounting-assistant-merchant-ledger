import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { WorkspaceRole } from "./workspaces";

export type InvitationRole = "admin" | "member";

export interface Invitation {
  id: string;
  workspaceId: string;
  role: InvitationRole;
  createdBy: string;
  createdAt?: unknown;
  expiresAt?: unknown;
  acceptedAt?: unknown;
  acceptedBy?: string;
  cancelledAt?: unknown;
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export async function createInvitation(workspaceId: string, userId: string, role: InvitationRole) {
  if (!db) throw new Error("Firebase is not configured.");
  const token = randomToken();
  const ref = doc(db, "invitations", token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await setDoc(ref, {
    workspaceId,
    role,
    createdBy: userId,
    createdAt: serverTimestamp(),
    expiresAt,
  });
  return token;
}

export async function getInvitation(token: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const snap = await getDoc(doc(db, "invitations", token));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invitation;
}

export async function acceptInvitation(token: string, userId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const invitationRef = doc(db, "invitations", token);
  const invitationSnap = await getDoc(invitationRef);
  if (!invitationSnap.exists()) throw new Error("Invitation not found.");
  const invitation = invitationSnap.data() as Invitation;
  if (invitation.acceptedAt || invitation.cancelledAt) throw new Error("Invitation is no longer available.");
  if (invitation.expiresAt && new Date(String(invitation.expiresAt)).getTime() < Date.now()) throw new Error("Invitation expired.");

  const membershipRef = doc(db, "memberships", invitation.workspaceId + "_" + userId);
  const batch = writeBatch(db);
  batch.set(membershipRef, {
    workspaceId: invitation.workspaceId,
    userId,
    role: invitation.role,
    invitationId: token,
    createdAt: serverTimestamp(),
  });
  batch.update(invitationRef, { acceptedAt: serverTimestamp(), acceptedBy: userId });
  await batch.commit();
  return { workspaceId: invitation.workspaceId, role: invitation.role as WorkspaceRole };
}

export async function cancelInvitation(token: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "invitations", token), { cancelledAt: serverTimestamp() });
}
