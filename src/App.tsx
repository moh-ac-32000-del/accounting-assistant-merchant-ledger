import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutUser, subscribeToAuth } from "./lib/auth";
import { firebaseConfigured } from "./lib/firebase";
import { archiveMerchant, createMerchant, restoreMerchant, subscribeToArchivedMerchants, subscribeToMerchants } from "./lib/merchants";
import { getOrCreateWorkspace } from "./lib/workspaces";
import { createPayment, createPurchase, deleteTransaction, subscribeToAuditEvents, subscribeToTransactions, updateTransaction } from "./lib/transactions";
import { createMaterial, subscribeToMaterials } from "./lib/materials";
import type { AuditEvent, Currency, Material, Merchant, Transaction } from "./lib/types";
import { LANGUAGE_STORAGE_KEY, translations, type Language, type TranslationKey } from "./lib/i18n";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "en-US", { maximumFractionDigits: 2 }).format(value) +
  (currency === "TRY" ? " ₺" : " $");

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [archivedMerchants, setArchivedMerchants] = useState<Merchant[]>([]);
  const [merchantTab, setMerchantTab] = useState<"active" | "archived">("active");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditEvent | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === "ar" || saved === "tr" || saved === "en" ? saved : "ar";
  });
  const tr = (key: TranslationKey) => translations[language][key];
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [merchantName, setMerchantName] = useState("");
  const [merchantCurrency, setMerchantCurrency] = useState<Currency>("TRY");
  const [materialName, setMaterialName] = useState("");
  const [materialPrice, setMaterialPrice] = useState("");
  const [materialCurrency, setMaterialCurrency] = useState<Currency>("TRY");
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [transactionCurrency, setTransactionCurrency] = useState<Currency>("TRY");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editDate, setEditDate] = useState(today());
  const [editMaterial, setEditMaterial] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("TRY");
  const [editNote, setEditNote] = useState("");

  async function handleGoogleSignIn() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      const authError = e as { code?: string; message?: string };
      const code = authError.code ? ` [${authError.code}]` : "";
      setError(`${tr("loginError")}${code}`);
    }
  }

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => subscribeToAuth(setUser), []);

  useEffect(() => {
    if (!user) { setWorkspaceId(null); setMerchants([]); setMaterials([]); return; }
    let cancelled = false;
    getOrCreateWorkspace(user.uid, user.displayName ?? undefined)
      .then(ctx => { if (!cancelled) setWorkspaceId(ctx.workspaceId); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "تعذر تجهيز مساحة العمل."); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!workspaceId) return;
    const unsubMerchants = subscribeToMerchants(workspaceId, setMerchants);
    const unsubArchived = subscribeToArchivedMerchants(workspaceId, setArchivedMerchants);
    const unsubMaterials = subscribeToMaterials(workspaceId, items => setMaterials(items.filter(x => x.active)));
    return () => { unsubMerchants(); unsubArchived(); unsubMaterials(); };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !selectedMerchant) { setTransactions([]); return; }
    const unsubTransactions = subscribeToTransactions(workspaceId, selectedMerchant.id, setTransactions);
    const unsubAudit = subscribeToAuditEvents(workspaceId, selectedMerchant.id, setAuditEvents);
    return () => { unsubTransactions(); unsubAudit(); };
  }, [workspaceId, selectedMerchant?.id]);

  useEffect(() => {
    if (!selectedMerchant) return;
    setTransactionCurrency(selectedMerchant.defaultCurrency);
  }, [selectedMerchant?.id]);

  const filteredMaterials = useMemo(() => {
    const q = materialName.trim().toLowerCase();
    return materials.filter(m => !q || m.name.toLowerCase().includes(q) || m.aliases.some(a => a.toLowerCase().includes(q)));
  }, [materials, materialName]);

  const balances = useMemo(() => {
    const result = { TRY: { purchases: 0, payments: 0 }, USD: { purchases: 0, payments: 0 } };
    for (const t of transactions) {
      const value = t.type === "purchase" ? (t.total ?? 0) : (t.amount ?? 0);
      if (t.currency === "TRY") t.type === "purchase" ? result.TRY.purchases += value : result.TRY.payments += value;
      else t.type === "purchase" ? result.USD.purchases += value : result.USD.payments += value;
    }
    return result;
  }, [transactions]);

  function selectMaterial(name: string) {
    setMaterialName(name);
    const material = materials.find(m => m.name === name);
    if (material) { setUnitPrice(String(material.defaultPrice)); setTransactionCurrency(material.currency); }
  }

  async function addMerchant() {
    if (!workspaceId || !user || !merchantName.trim()) return;
    setBusy(true); setError("");
    try { await createMerchant(workspaceId, user.uid, merchantName, merchantCurrency); setMerchantName(""); }
    catch (e) { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  async function addMaterial() {
    if (!workspaceId || !materialName.trim()) return;
    const price = Number(materialPrice);
    if (!Number.isFinite(price) || price < 0) { setError("أدخل سعرًا صحيحًا للمادة."); return; }
    setBusy(true); setError("");
    try { await createMaterial(workspaceId, { name: materialName, defaultPrice: price, currency: materialCurrency }); setMaterialPrice(""); }
    catch (e) { setError(tr("materialError")); }
    finally { setBusy(false); }
  }

  async function addPurchase() {
    if (!workspaceId || !user || !selectedMerchant) return;
    const q = Number(quantity), p = Number(unitPrice);
    if (!materialName.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) { setError("أدخل المادة والكمية والسعر بشكل صحيح."); return; }
    setBusy(true); setError("");
    try {
      await createPurchase(workspaceId, selectedMerchant.id, user.uid, { date, currency: transactionCurrency, materialNameSnapshot: materialName, quantity: q, unitPrice: p, note });
      setQuantity(""); setUnitPrice(""); setNote("");
    } catch (e) { setError(tr("transactionError")); }
    finally { setBusy(false); }
  }

  async function addPayment() {
    if (!workspaceId || !user || !selectedMerchant) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("أدخل مبلغ دفعة صحيحًا."); return; }
    setBusy(true); setError("");
    try {
      await createPayment(workspaceId, selectedMerchant.id, user.uid, { date, currency: transactionCurrency, paymentMethod, amount, note });
      setPaymentAmount(""); setNote("");
    } catch (e) { setError(tr("transactionError")); }
    finally { setBusy(false); }
  }

  async function removeTransaction(t: Transaction) {
    if (!workspaceId || !user || !selectedMerchant || !window.confirm(tr("confirmDelete"))) return;
    setBusy(true); setError("");
    try { await deleteTransaction(workspaceId, selectedMerchant.id, user.uid, t); }
    catch (e) { setError(tr("transactionError")); }
    finally { setBusy(false); }
  }

  function openEdit(t: Transaction) {
    setEditingTransaction(t);
    setEditDate(t.date);
    setEditCurrency(t.currency);
    setEditMaterial(t.materialNameSnapshot ?? "");
    setEditQuantity(t.quantity == null ? "" : String(t.quantity));
    setEditUnitPrice(t.unitPrice == null ? "" : String(t.unitPrice));
    setEditAmount(t.amount == null ? "" : String(t.amount));
    setEditPaymentMethod(t.paymentMethod ?? "");
    setEditNote(t.note ?? "");
    setError("");
  }

  async function saveEdit() {
    if (!workspaceId || !user || !selectedMerchant || !editingTransaction) return;
    setBusy(true);
    setError("");
    try {
      const patch = editingTransaction.type === "purchase"
        ? {
            date: editDate,
            currency: editCurrency,
            materialNameSnapshot: editMaterial,
            quantity: Number(editQuantity),
            unitPrice: Number(editUnitPrice),
            note: editNote,
          }
        : {
            date: editDate,
            currency: editCurrency,
            amount: Number(editAmount),
            paymentMethod: editPaymentMethod,
            note: editNote,
          };
      await updateTransaction(
        workspaceId,
        selectedMerchant.id,
        user.uid,
        editingTransaction.id,
        editingTransaction,
        patch,
      );
      setEditingTransaction(null);
    } catch {
      setError(tr("transactionError"));
    } finally {
      setBusy(false);
    }
  }

  async function changeMerchantArchive(m: Merchant, restore: boolean) {
    if (!workspaceId || !user) return;
    if (!window.confirm(restore ? tr("confirmRestore") : tr("confirmArchive"))) return;
    setBusy(true);
    setError("");
    try {
      if (restore) await restoreMerchant(workspaceId, m.id, user.uid);
      else await archiveMerchant(workspaceId, m.id, user.uid);
    } catch {
      setError(tr("merchantError"));
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseConfigured) return <main className="app-shell"><section className="welcome-card"><span className="eyebrow">{tr("merchantLedger")}</span><h1>{tr("setupRequired")}</h1><p>{tr("setupDescription")}</p></section></main>;
  if (!user) return <main className="app-shell"><section className="welcome-card"><LanguagePicker language={language} setLanguage={setLanguage} /> <span className="eyebrow">{tr("merchantLedger")}</span><h1>{tr("signInTitle")}</h1><p>{tr("signInDescription")}</p>{error && <div className="error">{error}</div>}<button className="primary" onClick={handleGoogleSignIn}>{tr("signInGoogle")}</button></section></main>;

  if (selectedMerchant) return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><button className="ghost" onClick={() => setSelectedMerchant(null)}>{tr("backToMerchants")}</button><span className="eyebrow">{tr("merchantAccount")}</span><h1>{selectedMerchant.name}</h1></div><button className="ghost" onClick={() => signOutUser()}>{tr("signOut")}</button></header>
    {error && <div className="error">{error}</div>}
    <section className="balance-grid">
      {(["TRY","USD"] as Currency[]).map(c => <article className="balance-card" key={c}><span>{c}</span><strong>{money(balances[c].purchases - balances[c].payments, c)}</strong><small>{balances[c].purchases >= balances[c].payments ? "المتبقي للتاجر" : "رصيد لصالحك"}</small></article>)}
    </section>
    <section className="add-card"><h2>{tr("addPurchase")}</h2><div className="form-grid">
      <input list="materials" value={materialName} onChange={e => selectMaterial(e.target.value)} placeholder={tr("material")} />
      <datalist id="materials">{filteredMaterials.map(m => <option key={m.id} value={m.name}>{m.defaultPrice}</option>)}</datalist>
      <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={tr("quantity")} />
      <input type="number" step="any" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder={tr("unitPrice")} />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select value={transactionCurrency} onChange={e => setTransactionCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder={tr("note")} />
      <button className="primary" disabled={busy} onClick={addPurchase}>{tr("savePurchase")}</button>
    </div></section>
    <section className="add-card"><h2>{tr("addPayment")}</h2><div className="form-grid">
      <input type="number" step="any" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={tr("amount")} />
      <input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder={tr("paymentMethod")} />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select value={transactionCurrency} onChange={e => setTransactionCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder={tr("note")} />
      <button className="primary" disabled={busy} onClick={addPayment}>{tr("savePayment")}</button>
    </div></section>
    <section className="merchant-list"><h2>{tr("movements")}</h2>{transactions.length === 0 ? <div className="empty">{tr("noMovements")}</div> : transactions.map(t => <article className="transaction-card" key={t.id}><div><strong>{t.type === "purchase" ? tr("purchase") : tr("payment")}</strong><span>{t.date} · {t.type === "purchase" ? t.materialNameSnapshot : t.paymentMethod}</span></div><div className="transaction-value">{money(t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0, t.currency)}<button className="ghost danger small" disabled={busy} onClick={() => removeTransaction(t)}>{tr("delete")}</button></div></article>)}</section>
  </section></main>;

  return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><span className="eyebrow">Merchant Ledger</span><h1>{tr("merchants")}</h1></div><button className="ghost" onClick={() => signOutUser()}>خروج</button></header>
    {error && <div className="error">{error}</div>}
    <section className="add-card"><h2>{tr("addMerchant")}</h2><div className="form-row">
      <input value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder={tr("merchantName")} onKeyDown={e => e.key === "Enter" && addMerchant()} />
      <select value={merchantCurrency} onChange={e => setMerchantCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <button className="primary" disabled={busy || !merchantName.trim()} onClick={addMerchant}>{tr("add")}</button>
    </div></section>
    <section className="add-card"><h2>{tr("materials")}</h2><div className="form-row">
      <input value={materialName} onChange={e => setMaterialName(e.target.value)} placeholder={tr("materialName")} />
      <input type="number" step="any" value={materialPrice} onChange={e => setMaterialPrice(e.target.value)} placeholder={tr("price")} />
      <button className="primary" disabled={busy || !materialName.trim()} onClick={addMaterial}>{tr("addMaterial")}</button>
    </div></section>
    <section className="merchant-list">{merchants.length === 0 ? <div className="empty">{tr("noMerchants")}</div> : merchants.map(m => <article className="merchant-card" key={m.id}><button className="merchant-open" onClick={() => setSelectedMerchant(m)}><h3>{m.name}</h3><span>{m.defaultCurrency === "TRY" ? "₺" : "$"} · {tr("activeMerchant")}</span></button><button className="ghost danger" onClick={() => workspaceId && archiveMerchant(workspaceId, m.id)}>{tr("archive")}</button></article>)}</section>
  </section></main>;
}


function LanguagePicker({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <label className="language-picker">
      <span>{translations[language].language}</span>
      <select value={language} onChange={event => setLanguage(event.target.value as Language)}>
        <option value="ar">العربية</option>
        <option value="tr">Türkçe</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
