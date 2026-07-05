# system.architecture.md

> **Este arquivo é a fonte da verdade da arquitetura deste sistema.**
> Objetivo: permitir que qualquer IA (ou o próprio autor, em outro ambiente) reconstrua o sistema do zero apenas lendo este documento.
>
> **Regra de manutenção**: toda vez que uma mudança relevante for feita no sistema (nova tabela/coluna, nova rota, novo componente, nova integração, mudança de fluxo de negócio, correção de bug estrutural), este arquivo DEVE ser atualizado no mesmo commit/sessão. Veja a seção [Changelog](#changelog) no final.

---

## 1. Visão geral do produto

SaaS para **missionários** centralizarem sua comunicação com apoiadores/parceiros, hoje fragmentada em Instagram, WhatsApp, PDF, e-mail e Pix.

Módulos principais:
- **Perfil público** do missionário (`/[username]`), com modos de privacidade (público/privado/stealth).
- **Projetos** (antigo "destaques"/highlights) — campanhas de arrecadação com metas financeiras, orçamento por categoria, marcos, equipe.
- **CRM de parceiros** — cadastro, tipos (financeiro/oração/embaixador/ambos), notas, tags.
- **Financeiro multi-conta** — contas (pessoais ou compartilhadas em equipe), transações, categorias hierárquicas, conciliação de ofertas (pledges).
- **Pedidos de oração** bilaterais (missionário ↔ parceiro), com opção de conteúdo privado cifrado (E2EE).
- **Mensagens diretas** cifradas ponta-a-ponta (E2EE) entre missionário e parceiro.
- **Notificações** em tempo real (Supabase Realtime).
- **Dados sensíveis do perfil** (endereço real, itinerário, etc.) cifrados e liberados seletivamente por parceiro.
- (Planejado, schema pronto mas **sem código de integração ainda**): assinaturas Stripe (planos free/pro/mission + créditos de IA avulsos), IA copiloto via Claude API, WhatsApp Business API, conversão de câmbio via ExchangeRate-API, e-mail transacional via Resend.

### Monetização (planejada)
- **Free**: 2 parceiros, 1 post/mês, sem IA (pay-per-use).
- **Pro**: $20/mês ou $200/ano — ilimitado + 50 créditos IA + financeiro.
- **Missão**: $45/mês ou $450/ano — tudo + WhatsApp + conta compartilhada casal/família + projeto compartilhado editável.

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.7 (App Router), Turbopack |
| Linguagem | TypeScript, `strict: true` |
| UI | React 19.2.4, Tailwind CSS v4 (CSS-first, sem `tailwind.config`), shadcn/ui v4 (`style: "base-nova"`) sobre `@base-ui/react` (NÃO Radix, embora `@radix-ui/*` ainda esteja instalado como resquício) |
| Ícones | `lucide-react` |
| Toasts | `sonner` |
| Dark mode | `next-themes` (`attribute="class"`) |
| Backend/DB | Supabase (Postgres + Auth + Storage + Realtime), acessado via `@supabase/ssr` e `@supabase/supabase-js` |
| Criptografia E2EE | `libsodium-wrappers` (X25519 + XSalsa20-Poly1305 + Argon2id), 100% client-side |
| Compressão de mídia | `browser-image-compression` (imagens → WebP) |
| Pagamentos (planejado, não implementado) | `stripe`, `@stripe/stripe-js` |
| E-mail (planejado, não implementado) | `resend` |
| IA (planejado, não implementado) | Anthropic Claude API |
| Câmbio (planejado, não implementado) | ExchangeRate-API |
| Deploy | Vercel (`.vercel/project.json` presente) |

Projeto Supabase: `eqnekupeiehgkacegmgl` (credenciais em `.env.local`, não versionado).

### Variáveis de ambiente (`.env.example`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_MISSION_MONTHLY=
STRIPE_PRICE_MISSION_YEARLY=
STRIPE_PRICE_CREDITS_20=
STRIPE_PRICE_CREDITS_50=
STRIPE_PRICE_CREDITS_100=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Anthropic (Claude API)
ANTHROPIC_API_KEY=

# Exchange Rate API
EXCHANGE_RATE_API_KEY=

# WhatsApp (Meta)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=
```

> **Status real das integrações**: Resend, Anthropic, ExchangeRate-API e WhatsApp têm **schema de dados pronto** (tabelas, colunas, RLS) mas **nenhum código de integração** foi escrito (`src/lib/ai/`, `src/lib/exchange/` e `supabase/functions/` estão vazios). Ao reconstruir, essas integrações precisam ser implementadas do zero seguindo o schema descrito abaixo.
>
> **Stripe** tem um passo a mais que os outros: além do schema, já existe o **scaffold de checkout** (`src/lib/stripe/client.ts` + `POST /api/billing/checkout`, chamado pela página `/planos`). `getStripeClient()` retorna `null` enquanto `STRIPE_SECRET_KEY` estiver vazio, e a rota responde `501 { error: 'not_configured' }` nesse caso (o frontend mostra um toast "em breve"). Para ativar de verdade: preencher `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*` (`.env.example`), criar os 4 Price IDs (Pro/Missão × mensal/anual) no Stripe, e ligar **Adaptive Pricing** no dashboard da Stripe para cobrança automática na moeda local do cartão (não requer lógica de moeda no código). Falta ainda o webhook que sincroniza `subscriptions`/`profiles.plan` após o checkout — não implementado.

---

## 3. Modelo de dados (Postgres / Supabase)

Extensões: `uuid-ossp`, `pgcrypto`. Todas as PKs são `UUID DEFAULT uuid_generate_v4()`. Migrations em `supabase/migrations/001` a `017` (ordem de aplicação importa — cada uma altera o resultado da anterior).

### 3.1 Tabelas principais

#### `profiles` (hub central — 1:1 com `auth.users`)
- `id` PK, `user_id UUID UNIQUE FK auth.users ON DELETE CASCADE`
- `username TEXT UNIQUE NOT NULL` (único case-insensitive via índice em `LOWER(username)`)
- `display_name`, `bio`, `location`, `avatar_url`, `cover_url`
- `privacy_mode TEXT DEFAULT 'public' CHECK IN ('public','private','stealth')`
- `plan TEXT DEFAULT 'free' CHECK IN ('free','pro','mission')`
- `stripe_customer_id`, `accent_color TEXT DEFAULT '#6366f1'` (cor livre por usuário, aplicada inline)
- Links sociais: `website_url`, `instagram_url`, `youtube_url`, `facebook_url`, `tiktok_url`
- Recebimento: `pix_key`, `paypal_url`, `wise_url`, `external_donation_url`
- `ai_credits INTEGER DEFAULT 0`
- `mission_start_date DATE` (migration 012)
- timestamps + trigger `update_updated_at`

Criado automaticamente por trigger `handle_new_user()` (`SECURITY DEFINER`, `AFTER INSERT ON auth.users`): `username = slug(email) + '_' + 6 chars do UUID`, `display_name` = `raw_user_meta_data->>'full_name'` ou prefixo do e-mail.

#### `posts` (feed / publicações)
`profile_id FK`, `type CHECK IN ('text','image','video','carousel')`, `content`, `media_urls TEXT[]`, `published_at`, `scheduled_at`, `is_draft BOOLEAN DEFAULT true`, `created_by_user_id FK auth.users ON DELETE SET NULL` (nullable, corrigido na 017), `project_id UUID FK highlights ON DELETE SET NULL` (migration 005 — vincula um post/relatório a um projeto específico).

#### `highlights` (= "Projetos" no produto atual)
- `profile_id FK`, `title`, `description`, `goal_amount NUMERIC(15,2)`, `current_amount NUMERIC(15,2) DEFAULT 0` (mantido por trigger, nunca calculado on-the-fly), `currency TEXT DEFAULT 'BRL'`
- `cover_url`, `cover_position TEXT DEFAULT '50% 50%'` (migration 006 — recorte de imagem estilo CSS `object-position`)
- `is_featured`, `order_index`
- `status CHECK IN ('active','hidden','completed')` (migration 008 adiciona `completed`)
- `slug TEXT` (migration 005, único composto `(profile_id, slug)`), `partner_token UUID DEFAULT uuid_generate_v4()` (único — token de link público)
- `goal_type TEXT[] DEFAULT ARRAY['financial']` (migration 007 — converteu de escalar para array; `financial | prayer | ambassador | volunteer | ongoing`; DB não restringe valores via CHECK, só o TypeScript)
- `scripture TEXT`, `letter TEXT` (migration 008)
- `trip_start_date DATE`, `funding_deadline DATE`, `completed_at TIMESTAMPTZ` (migration 016 — trigger `set_highlight_completed_at()` seta/zera `completed_at` quando `status` entra/sai de `'completed'`)

#### `milestones` (migration 005)
`highlight_id FK CASCADE`, `profile_id FK CASCADE`, `title`, `is_completed BOOLEAN`, `completed_at`, `order_index`.

#### `post_deliveries` (migration 005)
Rastreio de envio de relatório a parceiro específico. `post_id FK`, `partner_id FK`, `sent_at`, `opened_at`, `UNIQUE(post_id, partner_id)`.

#### `project_budget_categories` (migration 010)
`highlight_id FK CASCADE`, `category_type CHECK IN ('airfare','bus','boat','ferry','rideshare','lodging','food','equipment','visa_documentation','insurance','training','shipping','other')`, `custom_label`, `target_amount NUMERIC(15,2)`, `order_index`.

View `project_budget_progress` **`WITH (security_invoker = true)`** (crítico para RLS): agrega `SUM(amount) FILTER (WHERE type='income')` por categoria como `raised_amount`, via LEFT JOIN com `transactions`. `security_invoker=true` garante que a RLS das tabelas base seja avaliada com o papel de quem consulta a view, não do dono dela.

#### `project_members` (migration 013 — equipe do projeto)
`highlight_id FK CASCADE`, `user_id FK auth.users CASCADE`, `role CHECK IN ('lead','member','viewer')`, `invited_by_user_id FK auth.users ON DELETE SET NULL`, `UNIQUE(highlight_id, user_id)`.

> **Decisão de design**: `project_members` (quem edita o conteúdo do projeto) e `account_members` (quem mexe no dinheiro) são desacoplados propositalmente. A rota de API `/api/projects/members` sincroniza os dois automaticamente (ver seção 5).

#### `partners` (CRM)
`profile_id FK`, `user_id FK auth.users ON DELETE SET NULL` (nullable — nem todo parceiro tem conta), `name`, `email`, `phone`, `type CHECK IN ('financial','prayer','both','ambassador')` (migration 007 adiciona `ambassador`), `notes`, `tags TEXT[]`, `joined_at`. Índice único `(profile_id, user_id)` onde `user_id IS NOT NULL` (migration 012).

#### `partner_visibility_grants` (migration 011 — controle granular de visibilidade)
`profile_id FK`, `partner_id FK`, `section CHECK IN ('full_profile','financial_summary','prayer_requests','sensitive_fields','messages')`, `granted_at`, `UNIQUE(profile_id, partner_id, section)`.

> **Mecanismo central**: o missionário decide, por parceiro individual, quais seções de dado sensível ele enxerga. Duas camadas ortogonais de visibilidade: `privacy_mode` do perfil controla acesso "de longe" (descoberta pública); `partner_visibility_grants` controla, por parceiro já vinculado, granularmente. Quando a seção é `sensitive_fields`, a concessão relacional (esta tabela) precisa ser acompanhada de uma concessão criptográfica real via `keyManager.grantAccessToExisting` (ver seção 6).

#### `pledges` (migration 012 — registro manual de oferta, não é cobrança automática)
`highlight_id FK ON DELETE SET NULL`, `profile_id FK CASCADE`, `partner_id FK ON DELETE SET NULL`, `reporter_user_id FK auth.users ON DELETE SET NULL`, `reporter_name TEXT NOT NULL`, `reporter_email`, `reported_amount NUMERIC(15,2)`, `currency DEFAULT 'BRL'`, `payment_method CHECK IN ('pix','paypal','wise','bank_transfer','other')`, `reported_at`, `proof_url`, `is_recurring_pledge BOOLEAN`, `status CHECK IN ('pending','confirmed','rejected')`, `confirmed_transaction_id FK transactions ON DELETE SET NULL`, `reviewed_by_user_id FK ON DELETE SET NULL`, `reviewed_at`, `rejection_reason`.

RLS: `pledges_insert_public` com `WITH CHECK (true)` — **qualquer pessoa, logada ou não, pode registrar uma oferta para qualquer perfil**. A legitimidade é validada 100% manualmente pelo missionário (não há verificação automática de pagamento). Ver fluxo completo na seção 7.2.

#### Financeiro
- **`financial_accounts`**: `profile_id FK`, `currency_code`, `name`, `balance NUMERIC(15,2) DEFAULT 0` (mantido por trigger), `account_type CHECK IN ('checking','savings','credit')`, `credit_limit`, `is_shared BOOLEAN`, `created_by_user_id FK ON DELETE SET NULL`, `highlight_id FK highlights ON DELETE SET NULL` (migration 013 — reaproveita contas para "conta de equipe do projeto" em vez de criar conceito paralelo).
- **`account_members`**: `account_id FK`, `user_id FK auth.users ON DELETE CASCADE`, `role CHECK IN ('owner','viewer')`, `UNIQUE(account_id, user_id)`.
- **`transaction_categories`**: hierárquica via `parent_id` self-FK `ON DELETE SET NULL` (2 níveis: categoria/subcategoria).
- **`transactions`**: `account_id FK`, `profile_id FK`, `created_by_user_id FK ON DELETE SET NULL`, `type CHECK IN ('income','expense','transfer')`, `amount NUMERIC(15,2)`, `currency`, `description`, `category_id`/`subcategory_id` (FK `transaction_categories`), `partner_id FK partners ON DELETE SET NULL`, `source CHECK IN ('manual','whatsapp','api')`, `is_credit_purchase BOOLEAN`, `due_date DATE`, `date DATE DEFAULT CURRENT_DATE`, `highlight_id FK ON DELETE SET NULL` (migration 009), `budget_category_id FK project_budget_categories ON DELETE SET NULL` (migration 010).

**Triggers de saldo agregado** (⚠️ só disparam em INSERT/DELETE, não em UPDATE — editar valor de uma transação existente não resincroniza os saldos, a menos que a aplicação force delete+insert):
- `update_account_balance()` — soma/subtrai `amount` de `financial_accounts.balance` conforme `type` (income soma, expense subtrai).
- `update_highlight_current_amount()` (migration 009) — quando uma transação `income` tem `highlight_id`, soma/subtrai em `highlights.current_amount`.

#### E2EE (migration 015)
- **`user_encryption_keys`**: `user_id PK FK auth.users CASCADE`, `public_key TEXT` (claro), `encrypted_private_key TEXT` (formato `"ciphertext:nonce"`), `kdf_salt TEXT` (salt Argon2id).
- **`encrypted_dek_grants`**: `resource_type CHECK IN ('conversation','prayer_request','profile_sensitive_fields')`, `resource_id UUID`, `grantee_user_id FK auth.users CASCADE`, `wrapped_dek TEXT` (DEK cifrada via sealed box para este grantee), `revoked_at TIMESTAMPTZ`, `UNIQUE(resource_type, resource_id, grantee_user_id)`.
- **`profile_sensitive_data`**: `profile_id PK FK profiles CASCADE`, `ciphertext TEXT`, `nonce TEXT`.
- **`prayer_request_replies`**: `prayer_request_id FK CASCADE`, `author_user_id FK auth.users ON DELETE SET NULL`, `ciphertext`/`nonce` (se privado) OU `content TEXT` (se em claro).
- `messages.nonce TEXT`, `prayer_requests.is_private BOOLEAN DEFAULT false`, `prayer_requests.nonce TEXT` adicionados.

Ver seção 6 para o modelo criptográfico completo.

#### Comunicação
- **`prayer_requests`**: `profile_id FK`, `requester_id FK auth.users ON DELETE SET NULL`, `requester_type CHECK IN ('missionary','partner')`, `content TEXT`, `is_answered BOOLEAN`, `answered_at`, `is_private BOOLEAN`, `nonce`.
- **`messages`**: `sender_id`, `recipient_id` (FK auth.users), `profile_id FK` (contexto de qual missionário), `content TEXT`, `is_encrypted BOOLEAN DEFAULT false`, `nonce`. Não existe tabela `conversations` — o ID de conversa é derivado (ver seção 6.3).
- **`notifications`**: `recipient_user_id FK auth.users CASCADE`, `type TEXT`, `payload JSONB DEFAULT '{}'`, `read_at`.

#### Billing / IA / WhatsApp / Câmbio (schema pronto, sem integração)
- **`subscriptions`**: `profile_id UNIQUE FK`, `stripe_subscription_id UNIQUE`, `plan CHECK IN ('free','pro','mission')`, `status TEXT`, `current_period_end`.
- **`ai_credit_transactions`**: `profile_id FK`, `amount INTEGER` (positivo=crédito, negativo=consumo), `reason TEXT`.
- **`whatsapp_config`**: `profile_id UNIQUE FK`, `phone_number_id`, `verify_token`, `notifications_enabled`, `financial_enabled`, `is_verified`.
- **`exchange_rates`**: `base TEXT`, `rates JSONB`, `UNIQUE(base)`.

#### `history_blocks`
Blocos estilo Notion para página `/historia`. `profile_id FK`, `type CHECK IN ('who_we_are','our_calling','timeline','cta','text')`, `content JSONB DEFAULT '{}'`, `order_index`.

### 3.2 Functions e triggers auxiliares

- `update_updated_at()` — genérico, `BEFORE UPDATE`, aplicado em `profiles`, `posts`, `highlights`, `financial_accounts`, `subscriptions`, `history_blocks`.
- `handle_new_user()` `SECURITY DEFINER` — cria `profiles` no signup.
- `update_account_balance()`, `update_highlight_current_amount()` — ver acima.
- `set_highlight_completed_at()` — `BEFORE UPDATE ON highlights`.
- `is_profile_owner(p_profile_id)` `SECURITY DEFINER STABLE` (migration 004) — `EXISTS (SELECT 1 FROM profiles WHERE id=p_profile_id AND user_id=auth.uid())`. Criada especificamente para **quebrar recursão de RLS** quando policies de tabelas diferentes se referenciam mutuamente.
- `is_authorized_partner(p_profile_id)`, `has_partner_grant(p_profile_id, p_section)` `SECURITY DEFINER STABLE` (migration 011) — mesma técnica anti-recursão, aplicadas a `partners`/`partner_visibility_grants`.
- `notify(p_recipient_user_id, p_type, p_payload)` `SECURITY DEFINER` (migration 014) — helper de inserção em `notifications` (no-op se recipient NULL). **Decisão de design**: notificações disparadas por trigger Postgres, não por código da aplicação, para garantir disparo mesmo de fontes futuras fora do Next.js (app mobile, webhook WhatsApp).
  - `trg_notify_new_pledge`, `trg_notify_pledge_confirmed`, `trg_notify_new_message`, `trg_notify_new_partner`, `trg_notify_highlight_update` (notifica todos os parceiros quando um post vinculado a projeto é publicado), `trg_notify_prayer_reply` (migration 015).

### 3.3 RLS — padrões e histórico de bugs

Padrão geral: "dono" = existe `profiles` com `user_id = auth.uid()` cujo `id` bate com o FK da linha (`FOR ALL`). Leitura pública condicionada a `privacy_mode='public'` (ou dono, ou parceiro autorizado via função `SECURITY DEFINER`).

**Bug histórico de recursão** (documentar para não repetir): a versão inicial (migration 002) de `profiles_public_read` consultava `partners`, e `partners_owner_all` consultava `profiles` → loop infinito de RLS. Corrigido na migration 004 removendo a referência cruzada e introduzindo `is_profile_owner()` como função `SECURITY DEFINER` (que "escapa" da RLS internamente, quebrando o ciclo). O mesmo padrão foi reaplicado na migration 011 ao reintroduzir acesso de parceiros a perfis privados/stealth.

**Regra a preservar em uma reimplementação**: sempre que uma policy de RLS precisar checar uma condição que depende de outra tabela que também tem RLS referenciando a primeira, envolver a checagem em uma função `SECURITY DEFINER STABLE`.

Buckets de Storage (migration 003): `media` (público, 500MB, webp/jpeg/png/gif/mp4/webm/quicktime) e `avatars` (público, 5MB, webp/jpeg/png). Policy de escrita: `auth.uid()::text = (storage.foldername(name))[1]` — cada usuário só grava dentro de uma pasta com seu próprio UUID como primeiro segmento do path.

### 3.4 Correção de exclusão de conta (migration 017)

FKs para `auth.users` sem `ON DELETE` explícito usam `NO ACTION` — excluir um usuário falhava sempre que ele aparecia como "quem fez X" em linha pertencente a **outro** perfil (ex: parceiro de outro missionário). Corrigido tornando nullable + `ON DELETE SET NULL` em: `partners.user_id`, `financial_accounts.created_by_user_id`, `transactions.created_by_user_id`, `posts.created_by_user_id`, `project_members.invited_by_user_id`, `pledges.reviewed_by_user_id`, `prayer_requests.requester_id`, `prayer_request_replies.author_user_id`; e `ON DELETE CASCADE` em `account_members.user_id`.

---

## 4. Edge Functions (`supabase/functions/`)

Diretório existe mas está **vazio**. Toda lógica server-side hoje mora em API Routes do Next.js (`src/app/api/`) e em triggers/functions SQL no Postgres.

---

## 5. Backend applicativo (`src/lib/`, `src/app/api/`, middleware)

### 5.1 Clientes Supabase

- **`src/lib/supabase/client.ts`**: `createBrowserClient` (`@supabase/ssr`) com `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` — Client Components, respeita RLS via sessão do cookie.
- **`src/lib/supabase/server.ts`**: dois clientes:
  - `createClient()` — `createServerClient` com **anon key**, usando `cookies()` de `next/headers` — Server Components/Route Handlers, respeita RLS.
  - `createServiceClient()` — mesma estrutura mas com `SUPABASE_SERVICE_ROLE_KEY` — **bypassa RLS**. Usado só em rotas que precisam de operação administrativa (deletar usuário, buscar por e-mail em todos os usuários, escrever em nome de outro usuário).

### 5.2 `src/proxy.ts` — middleware de autenticação (Next 16 renomeou `middleware.ts` → `proxy.ts`)

- Refresh de sessão via `@supabase/ssr` operando sobre cookies da request/response.
- `PROTECTED_ROUTES = ['/dashboard']` → sem `user`, redirect `/login?redirect={pathname}`.
- `AUTH_ROUTES = ['/login', '/cadastro', '/recuperar-senha']` → já autenticado, redirect `/dashboard`.
- `matcher` exclui `_next/static`, `_next/image`, `favicon.ico`, extensões de imagem.
- **Nota**: só `/dashboard` é protegido pelo middleware. Perfis públicos e demais rotas dependem só de RLS para controle de acesso.
- **Gap conhecido**: `/recuperar-senha` está listado como rota de auth mas a página não existe (só referenciada por um link no login).

### 5.3 API Routes (`src/app/api/`)

Todas autenticam com `createClient()` (RLS) e usam `createServiceClient()` (bypass RLS) só para as escritas administrativas.

#### `POST /api/account/delete`
Exclusão de conta (LGPD/GDPR-style):
1. Exige usuário autenticado; payload `{ confirm: string }`.
2. Se o usuário tem `profiles.username`, exige `confirm === username`; senão (só parceiro) exige `confirm === 'EXCLUIR'`.
3. Remove recursivamente todos os arquivos do usuário nos buckets `media` e `avatars` (função `collectAllFiles`, paginado 1000/nível).
4. `admin.auth.admin.deleteUser(user.id)` — cascata cuida do resto via FKs (migration 017).

#### `POST` / `DELETE /api/accounts/members`
Gerencia membros de `financial_accounts` compartilhadas.
- Helper `assertOwnsAccount`: confirma `financial_accounts.profile_id → profiles.user_id === solicitante`.
- `POST { accountId, email, role }`: busca usuário por e-mail via `admin.auth.admin.listUsers` (paginado 200/página, loop até achar ou esgotar — **não há índice de e-mail direto**). 404 se não encontrar. Insere em `account_members` (`role` default `'viewer'`).
- `DELETE { memberId, accountId }`: remove de `account_members`.

#### `POST /api/highlights` — criar/editar projeto + filhos
Faz upsert completo de `highlights` + `milestones` + `project_budget_categories`. Usa `fetch` cru contra o PostgREST (`${SUPABASE_URL}/rest/v1/...`, header `Authorization: Bearer <service_role>`) em vez do client `supabase-js` (helpers `dbPost`/`dbPatch`/`dbDelete`).
- `slugify(text)` recalcula `slug` a cada save a partir do título.
- Se `highlightId` existe → `PATCH`; senão → busca `MAX(order_index)` do profile e `POST` com `order_index+1`.
- Milestones e budget categories: estratégia **"delete all + recreate"** a cada save (não faz diff incremental).
- ⚠️ **Risco de segurança conhecido**: não valida explicitamente que `user.id` é dono do `profileId` recebido antes de usar a service key — a autorização é assumida do lado do chamador (form do dashboard). **Ao reimplementar, adicionar essa checagem explícita no servidor.**

#### `POST` / `DELETE /api/projects/members`
Gerencia `project_members` (equipe) e sincroniza acesso financeiro.
- Helper `getOwnedHighlight`: confirma posse via `highlights.profile_id → profiles.user_id`.
- `POST { highlightId, email, role }`: busca usuário por e-mail (mesmo padrão paginado). Insere em `project_members`. Garante que existe `financial_accounts` vinculada ao `highlight_id` (cria `{ name: 'Equipe — {title}', is_shared: true }` se não existir). Insere o membro também em `account_members`, mapeando `role='lead' → 'owner'`, demais → `'viewer'`.
- `DELETE { memberId, highlightId, memberUserId }`: remove de `project_members` e, se aplicável, de `account_members` do mesmo par.

### 5.4 `src/lib/financial/projection.ts` — projeção de arrecadação

```
daysSinceCreated = max(1, floor((agora - createdAt) / 1 dia))
dailyPace = raisedAmount / daysSinceCreated
daysRemaining = fundingDeadline ? max(0, ceil((deadline - agora)/1 dia)) : null
projectedFinal = daysRemaining !== null ? raisedAmount + dailyPace * daysRemaining : raisedAmount
projectedPct = projectedFinal / goalAmount * 100
status = projectedPct >= 100 ? 'green' : projectedPct >= 80 ? 'yellow' : 'red'  (ou 'neutral' se sem goalAmount)
```
Modelo de extrapolação linear simples (não considera sazonalidade), usado só para um semáforo visual verde/amarelo/vermelho.

### 5.5 `src/lib/media/compress.ts`

- Imagens: `browser-image-compression` — `maxSizeMB: 2`, `maxWidthOrHeight: 2048`, `useWebWorker: true`, converte para `webp`, `initialQuality: 0.85`.
- Vídeos: `VIDEO_MAX_SIZE_MB = 500`, `VIDEO_MAX_DURATION_SECONDS = 30`. `getVideoDuration` lê duração offscreen via `<video>` antes do upload (sem recompressão real — vídeos fora do limite são rejeitados, não recomprimidos).
- `getMediaType(file)`, `formatFileSize(bytes)`.

---

## 6. Camada de criptografia E2EE (`src/lib/crypto/`)

Modelo: **X25519** (par de chaves por usuário) + **key-wrapping** (cada DEK de recurso é cifrada individualmente, via sealed box, para cada participante autorizado) + conteúdo cifrado simetricamente (**XSalsa20-Poly1305**) com a DEK do recurso. A chave privada do usuário nunca sai em claro do dispositivo — fica cifrada em repouso com uma chave derivada via **Argon2id** de um código de recuperação que só o usuário possui (nem o servidor consegue recuperar).

### 6.1 `e2ee.ts` — primitivas (libsodium/NaCl puro, sem DOM)
- `generateKeyPair()` → `crypto_box_keypair()` (X25519).
- `generateRecoveryCode()` → 24 chars, 6 grupos de 4, alfabeto sem ambiguidade (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sem 0/O/1/I/L), formato `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`.
- `generateSalt()`, `deriveKeyFromRecoveryCode(code, salt)` → Argon2id (`crypto_pwhash`, `OPSLIMIT_INTERACTIVE`/`MEMLIMIT_INTERACTIVE`).
- `encryptPrivateKey`/`decryptPrivateKey` → `crypto_secretbox_easy`/`_open_easy`, chave = derivada do recovery code. Erro "Código de recuperação incorreto" se a autenticação Poly1305 falhar.
- `generateDEK()` → `crypto_secretbox_keygen()`, uma por recurso.
- `wrapDEKForRecipient(dek, publicKey)` → `crypto_box_seal` (sealed box — cifra unilateral, sem handshake nem chave privada do remetente).
- `unwrapDEK(wrapped, myPublicKey, myPrivateKey)` → `crypto_box_seal_open`.
- `encryptContent`/`decryptContent` → `crypto_secretbox_easy` com a DEK do recurso.

### 6.2 `key-manager.ts` — orquestração de sessão
Cache em memória apenas (não persiste entre reloads, trade-off de segurança deliberado): `cachedPrivateKeyB64`, `cachedPublicKeyB64`, `dekCache: Map<"resourceType:resourceId", Uint8Array>`.
- `hasKeysConfigured(userId)` — SELECT em `user_encryption_keys`.
- `setupKeys(userId)` — gera par + recovery code + salt, cifra privada, insere no banco, retorna `{ recoveryCode }` (mostrado **uma única vez**).
- `unlockWithRecoveryCode(userId, code)` — busca linha, deriva chave via Argon2id, decifra privada, popula cache.
- `getPublicKeyOf(userId)` — busca chave pública de terceiros (RLS permite leitura pública de qualquer chave pública).
- `ensureResourceKey(resourceType, resourceId, grantees[])` — busca grant não revogado meu; se não existe (primeira vez), gera DEK nova e faz `upsert` de `wrapped_dek` para cada grantee com chave pública configurada (`onConflict: resource_type,resource_id,grantee_user_id`); grantees sem chave são pulados silenciosamente.
- `encryptForResource` / `decryptResource` — API de alto nível.
- `grantAccessToExisting(resourceType, resourceId, newGranteeUserId)` — concede acesso a destinatário novo numa DEK já existente **sem recifrar conteúdo**: desembrulha minha cópia, rewrap para o novo, `upsert`. Falha se o destinatário ainda não configurou E2EE.
- `revokeGrant(...)` — `UPDATE ... SET revoked_at = now()`, sem afetar os demais grantees.

### 6.3 `conversation.ts`
- `derivedResourceId(...parts)` — SHA-256 determinístico dos parts concatenados por `:`, truncado a 16 bytes, formatado como UUID (bits de versão/variant forçados manualmente). Permite ter um "ID de recurso" **sem precisar de coluna/tabela extra**.
- `conversationId(profileId, userA, userB)` — ordena os dois userIds alfabeticamente (ID estável independente de quem inicia) e chama `derivedResourceId('conversation', profileId, "userA:userB")`.

Recursos cifrados no sistema: `conversation` (DMs), `prayer_request` (pedidos/respostas privados), `profile_sensitive_fields` (dados sensíveis do perfil).

---

## 7. Fluxos de negócio (a preservar em qualquer reimplementação)

### 7.1 Autenticação e onboarding
1. **Cadastro** (`/cadastro`) → `supabase.auth.signUp` com `full_name` em metadata → trigger `handle_new_user()` já cria `profiles` com username auto-gerado → redirect para `/onboarding` (Google OAuth usa `redirectTo: /auth/callback?redirect=/onboarding`; login com Google continua indo para `/dashboard`).
2. **Onboarding guiado** (`/onboarding` → `OnboardingWizard`, `src/components/onboarding/onboarding-wizard.tsx`) — wizard client-side de 4 passos com estado interno (sem sub-rotas):
   - **Passo 1 — Perfil**: `display_name`/`username` (com checagem de disponibilidade)/`bio`/`location`/`mission_start_date` — update em `profiles`. Obrigatório para avançar (nome e username não podem ficar vazios), mas os valores já vêm pré-preenchidos pelo trigger.
   - **Passo 2 — Recebimento**: `pix_key`/`paypal_url`/`wise_url`/`external_donation_url` (mesmos campos do `PaymentForm`) — pulável via "Pular por agora".
   - **Passo 3 — Primeiro projeto**: título/descrição/meta/moeda → `POST /api/highlights` com `goalTypes: ['financial']`, `status: 'active'` — pulável.
   - **Passo 4 — Concluído**: resumo do que ficou pendente, CTA para `/dashboard`.
   - Nenhum estado de "pulou" é persistido — a pendência é sempre recalculada a partir dos dados reais (ver item 7.10-bis abaixo e `SetupChecklistBanner`).
3. **Login** (`/login`) → e-mail/senha ou Google OAuth (`redirectTo: /auth/callback?redirect=...`), preserva `?redirect=`.
4. **Callback** (`/auth/callback/route.ts`) → `exchangeCodeForSession`, redirect.
5. **Proteção**: middleware (`proxy.ts`) protege `/dashboard`; layout do dashboard revalida `user`+`profile` (sem fallback para onboarding — assume que o trigger sempre cria o profile). O onboarding guiado não é forçado por middleware — quem pular etapas cai direto no dashboard com o alerta de pendência.
6. **Exclusão de conta**: duas entradas (`/conta/excluir` para quem só é parceiro, exige digitar `EXCLUIR`; `AccountForm` em Configurações para quem tem profile, exige digitar `@username`) → ambas chamam `POST /api/account/delete`.
7. **Alerta de configuração pendente** (`SetupChecklistBanner`, `src/components/dashboard/setup-checklist-banner.tsx`, renderizado em `dashboard/page.tsx`) — banner no topo do dashboard, computado (não armazenado) a partir de 3 condições: perfil incompleto (sem avatar OU username ainda no padrão auto-gerado `nome_xxxxxx`), nenhum método de recebimento configurado, e zero `highlights`. Mostra só os itens pendentes com link direto para resolver; desaparece sozinho quando os 3 estão OK. Dismissable via `localStorage` (`profile-banner-dismissed`, mesmo padrão do banner anterior que substituiu).

### 7.2 Pledge (registro manual de oferta) → conciliação
O sistema **não processa pagamentos** — Pix/PayPal/etc. acontecem fora da plataforma.
1. Parceiro/visitante preenche `PledgeForm`: escolhe `payment_method` dentre os configurados pelo missionário, valor, data, nome/e-mail, comprovante opcional (upload comprimido para bucket `media`).
2. Insert em `pledges` com `status='pending'` (qualquer um pode inserir, mesmo anônimo/não-parceiro — RLS `WITH CHECK (true)`).
3. Trigger notifica o missionário (`new_pledge`).
4. Missionário revisa em `PledgeReviewCard` (dashboard → Financeiro → Conciliação):
   - **Confirmar**: promove/cria `partners` a partir do `reporter_user_id`, cria uma `transactions` real (`type: income`) na conta escolhida, atualiza `pledges.status='confirmed'` + `confirmed_transaction_id`. Trigger notifica o reporter (`pledge_confirmed`).
   - **Rejeitar**: atualiza `status='rejected'` + `rejection_reason` opcional.

### 7.3 Wizard de parceria (`PartnershipWizard`)
Máquina de estados com `choice: 'financial_once' | 'financial_ongoing' | 'prayer' | 'ambassador' | 'volunteer' | null`.
- Tela inicial oferece até 5 opções (as financeiras só aparecem se o missionário tem métodos de pagamento configurados).
- `financial_once` (veio de um link de projeto específico) → `PledgeForm` com `highlightId` preenchido.
- `financial_ongoing` (parceria geral, recorrente) → `PledgeForm` sem `highlightId`, `isRecurring=true`.
- `prayer`/`ambassador`/`volunteer` → `PartnershipForm` (cadastro direto em `partners`, sem exigir login) com `type` mapeado.

### 7.4 Visibilidade granular por parceiro (`VisibilityGrantsDialog`)
Toggle de 5 seções (`full_profile`, `financial_summary`, `prayer_requests`, `sensitive_fields`, `messages`) por parceiro:
- Toggle ON → `INSERT` em `partner_visibility_grants`; se seção = `sensitive_fields`, **também** chama `keyManager.grantAccessToExisting('profile_sensitive_fields', profileId, partnerUserId)` para compartilhar a DEK real (a concessão relacional sozinha não dá acesso ao conteúdo cifrado).
- Toggle OFF → `DELETE` da linha.
- Se o parceiro não configurou E2EE ainda (sem `public_key`), a concessão criptográfica falha e a UI avisa — a concessão relacional fica salva "pendente" até ele configurar.

### 7.5 `E2EEGate` — desbloqueio de conteúdo cifrado
Estados: `checking → needs_setup | needs_unlock → showing_recovery_code → unlocked`.
1. `checking`: `keyManager.isUnlocked()` (cache em memória) → se não, `hasKeysConfigured(userId)`.
2. `needs_setup` (primeira vez): botão gera chaves + recovery code, salva no banco.
3. `showing_recovery_code`: exibe código, checkbox obrigatório "eu salvei", aviso "nem nós temos acesso, se perder não recupera".
4. `needs_unlock` (novo dispositivo): input de recovery code → deriva e decifra a privada.
5. `unlocked`: libera os `children` (mensagens/orações/dados sensíveis).

### 7.6 Mensagens diretas
- Envio (`MessageComposer`): deriva `conversationId`, cifra com `encryptForResource('conversation', ...)`, insere em `messages` com `is_encrypted: true`.
- Leitura (`MessageThread`): busca por par de usuários + `profile_id`, decifra individualmente (falha silenciosa → `'🔒 Não foi possível decifrar esta mensagem.'`).
- Realtime: canal `messages-${profileId}-${otherUserId}`, evento INSERT, recarrega tudo (sem append incremental).

### 7.7 Projetos (`HighlightForm`) — o formulário mais complexo do sistema
- Capa com **reposicionamento por arraste** (drag customizado, calcula `objectPosition` %X/%Y, salvo como string em `cover_position`).
- Multi-seleção de `goalTypes`.
- Se `financial`: alterna entre modo "meta única" (`goalAmount`/`currentAmount` diretos) e modo "orçamento por categoria" (soma automática das `project_budget_categories` vira a meta total).
- Marcos (`milestones`) editáveis inline.
- Conteúdo: versículo (`scripture`), carta (`letter`).
- Status (active/completed/hidden) só em modo edição.
- Salva via `POST /api/highlights` (não Supabase client direto — precisa de service role para upsert atômico de milestones/budget categories).

### 7.8 Equipe do projeto (`ProjectTeamPanel` + `/api/projects/members`)
Entrar na equipe (`project_members`) concede automaticamente acesso à conta financeira compartilhada do projeto (`account_members`), com nível de acesso derivado do papel: `lead → owner`, demais → `viewer`.

### 7.9 Publicações (`PostEditor`)
`postType` derivado automaticamente da mídia selecionada (nenhuma→text, 1 vídeo→video, >1 arquivo→carousel, 1 imagem→image). Compressão de imagem client-side, validação (não compressão) de vídeo por tamanho/duração. Upload sequencial para bucket `media` em `${userId}/${timestamp}-${i}.${ext}`.

### 7.10 Notificações (`useNotifications` hook)
Carga inicial: não lidas, `LIMIT 20`. Realtime: canal `'notifications'`, filtro `recipient_user_id=eq.${userId}` no Postgres changes, prepend local a cada INSERT. `markAllRead()` marca `read_at=now()` no banco **e limpa a lista local** — não há histórico de lidas visível no dropdown.

---

## 8. Frontend — estrutura de rotas (`src/app/`)

```
src/app/
├── layout.tsx                        # Root: ThemeProvider + Toaster (sonner) + fonte Inter
├── page.tsx                          # Landing (redirect /dashboard se autenticado) — hero + "como funciona" + vitrine de módulos + teaser de planos
├── planos/page.tsx                   # Server — página de preços pública; PricingToggle (client) chama /api/billing/checkout
├── globals.css
├── (auth)/                           # Route group sem prefixo de URL
│   ├── layout.tsx                    # Card centralizado, sem nav
│   ├── login/page.tsx                # Client, Suspense (useSearchParams)
│   └── cadastro/page.tsx             # Client — signUp → redirect /onboarding
├── auth/callback/route.ts            # Route Handler — troca code OAuth por sessão
├── onboarding/page.tsx                # Server — busca profile, renderiza OnboardingWizard (client, wizard de 4 passos — ver 7.1)
├── conta/excluir/page.tsx             # Exclusão para quem só é parceiro
├── [username]/                        # Perfil público
│   ├── page.tsx                       # Server, generateMetadata; lógica de privacidade completa
│   ├── historia/page.tsx              # Blocos "nossa história"
│   ├── trajetoria/page.tsx            # Timeline de projetos concluídos
│   ├── parceria/page.tsx              # Entrada do PartnershipWizard
│   ├── oracao/page.tsx                # Pedido de oração público
│   ├── mensagens/page.tsx             # Chat 1:1 (exige ser parceiro) + E2EEGate
│   └── projetos/
│       ├── page.tsx                   # Lista pública (ativos + concluídos)
│       └── [slug]/page.tsx            # Página pública de projeto (fundraising completo)
└── dashboard/
    ├── layout.tsx                     # Shell autenticado: sidebar + bell + mobile nav
    ├── page.tsx                       # Visão geral / stats
    ├── destaques/                     # LEGADO — page.tsx redireciona para /dashboard/projetos
    │   ├── page.tsx                   # redirect('/dashboard/projetos')
    │   ├── novo/page.tsx              # ainda funcional, desconectado
    │   └── [id]/page.tsx              # ainda funcional, desconectado
    ├── publicacoes/
    │   ├── page.tsx
    │   └── nova/page.tsx
    ├── projetos/                      # rota "atual" (substituiu destaques)
    │   ├── page.tsx
    │   ├── novo/page.tsx
    │   ├── actions.ts                 # Server Action legada 'use server' — código morto
    │   └── [id]/
    │       ├── page.tsx
    │       └── equipe/page.tsx
    ├── parceiros/page.tsx
    ├── oracoes/page.tsx                # com E2EEGate condicional
    ├── mensagens/
    │   ├── page.tsx
    │   └── [userId]/page.tsx          # com E2EEGate
    ├── financeiro/
    │   ├── layout.tsx                 # FinanceSubNav
    │   ├── page.tsx                   # Visão geral
    │   ├── contas/page.tsx
    │   ├── lancamentos/page.tsx
    │   ├── categorias/page.tsx
    │   └── conciliacao/page.tsx       # Fila de pledges pendentes
    └── configuracoes/page.tsx         # SettingsTabs
└── api/
    ├── account/delete/route.ts
    ├── accounts/members/route.ts
    ├── projects/members/route.ts
    ├── highlights/route.ts
    └── billing/checkout/route.ts      # Cria Stripe Checkout Session — 501 se STRIPE_SECRET_KEY não configurado (ver seção 2)
```

> **Gaps/inconsistências conhecidas (documentadas para não serem "redescobertas" como bugs)**:
> - `destaques` (nome legado) vs `projetos` (nome atual) — migração de nomenclatura incompleta; `destaques/novo` e `destaques/[id]` ainda funcionam mas ficaram órfãos de navegação.
> - Duas implementações paralelas de salvar highlight: `dashboard/projetos/actions.ts` (Server Action, não usada por nenhum componente) e `POST /api/highlights` (efetivamente usada) — a Server Action é código morto.
> - Link de nav "IA Copiloto" → `/dashboard/ia` não tem página implementada.
> - `/recuperar-senha` referenciado no login mas sem página.

### Renderização
Todas as páginas de rota (exceto formulários) são **Server Components** assíncronos que buscam dados via `createClient()` de `@/lib/supabase/server` e passam como props para Client Components de interação. Padrão de mutação client-side: `setSaving(true)` → `supabase.from(table).insert/update/delete()` → toast de erro (`sonner`) ou `router.refresh()`/`router.push()`.

### Lógica notável de páginas específicas
- **`[username]/page.tsx`**: `stealth` → 404 real (`notFound()`) + `robots: noindex`; `private` → exige login + vínculo em `partners`, senão `PrivateProfileScreen`.
- **`[username]/projetos/[slug]/page.tsx`**: aceita slug OU UUID (`.or('slug.eq.X,id.eq.X')`); busca em paralelo milestones, posts do projeto, `project_budget_progress`, projetos concluídos anteriores, contagem de pledges confirmados; monta lista de formas de apoio filtrando por `goal_type` e métodos de pagamento disponíveis.
- **`dashboard/financeiro/*`**: RLS decide visibilidade de contas compartilhadas — queries não filtram `profile_id` explicitamente para `financial_accounts`.

---

## 9. Layouts

- **`app/layout.tsx`**: fonte `Inter` (`next/font/google`, var `--font-sans`), `ThemeProvider` (`next-themes`, `attribute="class"`, `defaultTheme="system"`), `<Toaster richColors position="top-right" />` global, `<html lang="pt-BR" suppressHydrationWarning>`.
- **`(auth)/layout.tsx`**: `min-h-screen flex items-center justify-center bg-muted/30`, `max-w-md`, sem nav.
- **`dashboard/layout.tsx`**: guarda de auth (Server) — sem `user` ou sem `profile` → `redirect('/login')`. `flex h-screen overflow-hidden`: `DashboardSidebar` (desktop), header com `MobileHeader` + `NotificationsBell`, `<main className="max-w-5xl mx-auto">`, `MobileBottomNav` fixo (mobile).
- **`dashboard/financeiro/layout.tsx`**: guarda de auth + título "Financeiro" + `FinanceSubNav`.

---

## 10. Inventário de componentes (`src/components/`)

### `dashboard/`
| Componente | Papel |
|---|---|
| `sidebar.tsx` | `DashboardSidebar` (nav desktop, 9 itens), `MobileHeader`, `MobileBottomNav` (tab bar + drawer), `useSignOut()` |
| `notifications-bell.tsx` | Dropdown com badge de não lidas, usa `useNotifications` |
| `post-editor.tsx` | Criar/editar posts, upload multi-mídia, compressão, detecção de `postType` |
| `posts-list.tsx` | Lista com toggle draft/publicado, editar/excluir |
| `setup-checklist-banner.tsx` | `SetupChecklistBanner` — checklist dismissível (localStorage + `CustomEvent`/`useSyncExternalStore`) com até 3 itens pendentes: perfil incompleto, sem método de recebimento, sem projeto criado (ver 7.1) |
| `settings/settings-tabs.tsx` | Tabs client-side (Perfil/Pagamentos/Privacidade/Conta) |
| `settings/profile-form.tsx` | Avatar, checagem de username disponível (debounce 500ms), redes sociais |
| `settings/payment-form.tsx` | Pix/PayPal/Wise/link externo |
| `settings/privacy-form.tsx` | 3 modos de privacidade + `SensitiveDataForm` dentro de `E2EEGate` |
| `settings/sensitive-data-form.tsx` | Dados sensíveis cifrados (blob único JSON) |
| `settings/account-form.tsx` | Trocar senha, zona de perigo (exclusão) |

### `financial/`
| Componente | Papel |
|---|---|
| `account-card.tsx` | Card de conta, badge compartilhada, editar/gerenciar membros |
| `account-form.tsx` | Dialog criar/editar conta |
| `balance-summary.tsx` | Saldo total por moeda + entradas/saídas do mês |
| `category-tree.tsx` | Árvore 2 níveis de categorias |
| `finance-sub-nav.tsx` | Tabs de navegação (`usePathname`) |
| `manage-members-dialog.tsx` | Add/remove membro de conta compartilhada via API |
| `new-transaction-button.tsx` | Abre `TransactionForm` |
| `pledge-review-card.tsx` | Confirmar/rejeitar pledge (ver fluxo 7.2) |
| `reconciliation-queue.tsx` | Lista de `PledgeReviewCard` |
| `transaction-filters.tsx` | Filtros via query string |
| `transaction-form.tsx` | Dialog criar/editar transação, máscara BRL |
| `transaction-table.tsx` | Lista, editar inline, excluir (`window.confirm`) |

### `highlights/` (projetos)
| Componente | Papel |
|---|---|
| `budget-breakdown.tsx` | Barra de progresso por categoria de orçamento |
| `funding-projection-card.tsx` | Usa `computeFundingProjection` |
| `highlight-form.tsx` | Ver fluxo 7.7 |
| `highlights-list.tsx` | Reordenar, toggle ativo/oculto, excluir |
| `project-team-panel.tsx` | Ver fluxo 7.8 |

### `messages/`
| Componente | Papel |
|---|---|
| `conversation-list.tsx` | Lista de conversas (derivada em memória, sem tabela própria) |
| `e2ee-gate.tsx` | Ver fluxo 7.5 |
| `message-composer.tsx` | Ver fluxo 7.6 |
| `message-thread.tsx` | Ver fluxo 7.6 |

### `partners/`
| Componente | Papel |
|---|---|
| `add-partner-button.tsx` | Adicionar parceiro manual, respeita limite do plano (free=2) |
| `partners-list.tsx` | Filtro, badge por tipo, `VisibilityGrantsDialog`, link de mensagem |
| `partnership-form.tsx` | Form público "quero ser parceiro", grava direto sem login |
| `partnership-wizard.tsx` | Ver fluxo 7.3 |
| `pledge-form.tsx` | Ver fluxo 7.2 |
| `visibility-grants-dialog.tsx` | Ver fluxo 7.4 |

### `prayer/`
| Componente | Papel |
|---|---|
| `new-prayer-button.tsx` | Missionário cria pedido próprio (sempre em claro) |
| `prayer-inbox.tsx` | Tabs (Todos/Meus/De parceiros/Respondidos), decifra on-demand |
| `prayer-request-form.tsx` | Form público, checkbox "privado (cifrado)", exige `keyManager.isUnlocked()` se marcado |

### `profile/`
| Componente | Papel |
|---|---|
| `history-view.tsx` | Renderiza `history_blocks` |
| `profile-cta.tsx` | Botões de ação do perfil público |
| `profile-header.tsx` | Avatar/nome/localização/bio/redes — condicionado a `privacy_mode` |
| `projects-section.tsx` | Cards de projeto no perfil público |
| `trajectory-timeline.tsx` | Timeline vertical de projetos concluídos |

### `onboarding/`
| Componente | Papel |
|---|---|
| `onboarding-wizard.tsx` | `OnboardingWizard` — wizard client de 4 passos (perfil/recebimento/primeiro projeto/concluído) com estado interno, ver fluxo 7.1 |

### `pricing/`
| Componente | Papel |
|---|---|
| `pricing-toggle.tsx` | `PricingToggle` — cards Free/Pro/Missão a partir de `src/lib/pricing.ts`, toggle mensal/anual, botão "Assinar" chama `POST /api/billing/checkout` |

### `ui/` (shadcn v4 sobre `@base-ui/react`)
`avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `progress`, `sonner`, `textarea`.

---

## 11. Convenções de UI (shadcn v4 + `@base-ui/react`)

- `components.json`: `"style": "base-nova"`, `"rsc": true`, `"iconLibrary": "lucide"`, `"baseColor": "neutral"`, `"cssVariables": true`, sem prefixo Tailwind.
- Primitivos vêm de `@base-ui/react/*`, **não** Radix (apesar de `@radix-ui/*` ainda instalado como resquício não usado nos componentes lidos).
- Padrão de composição: **prop `render`** em vez de `asChild`:
  ```tsx
  <DialogTrigger render={<Button variant="ghost" size="icon-sm"><ShieldCheck /></Button>} />
  ```
- **Botão dentro de `<Link>`**: como `next/link` não aceita `render`, o padrão universal do projeto é `className={cn(buttonVariants({ variant, size }))}` direto no `<Link>` — nunca envolver `<Link>` num `<Button>`.
- Variantes via `cva` + atributos `data-slot` para estilização granular; animações via `data-open`/`data-closed`/`data-[side=...]` (CSS puro, `tw-animate-css`).
- `Button`: variantes `default|outline|secondary|ghost|destructive|link`, tamanhos `default|xs|sm|lg|icon|icon-xs|icon-sm|icon-lg`.
- Forms: **sem** `react-hook-form`/`zod` — sempre `useState` por campo + validação inline no `onSubmit` + toast de erro. Padrão: `Label` + `Input`/`Textarea` em `space-y-2`, grupos em `space-y-4`, campos lado a lado em `grid grid-cols-2 gap-3`.
- `<select>` nativo do HTML (não há componente `Select` do shadcn em uso), estilizado manualmente igual ao `Input`.
- Toasts: `sonner`, sempre em português (`toast.error`/`toast.success`).
- Ícones: `lucide-react` exclusivamente.

### Tema (`src/app/globals.css`)
- Tailwind v4 CSS-first (`@import "tailwindcss"`), sem `tailwind.config.js`.
- `@custom-variant dark (&:is(.dark *));` (compatível com `next-themes attribute="class"`).
- Cores em **OKLCH**, paleta monocromática "carbon" (`--primary` quase preto/branco), única cor com chroma real é `--destructive` (`oklch(0.577 0.245 27.325)`).
- `--radius: 0.625rem` base, escala via `calc()`.
- `--font-sans` = Inter, `--font-heading` = alias de `--font-sans` (sem fonte de display separada).
- `.scrollbar-hide` utilitário customizado (tabs horizontais sem barra visível).
- `profile.accent_color`: cor hex livre por usuário, aplicada via `style={{ backgroundColor }}` inline (fora do design system CSS).

---

## 12. Configurações de projeto

- **`components.json`**: aliases `@/components`, `@/lib`, `@/hooks`, `@/components/ui`, `@/lib/utils`.
- **`next.config.ts`**: `images.remotePatterns` liberando o hostname do bucket Supabase Storage (`eqnekupeiehgkacegmgl.supabase.co`) para `next/image`.
- **`tsconfig.json`**: `target: ES2017`, `strict: true`, `moduleResolution: bundler`, `jsx: react-jsx`, alias único `"@/*": ["./src/*"]`, inclui `.next/types`/`.next/dev/types` (Next 16).

---

## 13. Passo a passo para recriar o sistema do zero

1. `create-next-app` (App Router, TypeScript, Tailwind v4) → renomear `middleware.ts` para `proxy.ts` (convenção Next 16 usada aqui).
2. Instalar shadcn/ui v4 com `@base-ui/react` (`style: base-nova`, `baseColor: neutral`), configurar `components.json` conforme seção 12.
3. Criar projeto Supabase; aplicar as migrations 001→017 **na ordem exata** (seção 3), respeitando os padrões anti-recursão de RLS (`SECURITY DEFINER STABLE` functions) desde o início para não repetir os bugs das migrations 004/011.
4. Configurar buckets de Storage (`media`, `avatars`) com as policies de pasta-por-usuário.
5. Implementar `src/lib/supabase/{client,server}.ts` com os dois clientes (anon/service role).
6. Implementar `src/proxy.ts` com as rotas protegidas/de auth.
7. Implementar a camada E2EE (`src/lib/crypto/{e2ee,key-manager,conversation}.ts`) **antes** de qualquer feature que dependa dela (mensagens, dados sensíveis, orações privadas).
8. Construir as rotas na ordem: auth → onboarding → dashboard shell (layout+sidebar) → perfil público → projetos → parceiros → financeiro → mensagens/orações (E2EE) → notificações.
9. Ao chegar em Stripe/IA/WhatsApp/câmbio: o schema já existe (seção 3), falta escrever toda a camada de integração (`src/lib/stripe/`, `src/lib/ai/`, `src/lib/exchange/`, webhooks, Edge Functions) — não há código de referência no sistema atual para essas partes.
10. Corrigir de saída as inconsistências já conhecidas (seção 8) em vez de reproduzi-las: unificar nomenclatura `destaques`→`projetos`, remover a Server Action morta, implementar `/recuperar-senha`, adicionar checagem de posse em `/api/highlights`, e considerar mover os triggers de saldo agregado para também reagir a `UPDATE`.

---

## Changelog

> Adicione uma entrada aqui (mais recente no topo) toda vez que este arquivo for atualizado por causa de uma mudança real no sistema. Formato: `AAAA-MM-DD — o que mudou no sistema — o que foi atualizado neste doc`.

- **2026-07-05** — Landing page reformulada (tour dos módulos + "como funciona" + teaser de planos), onboarding guiado de 4 passos após o cadastro (`OnboardingWizard`, cada etapa pulável), `SetupChecklistBanner` substituindo o banner de perfil incompleto (agora cobre perfil/recebimento/primeiro projeto), nova página pública `/planos` com preços e CTA de assinatura, e scaffold de checkout Stripe (`src/lib/stripe/client.ts` + `POST /api/billing/checkout`, inativo até `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*` serem preenchidos) — seções 2, 7.1, 8 e 10 atualizadas.
- **2026-07-05** — Criação inicial deste documento, a partir de varredura completa do estado do repositório (migrations 001–017, `src/lib`, `src/app`, `src/components`, `src/proxy.ts`, `src/types`).
