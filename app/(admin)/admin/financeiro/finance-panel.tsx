"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpDown, BarChart3, Building2, CalendarDays, ChevronRight, CreditCard, FileText, Funnel, Home, Landmark, LoaderCircle, Paintbrush, Pencil, Plus, Receipt, RotateCcw, Search, Settings, Tag, Trash2, WalletCards, X } from "lucide-react";
import {
  addAccount,
  addCategory,
  addTransaction,
  createQuickCategory,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  updateAccount,
  updateCategory,
  updateTransaction,
} from "./actions";

export type FinanceCategory = {
  id: string;
  name: string;
};

export type FinanceAccount = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  credit_limit: number | null;
};

export type FinanceTransaction = {
  id: string;
  date: string;
  description: string;
  location: string | null;
  notes: string | null;
  amount: number | null;
  currency: string;
  category_id: string | null;
  account_id: string | null;
  type: "income" | "expense";
  mode: "normal" | "initial_balance" | "credit_purchase" | "fixed_expense";
  due_date: string | null;
  tithe_eligible: boolean | null;
  finance_categories?: FinanceCategory | FinanceCategory[] | null;
  finance_accounts?: FinanceAccount | FinanceAccount[] | null;
};

type Props = {
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  accountBalances: Record<string, number>;
  transactions: FinanceTransaction[];
  metrics: {
    income: number;
    expenses: number;
    balance: number;
    projectedBalance: number;
    tithe: number;
    topExpenses: { name: string; amount: number }[];
  };
  filters: {
    from: string;
    to: string;
    category: string;
    type: string;
    currency: string;
    month: string;
  };
};

const CURRENCIES = [
  { code: "BRL", label: "Real (BRL)" },
  { code: "USD", label: "Dólar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
];

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(value: number | null, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value ?? 0);
}

function currencySymbol(currency = "BRL") {
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return "R$";
}

function decimalSeparator(currency = "BRL") {
  return currency === "USD" ? "." : ",";
}

function formatAmountInput(value: string, currency = "BRL") {
  const digits = value.replace(/\D/g, "");
  const cents = digits.padStart(3, "0");
  const integerPart = cents.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  return `${integerPart}${decimalSeparator(currency)}${cents.slice(-2)}`;
}

