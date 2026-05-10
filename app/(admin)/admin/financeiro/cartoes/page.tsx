import { getCurrentProfile } from "@/lib/current-profile";
import CartoesCreditoPanel from "./cartoes-panel";

export default async function CartoesCreditoPage() {
  const { supabase, profile } = await getCurrentProfile();

  const { data: cards } = await supabase
    .from("finance_accounts")
    .select("id, name, kind, currency, credit_limit, closing_day, due_day, card_brand, archived")
    .eq("profile_id", profile.id)
    .eq("kind", "credit_card")
    .order("name");

  const cardIds = (cards ?? []).map((c) => c.id);
  const { data: balanceRows } = cardIds.length
    ? await supabase
        .from("finance_transactions")
        .select("account_id, amount, type, mode, fatura_paid")
        .eq("profile_id", profile.id)
        .eq("mode", "credit_purchase")
        .eq("fatura_paid", false)
        .in("account_id", cardIds)
    : { data: [] };

  const accountBalances: Record<string, number> = {};
  for (const row of balanceRows ?? []) {
    if (!row.account_id) continue;
    const delta = row.type === "income" ? Number(row.amount ?? 0) : -Number(row.amount ?? 0);
    accountBalances[row.account_id] = (accountBalances[row.account_id] ?? 0) + delta;
  }

  const { data: categories } = await supabase
    .from("finance_categories")
    .select("id, name")
    .eq("profile_id", profile.id)
    .order("name");

  const { data: allAccounts } = await supabase
    .from("finance_accounts")
    .select("id, name, kind, currency, credit_limit, closing_day, due_day, card_brand, archived")
    .eq("profile_id", profile.id)
    .order("name");

  return (
    <CartoesCreditoPanel
      cards={cards ?? []}
      accountBalances={accountBalances}
      categories={categories ?? []}
      allAccounts={allAccounts ?? []}
    />
  );
}
