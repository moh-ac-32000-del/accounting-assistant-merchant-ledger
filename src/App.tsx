import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutUser, subscribeToAuth } from "./lib/auth";
import { firebaseConfigured } from "./lib/firebase";
import { archiveMerchant, createMerchant, subscribeToMerchants } from "./lib/merchants";
import { getOrCreateWorkspace } from "./lib/workspaces";
import { createPayment, createPurchase, deleteTransaction, subscribeToTransactions } from "./lib/transactions";
import { createMaterial, subscribeToMaterials } from "./lib/materials";
import type { Currency, Material, Merchant, Transaction } from "./lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "en-US", { maximumFractionDigits: 2 }).format(value) +
  (currency === "TRY" ? " ₺" : " $");

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
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

  async function handleGoogleSignIn() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الدخول باستخدام Google.");
    }
  }

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
    const unsubMaterials = subscribeToMaterials(workspaceId, items => setMaterials(items.filter(x => x.active)));
    return () => { unsubMerchants(); unsubMaterials(); };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !selectedMerchant) { setTransactions([]); return; }
    return subscribeToTransactions(workspaceId, selectedMerchant.id, setTransactions);
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
    if (!workspaceId || !merchantName.trim()) return;
    setBusy(true); setError("");
    try { await createMerchant(workspaceId, merchantName, merchantCurrency); setMerchantName(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر إضافة التاجر."); }
    finally { setBusy(false); }
  }

  async function addMaterial() {
    if (!workspaceId || !materialName.trim()) return;
    const price = Number(materialPrice);
    if (!Number.isFinite(price) || price < 0) { setError("أدخل سعرًا صحيحًا للمادة."); return; }
    setBusy(true); setError("");
    try { await createMaterial(workspaceId, { name: materialName, defaultPrice: price, currency: materialCurrency }); setMaterialPrice(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر إضافة المادة."); }
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
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الشراء."); }
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
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الدفعة."); }
    finally { setBusy(false); }
  }

  async function removeTransaction(t: Transaction) {
    if (!workspaceId || !user || !selectedMerchant || !window.confirm("حذف هذه العملية؟ سيتم تسجيل الحذف في سجل التدقيق.")) return;
    setBusy(true); setError("");
    try { await deleteTransaction(workspaceId, selectedMerchant.id, user.uid, t); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف العملية."); }
    finally { setBusy(false); }
  }

  if (!firebaseConfigured) return <main className="app-shell"><section className="welcome-card"><span className="eyebrow">Merchant Ledger</span><h1>التهيئة مطلوبة</h1><p>أضف إعدادات Firebase في بيئة التشغيل قبل تفعيل التخزين السحابي.</p></section></main>;
  if (!user) return <main className="app-shell"><section className="welcome-card"><span className="eyebrow">Merchant Ledger</span><h1>حسابات التجار</h1><p>سجّل الدخول بحساب Google للوصول إلى بياناتك السحابية.</p>{error && <div className="error">{error}</div>}<button className="primary" onClick={handleGoogleSignIn}>الدخول باستخدام Google</button></section></main>;

  if (selectedMerchant) return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><button className="ghost" onClick={() => setSelectedMerchant(null)}>← التجار</button><span className="eyebrow">حساب التاجر</span><h1>{selectedMerchant.name}</h1></div><button className="ghost" onClick={() => signOutUser()}>خروج</button></header>
    {error && <div className="error">{error}</div>}
    <section className="balance-grid">
      {(["TRY","USD"] as Currency[]).map(c => <article className="balance-card" key={c}><span>{c}</span><strong>{money(balances[c].purchases - balances[c].payments, c)}</strong><small>{balances[c].purchases >= balances[c].payments ? "المتبقي للتاجر" : "رصيد لصالحك"}</small></article>)}
    </section>
    <section className="add-card"><h2>إضافة شراء</h2><div className="form-grid">
      <input list="materials" value={materialName} onChange={e => selectMaterial(e.target.value)} placeholder="المادة" />
      <datalist id="materials">{filteredMaterials.map(m => <option key={m.id} value={m.name}>{m.defaultPrice}</option>)}</datalist>
      <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="الكمية" />
      <input type="number" step="any" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="سعر الوحدة" />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select value={transactionCurrency} onChange={e => setTransactionCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة اختيارية" />
      <button className="primary" disabled={busy} onClick={addPurchase}>حفظ الشراء</button>
    </div></section>
    <section className="add-card"><h2>إضافة دفعة</h2><div className="form-grid">
      <input type="number" step="any" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="المبلغ" />
      <input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="طريقة الدفع" />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select value={transactionCurrency} onChange={e => setTransactionCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة اختيارية" />
      <button className="primary" disabled={busy} onClick={addPayment}>حفظ الدفعة</button>
    </div></section>
    <section className="merchant-list"><h2>الحركات</h2>{transactions.length === 0 ? <div className="empty">لا توجد حركات لهذا التاجر.</div> : transactions.map(t => <article className="transaction-card" key={t.id}><div><strong>{t.type === "purchase" ? "شراء" : "دفعة"}</strong><span>{t.date} · {t.type === "purchase" ? t.materialNameSnapshot : t.paymentMethod}</span></div><div className="transaction-value">{money(t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0, t.currency)}<button className="ghost danger small" disabled={busy} onClick={() => removeTransaction(t)}>حذف</button></div></article>)}</section>
  </section></main>;

  return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><span className="eyebrow">Merchant Ledger</span><h1>التجار</h1></div><button className="ghost" onClick={() => signOutUser()}>خروج</button></header>
    {error && <div className="error">{error}</div>}
    <section className="add-card"><h2>إضافة تاجر</h2><div className="form-row">
      <input value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder="اسم التاجر" onKeyDown={e => e.key === "Enter" && addMerchant()} />
      <select value={merchantCurrency} onChange={e => setMerchantCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <button className="primary" disabled={busy || !merchantName.trim()} onClick={addMerchant}>إضافة</button>
    </div></section>
    <section className="add-card"><h2>المواد</h2><div className="form-row">
      <input value={materialName} onChange={e => setMaterialName(e.target.value)} placeholder="اسم المادة" />
      <input type="number" step="any" value={materialPrice} onChange={e => setMaterialPrice(e.target.value)} placeholder="السعر" />
      <button className="primary" disabled={busy || !materialName.trim()} onClick={addMaterial}>إضافة مادة</button>
    </div></section>
    <section className="merchant-list">{merchants.length === 0 ? <div className="empty">لا يوجد تجار بعد.</div> : merchants.map(m => <article className="merchant-card" key={m.id}><button className="merchant-open" onClick={() => setSelectedMerchant(m)}><h3>{m.name}</h3><span>{m.defaultCurrency === "TRY" ? "₺" : "$"} · فتح الحساب</span></button><button className="ghost danger" onClick={() => workspaceId && archiveMerchant(workspaceId, m.id)}>أرشفة</button></article>)}</section>
  </section></main>;
}
