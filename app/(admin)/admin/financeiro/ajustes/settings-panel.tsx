"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import FinanceClickFeedback from "@/components/finance-click-feedback";
import { ArrowLeft, CreditCard, Landmark, MessageCircle, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import {
  addAccount,
  addCategory,
  deleteAccount,
  deleteCategory,
  updateAccount,
  updateCategory,
} from "../actions";

export type FinanceSettingsCategory = {
  id: string;
  name: string;
};

export type FinanceSettingsAccount = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  credit_limit: number | null;
};

type Props = {
  accounts: FinanceSettingsAccount[];
  categories: FinanceSettingsCategory[];
};

const CURRENCIES = [
  { code: "BRL", label: "R$ BRL - Real" },
  { code: "USD", label: "$ USD - Dolar" },
  { code: "EUR", label: "€ EUR - Euro" },
];

const ACCOUNT_KINDS = [
  { value: "bank", label: "Conta", icon: Landmark },
  { value: "cash", label: "Dinheiro", icon: Wallet },
  { value: "credit_card", label: "Cartão", icon: CreditCard },
];

const TABS = [
  { key: "accounts", label: "Contas" },
  { key: "categories", label: "Categorias" },
  { key: "preferences", label: "Preferências" },
  { key: "about", label: "Sobre" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function accountIcon(account: FinanceSettingsAccount) {
  if (account.currency === "USD") return "$";
  if (account.currency === "EUR") return "€";
  return "R$";
}

function accountKindLabel(kind: string) {
  return ACCOUNT_KINDS.find((item) => item.value === kind)?.label ?? "Conta";
}

function SettingsCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950"
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

function AccountForm({
  account,
  onCancel,
}: {
  account?: FinanceSettingsAccount;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState(account?.kind ?? "bank");
  const action = account ? updateAccount.bind(null, account.id) : addAccount;

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">Nome da conta</span>
        <input
          name="name"
          defaultValue={account?.name ?? ""}
          required
          placeholder="Ex: Bradesco, Santander, Cartão..."
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-slate-700"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">Moeda</span>
        <select
          name="currency"
          defaultValue={account?.currency ?? "BRL"}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-slate-700"
        >
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      {!account ? (
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">Saldo inicial</span>
          <input
            name="initial_balance"
            inputMode="decimal"
            placeholder="Ex: 1500,00"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-slate-700"
          />
        </label>
      ) : null}

      {kind === "credit_card" && (
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">Limite do cartão</span>
          <input
            name="credit_limit"
            inputMode="decimal"
            placeholder="Ex: 5000,00"
            defaultValue={account?.credit_limit ?? ""}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-slate-700"
          />
        </label>
      )}

      <div className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">Tipo de conta</span>
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
          {ACCOUNT_KINDS.map((item) => {
            const Icon = item.icon;
            const active = kind === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setKind(item.value)}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <Icon size={16} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-2xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-900"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="min-h-12 rounded-2xl bg-orange-500 px-4 text-sm font-bold uppercase tracking-[0.18em] text-white hover:bg-orange-600"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}

export default function FinanceSettingsPanel({ accounts, categories }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("accounts");
  const [defaultCurrency, setDefaultCurrency] = useState("BRL");
  const [accountCreateModal, setAccountCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceSettingsAccount | null>(null);
  const categoryGroups = useMemo(
    () => [
      {
        title: "Categorias",
        items: categories,
      },
    ],
    [categories],
  );

  function saveDefaultCurrency() {
    localStorage.setItem("finance-default-currency", defaultCurrency);
  }

  return (
    <FinanceClickFeedback className="-mx-4 -my-6 min-h-screen bg-slate-950 text-white sm:-mx-6">
      <div className="bg-slate-950 px-4 pt-4 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3">
            <Link href="/admin/financeiro" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
              <ArrowLeft size={16} /> Financeiro
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1 border-b border-slate-800">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-12 border-b-2 px-1 text-center text-xs font-semibold transition sm:text-sm ${
                  activeTab === tab.key
                    ? "border-orange-400 text-orange-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {activeTab === "accounts" ? (
          <section>
            <div className="mb-5 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">Contas bancárias</h1>
              <button
                type="button"
                onClick={() => setAccountCreateModal(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>

            <div className="space-y-3">
              {accounts.map((account) => (
                <SettingsCard key={account.id}>
                  <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-lg font-semibold text-orange-200">
                      {accountIcon(account)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white sm:text-lg">{account.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{account.currency} · {accountKindLabel(account.kind)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingAccount(account)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-orange-500/10 hover:text-orange-300"
                        aria-label="Editar conta"
                      >
                        <Pencil size={16} />
                      </button>
                      <form action={deleteAccount.bind(null, account.id)}>
                        <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label="Excluir conta">
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </div>
                  </div>
                </SettingsCard>
              ))}
              {!accounts.length ? (
                <SettingsCard className="text-center">
                  <p className="font-semibold text-white">Nenhuma conta cadastrada ainda.</p>
                  <p className="mt-1 text-sm text-slate-400">Adicione só o essencial para começar a lançar entradas e saídas.</p>
                </SettingsCard>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "categories" ? (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">Categorias</h1>
            </div>

            <form action={addCategory} className="mb-5 flex min-w-0 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <input name="name" required placeholder="Nova categoria" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-500" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                <Plus size={16} />Adicionar
              </button>
            </form>

            <div className="space-y-4">
              {categoryGroups.map((group) => (
                <div key={group.title} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                    <h2 className="text-base font-semibold">{group.title}</h2>
                    <span className="text-sm text-slate-400">{group.items.length} categorias</span>
                  </div>
                  <div className="space-y-3 p-3 sm:p-4">
                    {group.items.map((category) => (
                      <SettingsCard key={category.id}>
                        <form action={updateCategory.bind(null, category.id)} className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-lg text-orange-200">↓</div>
                          <div className="min-w-0">
                            <input name="name" defaultValue={category.name} required className="min-w-0 rounded-xl border border-transparent bg-transparent px-1 py-1 text-base font-semibold text-white outline-none focus:border-slate-700 sm:text-lg" />
                            <p className="px-1 text-xs text-slate-500">Categoria de lançamento</p>
                          </div>
                          <div className="flex gap-1">
                            <button type="submit" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-orange-500/10 hover:text-orange-300" aria-label="Salvar categoria">
                              <Pencil size={16} />
                            </button>
                            <button formAction={deleteCategory.bind(null, category.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label="Excluir categoria">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </form>
                      </SettingsCard>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "preferences" ? (
          <section>
            <h1 className="mb-5 text-2xl font-semibold text-white sm:text-3xl">Preferências</h1>
            <SettingsCard>
              <h2 className="text-lg font-semibold">Moeda principal</h2>
              <p className="mt-1 text-sm text-slate-400">Define a moeda exibida por padrão nos novos lançamentos.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <select value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500">
                  {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                </select>
                <button type="button" onClick={saveDefaultCurrency} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                  Salvar
                </button>
              </div>
            </SettingsCard>
            <a href="mailto:suporte@sistemamissionario.com?subject=Feedback%20financeiro" className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-orange-500/60">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-white"><MessageCircle size={20} /></span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">Enviar feedback</span>
                  <span className="block text-sm text-slate-400">Sugestões, bugs ou pedidos de moedas</span>
                </span>
              </span>
              <span className="text-lg text-orange-400">→</span>
            </a>
          </section>
        ) : null}

        {activeTab === "about" ? (
          <section>
            <h1 className="mb-5 text-2xl font-semibold text-white sm:text-3xl">Sobre</h1>
            <SettingsCard>
              <h2 className="text-lg font-semibold">Financeiro missionário</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Esta área concentra contas, categorias e preferências usadas nos lançamentos financeiros.
              </p>
              <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-400">
                <Trash2 size={16} /> Excluir uma conta ou categoria remove o vínculo dos lançamentos antigos, sem apagar os lançamentos.
              </div>
            </SettingsCard>
          </section>
        ) : null}
      </main>

      <Modal title="Nova conta" open={accountCreateModal} onClose={() => setAccountCreateModal(false)}>
        <AccountForm onCancel={() => setAccountCreateModal(false)} />
      </Modal>

      <Modal title="Editar conta" open={Boolean(editingAccount)} onClose={() => setEditingAccount(null)}>
        {editingAccount ? <AccountForm account={editingAccount} onCancel={() => setEditingAccount(null)} /> : null}
      </Modal>
    </FinanceClickFeedback>
  );
}
