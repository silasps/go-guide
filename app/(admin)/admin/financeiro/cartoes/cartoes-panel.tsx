"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, CalendarDays, ChevronRight, CreditCard, FileText, LoaderCircle, Pencil, Plus, Receipt, RotateCcw, Tag, X } from "lucide-react";
import { addAccount, addTransaction, archiveAccount, createQuickCategory, updateAccount } from "../actions";
import type { FinanceAccount, FinanceCategory } from "../finance-panel";

type Props = {
  cards: FinanceAccount[];
  accountBalances: Record<string, number>;
  categories: FinanceCategory[];
  allAccounts: FinanceAccount[];
};

const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "outro", label: "Outro" },
];

function money(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function CardForm({ card, onCancel }: { card?: FinanceAccount; onCancel: () => void }) {
  const router = useRouter();
  const action = card ? updateAccount.bind(null, card.id) : addAccount;

  async function handleSubmit(fd: FormData) {
    fd.set("kind", "credit_card");
    await action(fd);
    router.refresh();
    onCancel();
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-slate-700">Nome do cartão</span>
        <input name="name" defaultValue={card?.name ?? ""} required placeholder="Ex: Santander Credito"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700" />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-slate-700">Bandeira</span>
        <select name="card_brand" defaultValue={card?.card_brand ?? ""}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700">
          <option value="">Selecione</option>
          {CARD_BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-slate-700">Limite total</span>
        <input name="credit_limit" inputMode="decimal" defaultValue={card?.credit_limit ?? ""}
          placeholder="Ex: 5000,00"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-700">Dia de fechamento</span>
          <input name="closing_day" type="number" min={1} max={31} defaultValue={card?.closing_day ?? ""}
            placeholder="Ex: 15"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-700">Dia de vencimento</span>
          <input name="due_day" type="number" min={1} max={31} defaultValue={card?.due_day ?? ""}
            placeholder="Ex: 20"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700" />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-slate-700">Moeda</span>
        <select name="currency" defaultValue={card?.currency ?? "BRL"}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700">
          <option value="BRL">R$ BRL - Real</option>
          <option value="USD">$ USD - Dólar</option>
          <option value="EUR">€ EUR - Euro</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700">
          Cancelar
        </button>
        <button type="submit" className="rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">
          Salvar
        </button>
      </div>
    </form>
  );
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatAmountInput(value: string, currency = "BRL") {
  const digits = value.replace(/\D/g, "");
  const cents = digits.padStart(3, "0");
  const sep = currency === "USD" ? "." : ",";
  return `${cents.slice(0, -2).replace(/^0+(?=\d)/, "") || "0"}${sep}${cents.slice(-2)}`;
}

function defaultFaturaDate(purchaseDate: string, closingDay: number | null) {
  const d = new Date(`${purchaseDate}T00:00:00`);
  const offset = d.getDate() >= (closingDay ?? 1) ? 1 : 0;
  const fd = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, "0")}-01`;
}

function QuickCardForm({ cards, categories, initialType, onClose }: { cards: FinanceAccount[]; categories: FinanceCategory[]; initialType: "income" | "expense"; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">(initialType);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const selectedCard = cards.find((c) => c.id === cardId);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [faturaDate, setFaturaDate] = useState(defaultFaturaDate(today(), selectedCard?.closing_day ?? null));
  const [categoryId, setCategoryId] = useState("");
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [pendingCat, startCat] = useTransition();
  const isIncome = type === "income";
  const headerBg = isIncome ? "bg-emerald-500" : "bg-red-500";

  async function handleSubmit(fd: FormData) {
    setSaving(true); setError("");
    let ok = false;
    try {
      fd.set("account_id", cardId);
      fd.set("mode", "credit_purchase");
      fd.set("currency", selectedCard?.currency ?? "BRL");
      fd.set("fatura_date", faturaDate);
      await addTransaction(fd);
      ok = true;
      router.refresh();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { if (!ok) setSaving(false); }
  }

  function createQuick() {
    startCat(async () => {
      const cat = await createQuickCategory(quickName);
      setCategoryOptions((p) => [...p, cat]);
      setCategoryId(cat.id);
      setQuickName(""); setQuickOpen(false);
    });
  }

  const faturaOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i - 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    return { value: val, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });

  return (
    <form action={handleSubmit} className="fixed inset-0 z-50 flex flex-col bg-white">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="due_date" value="" />
      <div className={`${headerBg} px-4 pb-6 pt-14`}>
        <div className="mb-6 flex items-center">
          <button type="button" onClick={onClose} className="mr-3 text-white/80 hover:text-white"><ArrowLeft size={22} /></button>
          <h2 className="flex-1 text-center text-base font-medium text-white">{isIncome ? "Adicionar Receita" : "Adicionar Despesa"}</h2>
          <div className="w-8" />
        </div>
        <div className="mb-1 flex items-end gap-1.5">
          <span className="pb-1 text-xl font-bold text-white/70">{selectedCard?.currency === "USD" ? "$" : selectedCard?.currency === "EUR" ? "€" : "R$"}</span>
          <input name="amount" type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatAmountInput(e.target.value, selectedCard?.currency))} required placeholder="0,00" className="min-w-0 flex-1 bg-transparent text-4xl font-bold text-white outline-none placeholder:text-white/50" />
        </div>
        <p className="mb-5 text-sm text-white/60">Toque para informar o valor</p>
        <div className="flex rounded-full bg-white/20 p-1">
          <label className={`flex-1 cursor-pointer rounded-full py-2.5 text-center text-sm font-semibold transition ${!isIncome ? "bg-white text-red-500 shadow" : "text-white"}`}>
            <input className="sr-only" type="radio" name="type" value="expense" checked={!isIncome} onChange={() => setType("expense")} /> Despesa
          </label>
          <label className={`flex-1 cursor-pointer rounded-full py-2.5 text-center text-sm font-semibold transition ${isIncome ? "bg-white text-emerald-500 shadow" : "text-white"}`}>
            <input className="sr-only" type="radio" name="type" value="income" checked={isIncome} onChange={() => setType("income")} /> Receita
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><FileText size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Descrição <span className="text-red-400">*</span></p>
            <input name="description" required placeholder="Ex: Compra supermercado" className="w-full bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400" />
          </div>
        </div>
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Tag size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Categoria <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">{categoryId ? (categoryOptions.find((c) => c.id === categoryId)?.name) : <span className="text-slate-400">Obrigatório</span>}</p>
          </div>
          <button type="button" onClick={() => setQuickOpen(true)} className="relative z-10 shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-500">+ Nova</button>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="absolute inset-0 z-[5] cursor-pointer opacity-0">
            <option value="">Selecione</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><CreditCard size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Cartão <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">{selectedCard?.name ?? <span className="text-slate-400">Selecione</span>}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select value={cardId} onChange={(e) => { setCardId(e.target.value); const c = cards.find((a) => a.id === e.target.value); setFaturaDate(defaultFaturaDate(date, c?.closing_day ?? null)); }} className="absolute inset-0 cursor-pointer opacity-0">
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><CalendarDays size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Data da compra <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">{new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR")}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <input type="date" name="date" value={date} onChange={(e) => { setDate(e.target.value); setFaturaDate(defaultFaturaDate(e.target.value, selectedCard?.closing_day ?? null)); }} required className="absolute inset-0 cursor-pointer opacity-0" />
        </div>
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Receipt size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Fatura <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">{faturaDate ? new Date(`${faturaDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "Selecione"}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select name="fatura_date" value={faturaDate} onChange={(e) => setFaturaDate(e.target.value)} required className="absolute inset-0 cursor-pointer opacity-0">
            {faturaOptions.map((o) => <option key={o.value} value={o.value}>{o.label.charAt(0).toUpperCase() + o.label.slice(1)}</option>)}
          </select>
        </div>
        {error && <p className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-[65] border-t border-slate-100 bg-white p-4">
        <button type="submit" disabled={saving} className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-white ${headerBg} disabled:opacity-70`}>
          {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Receipt size={18} />}
          {saving ? "Salvando..." : isIncome ? "Salvar Receita" : "Salvar Despesa"}
        </button>
      </div>
      {quickOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-3 backdrop-blur">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nova categoria</h3>
              <button type="button" onClick={() => setQuickOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <input autoFocus value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="Nome da categoria" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-orange-400" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setQuickOpen(false)} className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700">Cancelar</button>
              <button type="button" onClick={createQuick} disabled={pendingCat} className="rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white disabled:opacity-60">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default function CartoesCreditoPanel({ cards, accountBalances, categories, allAccounts: _allAccounts }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [editingCard, setEditingCard] = useState<FinanceAccount | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiving, startArchive] = useTransition();
  const [quickForm, setQuickForm] = useState<{ open: boolean; type: "income" | "expense" }>({ open: false, type: "expense" });

  const activeCards = cards.filter((c) => !c.archived);
  const visibleCards = cards.filter((c) => tab === "archived" ? c.archived : !c.archived);

  function handleArchive(card: FinanceAccount) {
    startArchive(async () => {
      await archiveAccount(card.id, !card.archived);
      router.refresh();
    });
  }

  if (quickForm.open) {
    return <QuickCardForm cards={activeCards} categories={categories} initialType={quickForm.type} onClose={() => setQuickForm({ open: false, type: "expense" })} />;
  }

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-slate-50 sm:-mx-6">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-4 pb-0 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3">
            <Link href="/admin/financeiro" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
              <ArrowLeft size={15} /> Financeiro
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Cartões de Crédito</h1>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button onClick={() => setQuickForm({ open: true, type: "expense" })}
              className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              <CreditCard size={15} /> Despesa Cartão
            </button>
            <button onClick={() => setQuickForm({ open: true, type: "income" })}
              className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              <FileText size={15} /> Receita
            </button>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <Plus size={15} /> Novo Cartão
            </button>
          </div>
          <div className="mt-4 flex gap-6 border-b border-slate-200">
            {[
              { key: "active", icon: CreditCard, label: "Meus cartões" },
              { key: "archived", icon: Archive, label: "Arquivados" },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} type="button" onClick={() => setTab(key as typeof tab)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px transition ${tab === key ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500"}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards list */}
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 space-y-4">
        {visibleCards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {tab === "archived" ? "Nenhum cartão arquivado." : "Nenhum cartão cadastrado. Clique em \"+ Novo Cartão\" para começar."}
          </div>
        )}
        {visibleCards.map((card) => {
          const bal = accountBalances[card.id] ?? 0;
          const bill = Math.max(0, -bal);
          const available = card.credit_limit != null ? card.credit_limit - bill : null;
          const usedPct = card.credit_limit ? Math.min((bill / card.credit_limit) * 100, 100) : 0;
          const brandLabel = CARD_BRANDS.find((b) => b.value === card.card_brand)?.label ?? card.card_brand ?? "";

          return (
            <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {card.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-slate-600">Conta</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={18} className="text-slate-500" />
                <h2 className="text-lg font-bold text-slate-950">{card.name}</h2>
              </div>
              {brandLabel && <p className="text-xs text-slate-400 mb-3">{brandLabel}</p>}

              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Limite usado</span>
                <span className="font-medium text-slate-950">{money(bill, card.currency)}</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${usedPct}%` }} />
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Limite usado</p>
                  <p className="font-semibold text-red-500">{money(bill, card.currency)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Limite disponível</p>
                  <p className="font-semibold text-emerald-600">{available != null ? money(available, card.currency) : "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Limite total</p>
                  <p className="font-semibold text-slate-700">{card.credit_limit != null ? money(card.credit_limit, card.currency) : "—"}</p>
                </div>
              </div>

              {(card.closing_day || card.due_day) && (
                <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                  {card.closing_day && (
                    <div>
                      <p className="text-slate-500">Fechamento</p>
                      <p className="font-semibold text-slate-950">Todo dia {card.closing_day}</p>
                    </div>
                  )}
                  {card.due_day && (
                    <div>
                      <p className="text-slate-500">Vencimento</p>
                      <p className="font-semibold text-slate-950">Todo dia {card.due_day}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3">
                <Link href={`/admin/financeiro/cartoes/${card.id}`}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Detalhes da fatura →
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => setEditingCard(card)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    <Pencil size={14} /> Editar
                  </button>
                  <button onClick={() => handleArchive(card)} disabled={archiving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <Archive size={14} /> {card.archived ? "Desarquivar" : "Arquivar"}
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
                    <RotateCcw size={14} /> OFX
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {(editingCard || createOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6" style={{ maxHeight: "90vh" }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">{editingCard ? "Editar cartão" : "Novo cartão"}</h2>
              <button onClick={() => { setEditingCard(null); setCreateOpen(false); }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                <X size={17} />
              </button>
            </div>
            <CardForm card={editingCard ?? undefined} onCancel={() => { setEditingCard(null); setCreateOpen(false); }} />
          </div>
        </div>
      )}
    </div>
  );
}
