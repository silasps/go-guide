"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, CreditCard, FileText, LoaderCircle, Pencil, Plus, Receipt, Tag, Trash2, X } from "lucide-react";
import { addTransaction, deleteTransaction, updateTransaction, payFatura, createQuickCategory } from "../../actions";
import type { FinanceAccount, FinanceCategory } from "../../finance-panel";
import type { FaturaTransaction } from "./page";

type Props = {
  card: FinanceAccount;
  transactions: FaturaTransaction[];
  categories: FinanceCategory[];
  allAccounts: FinanceAccount[];
  initialMonth: string;
};

function money(v: number | null, cur = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(v ?? 0);
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatAmountInput(value: string, currency = "BRL") {
  const digits = value.replace(/\D/g, "");
  const cents = digits.padStart(3, "0");
  const integerPart = cents.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const sep = currency === "USD" ? "." : ",";
  return `${integerPart}${sep}${cents.slice(-2)}`;
}

function faturaMonthLabel(faturaDate: string) {
  const d = new Date(`${faturaDate}T00:00:00`);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return "Fatura " + label.charAt(0).toUpperCase() + label.slice(1);
}

function catName(t: FaturaTransaction) {
  const c = t.finance_categories;
  if (!c) return "Sem categoria";
  if (Array.isArray(c)) return c[0]?.name ?? "Sem categoria";
  return c.name;
}

function defaultFaturaDate(purchaseDate: string, closingDay: number | null) {
  const d = new Date(`${purchaseDate}T00:00:00`);
  const closing = closingDay ?? 1;
  const offset = d.getDate() >= closing ? 1 : 0;
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 10);
}

function currentFaturaDate(closingDay: number | null) {
  return defaultFaturaDate(today(), closingDay);
}

const CHART_COLORS = ["#7c3aed", "#a855f7", "#c084fc", "#818cf8", "#38bdf8", "#34d399", "#fb923c", "#f472b6"];

function DonutChart({ data, total, currency }: { data: { name: string; amount: number; color: string }[]; total: number; currency: string }) {
  const R = 45, CX = 60, CY = 60;
  const C = 2 * Math.PI * R;
  let cumulative = 0;
  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: 192, height: 192 }}>
      <svg viewBox="0 0 120 120" width={192} height={192}>
        {total === 0 ? (
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e2e8f0" strokeWidth="22" />
        ) : data.map((d, i) => {
          const len = (d.amount / total) * C;
          const rotation = (cumulative / C) * 360 - 90;
          cumulative += len;
          return (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={d.color} strokeWidth="22"
              strokeDasharray={`${len} ${C}`}
              transform={`rotate(${rotation} ${CX} ${CY})`} />
          );
        })}
      </svg>
      <div className="absolute text-center pointer-events-none">
        <p className="text-base font-bold text-slate-950">{money(total, currency)}</p>
        <p className="text-xs text-slate-400">Total</p>
      </div>
    </div>
  );
}

