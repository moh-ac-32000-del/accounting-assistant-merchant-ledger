import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp,
  setDoc, where,
} from "firebase/firestore";
import { db } from "./firebase";

export interface WorkspaceContext {
  workspaceId: string;
  role: "owner" | "admin" | "member";
}

export async function getOrCreateWorkspace(userId: string, displayName?: string): Promise<WorkspaceContext> {
  if (!db) throw new Error("Firebase is not configured.");

  const memberships = await getDocs(query(
    collection(db, "memberships"),
    where("userId", "==", userId),
    limit(1),
  ));

  if (!memberships.empty) {
    const membership = memberships.docs[0].data() as { workspaceId: string; role?: WorkspaceContext["role"] };
    return { workspaceId: membership.workspaceId, role: membership.role ?? "member" };
  }

  const workspaceRef = await addDoc(collection(db, "workspaces"), {
    name: displayName?.trim() ? `${displayName.trim()} — حسابات التجار` : "حسابات التجار",
    ownerId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "memberships", `${workspaceRef.id}_${userId}`), {
    workspaceId: workspaceRef.id,
    userId,
    role: "owner",
    createdAt: serverTimestamp(),
  });

  return { workspaceId: workspaceRef.id, role: "owner" };
}
