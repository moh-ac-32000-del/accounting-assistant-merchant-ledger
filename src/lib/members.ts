import { collection, doc, getDocs, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { WorkspaceRole } from "./workspaces";

export interface SpaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt?: unknown;
}

export async function listMembers(workspaceId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const snap = await getDocs(query(collection(db, "memberships"), where("workspaceId", "==", workspaceId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SpaceMember));
}

export async function changeMemberRole(membershipId: string, role: "admin" | "member") {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "memberships", membershipId), { role });
}

export async function removeMember(membershipId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, "memberships", membershipId));
}
