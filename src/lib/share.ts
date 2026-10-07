import type { Merchant, Transaction } from "./types";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function shareStatementImage(merchant: Merchant, transactions: Transaction[], language: "ar" | "tr" | "en") {
  const title = language === "ar" ? "كشف حساب" : language === "tr" ? "Hesap ekstresi" : "Account statement";
  const rows = transactions.slice(0, 20).map((t, i) => {
    const label = t.type === "purchase" ? (language === "ar" ? "شراء" : language === "tr" ? "Alış" : "Purchase") : (language === "ar" ? "دفعة" : language === "tr" ? "Ödeme" : "Payment");
    const value = t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0;
    return '<text x="40" y="' + (150 + i * 34) + '" font-size="20" fill="white">' + esc(t.date + " · " + label + " · " + value + " " + t.currency) + '</text>';
  }).join("");
  const height = Math.max(260, 180 + Math.min(transactions.length, 20) * 34);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="' + height + '"><rect width="100%" height="100%" rx="32" fill="#111827"/><text x="40" y="58" font-size="32" font-weight="700" fill="white">' + esc(title) + '</text><text x="40" y="100" font-size="26" fill="white">' + esc(merchant.name) + '</text>' + rows + '</svg>';
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const file = new File([blob], "merchant-statement.svg", { type: "image/svg+xml" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
}
