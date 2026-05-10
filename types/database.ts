export type PostStatus = "draft" | "published";
export type PostType = "text" | "image" | "video" | "carousel";

export type Post = {
  id: string;
  profile_id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  cover_url: string | null;
  post_type: PostType;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  birth_date: string | null;
  phone: string | null;
  is_public: boolean;
  missionary_mode: boolean;
  created_at: string;
  updated_at: string;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Donation = {
  id: string;
  donor_id: string | null;
  missionary_id: string;
  amount: number | null;
  note: string | null;
  created_at: string;
};

export type FinanceCategory = {
  id: string;
  profile_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type FinanceAccount = {
  id: string;
  profile_id: string;
  name: string;
  kind: "bank" | "cash" | "credit_card";
  currency: "BRL" | "USD" | "EUR";
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  archived: boolean;
  card_brand: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceTransaction = {
  id: string;
  profile_id: string;
  category_id: string | null;
  account_id: string | null;
  date: string;
  due_date: string | null;
  description: string;
  location: string | null;
  notes: string | null;
  amount: number | null;
  currency: "BRL" | "USD" | "EUR";
  type: "income" | "expense";
  mode: "normal" | "initial_balance" | "credit_purchase" | "fixed_expense";
  tithe_eligible: boolean;
  fatura_date: string | null;
  fatura_paid: boolean;
  created_at: string;
  updated_at: string;
};
