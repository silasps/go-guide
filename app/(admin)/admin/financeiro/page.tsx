import { getCurrentProfile } from "@/lib/current-profile";
import FinancePanel, { type FinanceCategory, type FinanceTransaction } from "./finance-panel";

const DEFAULT_CATEGORIES = [
  "Dízimo",
  "Carro",
  "Compras",
  "Roupa",
  "Utensílios de casa",
  "Alimentação fora de casa",
  "Saldo inicial",
];

function monthBounds(month?: string) {
  const now = month ? new Date(`${month}-02T00:00:00`) : new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    firstDay: firstDay.toISOString().slice(0, 10),
    lastDay: lastDay.toISOString().slice(0, 10),
    month: firstDay.toISOString().slice(0, 7),
  };
}

function isMissingFinanceSchema(error: { message?: string } | null) {
  return Boolean(
    error?.message &&
      ((error.message.includes("schema cache") &&
        (error.message.includes("finance_categories") ||
          error.message.includes("finance_transactions"))) ||
        error.message.includes("column finance_transactions.type does not exist") ||
        error.message.includes("column finance_transactions.tithe_eligible does not exist") ||
        error.message.includes("column finance_transactions.currency does not exist") ||
        error.message.includes("finance_accounts") ||
        error.message.includes("column finance_transactions.account_id does not exist") ||
        error.message.includes("column finance_transactions.location does not exist") ||
        error.message.includes("column finance_transactions.notes does not exist") ||
        error.message.includes("column finance_accounts.currency does not exist") ||
        error.message.includes("column finance_transactions.mode does not exist")),
  );
}

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceiroPage({ searchParams }: Props) {
  const { supabase, profile } = await getCurrentProfile();
  const params = (await searchParams) ?? {};
  const monthParam = String(params.month || "");
  const { firstDay: monthStart, lastDay: monthEnd, month } = monthBounds(/^\d{4}-\d{2}$/.test(monthParam) ? monthParam : undefined);

  const from = String(params.from || "");
  const to = String(params.to || "");
  const category = String(params.category || "");
  const type = String(params.type || "");
  const currencyParam = String(params.currency || "BRL").toUpperCase();
  const currency = ["BRL", "USD", "EUR"].includes(currencyParam) ? currencyParam : "BRL";

  let categoriesQuery = supabase
    .from("finance_categories")
    .select("id, name")
    .eq("profile_id", profile.id)
    .order("name", { ascending: true });

  const { data: initialCategories, error: categoriesError } = await categoriesQuery;

  if (isMissingFinanceSchema(categoriesError)) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-white">Financeiro</h1>
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          Execute <span className="font-mono">supabase/financeiro.sql</span> no Supabase.
        </div>
      </div>
    );
  }

  if (categoriesError) throw new Error(categoriesError.message);

  const existingCategoryNames = new Set((initialCategories ?? []).map((category) => category.name));
  const missingDefaultCategories = DEFAULT_CATEGORIES.filter((name) => !existingCategoryNames.has(name));

  if (missingDefaultCategories.length) {
    await supabase.from("finance_categories").insert(
      missingDefaultCategories.map((name) => ({
        profile_id: profile.id,
        name,
      })),
    );

    categoriesQuery = supabase
      .from("finance_categories")
      .select("id, name")
      .eq("profile_id", profile.id)
      .order("name", { ascending: true });
  }

  const { data: categories, error: finalCategoriesError } = await categoriesQuery;
  if (finalCategoriesError) throw new Error(finalCategoriesError.message);

  const accountsQuery = supabase
    .from("finance_accounts")
    .select("id, name, kind, currency, credit_limit")
    .eq("profile_id", profile.id)
    .order("name", { ascending: true });

  const { error: accountsError } = await accountsQuery;
  if (isMissingFinanceSchema(accountsError)) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-white">Financeiro</h1>
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          Rode novamente <span className="font-mono">supabase/financeiro.sql</span> no Supabase.
        </div>
      </div>
    );
  }
  if (accountsError) throw new Error(accountsError.message);

  const { data: accounts, error: finalAccountsError } = await accountsQuery;
  if (finalAccountsError) throw new Error(finalAccountsError.message);

  const { data: balanceRows } = await supabase
    .from("finance_transactions")
    .select("account_id, amount, type")
    .eq("profile_id", profile.id);

  const accountBalances: Record<string, number> = {};
  for (const row of balanceRows ?? []) {
    if (!row.account_id) continue;
    const delta = row.type === "income" ? Number(row.amount ?? 0) : -Number(row.amount ?? 0);
    accountBalances[row.account_id] = (accountBalances[row.account_id] ?? 0) + delta;
  }

  let transactionsQuery = supabase
    .from("finance_transactions")
    .select("id, date, description, location, notes, amount, currency, category_id, account_id, type, mode, due_date, tithe_eligible, finance_categories(id, name), finance_accounts(id, name, kind, currency)")
    .eq("profile_id", profile.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  transactionsQuery = transactionsQuery.eq("currency", currency);

  const { data: transactions, error: transactionsError } = await transactionsQuery;

  if (isMissingFinanceSchema(transactionsError)) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-white">Financeiro</h1>
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          Rode novamente <span className="font-mono">supabase/financeiro.sql</span> no Supabase
          para adicionar as colunas novas do financeiro.
        </div>
      </div>
    );
  }

  if (transactionsError) throw new Error(transactionsError.message);

  const typedCategories = (categories ?? []) as FinanceCategory[];
  const typedAccounts = (accounts ?? []);
  const typedTransactions = (transactions ?? []) as unknown as FinanceTransaction[];
  const monthTransactions = typedTransactions.filter((item) => item.date >= monthStart && item.date <= monthEnd && item.currency === currency);
  const income = monthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const expenses = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const titheBase = monthTransactions
    .filter((item) => item.type === "income" && item.tithe_eligible)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const scheduledExpenses = typedTransactions
    .filter((item) => item.currency === currency && item.type === "expense" && item.due_date && item.due_date >= monthStart && item.due_date <= monthEnd)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const expenseByCategory = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce<Record<string, number>>((acc, item) => {
      const name = Array.isArray(item.finance_categories)
        ? item.finance_categories[0]?.name
        : item.finance_categories?.name;
      const key = name || "Sem categoria";
      acc[key] = (acc[key] ?? 0) + Number(item.amount ?? 0);
      return acc;
    }, {});

  const topExpenses = Object.entries(expenseByCategory)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <FinancePanel
      categories={typedCategories}
      accounts={typedAccounts}
      accountBalances={accountBalances}
      transactions={typedTransactions}
      metrics={{
        income,
        expenses,
        balance: income - expenses,
        projectedBalance: income - expenses - scheduledExpenses,
        tithe: titheBase * 0.1,
        topExpenses,
      }}
      filters={{ from, to, category, type, currency, month }}
    />
  );
}
