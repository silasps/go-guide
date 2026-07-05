export type PrivacyMode = 'public' | 'private' | 'stealth'
export type ProfileAccountType = 'individual' | 'family' | 'organization'
export type Locale = 'pt' | 'en' | 'es'
export type Plan = 'free' | 'pro' | 'mission'
export type PostType = 'text' | 'image' | 'video' | 'carousel'
export type PartnerType = 'financial' | 'prayer' | 'both' | 'ambassador'
export type AccountType = 'checking' | 'savings' | 'credit'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransactionSource = 'manual' | 'whatsapp' | 'api'
export type RequesterType = 'missionary' | 'partner'
export type AccountMemberRole = 'owner' | 'viewer'
export type HighlightStatus = 'active' | 'hidden' | 'completed'
export type GoalType = 'financial' | 'prayer' | 'ambassador' | 'volunteer' | 'ongoing'
export type NotificationType =
  | 'new_post'
  | 'new_prayer_request'
  | 'new_partner'
  | 'new_message'
  | 'prayer_answered'
  | 'highlight_update'
  | 'new_pledge'
  | 'pledge_confirmed'
  | 'prayer_reply'

export type BudgetCategoryType =
  | 'airfare' | 'bus' | 'boat' | 'ferry' | 'rideshare' | 'lodging'
  | 'food' | 'equipment' | 'visa_documentation' | 'insurance'
  | 'training' | 'shipping' | 'other'

