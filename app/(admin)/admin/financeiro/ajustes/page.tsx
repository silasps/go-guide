import { getCurrentProfile } from "@/lib/current-profile";
import FinanceSettingsPanel, { type FinanceSettingsAccount, type FinanceSettingsCategory } from "./settings-panel";

export default async function FinanceiroAjustesPage() {
  const { supabase, profile } = await getCurrentProfile();

  const { data: categories, error: categoriesError } = await supabase
    .from("finance_categories")
    .select("id, name")
    .eq("profile_id", profile.id)
    .order("name", { ascending: true });

  if (categoriesError) throw new Error(categoriesError.message);

  const { data: accounts, error: accountsError } = await supabase
    .from("finance_accounts")
    .select("id, name, kind, currency, credit_limit")
    .eq("profile_id", profile.id)
    .order("name", { ascending: true });

  if (accountsError) throw new Error(accountsError.message);

  return (
    <FinanceSettingsPanel
      accounts={(accounts ?? []) as FinanceSettingsAccount[]}
      categories={(categories ?? []) as FinanceSettingsCategory[]}
    />
  );
}
