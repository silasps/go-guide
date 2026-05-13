"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/current-profile";

function cleanString(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseAmount(value: FormDataEntryValue | null) {
  const input = cleanString(value).replace(/[^\d.,-]/g, "");
  const lastComma = input.lastIndexOf(",");
  const lastDot = input.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const raw = decimalIndex >= 0
    ? `${input.slice(0, decimalIndex).replace(/[^\d-]/g, "")}.${input.slice(decimalIndex + 1).replace(/\D/g, "")}`
    : input.replace(/[^\d-]/g, "");
  if (!raw) return null;

  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(value: string, months: number) {
  const source = new Date(`${value}T00:00:00`);
  const day = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return ymd(target);
}

function addMonthsToFatura(value: string, months: number) {
  const source = new Date(`${value}T00:00:00`);
  return ymd(new Date(source.getFullYear(), source.getMonth() + months, 1));
}

function cleanInstallments(value: FormDataEntryValue | null) {
  const count = Number.parseInt(cleanString(value).replace(/\D/g, ""), 10);
  if (!Number.isFinite(count) || count < 2) return 2;
  return Math.min(count, 120);
}

function cleanType(value: FormDataEntryValue | null) {
  return cleanString(value) === "income" ? "income" : "expense";
}

function cleanCurrency(value: FormDataEntryValue | null) {
  const currency = cleanString(value).toUpperCase();
  return ["BRL", "USD", "EUR"].includes(currency) ? currency : "BRL";
}

function cleanMode(value: FormDataEntryValue | null) {
  const mode = cleanString(value);
  return ["normal", "initial_balance", "credit_purchase", "fixed_expense"].includes(mode)
    ? mode
    : "normal";
}

function revalidateFinance() {
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/financeiro/ajustes");
  revalidatePath("/admin/financeiro/cartoes", "layout");
}

export async function addTransaction(fd: FormData) {
  const { supabase, profile } = await getCurrentProfile();

  const date = cleanString(fd.get("date"));
  const description = cleanString(fd.get("description"));
  const location = cleanString(fd.get("location"));
  const notes = cleanString(fd.get("notes"));
  const categoryId = cleanString(fd.get("category_id"));
  const accountId = cleanString(fd.get("account_id"));
  const amount = parseAmount(fd.get("amount"));
  const currency = cleanCurrency(fd.get("currency"));
  const type = cleanType(fd.get("type"));
  const mode = cleanMode(fd.get("mode"));
  const dueDate = cleanString(fd.get("due_date"));
  const titheEligible = type === "income" && cleanString(fd.get("tithe_eligible")) === "on";

  if (!date) throw new Error("Informe a data do lançamento.");
  if (!description) throw new Error("Informe a descrição do lançamento.");
  if (!categoryId) throw new Error("Selecione uma categoria.");
  if (!accountId) throw new Error("Selecione uma conta.");
  if (amount === null) throw new Error("Informe o valor do lançamento.");

  const faturaDate = cleanString(fd.get("fatura_date"));
  const installmentsEnabled = mode === "credit_purchase" && type === "expense" && cleanString(fd.get("installments_enabled")) === "on";
  const installmentsCount = installmentsEnabled ? cleanInstallments(fd.get("installments_count")) : 1;
  const amountCents = Math.round(amount * 100);
  const baseInstallmentCents = Math.floor(amountCents / installmentsCount);
  const remainderCents = amountCents % installmentsCount;

  const baseRow = {
    profile_id: profile.id,
    date,
    description,
    location: location || null,
    notes: notes || null,
    amount,
    currency,
    type,
    mode,
    due_date: dueDate || null,
    tithe_eligible: titheEligible,
    category_id: categoryId,
    account_id: accountId,
    fatura_date: faturaDate || null,
  };

  const rows = installmentsCount > 1
    ? Array.from({ length: installmentsCount }, (_, index) => {
      const installmentCents = baseInstallmentCents + (index < remainderCents ? 1 : 0);
      return {
        ...baseRow,
        date: addMonths(date, index),
        due_date: dueDate ? addMonths(dueDate, index) : null,
        description: `${description} - Parcela ${index + 1} de ${installmentsCount}`,
        amount: Number((installmentCents / 100).toFixed(2)),
        fatura_date: faturaDate ? addMonthsToFatura(faturaDate, index) : null,
      };
    })
    : [baseRow];

  const { error } = await supabase.from("finance_transactions").insert(rows);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function updateTransaction(id: string, fd: FormData) {
  const { supabase, profile } = await getCurrentProfile();

  const date = cleanString(fd.get("date"));
  const description = cleanString(fd.get("description"));
  const location = cleanString(fd.get("location"));
  const notes = cleanString(fd.get("notes"));
  const categoryId = cleanString(fd.get("category_id"));
  const accountId = cleanString(fd.get("account_id"));
  const amount = parseAmount(fd.get("amount"));
  const currency = cleanCurrency(fd.get("currency"));
  const type = cleanType(fd.get("type"));
  const mode = cleanMode(fd.get("mode"));
  const dueDate = cleanString(fd.get("due_date"));
  const titheEligible = type === "income" && cleanString(fd.get("tithe_eligible")) === "on";

  if (!date) throw new Error("Informe a data do lançamento.");
  if (!description) throw new Error("Informe a descrição do lançamento.");
  if (!categoryId) throw new Error("Selecione uma categoria.");
  if (!accountId) throw new Error("Selecione uma conta.");
  if (amount === null) throw new Error("Informe o valor do lançamento.");

  const faturaDate = cleanString(fd.get("fatura_date"));

  const { error } = await supabase
    .from("finance_transactions")
    .update({
      date,
      description,
      location: location || null,
      notes: notes || null,
      amount,
      currency,
      type,
      mode,
      due_date: dueDate || null,
      tithe_eligible: titheEligible,
      category_id: categoryId,
      account_id: accountId,
      fatura_date: faturaDate || null,
    })
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function deleteTransaction(id: string) {
  const { supabase, profile } = await getCurrentProfile();

  const { error } = await supabase
    .from("finance_transactions")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function addCategory(fd: FormData) {
  const { supabase, profile } = await getCurrentProfile();
  const name = cleanString(fd.get("name"));

  if (!name) throw new Error("Informe o nome da categoria.");

  const { error } = await supabase.from("finance_categories").insert({
    profile_id: profile.id,
    name,
  });

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function createQuickCategory(name: string) {
  const { supabase, profile } = await getCurrentProfile();
  const safeName = cleanString(name);

  if (!safeName) throw new Error("Informe o nome da categoria.");

  const { data, error } = await supabase
    .from("finance_categories")
    .insert({
      profile_id: profile.id,
      name: safeName,
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);

  revalidateFinance();
  return data;
}

export async function addAccount(fd: FormData) {
  const { supabase, profile } = await getCurrentProfile();
  const name = cleanString(fd.get("name"));
  const kind = cleanString(fd.get("kind")) || "bank";
  const currency = cleanCurrency(fd.get("currency"));
  const initialBalance = parseAmount(fd.get("initial_balance")) ?? 0;

  if (!name) throw new Error("Informe o nome da conta.");

  const creditLimit = kind === "credit_card" ? (parseAmount(fd.get("credit_limit")) ?? null) : null;
  const closingDay = kind === "credit_card" ? (parseInt(cleanString(fd.get("closing_day"))) || null) : null;
  const dueDay = kind === "credit_card" ? (parseInt(cleanString(fd.get("due_day"))) || null) : null;
  const cardBrand = kind === "credit_card" ? (cleanString(fd.get("card_brand")) || null) : null;

  const { data: account, error } = await supabase
    .from("finance_accounts")
    .insert({
      profile_id: profile.id,
      name,
      kind,
      currency,
      credit_limit: creditLimit,
      closing_day: closingDay,
      due_day: dueDay,
      card_brand: cardBrand,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (account && initialBalance !== 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    let faturaDateForInitial: string | null = null;
    if (kind === "credit_card") {
      const d = new Date(`${todayStr}T00:00:00`);
      const closing = closingDay ?? 1;
      const offset = d.getDate() >= closing ? 1 : 0;
      const fd = new Date(d.getFullYear(), d.getMonth() + offset, 1);
      faturaDateForInitial = `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, "0")}-01`;
    }
    const { error: balanceError } = await supabase.from("finance_transactions").insert({
      profile_id: profile.id,
      account_id: account.id,
      category_id: null,
      date: todayStr,
      description: `Saldo inicial - ${name}`,
      amount: Math.abs(initialBalance),
      currency,
      type: initialBalance >= 0 ? "income" : "expense",
      mode: kind === "credit_card" ? "credit_purchase" : "initial_balance",
      tithe_eligible: false,
      fatura_date: faturaDateForInitial,
    });

    if (balanceError) throw new Error(balanceError.message);
  }

  revalidateFinance();
}

export async function updateAccount(id: string, fd: FormData) {
  const { supabase, profile } = await getCurrentProfile();
  const name = cleanString(fd.get("name"));
  const kind = cleanString(fd.get("kind")) || "bank";
  const currency = cleanCurrency(fd.get("currency"));
  const targetBalanceRaw = cleanString(fd.get("target_balance"));

  if (!name) throw new Error("Informe o nome da conta.");

  const creditLimit = kind === "credit_card" ? (parseAmount(fd.get("credit_limit")) ?? null) : null;
  const closingDay = kind === "credit_card" ? (parseInt(cleanString(fd.get("closing_day"))) || null) : null;
  const dueDay = kind === "credit_card" ? (parseInt(cleanString(fd.get("due_day"))) || null) : null;
  const cardBrand = kind === "credit_card" ? (cleanString(fd.get("card_brand")) || null) : null;

  const { error } = await supabase
    .from("finance_accounts")
    .update({ name, kind, currency, credit_limit: creditLimit, closing_day: closingDay, due_day: dueDay, card_brand: cardBrand })
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  if (targetBalanceRaw !== "") {
    const rawParsed = parseFloat(targetBalanceRaw.replace(",", "."));
    // Para cartão de crédito o usuário digita a fatura (positivo = o que deve),
    // mas o saldo interno é negativo (expense > income). Invertemos para o cartão.
    const targetBalance = kind === "credit_card" ? -Math.abs(rawParsed) : rawParsed;
    if (Number.isFinite(targetBalance)) {
      const { data: rows } = await supabase
        .from("finance_transactions")
        .select("amount, type")
        .eq("profile_id", profile.id)
        .eq("account_id", id);

      const currentBalance = (rows ?? []).reduce((sum: number, row: { amount: unknown; type: string }) =>
        sum + (row.type === "income" ? Number(row.amount) : -Number(row.amount)), 0);

      const delta = targetBalance - currentBalance;
      if (Math.abs(delta) >= 0.01) {
        await supabase.from("finance_transactions").insert({
          profile_id: profile.id,
          account_id: id,
          category_id: null,
          date: new Date().toISOString().slice(0, 10),
          description: "Ajuste de saldo",
          amount: Math.abs(delta),
          currency,
          type: delta > 0 ? "income" : "expense",
          mode: "initial_balance",
          tithe_eligible: false,
        });
      }
    }
  }

  revalidateFinance();
}

export async function updateCategory(id: string, fd: FormData) {
  const { supabase, profile } = await getCurrentProfile();
  const name = cleanString(fd.get("name"));

  if (!name) throw new Error("Informe o nome da categoria.");

  const { error } = await supabase
    .from("finance_categories")
    .update({ name })
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function deleteCategory(id: string) {
  const { supabase, profile } = await getCurrentProfile();

  const { error: unlinkError } = await supabase
    .from("finance_transactions")
    .update({ category_id: null })
    .eq("category_id", id)
    .eq("profile_id", profile.id);

  if (unlinkError) throw new Error(unlinkError.message);

  const { error } = await supabase
    .from("finance_categories")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function deleteAccount(id: string) {
  const { supabase, profile } = await getCurrentProfile();

  const { error: unlinkError } = await supabase
    .from("finance_transactions")
    .update({ account_id: null })
    .eq("account_id", id)
    .eq("profile_id", profile.id);

  if (unlinkError) throw new Error(unlinkError.message);

  const { error } = await supabase
    .from("finance_accounts")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function archiveAccount(id: string, archived: boolean) {
  const { supabase, profile } = await getCurrentProfile();

  const { error } = await supabase
    .from("finance_accounts")
    .update({ archived })
    .eq("id", id)
    .eq("profile_id", profile.id);

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function payFatura(cardId: string, faturaDate: string) {
  const { supabase, profile } = await getCurrentProfile();

  const faturaMonthEnd = new Date(new Date(`${faturaDate}T00:00:00`).getFullYear(), new Date(`${faturaDate}T00:00:00`).getMonth() + 1, 0).toISOString().slice(0, 10);

  const [r1, r2] = await Promise.all([
    supabase.from("finance_transactions").update({ fatura_paid: true })
      .eq("profile_id", profile.id).eq("account_id", cardId).eq("fatura_date", faturaDate).in("mode", ["credit_purchase", "fixed_expense"]),
    supabase.from("finance_transactions").update({ fatura_paid: true })
      .eq("profile_id", profile.id).eq("account_id", cardId).is("fatura_date", null)
      .gte("date", faturaDate).lte("date", faturaMonthEnd).in("mode", ["credit_purchase", "fixed_expense"]),
  ]);

  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);

  revalidateFinance();
}