function CardTransactionForm({
  card,
  categories,
  allAccounts,
  transaction,
  initialType,
  onSaved,
  onClose,
}: {
  card: FinanceAccount;
  categories: FinanceCategory[];
  allAccounts: FinanceAccount[];
  transaction?: FaturaTransaction;
  initialType: "income" | "expense";
  onSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? initialType);
  const [amount, setAmount] = useState(
    transaction?.amount ? formatAmountInput(String(Math.round(Number(transaction.amount) * 100)), card.currency) : ""
  );
  const [txDate, setTxDate] = useState(transaction?.date ?? today());
  const [faturaDate, setFaturaDate] = useState(
    transaction?.fatura_date ?? defaultFaturaDate(today(), card.closing_day)
  );
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [pendingCat, startCatTx] = useTransition();

  const action = transaction
    ? updateTransaction.bind(null, transaction.id)
    : addTransaction;
  const isIncome = type === "income";
  const headerBg = isIncome ? "bg-emerald-500" : "bg-red-500";

  async function handleSubmit(fd: FormData) {
    setSaving(true);
    setFormError("");
    let ok = false;
    try {
      fd.set("account_id", card.id);
      fd.set("mode", "credit_purchase");
      fd.set("currency", card.currency);
      fd.set("fatura_date", faturaDate);
      await action(fd);
      ok = true;
      router.refresh();
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      if (!ok) setSaving(false);
    }
  }

  function createQuick() {
    startCatTx(async () => {
      const cat = await createQuickCategory(quickName);
      setCategoryOptions((prev) => [...prev, cat]);
      setCategoryId(cat.id);
      setQuickName("");
      setQuickOpen(false);
    });
  }

  const faturaOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i - 1);
    return { value: d.toISOString().slice(0, 10), label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });

  return (
    <form action={handleSubmit} className="flex min-h-screen flex-col bg-white">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="due_date" value="" />

      {/* Header */}
      <div className={`${headerBg} px-4 pb-6 pt-14`}>
        <div className="mb-6 flex items-center">
          <button type="button" onClick={onClose} className="mr-3 text-white/80 hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h2 className="flex-1 text-center text-base font-medium text-white">
            {transaction ? "Editar lançamento" : isIncome ? "Adicionar Receita" : "Adicionar Despesa"}
          </h2>
          <div className="w-8" />
        </div>
        <div className="mb-1 flex items-end gap-1.5">
          <span className="pb-1 text-xl font-bold text-white/70">{card.currency === "USD" ? "$" : card.currency === "EUR" ? "€" : "R$"}</span>
          <input name="amount" type="text" inputMode="numeric" value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value, card.currency))}
            required placeholder="0,00"
            className="min-w-0 flex-1 bg-transparent text-4xl font-bold text-white outline-none placeholder:text-white/50" />
        </div>
        <p className="mb-5 text-sm text-white/60">Toque para informar o valor</p>
        <div className="flex rounded-full bg-white/20 p-1">
          <label className={`flex-1 cursor-pointer rounded-full py-2.5 text-center text-sm font-semibold transition ${!isIncome ? "bg-white text-red-500 shadow" : "text-white"}`}>
            <input className="sr-only" type="radio" name="type" value="expense" checked={!isIncome} onChange={() => setType("expense")} />
            Despesa
          </label>
          <label className={`flex-1 cursor-pointer rounded-full py-2.5 text-center text-sm font-semibold transition ${isIncome ? "bg-white text-emerald-500 shadow" : "text-white"}`}>
            <input className="sr-only" type="radio" name="type" value="income" checked={isIncome} onChange={() => setType("income")} />
            Receita (Estorno)
          </label>
        </div>
      </div>

      <div className="flex-1 pb-32">
        {/* Descrição */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Descrição <span className="text-red-400">*</span></p>
            <input name="description" defaultValue={transaction?.description ?? ""} required
              placeholder="Ex: Compra supermercado"
              className="w-full bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400" />
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
        </div>

        {/* Categoria */}
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Tag size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Categoria <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">
              {categoryId ? (categoryOptions.find((c) => c.id === categoryId)?.name) : <span className="text-slate-400">Obrigatório</span>}
            </p>
          </div>
          <button type="button" onClick={() => setQuickOpen(true)} className="relative z-10 shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-500">
            + Nova
          </button>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="absolute inset-0 z-[5] cursor-pointer opacity-0">
            <option value="">Selecione</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Cartão */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CreditCard size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Cartão</p>
            <p className="text-sm font-medium text-slate-950">{card.name}</p>
          </div>
        </div>

        {/* Competência */}
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CalendarDays size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Data da compra <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">
              {new Date(`${txDate}T00:00:00`).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <input type="date" name="date" value={txDate} onChange={(e) => { setTxDate(e.target.value); setFaturaDate(defaultFaturaDate(e.target.value, card.closing_day)); }} required className="absolute inset-0 cursor-pointer opacity-0" />
        </div>

        {/* Fatura */}
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Receipt size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Fatura <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">
              {faturaDate ? new Date(`${faturaDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "Selecione"}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select name="fatura_date" value={faturaDate} onChange={(e) => setFaturaDate(e.target.value)} required className="absolute inset-0 cursor-pointer opacity-0">
            {faturaOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label.charAt(0).toUpperCase() + o.label.slice(1)}</option>
            ))}
          </select>
        </div>

        {formError && (
          <p className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[65] border-t border-slate-100 bg-white p-4">
        <button type="submit" disabled={saving}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-white ${headerBg} disabled:opacity-70`}>
          {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Receipt size={18} />}
          {saving ? "Salvando..." : isIncome ? "Salvar Receita" : "Salvar Despesa"}
        </button>
      </div>

      {quickOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-3 backdrop-blur">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Nova categoria</h3>
              <button type="button" onClick={() => setQuickOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <input autoFocus value={quickName} onChange={(e) => setQuickName(e.target.value)}
              placeholder="Nome da categoria"
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-orange-400" />
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

export default function FaturaPanel({ card, transactions, categories, allAccounts, initialMonth }: Props) {
  const router = useRouter();

  function currentMonth() {
    return currentFaturaDate(card.closing_day).slice(0, 7);
  }

  const [selectedMonth, setSelectedMonth] = useState(
    initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : currentMonth()
  );
  const [transactionForm, setTransactionForm] = useState<{ open: boolean; type: "income" | "expense"; editing?: FaturaTransaction }>({ open: false, type: "expense" });
  const [chartTab, setChartTab] = useState<"expense" | "income">("expense");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payDate, setPayDate] = useState(today());
  const [paying, startPay] = useTransition();
  const [deletingId, startDelete] = useTransition();

  const faturaDate = `${selectedMonth}-01`;
  const faturaMonthDate = new Date(`${faturaDate}T00:00:00`);
  const prevMonth = new Date(faturaMonthDate.getFullYear(), faturaMonthDate.getMonth() - 1, 1).toISOString().slice(0, 7);
  const nextMonth = new Date(faturaMonthDate.getFullYear(), faturaMonthDate.getMonth() + 1, 1).toISOString().slice(0, 7);
  const faturaLastDay = new Date(faturaMonthDate.getFullYear(), faturaMonthDate.getMonth() + 1, 0).toISOString().slice(0, 10);

  const faturaTransactions = useMemo(
    () => transactions.filter((t) =>
      t.fatura_date === faturaDate ||
      (!t.fatura_date && t.date >= faturaDate && t.date <= faturaLastDay)
    ),
    [transactions, faturaDate, faturaLastDay]
  );

  const expenses = faturaTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const incomes = faturaTransactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const netTotal = expenses - incomes;
  const allPaid = faturaTransactions.length > 0 && faturaTransactions.every((t) => t.fatura_paid);
  const anyUnpaid = faturaTransactions.some((t) => !t.fatura_paid);

  const faturaStatus = faturaTransactions.length === 0
    ? { label: "Em Aberto", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" }
    : allPaid
      ? { label: "Paga", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" }
      : anyUnpaid
        ? { label: "Parcial", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" }
        : { label: "Em Aberto", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };

  const expByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of faturaTransactions.filter((t) => t.type === "expense")) {
      const k = catName(t);
      map[k] = (map[k] ?? 0) + Number(t.amount ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [faturaTransactions]);

  const incByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of faturaTransactions.filter((t) => t.type === "income")) {
      const k = catName(t);
      map[k] = (map[k] ?? 0) + Number(t.amount ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [faturaTransactions]);

  function handlePayFatura() {
    startPay(async () => {
      await payFatura(card.id, faturaDate);
      router.refresh();
      setPayModalOpen(false);
    });
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      await deleteTransaction(id);
      router.refresh();
    });
  }

  if (transactionForm.open) {
    return (
      <CardTransactionForm
        card={card}
        categories={categories}
        allAccounts={allAccounts}
        transaction={transactionForm.editing}
        initialType={transactionForm.type}
        onSaved={() => setTransactionForm({ open: false, type: "expense" })}
        onClose={() => setTransactionForm({ open: false, type: "expense" })}
      />
    );
  }

  const firstDay = `${selectedMonth}-01`;
  const lastDay = new Date(faturaMonthDate.getFullYear(), faturaMonthDate.getMonth() + 1, 0).toISOString().slice(0, 10);
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-slate-50 sm:-mx-6">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-4 pb-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center gap-3">
            <Link href="/admin/financeiro/cartoes"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={17} />
            </Link>
            <h1 className="text-base font-semibold text-slate-950">{card.name}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 space-y-4">
        {/* Month navigation */}
        <div className="app-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setSelectedMonth(prevMonth)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={16} />
            </button>
            <h2 className="text-base font-bold text-slate-950">{faturaMonthLabel(faturaDate)}</h2>
            <button onClick={() => setSelectedMonth(nextMonth)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ArrowRight size={16} />
            </button>
          </div>
          <p className="text-center text-xs text-slate-400">{fmt(firstDay)} - {fmt(lastDay)}</p>
        </div>

        {/* Status */}
        <div className={`rounded-2xl border ${faturaStatus.border} ${faturaStatus.bg} p-4`}>
          <p className="text-xs font-medium text-slate-500 mb-1">Status da Fatura</p>
          <p className={`text-2xl font-bold ${faturaStatus.color}`}>{faturaStatus.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">Fatura {faturaStatus.label}</p>
        </div>

        {/* Valor */}
        <div className="app-card rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Valor da fatura</p>
          <p className="text-2xl font-bold text-slate-950">{money(netTotal, card.currency)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Valor total da fatura</p>
        </div>

        {/* Datas */}
        {(card.closing_day || card.due_day) && (
          <div className="app-card rounded-2xl p-4 grid grid-cols-2 gap-4">
            {card.closing_day && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Fechamento</p>
                <p className="text-xl font-bold text-slate-950">Dia {card.closing_day}</p>
              </div>
            )}
            {card.due_day && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Vencimento</p>
                <p className="text-xl font-bold text-slate-950">Dia {card.due_day}</p>
              </div>
            )}
          </div>
        )}

        {/* Pagar fatura */}
        {!allPaid && faturaTransactions.length > 0 && (
          <div className="app-card rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-slate-600 mb-3">Fatura do {card.name}</p>
            <button onClick={() => setPayModalOpen(true)}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600">
              Marcar como Paga
            </button>
          </div>
        )}

        {/* Gráficos */}
        {(expByCategory.length > 0 || incByCategory.length > 0) && (
          <div className="app-card rounded-2xl p-4">
            <p className="text-sm font-semibold text-slate-950 mb-4">Gráficos</p>
            <div className="flex gap-6 border-b border-slate-100 mb-5">
              {(["income", "expense"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setChartTab(tab)}
                  className={`pb-2 text-sm font-medium border-b-2 -mb-px transition ${chartTab === tab ? "border-slate-950 text-slate-950" : "border-transparent text-slate-400"}`}>
                  {tab === "income" ? "Receitas" : "Despesas"}
                </button>
              ))}
            </div>
            {(() => {
              const isExp = chartTab === "expense";
              const cats = isExp ? expByCategory : incByCategory;
              const total = isExp ? expenses : incomes;
              const chartData = cats.map(([name, amount], i) => ({ name, amount, color: CHART_COLORS[i % CHART_COLORS.length] }));
              const firstDay = `${selectedMonth}-01`;
              const lastDay = new Date(faturaMonthDate.getFullYear(), faturaMonthDate.getMonth() + 1, 0).toISOString().slice(0, 10);
              const fmtLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
              return (
                <>
                  <p className="text-center text-sm font-semibold text-slate-950 mb-0.5">
                    {isExp ? "Todas as Despesas" : "Todas as Receitas"}
                  </p>
                  <p className="text-center text-xs text-slate-400 mb-4">
                    {fmtLabel(firstDay)} – {fmtLabel(lastDay)}
                  </p>
                  <DonutChart data={chartData} total={total} currency={card.currency} />
                  {cats.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <p className="text-sm font-semibold text-slate-950">Detalhes</p>
                      {cats.map(([cat, amt], i) => (
                        <div key={cat}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="inline-block rounded-full px-2.5 py-0.5 text-white font-medium" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>{cat}</span>
                            <span className="text-slate-700 font-medium">{money(amt, card.currency)} ({total > 0 ? ((amt / total) * 100).toFixed(2) : "0.00"}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-full rounded-full transition-all" style={{ width: `${total > 0 ? (amt / total) * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Lançamentos */}
        <div className="app-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-950">Fatura {new Date(`${faturaDate}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
            <div className="flex gap-2">
              <button onClick={() => setTransactionForm({ open: true, type: "expense" })}
                className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white">
                <CreditCard size={13} /> Despesa Cartão
              </button>
              <button onClick={() => setTransactionForm({ open: true, type: "income" })}
                className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
                <Plus size={13} /> Receita
              </button>
            </div>
          </div>

          {faturaTransactions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              Nenhum lançamento nesta fatura.
            </p>
          ) : (
            <div className="space-y-3">
              {faturaTransactions.map((t) => {
                const isIncome = t.type === "income";
                return (
                  <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-950 truncate">{t.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(`${t.date}T00:00:00`).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold shrink-0 ${isIncome ? "text-emerald-600" : "text-red-500"}`}>
                        {isIncome ? "+" : "-"}{money(t.amount, t.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">{catName(t)}</span>
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{card.name}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${t.fatura_paid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {t.fatura_paid ? "Pago" : "Não Pago"}
                      </span>
                    </div>
                    <div className="flex justify-end gap-1 mt-2">
                      <button onClick={() => setTransactionForm({ open: true, type: t.type, editing: t })}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-950">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} disabled={deletingId as unknown as boolean}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Total: {faturaTransactions.length}</span>
          </div>
        </div>
      </div>

      {/* Pay fatura modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6" style={{ maxHeight: "90vh" }}>
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={20} className="text-emerald-600" />
                <h2 className="text-lg font-bold text-emerald-700">Confirmar Pagamento da Fatura</h2>
              </div>
              <p className="text-xs text-slate-500">Confirme os detalhes do pagamento da fatura do seu cartão.</p>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-2">Data do Pagamento Da Fatura</p>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-emerald-400" />
            </div>

            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Cartão:</span>
                <span className="font-semibold text-emerald-700">{card.card_brand ? `${card.card_brand.charAt(0).toUpperCase() + card.card_brand.slice(1)} - ` : ""}{card.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Valor:</span>
                <span className="font-bold text-emerald-700">{money(netTotal, card.currency)}</span>
              </div>
              {card.due_day && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Vencimento:</span>
                  <span className="font-semibold text-emerald-700">Dia {card.due_day}/{selectedMonth.split("-")[1]}/{selectedMonth.split("-")[0]}</span>
                </div>
              )}
            </div>

            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              ⚠️ Todas as transações deste mês serão marcadas como pagas.
            </div>

            <button onClick={handlePayFatura} disabled={paying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-70 mb-3">
              {paying ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {paying ? "Processando..." : "$ Confirmar Pagamento"}
            </button>
            <button onClick={() => setPayModalOpen(false)}
              className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
