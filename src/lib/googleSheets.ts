import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase";
import type { Currency, Merchant, Transaction } from "./types";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function rowsForSheet(merchant: Merchant, transactions: Transaction[], language: "ar" | "tr" | "en") {
  const header = language === "ar"
    ? ["التاريخ", "النوع", "التفاصيل", "العملة", "المبلغ"]
    : language === "tr"
      ? ["Tarih", "Tür", "Detay", "Para birimi", "Tutar"]
      : ["Date", "Type", "Details", "Currency", "Amount"];

  const rows = transactions.map(t => {
    const type = t.type === "purchase"
      ? (language === "ar" ? "شراء" : language === "tr" ? "Alış" : "Purchase")
      : (language === "ar" ? "دفعة" : language === "tr" ? "Ödeme" : "Payment");
    const details = t.type === "purchase"
      ? `${t.materialNameSnapshot ?? ""} | ${t.quantity ?? ""} | ${t.unitPrice ?? ""}`
      : t.paymentMethod ?? "";
    const amount = t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0;
    return [t.date, type, details, t.currency, String(amount)];
  });

  return [[merchant.name, "", "", "", ""], header, ...rows];
}

export async function exportMerchantStatementToGoogleSheets(
  merchant: Merchant,
  transactions: Transaction[],
  language: "ar" | "tr" | "en",
) {
  if (!auth) throw new Error("Firebase is not configured.");

  const provider = new GoogleAuthProvider();
  provider.addScope(SHEETS_SCOPE);
  provider.setCustomParameters({ access_type: "offline" });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) throw new Error("Google Sheets authorization was not granted.");

  const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: language === "ar" ? `كشف حساب - ${merchant.name}` : language === "tr" ? `Hesap ekstresi - ${merchant.name}` : `Account statement - ${merchant.name}`,
      },
      sheets: [{ properties: { title: "Statement" } }],
    }),
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text();
    throw new Error(`Google Sheets create failed: ${detail}`);
  }

  const spreadsheet = await createResponse.json() as { spreadsheetId?: string };
  if (!spreadsheet.spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet ID.");

  const values = rowsForSheet(merchant, transactions, language);
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Statement!A1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ range: "Statement!A1", majorDimension: "ROWS", values }),
    },
  );

  if (!updateResponse.ok) {
    const detail = await updateResponse.text();
    throw new Error(`Google Sheets write failed: ${detail}`);
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`;
}
