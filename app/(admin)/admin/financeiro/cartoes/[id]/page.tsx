import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import FaturaPanel from "./fatura-panel";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FaturaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const monthParam = String(sp.month || "");
  const { supabase, profile } = await getCurrentProfile();

  const { data: card } = await supabase
    .from("finance_accounts")
    .select("id, name, kind, currency, credit_limit, closing_day, due_day, card_brand, archived")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .eq("kind", "credit_card")
    .single();

  if (!card) notFound();

  const { data: transactions } = await supabase
    .from("finance_transactions")
    .select("id, date, fatura_date, fatura_paid, description, amount, currency, type, mode, category_id, finance_categories(id, name)")
    .eq("profile_id", profile.id)
    .eq("account_id", id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

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
    <FaturaPanel
      card={card}
      transactions={(transactions ?? []) as FaturaTransaction[]}
      categories={categories ?? []}
      allAccounts={allAccounts ?? []}
      initialMonth={monthParam}
    />
  );
}

export type FaturaTransaction = {
  id: string;
  date: string;
  fatura_date: string | null;
  fatura_paid: boolean;
  description: string;
  amount: number | null;
  currency: string;
  type: "income" | "expense";
  mode: string;
  category_id: string | null;
  finance_categories?: { id: string; name: string } | { id: string; name: string }[] | null;
};
