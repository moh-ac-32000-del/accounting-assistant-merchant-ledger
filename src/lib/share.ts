import type { Merchant, Transaction } from "./types";

function labelForTransaction(t: Transaction, language: "ar" | "tr" | "en") {
  return t.type === "purchase"
    ? (language === "ar" ? "شراء" : language === "tr" ? "Alış" : "Purchase")
    : (language === "ar" ? "دفعة" : language === "tr" ? "Ödeme" : "Payment");
}

function transactionText(merchant: Merchant, t: Transaction, language: "ar" | "tr" | "en") {
  const label = labelForTransaction(t, language);
  const value = t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0;
  const detail = t.type === "purchase"
    ? (language === "ar" ? `المادة: ${t.materialNameSnapshot ?? ""} | الكمية: ${t.quantity ?? ""} | سعر الوحدة: ${t.unitPrice ?? ""}` : `Material: ${t.materialNameSnapshot ?? ""} | Qty: ${t.quantity ?? ""} | Unit price: ${t.unitPrice ?? ""}`)
    : (language === "ar" ? `طريقة الدفع: ${t.paymentMethod ?? ""}` : `Payment method: ${t.paymentMethod ?? ""}`);
  return language === "ar"
    ? `التاجر: ${merchant.name}\n${label} — ${t.date}\n${detail}\nالمبلغ: ${value} ${t.currency}${t.note ? `\nملاحظة: ${t.note}` : ""}`
    : `Merchant: ${merchant.name}\n${label} — ${t.date}\n${detail}\nAmount: ${value} ${t.currency}${t.note ? `\nNote: ${t.note}` : ""}`;
}

export async function shareTransaction(merchant: Merchant, transaction: Transaction, language: "ar" | "tr" | "en") {
  const text = transactionText(merchant, transaction, language);
  const title = language === "ar" ? "العملية" : language === "tr" ? "İşlem" : "Transaction";
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard.writeText(text);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

export async function shareStatementImage(merchant: Merchant, transactions: Transaction[], language: "ar" | "tr" | "en") {
  const title = language === "ar" ? "كشف حساب" : language === "tr" ? "Hesap ekstresi" : "Account statement";
  const rows = transactions.slice(0, 80);
  const width = 1200;
  const rowHeight = 62;
  const height = Math.max(360, 250 + rows.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Arial";
  ctx.direction = language === "ar" ? "rtl" : "ltr";
  ctx.textAlign = language === "ar" ? "right" : "left";
  const anchorX = language === "ar" ? width - 60 : 60;
  ctx.fillText(title, anchorX, 65);
  ctx.font = "bold 32px Arial";
  ctx.fillText(merchant.name, anchorX, 115);

  ctx.font = "24px Arial";
  rows.forEach((t, i) => {
    const value = t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0;
    const line = `${t.date} · ${labelForTransaction(t, language)} · ${value} ${t.currency}`;
    drawWrappedText(ctx, line, anchorX, 175 + i * rowHeight, width - 120, 32);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image creation failed.")), "image/png");
  });
  const file = new File([blob], "merchant-statement.png", { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "merchant-statement.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
