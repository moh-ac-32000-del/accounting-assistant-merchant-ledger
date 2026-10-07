import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import type { Currency, Material } from "./types";

const materialsCollection = (workspaceId: string) => collection(db!, "workspaces", workspaceId, "materials");

export function subscribeToMaterials(workspaceId: string, callback: (items: Material[]) => void): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(query(materialsCollection(workspaceId), orderBy("name", "asc")), snap =>
    callback(snap.docs.map(item => ({ id: item.id, ...item.data() } as Material))),
  );
}

export async function createMaterial(workspaceId: string, input: { name: string; defaultPrice: number; currency: Currency; aliases?: string[] }) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!input.name.trim() || input.defaultPrice < 0) throw new Error("بيانات المادة غير صالحة.");
  return addDoc(materialsCollection(workspaceId), {
    workspaceId, name: input.name.trim(), aliases: input.aliases ?? [],
    defaultPrice: input.defaultPrice, currency: input.currency, active: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function archiveMaterial(workspaceId: string, materialId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "workspaces", workspaceId, "materials", materialId), {
    active: false, updatedAt: serverTimestamp(),
  });
}

export async function updateMaterial(workspaceId: string, materialId: string, patch: { name?: string; defaultPrice?: number; currency?: Currency }) {
  if (!db) throw new Error("Firebase is not configured.");
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Material name is required.");
    data.name = name;
  }
  if (patch.defaultPrice !== undefined) {
    if (!Number.isFinite(patch.defaultPrice) || patch.defaultPrice < 0) throw new Error("Invalid material price.");
    data.defaultPrice = patch.defaultPrice;
  }
  if (patch.currency !== undefined) data.currency = patch.currency;
  await updateDoc(doc(db, "workspaces", workspaceId, "materials", materialId), data);
}
