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

export interface Material {\n  id: string;\n  workspaceId: string;\n  name: string;\n  aliases: string[];\n  defaultPrice: number;\n  currency: Currency;\n  active: boolean;\n  createdAt: unknown;\n  updatedAt: unknown;\n}\n\nexport interface Transaction {
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
}