function dateBR(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function categoryName(transaction: FinanceTransaction) {
  const category = transaction.finance_categories;
  if (!category) return "Sem categoria";
  if (Array.isArray(category)) return category[0]?.name ?? "Sem categoria";
  return category.name;
}

function accountName(transaction: FinanceTransaction) {
  const account = transaction.finance_accounts;
  if (!account) return "Sem conta";
  if (Array.isArray(account)) return account[0]?.name ?? "Sem conta";
  return account.name;
}

function accountKindLabel(kind: string) {
  if (kind === "credit_card") return "Cartão";
  if (kind === "cash") return "Dinheiro";
  return "Conta";
}

function MetricCard({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "balance" | "tithe";
  children?: React.ReactNode;
}) {
  const config = {
    income: { icon: ArrowUp, text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
    expense: { icon: ArrowDown, text: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
    balance: { icon: WalletCards, text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
    tithe: { icon: Landmark, text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
  }[tone];
  const Icon = config.icon;

  return (
    <div className={`app-card rounded-2xl p-4 sm:p-3 ${config.border}`}>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${config.text}`}>
        <Icon size={13} />
        {label}
      </p>
      <p className={`mt-1.5 text-lg font-semibold leading-tight tracking-tight sm:text-xl ${config.text}`}>{value}</p>
      {children ? <div className="mt-3 border-t border-slate-100 pt-2.5 sm:mt-2 sm:pt-2">{children}</div> : null}
    </div>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
  variant = "card",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "card" | "sheet";
}) {
  if (!open) return null;

  if (variant === "sheet") {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-white">
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-x-hidden overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BusyIndicator({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-[90] flex justify-center px-4 pointer-events-none">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-lg shadow-slate-900/10">
        <LoaderCircle size={15} className="animate-spin" />
        Processando...
      </div>
    </div>
  );
}

function TransactionForm({
  categories,
  accounts,
  transaction,
  onEditAccounts: _onEditAccounts,
  onSaved,
  onClose,
  initialBalance,
}: {
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  transaction?: FinanceTransaction;
  onEditAccounts: () => void;
  onSaved: () => void;
  onClose: () => void;
  initialBalance?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? (initialBalance ? "income" : "expense"));
  const [currency, setCurrency] = useState(transaction?.currency ?? accounts[0]?.currency ?? "BRL");
  const [amount, setAmount] = useState(
    transaction?.amount ? formatAmountInput(String(Math.round(Number(transaction.amount) * 100)), transaction.currency) : "",
  );
  const [date, setDate] = useState(transaction?.date ?? today());
  const [dueDate, setDueDate] = useState(transaction?.due_date ?? "");
  const initialCategory = initialBalance ? categories.find((c) => c.name === "Saldo inicial")?.id : undefined;
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? initialCategory ?? "");
  const [isFixed, setIsFixed] = useState(transaction?.mode === "fixed_expense");
  const [titheEligible, setTitheEligible] = useState(transaction?.tithe_eligible ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [pendingCategory, startCategoryTransition] = useTransition();

  const bankAccounts = accounts.filter((a) => a.kind !== "credit_card");
  const cardAccounts = accounts.filter((a) => a.kind === "credit_card");
  const [destKind, setDestKind] = useState<"bank" | "card">(() => {
    if (transaction?.account_id) {
      const acc = accounts.find((a) => a.id === transaction.account_id);
      return acc?.kind === "credit_card" ? "card" : "bank";
    }
    return "bank";
  });
  const accountsForKind = destKind === "card" ? cardAccounts : bankAccounts;
  const [selectedAccountId, setSelectedAccountId] = useState(
    transaction?.account_id ?? accountsForKind[0]?.id ?? "",
  );

  const mode = initialBalance ? "initial_balance" : isFixed ? "fixed_expense" : "normal";
  const action = transaction ? updateTransaction.bind(null, transaction.id) : addTransaction;
  const isIncome = type === "income";
  const headerBg = isIncome ? "bg-emerald-500" : "bg-red-500";
  const accentText = isIncome ? "text-emerald-600" : "text-red-500";
  const accentBorder = isIncome ? "border-emerald-400" : "border-red-400";
  const accentBg = isIncome ? "bg-emerald-50" : "bg-red-50";

  function handleAccountChange(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    if (account?.currency) {
      setCurrency(account.currency);
      setAmount((current) => current ? formatAmountInput(current, account.currency) : "");
    }
  }

  function createCategoryFromModal() {
    startCategoryTransition(async () => {
      const category = await createQuickCategory(quickCategoryName);
      setCategoryOptions((current) => [...current, category]);
      setCategoryId(category.id);
      setQuickCategoryName("");
      setQuickCategoryOpen(false);
    });
  }

  async function submitTransaction(formData: FormData) {
    setSaving(true);
    setFormError("");
    let saved = false;
    try {
      await action(formData);
      saved = true;
      router.refresh();
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally {
      if (!saved) setSaving(false);
    }
  }

  return (
    <form action={submitTransaction} className="flex min-h-screen flex-col bg-white">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="currency" value={currency} />
      {isIncome && titheEligible && <input type="hidden" name="tithe_eligible" value="on" />}

      {/* Header colorido */}
      <div className={`${headerBg} px-4 pb-6 pt-14`}>
        <div className="mb-6 flex items-center">
          <button type="button" onClick={onClose} className="mr-3 text-white/80 hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h2 className="flex-1 text-center text-base font-medium text-white">
            {transaction ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <div className="w-8" />
        </div>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Receipt size={20} className="text-white" />
          </div>
          <span className="text-sm text-white/80">{isIncome ? "Receita" : "Despesa"}</span>
        </div>
        <div className="mb-1 flex items-end gap-1.5">
          <span className="pb-1 text-xl font-bold text-white/70">{currencySymbol(currency)}</span>
          <input
            name="amount"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value, currency))}
            required
            placeholder={`0${decimalSeparator(currency)}00`}
            className="min-w-0 flex-1 bg-transparent text-4xl font-bold text-white outline-none placeholder:text-white/50"
          />
        </div>
        <p className="mb-5 text-sm text-white/60">Toque para informar o valor</p>
        <div className="flex rounded-full bg-white/20 p-1">
          <label className={`flex-1 cursor-pointer rounded-full py-2.5 text-center text-sm font-semibold transition ${!isIncome ? "bg-white text-red-500 shadow" : "text-white"}`}>
            <input className="sr-only" type="radio" name="type" value="expense" checked={!isIncome} onChange={() => setType("expense")} />
            Despesa
          </label>
          <label className={`flex-1 cursor-pointer rounded-full py-2.5 text-center text-sm font-semibold transition ${isIncome ? "bg-white text-emerald-500 shadow" : "text-white"}`}>
            <input className="sr-only" type="radio" name="type" value="income" checked={isIncome} onChange={() => setType("income")} />
            Receita
          </label>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 pb-32">
        {/* Descrição */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Descrição <span className="text-red-400">*</span></p>
            <input
              name="description"
              defaultValue={transaction?.description ?? ""}
              required
              placeholder="Sem descrição"
              className="w-full bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
            />
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
          <button type="button" onClick={() => setQuickCategoryOpen(true)} className="relative z-10 shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-500">
            + Nova
          </button>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="absolute inset-0 z-[5] cursor-pointer opacity-0">
            <option value="">Selecione</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* ONDE LANÇAR */}
        <p className="px-4 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Onde Lançar</p>
        <div className="grid grid-cols-2 gap-3 px-4">
          <button type="button"
            onClick={() => { setDestKind("bank"); const id = bankAccounts[0]?.id ?? ""; setSelectedAccountId(id); handleAccountChange(id); }}
            className={`rounded-2xl border-2 p-4 text-left transition ${destKind === "bank" ? `${accentBorder} ${accentBg}` : "border-slate-200 bg-white"}`}>
            <Building2 size={20} className={destKind === "bank" ? accentText : "text-slate-400"} />
            <p className={`mt-1 text-sm font-semibold ${destKind === "bank" ? accentText : "text-slate-950"}`}>Conta</p>
            <p className="text-xs text-slate-400">Movimenta saldo</p>
          </button>
          <button type="button"
            onClick={() => { setDestKind("card"); const id = cardAccounts[0]?.id ?? ""; setSelectedAccountId(id); handleAccountChange(id); }}
            className={`rounded-2xl border-2 p-4 text-left transition ${destKind === "card" ? `${accentBorder} ${accentBg}` : "border-slate-200 bg-white"}`}>
            <CreditCard size={20} className={destKind === "card" ? accentText : "text-slate-400"} />
            <p className={`mt-1 text-sm font-semibold ${destKind === "card" ? accentText : "text-slate-950"}`}>Cartão</p>
            <p className="text-xs text-slate-400">Entra na fatura</p>
          </button>
        </div>

        {/* Conta selecionada */}
        <div className="relative mt-2 flex items-center gap-3 border-b border-t border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            {destKind === "card" ? <CreditCard size={16} /> : <Building2 size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">{destKind === "card" ? "Cartão de Crédito" : "Conta"} <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">
              {accountsForKind.find((a) => a.id === selectedAccountId)?.name ?? <span className="text-slate-400">Obrigatório</span>}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <select name="account_id" value={selectedAccountId} onChange={(e) => { setSelectedAccountId(e.target.value); handleAccountChange(e.target.value); }} required className="absolute inset-0 cursor-pointer opacity-0">
            <option value="">Selecione</option>
            {accountsForKind.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Vencimento */}
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CalendarDays size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Vencimento</p>
            <p className="text-sm font-medium text-slate-950">{dueDate ? dateBR(dueDate) : "Sem vencimento"}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <input type="date" name="due_date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </div>

        {/* Competência */}
        <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CalendarDays size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Competência <span className="text-red-400">*</span></p>
            <p className="text-sm font-medium text-slate-950">{dateBR(date)}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required className="absolute inset-0 cursor-pointer opacity-0" />
        </div>

        {/* OPÇÕES AVANÇADAS */}
        <p className="px-4 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Opções Avançadas</p>

        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <RotateCcw size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-950">{isIncome ? "Receita Fixa" : "Despesa Fixa"}</p>
            <p className="text-xs text-slate-400">Classifica como uma {isIncome ? "receita" : "despesa"} fixa</p>
          </div>
          <button type="button" onClick={() => setIsFixed((v) => !v)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${isFixed ? "bg-blue-500" : "bg-slate-200"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${isFixed ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {isIncome && (
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Landmark size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-950">Calcular Dízimo</p>
              <p className="text-xs text-slate-400">Inclui no cálculo do dízimo (10%)</p>
            </div>
            <button type="button" onClick={() => setTitheEligible((v) => !v)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${titheEligible ? "bg-blue-500" : "bg-slate-200"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${titheEligible ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        )}

        {formError && (
          <p className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
        )}
      </div>

      {/* Botão salvar fixo */}
      <div className="fixed bottom-0 left-0 right-0 z-[65] border-t border-slate-100 bg-white p-4">
        <button type="submit" disabled={saving} className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-white transition ${headerBg} disabled:opacity-70`}>
          {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Receipt size={18} />}
          {saving ? "Salvando..." : `Salvar ${isIncome ? "Receita" : "Despesa"}`}
        </button>
      </div>

      {quickCategoryOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-3 backdrop-blur">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950">Nova categoria</h3>
              <button type="button" onClick={() => setQuickCategoryOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
            <input autoFocus value={quickCategoryName} onChange={(e) => setQuickCategoryName(e.target.value)} placeholder="Nome da categoria" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-orange-400" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setQuickCategoryOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Cancelar</button>
              <button type="button" onClick={createCategoryFromModal} disabled={pendingCategory} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default function FinancePanel({ categories, accounts, accountBalances, transactions, filters }: Props) {
  const router = useRouter();
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const [activeView, setActiveView] = useState<"home" | "entries" | "transfers" | "settings">("home");
  const [selectedMonth, setSelectedMonth] = useState(filters.month);
  const [rangeFilter, setRangeFilter] = useState({ from: filters.from, to: filters.to });
  const [currencyFilter, setCurrencyFilter] = useState(filters.currency);
  const [detailFilters, setDetailFilters] = useState({ category: filters.category, type: filters.type, account: "" });
  const [entryFilter, setEntryFilter] = useState<"all" | "income" | "expense" | "card">("all");
  const [entrySearchOpen, setEntrySearchOpen] = useState(false);
  const [entrySearch, setEntrySearch] = useState("");
  const [transactionModal, setTransactionModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [accountCreateModal, setAccountCreateModal] = useState(false);
  const [createKind, setCreateKind] = useState("bank");
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [accountRequiredModal, setAccountRequiredModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [dateRangeModal, setDateRangeModal] = useState(false);
  const [dateRangeStep, setDateRangeStep] = useState<"from" | "to">("from");
  const [draftRange, setDraftRange] = useState({ from: rangeFilter.from || "", to: rangeFilter.to || "" });
  const [actionBusy, setActionBusy] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const monthDate = new Date(`${selectedMonth}-02T00:00:00`);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().slice(0, 10);
  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1).toISOString().slice(0, 7);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString().slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(monthDate);
  const currentDay = today();
  const sevenDaysAgo = addDays(currentDay, -7);
  const yearStart = `${monthDate.getFullYear()}-01-01`;
  const yearEnd = `${monthDate.getFullYear()}-12-31`;
  const selectedRangeStart = rangeFilter.from || monthStart;
  const selectedRangeEnd = rangeFilter.to || monthEnd;
  const selectedRangeLabel = `${dateBR(selectedRangeStart)} - ${dateBR(selectedRangeEnd)}`;
  const hasAdvancedFilters = Boolean(detailFilters.category || detailFilters.type || detailFilters.account);
  const activePeriod =
    rangeFilter.from === currentDay && rangeFilter.to === currentDay
      ? "today"
      : rangeFilter.from === sevenDaysAgo && rangeFilter.to === currentDay
        ? "week"
        : rangeFilter.from === yearStart && rangeFilter.to === yearEnd
          ? "year"
          : "month";
  const viewButtonClass = "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[9px] font-medium";
  const entrySearchTerm = entrySearch.trim().toLowerCase();
  const filteredTransactions = transactions.filter((transaction) => {
    const isInRange = transaction.date >= selectedRangeStart && transaction.date <= selectedRangeEnd;
    const matchesCategory = !detailFilters.category || transaction.category_id === detailFilters.category;
    const matchesType = !detailFilters.type || transaction.type === detailFilters.type;
    const matchesAccount = !detailFilters.account || transaction.account_id === detailFilters.account;
    return isInRange && matchesCategory && matchesType && matchesAccount && transaction.currency === currencyFilter;
  });
  const computedMetrics = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const expenses = filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const titheBase = filteredTransactions
      .filter((item) => item.type === "income" && item.tithe_eligible)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const scheduledExpenses = filteredTransactions
      .filter((item) => item.type === "expense" && item.due_date && item.due_date >= selectedRangeStart && item.due_date <= selectedRangeEnd)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const expenseByCategory = filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce<Record<string, number>>((acc, item) => {
        const name = categoryName(item);
        acc[name] = (acc[name] ?? 0) + Number(item.amount ?? 0);
        return acc;
      }, {});
    const topExpenses = Object.entries(expenseByCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { income, expenses, balance: income - expenses, projectedBalance: income - expenses - scheduledExpenses, tithe: titheBase * 0.1, topExpenses };
  }, [filteredTransactions, selectedRangeEnd, selectedRangeStart]);
  const maxExpense = useMemo(
    () => Math.max(...computedMetrics.topExpenses.map((item) => item.amount), 1),
    [computedMetrics.topExpenses],
  );
  const visibleTransactions = filteredTransactions.filter((transaction) => {
    const isCard = transaction.mode === "credit_purchase" || (Array.isArray(transaction.finance_accounts)
      ? transaction.finance_accounts[0]?.kind === "credit_card"
      : transaction.finance_accounts?.kind === "credit_card");
    const matchesQuickFilter =
      entryFilter === "all" ||
      transaction.type === entryFilter ||
      (entryFilter === "card" && isCard);
    const searchable = [
      transaction.description,
      transaction.location,
      transaction.notes,
      categoryName(transaction),
      accountName(transaction),
    ].join(" ").toLowerCase();

    return matchesQuickFilter && (!entrySearchTerm || searchable.includes(entrySearchTerm));
  });
  const transactionsByDate = visibleTransactions.reduce<Record<string, FinanceTransaction[]>>((acc, transaction) => {
    acc[transaction.date] = [...(acc[transaction.date] ?? []), transaction];
    return acc;
  }, {});
  const entryDates = Object.keys(transactionsByDate).sort((a, b) => b.localeCompare(a));

  function openTransactionModal() {
    if (!accounts.length) {
      setAccountRequiredModal(true);
      return;
    }
    setTransactionModal(true);
  }

  function showActionFeedback() {
    setActionBusy(true);
    if (busyTimer.current) clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(() => setActionBusy(false), 550);
  }

  function openDateRangeModal() {
    setDraftRange({ from: rangeFilter.from || monthStart, to: rangeFilter.to || monthEnd });
    setDateRangeStep("from");
    setDateRangeModal(true);
  }

  function applyDateRange() {
    setRangeFilter({
      from: draftRange.from || monthStart,
      to: draftRange.to || draftRange.from || monthEnd,
    });
    setDateRangeModal(false);
  }

  useEffect(() => {
    if (dateRangeModal && dateRangeStep === "to") {
      endDateRef.current?.focus();
      try {
        endDateRef.current?.showPicker?.();
      } catch {
        // Some browsers only allow showPicker directly inside the click event.
      }
    }
  }, [dateRangeModal, dateRangeStep]);

  useEffect(() => {
    return () => {
      if (busyTimer.current) clearTimeout(busyTimer.current);
    };
  }, []);

  const periodTabs = [
    { key: "today", label: "Hoje", from: currentDay, to: currentDay, month: currentDay.slice(0, 7) },
    { key: "week", label: "7 dias atrás", from: sevenDaysAgo, to: currentDay, month: currentDay.slice(0, 7) },
    { key: "month", label: "Este mês", from: "", to: "", month: selectedMonth },
    { key: "year", label: "Esse ano", from: yearStart, to: yearEnd, month: selectedMonth },
  ];

  return (
    <div
      className="finance-panel -mx-4 -my-6 min-h-screen bg-slate-50 pb-28 text-slate-950 sm:-mx-6"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        const actionable = target.closest("button, a");
        if (actionable && !actionable.hasAttribute("disabled")) showActionFeedback();
      }}
    >
      <BusyIndicator show={actionBusy} />
      <div className="px-2 pt-2 text-slate-950 sm:px-3">
          <div className="mx-auto max-w-6xl rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm shadow-slate-200/80 sm:p-3">
            <div className="grid grid-cols-[38px_1fr_38px] items-center gap-2 sm:grid-cols-[42px_1fr_42px]">
              <button type="button" onClick={() => { setSelectedMonth(prevMonth); setRangeFilter({ from: "", to: "" }); }} className="flex h-[38px] w-[38px] max-w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm shadow-slate-200 sm:h-[42px] sm:w-[42px]" aria-label="Mês anterior">
                <ArrowLeft size={19} strokeWidth={2.1} />
              </button>
              <h1 className="text-center text-xl font-semibold capitalize leading-none text-slate-950 sm:text-2xl">{monthLabel}</h1>
              <button type="button" onClick={() => { setSelectedMonth(nextMonth); setRangeFilter({ from: "", to: "" }); }} className="flex h-[38px] w-[38px] max-w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm shadow-slate-200 sm:h-[42px] sm:w-[42px]" aria-label="Próximo mês">
                <ArrowRight size={19} strokeWidth={2.1} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200">
              {periodTabs.map((tab, index) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setSelectedMonth(tab.month); setRangeFilter({ from: tab.from, to: tab.to }); }}
                  className={`flex h-9 items-center justify-center border-slate-200 px-1 text-center text-xs font-medium transition sm:h-10 sm:px-2 sm:text-sm ${
                    index > 0 ? "border-l" : ""
                  } ${
                    activePeriod === tab.key
                      ? "finance-period-tab-active bg-emerald-600 text-white"
                      : "bg-white text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <button
                type="button"
                onClick={openDateRangeModal}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-medium text-slate-950 shadow-sm shadow-slate-200 transition hover:bg-slate-50 sm:h-10 sm:px-4 sm:text-sm"
              >
                <CalendarDays size={16} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{selectedRangeLabel}</span>
              </button>

              <div className="flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200 sm:h-10">
                <button type="button" onClick={() => router.refresh()} className="flex w-10 items-center justify-center border-r border-slate-200 text-slate-950 sm:w-11" aria-label="Atualizar dados">
                  <RotateCcw size={17} strokeWidth={2} />
                </button>
                <button type="button" onClick={() => setDetailFilters({ category: "", type: "", account: "" })} className="flex w-10 items-center justify-center border-r border-slate-200 text-slate-950 sm:w-11" aria-label="Limpar filtros avançados">
                  <Paintbrush size={17} strokeWidth={2} />
                </button>
                <button type="button" onClick={() => setDetailModal(true)} className={`flex w-10 items-center justify-center text-slate-950 sm:w-11 ${hasAdvancedFilters ? "bg-emerald-50" : "bg-white"}`} aria-label="Abrir filtros">
                  <Funnel size={17} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4">
        {activeView === "home" ? (
          <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Entradas" value={money(computedMetrics.income, currencyFilter)} tone="income">
          <p className="text-[11px] font-normal text-slate-500">Recebido no período</p>
        </MetricCard>
        <MetricCard label="Saídas" value={money(computedMetrics.expenses, currencyFilter)} tone="expense">
          <p className="text-[11px] font-normal text-slate-500">Despesas registradas</p>
        </MetricCard>
        <MetricCard label="Saldo" value={money(computedMetrics.balance, currencyFilter)} tone="balance">
          <p className="text-[11px] font-normal text-slate-500">Receita menos despesas</p>
        </MetricCard>
        <MetricCard label="Dízimo" value={money(computedMetrics.tithe, currencyFilter)} tone="tithe">
          <p className="text-[11px] font-normal text-slate-500">Base das entradas marcadas</p>
        </MetricCard>
      </div>
      <div className="app-card mt-2.5 rounded-xl p-2.5 sm:p-3">
        <p className="flex items-center gap-1.5 text-[9px] font-medium text-blue-700 sm:text-[11px]"><CalendarDays size={11} />Saldo previsto</p>
        <p className="mt-1.5 text-base font-semibold leading-tight text-blue-700 sm:text-lg">{money(computedMetrics.projectedBalance, currencyFilter)}</p>
        <p className="mt-1 text-[9px] font-normal text-slate-500 sm:text-[10px]">Considera lançamentos e vencimentos do mês.</p>
      </div>

      <section className="app-card mt-5 p-4 sm:p-5">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 size={20} className="text-slate-600" />
          <h2 className="text-base font-semibold text-slate-950">Gastos por categoria</h2>
        </div>
        {computedMetrics.topExpenses.length ? (
          <div className="space-y-4">
            {computedMetrics.topExpenses.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex justify-between gap-3 text-xs"><span>{item.name}</span><span className="font-medium">{money(item.amount, currencyFilter)}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max((item.amount / maxExpense) * 100, 4)}%` }} /></div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-xs text-slate-500">Nenhuma saída lançada neste mês.</p>
        )}
      </section>
      <section className="app-card mt-5 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Carteira</h2>
          <button onClick={() => setAccountModal(true)} className="text-xs font-medium text-emerald-700">Gerenciar →</button>
        </div>
        {accounts.length ? (
          <div className="mt-5 space-y-3">
            {accounts.map((account) => {
              const bal = accountBalances[account.id] ?? 0;
              const isCard = account.kind === "credit_card";
              const bill = isCard ? Math.max(0, -bal) : 0;
              const available = isCard && account.credit_limit != null ? account.credit_limit - bill : null;
              return (
                <div key={account.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{account.name}</span>
                      <span className="ml-2 text-slate-400">{accountKindLabel(account.kind)}</span>
                    </div>
                    {isCard
                      ? <span className={`font-semibold ${bill > 0 ? "text-red-500" : "text-slate-400"}`}>Fatura: {money(bill, account.currency)}</span>
                      : <span className={`font-semibold ${bal >= 0 ? "text-emerald-600" : "text-red-500"}`}>{money(bal, account.currency)}</span>
                    }
                  </div>
                  {isCard && account.credit_limit != null && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min((bill / account.credit_limit) * 100, 100)}%` }} />
                      </div>
                      <span className={`font-medium ${available! >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {money(available!, account.currency)} disponível de {money(account.credit_limit, account.currency)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="font-medium text-slate-950">Nenhuma conta cadastrada</p>
            <p className="mt-1 text-xs text-slate-500">Adicione uma conta, banco ou cartão para começar a lançar entradas e saídas.</p>
            <button onClick={() => setAccountModal(true)} className="mt-4 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white">
              + Criar conta
            </button>
          </div>
        )}
      </section>
          </>
        ) : null}

        {activeView === "entries" ? (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Lançamentos</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEntrySearchOpen((value) => !value)}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-slate-700 shadow-sm ${
                    entrySearchOpen ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                  aria-label="Buscar lançamentos"
                >
                  <Search size={19} />
                </button>
                <button onClick={openTransactionModal} className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700">
                  + Novo
                </button>
              </div>
            </div>

            {entrySearchOpen ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Search size={18} className="shrink-0 text-slate-400" />
                  <input
                    value={entrySearch}
                    onChange={(event) => setEntrySearch(event.target.value)}
                    placeholder="Buscar por local, categoria, apoiador..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-950 outline-none placeholder:text-slate-500"
                  />
                </div>
                <button onClick={() => setDetailModal(true)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700 shadow-sm hover:text-slate-950">
                  Filtro avançado
                </button>
              </div>
            ) : null}

            <div className="mb-5 grid grid-cols-4 rounded-2xl bg-slate-100 p-1">
              {[
                { key: "all", label: "Todos" },
                { key: "income", label: "↑ Entradas" },
                { key: "expense", label: "↓ Saídas" },
                { key: "card", label: "Cartão" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setEntryFilter(item.key as typeof entryFilter)}
                  className={`min-h-10 border-b-2 px-1 text-[9px] font-medium transition sm:text-xs ${
                    entryFilter === item.key
                      ? "rounded-xl border-transparent bg-white text-slate-950 shadow-sm"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <button type="button" onClick={() => { setSelectedMonth(prevMonth); setRangeFilter({ from: "", to: "" }); }} className="text-2xl text-slate-500 hover:text-slate-950">‹</button>
              <p className="text-base font-semibold capitalize text-slate-950">{monthLabel}</p>
              <button type="button" onClick={() => { setSelectedMonth(nextMonth); setRangeFilter({ from: "", to: "" }); }} className="text-2xl text-slate-500 hover:text-slate-950">›</button>
            </div>

            <div className="space-y-6">
              {entryDates.map((date) => (
                <div key={date}>
                  <div className="mb-3 flex items-center gap-3">
                    <p className="shrink-0 font-mono text-[10px] font-normal tracking-widest text-slate-400">{dateBR(date)}</p>
                    <div className="h-px flex-1 bg-slate-800" />
                  </div>
                  <div className="space-y-3">
                    {transactionsByDate[date].map((transaction) => {
                      const isIncome = transaction.type === "income";
                      return (
                        <div
                          key={transaction.id}
                          className={`grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center ${
                            isIncome ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-red-400"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <span className={`h-2.5 w-2.5 rounded-full ${isIncome ? "bg-emerald-400" : "bg-red-400"}`} />
                              <p className="truncate text-sm font-medium text-slate-950">{transaction.description}</p>
                            </div>
                            <p className="mt-1 truncate pl-5 text-[10px] text-slate-400">
                              {categoryName(transaction)} · {accountName(transaction)}
                            </p>
                          </div>
                          <div className="pl-5 text-left sm:pl-0 sm:text-right">
                            <p className={`text-base font-semibold ${isIncome ? "text-emerald-700" : "text-red-500"}`}>
                              {isIncome ? "+" : "-"}{money(transaction.amount, transaction.currency)}
                            </p>
                            <p className="text-[9px] font-normal text-slate-500">{transaction.currency}</p>
                          </div>
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setEditing(transaction)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950" aria-label="Editar lançamento">
                              <Pencil size={15} />
                            </button>
                            <form action={deleteTransaction.bind(null, transaction.id)}>
                              <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-500" aria-label="Excluir lançamento">
                                <Trash2 size={15} />
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!entryDates.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                  Nenhum lançamento encontrado neste mês.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeView === "transfers" ? (
          <section className="app-card p-4 sm:p-5">
            <h2 className="text-base font-semibold">Transferências</h2>
            <p className="mt-2 text-xs text-slate-400">Base pronta para mover valores entre contas. A lógica contábil da transferência entra na próxima etapa.</p>
            <button onClick={() => setAccountModal(true)} className="mt-5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white">Gerenciar contas</button>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="app-card p-4 sm:p-5">
            <h2 className="text-base font-semibold">Ajustes</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button onClick={() => setAccountModal(true)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs font-medium">Contas</button>
              <button onClick={() => setCategoryModal(true)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs font-medium">Categorias</button>
              <Link href="/admin/financeiro/cambio" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs font-medium">Câmbio</Link>
            </div>
          </section>
        ) : null}
      </div>

      {(activeView === "home" || activeView === "entries") ? (
        <button onClick={openTransactionModal} className="fixed bottom-32 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-2xl font-medium text-white shadow-lg lg:bottom-20">+</button>
      ) : null}

      <nav className="fixed bottom-12 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-12px_28px_rgb(15_23_42/0.08)] backdrop-blur lg:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-1">
          <button onClick={() => setActiveView("home")} className={`${viewButtonClass} rounded-2xl ${activeView === "home" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}><Home size={19} />Início</button>
          <button onClick={() => setActiveView("entries")} className={`${viewButtonClass} rounded-2xl ${activeView === "entries" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}><ArrowUpDown size={19} />Lançamentos</button>
          <button onClick={() => setActiveView("transfers")} className={`${viewButtonClass} rounded-2xl ${activeView === "transfers" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}><ArrowLeftRight size={19} />Transferências</button>
          <Link href="/admin/financeiro/ajustes" className={`${viewButtonClass} rounded-2xl ${activeView === "settings" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}><Settings size={19} />Ajustes</Link>
        </div>
      </nav>

      <Modal title="Novo lançamento" open={transactionModal} onClose={() => setTransactionModal(false)} variant="sheet">
        <TransactionForm
          categories={categories}
          accounts={accounts}
          onEditAccounts={() => setAccountModal(true)}
          onClose={() => setTransactionModal(false)}
          onSaved={() => setTransactionModal(false)}
        />
      </Modal>

      <Modal title="Cadastre uma conta" open={accountRequiredModal} onClose={() => setAccountRequiredModal(false)}>
        <div className="space-y-4 text-slate-300">
          <p>
            Antes de fazer um lançamento financeiro, é necessário inserir pelo menos uma conta,
            banco ou cartão. Assim o sistema sabe de onde o dinheiro entra ou sai.
          </p>
          <button
            type="button"
            onClick={() => {
              setAccountRequiredModal(false);
              setAccountCreateModal(true);
            }}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900"
          >
            Inserir conta agora
          </button>
        </div>
      </Modal>

      <Modal title="Categorias" open={categoryModal} onClose={() => setCategoryModal(false)}>
        <div className="space-y-5">
          <section className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">Cadastrar nova categoria</h3>
              <p className="mt-1 text-xs text-slate-400">Use nomes curtos para facilitar a leitura nos lançamentos.</p>
            </div>
            <form action={addCategory} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input name="name" required placeholder="Ex: Alimentação, Luz, Oferta" className="min-w-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-slate-500" />
              <button type="submit" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Adicionar</button>
            </form>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Categorias cadastradas</h3>
              <span className="text-xs text-slate-500">{categories.length} {categories.length === 1 ? "item" : "itens"}</span>
            </div>
            <div className="space-y-2">
              {categories.map((category) => (
                <form key={category.id} action={updateCategory.bind(null, category.id)} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2">
                  <div className="min-w-0">
                    <input name="name" defaultValue={category.name} required className="min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-white outline-none focus:border-slate-700" />
                    <p className="px-2 text-xs text-slate-500">Categoria de lançamento</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="submit" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-orange-500/10 hover:text-orange-300" aria-label="Salvar categoria">
                      <Pencil size={15} />
                    </button>
                    <button formAction={deleteCategory.bind(null, category.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label="Excluir categoria">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </section>
        </div>
      </Modal>

      <Modal title="Contas, bancos e cartões" open={accountModal} onClose={() => setAccountModal(false)}>
        <div className="space-y-5">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Contas cadastradas</h3>
              <button
                type="button"
                onClick={() => setAccountCreateModal(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
              >
                <Plus size={14} />Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-base font-semibold text-orange-200">
                    {currencySymbol(account.currency)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{account.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{account.currency} · {accountKindLabel(account.kind)}</p>
                    {(() => {
                      const bal = accountBalances[account.id] ?? 0;
                      if (account.kind === "credit_card") {
                        const bill = Math.max(0, -bal);
                        return <p className={`mt-0.5 text-xs font-semibold ${bill > 0 ? "text-red-400" : "text-slate-400"}`}>Fatura: {money(bill, account.currency)}{account.credit_limit != null ? ` · Limite: ${money(account.credit_limit, account.currency)}` : ""}</p>;
                      }
                      return <p className={`mt-0.5 text-xs font-semibold ${bal >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(bal, account.currency)}</p>;
                    })()}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditingAccount(account)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-orange-500/10 hover:text-orange-300" aria-label="Editar conta">
                      <Pencil size={15} />
                    </button>
                    <form action={deleteAccount.bind(null, account.id)}>
                      <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label="Excluir conta">
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {!accounts.length ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                  Nenhuma conta cadastrada ainda.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </Modal>

      <Modal title="Adicionar conta" open={accountCreateModal} onClose={() => setAccountCreateModal(false)}>
        <form action={addAccount} className="grid gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Nome</label>
            <input name="name" required placeholder="Ex: Nubank, Caixa, Visa" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-slate-500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Tipo</label>
              <select name="kind" value={createKind} onChange={(e) => setCreateKind(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white">
                <option value="bank">Conta</option>
                <option value="cash">Dinheiro</option>
                <option value="credit_card">Cartão</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Moeda</label>
              <select name="currency" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white">
                {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
              </select>
            </div>
          </div>
          {createKind === "credit_card" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Limite do cartão</label>
              <input name="credit_limit" type="number" step="0.01" placeholder="Ex: 5000,00" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-slate-500" />
            </div>
          )}
          <button type="submit" className="mt-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600">
            Salvar
          </button>
        </form>
      </Modal>

      <Modal title="Editar conta" open={Boolean(editingAccount)} onClose={() => setEditingAccount(null)}>
        {editingAccount ? (
          <form action={updateAccount.bind(null, editingAccount.id)} className="grid gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Nome</label>
              <input name="name" defaultValue={editingAccount.name} required className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500" />
            </div>
            {editingAccount.kind === "credit_card" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Fatura atual (o que você deve)</label>
                  <input name="target_balance" type="number" step="0.01" defaultValue={Math.max(0, -(accountBalances[editingAccount.id] ?? 0))} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500" />
                  <p className="mt-1 text-xs text-slate-500">Ajustar este valor cria um lançamento de correção automático.</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Limite do cartão</label>
                  <input name="credit_limit" type="number" step="0.01" defaultValue={editingAccount.credit_limit ?? ""} placeholder="Ex: 5000,00" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-slate-500" />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Saldo atual</label>
                <input name="target_balance" type="number" step="0.01" defaultValue={accountBalances[editingAccount.id] ?? 0} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500" />
                <p className="mt-1 text-xs text-slate-500">Alterar este valor cria um lançamento de ajuste automático.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Tipo</label>
                <select name="kind" defaultValue={editingAccount.kind} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white">
                  <option value="bank">Conta</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Moeda</label>
                <select name="currency" defaultValue={editingAccount.currency} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white">
                  {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="mt-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600">
              Salvar
            </button>
          </form>
        ) : null}
      </Modal>

      <Modal title="Período" open={dateRangeModal} onClose={() => setDateRangeModal(false)}>
        <div className="grid gap-4 text-slate-950">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">
              {dateRangeStep === "from" ? "Escolha a data de início" : "Agora escolha a data de fim"}
            </p>
            <p className="mt-1 text-xs text-slate-500">O painel será filtrado por esse intervalo.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Início</span>
              <input
                autoFocus
                type="date"
                value={draftRange.from}
                onChange={(event) => {
                  const from = event.target.value;
                  setDraftRange((current) => ({
                    from,
                    to: current.to && current.to < from ? from : current.to,
                  }));
                  setDateRangeStep("to");
                }}
                className={`rounded-2xl border px-3 py-3 text-slate-950 outline-none ${
                  dateRangeStep === "from" ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"
                }`}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Fim</span>
              <input
                ref={endDateRef}
                type="date"
                value={draftRange.to}
                min={draftRange.from || undefined}
                onChange={(event) => {
                  setDraftRange((current) => ({ ...current, to: event.target.value }));
                  setDateRangeStep("to");
                }}
                className={`rounded-2xl border px-3 py-3 text-slate-950 outline-none ${
                  dateRangeStep === "to" ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"
                }`}
              />
            </label>
          </div>

          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <button
              type="button"
              onClick={() => {
                setRangeFilter({ from: "", to: "" });
                setDateRangeModal(false);
              }}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={applyDateRange}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
            >
              <CalendarDays size={16} />
              Filtrar período
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Relatório detalhado" open={detailModal} onClose={() => setDetailModal(false)}>
        <form
          className="mb-5 grid gap-3 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setRangeFilter({ from: String(formData.get("from") || ""), to: String(formData.get("to") || "") });
            setCurrencyFilter(String(formData.get("currency") || "BRL"));
            setDetailFilters({ category: String(formData.get("category") || ""), type: String(formData.get("type") || ""), account: String(formData.get("account") || "") });
            setDetailModal(false);
          }}
        >
          <input type="date" name="from" defaultValue={rangeFilter.from} className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
          <input type="date" name="to" defaultValue={rangeFilter.to} className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
          <select name="currency" defaultValue={currencyFilter} className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-white">
            {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
          </select>
          <select name="category" defaultValue={detailFilters.category} className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-white">
            <option value="">Todas categorias</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select name="type" defaultValue={detailFilters.type} className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-white">
            <option value="">Entrada e saída</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
          </select>
          <select name="account" defaultValue={detailFilters.account} className="rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-white">
            <option value="">Todas as contas</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 md:w-fit">Filtrar</button>
        </form>
        <div className="divide-y divide-slate-800">
          {filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="grid gap-3 py-4 md:grid-cols-[90px_1fr_auto_auto] md:items-center">
              <p className="text-sm text-slate-400">{dateBR(transaction.date)}</p>
              <div><p className="font-medium text-white">{transaction.description}</p><p className="text-xs text-slate-500">{categoryName(transaction)} · {accountName(transaction)} · {transaction.type === "income" ? "Entrada" : "Saída"} · {transaction.currency}</p></div>
              <p className={transaction.type === "income" ? "font-semibold text-orange-300" : "font-semibold text-red-300"}>{money(transaction.amount, transaction.currency)}</p>
              <div className="flex gap-1">
                <button onClick={() => setEditing(transaction)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Editar"><Pencil size={15} /></button>
                <form action={deleteTransaction.bind(null, transaction.id)}><button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-red-300" aria-label="Excluir"><Trash2 size={15} /></button></form>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal title="Editar lançamento" open={Boolean(editing)} onClose={() => setEditing(null)} variant="sheet">
        {editing ? (
          <TransactionForm
            categories={categories}
            accounts={accounts}
            transaction={editing}
            onEditAccounts={() => setAccountModal(true)}
            onClose={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}
