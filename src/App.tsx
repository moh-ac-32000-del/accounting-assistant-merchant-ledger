import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutUser, subscribeToAuth } from "./lib/auth";
import { firebaseConfigured } from "./lib/firebase";
import { archiveMerchant, createMerchant, subscribeToMerchants } from "./lib/merchants";
import type { Currency, Merchant } from "./lib/types";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToAuth(setUser), []);
  useEffect(() => {
    if (!user) { setMerchants([]); return; }
    return subscribeToMerchants(user.uid, setMerchants);
  }, [user]);

  async function addMerchant() {
    if (!user || !name.trim()) return;
    setBusy(true);
    try { await createMerchant(user.uid, name, currency); setName(""); }
    finally { setBusy(false); }
  }

  if (!firebaseConfigured) return <main className="app-shell"><section className="welcome-card"><span className="eyebrow">Merchant Ledger</span><h1>التهيئة مطلوبة</h1><p>أضف متغيرات VITE_FIREBASE_* قبل تفعيل التخزين السحابي.</p></section></main>;

  if (!user) return <main className="app-shell"><section className="welcome-card"><span className="eyebrow">Merchant Ledger</span><h1>حسابات التجار</h1><p>سجّل الدخول بحساب Google للوصول إلى بياناتك السحابية.</p><button className="primary" onClick={() => signInWithGoogle()}>الدخول باستخدام Google</button></section></main>;

  return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><span className="eyebrow">Merchant Ledger</span><h1>التجار</h1></div><button className="ghost" onClick={() => signOutUser()}>خروج</button></header>
    <section className="add-card"><h2>إضافة تاجر</h2><div className="form-row">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم التاجر" onKeyDown={e => e.key === "Enter" && addMerchant()} />
      <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <button className="primary" disabled={busy || !name.trim()} onClick={addMerchant}>إضافة</button>
    </div></section>
    <section className="merchant-list">{merchants.length === 0 ? <div className="empty">لا يوجد تجار بعد.</div> : merchants.map(m => <article className="merchant-card" key={m.id}><div><h3>{m.name}</h3><span>{m.defaultCurrency === "TRY" ? "₺" : "$"}</span></div><button className="ghost danger" onClick={() => archiveMerchant(user.uid, m.id)}>أرشفة</button></article>)}</section>
  </section></main>;
}
