export type Currency = "TRY" | "USD";
export type MerchantStatus = "active" | "archived";
export type TransactionType = "purchase" | "payment";

export interface Merchant {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  notes?: string;
  defaultCurrency: Currency;
  status: MerchantStatus;
  createdAt: unknown;
  updatedAt: unknown;
  archivedAt?: unknown;
}

export interface Material {
  id: string;
  workspaceId: string;
  name: string;
  aliases: string[];
  defaultPrice: number;
  currency: Currency;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Transaction {
  id: string;
  workspaceId: string;
  merchantId: string;
  type: TransactionType;
  date: string;
  currency: Currency;
  note?: string;
  materialId?: string;
  materialNameSnapshot?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  paymentMethod?: string;
  amount?: number;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  updatedBy: string;
  deleted?: boolean;
  deletedAt?: unknown;
  deletedBy?: string;
}

export type AuditAction =
  | "created" | "updated" | "deleted" | "archived" | "restored"
  | "ownership_transferred" | "ownership_emergency_activated" | "deputy_changed"
  | "space_archived" | "space_restored" | "space_deleted";

export interface AuditEvent {
  id: string;
  workspaceId: string;
  merchantId?: string;
  transactionId?: string;
  actorId: string;
  action: AuditAction;
  summary: string;
  before?: unknown;
  after?: unknown;
  createdAt: unknown;
}
