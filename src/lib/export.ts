import * as XLSX from "xlsx";
import type { Currency, Merchant, Transaction } from "./types";

export function exportMerchantStatement(
  merchant: Merchant,
  transactions: Transaction[],
  labels: {
    date: string;
    type: string;
    material: string;
    quantity: string;
    unitPrice: string;
    amount: string;
    currency: string;
    note: string;
    purchase: string;
    payment: string;
    summary: string;
    balance: string;
    purchases: string;
    payments: string;
  },
) {
  const rows = transactions.map(transaction => ({
    [labels.date]: transaction.date,
    [labels.type]: transaction.type === "purchase" ? labels.purchase : labels.payment,
    [labels.material]: transaction.type === "purchase"
      ? transaction.materialNameSnapshot ?? ""
      : transaction.paymentMethod ?? "",
    [labels.quantity]: transaction.type === "purchase" ? transaction.quantity ?? "" : "",
    [labels.unitPrice]: transaction.type === "purchase" ? transaction.unitPrice ?? "" : "",
    [labels.amount]: transaction.type === "purchase" ? transaction.total ?? 0 : transaction.amount ?? 0,
    [labels.currency]: transaction.currency,
    [labels.note]: transaction.note ?? "",
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Transactions");

  const balances = (["TRY", "USD"] as Currency[]).map(currency => {
    const purchases = transactions
      .filter(t => t.currency === currency && t.type === "purchase")
      .reduce((sum, t) => sum + (t.total ?? 0), 0);
    const payments = transactions
      .filter(t => t.currency === currency && t.type === "payment")
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return [currency, purchases, payments, purchases - payments];
  });

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Merchant", merchant.name],
    [],
    [labels.currency, labels.purchases, labels.payments, labels.balance],
    ...balances,
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, labels.summary.slice(0, 31));

  const safeName = merchant.name.replace(/[^a-zA-Z0-9\u00C0-\uFFFF]+/g, "_").slice(0, 80) || "merchant";
  XLSX.writeFile(workbook, safeName + "_statement.xlsx");
}
