import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutUser, subscribeToAuth } from "./lib/auth";
import { firebaseConfigured } from "./lib/firebase";
import { archiveMerchant, createMerchant, restoreMerchant, subscribeToArchivedMerchants, subscribeToMerchants } from "./lib/merchants";
import { getOrCreateWorkspace, listUserWorkspaces, createWorkspace, updateWorkspaceSettings, type WorkspaceSummary, type WorkspaceRole } from "./lib/workspaces";
import { createPayment, createPurchase, deleteTransaction, subscribeToAuditEvents, subscribeToTransactions, updateTransaction } from "./lib/transactions";
import { createMaterial, subscribeToMaterials, updateMaterial } from "./lib/materials";
import type { AuditEvent, Currency, Material, Merchant, Transaction } from "./lib/types";
import { LANGUAGE_STORAGE_KEY, translations, type Language, type TranslationKey } from "./lib/i18n";
import { exportMerchantStatement } from "./lib/export";
import { acceptInvitation, createInvitation } from "./lib/invitations";
import { changeMemberRole, listMembers, removeMember, type SpaceMember } from "./lib/members";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "en-US", { maximumFractionDigits: 2 }).format(value) +
  (currency === "TRY" ? " ₺" : " $");

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<WorkspaceSummary & { role: WorkspaceRole }>>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDefaultCurrency, setWorkspaceDefaultCurrency] = useState<Currency>("TRY");
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLink, setInviteLink] = useState("");
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const ui = language === "ar" ? { createSpace: "إنشاء مساحة", createSpaceTitle: "أنشئ مساحتك", createSpaceDescription: "أدخل اسم المساحة ثم ابدأ العمل.", spaceName: "اسم المساحة", settings: "الإعدادات", spaceSettings: "إعدادات المساحة", defaultCurrency: "العملة الافتراضية", paymentMethods: "طرق الدفع", newPaymentMethod: "طريقة دفع جديدة" } : language === "tr" ? { createSpace: "Alan oluştur", createSpaceTitle: "Alanınızı oluşturun", createSpaceDescription: "Alan adını girin ve çalışmaya başlayın.", spaceName: "Alan adı", settings: "Ayarlar", spaceSettings: "Alan ayarları", defaultCurrency: "Varsayılan para birimi", paymentMethods: "Ödeme yöntemleri", newPaymentMethod: "Yeni ödeme yöntemi" } : { createSpace: "Create Space", createSpaceTitle: "Create your Space", createSpaceDescription: "Enter a Space name to get started.", spaceName: "Space name", settings: "Settings", spaceSettings: "Space settings", defaultCurrency: "Default currency", paymentMethods: "Payment methods", newPaymentMethod: "New payment method" };
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [merchantName, setMerchantName] = useState("");
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchantCurrency, setMerchantCurrency] = useState<Currency>("TRY");
  const [materialName, setMaterialName] = useState("");
  const [materialPrice, setMaterialPrice] = useState("");
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingMaterialPrice, setEditingMaterialPrice] = useState("");
  const [materialCurrency, setMaterialCurrency] = useState<Currency>("TRY");
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
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
    if (!user) return;
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    setBusy(true);
    acceptInvitation(token, user.uid, { displayName: user.displayName, photoURL: user.photoURL, email: user.email })
      .then(async () => {
        window.history.replaceState({}, "", window.location.pathname);
        const spaces = await listUserWorkspaces(user.uid);
        setWorkspaces(spaces);
        if (spaces[0]) setWorkspaceId(spaces[0].id);
      })
      .catch(() => setError(language === "ar" ? "تعذر قبول الدعوة." : language === "tr" ? "Davet kabul edilemedi." : "Invitation could not be accepted."))
      .finally(() => setBusy(false));
  }, [user]);

  useEffect(() => {
    if (!user) { setWorkspaceId(null); setWorkspaces([]); setMerchants([]); setMaterials([]); return; }
    let cancelled = false;
    listUserWorkspaces(user.uid)
      .then(async spaces => {
        if (cancelled) return;
        if (spaces.length === 0) {
          setWorkspaceId(null);
          setWorkspaces([]);
          return;
        }
        setWorkspaces(spaces);
        const saved = localStorage.getItem("merchant-ledger-last-space");
        const selected = spaces.find(s => s.id === saved) ?? spaces[0];
        setWorkspaceId(selected.id);
        setWorkspaceName(selected.name);
        setWorkspaceDefaultCurrency((selected as any).defaultCurrency === "USD" ? "USD" : "TRY");
        setPaymentMethods((selected as any).paymentMethods ?? [{ id: "cash", name: "Cash", active: true }]);
      })
      .catch(() => { if (!cancelled) setError(tr("merchantError")); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!workspaceId) return;
    localStorage.setItem("merchant-ledger-last-space", workspaceId);
    const current = workspaces.find(w => w.id === workspaceId);
    if (current) {
      setWorkspaceName(current.name);
      setWorkspaceDefaultCurrency((current as any).defaultCurrency === "USD" ? "USD" : "TRY");
      setPaymentMethods((current as any).paymentMethods ?? [{ id: "cash", name: "Cash", active: true }]);
    }
    listMembers(workspaceId).then(setMembers).catch(() => undefined);
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
    setTransactionCurrency(workspaceDefaultCurrency);
    setPaymentMethod((paymentMethods.find(x => x.active)?.name) ?? tr("cash"));
  }, [selectedMerchant?.id, language, workspaceDefaultCurrency]);

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

  const visibleMerchants = useMemo(() => {
    const source = merchantTab === "active" ? merchants : archivedMerchants;
    const q = merchantSearch.trim().toLowerCase();
    const filtered = q ? source.filter(m => m.name.toLowerCase().includes(q)) : source;
    const counts = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const merchant of filtered) counts.set(merchant.name, (counts.get(merchant.name) ?? 0) + 1);
    return filtered.map(merchant => {
      const total = counts.get(merchant.name) ?? 1;
      const index = (seen.get(merchant.name) ?? 0) + 1;
      seen.set(merchant.name, index);
      return { merchant, displayName: total > 1 ? String(index) + " " + merchant.name : merchant.name };
    });
  }, [merchantTab, merchants, archivedMerchants, merchantSearch]);

  function selectMaterial(name: string) {
    setMaterialName(name);
    const material = materials.find(m => m.name === name);
    if (material) { setUnitPrice(String(material.defaultPrice)); setTransactionCurrency(material.currency); }
  }

  async function changeRole(member: SpaceMember) {
    if (!workspaceId) return;
    const role = member.role === "admin" ? "member" : "admin";
    setBusy(true);
    try {
      await changeMemberRole(member.id, role);
      setMembers(prev => prev.map(x => x.id === member.id ? { ...x, role } : x));
    } catch { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  async function kickMember(member: SpaceMember) {
    if (!workspaceId || member.role === "owner") return;
    if (!window.confirm(language === "ar" ? "إزالة هذا العضو من المساحة؟" : language === "tr" ? "Bu üye alandan çıkarılsın mı?" : "Remove this member from the Space?")) return;
    setBusy(true);
    try {
      await removeMember(member.id);
      setMembers(prev => prev.filter(x => x.id !== member.id));
    } catch { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  async function makeInvitation() {
    if (!workspaceId || !user) return;
    setBusy(true); setError("");
    try {
      const token = await createInvitation(workspaceId, user.uid, inviteRole);
      const link = window.location.origin + window.location.pathname + "?invite=" + token;
      setInviteLink(link);
    } catch { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  async function saveSpaceSettings() {
    if (!workspaceId || !workspaceName.trim()) return;
    setBusy(true); setError("");
    try {
      await updateWorkspaceSettings(workspaceId, {
        name: workspaceName.trim(),
        defaultCurrency: workspaceDefaultCurrency,
        paymentMethods,
      });
      setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, name: workspaceName.trim() } : w));
      setSettingsOpen(false);
    } catch { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  function addPaymentMethodSetting() {
    const name = newPaymentMethod.trim();
    if (!name) return;
    if (paymentMethods.some(x => x.name.toLowerCase() === name.toLowerCase())) return;
    setPaymentMethods(prev => [...prev, { id: crypto.randomUUID(), name, active: true }]);
    setNewPaymentMethod("");
  }

  function togglePaymentMethod(id: string) {
    setPaymentMethods(prev => prev.map(x => x.id === id ? { ...x, active: !x.active } : x));
  }

  async function createNewSpace() {
    if (!user || !workspaceName.trim()) return;
    setBusy(true); setError("");
    try {
      const ctx = await createWorkspace(user.uid, workspaceName);
      const spaces = await listUserWorkspaces(user.uid);
      setWorkspaces(spaces);
      setWorkspaceId(ctx.workspaceId);
      setSettingsOpen(false);
    } catch { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  async function addMerchant() {
    if (!workspaceId || !user || !merchantName.trim()) return;
    setBusy(true); setError("");
    try { await createMerchant(workspaceId, user.uid, merchantName, merchantCurrency); setMerchantName(""); }
    catch (e) { setError(tr("merchantError")); }
    finally { setBusy(false); }
  }

  async function saveMaterialPrice(material: Material) {
    if (!workspaceId) return;
    const price = Number(editingMaterialPrice);
    if (!Number.isFinite(price) || price < 0) return;
    setBusy(true); setError("");
    try {
      await updateMaterial(workspaceId, material.id, { defaultPrice: price });
      setEditingMaterialId(null);
    } catch { setError(tr("materialError")); }
    finally { setBusy(false); }
  }

  async function addMaterial() {
    if (!workspaceId || !materialName.trim()) return;
    const price = Number(materialPrice);
    if (!Number.isFinite(price) || price < 0) { setError(tr("invalidMaterial")); return; }
    setBusy(true); setError("");
    try { await createMaterial(workspaceId, { name: materialName, defaultPrice: price, currency: materialCurrency }); setMaterialPrice(""); }
    catch (e) { setError(tr("materialError")); }
    finally { setBusy(false); }
  }

  async function addPurchase() {
    if (!workspaceId || !user || !selectedMerchant) return;
    const q = Number(quantity), p = Number(unitPrice);
    if (!materialName.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) { setError(tr("invalidPurchase")); return; }
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
    if (!Number.isFinite(amount) || amount <= 0) { setError(tr("invalidPayment")); return; }
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

  if (user && workspaces.length === 0 && !workspaceId) return <main className="app-shell"><section className="welcome-card"><LanguagePicker language={language} setLanguage={setLanguage} /><span className="eyebrow">{ui.createSpace}</span><h1>{ui.createSpaceTitle}</h1><p>{ui.createSpaceDescription}</p><input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder={ui.spaceName} /><button className="primary" disabled={busy || !workspaceName.trim()} onClick={createNewSpace}>{ui.createSpace}</button></section></main>;

  if (selectedMerchant) return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><button className="ghost" onClick={() => setSelectedMerchant(null)}>{tr("backToMerchants")}</button><span className="eyebrow">{tr("merchantAccount")}</span><h1>{selectedMerchant.name}</h1></div><div className="top-actions"><LanguagePicker language={language} setLanguage={setLanguage} /><button className="ghost" onClick={() => signOutUser()}>{tr("signOut")}</button></div></header>
    {error && <div className="error">{error}</div>}
    <div className="toolbar"><button className="ghost" onClick={() => selectedMerchant && exportMerchantStatement(selectedMerchant, transactions, {
      date: tr("date"), type: language === "ar" ? "النوع" : language === "tr" ? "Tür" : "Type",
      material: tr("material"), quantity: tr("quantity"), unitPrice: tr("unitPrice"), amount: tr("amount"),
      currency: tr("currency"), note: tr("note"), purchase: tr("purchase"), payment: tr("payment"),
      summary: tr("statement"), balance: tr("balance"), purchases: tr("purchases"), payments: tr("payments"),
    })}>{tr("exportStatement")}</button></div>
    <div className="floating-balance"><section className="balance-grid">
      {(["TRY","USD"] as Currency[]).map(c => { const diff = balances[c].purchases - balances[c].payments; return <article className={"balance-card " + (diff < 0 ? "credit-balance" : diff > 0 ? "owed-balance" : "zero-balance")} key={c}><span>{c}</span><strong>{money(diff, c)}</strong><small>{diff > 0 ? tr("owed") : diff < 0 ? tr("credit") : "0"}</small></article>; })}
    </section></div>
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
      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>{paymentMethods.filter(x => x.active).map(x => <option key={x.id} value={x.name}>{x.name}</option>)}</select>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select value={transactionCurrency} onChange={e => setTransactionCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder={tr("note")} />
      <button className="primary" disabled={busy} onClick={addPayment}>{tr("savePayment")}</button>
    </div></section>
    {editingTransaction && <section className="add-card edit-card">
      <div className="section-head"><h2>{tr("editTransaction")}</h2><button className="ghost" onClick={() => setEditingTransaction(null)}>{tr("cancel")}</button></div>
      <div className="form-grid">
        {editingTransaction.type === "purchase" ? <>
          <input value={editMaterial} onChange={e => setEditMaterial(e.target.value)} placeholder={tr("material")} />
          <input type="number" step="any" value={editQuantity} onChange={e => setEditQuantity(e.target.value)} placeholder={tr("quantity")} />
          <input type="number" step="any" value={editUnitPrice} onChange={e => setEditUnitPrice(e.target.value)} placeholder={tr("unitPrice")} />
        </> : <>
          <input type="number" step="any" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder={tr("amount")} />
          <input value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)} placeholder={tr("paymentMethod")} />
        </>}
        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
        <select value={editCurrency} onChange={e => setEditCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
        <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder={tr("note")} />
        <button className="primary" disabled={busy} onClick={saveEdit}>{tr("saveChanges")}</button>
      </div>
    </section>}
    <section className="merchant-list"><h2>{tr("movements")}</h2>{transactions.length === 0 ? <div className="empty">{tr("noMovements")}</div> : transactions.map(t => <article className="transaction-card" key={t.id}><div><strong>{t.type === "purchase" ? tr("purchase") : tr("payment")}</strong><span>{t.date} · {t.type === "purchase" ? t.materialNameSnapshot : t.paymentMethod}</span>{auditEvents.some(a => a.transactionId === t.id && a.action === "updated") && <small className="audit-badge">{tr("edited")}</small>}</div><div className="transaction-value">{money(t.type === "purchase" ? t.total ?? 0 : t.amount ?? 0, t.currency)}<div className="transaction-actions"><button className="ghost small" disabled={busy} onClick={() => openEdit(t)}>{tr("edit")}</button><button className="ghost small" onClick={() => { const a = auditEvents.find(x => x.transactionId === t.id && x.action === "updated"); if (a) setSelectedAudit(a); }} disabled={!auditEvents.some(a => a.transactionId === t.id && a.action === "updated")}>{tr("view")}</button><button className="ghost danger small" disabled={busy} onClick={() => removeTransaction(t)}>{tr("delete")}</button></div></div></article>)}</section>
  {selectedAudit && <section className="audit-panel">
      <div className="section-head"><h2>{tr("audit")}</h2><button className="ghost" onClick={() => setSelectedAudit(null)}>{tr("close")}</button></div>
      <p>{selectedAudit.summary}</p>
      <small>{tr("actor")}: {selectedAudit.actorId} · {String(selectedAudit.createdAt ?? "")}</small>
      <div className="audit-columns"><pre>{JSON.stringify(selectedAudit.before, null, 2)}</pre><pre>{JSON.stringify(selectedAudit.after, null, 2)}</pre></div>
    </section>}
  </section></main>;

  return <main className="app-shell"><section className="dashboard">
    <header className="topbar"><div><span className="eyebrow">{tr("merchantLedger")}</span><h1>{tr("merchants")}</h1><select className="space-picker" value={workspaceId ?? ""} onChange={e => setWorkspaceId(e.target.value)}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div className="top-actions"><LanguagePicker language={language} setLanguage={setLanguage} /><button className="ghost" onClick={() => setSettingsOpen(true)}>{ui.settings}</button><button className="ghost" onClick={() => signOutUser()}>{tr("signOut")}</button></div></header>
    {error && <div className="error">{error}</div>}
    <section className="add-card"><h2>{tr("addMerchant")}</h2><div className="form-row">
      <input value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder={tr("merchantName")} onKeyDown={e => e.key === "Enter" && addMerchant()} />
      <select value={merchantCurrency} onChange={e => setMerchantCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <button className="primary" disabled={busy || !merchantName.trim()} onClick={addMerchant}>{tr("add")}</button>
    </div></section>
    {false && <section className="add-card"><h2>{tr("materials")}</h2><div className="form-row">
      <input value={materialName} onChange={e => setMaterialName(e.target.value)} placeholder={tr("materialName")} />
      <input type="number" step="any" value={materialPrice} onChange={e => setMaterialPrice(e.target.value)} placeholder={tr("price")} />
      <select value={materialCurrency} onChange={e => setMaterialCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select>
      <button className="primary" disabled={busy || !materialName.trim()} onClick={addMaterial}>{tr("addMaterial")}</button>
    </div></section>}
    {settingsOpen && <section className="settings-panel">
      <div className="section-head"><h2>{ui.spaceSettings}</h2><button className="ghost" onClick={() => setSettingsOpen(false)}>{tr("close")}</button></div>
      <label className="settings-field"><span>{ui.spaceName}</span><input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} /></label>
      <label className="settings-field"><span>{ui.defaultCurrency}</span><select value={workspaceDefaultCurrency} onChange={e => setWorkspaceDefaultCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select></label>
      <h3>{ui.paymentMethods}</h3>
      <h3>{language === "ar" ? "الأعضاء" : language === "tr" ? "Üyeler" : "Members"}</h3>
      <div className="settings-materials">{members.map(member => <div key={member.id}><strong>{member.displayName || member.email || member.userId}</strong> · {member.role === "owner" ? "Owner" : member.role === "admin" ? (language === "ar" ? "مدير" : language === "tr" ? "Yönetici" : "Manager") : (language === "ar" ? "عامل" : language === "tr" ? "Çalışan" : "Worker")} {member.role !== "owner" && <><button className="ghost small" disabled={busy} onClick={() => changeRole(member)}>{member.role === "admin" ? (language === "ar" ? "عامل" : language === "tr" ? "Çalışan" : "Worker") : (language === "ar" ? "مدير" : language === "tr" ? "Yönetici" : "Manager")}</button><button className="ghost danger small" disabled={busy} onClick={() => kickMember(member)}>{tr("delete")}</button></>}</div>)}</div>
      <h3>{language === "ar" ? "دعوة عضو" : language === "tr" ? "Üye davet et" : "Invite member"}</h3>
      <div className="form-row"><select value={inviteRole} onChange={e => setInviteRole(e.target.value as "admin" | "member")}><option value="admin">{language === "ar" ? "مدير" : language === "tr" ? "Yönetici" : "Manager"}</option><option value="member">{language === "ar" ? "عامل" : language === "tr" ? "Çalışan" : "Worker"}</option></select><button className="primary" disabled={busy} onClick={makeInvitation}>{language === "ar" ? "إنشاء دعوة" : language === "tr" ? "Davet oluştur" : "Create invitation"}</button></div>
      {inviteLink && <div className="invite-box"><input readOnly value={inviteLink} /><button className="ghost" onClick={() => navigator.clipboard.writeText(inviteLink)}>{language === "ar" ? "نسخ" : language === "tr" ? "Kopyala" : "Copy"}</button><button className="ghost" onClick={() => window.open("https://wa.me/?text=" + encodeURIComponent(inviteLink), "_blank")}>WhatsApp</button></div>}
      <div className="payment-method-list">{paymentMethods.map(pm => <label key={pm.id}><input type="checkbox" checked={pm.active} onChange={() => togglePaymentMethod(pm.id)} /> {pm.name}</label>)}</div>
      <div className="form-row"><input value={newPaymentMethod} onChange={e => setNewPaymentMethod(e.target.value)} placeholder={ui.newPaymentMethod} /><button className="primary" onClick={addPaymentMethodSetting}>{tr("add")}</button></div>
      <h3>{tr("materials")}</h3>
      <div className="form-row"><input value={materialName} onChange={e => setMaterialName(e.target.value)} placeholder={tr("materialName")} /><input type="number" step="any" value={materialPrice} onChange={e => setMaterialPrice(e.target.value)} placeholder={tr("price")} /><select value={materialCurrency} onChange={e => setMaterialCurrency(e.target.value as Currency)}><option value="TRY">TRY ₺</option><option value="USD">USD $</option></select><button className="primary" disabled={busy || !materialName.trim()} onClick={addMaterial}>{tr("addMaterial")}</button></div>
      <div className="settings-materials">{materials.map(m => <div key={m.id}><strong>{m.name}</strong> · {editingMaterialId === m.id ? <input type="number" step="any" value={editingMaterialPrice} onChange={e => setEditingMaterialPrice(e.target.value)} /> : <span>{m.defaultPrice} {m.currency}</span>} <button className="ghost small" onClick={() => { if (editingMaterialId === m.id) saveMaterialPrice(m); else { setEditingMaterialId(m.id); setEditingMaterialPrice(String(m.defaultPrice)); } }}>{editingMaterialId === m.id ? tr("saveChanges") : tr("edit")}</button></div>)}</div>
      <button className="primary" disabled={busy} onClick={saveSpaceSettings}>{tr("saveChanges")}</button>
    </section>}
    <div className="tabs"><button className={merchantTab === "active" ? "tab active-tab" : "tab"} onClick={() => { setMerchantTab("active"); setMerchantSearch(""); }}>{tr("active")} ({merchants.length})</button><button className={merchantTab === "archived" ? "tab active-tab" : "tab"} onClick={() => { setMerchantTab("archived"); setMerchantSearch(""); }}>{tr("archived")} ({archivedMerchants.length})</button></div>
    <input className="merchant-search" value={merchantSearch} onChange={e => setMerchantSearch(e.target.value)} placeholder={tr("searchMerchant")} />
    <section className="merchant-list">{visibleMerchants.length === 0 ? <div className="empty">{merchantSearch.trim() ? tr("noSearchResults") : (merchantTab === "active" ? tr("noMerchants") : tr("noArchivedMerchants"))}</div> : visibleMerchants.map(({merchant:m,displayName}) => <article className="merchant-card" key={m.id}><button className="merchant-open" onClick={() => setSelectedMerchant(m)}><h3>{displayName}</h3><span>{m.defaultCurrency === "TRY" ? "₺" : "$"} · {merchantTab === "active" ? tr("activeMerchant") : tr("archivedMerchant")}</span></button><button className="ghost" disabled={busy} onClick={() => changeMerchantArchive(m, merchantTab === "archived")}>{merchantTab === "active" ? tr("archive") : tr("restore")}</button></article>)}</section>
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