export interface Profile {
  id: string
  user_id: string
  username: string
  display_name: string
  bio: string | null
  location: string | null
  show_location: boolean
  account_type: ProfileAccountType
  avatar_url: string | null
  cover_url: string | null
  privacy_mode: PrivacyMode
  plan: Plan
  stripe_customer_id: string | null
  accent_color: string
  website_url: string | null
  instagram_url: string | null
  youtube_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  pix_key: string | null
  paypal_url: string | null
  wise_url: string | null
  external_donation_url: string | null
  ai_credits: number
  extra_manager_seats: number
  mission_start_date: string | null
  locale: Locale
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  profile_id: string
  type: PostType
  content: string | null
  media_urls: string[]
  published_at: string | null
  scheduled_at: string | null
  is_draft: boolean
  project_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface Highlight {
  id: string
  profile_id: string
  title: string
  description: string | null
  goal_amount: number | null
  current_amount: number
  currency: string
  cover_url: string | null
  is_featured: boolean
  order_index: number
  status: HighlightStatus
  slug: string | null
  goal_type: GoalType[]
  partner_token: string | null
  cover_position: string
  scripture: string | null
  letter: string | null
  trip_start_date: string | null
  funding_deadline: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectBudgetCategory {
  id: string
  highlight_id: string
  category_type: BudgetCategoryType
  custom_label: string | null
  target_amount: number
  order_index: number
  created_at: string
}

export interface ProjectBudgetProgress extends ProjectBudgetCategory {
  raised_amount: number
}

export interface Milestone {
  id: string
  highlight_id: string
  profile_id: string
  title: string
  is_completed: boolean
  completed_at: string | null
  order_index: number
  created_at: string
}

export interface PrayerRequest {
  id: string
  profile_id: string
  requester_id: string | null
  requester_type: RequesterType
  content: string
  is_answered: boolean
  answered_at: string | null
  is_private: boolean
  nonce: string | null
  created_at: string
}

export interface PrayerRequestReply {
  id: string
  prayer_request_id: string
  author_user_id: string | null
  ciphertext: string | null
  nonce: string | null
  content: string | null
  created_at: string
}

export interface UserEncryptionKey {
  user_id: string
  public_key: string
  encrypted_private_key: string
  kdf_salt: string
  created_at: string
  updated_at: string
}

export type E2EEResourceType = 'conversation' | 'prayer_request' | 'profile_sensitive_fields'

export interface EncryptedDekGrant {
  id: string
  resource_type: E2EEResourceType
  resource_id: string
  grantee_user_id: string
  wrapped_dek: string
  revoked_at: string | null
  created_at: string
}

export interface ProfileSensitiveData {
  profile_id: string
  ciphertext: string
  nonce: string
  updated_at: string
}

export interface Partner {
  id: string
  profile_id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  type: PartnerType
  notes: string | null
  tags: string[]
  joined_at: string
  created_at: string
}

export type VisibilityGrantSection = 'full_profile' | 'financial_summary' | 'prayer_requests' | 'sensitive_fields' | 'messages'

export interface PartnerVisibilityGrant {
  id: string
  profile_id: string
  partner_id: string
  section: VisibilityGrantSection
  granted_at: string
}

export type PledgePaymentMethod = 'pix' | 'paypal' | 'wise' | 'bank_transfer' | 'other'
export type PledgeStatus = 'pending' | 'confirmed' | 'rejected'

export interface Pledge {
  id: string
  highlight_id: string | null
  profile_id: string
  partner_id: string | null
  reporter_user_id: string | null
  reporter_name: string
  reporter_email: string | null
  reported_amount: number
  currency: string
  payment_method: PledgePaymentMethod
  reported_at: string
  proof_url: string | null
  is_recurring_pledge: boolean
  status: PledgeStatus
  confirmed_transaction_id: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

export type ProjectMemberRole = 'lead' | 'member' | 'viewer'

export interface ProjectMember {
  id: string
  highlight_id: string
  user_id: string
  role: ProjectMemberRole
  invited_by_user_id: string | null
  joined_at: string
}

export type ProfileManagerRole = 'manager' | 'viewer'

export interface ProfileManager {
  id: string
  profile_id: string
  user_id: string
  role: ProfileManagerRole
  invited_by_user_id: string | null
  created_at: string
}

export interface FinancialAccount {
  id: string
  profile_id: string
  currency_code: string
  name: string
  balance: number
  account_type: AccountType
  credit_limit: number | null
  is_shared: boolean
  created_by_user_id: string | null
  highlight_id: string | null
  created_at: string
  updated_at: string
}

export interface AccountMember {
  id: string
  account_id: string
  user_id: string
  role: AccountMemberRole
  added_at: string
}

export interface TransactionCategory {
  id: string
  profile_id: string
  name: string
  icon: string | null
  color: string | null
  parent_id: string | null
  created_at: string
}

export interface Transaction {
  id: string
  account_id: string
  profile_id: string
  created_by_user_id: string | null
  type: TransactionType
  amount: number
  currency: string
  description: string
  category_id: string | null
  subcategory_id: string | null
  partner_id: string | null
  source: TransactionSource
  is_credit_purchase: boolean
  due_date: string | null
  date: string
  highlight_id: string | null
  budget_category_id: string | null
  created_at: string
}

export interface Notification {
  id: string
  recipient_user_id: string
  type: NotificationType
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  profile_id: string
  content: string
  is_encrypted: boolean
  nonce: string | null
  created_at: string
}

export interface Subscription {
  id: string
  profile_id: string
  stripe_subscription_id: string
  plan: Plan
  status: string
  current_period_end: string
  created_at: string
}

export interface AiCreditTransaction {
  id: string
  profile_id: string
  amount: number
  reason: string
  created_at: string
}

export interface WhatsappConfig {
  id: string
  profile_id: string
  phone_number_id: string | null
  verify_token: string | null
  notifications_enabled: boolean
  financial_enabled: boolean
  is_verified: boolean
  created_at: string
}

// Joined types for queries
export interface PostWithProfile extends Post {
  profile: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>
}

export interface TransactionWithCategory extends Transaction {
  category: TransactionCategory | null
  subcategory: TransactionCategory | null
  partner: Pick<Partner, 'name'> | null
}

export interface PartnerWithStats extends Partner {
  total_transactions: number
  last_activity: string | null
}
