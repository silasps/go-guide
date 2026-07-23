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
- (Planejado, schema pronto mas **sem código de integração ainda**): assinaturas Stripe (planos free/pro/mission + créditos de IA avulsos), IA copiloto via Claude API, WhatsApp Business API, conversão de câmbio via ExchangeRate-API, e-mail transacional via Brevo.

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
| i18n | `next-intl` — PT/EN/ES, sem prefixo de URL (ver seção 5.6) |
| Backend/DB | Supabase (Postgres + Auth + Storage + Realtime), acessado via `@supabase/ssr` e `@supabase/supabase-js` |
| Criptografia E2EE | `libsodium-wrappers` (X25519 + XSalsa20-Poly1305 + Argon2id), 100% client-side |
| Compressão de mídia | `browser-image-compression` (imagens → WebP) |
| Geração de PDF | `pdfkit` (comprovante de doações do parceiro, seção 7.1-bis — API imperativa, sem dependência de React) |
| Pagamentos (planejado, não implementado) | `stripe`, `@stripe/stripe-js` |
| E-mail (planejado, não implementado) | `@getbrevo/brevo` (Brevo) |
| IA | `@anthropic-ai/sdk` (Anthropic Claude API) — tradução de conteúdo (`claude-haiku-4-5`, seção 5.6.1) implementada; demais usos futuros |
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
STRIPE_CONNECT_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_MISSION_MONTHLY=
STRIPE_PRICE_MISSION_YEARLY=
STRIPE_PRICE_CREDITS_20=
STRIPE_PRICE_CREDITS_50=
STRIPE_PRICE_CREDITS_100=

# Brevo (e-mail transacional)
BREVO_API_KEY=
BREVO_FROM_EMAIL=

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

# Superadmin (allowlist de e-mails, ver 7.1-bis — só habilita a barra de
# pré-visualização de papel no dashboard, nunca troca user_role de ninguém)
SUPERADMIN_EMAILS=
```

> **Status real das integrações**: Brevo, ExchangeRate-API e WhatsApp têm **schema de dados pronto** (tabelas, colunas, RLS) mas **nenhum código de integração** foi escrito (`src/lib/exchange/` e `supabase/functions/` estão vazios). Ao reconstruir, essas integrações precisam ser implementadas do zero seguindo o schema descrito abaixo. **Anthropic** deixou de ser "só schema": a primeira integração real (tradução de conteúdo do usuário) foi implementada — ver seção 5.6.1.
>
> **Stripe** tem um passo a mais que os outros: além do schema, já existe o **scaffold de checkout** (`src/lib/stripe/client.ts` + `POST /api/billing/checkout`, chamado pela página `/planos`). `getStripeClient()` retorna `null` enquanto `STRIPE_SECRET_KEY` estiver vazio, e a rota responde `501 { error: 'not_configured' }` nesse caso (o frontend mostra um toast "em breve"). Para ativar de verdade: preencher `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*` (`.env.example`), criar os 4 Price IDs (Pro/Missão × mensal/anual) no Stripe, e ligar **Adaptive Pricing** no dashboard da Stripe para cobrança automática na moeda local do cartão (não requer lógica de moeda no código). Falta ainda o webhook que sincroniza `subscriptions`/`profiles.plan` após o checkout — não implementado.

---

## 3. Modelo de dados (Postgres / Supabase)

Extensões: `uuid-ossp`, `pgcrypto`. Todas as PKs são `UUID DEFAULT uuid_generate_v4()`. Migrations em `supabase/migrations/001` a `017` (ordem de aplicação importa — cada uma altera o resultado da anterior).

### 3.1 Tabelas principais

#### `profiles` (hub central — 1:1 com `auth.users`)
- `id` PK, `user_id UUID UNIQUE FK auth.users ON DELETE CASCADE`
- `username TEXT UNIQUE NOT NULL` (único case-insensitive via índice em `LOWER(username)`)
- `display_name`, `bio`, `location`, `show_location BOOLEAN DEFAULT true` (migration 021 — controla se `location` aparece no perfil público; independente de `privacy_mode`), `account_type TEXT DEFAULT 'individual' CHECK IN ('individual','family','organization')` (migration 022 — só personaliza textos de onboarding/bio via `AccountTypeSelector` em `src/components/profile/account-type-selector.tsx`; não afeta plano nem permissões), `user_role TEXT DEFAULT 'partner' CHECK IN ('partner','missionary')` (migration 032 — **este** é o campo que decide papel/permissão de UI, ortogonal a `account_type` acima; ver seção 7.1-bis), `avatar_url`, `cover_url`
- `privacy_mode TEXT DEFAULT 'public' CHECK IN ('public','private','stealth')`
- `plan TEXT DEFAULT 'free' CHECK IN ('free','pro','mission')`
- `stripe_customer_id`, `accent_color TEXT DEFAULT '#6366f1'` (cor livre por usuário, aplicada inline — desde 2026-07-23 esse hex é também o `--primary` fixo do app, ver seção 11 "Tema"; nenhuma migration foi necessária porque o default já coincidia com a cor de marca escolhida)
- Links sociais: `website_url`, `instagram_url`, `youtube_url`, `facebook_url`, `tiktok_url`
- `ai_credits INTEGER DEFAULT 0`
- `mission_start_date DATE` (migration 012)
- `extra_manager_seats INTEGER DEFAULT 0` (migration 023 — assentos de gestor extras comprados; ver `profile_managers` abaixo)
- `locale TEXT DEFAULT 'pt' CHECK IN ('pt','en','es')` (migration 024 — idioma preferido da **UI**; ver seção 5.6)
- `bio_locale TEXT DEFAULT 'pt' CHECK IN ('pt','en','es')` e `bio_translations JSONB DEFAULT '{}'` (migration 025 — idioma **original do conteúdo da bio** e suas traduções geradas/editadas; independente de `locale`, que só controla a interface. Ver seção 5.6.1)
- timestamps + trigger `update_updated_at`

Criado automaticamente por trigger `handle_new_user()` (`SECURITY DEFINER`, `AFTER INSERT ON auth.users`): `username = slug(email) + '_' + 6 chars do UUID`, `display_name` = `raw_user_meta_data->>'full_name'` ou prefixo do e-mail.

#### `profile_managers` (contas vinculadas — migration 023)
- `profile_id FK profiles ON DELETE CASCADE`, `user_id FK auth.users ON DELETE CASCADE`, `role CHECK IN ('manager','viewer')` DEFAULT `manager`, `invited_by_user_id`, `UNIQUE (profile_id, user_id)`
- Dá a um usuário adicional acesso "estilo Instagram" a outro perfil, sem fundir nenhum dado: `manager` = mesmo nível do dono (posts, projetos, financeiro, oração, parceiros — tudo escopado por `profile_id` continua igual, só quem pode agir muda); `viewer` = leitura (perfil, posts, projetos, prayer_requests, history_blocks — não financeiro/E2EE por padrão nesta rodada).
- `is_profile_owner(p_profile_id)` (função SQL, migration 004, redefinida na 023) passou a checar também `profile_managers.role = 'manager'` — isso propaga automaticamente para toda política de RLS que já usava essa função (`partners`, `pledges`, `project_members`, dados E2EE, `financial_accounts`/`transactions` via `019_fix_financial_rls_recursion.sql`, budget categories). As políticas que ainda faziam o check inline (de antes da função existir — `posts`, `highlights`, `prayer_requests`, `transaction_categories`, `subscriptions`, `ai_credit_transactions`, `whatsapp_config`, `history_blocks`) foram migradas na 023 para usar o helper.
- `is_profile_viewer_or_above(p_profile_id)` — mesma ideia, mas também aceita `role = 'viewer'`; usada nas políticas de leitura de `profiles`, `posts`, `highlights`, `prayer_requests`, `history_blocks`.
- Convite por e-mail via RPC `invite_profile_manager(p_profile_id, p_email, p_role)` (`SECURITY DEFINER`, já que o client não pode consultar `auth.users`) — também aplica o limite de assentos (`planLimits().managersIncluded` + `extra_manager_seats`), retornando `seat_limit_reached` se estourar.
- **Limitação conhecida (decisão consciente, não bug)**: dados E2EE (mensagens diretas, campos sensíveis do perfil, pedidos de oração privados) são cifrados com a chave do usuário real, não do perfil — um gestor não necessariamente consegue decifrar conteúdo cifrado para o dono original. Compartilhamento de chaves E2EE entre gestores fica fora de escopo por ora.
- Perfil "ativo" da sessão de dashboard é resolvido por `getActiveProfile()` (`src/lib/profile/active-profile.ts`), que lê o cookie `active_profile_id` (setado por `setActiveProfile()`, server action em `src/app/dashboard/actions.ts`) e cai de volta ao perfil próprio se o cookie for inválido/ausente. Troca de conta é feita pelo dropdown em `DashboardSidebar` (`src/components/dashboard/sidebar.tsx`). Duas exceções deliberadas continuam presas ao usuário logado, nunca ao perfil "ativo": `/onboarding` (sempre configura o perfil recém-criado do próprio usuário) e `POST /api/account/delete` (exclusão de conta nunca pode ser feita "como" outra pessoa).
- Cobrança: `planLimits()` (`src/lib/utils.ts`) ganhou `managersIncluded` (`free: 0`, `pro: 1`, `mission: 2`); pacotes pagos extras em `MANAGER_ADDONS` (`src/lib/pricing.ts`: +2 por R$15/mês, +4 por R$30/mês) com scaffold de checkout em `POST /api/billing/checkout` (`type: 'manager_addon'`) seguindo o mesmo padrão "sem `STRIPE_PRICE_MANAGERS_*` configurado → 501" do resto do billing. Como o webhook Stripe→`profiles` ainda não existe (mesma pendência já documentada acima para Pro/Missão), `extra_manager_seats` não é incrementado automaticamente após a compra ainda.

#### `posts` (feed / publicações)
`profile_id FK`, `type CHECK IN ('text','image','video','carousel')`, `content`, `media_urls TEXT[]`, `published_at`, `scheduled_at`, `is_draft BOOLEAN DEFAULT true`, `created_by_user_id FK auth.users ON DELETE SET NULL` (nullable, corrigido na 017), `project_id UUID FK highlights ON DELETE SET NULL` (migration 005 — vincula um post/relatório a um projeto específico), `original_locale TEXT DEFAULT 'pt' CHECK IN ('pt','en','es')` e `translations JSONB DEFAULT '{}'` (migration 025 — idioma em que o post foi escrito e traduções para os outros dois; ver seção 5.6.1).

#### `highlights` (= "Projetos" no produto atual)
- `profile_id FK`, `title`, `description`, `goal_amount NUMERIC(15,2)`, `current_amount NUMERIC(15,2) DEFAULT 0` (mantido por trigger, nunca calculado on-the-fly), `currency TEXT DEFAULT 'BRL'`
- `cover_url`, `cover_position TEXT DEFAULT '50% 50%'` (migration 006 — recorte de imagem estilo CSS `object-position`)
- `is_featured`, `order_index`
- `status CHECK IN ('active','hidden','completed')` (migration 008 adiciona `completed`)
- `slug TEXT` (migration 005, único composto `(profile_id, slug)`), `partner_token UUID DEFAULT uuid_generate_v4()` (único — token de link público)
- `goal_type TEXT[] DEFAULT ARRAY['financial']` (migration 007 — converteu de escalar para array; `financial | prayer | ambassador | volunteer | ongoing`; DB não restringe valores via CHECK, só o TypeScript)
- `category TEXT[] DEFAULT ARRAY[]` (migration 034 — assunto do projeto: `children | health | education | evangelism | community_development | disaster_relief | other`; **ortogonal** a `goal_type` acima — `goal_type` é o tipo de apoio pedido, `category` é o assunto/tema. Sem CHECK, mesma convenção de `goal_type`. Único uso hoje: sinal de afinidade no ranking do feed — ver 7.1-bis; sem UI pública própria ainda)
- `scripture TEXT`, `letter TEXT` (migration 008)
- `trip_start_date DATE`, `funding_deadline DATE`, `completed_at TIMESTAMPTZ` (migration 016 — trigger `set_highlight_completed_at()` seta/zera `completed_at` quando `status` entra/sai de `'completed'`)

**`project_story_views`** (migration `035_project_story_views.sql`): `user_id FK auth.users`, `highlight_id FK highlights`, `last_viewed_at`, único `(user_id, highlight_id)`. Só guarda "quando esse usuário viu pela última vez as atualizações desse projeto" — não existe tabela de conteúdo de "story" separada, a faixa de stories do feed (ver 7.13) reaproveita os mesmos `posts` com `project_id` setado. RLS só `auth.uid() = user_id`, mesmo padrão de `follows`.

#### `follows` (migration 033 — "seguir" leve, deliberadamente separado de `partners`)
`follower_user_id FK auth.users CASCADE`, `profile_id FK profiles CASCADE`, `UNIQUE(follower_user_id, profile_id)`. RLS: `follows_insert_self`/`follows_self_read`/`follows_self_delete`, todas `auth.uid() = follower_user_id`, **mais `follows_owner_read` (migration 037)** — `is_profile_owner(profile_id)`, permitindo o dono do perfil ler sua própria lista de seguidores (lacuna documentada aqui até 2026-07-22, ver Changelog). `follower_count(p_profile_id)` (033) e `following_count(p_profile_id)` (037), ambas `SECURITY DEFINER STABLE`, dão só contagem sem expor identidade. Pra exibição paginada há `get_followers(p_profile_id, p_limit, p_offset)` e `get_following(p_profile_id, p_limit, p_offset)` (037, `SECURITY DEFINER STABLE`, join com `profiles`) — como são `SECURITY DEFINER` e ignoram a RLS de `follows`/`profiles`, cada uma checa por dentro `privacy_mode = 'public' OR is_profile_owner(id)` antes de retornar qualquer linha, senão o grafo de follows de um perfil `private`/`stealth` ficaria consultável por id direto.

> **Decisão de design**: seguir é de um clique, sem formulário, e não cria/depende de linha em `partners` — `partners` continua sendo só o compromisso formal (financeiro/oração/embaixador/voluntário) via `PartnershipWizard`. O feed (7.1-bis) lê de `follows` **e** de `partners.user_id = auth.uid()` em paralelo (união dos dois conjuntos de `profile_id`) — ver seção 7.1-bis.

#### `feed_events` (migration 033 — exhaust de eventos para o algoritmo de ranking, Fase 2+)
`actor_user_id FK auth.users ON DELETE SET NULL`, `event_type CHECK IN ('post_view','post_click','project_view','project_click','follow','unfollow','pledge_from_feed')`, `profile_id FK profiles CASCADE` (de quem é o evento), `post_id FK posts ON DELETE CASCADE` (nullable), `project_id FK highlights ON DELETE CASCADE` (nullable). RLS: só `feed_events_insert_self` (`auth.uid() = actor_user_id`) — **write-only nesta fase**, sem policy de SELECT pra usuário comum (só service-role vai ler isso quando existir um job de treino/relatório no futuro). Gravado em lote (1 insert por página de feed carregada, não por post) para manter volume de escrita sensato.

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
`profile_id FK`, `user_id FK auth.users ON DELETE SET NULL` (nullable — nem todo parceiro tem conta), `name`, `email`, `phone` (WhatsApp), `phone_alt` (telefone alternativo opcional, migration 026), `birth_date` (opcional, migration 027 — alimenta os lembretes de aniversário, ver `BirthdayReminders` na seção 7.1), `type CHECK IN ('financial','prayer','both','ambassador')` (migration 007 adiciona `ambassador`), `notes`, `tags TEXT[]`, `joined_at`. Índice único `(profile_id, user_id)` onde `user_id IS NOT NULL` (migration 012).

#### `partner_visibility_grants` (migration 011 — controle granular de visibilidade)
`profile_id FK`, `partner_id FK`, `section CHECK IN ('full_profile','financial_summary','prayer_requests','sensitive_fields','messages')`, `granted_at`, `UNIQUE(profile_id, partner_id, section)`.

> **Mecanismo central**: o missionário decide, por parceiro individual, quais seções de dado sensível ele enxerga. Duas camadas ortogonais de visibilidade: `privacy_mode` do perfil controla acesso "de longe" (descoberta pública); `partner_visibility_grants` controla, por parceiro já vinculado, granularmente. Quando a seção é `sensitive_fields`, a concessão relacional (esta tabela) precisa ser acompanhada de uma concessão criptográfica real via `keyManager.grantAccessToExisting` (ver seção 6).

#### `payment_methods` (migration 029, ampliada na 031 — substitui as antigas `profiles.pix_key`/`paypal_url`/`wise_url`/`external_donation_url`)
`profile_id FK CASCADE`, `type CHECK IN ('pix','mercadopago','paypal','wise','bank_transfer','revolut','zelle','venmo','cashapp','alipay','wechatpay','mpesa','crypto','other','stripe')`, `label TEXT` (nome customizado; obrigatório na UI quando `type='other'` ou `'bank_transfer'` — aí é o titular da conta), `value TEXT NOT NULL` (chave/handle/link; para `bank_transfer` é o número da conta/IBAN; para `stripe` é o `stripe_user_id` da conta conectada), `details TEXT` (opcional — para `bank_transfer` é um bloco `Rótulo: valor` gerado por `formatBankDetails`/`parseBankDetails` em `src/lib/payment-methods/bank-details.ts`, nunca digitado livre; para `crypto`/`other` continua livre), `linked_account_id UUID FK financial_accounts ON DELETE SET NULL` (migration 031 — só usado por `type='stripe'`: se setado, cada cobrança confirmada pelo webhook já entra como `transactions` nessa conta), `is_active BOOLEAN DEFAULT true` (para `type='stripe'`, também serve de flag de onboarding completo — `false` enquanto o Account Link não foi concluído), `sort_order INT DEFAULT 0`.

Lista de métodos por perfil (não mais 1 registro fixo por tipo) — permite múltiplos métodos, reordenação e desativar sem apagar. Catálogo de tipos com ícone/agrupamento em `src/lib/payment-methods/catalog.ts` (`PAYMENT_METHOD_CATALOG` completo vs. `MANUAL_PAYMENT_METHOD_CATALOG` que exclui `stripe`), agrupado por contexto (popular/instantâneo, internacional, redes locais dos EUA, Ásia, África, acesso restrito, outro, automático) para cobrir formas de recebimento usadas por missionários fora do eixo Brasil/EUA. `stripe` é um tipo especial: a linha é criada por `/api/stripe/connect/start` (Connect Express) e ativada por `/api/stripe/connect/callback`, não pelo formulário genérico — ver seção 7.11.

RLS: `payment_methods_owner_all` via `is_profile_owner()` (dono + gestor `manager`); `payment_methods_public_read` — leitura pública dos métodos `is_active=true` seguindo a mesma regra de `profiles_public_read` (perfil público, dono, ou parceiro vinculado).

Consumido por: `SettingsTabs` (aba Pagamentos, `PaymentMethodsList`/`PaymentMethodForm`/`PaymentMethodCard` pros manuais + `StripeConnectCard` à parte), `[username]/parceria` (monta `paymentOptions` do wizard, filtra `stripe` fora e calcula `stripeAvailable`), `[username]/projetos/[slug]` (link/Pix de doação do projeto), `ProfileHeader` (badge "Pix disponível"), `dashboard` (checklist de configuração pendente) e passo 2 do onboarding (grava Pix/PayPal/Wise diretamente aqui).

#### `pledges` (migration 012, ampliada na 031 — registro de cada oferta; manual (confirmação humana) ou automático via Stripe (confirmado direto pelo webhook))
`highlight_id FK ON DELETE SET NULL`, `profile_id FK CASCADE`, `partner_id FK ON DELETE SET NULL`, `reporter_user_id FK auth.users ON DELETE SET NULL`, `reporter_name TEXT NOT NULL`, `reporter_email`, `reported_amount NUMERIC(15,2)`, `currency DEFAULT 'BRL'`, `payment_method` (mesmo catálogo de tipos de `payment_methods`, agora incluindo `'stripe'`), `reported_at`, `proof_url`, `is_recurring_pledge BOOLEAN`, `recurring_pledge_id FK recurring_pledges ON DELETE SET NULL` (migration 031 — liga a cobrança mensal de volta ao compromisso), `status CHECK IN ('pending','confirmed','rejected')`, `confirmed_transaction_id FK transactions ON DELETE SET NULL`, `reviewed_by_user_id FK ON DELETE SET NULL`, `reviewed_at`, `rejection_reason`.

RLS: `pledges_insert_public` com `WITH CHECK (true)` — **qualquer pessoa, logada ou não, pode registrar uma oferta pontual para qualquer perfil**. A legitimidade é validada 100% manualmente pelo missionário (não há verificação automática de pagamento) — exceto quando `payment_method='stripe'`, aí quem insere é o webhook (`createServiceClient()`, bypassa RLS) já com `status='confirmed'`. Ver fluxo completo na seção 7.2.

#### `recurring_pledges` (migration 031 — o compromisso de recorrência em si, distinto de cada `pledges` gerado mês a mês)
`profile_id FK CASCADE`, `partner_id FK partners ON DELETE CASCADE NOT NULL`, `reporter_user_id FK auth.users ON DELETE CASCADE NOT NULL` (recorrência **exige conta** — diferente de `pledges`, que aceita anônimo), `amount NUMERIC(15,2)`, `currency`, `payment_method` (mesmo catálogo; `'stripe'` = automático, qualquer outro = manual + lembrete), `highlight_id FK ON DELETE SET NULL` (projeto específico, se veio de lá), `reminder_opt_in BOOLEAN DEFAULT true`, `next_reminder_at DATE` (null quando é Stripe, `pending`, ou opt-out), `stripe_subscription_id TEXT` (setado pelo webhook quando o checkout conclui), `status CHECK IN ('pending','active','paused','cancelled')`.

RLS: `recurring_pledges_owner_all` via `is_profile_owner()`; `recurring_pledges_insert_self`/`recurring_pledges_self_read` com `auth.uid() = reporter_user_id` (não é público como `pledges_insert_public` — precisa estar logado, e só enxerga o que é seu).

#### Financeiro
- **`financial_accounts`**: `profile_id FK`, `currency_code`, `name`, `balance NUMERIC(15,2) DEFAULT 0` (mantido por trigger), `account_type CHECK IN ('checking','savings','credit')`, `credit_limit`, `is_shared BOOLEAN`, `created_by_user_id FK ON DELETE SET NULL`, `highlight_id FK highlights ON DELETE SET NULL` (migration 013 — reaproveita contas para "conta de equipe do projeto" em vez de criar conceito paralelo), `closing_day`/`due_day SMALLINT CHECK BETWEEN 1 AND 31`, `card_brand TEXT`, `archived BOOLEAN DEFAULT false` (migration 028, cartão de crédito).
- **`account_members`**: `account_id FK`, `user_id FK auth.users ON DELETE CASCADE`, `role CHECK IN ('owner','viewer')`, `UNIQUE(account_id, user_id)`.
- **`transaction_categories`**: hierárquica via `parent_id` self-FK `ON DELETE SET NULL` (2 níveis: categoria/subcategoria).
- **`transactions`**: `account_id FK`, `profile_id FK`, `created_by_user_id FK ON DELETE SET NULL`, `type CHECK IN ('income','expense','transfer')`, `amount NUMERIC(15,2)`, `currency`, `description`, `category_id`/`subcategory_id` (FK `transaction_categories`), `partner_id FK partners ON DELETE SET NULL`, `source CHECK IN ('manual','whatsapp','api')`, `is_credit_purchase BOOLEAN`, `due_date DATE`, `date DATE DEFAULT CURRENT_DATE`, `highlight_id FK ON DELETE SET NULL` (migration 009), `budget_category_id FK project_budget_categories ON DELETE SET NULL` (migration 010), `fatura_date DATE`/`fatura_paid BOOLEAN DEFAULT false` (migration 028 — mês/fatura ao qual uma compra no cartão pertence; sem tabela de fatura separada, é calculado no cliente a partir de `closing_day`).

**Cartão de crédito** (migration 028, modelo reaproveitado do projeto GranaZen — branch `master` deste repo, histórico não relacionado): `AccountForm` mostra limite/bandeira/dia de fechamento/vencimento quando `account_type='credit'`; `AccountCard` calcula a fatura atual somando `transactions` com `fatura_paid=false` da conta; `TransactionForm` atribui `fatura_date` automaticamente (mês corrente se a compra é antes do `closing_day`, senão mês seguinte) quando a conta selecionada é de crédito. Não há parcelamento (compra única por lançamento) nem baixa de fatura (marcar `fatura_paid=true`) na v1 — ficou de fora para manter o escopo desta rodada.

**Câmbio** (`dashboard/financeiro/cambio`): conversor de moedas client-side, sem tabela própria — consulta cotações ao vivo em `open.er-api.com` (API pública, sem chave). Também portado do GranaZen.

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
- `consume_ai_credits(p_profile_id, p_amount, p_reason)` `SECURITY DEFINER` (migration 025) — débito atômico de `profiles.ai_credits` (`FOR UPDATE` + checagem via `is_profile_owner`), levanta `insufficient_ai_credits` se saldo insuficiente; registra a transação em `ai_credit_transactions`. Chamada via `supabase.rpc(...)` com o client **anônimo** (não service-role) para que `auth.uid()` exista dentro da função.

### 3.3 RLS — padrões e histórico de bugs

Padrão geral: "dono" = existe `profiles` com `user_id = auth.uid()` cujo `id` bate com o FK da linha (`FOR ALL`). Leitura pública condicionada a `privacy_mode='public'` (ou dono, ou parceiro autorizado via função `SECURITY DEFINER`).

**Bug histórico de recursão** (documentar para não repetir): a versão inicial (migration 002) de `profiles_public_read` consultava `partners`, e `partners_owner_all` consultava `profiles` → loop infinito de RLS. Corrigido na migration 004 removendo a referência cruzada e introduzindo `is_profile_owner()` como função `SECURITY DEFINER` (que "escapa" da RLS internamente, quebrando o ciclo). O mesmo padrão foi reaplicado na migration 011 ao reintroduzir acesso de parceiros a perfis privados/stealth.

**Regra a preservar em uma reimplementação**: sempre que uma policy de RLS precisar checar uma condição que depende de outra tabela que também tem RLS referenciando a primeira, envolver a checagem em uma função `SECURITY DEFINER STABLE`.

Buckets de Storage (migration 003): `media` (público, 500MB, webp/jpeg/png/gif/mp4/webm/quicktime) e `avatars` (público, 5MB, webp/jpeg/png). Policy de escrita: `auth.uid()::text = (storage.foldername(name))[1]` — cada usuário só grava dentro de uma pasta com seu próprio UUID como primeiro segmento do path.

> **⚠️ Risco operacional descoberto em 2026-07-08 — arquivo de migration ≠ estado real do banco**: não há CLI/connection string do Supabase configurada neste ambiente de desenvolvimento, então não existe garantia de que toda migration em `supabase/migrations/` foi de fato `RUN` contra o projeto Supabase real — aplicação é manual (SQL Editor do painel). Encontramos exatamente esse drift: as policies de `encrypted_dek_grants` em produção eram a versão **015** (mais restritiva: INSERT só permitia `grantee_user_id = auth.uid()`, sem a policy de SELECT ampliada da 018), mesmo a 018 já existindo no repositório há tempo — sintoma foi mensagens que o destinatário nunca conseguia decifrar, porque o `insert`/`upsert` do grant falhava silenciosamente (erro engolido sem `try/catch` em `ensureResourceKey`). Corrigido reaplicando as policies certas + criada a migration `030_fix_dek_grants_rls_and_realtime.sql` para deixar o arquivo e o banco consistentes de novo. **Regra a adotar**: sempre que investigar um bug que "não devia existir" dado o código/migration, considerar a hipótese de drift migration-vs-banco antes de assumir que é bug de aplicação — testar direto contra o banco com uma sessão de usuário real (não `service role`, que ignora RLS) é o jeito mais rápido de confirmar.

> **⚠️ Realtime não é habilitado por migration comum**: tabelas só emitem eventos via `supabase.channel(...).on('postgres_changes', ...)` se estiverem na publicação `supabase_realtime` (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) — isso não acontece automaticamente ao criar uma tabela, mesmo com RLS configurada certinho, e o `CREATE TABLE` original de `messages` (migration 001) não incluía isso. Sintoma: canal assina com `status: SUBSCRIBED` (nenhum erro visível), mas o evento `INSERT` simplesmente nunca dispara. Corrigido na mesma migration 030. Ao adicionar realtime a uma tabela nova, sempre incluir esse `ALTER PUBLICATION` na própria migration que cria a tabela.

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
- **`/recuperar-senha`** (form de e-mail → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/callback?redirect=/recuperar-senha/nova-senha' })`) e **`/recuperar-senha/nova-senha`** (reaproveita o mesmo `GET /auth/callback` do login OAuth para trocar o `code` por sessão via PKCE; a página confere `getSession()` no mount — sem sessão válida mostra "link inválido/expirado" com atalho para pedir um novo; com sessão, formulário de nova senha via `supabase.auth.updateUser({ password })`).

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
- **Risco de segurança corrigido**: `assertProfileAccess(profileId, user.id)` roda antes de qualquer escrita — confere que `user.id` é dono do `profileId` (via `profiles.user_id`) ou `manager` em `profile_managers`, 403/404 se não. Fecha o gap que existia antes (autorização não era checada no servidor, só assumida do lado do chamador).
- Payload ganhou `category` (migration 034 — array de assunto do projeto, ver seção 3.1 e 7.1-bis) ao lado de `goalTypes`, salvo direto em `highlights.category` sem transformação.

#### `POST` / `DELETE /api/projects/members`
Gerencia `project_members` (equipe) e sincroniza acesso financeiro.
- Helper `getOwnedHighlight`: confirma posse via `highlights.profile_id → profiles.user_id`.
- `POST { highlightId, email, role }`: busca usuário por e-mail (mesmo padrão paginado). Insere em `project_members`. Garante que existe `financial_accounts` vinculada ao `highlight_id` (cria `{ name: 'Equipe — {title}', is_shared: true }` se não existir). Insere o membro também em `account_members`, mapeando `role='lead' → 'owner'`, demais → `'viewer'`.
- `DELETE { memberId, highlightId, memberUserId }`: remove de `project_members` e, se aplicável, de `account_members` do mesmo par.

#### `POST /api/ai/translate` — tradução de conteúdo via IA (migration 025, `src/lib/ai/`)
1. `createClient()` anônimo, `auth.getUser()` — 401 se não autenticado.
2. Recebe `{ profileId, sourceLocale, targetLocales, text }`; valida locales ⊂ `LOCALES` (`pt`/`en`/`es`) e `targetLocales` sem `sourceLocale`.
3. `supabase.rpc('consume_ai_credits', { p_profile_id, p_amount: AI_ACTION_COSTS.translate_content, p_reason: 'translate_content' })` — client anônimo (não service-role), para `auth.uid()` existir dentro da função `SECURITY DEFINER`. `insufficient_ai_credits` → 402; outro erro → 403.
4. `translateContent(...)` (`src/lib/ai/translate.ts`) chama `claude-haiku-4-5` via `@anthropic-ai/sdk` com `output_config.format` (structured outputs/JSON Schema) para devolver `{ [locale]: string }` sem parsing frágil de texto livre. Erro do provedor → 502 (crédito já debitado; sem reembolso automático nesta versão).
5. Retorna `{ translations, remainingCredits }`.

`src/lib/ai/costs.ts` centraliza `AI_ACTION_COSTS` (hoje só `translate_content: 1`) — ponto único para adicionar custos de futuras ações de IA (ex.: melhorar texto, copiloto de criação) sem espalhar números mágicos pelo código.

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

### 5.5.1 `src/hooks/use-pending-action.ts` — loading state correto pós-`router.refresh()`

`router.refresh()` não retorna uma Promise que espera o Server Component terminar de re-buscar/re-renderizar — é "dispara e esquece". Qualquer código que zere um `useState` de loading logo em seguida (padrão comum antes desta correção) faz o spinner sumir antes da UI de fato mudar, dando sensação de travamento. Isso era especialmente perceptível na troca de idioma (`account-form.tsx`), já que o `NextIntlClientProvider` é montado no `RootLayout` — trocar idioma exige re-buscar a árvore inteira a partir da raiz.

`usePendingAction<T>()` resolve isso envolvendo a ação em `startTransition` (React 19): `run(value, action)` seta `value` imediatamente (spinner aparece no clique) e roda `action` dentro de uma transition; `pendingValue` só é não-nulo enquanto `isPending` (do React) for `true` — nunca precisa de `finally { setX(null) }` manual. `T` identifica qual ação está pendente (id do item numa lista, locale clicado, `'confirm' | 'reject'`, etc.); use o default (`isPending` puro-boolean) quando só existir um "saving" único na tela.

Usado em ~20 componentes que fazem `router.refresh()`/`router.push()` após mutação: troca de idioma (`account-form.tsx`, `language-switcher.tsx`), Configurações (`profile-form.tsx`, `privacy-form.tsx`, `payment-method-form.tsx`, `payment-method-card.tsx`), financeiro (`category-tree.tsx`, `transaction-table.tsx`, `transaction-form.tsx`, `financial/account-form.tsx`, `manage-members-dialog.tsx`, `pledge-review-card.tsx`), projetos (`project-team-panel.tsx`, `highlight-form.tsx`), publicações (`post-editor.tsx`), autenticação (`login/page.tsx`, `recuperar-senha/nova-senha/page.tsx`).

### 5.5.1-bis `src/hooks/use-highlight-section-save.ts` (2026-07-20)
`useHighlightSectionSave()` centraliza o save das 7 ilhas de edição inline de `[username]/projetos/[slug]` (ver 7.12/7.7): faz o `fetch('/api/highlights', { method: 'POST' })`, mostra toast de sucesso/erro (namespace i18n `PublicProject`) e chama `router.refresh()` no sucesso — cada ilha só precisa montar o payload (spread do `HighlightSnapshot` + seu campo alterado) e chamar `save(payload)`. Não usa `usePendingAction` (5.5.1) porque aqui não há necessidade de identificar *qual* ação está pendente (só uma seção por vez fica em modo edição).

### 5.5.2 `src/hooks/use-dashboard-nav.ts` — `useNav`/`useBottomNavItems`/`useSignOut`

Extraído de `sidebar.tsx` (onde vivia antes) porque o novo `AccountMenuDrawer` (seção 10, `dashboard/`) também é montado a partir de `/[username]`, fora da árvore `/dashboard` — importar direto de `sidebar.tsx` acoplaria conceitualmente esse consumidor a `DashboardSidebar`/`MobileHeader`/`MobileBottomNav`, que ele não usa. `useNav(role)` é a fonte única da navegação completa (desktop sidebar + gaveta do `AccountMenuDrawer`); `useBottomNavItems(role)` só serve a `MobileBottomNav`; `useSignOut()` é usado pelos três. Comportamento idêntico ao que existia antes da extração.

### 5.6 Internacionalização (`src/i18n/`, `messages/`) — Fase 1: site público

**Status**: infraestrutura completa + site público 100% traduzido (PT/EN/ES). Tela de **Configurações** (`SettingsTabs` e as 5 abas — Perfil, Pagamentos, Privacidade, Acesso, Conta) 100% traduzida. Restante do dashboard (publicações, projetos, parceiros, financeiro, orações, mensagens) ainda majoritariamente em português; `[username]/*` (perfil público) já usa `getTranslations`/`getLocale` em parte das páginas (`page.tsx`, `profile-header.tsx`) — tradução do resto do dashboard fica para quando for pedida (decisão explícita para não fazer uma mudança gigante de uma vez).

> **Regra permanente**: toda mudança de texto de UI pedida a partir de agora deve nascer usando `next-intl` (chaves em `messages/{pt,en,es}.json`), nunca hardcoded — mesmo em componentes que hoje ainda estão 100% em português.

#### 5.6.1 Tradução de **conteúdo do usuário** (posts, bio) — ortogonal à i18n de UI acima

Migration 025 adiciona um segundo tipo de "idioma" ao sistema, **independente** do `profiles.locale`/`NEXT_LOCALE` acima: o idioma em que o *conteúdo* (post, bio) foi escrito, e suas traduções. Não confundir os dois — `profiles.locale` controla em que idioma a interface aparece para quem está navegando; `original_locale`/`bio_locale` + `translations`/`bio_translations` controlam em que idioma(s) o *texto que o missionário escreveu* existe.

- **Schema**: `posts.original_locale`/`posts.translations` e `profiles.bio_locale`/`profiles.bio_translations` (ambos JSONB no formato `{"en": {"content", "source": "ai"|"human", "translated_at"}, "es": {...}}` — só as línguas que **não** são a original; o texto original continua só em `posts.content`/`profiles.bio`, nunca duplicado no JSONB).
- **Geração de tradução via IA**: `src/lib/ai/` (`client.ts`, `costs.ts`, `translate.ts`) + rota `POST /api/ai/translate` (seção 5.3) — usa `claude-haiku-4-5`, débito de 1 `ai_credit` via `consume_ai_credits`. **Sempre opcional**: o usuário pode digitar a tradução manualmente nas abas de idioma sem gastar nenhum crédito; a IA é só um atalho.
- **UI**: `src/components/dashboard/locale-content-tabs.tsx` (`LocaleContentTabs`) — componente compartilhado com abas PT/EN/ES (bandeiras iguais ao `LanguageSwitcher`), usado em `PostEditor` (texto do post) e `ProfileForm` (bio). Cada aba é um textarea sempre editável; o botão "Traduzir com IA" só preenche o textarea, nunca substitui sem revisão. Já traduzido via `next-intl` (namespace `LocaleContentTabs`).
  - **Aba padrão**: abre priorizando `preferredLocale` (idioma da conta, `profiles.locale`) em vez do idioma original do conteúdo — quem navega o painel em EN vê a aba EN primeiro, mesmo que o texto original tenha sido escrito em outro idioma.
  - **Aviso de cobertura de idioma**: abaixo das abas, uma linha discreta (não bloqueante) lista quais idiomas ainda não têm tradução e avisa que parceiros nesses idiomas verão só o texto original — atualiza em tempo real conforme o usuário preenche as abas. Não impede salvar/publicar (decisão de produto: nunca obrigatório ter as 3 versões).
- **Gravação de posts migrou para Server Action**: `src/app/dashboard/publicacoes/actions.ts` (`savePost`) substitui o antigo insert/update direto do client em `post-editor.tsx` — mesmo padrão de `projetos/actions.ts` (`saveHighlight`): client anônimo só para `auth.getUser()`, depois client service-role reverificando dono/gestor manualmente antes de gravar. Perfil (bio) **não** ganhou Server Action nova — `profile-form.tsx` continua gravando via client sob RLS `profiles_owner_all`, já que a parte sensível (chamar IA/débito de crédito) já está isolada em `/api/ai/translate`.
- **Renderização pública**: `src/lib/i18n/resolve-content-locale.ts` (`resolveLocalizedText`) resolve, dado o idioma do visitante (via `getLocale()` do next-intl, já montado em `[username]/*`), qual texto mostrar — tradução se existir, senão o original (nunca string vazia). Usado em `profile-header.tsx` (bio) e `[username]/projetos/[slug]/page.tsx` (seção "Atualizações"). O dashboard (`posts-list.tsx`, etc.) **não** usa esse resolver — o dono sempre vê o conteúdo no idioma original ali.

- **Biblioteca**: `next-intl`, em modo **sem prefixo de URL** (nada de `/en/...`) — plugado via `createNextIntlPlugin` em `next.config.ts`.
- **Resolução de locale** (`src/i18n/request.ts`, roda a cada request server-side): 1) se logado, `profiles.locale` (sempre manda, independente de cookie); 2) senão, cookie `NEXT_LOCALE` se presente (visitante que já trocou antes); 3) senão, header `Accept-Language` do navegador (primeira visita, sem cookie ainda — parse simples do primeiro idioma da lista que bata com `LOCALES`); 4) senão, `pt` (default em `src/i18n/config.ts`).
- **Seletor de idioma discreto no perfil público**: `LanguageSwitcher` ganhou um modo `compact` (texto "PT ▾" num `DropdownMenu`, em vez das 3 bandeiras) usado em `profile-tabs.tsx` — motivado por benchmark: nenhum app de peso (Instagram, WhatsApp, TikTok, X) expõe troca de idioma na tela principal, a detecção de `Accept-Language` acima cobre a maioria dos casos sem nenhuma UI, e o modo compacto é o meio-termo pra quem ainda quiser trocar manualmente. `SiteNav` continua com o modo padrão (bandeiras) — lá é uma barra de navegação normal.
- **Arquivos de tradução**: `messages/{pt,en,es}.json`, namespaces `Metadata`, `Nav`, `Footer`, `Modules` (chave = `id` do módulo), `Landing`, `PricingPage`, `Pricing` (chave = `id` do plano), `Auth`.
- **`src/lib/modules.ts`** e **`src/lib/pricing.ts`** foram refatorados para ficarem agnósticos de idioma — só guardam `id`/ícone/cor/preço; todo texto (título, descrição, bullets, nome, tagline, features, cta) vive nos `messages/*.json` sob a chave `id`. Ao criar um módulo ou plano novo: adicionar a entrada em `modules.ts`/`pricing.ts` **e** a tradução correspondente nos 3 `messages/*.json`.
- **Troca de idioma**: `LanguageSwitcher` (`src/components/marketing/language-switcher.tsx`, bandeiras 🇧🇷🇺🇸🇪🇸) — seta o cookie `NEXT_LOCALE` via `document.cookie`, e se houver usuário logado também atualiza `profiles.locale`, depois `router.refresh()`. Presente no `SiteNav` (desktop e painel mobile) e, de forma equivalente (sem o componente compartilhado, para não acoplar dashboard a `components/marketing/`), num card "Idioma" no topo de `AccountForm` (Configurações → Conta) — funcional mesmo com o resto do dashboard ainda em português.
- **`profiles.locale`** (migration 024) é a fonte de verdade por usuário; o cookie é só a otimização para não repetir a query em toda request.

---

## 6. Camada de criptografia E2EE (`src/lib/crypto/`)

Modelo: **X25519** (par de chaves por usuário) + **key-wrapping** (cada DEK de recurso é cifrada individualmente, via sealed box, para cada participante autorizado) + conteúdo cifrado simetricamente (**XSalsa20-Poly1305**) com a DEK do recurso. A chave privada do usuário nunca sai em claro do dispositivo — fica cifrada em repouso com uma chave derivada via **Argon2id** de um código de recuperação que só o usuário possui (nem o servidor consegue recuperar).

### 6.1 `e2ee.ts` — primitivas (libsodium/NaCl puro, sem DOM)
- `generateKeyPair()` → `crypto_box_keypair()` (X25519).
- `generateRecoveryCode()` → 24 chars, 6 grupos de 4, alfabeto sem ambiguidade (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sem 0/O/1/I/L), formato `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`.
- `generateSalt()`, `deriveKeyFromSecret(secret, salt)` → Argon2id (`crypto_pwhash`, `OPSLIMIT_INTERACTIVE`/`MEMLIMIT_INTERACTIVE`). Genérico: `secret` é a senha de login (caso normal) ou o recovery code aleatório (fallback OAuth, ver 6.2).
- `encryptPrivateKey`/`decryptPrivateKey` → `crypto_secretbox_easy`/`_open_easy`, chave = derivada do recovery code. Erro "Código de recuperação incorreto" se a autenticação Poly1305 falhar.
- `generateDEK()` → `crypto_secretbox_keygen()`, uma por recurso.
- `wrapDEKForRecipient(dek, publicKey)` → `crypto_box_seal` (sealed box — cifra unilateral, sem handshake nem chave privada do remetente).
- `unwrapDEK(wrapped, myPublicKey, myPrivateKey)` → `crypto_box_seal_open`.
- `encryptContent`/`decryptContent` → `crypto_secretbox_easy` com a DEK do recurso.

### 6.2 `key-manager.ts` — orquestração de sessão
Cache em memória (`cachedPrivateKeyB64`, `cachedPublicKeyB64`, `dekCache: Map<"resourceType:resourceId", Uint8Array>`) **+ cache local em `localStorage`** (`go_guide_e2ee_${userId}`, chave privada+pública deste dispositivo) — desbloqueio automático em recarregamentos e em qualquer sessão futura no mesmo navegador, sem pedir nada ao usuário.

**Desbloqueio automático via senha de login** (desde 2026-07-08 — ver Changelog): a chave privada não é mais protegida por um "recovery code" avulso que o usuário precisa copiar e guardar; é derivada (Argon2id) da **própria senha de conta**, chamada automaticamente por `login/page.tsx` e `cadastro/page.tsx` logo após `signInWithPassword`/`signUp`. Isso dá acesso automático em **qualquer dispositivo**, só de fazer login normalmente — sem tela extra, sem código pra guardar (mesmo padrão do Bitwarden/1Password: senha mestra → KDF → chave).
- `setupOrUnlockWithPassword(userId, password)` — chamado no login/cadastro: se `hasKeysConfigured` for false, gera o par + salt e cifra a privada com a senha (`setupKeysWithSecret`, interno); se já existir, deriva e decifra (`unlockWithSecret`, interno). Ambos os caminhos também persistem em `localStorage`.
- `unlockWithPassword(userId, password)` — fallback do `E2EEGate` (ver 7.5) quando a sessão já estava aberta antes da correção, ou quando `localStorage` foi limpo: pede a senha de novo (não um código separado).
- `setupKeysWithRandomRecoveryCode(userId)` — **só** para contas sem senha (login via Google, sem segredo pra derivar): gera um código aleatório (`e2ee.generateRecoveryCode()`) e usa como `secret` no lugar da senha. É o único caso em que ainda existe um "recovery code" mostrado ao usuário (card discreto, não bloqueante, no `E2EEGate`).
- `tryAutoUnlock(userId)` — tenta usar a cópia salva em `localStorage` antes de qualquer chamada de rede; síncrono.
- `hasKeysConfigured(userId)` — SELECT em `user_encryption_keys`.
- `getPublicKeyOf(userId)` — busca chave pública de terceiros (RLS permite leitura pública de qualquer chave pública).
- `ensureResourceKey(resourceType, resourceId, grantees[])` — busca grant não revogado meu; se não existe (primeira vez), gera DEK nova; para cada grantee sem grant ainda e com chave pública já configurada, faz **`insert` simples** (não `upsert`) de `wrapped_dek`, ignorando erro `23505` (unique violation = grant já existe, nada a fazer). **Importante (bug corrigido em 2026-07-08, ver 3.3)**: NÃO usar `upsert`/`ON CONFLICT` aqui — com RLS, o Postgres precisa conseguir "ver" (via policy de SELECT) uma eventual linha conflitante de OUTRA pessoa pra decidir se há conflito; isso trava exatamente ao conceder acesso a alguém que não seja eu mesmo, inclusive na primeiríssima mensagem de uma conversa nova (quando nem eu nem o destinatário temos grant ainda). `insert` simples só depende da policy de INSERT (permissiva) e não tem esse problema.
- `encryptForResource` / `decryptResource` — API de alto nível.
- `grantAccessToExisting(resourceType, resourceId, newGranteeUserId)` — concede acesso a destinatário novo numa DEK já existente **sem recifrar conteúdo**: desembrulha minha cópia, rewrap para o novo, `upsert` (seguro aqui especificamente porque a função exige que **eu já tenha** um grant nesse recurso antes de rodar — `has_dek_grant` então é `true` pra mim, o que satisfaz a policy de SELECT que o `ON CONFLICT` precisa pra checar a linha do novo grantee; não é o mesmo cenário de risco do `ensureResourceKey`, onde o primeiro grant de alguém pode acontecer sem que eu tenha grant nenhum ainda). Falha se o destinatário ainda não configurou E2EE.
- `revokeGrant(...)` — `UPDATE ... SET revoked_at = now()`, sem afetar os demais grantees.

### 6.3 `conversation.ts`
- `derivedResourceId(...parts)` — SHA-256 determinístico dos parts concatenados por `:`, truncado a 16 bytes, formatado como UUID (bits de versão/variant forçados manualmente). Permite ter um "ID de recurso" **sem precisar de coluna/tabela extra**.
- `conversationId(profileId, userA, userB)` — ordena os dois userIds alfabeticamente (ID estável independente de quem inicia) e chama `derivedResourceId('conversation', profileId, "userA:userB")`.

Recursos cifrados no sistema: `conversation` (DMs), `prayer_request` (pedidos/respostas privados), `profile_sensitive_fields` (dados sensíveis do perfil).

---

## 7. Fluxos de negócio (a preservar em qualquer reimplementação)

### 7.1 Autenticação e onboarding
1. **Cadastro** (`/cadastro`) → `supabase.auth.signUp` com `full_name` em metadata → trigger `handle_new_user()` já cria `profiles` com username auto-gerado → redirect para `/onboarding` (Google OAuth usa `redirectTo: /auth/callback?redirect=/onboarding`; login com Google continua indo para `/dashboard`).
2. **Onboarding guiado** (`/onboarding` → `OnboardingWizard`, `src/components/onboarding/onboarding-wizard.tsx`) — wizard client-side com estado interno tipado como união de strings (`Step = 'role' | 'profile' | 'payment' | 'project' | 'summary' | 'partnerDone'`, migration 032 em diante — antes era `useState(1..4)` numérico puro):
   - **Passo "role" (novo, migration 032)** — primeira tela, dois cards grandes ("Sou apoiador/parceiro" vs. "Sou missionário/organização", mesmo padrão pessoal→profissional do Instagram). Escolher grava `profiles.user_role` na hora. `partner` → pula direto pro passo `partnerDone` (tela de fim leve, sem recebimento/projeto — não fazem sentido pra parceiro) → `/dashboard` (que agora é o feed, ver 7.1-bis). `missionary` → segue pro passo `profile`, fluxo original abaixo. Fechar o wizard sem escolher deixa `user_role` no default `'partner'` da coluna (fallback mais seguro, nunca bloqueia). A barra de progresso (`STEP_LABELS`) só é renderizada nos 4 passos da trilha de missionário — os passos `role`/`partnerDone` ficam fora dela.
   - **Passo "profile"**: `display_name`/`username` (com checagem de disponibilidade)/`bio`/`location`/`mission_start_date` — update em `profiles`. Obrigatório para avançar (nome e username não podem ficar vazios), mas os valores já vêm pré-preenchidos pelo trigger.
   - **Passo "payment"**: cria linhas em `payment_methods` (tipos `pix`/`paypal`/`wise`, versão reduzida do catálogo completo — demais tipos ficam para a aba Pagamentos em Configurações) — pulável via "Pular por agora".
   - **Passo "project"**: título/descrição/meta/moeda → `POST /api/highlights` com `goalTypes: ['financial']`, `status: 'active'` — pulável.
   - **Passo "summary"**: resumo do que ficou pendente, CTA para `/dashboard`.
   - Nenhum estado de "pulou" é persistido — a pendência é sempre recalculada a partir dos dados reais (ver item 7.10-bis abaixo e `SetupChecklistBanner`).
   - **Reaproveitado pelo fluxo "virar missionário"** (ver 7.1-bis): `OnboardingWizard` computa o passo inicial como `profile.user_role === 'missionary' ? 'profile' : 'role'` — como `becomeMissionary()` já grava `user_role='missionary'` **antes** de redirecionar pra `/onboarding`, a tela pula a pergunta de papel e cai direto no passo `profile`, sem precisar de rota nem componente novo.
3. **Login** (`/login`) → e-mail/senha ou Google OAuth (`redirectTo: /auth/callback?redirect=...`), preserva `?redirect=`.
4. **Callback** (`/auth/callback/route.ts`) → `exchangeCodeForSession`, redirect.
5. **Proteção**: middleware (`proxy.ts`) protege `/dashboard`; layout do dashboard revalida `user`+`profile` (sem fallback para onboarding — assume que o trigger sempre cria o profile). O onboarding guiado não é forçado por middleware — quem pular etapas cai direto no dashboard com o alerta de pendência.
6. **Exclusão de conta**: duas entradas (`/conta/excluir` para quem só é parceiro, exige digitar `EXCLUIR`; `AccountForm` em Configurações para quem tem profile, exige digitar `@username`) → ambas chamam `POST /api/account/delete`.
7. **Alerta de configuração pendente** (`SetupChecklistBanner`, `src/components/dashboard/setup-checklist-banner.tsx`, renderizado em `dashboard/painel/page.tsx` — ver 7.1-bis sobre por que não é mais `dashboard/page.tsx`) — banner no topo da visão de gestão, computado (não armazenado) a partir de 3 condições: perfil incompleto (sem avatar OU username ainda no padrão auto-gerado `nome_xxxxxx`), nenhum método de recebimento configurado, e zero `highlights`. Mostra só os itens pendentes com link direto para resolver; desaparece sozinho quando os 3 estão OK. Dismissable via `localStorage` (`profile-banner-dismissed`, mesmo padrão do banner anterior que substituiu).

8. **Lembretes de aniversário** (`BirthdayReminders`, `src/components/dashboard/birthday-reminders.tsx`, Server Component renderizado logo abaixo do `SetupChecklistBanner` em `dashboard/painel/page.tsx`) — banner rosa, sem persistência própria: a cada carregamento da visão de gestão, busca `partners` do perfil com `birth_date IS NOT NULL` e calcula em memória (`src/lib/partners/birthdays.ts`, `getUpcomingBirthdays`) quem faz aniversário nos próximos 14 dias (comparando só mês/dia, com virada de ano). Não usa `pg_cron`/trigger — é só uma consulta computada na visita à página, então só funciona como lembrete se o missionário abrir `/dashboard/painel`. Cada linha tem um botão de ação: se o parceiro tem `user_id`, linka pro chat interno (`/dashboard/mensagens/[userId]`); senão, se tem `phone`, abre `wa.me` com mensagem de parabéns pré-preenchida (`target="_blank"`); sem nenhum dos dois, a linha aparece sem ação. `birth_date` é preenchido opcionalmente no modal `AddPartnerButton` (admin) e no formulário público `PartnershipForm` (parceiro se cadastra sozinho) — mesma coluna nos dois casos.

### 7.1-bis Papéis (parceiro vs. missionário), feed universal, seguir e conversão de conta (migrations 032-034)

Até aqui, todo cadastro criava um `profiles` idêntico e caía sempre no mesmo `/dashboard` (visão de gestão do missionário), sem distinção nenhuma entre apoiador e missionário. Esta rodada introduz `profiles.user_role` e reestrutura o dashboard em torno dele.

**Reestruturação do dashboard**: `/dashboard/page.tsx` deixou de ser a visão de gestão — agora renderiza sempre o `FeedScreen` (feed estilo Instagram, ver abaixo), **para os dois papéis**, sem branch por `user_role`. Todo o conteúdo antigo de `dashboard/page.tsx` (`SetupChecklistBanner` → `BirthdayReminders` → stats → posts recentes/atalhos) foi recortado, sem mudança de lógica, para `dashboard/painel/page.tsx`. `/dashboard/painel` continua acessível por URL direta por qualquer papel (não é um hard-block — só some do nav de quem é `partner`); como a página consulta sempre o `profile_id` de quem está logado, um parceiro que chegue lá só vê o próprio perfil vazio (stats zerados), sem vazamento de dado de terceiros.

**Nav consciente de papel** (`src/hooks/use-dashboard-nav.ts`, `useNav(role)`/`useBottomNavItems(role)` — fonte única lida tanto por `DashboardSidebar` quanto por `MobileBottomNav`, resolvendo uma duplicação que existia antes de cada componente ter sua própria cópia da lista):
- `role='missionary'`: Feed, Visão Geral (`/dashboard/painel`), Publicações, Projetos, Parceiros, Orações, Mensagens, Financeiro, IA Copiloto, Configurações — o conjunto de sempre, só com "Feed" novo na frente.
- `role='partner'`: Feed, Mensagens, Meus projetos, Minhas doações, Configurações — deliberadamente enxuto, sem nenhuma ferramenta de gestão de missionário.
- O papel usado é sempre o do **perfil ativo** (`profile.user_role`, resolvido por `getActiveProfile()`), não do usuário logado — importa pro caso de alguém ser `manager` de outro perfil via `profile_managers` (seção 3.1): trocar de conta pelo `AccountSwitcher` já naturalmente troca o nav pro papel daquele perfil, sem código extra.

**Feed** (`src/components/dashboard/feed/`, `src/app/dashboard/feed/actions.ts`) — cross-perfil, paginado por cursor, role-agnóstico no conteúdo:
- `profileIds` = união de quem o usuário segue (`follows.profile_id` — seção 3.1) **e** de quem ele é parceiro (`partners.profile_id` onde `partners.user_id = auth.uid()`) — essa segunda parte já funcionava com a RLS existente sem nenhuma mudança de schema (`partners_self_read`, sem escopo de `profile_id`).
- `getFeedPage(cursor)`: `posts` desses `profileIds`, `is_draft=false`, `order by published_at desc`, cursor = `published_at` do último item da página anterior (a query de feed de um perfil só, em `[username]/page.tsx`, usa `.limit(20)` sem cursor — não é a mesma coisa, e não foi reaproveitada).
- **Heurística de ranking v1** (`src/lib/feed/rank.ts`, `scorePost`) — transparente, pesos nomeados num arquivo só, sem ML: recência (decaimento linear) + segue (+50) + já doou/`pledges` confirmado (+30) + parceiro fixo ativo/`recurring_pledges` (+20) + sobreposição de `highlights.category` com projetos já apoiados/seguidos (+15). Pensada para ser substituída por um modelo treinado a partir de `feed_events` (seção 3.1) no futuro (Fase 2+), sem mudar o resto do pipeline — por isso o feed já grava `post_view` em `feed_events` a cada página carregada (1 insert em lote por página, não por post), mesmo a v1 sendo heurística.
- Estado vazio (`DiscoverMissionaries`) — quando `profileIds` está vazio (conta nova, ainda sem seguir/apoiar ninguém): diretório simples de perfis públicos com `user_role='missionary'`, sem ranking, com botão Seguir inline. Garante que ninguém trava numa tela vazia (princípio de nunca bloquear) — exclui o próprio perfil do visitante da lista.
- **Seguir** (`follow-button.tsx`, `followProfile`/`unfollowProfile` em `feed/actions.ts`) — insert/delete direto em `follows` sob a RLS própria da tabela, **sem** passar pelo padrão "encontra ou promove parceiro" usado em `recurring-pledge-form.tsx`/`checkout-recurring/route.ts`/`pledge-review-card.tsx` — decisão deliberada, seguir não deve criar uma linha de `partners`. Botão só renderizado em perfis públicos (um `private`/`stealth` simplesmente não aparece nos resultados de `posts_public_read`/`highlights_public_read`, mesmo com uma linha de `follows` já existente).

> **Decisão de design (2026-07-22): sem `FollowButton` dentro do card de post do feed.** Cada instância de `FollowButton` guarda `useState(initiallyFollowing)` local — quando o mesmo autor aparece em vários posts (comum, já que `getFeedPage` filtra por `profileIds` = quem o usuário já segue ou é parceiro), clicar em seguir num card não atualizava os outros cards do mesmo autor, ficando com estados divergentes na tela pro mesmo relacionamento. Benchmark rápido: Instagram/X só mostram botão de seguir em conteúdo de descoberta (não no feed principal, que por definição já é só de quem você segue); quando um app mostra o botão dentro do feed principal (LinkedIn), ele lê de um cache global único, nunca de estado local por card. Como o feed daqui já filtra pra quem o usuário segue-ou-apoia, o botão ali era redundante na maior parte do tempo e, no caso raro de parceiro-mas-não-seguidor, ficava inconsistente entre posts do mesmo autor. Removido de `FeedPostCard`/`FeedList`/`FeedScreen` (que também parou de buscar `getFollowedProfileIds()` à toa) — `FollowButton` continua existindo só em contexto de descoberta real: `discover-missionaries.tsx` (estado vazio do feed) e a nova `FollowsList` do perfil (7.12).
- Faixa de stories de projetos (`ProjectStoriesRow`, seção 7.13) renderiza no topo do `FeedScreen`, acima da lista — reaproveita o mesmo `profileIds`.

**Área do parceiro**:
- `/dashboard/mensagens` — **reaproveitado sem nenhuma mudança de código**: a caixa já busca por participação (`sender_id`/`recipient_id = eu`), não por `profile_id`, então um parceiro já vê todas as conversas com qualquer missionário.
- `/dashboard/meus-projetos` (`MyProjectsList`, somente leitura — nunca reaproveita `HighlightsList`, que tem editar/reordenar/excluir) — `highlight_id`s distintos a partir de `pledges` confirmados + `recurring_pledges` ativos do usuário, depois `SELECT highlights WHERE id IN (...)` sob a RLS pública já existente.
- `/dashboard/financeiro-parceiro` (`GivingHistory`/`GivingFilters`) — `SELECT pledges WHERE reporter_user_id = auth.uid()`, com o perfil do missionário e o projeto via join; filtro por missionário client-side (`<select>` nativo, convenção do projeto). RLS de self-read já cobria isso, zero schema novo.
- **Comprovante de doações** (`GET /api/partner/tax-export?year=&format=csv|pdf`) — uma única query em `pledges` (`status='confirmed'`, ano filtrado) já cobre avulsas **e** recorrentes confirmadas, porque toda cobrança recorrente confirmada já vira sua própria linha em `pledges` via `recurring_pledge_id` (seção 3.1) — não precisa de uma segunda query em `recurring_pledges`. CSV é geração de string simples; PDF usa `pdfkit` (nova dependência, API imperativa, sem exigir JSX/React) para um recibo simples por ano com aviso fixo de que **não é documento fiscal oficial**. Botão de exportar fica em `/dashboard/financeiro-parceiro`, com `<select>` dos anos que têm doação confirmada.

**Onboarding v2 e conversão "virar missionário"** — ver passo `role` do `OnboardingWizard` na seção 7.1. Fluxo de conversão (`becomeMissionary()`, Server Action em `src/app/dashboard/actions.ts`): `UPDATE profiles SET user_role='missionary' WHERE user_id=auth.uid()` (nunca em nome de outra pessoa) → `redirect('/onboarding')`, que detecta `user_role` já `missionary` e pula direto pro passo `profile`. Entrada em Configurações → Conta (`AccountForm`, card "Divulgar minha própria missão", só visível pra quem é `partner`) — sem gate de plano (quem converte continua no `plan='free'` como qualquer conta nova).

**Categoria de projeto** (`highlights.category`, migration 034) — multi-select em `HighlightForm` ao lado do `goalTypes` existente, mesmo padrão de interação. Puramente um sinal de ranking do feed nesta rodada — sem badge/UI pública.

**Modo de pré-visualização para superadmin** (`src/lib/auth/superadmin.ts`, `isSuperAdmin(email)`) — allowlist por variável de ambiente `SUPERADMIN_EMAILS` (nunca uma coluna em `profiles`, pra não abrir superfície de RLS nem risco de auto-promoção via client), mesmo padrão de segredo administrativo do `CRON_SECRET`. `SuperadminRoleSwitcher` (barra flutuante, só renderizada quando `isSuperAdmin` é verdadeiro) chama `setPreviewRole(role)` (Server Action, também reconfere `isSuperAdmin` no servidor antes de fazer qualquer coisa), que grava um cookie `preview_role` (`src/lib/profile/role-preview.ts`). `dashboard/layout.tsx` computa `effectiveProfile = previewRole ? { ...profile, user_role: previewRole } : profile` e passa esse objeto pro `DashboardSidebar`/`MobileBottomNav`/`CreateContentFab` — **não** troca `getActiveProfile()` nem qualquer query de dado, só decide qual nav renderizar em cima do próprio perfil real do superadmin. Não é impersonação: nenhuma RLS é contornada, e um superadmin com perfil vazio pode "ver como missionário" e literalmente usar as ferramentas reais de missionário na própria conta pra popular dados de teste.

### 7.2 Pledge (registro manual de oferta) → conciliação
O sistema **não processa pagamentos** — Pix/PayPal/etc. acontecem fora da plataforma.
1. Parceiro/visitante preenche `PledgeForm`: escolhe `payment_method` dentre os configurados pelo missionário, valor, data, nome/e-mail, comprovante opcional (upload comprimido para bucket `media`).
2. Insert em `pledges` com `status='pending'` (qualquer um pode inserir, mesmo anônimo/não-parceiro — RLS `WITH CHECK (true)`).
3. Trigger notifica o missionário (`new_pledge`).
4. Missionário revisa em `PledgeReviewCard` (dashboard → Financeiro → Conciliação):
   - **Confirmar**: promove/cria `partners` a partir do `reporter_user_id`, cria uma `transactions` real (`type: income`) na conta escolhida, atualiza `pledges.status='confirmed'` + `confirmed_transaction_id`. Trigger notifica o reporter (`pledge_confirmed`).
   - **Rejeitar**: atualiza `status='rejected'` + `rejection_reason` opcional.

### 7.3 Wizard de parceria (`PartnershipWizard`)
Máquina de estados com `choice: 'financial_once' | 'financial_once_general' | 'financial_ongoing' | 'prayer' | 'ambassador' | 'volunteer' | null`.
- Tela inicial oferece até 6 opções (as financeiras só aparecem se o missionário tem métodos de pagamento configurados). Não tem mais link "← Voltar ao perfil" próprio (2026-07-20) — esse botão de voltar virou único e fixo em `ProfileTabs`, ver 7.12. Ao escolher uma opção, o wizard mostra só o "← Voltar" interno de cada sub-tela (volta pro `choice=null`).
- Pode abrir direto numa sub-tela via `?choice=` na URL (`prayer`/`ambassador`/`volunteer`/`financial_once`/`financial_once_general`/`financial_ongoing`) — `page.tsx` valida contra `VALID_CHOICES` e passa `initialChoice` como estado inicial do `useState` do wizard. Usado pelo CTA "Quero ser parceiro de oração" do `PrayerRequestForm` (`?choice=prayer`), pra pular a tela de escolha e ir direto pro formulário — evita 1 clique extra que fazia gente desistir no meio do caminho. Desde 2026-07-20, a página pública de projeto (`[username]/projetos/[slug]`) também passa `choice` em todos os links pro wizard (botão "Faça parte deste projeto" e cada card de "Outras formas de apoiar"/"Como apoiar") — antes nenhum desses links tinha `choice`, então qualquer um deles caía sempre na mesma tela de menu genérico, dando a impressão de que os botões eram redundantes entre si.
- `financial_once` (veio de um link de projeto específico, `?highlight_id=`) → `PledgeForm` com `highlightId` preenchido. Só aparece como botão se houver `highlightId` na URL.
- `financial_once_general` (2026-07-08 — doação avulsa **sem** precisar vir de uma campanha específica) → `PledgeForm` sem `highlightId`, `isRecurring=false`. Sempre visível quando há métodos de pagamento, independente de campanha vinculada — antes só existia a opção de virar parceiro fixo mensal quando não havia `highlight_id` na URL.
- `financial_ongoing` (parceria fixa, recorrente) → **não** usa mais `PledgeForm` (migration 031) — usa `RecurringPledgeForm`, que exige conta (ver 7.11).
- `prayer`/`ambassador`/`volunteer` → `PartnershipForm` (cadastro direto em `partners`, sem exigir login) com `type` mapeado. Campo `phone` usa `PhoneInput` (DDI + máscara, mesmo componente do `AddPartnerButton`); label do campo vem da namespace i18n `PartnershipForm` (`whatsappLabel`) — único texto deste form migrado para `next-intl` até agora, resto do componente ainda hardcoded em PT.
- `PledgeForm`, na tela de confirmação, se a oferta **não** foi recorrente (`!isRecurring`), mostra um card convidando a virar parceiro fixo (`onBecomePartner` prop, volta o wizard pra `financial_ongoing`) — funil doação avulsa → parceria contínua.

### 7.4 Visibilidade granular por parceiro (`VisibilityGrantsDialog`)
Toggle de 5 seções (`full_profile`, `financial_summary`, `prayer_requests`, `sensitive_fields`, `messages`) por parceiro:
- Toggle ON → `INSERT` em `partner_visibility_grants`; se seção = `sensitive_fields`, **também** chama `keyManager.grantAccessToExisting('profile_sensitive_fields', profileId, partnerUserId)` para compartilhar a DEK real (a concessão relacional sozinha não dá acesso ao conteúdo cifrado).
- Toggle OFF → `DELETE` da linha.
- Se o parceiro não configurou E2EE ainda (sem `public_key`), a concessão criptográfica falha e a UI avisa — a concessão relacional fica salva "pendente" até ele configurar.

### 7.5 `E2EEGate` — desbloqueio de conteúdo cifrado
Estados: `checking → needs_password | ready`. **Sem etapa manual de configuração** — o caso comum (conta com senha) já chega desbloqueado, porque login/cadastro já rodaram `setupOrUnlockWithPassword` antes da navegação (ver 6.2).
1. `checking`: `keyManager.isUnlocked()` (memória) → `tryAutoUnlock(userId)` (`localStorage` deste dispositivo) → se nenhum dos dois, `hasKeysConfigured(userId)`.
2. Se `hasKeysConfigured` for `false` (só acontece pra contas sem senha, ex. Google OAuth, que não passaram pelo hook de login): gera chaves automaticamente com `setupKeysWithRandomRecoveryCode` (sem pedir clique nem confirmação) → estado `ready` direto, com um card discreto **não bloqueante** sobre `children` mostrando o código de recuperação gerado (dispensável, com botão copiar) — só existe pra permitir acesso de outro dispositivo depois, já que não há senha pra derivar de novo.
3. Se `hasKeysConfigured` for `true` mas sem chave local (dispositivo novo, ou sessão que já estava aberta antes desta mudança): `needs_password` — pede a senha de login (não um código separado) e chama `unlockWithPassword`.
4. `ready`: libera os `children` (mensagens/orações/dados sensíveis).

**Limitação conhecida e aceita**: se o usuário trocar a senha pelo fluxo "esqueci minha senha" (sem saber a antiga), a chave privada antiga fica irrecuperável — o novo `kdf_salt`/senha nunca vai decifrar o `encrypted_private_key` gravado com a senha anterior. Equivalente à limitação do modelo antigo (perder o recovery code também travava tudo); não há reidratação automática de chave neste fluxo.

### 7.6 Mensagens diretas
- **Acesso**: qualquer usuário autenticado pode mandar mensagem a qualquer perfil não-`stealth` — não existe (nem nunca precisou existir) exigência de já ser parceiro. A RLS de `messages` (`auth.uid() = sender_id OR recipient_id`) já não exigia isso; a página `[username]/mensagens/page.tsx` tinha uma checagem extra de UI ("precisa ser parceiro pra mandar mensagem") removida em 2026-07-08.
- Envio (`MessageComposer`): deriva `conversationId`, cifra com `encryptForResource('conversation', ...)`, insere em `messages` com `is_encrypted: true`. `ensureResourceKey` concede acesso a mim e ao destinatário via `insert` simples (não `upsert` — ver 6.2/3.3).
- Leitura (`MessageThread`): busca por par de usuários + `profile_id`, decifra individualmente (falha silenciosa → `'🔒 Não foi possível decifrar esta mensagem.'` — acontece quando o grant nunca foi concedido, ex. mensagens de teste enviadas durante o bug de RLS descrito em 3.3, que ficaram irrecuperáveis).
- Realtime: canal `messages-${profileId}-${otherUserId}`, evento INSERT, recarrega tudo (sem append incremental). **Exige** que `messages` esteja na publicação `supabase_realtime` (migration 030) — sem isso o canal assina mas nunca dispara, e uma resposta só aparece recarregando a página manualmente.
- **Caixa de entrada do dashboard** (`/dashboard/mensagens`): uma "conversa" pode pertencer ao **meu** perfil (`profile_id` = meu perfil, alguém me mandando mensagem como missionário) OU ao perfil de **outro** missionário (eu mandando mensagem pra ele como parceiro — `profile_id` da linha é dele, não meu). A listagem busca por participação (`sender_id`/`recipient_id` = eu), não mais só `profile_id = meu perfil` (bug corrigido em 2026-07-08: mensagens que eu mandava como parceiro pra outro missionário nunca apareciam na minha própria caixa). A página de conversa individual (`/dashboard/mensagens/[userId]`) deriva o `profile_id` certo a partir do histórico já trocado com aquele `userId` (`anyMessage?.profile_id ?? profile.id`), em vez de assumir sempre o próprio perfil ativo.

**Nota sobre `[username]/oracao`** (2026-07-08): a página pública é conceitualmente **enviar uma oração de apoio ao missionário**, não pedir que ele ore pelo visitante — decisão de produto: toda essa área pública (parceria + oração) é um funil convidativo pra participar da missão, então "pedido de oração" (parceiro pedindo pro missionário orar por ele) destoava do tom. Mudança foi só de copy/label (`PrayerRequestForm`: "Sua oração"/"Enviar oração"), sem alterar `requester_type: 'partner'` no schema (`prayer_requests`) nem a caixa de entrada do missionário (`PrayerInbox`) — o pedido próprio do missionário (`NewPrayerButton`, `requester_type: 'missionary'`, pra pedir que a rede ore por ele) é uma feature diferente e não foi tocado. Após enviar (`done=true`), `PrayerRequestForm` mostra um segundo card convidando a virar parceiro contínuo de oração ("Quero ser parceiro de oração", link pra `/{username}/parceria`, mesmo padrão do card de `onBecomePartner` do `PledgeForm` na seção 7.3) — funil oração avulsa → parceria de oração recorrente. Componente recebe `username` como prop pra montar esse link.

### 7.7 Projetos (`HighlightForm`) — o formulário mais complexo do sistema
- Capa com **reposicionamento por arraste** (drag customizado, calcula `objectPosition` %X/%Y, salvo como string em `cover_position`).
- Multi-seleção de `goalTypes`.
- Se `financial`: alterna entre modo "meta única" (`goalAmount`/`currentAmount` diretos) e modo "orçamento por categoria" (soma automática das `project_budget_categories` vira a meta total).
- Marcos (`milestones`) editáveis inline.
- Conteúdo: versículo (`scripture`), carta (`letter`).
- Status (active/completed/hidden) só em modo edição.
- Salva via `POST /api/highlights` (não Supabase client direto — precisa de service role para upsert atômico de milestones/budget categories).
- **2026-07-20**: a lógica antes só existente aqui foi extraída pra módulos reutilizáveis, pra a edição inline na página pública do projeto (ver 7.12) reaproveitar sem duplicar: `src/lib/highlights/currency-mask.ts` (`toMasked`/`fromMasked`/`reformatMasked`/`CURRENCIES`), `src/components/highlights/cover-editor.tsx` (`CoverEditor` — upload+drag, controlado, não faz upload sozinho), `milestones-editor.tsx` (`MilestonesEditor`), `budget-categories-editor.tsx` (`BudgetCategoriesEditor` + `BUDGET_CATEGORY_LABELS`), `support-types-picker.tsx` (`SupportTypesPicker`/`GOAL_TYPE_OPTIONS`, seletor de `goalTypes` — não confundir com o `SUPPORT_TYPES` de `[username]/projetos/[slug]/page.tsx`, que é a lista de CTAs públicos, dado diferente). `HighlightForm` em si não mudou de comportamento, só passou a importar esses módulos em vez de conter a lógica inline.

### 7.8 Equipe do projeto (`ProjectTeamPanel` + `/api/projects/members`)
Entrar na equipe (`project_members`) concede automaticamente acesso à conta financeira compartilhada do projeto (`account_members`), com nível de acesso derivado do papel: `lead → owner`, demais → `viewer`.

### 7.9 Publicações (`PostEditor`)
`postType` derivado automaticamente da mídia selecionada (nenhuma→text, 1 vídeo→video, >1 arquivo→carousel, 1 imagem→image). Compressão de imagem client-side, validação (não compressão) de vídeo por tamanho/duração. Upload sequencial para bucket `media` em `${userId}/${timestamp}-${i}.${ext}` (continua direto no client). Texto do post usa `LocaleContentTabs` (abas PT/EN/ES, tradução manual ou via IA — seção 5.6.1); gravação da linha `posts` migrou para a Server Action `savePost` (`src/app/dashboard/publicacoes/actions.ts`), que recebe as `mediaUrls` já resolvidas pelo upload client-side.

### 7.10 Notificações (`useNotifications` hook)
Carga inicial: não lidas, `LIMIT 20`. Realtime: canal `'notifications'`, filtro `recipient_user_id=eq.${userId}` no Postgres changes, prepend local a cada INSERT. `markAllRead()` marca `read_at=now()` no banco **e limpa a lista local** — não há histórico de lidas visível no dropdown.

**Nota**: `notifications` é só consumida (leitura/assinatura) — não existe hoje nenhum ponto do código que insere uma linha aí. Ou seja, nada dentro do app "notifica" alguém de fato ainda (novo post, novo milestone etc. não geram notificação). O lembrete de recorrência por e-mail (seção 7.11) é o primeiro produtor real de aviso a um parceiro, mas é via Brevo, fora dessa tabela.

### 7.11 Stripe Connect (recebimento automático) + recorrência (migration 031)
1. **Missionário conecta o Stripe** (Configurações > Pagamentos, `StripeConnectCard`): Connect **Express + Account Links** — a plataforma cria a conta conectada (`stripe.accounts.create({type:'express', country, ...})`, país escolhido num `<select>` antes de conectar, obrigatório na criação e não muda depois) e a Stripe hospeda o formulário de onboarding (dados bancários, identidade) direto em stripe.com; a plataforma nunca vê nem guarda senha/chave/dado bancário do missionário, só recebe de volta o ID da conta — mensagem de segurança fica sempre visível no card (`stripeSecurityNote`). Fluxo: `GET /api/stripe/connect/start` cria a conta (ou reaproveita a existente, pra continuar um onboarding incompleto) com `is_active=false`, gera um `accountLink` (`return_url` → `/api/stripe/connect/callback`, `refresh_url` → o próprio `start`) e redireciona pra lá. `GET /api/stripe/connect/callback` (sem `code`/`state` — não é OAuth) confere `stripe.accounts.retrieve(...).{details_submitted,charges_enabled}`: se completo, marca `is_active=true` (`stripe=connected`); se não, deixa `is_active=false` (`stripe=incomplete`, o card mostra badge "Configuração pendente" com botão "Continuar configuração" que reabre o Account Link). Pode escolher opcionalmente uma `financial_accounts` pra receber os depósitos automáticos (`linked_account_id`) — só depois de ativo. "Desconectar" chama `stripe.accounts.del` (best-effort — Express com saldo/atividade pode recusar) e apaga a linha local. Não depende de nenhum client_id de plataforma (diferente do Connect Standard/OAuth, que exigiria o missionário já ter — e logar — numa conta Stripe própria pré-existente).
2. **Recorrência exige conta**: diferente do `PledgeForm` avulso (aceita anônimo), quem clica em "Ser parceiro fixo" precisa estar logado — se não estiver, `RecurringPledgeForm` mostra CTA "Criar conta"/"Já tenho conta" que leva a `/cadastro`/`/login` com `?redirect=` apontando de volta pra `/{username}/parceria?...&choice=financial_ongoing` (`PartnershipWizard` já suportava restaurar `initialChoice` via `?choice=`; `/cadastro` ganhou suporte a `?redirect=` nesta mudança — antes sempre mandava pra `/onboarding` fixo). **Limitação conhecida**: `handle_new_user()` cria uma linha em `profiles` pra **qualquer** signup, então um apoiador que só quer virar parceiro recorrente também ganha um perfil de missionário vazio — não filtrado nesta rodada.
3. **Caminho automático** (só aparece se o missionário tem Stripe conectado): `RecurringPledgeForm` chama `POST /api/stripe/checkout-recurring` (autenticado) → resolve/cria `partners` (mesma lógica de "encontra ou promove" do `PledgeReviewCard`, mas rodando na hora porque já se sabe quem é) → insere `recurring_pledges` com `status='pending'` → cria `stripe.checkout.sessions.create({mode:'subscription', ...}, {stripeAccount: contaConectada})` (preço criado inline via `price_data`, sem produto pré-cadastrado; sem `application_fee` — 100% vai pro missionário) → redireciona pro Checkout.
4. **Webhook de Connect** (`POST /api/stripe/webhook`, secret **separado** do webhook de billing da plataforma — `STRIPE_CONNECT_WEBHOOK_SECRET`, porque eventos de contas conectadas chegam num endpoint de Connect configurado à parte no Dashboard Stripe): `checkout.session.completed` ativa o `recurring_pledges` (`status='active'`, grava `stripe_subscription_id`); `invoice.payment_succeeded` cria um `pledges` já `status='confirmed'` (sem revisão humana) e, se houver `linked_account_id`, também cria `transactions` — replica a lógica de `PledgeReviewCard` (seção 7.2) só que automática; `customer.subscription.deleted` marca `recurring_pledges.status='cancelled'`.
5. **Caminho manual** (sempre disponível, qualquer tipo de `payment_methods` exceto `stripe`): `RecurringPledgeForm` resolve/cria `partners` no client e insere `recurring_pledges` direto (`status='active'`, `stripe_subscription_id=null`). Se `reminder_opt_in`, `next_reminder_at = hoje + 1 mês`. Não existe (nem é possível sem um provedor tipo Plaid/GoCardless, fora de escopo) cobrança automática por transferência bancária — "recorrente" aqui é sempre compromisso + lembrete, nunca débito automático.
6. **Lembrete mensal** (`src/lib/email/brevo.ts` + `GET /api/cron/recurring-reminders`, cron diário via `vercel.json`, protegida por `CRON_SECRET`): busca `recurring_pledges` manuais ativos com `next_reminder_at <= hoje`, manda e-mail via Brevo (texto sempre em PT — não há como saber o idioma do apoiador, que não é dono de `profiles.locale`) com link de descadastro (`GET /api/recurring-pledges/[id]/unsubscribe`, sem auth, `id` como token), avança `next_reminder_at` em 1 mês. Sem chave Brevo configurada, `sendEmail()` só retorna `false` sem lançar erro (mesmo padrão de `getStripeClient()`).

### 7.12 Perfil público: dono vs. visitante (`getProfileViewerContext`)
`src/lib/profile/viewer-context.ts` exporta `getProfileViewerContext(username)` (envolto em `React.cache()` — deduplica entre `layout.tsx` e cada `page.tsx` da árvore `[username]` no mesmo request), retornando `{ viewerUserId, isOwner, canEdit, isViewerRole }`. `canEdit` é `isOwner OR` vínculo `manager` em `profile_managers` (mesma semântica de `is_profile_owner()` no banco — ver 7.11/migration 023) — não é uma comparação literal de `user.id`, porque um gestor de conta vinculada também deve poder editar. Essa é a única fonte de verdade para "quem está olhando"; substitui os fetches de auth ad hoc que existiam antes em `page.tsx`, `mensagens/page.tsx` e `parceria/page.tsx`.

Efeitos de `canEdit=true` (dono ou gestor vendo o próprio perfil público):
- `[username]/page.tsx`: perfil `privacy_mode='private'` deixa de exigir vínculo em `partners` para quem tem `canEdit` (bug pré-existente — sem isso, o próprio dono de um perfil privado ficava trancado do lado de fora do próprio perfil). `ProfileCTA` (Parceria/Oração/Mensagem) é substituído por `ProfileOwnerActions` ("Editar perfil" via `EditProfileDialog`, que abre o `ProfileForm` já usado em Configurações dentro de um `Dialog` — nenhuma lógica de formulário duplicada; e "Compartilhar perfil", Web Share API com fallback de copiar link).
- `[username]/mensagens/page.tsx`: redireciona para `/${username}` antes de montar o chat — dono/gestor não conversa consigo mesmo (cobre acesso direto por URL; o CTA de mensagem já não aparece pra eles em `page.tsx`).
- `[username]/layout.tsx` passa a aceitar `params` e renderizar `ProfileTabs` (barra de abas Perfil/História/Projetos/Trajetória, `usePathname()`) acima de `{children}`, visível para **qualquer** visitante (não só dono) — substitui os links "← Voltar" ad hoc de cada subpágina. Fica oculta em `mensagens`, `oracao`, `parceria` e `projetos/[slug]` (fluxos de ação/conversão ou drill-down, sem chrome de navegação por cima — mesmo padrão do Instagram, que também não mostra a barra de abas do perfil ao compor uma mensagem ou abrir um post).
- **2026-07-22 — `BackToDashboard` (seta "voltar" no início da barra de abas) deixou de depender de `canEdit`, passou a depender só de `viewerUserId` (logado ou não)**, motivado por um efeito colateral direto da mudança do mesmo dia no feed (ver Changelog): ao parar de abrir perfis em nova aba, um parceiro logado que clica no nome de outro missionário no feed navega *dentro* da mesma aba e ficava sem nenhuma forma de voltar — a barra de abas só mostrava o botão pra quem tinha `canEdit` (dono/gestor do próprio perfil), então visitante logado via só Perfil/História/Projetos, sem saída a não ser o botão "voltar" do navegador. `getProfileViewerContext` já expunha `viewerUserId` (não-nulo pra qualquer usuário autenticado, independente de posse); `[username]/layout.tsx` passou a repassar esse campo pra `ProfileTabs`, que troca a condição `canEdit &&` por `viewerUserId &&`. Visitante anônimo (link público compartilhado, sem sessão) continua sem o botão — comportamento preservado, é a mesma página "solta" de sempre pra quem chegou de fora do app.
- **2026-07-20 — botão "voltar" unificado nas 7 páginas do perfil público**, motivado pelo usuário reportar botões de voltar duplicados/inconsistentes. Nas 4 rotas sem barra de abas (`mensagens`, `oracao`, `parceria`, `projetos/[slug]`), `ProfileTabs` agora renderiza um único botão fixo e discreto (`BackToProfile`, ícone só, `fixed top-3 left-3 z-50`, mesmo estilo pill do `LanguageSwitcher` que já ficava em `top-3 right-3`) linkando pra `/${username}` — os links "← Voltar ao perfil de X" que cada página/componente renderizava no próprio conteúdo (`projetos/[slug]/page.tsx`, `mensagens/page.tsx`, `oracao/page.tsx`, tela inicial do `PartnershipWizard`) foram removidos. Nas 3 rotas com barra de abas (`historia`, `trajetoria`, `projetos` lista), a aba "Perfil" já embutida na barra cobre a mesma necessidade — o link inline redundante dessas 3 páginas foi só removido, sem substituto novo.
- **2026-07-20 — edição inline por seção em `[username]/projetos/[slug]`**, motivado pelo usuário: dono de perfil visitando a própria página pública de projeto não tinha como editar sem ir pro dashboard. A página (Server Component) passou a chamar `getProfileViewerContext` e a relaxar o filtro `.eq('status','active')` da query do projeto quando `canEdit` (deixa o dono abrir/editar projeto `hidden`/`completed` pela própria URL pública). Os blocos de leitura existentes (capa+título+versículo, descrição, formas de apoio, financeiro, marcos, história, datas/status) foram envolvidos por 7 "ilhas" client-side (`src/components/highlights/*-edit-section.tsx`) que só aparecem com `canEdit=true`; cada uma reaproveita os módulos extraídos do `HighlightForm` (ver 7.7) e mostra um ícone de lápis discreto (hover/focus no desktop, sempre visível no mobile) que troca a visualização por um miniformulário com Salvar/Cancelar, sem modal e sem navegar de rota. Arquitetura: o Server Component monta um `HighlightSnapshot` serializável (todos os campos que `POST /api/highlights` espera) e passa como prop pra cada ilha, junto com o JSX de leitura como `children` — funções não atravessam o boundary Server→Client, então cada ilha define seu próprio `onSave` (client) que mescla seu campo editado com o resto do snapshot e faz o `fetch` direto. Cada save bem-sucedido chama `router.refresh()` (hook compartilhado `useHighlightSectionSave`, `src/hooks/`) pra que todas as ilhas recebam um snapshot atualizado do servidor — sem isso, editar duas seções em sequência sem recarregar a página faria a segunda sobrescrever a primeira com dados desatualizados. Pré-requisito de segurança: `POST /api/highlights` não validava posse do `profileId` no servidor (ver 5.3) — corrigido nesta mesma mudança, já que a rota passou a ser chamada também a partir da página pública, e não só do dashboard privado como antes.

Link "Ver meu perfil" no sidebar do dashboard (`DashboardSidebar`/`MobileBottomNav`) parou de abrir em nova aba (`target="_blank"` removido) — agora é navegação integrada para essa mesma experiência de dono, não mais uma "saída" para uma página pública genérica.

**Nota de design atualizada (migration 033 — ver 7.1-bis): "seguir o missionário" saiu do papel.** A tabela `follows` (seção 3.1) implementa exatamente o "seguir leve" cogitado aqui, deliberadamente separado de `partners` (que continua sendo só o relacionamento formal de CRM/mensagens/visibilidade granular). **O que ainda não existe** é a granularidade mais fina "seguir só um projeto específico" (sem seguir o missionário inteiro) — a peça que falta pra isso continua sendo uma tabela leve tipo `highlight_followers (highlight_id, follower_user_id)`, não duplicar `partners`. Também ainda não existe um produtor de notificação de verdade pra atividade de feed (ver nota da seção 7.10) — o feed de hoje é 100% pull/query-based (paginado sob demanda), não push. `pledges`/`recurring_pledges` já carregam `highlight_id` quando a contribuição nasceu de um projeto específico, e `highlights.category` (migration 034) já dá um sinal de afinidade por assunto — ambos já consumidos pela heurística de ranking do feed (7.1-bis).

**Aba Seguidores/Seguindo no perfil (migration 037 — ver Changelog 2026-07-22).** Fechada a lacuna acima: agora existe uma rota `[username]/seguidores/page.tsx` (só visível/acessível quando `user_role='missionary'`, gated na `ProfileTabs` por `isMissionary` e de novo dentro da própria rota — defesa em profundidade, já que a rota é navegável direto por URL), com abas Seguidores/Seguindo via `?tab=` e `FollowsList` (client, "carregar mais" com o mesmo padrão de `feed-list.tsx`). Perfil `private` aplica o mesmo gate dono-ou-parceiro-confirmado da página principal do perfil (reforço deliberado — o grafo de follows é mais sensível que trajetória/projetos, que só bloqueiam `stealth`). A "distinção sutil" pedida entre quem o missionário segue e por quem é seguido: na aba Seguindo, quando o **próprio dono do perfil** está olhando (`isOwnerView`), cada pessoa que também o segue de volta ganha um texto sutil "Segue você" (mútuo, calculado por `getFollowerProfileIds` cruzado em memória — mesmo padrão de `Set` já usado em `discover-missionaries.tsx`, sem N+1 no SQL); na aba Seguidores, o próprio `FollowButton` troca o label pra "Seguir de volta" nesse mesmo caso (`followsViewer` prop, opcional, não quebra os usos existentes do botão). Fora do `isOwnerView` (visitante olhando o perfil de outra pessoa) esse cálculo é pulado — "Segue você" só faz sentido relativo a quem está de fato sendo seguido, então mostrar isso pra um terceiro visitante seria ambíguo.

### 7.13 Faixa de "stories" de projetos seguidos no feed

`getFollowedProjectStories()` (`src/app/dashboard/feed/actions.ts`) monta a faixa horizontal renderizada no topo de `FeedScreen` (`ProjectStoriesRow`, seção 10 `dashboard/feed/`): reaproveita o mesmo cálculo de `profileIds` (seguidos + parceiros) de `getFeedPage`, busca `highlights` ativos desses perfis, busca os `posts` mais recentes desses projetos (`project_id IN (...)`, agrupados em JS por "latest per group" — Supabase não faz isso nativamente) e cruza com `project_story_views` (seção 3.1) pra marcar `hasUnseen`. **Não existe conteúdo de "story" separado** — é literalmente a mesma tabela `posts` já usada no feed principal e nas "Atualizações" de `[username]/projetos/[slug]`, só filtrada por projeto e reordenada cronologicamente pro visualizador.

`ProjectStoryViewer` (client) é tap-to-advance (sem timer automático de avanço, ao contrário do Instagram) — avança entre os posts do projeto atual e, no fim, passa pro próximo projeto da faixa; chama `markProjectStoryViewed(highlightId)` (upsert em `project_story_views`) ao abrir/avançar de projeto. Barra fixa "Ver projeto completo" sempre linka pra `/[username]/projetos/[slug]` — o visualizador é um resumo rápido, não substitui a página completa (marcos, orçamento, formas de apoiar).

### 7.14 Busca (`/dashboard/buscar`, migration 2026-07-23)

Motivado por feedback direto do usuário: não havia nenhum lugar visível pra procurar pessoas e projetos — `DiscoverMissionaries` (7.1-bis) só aparece como estado vazio do feed (some assim que a pessoa segue alguém) e só lista missionários, sem campo de busca por nome. Benchmark rápido: Instagram/TikTok reservam um slot fixo na bottom nav pra busca porque descoberta é central ao produto deles; LinkedIn/X, com bottom nav mais enxuta e especializada (mesma situação daqui — 5 slots já ocupados, ver `useBottomNavItems`), usam um ícone de lupa fixo no cabeçalho em vez disso. Adotado o padrão LinkedIn/X: ícone de busca em `dashboard/layout.tsx` (dentro do `<header>`, ao lado de `ThemeToggle`/`NotificationsBell` — visível em toda tela do dashboard, mobile e desktop, não só na home), linkando pra `/dashboard/buscar`.

`src/app/dashboard/buscar/page.tsx` é Client Component (busca instantânea enquanto digita, sem necessidade de submit) — debounce de 300ms num único `useEffect` (`setTimeout` + `searchDirectory`), com `cancelled` flag no cleanup pra descartar resposta de uma busca anterior que ainda não voltou. **Nota de implementação**: o `setState` só acontece dentro do callback do `setTimeout`/`.then()`, nunca síncrono no corpo do effect — a regra `react-hooks/set-state-in-effect` do eslint barra updates síncronos ali (mesmo o clássico "setLoading(true) antes do fetch"), então o padrão certo neste código é sempre mover o efeito colateral pra dentro de um callback assíncrono. `searchDirectory` (`feed/search-actions.ts`, seção 10) busca em paralelo `profiles` (nome/username/bio) e `highlights` (título/descrição), renderizados em duas seções (Missionários/Projetos). Resultados de missionário reaproveitam `FollowButton` — diferente do feed (7.1-bis), aqui cada pessoa aparece uma única vez por busca, então não existe o risco de estado duplicado que motivou remover o botão dos posts.

---

## 8. Frontend — estrutura de rotas (`src/app/`)

```
src/app/
├── layout.tsx                        # Root: ThemeProvider + Toaster (sonner) + fonte Inter
├── page.tsx                          # Landing (redirect /dashboard se autenticado) — hero (2 colunas, foto em public/hero-missionario.png) + diferenciais + "como funciona" + bento grid de módulos + deep-dive + teaser de planos; usa SiteNav/SiteFooter
├── planos/page.tsx                   # Server — página de preços pública; PricingToggle (client) chama /api/billing/checkout; usa SiteNav/SiteFooter
├── globals.css
├── (auth)/                           # Route group sem prefixo de URL
│   ├── layout.tsx                    # Card centralizado, sem nav
│   ├── login/page.tsx                # Client, Suspense (useSearchParams)
│   └── cadastro/page.tsx             # Client — signUp → redirect /onboarding
├── auth/callback/route.ts            # Route Handler — troca code OAuth por sessão
├── onboarding/page.tsx                # Server — busca profile, renderiza OnboardingWizard (client; passo "role" + 4 passos de missionário — ver 7.1/7.1-bis); também usado pelo fluxo "virar missionário"
├── conta/excluir/page.tsx             # Exclusão para quem só é parceiro
├── [username]/                        # Perfil público
│   ├── layout.tsx                     # LanguageSwitcher flutuante + ProfileTabs (barra de abas, oculta em mensagens/oracao/parceria/projetos/[slug]) — envolve todas as subrotas
│   ├── page.tsx                       # Server, generateMetadata; lógica de privacidade + canEdit (ver 7.12); ProfileOwnerActions no lugar de ProfileCTA quando é o dono/gestor
│   ├── historia/page.tsx              # Blocos "nossa história"
│   ├── trajetoria/page.tsx            # Timeline de projetos concluídos
│   ├── parceria/page.tsx              # Entrada do PartnershipWizard
│   ├── oracao/page.tsx                # Enviar oração de apoio ao missionário (não é o parceiro pedindo que orem por ele — ver nota abaixo de 7.6)
│   ├── mensagens/page.tsx             # Chat 1:1 (qualquer autenticado, não exige ser parceiro) + E2EEGate; redireciona pra / quando quem acessa é o próprio dono/gestor (ver 7.12)
│   └── projetos/
│       ├── page.tsx                   # Lista pública (ativos + concluídos)
│       └── [slug]/page.tsx            # Página pública de projeto (fundraising completo)
└── dashboard/
    ├── layout.tsx                     # Shell autenticado: sidebar + bell + mobile nav + CreateContentFab + SuperadminRoleSwitcher (só pra SUPERADMIN_EMAILS — ver 7.1-bis)
    ├── page.tsx                       # Feed universal (parceiro e missionário) — ver 7.1-bis; NÃO é mais a visão de gestão
    ├── painel/page.tsx                # Visão de gestão do missionário (stats/checklist/atalhos) — conteúdo que antes vivia em dashboard/page.tsx
    ├── feed/actions.ts                # getFeedPage, followProfile/unfollowProfile, getDiscoverMissionaries, getFollowedProjectStories (ver 7.1-bis/7.13)
    ├── meus-projetos/page.tsx         # Parceiro: projetos em que é parceiro (somente leitura)
    ├── financeiro-parceiro/page.tsx   # Parceiro: histórico de doações + comprovante para IR
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
    ├── ia/page.tsx                     # Copiloto IA: saldo de créditos, feature de tradução, histórico (ai_credit_transactions)
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
    ├── partner/tax-export/route.ts    # GET ?year=&format=csv|pdf — comprovante agregado de doações (ver 7.1-bis)
    └── billing/checkout/route.ts      # Cria Stripe Checkout Session — 501 se STRIPE_SECRET_KEY não configurado (ver seção 2)
```

> **Gaps/inconsistências conhecidas (documentadas para não serem "redescobertas" como bugs)**:
> - `destaques` (nome legado) vs `projetos` (nome atual) — migração de nomenclatura incompleta; `destaques/novo` e `destaques/[id]` ainda funcionam mas ficaram órfãos de navegação.
> - Duas implementações paralelas de salvar highlight: `dashboard/projetos/actions.ts` (Server Action, não usada por nenhum componente) e `POST /api/highlights` (efetivamente usada) — a Server Action é código morto.

### Renderização
Todas as páginas de rota (exceto formulários) são **Server Components** assíncronos que buscam dados via `createClient()` de `@/lib/supabase/server` e passam como props para Client Components de interação. Padrão de mutação client-side: `setSaving(true)` → `supabase.from(table).insert/update/delete()` → toast de erro (`sonner`) ou `router.refresh()`/`router.push()`.

### Lógica notável de páginas específicas
- **`[username]/page.tsx`**: `stealth` → 404 real (`notFound()`) + `robots: noindex`; `private` → exige login + vínculo em `partners` (a menos que `canEdit`, ver 7.12), senão `PrivateProfileScreen`.
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
| `sidebar.tsx` | `DashboardSidebar` (nav desktop), `MobileHeader`, `MobileBottomNav` (tab bar mobile; 5º slot é uma miniatura de avatar linkando pra `/[username]`, não mais um botão "Menu" — ver 10 `account-menu-drawer.tsx` e changelog) — nav consciente de papel via `useNav(role)`/`useBottomNavItems(role)` (`src/hooks/use-dashboard-nav.ts`, seção 5.5.2), lê `profile.user_role` do perfil ativo (ver 7.1-bis) |
| `superadmin-role-switcher.tsx` | `SuperadminRoleSwitcher` — barra flutuante só renderizada quando `isSuperAdmin(user.email)` (allowlist `SUPERADMIN_EMAILS`); alterna `preview_role` (cookie) pra ver o nav de missionário/parceiro com a própria conta, sem trocar `user_role` real nem contornar RLS (ver 7.1-bis) |
| `account-menu-drawer.tsx` | `AccountMenuDrawer` — gaveta de navegação completa (extraída de `MobileBottomNav`), self-contained (`open` + trigger próprios, ícone `Menu`); montada a partir de `/[username]` (via `ProfileTabs`, só quando `canEdit`) em vez do rodapé do dashboard |
| `create-content-fab.tsx` | `CreateContentFab` — botão flutuante circular (estilo X/Twitter) com `DropdownMenu` "Nova publicação"/"Novo projeto"; oculto para `role='partner'` |
| `notifications-bell.tsx` | Dropdown com badge de não lidas, usa `useNotifications` |
| `post-editor.tsx` | Criar/editar posts, upload multi-mídia, compressão, detecção de `postType`; texto via `LocaleContentTabs`, grava por `savePost` (Server Action) |
| `posts-list.tsx` | Lista com toggle draft/publicado, editar/excluir |
| `locale-content-tabs.tsx` | `LocaleContentTabs` — abas PT/EN/ES compartilhadas (post + bio), tradução manual sempre livre + botão opcional "Traduzir com IA" (seção 5.6.1) |
| `setup-checklist-banner.tsx` | `SetupChecklistBanner` — checklist dismissível (localStorage + `CustomEvent`/`useSyncExternalStore`) com até 3 itens pendentes: perfil incompleto, sem método de recebimento, sem projeto criado (ver 7.1) |
| `birthday-reminders.tsx` | `BirthdayReminders` — Server Component, banner de aniversários de parceiros nos próximos 14 dias, sem persistência própria (ver 7.1 item 8) |
| `settings/settings-tabs.tsx` | Tabs client-side (Perfil/Pagamentos/Privacidade/Conta) |
| `settings/profile-form.tsx` | Avatar, checagem de username disponível (debounce 500ms), redes sociais; bio via `LocaleContentTabs` |
| `settings/payment-methods-list.tsx` | `PaymentMethodsList` — grid de métodos de recebimento cadastrados + botão "Novo método" |
| `settings/payment-method-form.tsx` | `PaymentMethodForm` — dialog criar/editar (`account?` opcional, mesmo padrão de `financial/account-form.tsx`), tipo selecionado no catálogo (`src/lib/payment-methods/catalog.ts`) |
| `settings/payment-method-card.tsx` | `PaymentMethodCard` — card com ícone/label/valor (copiar), badge inativo, editar/excluir |
| `settings/stripe-connect-card.tsx` | `StripeConnectCard` — conectar/continuar onboarding/desconectar Stripe Express, escolher `linked_account_id`, toasts por `?stripe=` (ver fluxo 7.11) |
| `settings/privacy-form.tsx` | 3 modos de privacidade + `SensitiveDataForm` dentro de `E2EEGate` |
| `settings/sensitive-data-form.tsx` | Dados sensíveis cifrados (blob único JSON) |
| `settings/account-form.tsx` | Trocar senha; card "Divulgar minha própria missão" (só visível pra `user_role='partner'`, chama `becomeMissionary()` — ver 7.1-bis); zona de perigo (exclusão) |

### `dashboard/feed/`
| Componente | Papel |
|---|---|
| `feed-screen.tsx` | `FeedScreen` — Server Component raiz de `/dashboard`, busca a primeira página + `follows` + stories em paralelo, decide entre `FeedList` e `DiscoverMissionaries` (ver 7.1-bis) |
| `feed-list.tsx` | `FeedList` — client, "carregar mais" via Server Action (`getFeedPage`, cursor por `published_at`) |
| `feed-post-card.tsx` | `FeedPostCard` — estende a renderização de `publications-feed.tsx` (que só cobre texto+1ª imagem) com vídeo (`<video controls>`) e carrossel (`overflow-x-auto snap-x`, mesmo padrão de `projects-section.tsx`), cabeçalho de atribuição (avatar/nome/link) — sem `FollowButton` (removido em 2026-07-22, ver 7.1-bis) |
| `discover-missionaries.tsx` | `DiscoverMissionaries` — estado vazio do feed: perfis públicos `user_role='missionary'`, sem ranking, exclui o próprio perfil do visitante |
| `follow-button.tsx` | `FollowButton` — toggle otimista (`usePendingAction`) de `follows`, grava `feed_events` (`follow`/`unfollow`); prop opcional `followsViewer` troca o label pra "Seguir de volta" (migration 037, ver 7.12) |
| `follows-list-actions.ts` | Server actions de leitura só: `getFollowers`/`getFollowing` (`get_followers`/`get_following` RPC, paginado), `getFollowCounts`, `getFollowerProfileIds` (ids de quem segue de volta, usado só pra calcular o badge de mútuo) |
| `search-actions.ts` | `searchDirectory(query)` — busca combinada (`ilike`) em `profiles` (nome/username/bio, só `privacy_mode='public'` + `user_role='missionary'`) e `highlights` (título/descrição, filtro de visibilidade aplicado em JS após o join com `profiles`, já que filtrar coluna de tabela unida via `.eq('profiles.col', ...)` não tem precedente testado no restante do código); `sanitizeForIlike` remove `, ( ) % _` do termo antes de montar a string do `.or()` — sem isso, o usuário controlaria diretamente a string de filtro que o PostgREST interpreta, podendo encadear cláusulas extra (`,coluna.eq.valor`) por injeção de filtro. Usada por `dashboard/buscar/page.tsx` (ver 7.14, nova). |
| `project-stories-row.tsx` | `ProjectStoriesRow` — faixa horizontal estilo Instagram de projetos ativos de quem o usuário segue/apoia com atualização recente; anel vira gradiente quando `hasUnseen` (ver 7.13) |
| `project-story-viewer.tsx` | `ProjectStoryViewer` — visualizador em tela cheia, tap-to-advance entre as atualizações de um projeto, "Ver projeto completo" fixo embaixo |

### `dashboard/partner/`
| Componente | Papel |
|---|---|
| `my-projects-list.tsx` | `MyProjectsList` — lista somente-leitura de projetos em que o usuário é parceiro (financeiro confirmado ou recorrente ativo); nunca reaproveita `HighlightsList` (tem editar/reordenar/excluir) |
| `giving-history.tsx` | `GivingHistory` — histórico de `pledges` do usuário entre missionários, com badge de status e export de comprovante (CSV/PDF, `GET /api/partner/tax-export`) |
| `giving-filters.tsx` | `GivingFilters` — `<select>` nativo de filtro por missionário, só renderizado quando há mais de um |

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
| `cover-editor.tsx` | `CoverEditor` — upload+drag de capa, extraído do `HighlightForm` (7.7), controlado via `onChange` |
| `milestones-editor.tsx` | `MilestonesEditor` — lista add/remove/toggle de marcos, extraído do `HighlightForm` |
| `budget-categories-editor.tsx` | `BudgetCategoriesEditor` — categorias de orçamento + toggle single/detailed, extraído do `HighlightForm` |
| `support-types-picker.tsx` | `SupportTypesPicker`/`GOAL_TYPE_OPTIONS` — seletor de `goalTypes`, extraído do `HighlightForm` |
| `section-types.ts` | Tipo `HighlightSnapshot` compartilhado pelas 7 ilhas de edição inline (ver 7.12) |
| `edit-section-chrome.tsx` | `EditPencilButton`/`EditActions` — chrome visual compartilhado (ícone de lápis, botões Salvar/Cancelar) das ilhas de edição |
| `cover-title-edit-section.tsx`, `description-edit-section.tsx`, `support-types-edit-section.tsx`, `financial-edit-section.tsx`, `milestones-edit-section.tsx`, `letter-edit-section.tsx`, `dates-status-edit-section.tsx` | As 7 ilhas de edição inline da página pública de projeto (ver 7.12), uma por seção — só renderizam UI de edição quando `canEdit` |

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
| `add-partner-button.tsx` | Adicionar parceiro manual, respeita limite do plano (free=2); WhatsApp/telefone via `PhoneInput` (DDI + máscara), data de nascimento opcional |
| `partners-list.tsx` | Filtro, badge por tipo, `VisibilityGrantsDialog`, link de mensagem |
| `partnership-form.tsx` | Form público "quero ser parceiro", grava direto sem login |
| `partnership-wizard.tsx` | Ver fluxo 7.3 |
| `pledge-form.tsx` | Ver fluxo 7.2 |
| `recurring-pledge-form.tsx` | `RecurringPledgeForm` — recorrência exige conta (CTA cadastro/login se deslogado), assinatura Stripe ou compromisso manual + lembrete (ver fluxo 7.11) |
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
| `profile-cta.tsx` | Botões de ação do perfil público (Parceria/Oração/Mensagem) — só renderizado quando o visitante **não** tem `canEdit` |
| `profile-owner-actions.tsx` | `ProfileOwnerActions` — substitui `profile-cta.tsx` quando `canEdit=true`: "Editar perfil" (`EditProfileDialog`) + "Compartilhar perfil" (Web Share API / copiar link) |
| `edit-profile-dialog.tsx` | `EditProfileDialog` — abre o `ProfileForm` (de `dashboard/settings/`) dentro de um `Dialog` por cima do perfil público, sem duplicar a lógica de edição; container em tela cheia no mobile (seta voltar + título centralizado, estilo Instagram), popup central no desktop — `ProfileForm` em si não muda |
| `profile-tabs.tsx` | `ProfileTabs` — barra de abas persistente (Perfil/História/Projetos/Trajetória) renderizada pelo `[username]/layout.tsx`; oculta em `mensagens`/`oracao`/`parceria`/`projetos/[slug]` (ver 7.12), onde mostra em vez disso um único botão fixo `BackToProfile` (canto superior esquerdo) + o `LanguageSwitcher` (canto superior direito). Na variante com abas, quando `canEdit`, monta o trigger de `AccountMenuDrawer` (`dashboard/`) entre as abas e o `LanguageSwitcher` — é o único lugar de onde a gaveta de navegação completa é acionada no mobile |
| `profile-header.tsx` | Avatar/nome/localização/bio/redes — condicionado a `privacy_mode` |
| `projects-section.tsx` | Projetos do perfil público como "destaques" estilo Instagram: faixa horizontal com scroll (`overflow-x-auto snap-x`), capa circular com anel na `accent_color`, título + barra de progresso/valor arrecadado logo abaixo de cada bolinha |
| `publications-feed.tsx` | Feed de posts públicos do perfil (`[username]/page.tsx`), mais recente → mais antigo (`published_at desc`), com link para o projeto quando o post tem `project_id` |
| `trajectory-timeline.tsx` | Timeline vertical de projetos concluídos |

### `onboarding/`
| Componente | Papel |
|---|---|
| `onboarding-wizard.tsx` | `OnboardingWizard` — wizard client, passo `role` (novo, migration 032) + 4 passos de missionário (perfil/recebimento/primeiro projeto/concluído) com estado interno tipado como união de strings; reaproveitado também pelo fluxo "virar missionário" (pula `role` quando `user_role` já é `missionary`) — ver fluxo 7.1/7.1-bis |

### `pricing/`
| Componente | Papel |
|---|---|
| `pricing-toggle.tsx` | `PricingToggle` — cards Free/Pro/Missão a partir de `src/lib/pricing.ts`, toggle mensal/anual, botão "Assinar" chama `POST /api/billing/checkout` |

### `marketing/`
| Componente | Papel |
|---|---|
| `site-nav.tsx` | `SiteNav` — nav sticky com mega-menu "Módulos" (grid com ícone+descrição a partir de `src/lib/modules.ts` + `messages/*.json`), `LanguageSwitcher` embutido, usado em `/` e `/planos` |
| `site-footer.tsx` | `SiteFooter` — rodapé com colunas agrupadas (módulos, conta), gerado a partir de `src/lib/modules.ts` |
| `language-switcher.tsx` | `LanguageSwitcher` — bandeiras PT/EN/ES, troca cookie `NEXT_LOCALE` (ver seção 5.6); prop `compact` troca as bandeiras por um gatilho de texto discreto ("PT ▾") num `DropdownMenu`, usado no perfil público |

> **`src/lib/modules.ts`** é a fonte única dos 7 módulos do produto (`id`, ícone, cor — texto vive em `messages/*.json`) — consumida pela landing (bento grid + deep-dive), pelo mega-menu do `SiteNav` e pelo `SiteFooter`. Ao lançar um módulo novo, adicionar a entrada aqui + a tradução nos 3 `messages/*.json` já propaga para o site público inteiro — convenção adotada para a página pública não ficar defasada conforme o produto cresce.

### `ui/` (shadcn v4 sobre `@base-ui/react`)
`avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `progress`, `sonner`, `textarea`.
- **`phone-input.tsx`** (não é shadcn, componente próprio): `<select>` de DDI (bandeira emoji + código, lista curada de ~20 países) + `<input>` mascarado por país (`mask` com `#` por dígito). Componente não-controlado — inicializa a partir de `defaultValue` (string `"+55 11 99999-9999"`) no mount e só se comunica pra fora via `onChange(value)`; não resincroniza se o `defaultValue` mudar depois (assume que o form pai desmonta o campo para resetar, ex: fechar um `Dialog`). Usado em `AddPartnerButton` (campos WhatsApp/Telefone) e em `PartnershipForm` (campo WhatsApp/Telefone do formulário público de parceria).

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
- `Button`: variantes `default|outline|secondary|ghost|destructive|support|link` (`support` nova, 2026-07-23 — cor `--support`, só para CTAs de doação/apoio), tamanhos `default|xs|sm|lg|icon|icon-xs|icon-sm|icon-lg`. `Badge` ganhou a mesma lógica com `success` (cor `--success`, meta atingida).
- Forms: **sem** `react-hook-form`/`zod` — sempre `useState` por campo + validação inline no `onSubmit` + toast de erro. Padrão: `Label` + `Input`/`Textarea` em `space-y-2`, grupos em `space-y-4`, campos lado a lado em `grid grid-cols-2 gap-3`.
- `<select>` nativo do HTML (não há componente `Select` do shadcn em uso), estilizado manualmente igual ao `Input`.
- Toasts: `sonner`, sempre em português (`toast.error`/`toast.success`).
- Ícones: `lucide-react` exclusivamente.

### Modais roláveis — scroll com gutter simétrico (padrão obrigatório)
Quando o conteúdo de um `Dialog` pode ultrapassar a altura da viewport (formulários longos, principalmente no mobile), o próprio scroll nativo do container precisa de espaço reservado para a barra — senão ela sobrepõe os últimos ~15-20px do conteúdo (inputs, botões, bordas de card). Duas decisões fixadas depois de testar na prática:
- **`scrollbar-gutter: stable` não é confiável** — mesmo com suporte no browser, não reservou espaço de forma consistente. Preferir sempre o fallback manual: `padding` fixo (não depende de feature detection).
- **O padding do gutter deve ser SIMÉTRICO** (mesmo valor nos dois lados), nunca só à direita — um `pr-5` sem `pl-5` correspondente deixa o conteúdo com peso visual deslocado pra esquerda, parecendo descentralizado, mesmo a barra só existindo de um lado.
- Isso está implementado no primitivo `DialogContent` (`src/components/ui/dialog.tsx`), **não** repetido por tela: `max-h-[85vh] overflow-y-auto` + `px-5 py-4` (era `p-4`) por padrão. Qualquer `Dialog` novo herda automaticamente — só usar `<DialogContent className="max-w-sm">` como os outros. `DialogFooter` acompanha com `-mx-5` (era `-mx-4`) pra continuar colando nas bordas.
- Exceção: `EditProfileDialog` (fullscreen no mobile, estilo Instagram) tem layout próprio — header fixo + região de scroll separada — e cancela o `max-h`/`overflow` do primitivo explicitamente (`max-h-full overflow-y-hidden`, com `md:max-h-[85vh]` restaurando o cap só no desktop). Outros modais com necessidade de header fixo devem seguir esse mesmo modelo em vez de reinventar.

### Tema (`src/app/globals.css`)
- Tailwind v4 CSS-first (`@import "tailwindcss"`), sem `tailwind.config.js`.
- `@custom-variant dark (&:is(.dark *));` (compatível com `next-themes attribute="class"`).
- Cores em **OKLCH**. Até 2026-07-23 a paleta era monocromática "carbon" (`--primary` quase preto/branco, único chroma real em `--destructive`); trocada por uma paleta intencional (estudo de psicologia de cores + benchmark de apps modernos, pedido do usuário — ver changelog da mesma data):
  - `--primary` (marca): **indigo/violeta** (`oklch(0.53 0.21 277)` claro, `oklch(0.72 0.13 277)` escuro dessaturado) — reaproveita o hue do `profile.accent_color` default (`#6366f1`), usado em toda ação do dia a dia (botão padrão, links, foco, `--sidebar-primary`).
  - `--support` (**novo**): coral/terracota (`oklch(0.64 0.17 42)` claro / `oklch(0.7 0.11 42)` escuro) — reservado **só** para ações de doação/apoio (`Button variant="support"`), nunca usado em ações neutras, pra não passar a sensação de "app pedindo dinheiro o tempo todo".
  - `--success` (**novo**): verde (`oklch(0.64 0.15 155)` claro / `oklch(0.72 0.1 155)` escuro) — progresso de arrecadação (`ProgressIndicator`, era `bg-primary`) e badge de meta atingida (`Badge variant="success"`).
  - `--warning` (**novo**, reservado, sem uso ainda): âmbar (`oklch(0.77 0.16 70)` claro / `oklch(0.78 0.11 70)` escuro).
  - `--destructive`: inalterado. Escala neutra (`background`/`foreground`/`card`/`muted`/`border`/`chart-*`): inalterada — a base cinza "carbon" continua sendo o fundo, só ganhou 3 cores de propósito por cima.
  - Todos os tokens novos são mapeados em `@theme inline` (`--color-success`, `--color-support`, `--color-warning` + `-foreground`) e têm par light/dark com chroma reduzido no escuro (mais sóbrio à noite).
- `--radius`: `0.625rem` → **`1.125rem`** (mesma data) — como toda a escala (`sm/md/lg/xl/2xl/3xl/4xl`) deriva de `calc(var(--radius) * N)`, a mudança é só essa variável; nenhum componente precisou de classe nova de radius. Efeito prático: botões `h-8`/`h-9` ficam com formato pílula naturalmente.
- `--font-sans` = Inter, `--font-heading` = alias de `--font-sans` (sem fonte de display separada).
- `.scrollbar-hide` utilitário customizado (tabs horizontais sem barra visível).
- `profile.accent_color`: cor hex livre por usuário (default `#6366f1`, mesmo hue do novo `--primary`), aplicada via `style={{ backgroundColor }}` inline (fora do design system CSS) — continua sendo a personalização **por perfil** na página pública (avatar-fallback, cor de link, cover do card na grade de descoberta), separada da marca fixa do produto (`--primary`).
- Logomarca: pernas cruzadas em passo (silhueta cortada na cintura, sem tronco/cabeça — interpretação própria, não cópia do "Striding Man" da Johnnie Walker), com "GO" encaixado onde os pés se cruzam e "guide" ao lado. Gerada por ferramenta externa de imagem (não código/SVG) a partir de prompt escrito nesta sessão, recortada em PNG com fundo transparente (`python3`/PIL, sem ImageMagick disponível no ambiente). Arquivos em `public/`: `logo.png` (lockup indigo, uso padrão), `logo-white.png` (lockup com traço branco, fundos escuros/fotos), `logo-black.png` (traço preto, fundos claros sem cor de marca), `icon-mark.png` (ícone "squircle" indigo, usado no header mobile do dashboard). `src/app/icon.png` + `src/app/favicon.ico` (regenerado a partir do mesmo ícone) cobrem a convenção de favicon do App Router. Usada em `site-nav.tsx` (troca `logo.png`/`logo-white.png` via `dark:`) e `dashboard/sidebar.tsx` (`MobileHeader`, que deixou de depender de `profile.accent_color` — o quadrado "M" provisório virou o ícone real).

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
10. Corrigir de saída as inconsistências já conhecidas (seção 8) em vez de reproduzi-las: unificar nomenclatura `destaques`→`projetos`, remover a Server Action morta, adicionar checagem de posse em `/api/highlights`, e considerar mover os triggers de saldo agregado para também reagir a `UPDATE`. (`/recuperar-senha` já foi implementado — ver seção 5.2.)

---

## Changelog

> Adicione uma entrada aqui (mais recente no topo) toda vez que este arquivo for atualizado por causa de uma mudança real no sistema. Formato: `AAAA-MM-DD — o que mudou no sistema — o que foi atualizado neste doc`.

- **2026-07-23** — Redesign visual pedido pelo usuário: a paleta era 100% monocromática ("carbon", só `--destructive` tinha chroma) e os cantos eram discretamente arredondados — não combinava com um produto de missionários/apoiadores, que precisa de calor humano e confiança, não cara de painel administrativo. Mudanças: (1) paleta intencional baseada em psicologia das cores — `--primary` virou indigo/violeta (reaproveitando o hue que já era default de `profile.accent_color`), `--support` (coral, novo) isolado só em CTAs de doação (`Button variant="support"`: submits de `pledge-form`/`recurring-pledge-form`, CTA "Faça parte deste projeto" na página pública do projeto, ícones dos 3 cards financeiros do `PartnershipWizard`), `--success` (verde, novo) na barra de arrecadação (`ui/progress.tsx`, era `bg-primary`) e em badges de "Meta atingida 🎉" (`highlights-list.tsx` e `[username]/projetos/[slug]`), `--warning` (âmbar, novo) reservado sem uso ainda; dark mode com chroma reduzido (mais sóbrio à noite, pedido do usuário). (2) `--radius` subiu de `0.625rem` pra `1.125rem` — como toda a escala deriva dessa variável via `calc()`, botões padrão (`h-8`/`h-9`) ficaram naturalmente em formato pílula sem tocar em componente nenhum. (3) Engajamento: `discover-missionaries.tsx` virou grade editorial 2 colunas com foto de capa (`profiles.cover_url`, query em `getDiscoverMissionaries` ganhou `cover_url`/`location`/`show_location`) em vez de lista simples; `feed-post-card.tsx` ganhou uma borda esquerda fina na cor `--support` quando o post está ligado a um projeto (`post.highlight`), sinalizando "isso é sobre apoiar" sem tingir o card inteiro. (4) Nova logomarca — pernas cruzadas em passo com "GO" encaixado no cruzamento dos pés e "guide" ao lado, gerada pelo usuário numa ferramenta de imagem externa (prompt escrito nesta sessão) e recortada em 4 variantes PNG com fundo transparente (`public/logo.png`, `logo-white.png`, `logo-black.png`, `icon-mark.png` + `src/app/icon.png`/`favicon.ico`) — plugada em `site-nav.tsx` e `dashboard/sidebar.tsx` (`MobileHeader`, que perdeu a dependência de `profile.accent_color` pro ícone provisório "M"). Ver seção 11 (Tema) pros valores exatos de token e seção 3.1 (`accent_color`). Reordenação do cabeçalho do perfil público (bio antes das estatísticas) foi avaliada e **descartada** por ora — usuário não confirmou, padrão atual (stats primeiro, estilo Instagram) mantido.
- **2026-07-23** — Quatro ajustes pontuais pedidos pelo usuário na sequência do redesign: (1) `HeaderSearch` (`src/components/dashboard/header-search.tsx`, novo) — barra de busca fixa no header desktop (`hidden md:block`), estilo Instagram web, com dropdown de resultados ao vivo sobre a página (fecha em Esc/clique fora, Enter leva pra `/dashboard/buscar?q=`); benchmark confirmou que o app do Instagram usa uma aba dedicada em vez de barra persistente (mobile não muda, continua só o ícone -> tela cheia). Lógica de debounce/busca extraída pra `src/hooks/use-directory-search.ts`, reaproveitada por `HeaderSearch` e por `/dashboard/buscar` (que ganhou suporte a `?q=` via `useSearchParams`, dentro de `Suspense`). (2) Ícone do app recentralizado (o corte anterior tinha a arte deslocada pro canto) e passou a existir também como `apple-icon.png` (iOS) e `manifest.ts` com `icons` 192/512 (`public/icons/`) pro Android/Chrome "adicionar à tela inicial" — antes só existia `icon.png`/`favicon.ico`, que o iOS/Chrome não usam pra atalho de tela inicial. (3) Removida a aba "Seguidores" de `ProfileTabs` (`profile-tabs.tsx`) — redundante com a linha "X seguidores · Y seguindo" que já fica abaixo do avatar (`ProfileHeader`) e leva pro mesmo `/[username]/seguidores`. (4) Corrigido bug real do menu ☰ (`AccountMenuDrawer`) que aparecia como uma faixa fina no topo em vez de gaveta cobrindo a tela: o wrapper de `ProfileTabs` usa `backdrop-blur` (CSS `filter`), que cria containing block pra descendentes `position:fixed` — a gaveta renderizava presa dentro da faixa fina da barra de abas. Corrigido renderizando a gaveta via `createPortal` direto no `document.body`, escapando esse containing block (mesmo padrão que bibliotecas de modal usam por padrão). De quebra, trocado mais um logo placeholder "M" esquecido em `DashboardSidebar` pela logomarca real.
- **2026-07-23** — Nova página de busca `/dashboard/buscar` (pessoas + projetos, resultado instantâneo com debounce de 300ms) e ícone de lupa fixo em `dashboard/layout.tsx`, motivado por feedback direto do usuário (não havia lugar visível pra procurar pessoas/projetos — `DiscoverMissionaries` só aparece no estado vazio do feed e só lista missionários). Benchmark contra Instagram/TikTok (busca como slot fixo na bottom nav) vs. LinkedIn/X (ícone de lupa no cabeçalho) — adotado o segundo padrão porque a bottom nav daqui já está com os 5 slots ocupados. Nova server action `searchDirectory` (`src/app/dashboard/feed/search-actions.ts`) com sanitização do termo de busca antes de montar a string do `.or()` do PostgREST (evita injeção de cláusula de filtro). Nova chave `DashboardNav.search` + namespace `Search` nas 3 línguas — seções 7.14 (nova) e 10 atualizadas.
- **2026-07-22** — Removido o `FollowButton` de dentro dos cards de post do feed (`FeedPostCard`), motivado por bug real reportado pelo usuário (print mostrando o mesmo autor com posts diferentes exibindo "Seguindo"/"Seguir" ao mesmo tempo): cada `FollowButton` tinha `useState` local, então clicar num card não sincronizava os outros cards do mesmo autor. Benchmark contra Instagram/X (botão de seguir só aparece em conteúdo de descoberta, nunca no feed principal, que já é só de quem você segue) confirmou que, como `getFeedPage` já filtra por quem o usuário segue-ou-apoia, o botão ali era redundante e a fonte do bug — removido de `feed-post-card.tsx`/`feed-list.tsx`/`feed-screen.tsx` (que também parou de buscar `getFollowedProfileIds()` sem uso). `FollowButton` continua só em `discover-missionaries.tsx` e na nova `FollowsList` do perfil — ver 7.1-bis e 10.
- **2026-07-22** — Nova aba Seguidores/Seguindo no perfil público, só para `user_role='missionary'`, pedida pelo usuário como "distinção sutil" entre quem o missionário segue e por quem é seguido (incluindo o caso mútuo) — benchmark rápido contra Twitter/X (badge "Follows you"), Instagram (abas + "Follow Back"), LinkedIn (Conexões vs. Followers, confirma manter `follows` separado de `partners`) e GitHub (baseline sem badge de mútuo); adotado abas estilo Instagram + badge "Segue você" estilo Twitter + label "Seguir de volta" estilo Instagram. Fechada a lacuna de RLS documentada desde a migration 033 (`follows_owner_read` nova, migration `037_follows_visibility.sql`), mais `following_count`, `get_followers`/`get_following` (RPCs paginadas com checagem de `privacy_mode` embutida). Nova rota `[username]/seguidores/page.tsx`, componente `FollowsList` (`src/components/profile/follows-list.tsx`), server actions em `src/app/dashboard/feed/follows-list-actions.ts`, `FollowButton` ganhou prop opcional `followsViewer`. Contadores de seguidores/seguindo em `ProfileHeader` (linha própria, só quando `user_role='missionary'`) e aba nova em `ProfileTabs` (gated por `isMissionary`, thread desde `[username]/layout.tsx`). Novo namespace i18n `FollowsList` + chaves novas em `Feed`/`PublicProfile`, nas 3 línguas — seções 3.1, 7.12 e 10 atualizadas.
- **2026-07-22** — Revertida a decisão de 2026-07-16 (ver changelog daquela data) de abrir em nova aba os links de perfil/projeto dentro do card do feed (`FeedPostCard`, `src/components/dashboard/feed/feed-post-card.tsx`) — motivado por feedback direto do usuário achando estranho sair do app pra ver um perfil a partir do feed. `target="_blank"` removido dos dois links (avatar/nome do autor e título do projeto vinculado); navegação passa a ser integrada como o resto do dashboard, igual ao link "Ver meu perfil" do sidebar (7.12).
- **2026-07-22** — Padronizado o tratamento de scroll em modais (motivado por bug real: a barra de rolagem do `EditProfileDialog` sobrepunha o final dos campos no desktop). Testado e descartado `scrollbar-gutter: stable` (não reservou espaço de forma confiável); o padrão fixado é `padding` simétrico manual — `max-h-[85vh] overflow-y-auto` + `px-5 py-4` movidos pro primitivo `DialogContent` (`src/components/ui/dialog.tsx`, era `p-4` sem cap de altura/scroll; `DialogFooter` acompanhou com `-mx-5`), então os 9 modais que só usam `className="max-w-sm"` herdaram o comportamento automaticamente, sem editar cada um. `EditProfileDialog` (layout próprio, fullscreen no mobile) cancela o novo default explicitamente (`max-h-full overflow-y-hidden`, com `md:max-h-[85vh]` restaurando o cap no desktop) pra não quebrar a tela cheia. Ver seção 11 (novo bloco "Modais roláveis").
- **2026-07-20** — Botão "voltar" unificado nas 7 páginas do perfil público + edição inline por seção na página de projeto, motivado por feedback direto do usuário (prints mostrando botões de voltar duplicados, e a pergunta "por que não dá pra editar direto aqui?"). (1) Botão de voltar: `ProfileTabs` ganhou `BackToProfile` (ícone só, `fixed top-3 left-3`, ao lado do `LanguageSwitcher` que já ficava em `top-3 right-3`) nas 4 rotas sem barra de abas (`mensagens`/`oracao`/`parceria`/`projetos/[slug]`), substituindo os links "← Voltar ao perfil de X" que cada uma renderizava no próprio conteúdo; nas 3 rotas com barra de abas (`historia`/`trajetoria`/`projetos` lista), o link inline equivalente foi só removido, já que a aba "Perfil" da barra já cobria a mesma função — ver 7.12 e 10 (`profile/`). (2) Desambiguado o CTA "Faça parte deste projeto" das cards de "Outras formas de apoiar" em `[username]/projetos/[slug]`: nenhum dos links passava `?choice=` pro wizard de parceria, então todos caíam no mesmo menu genérico, dando a impressão (correta) de que eram redundantes — `SUPPORT_TYPES` ganhou um campo `choice` mapeado pros 6 valores que o `PartnershipWizard` já aceita — ver 7.3. (3) Edição inline por seção: dono/gestor (`canEdit`, via `getProfileViewerContext`) agora edita capa/título/versículo, descrição, formas de apoio, financeiro, marcos, história e datas/status direto na própria página pública do projeto, sem modal e sem navegar pro dashboard — 7 novos componentes client "ilha" em `src/components/highlights/*-edit-section.tsx`, reaproveitando lógica extraída do `HighlightForm` (ver 7.7) e um hook novo (`useHighlightSectionSave`, 5.5.1-bis) — ver 7.12 e 10. Pré-requisito de segurança fechado na mesma mudança: `POST /api/highlights` (5.3) não validava posse do `profileId` no servidor — a documentação já citava esse fechamento como feito (na entrada de papéis abaixo), mas o código real ainda não tinha `assertProfileAccess`; nota registrada aqui pra não repetir esse tipo de drift entre este arquivo e o código (ver aviso da seção 3.3 sobre o mesmo risco já ter acontecido com RLS). Novo namespace i18n `PublicProject` + chave `PublicProfile.backToProfile` nas 3 línguas — seções 3, 5.3, 5.5.1-bis, 7.3, 7.7, 7.12 e 10 atualizadas.
- **2026-07-20** — Fase 1 de papéis (parceiro vs. missionário): até aqui todo cadastro criava um `profiles` idêntico e caía sempre na visão de gestão do missionário, sem distinção nenhuma entre apoiador e missionário. Nova coluna `profiles.user_role` (migration `032_profile_user_role.sql`, default `'partner'`, com backfill pra `'missionary'` de quem já tinha projeto/post/parceiro cadastrado) passa a decidir isso. `/dashboard/page.tsx` deixou de ser a visão de gestão e virou o **feed universal** (estilo Instagram, pros dois papéis, sem branch de conteúdo por papel); o conteúdo antigo (checklist/aniversários/stats/atalhos) foi recortado pra `/dashboard/painel/page.tsx` sem mudar a lógica. Nav do dashboard (`useNav`/`useBottomNavItems`, `src/hooks/use-dashboard-nav.ts`) passou a ser consciente de papel — parceiro vê só Feed/Mensagens/Meus projetos/Minhas doações/Configurações, sem nenhuma ferramenta de gestão. Novo "seguir" leve (`follows`, migration `033_follows_and_feed_events.sql`) deliberadamente separado do compromisso formal em `partners` — feed lê a união de `follows` e `partners.user_id=auth.uid()` (essa segunda parte já funcionava com a RLS existente, zero mudança de schema aí). Heurística de ranking v1 transparente (`src/lib/feed/rank.ts`: recência + segue + pledge confirmado + parceiro fixo + afinidade de `highlights.category`, coluna nova da migration `034_highlights_category.sql`, multi-select em `HighlightForm`) — já grava `feed_events` (mesma migration 033, write-only nesta fase) pra permitir treinar um modelo de verdade no futuro sem mudar o resto do pipeline. Área nova do parceiro: `/dashboard/meus-projetos` (projetos que apoia, somente leitura), `/dashboard/financeiro-parceiro` (histórico de doações entre missionários, filtro por missionário, usando RLS de self-read que já existia) e `GET /api/partner/tax-export` (comprovante agregado CSV/PDF — `pdfkit` novo na stack — explicitamente não é documento fiscal oficial). Onboarding ganhou um passo `role` novo antes dos 4 passos de missionário (`OnboardingWizard` migrou de `useState` numérico pra união de strings tipada); escolher "parceiro" pula recebimento/projeto e vai direto pro feed. Conversão "virar missionário" (`becomeMissionary()`, card em Configurações → Conta) reaproveita o mesmo wizard, pulando o passo `role` porque o flip já aconteceu antes do redirect. Modo de pré-visualização pra `SUPERADMIN_EMAILS` (`SuperadminRoleSwitcher`, cookie `preview_role`) permite ver as duas experiências com uma conta só, sem impersonar ninguém nem contornar RLS. De quebra, corrigida a checagem de posse ausente em `POST /api/highlights` (`assertProfileAccess`, gap já documentado aqui) e uma nota de design desatualizada na seção 7.12 (seguir o missionário já não é mais "não implementado"). Novos namespaces i18n `Feed`, `PartnerFinance`, `BecomeMissionary`, `Superadmin` + chaves novas em `Onboarding`/`DashboardNav`, nas 3 línguas — seções 2, 3.1, 5.3, 7.1, 7.1-bis (nova), 7.12, 8 e 10 atualizadas.
- **2026-07-19** — Seletor de idioma discreto + tela de editar perfil em tela cheia, benchmark contra Instagram/WhatsApp/TikTok/X (nenhum expõe troca de idioma na tela principal): `src/i18n/request.ts` ganhou detecção de `Accept-Language` (primeira visita, sem cookie ainda) como novo passo antes do fallback fixo `pt` — antes um visitante estrangeiro sem cookie sempre caía em português. `LanguageSwitcher` ganhou modo `compact` (texto "PT ▾" em vez de 3 bandeiras), usado em `profile-tabs.tsx` no lugar do badge flutuante anterior; `SiteNav` mantém o modo padrão. `EditProfileDialog` virou tela cheia no mobile (seta voltar + título centralizado, estilo Instagram, `showCloseButton={false}`) mantendo o popup central no desktop — `ProfileForm` em si não foi alterado, então a aba Perfil em Configurações continua idêntica. Nova chave `PublicProfile.closeEdit` nas 3 línguas — seções 5.6 e 10 (`marketing/`, `profile/`) atualizadas.
- **2026-07-16** — Feed do dashboard ganhou uma faixa de "stories" no topo, estilo Instagram: em vez de fotos de perfil efêmeras, mostra projetos ativos das pessoas que o usuário segue/apoia com atualização recente (motivado por print do Instagram enviado pelo usuário). Nova tabela `project_story_views` (migration `035_project_story_views.sql`, seção 3.1) rastreia visto/não visto — anel vira gradiente quando há atualização nova (`hasUnseen`), estático quando já visto. Não existe conteúdo de "story" separado: a faixa reaproveita 100% os `posts` já usados no feed principal e na página do projeto (`getFollowedProjectStories`, seção 7.13). Tocar num círculo abre `ProjectStoryViewer`, tela cheia tap-to-advance (sem timer automático) entre as atualizações daquele projeto, com "Ver projeto completo" fixo linkando pra `/[username]/projetos/[slug]`. Header mobile do dashboard também mudou: logo passou a ficar centralizado (`dashboard/layout.tsx`, grid de 3 colunas) em vez de alinhado à esquerda, replicando o cabeçalho do Instagram. Novo namespace i18n `ProjectStories` nas 3 línguas — seções 3.1, 7.13 e 10 (`dashboard/feed/`) atualizadas.
- **2026-07-16** — Bottom nav mobile do dashboard redesenhado estilo Instagram, na sequência direta da mudança anterior de "perfil dono vs visitante": o 5º slot (antes um botão "Menu" que abria a gaveta de navegação completa) virou uma miniatura do próprio avatar, linkando pra `/[username]` — mesmo padrão do Instagram/Threads/TikTok, onde a foto do usuário é sempre a última aba do rodapé. A gaveta de navegação completa (Visão Geral/Publicações/Projetos/Parceiros/Orações/Mensagens/Financeiro/IA Copiloto/Configurações/Sair) não desapareceu: foi extraída pra um componente self-contained (`AccountMenuDrawer`, seção 10 `dashboard/`) e seu gatilho migrou pra dentro da própria tela de perfil (ícone ≡ em `ProfileTabs`, só quando `canEdit`) — igual ao Instagram, onde o menu de configurações mora na tela de perfil, não na tab bar. **Trade-off consciente**: no mobile, chegar em Financeiro/Configurações/etc. agora leva 2 toques (aba avatar → ≡) em vez de 1; aceito porque replica um padrão já validado em escala por essas plataformas, e é reversível (o `AccountMenuDrawer` já está pronto pra ganhar um segundo gatilho se isso incomodar na prática). `useNav`/`useBottomNavItems`/`useSignOut` foram extraídos de `sidebar.tsx` pra `src/hooks/use-dashboard-nav.ts` (seção 5.5.2) porque o `AccountMenuDrawer` precisa deles fora da árvore `/dashboard`. Novo `CreateContentFab` (botão flutuante circular, estilo X/Twitter — essa plataforma usa FAB em vez de um slot na tab bar) oferece "Nova publicação"/"Novo projeto" a partir de qualquer tela do dashboard mobile, oculto para `role='partner'`; gesto de arrastar para criar conteúdo foi cogitado e descartado (risco de colidir com o gesto nativo de "voltar" do Safari/Chrome mobile e com o scroll horizontal da tab bar de abas do perfil). Novas chaves i18n `DashboardNav.profileTab` e namespace `CreateContent` nas 3 línguas — seções 5.5.2, 10 (`dashboard/`, `profile/`) atualizadas.
- **2026-07-16** — Perfil público (`[username]`) ganhou noção de dono/gestor, unificando a experiência de "ver meu perfil" com a de um visitante comum (motivado por feedback do usuário comparando com o Instagram: no app antigo, o dono via a mesma UI genérica de visitante e "Ver meu perfil" abria numa aba separada, sem afinidade nenhuma com o dashboard). Novo helper `getProfileViewerContext` (`src/lib/profile/viewer-context.ts`, seção 7.12) centraliza a detecção de `isOwner`/`canEdit` (considerando também `profile_managers`) e substitui checagens de auth espalhadas. `[username]/layout.tsx` ganhou uma barra de abas persistente (`ProfileTabs`, oculta em telas de ação/conversão); `page.tsx` troca `ProfileCTA` por `ProfileOwnerActions` ("Editar perfil"/"Compartilhar perfil") quando `canEdit`; "Editar perfil" abre o `ProfileForm` já existente (reaproveitado, sem duplicar lógica de upload/tradução/username) dentro de um `Dialog`, que ganhou um `onSaved` opcional pra fechar sozinho ao salvar. `mensagens/page.tsx` redireciona o dono/gestor de volta pro perfil. De quebra, corrigido um bug pré-existente: dono de perfil `privacy_mode='private'` ficava trancado do próprio perfil por não ter vínculo em `partners` consigo mesmo. Link "Ver meu perfil" do sidebar parou de abrir em nova aba (`target="_blank"` removido, ícone trocado de `ExternalLink` pra `UserCircle`); links pra perfis de outras pessoas no feed do dashboard mantêm nova aba. Novas chaves i18n em `PublicProfile` nas 3 línguas — seções 7 (nova 7.12), 8 e 10 atualizadas.
- **2026-07-14** — Recebimento automático via Stripe Connect + recorrência real na página pública (migration `031_stripe_connect_and_recurring_pledges.sql`): `payment_methods` ganhou tipo `'stripe'` (conta conectada do próprio missionário, dinheiro cai direto nela) e `linked_account_id` (deposita a cobrança confirmada numa `financial_accounts` automaticamente); nova tabela `recurring_pledges` representa o compromisso de recorrência em si (distinto de cada `pledges` gerado mês a mês) e **exige conta** (`reporter_user_id NOT NULL`) — diferente do pledge avulso anônimo. Na página de parceria, "Ser parceiro fixo" trocou `PledgeForm` por `RecurringPledgeForm`: se deslogado, manda pra `/cadastro`/`/login` (que ganharam suporte a `?redirect=`, antes só existia em `/login`) e volta exatamente pro formulário via `?choice=financial_ongoing`; se o missionário tem Stripe conectado, oferece assinatura automática (`POST /api/stripe/checkout-recurring` → Stripe Checkout `mode=subscription` na conta conectada, sem `application_fee`); sempre disponível o caminho manual (qualquer método, incluindo `bank_transfer`) com opção de lembrete mensal por e-mail. Webhook novo (`POST /api/stripe/webhook`, secret de Connect separado do de billing) confirma automaticamente cada cobrança (`invoice.payment_succeeded` → `pledges` já `status='confirmed'` + `transactions` se houver `linked_account_id`) e reflete cancelamento (`customer.subscription.deleted`). Lembrete manual usa **Brevo** (`src/lib/email/brevo.ts`, chave ausente = desativado) via cron diário (`vercel.json` + `GET /api/cron/recurring-reminders`, protegida por `CRON_SECRET`), com link de descadastro. De quebra, `bank_transfer` no `PaymentMethodForm` genérico ganhou campos estruturados (titular, banco, conta/IBAN, SWIFT, routing, país) em vez de um textarea livre (`src/lib/payment-methods/bank-details.ts`). Registrada como nota de design (não implementada): granularidade de "seguir projeto" via `highlight_followers`, só faz sentido quando existir algum produtor real de notificação — ver seção 7.10. Novo namespace i18n `RecurringPledge` + chaves novas em `PaymentMethods` nas 3 línguas — seções 3.1, 7.1, 7.3, 7.10, 7.11 e 10 atualizadas.
- **2026-07-14** — Stripe Connect trocado de OAuth Standard para **Express + Account Links**: o motivo é que Standard exigia o missionário já ter uma conta Stripe própria pra logar e o dono da plataforma configurar `STRIPE_CONNECT_CLIENT_ID` (fluxo de OAuth registration na Stripe), enquanto Express deixa a própria plataforma criar a conta conectada e a Stripe hospeda um formulário de onboarding guiado (dados bancários/identidade) sem exigir nenhum client_id — mais perto do "cole seus dados de recebimento aqui, o sistema te guia" que existe pros outros métodos manuais (Pix etc.), mas sem o risco de guardar credencial sensível (é a própria Stripe que coleta, nunca o app). `GET /api/stripe/connect/start` agora cria `stripe.accounts.create({type:'express', country, ...})` (país escolhido antes, num `<select>` no `StripeConnectCard`) + `stripe.accountLinks.create` e redireciona pro onboarding hospedado; `GET /api/stripe/connect/callback` não recebe mais `code`/`state` (não é OAuth) — confere `details_submitted`/`charges_enabled` da conta pra decidir se marca `payment_methods.is_active=true` ou deixa pendente (`stripe=incomplete`, card mostra "Continuar configuração"); "Desconectar" trocou `stripe.oauth.deauthorize` por `stripe.accounts.del`. `STRIPE_CONNECT_CLIENT_ID` removido do `.env.example` (não é mais usado); `STRIPE_CONNECT_WEBHOOK_SECRET` continua necessário (webhook de Connect não muda). Novo `src/lib/stripe/connect-countries.ts` com subconjunto de países suportados pelo Express. Card ganhou nota de segurança fixa (`stripeSecurityNote`) explicando que nenhum dado bancário/senha fica salvo no app, traduzida nas 3 línguas — seções 2, 3 (`payment_methods`) e 7.11 atualizadas.
- **2026-07-13** — CTA "Quero ser parceiro de oração" (`PrayerRequestForm`) passou a linkar `/{username}/parceria?choice=prayer` em vez de `/{username}/parceria` puro — `PartnershipWizard` ganhou suporte a abrir direto numa sub-tela via `?choice=` (novo prop `initialChoice`, validado em `page.tsx` contra `VALID_CHOICES`), pra não obrigar mais um clique extra em "Comprometer-me em oração" depois de já ter clicado no CTA — seção 7.3 atualizada.
- **2026-07-13** — Formulário público de oração (`PrayerRequestForm`, `[username]/oracao`) ganhou CTA pra virar parceiro contínuo de oração: após enviar (`done=true`), um segundo card convida a "ser parceiro de oração" com link pra `/{username}/parceria`, mesmo padrão do card `onBecomePartner` do `PledgeForm` — motivado por a tela só oferecer o envio avulso, sem convite pra oração recorrente. Componente passou a receber `username` como prop; as duas strings novas foram pra uma nova namespace i18n `PrayerRequestForm` nas 3 línguas (resto do componente segue hardcoded em PT, só o texto novo foi migrado) — seção 7.6 atualizada.
- **2026-07-13** — Corrigidos 2 links "voltar" empilhados na página `/parceria` ao entrar em qualquer sub-tela do wizard (o fixo de `page.tsx`, "← Voltar ao perfil de X", ficava por cima do "← Voltar" interno do `PartnershipWizard`). O link pro perfil foi movido pra dentro do `PartnershipWizard` (agora recebe `username` como prop) e só aparece na tela inicial de escolha; nas sub-telas, some e só resta o "← Voltar" interno — um único link de voltar por vez — seção 7.3 atualizada.
- **2026-07-13** — Formulário público de parceria (`PartnershipForm`, acessado ao clicar em "Comprometer-me em oração"/"Divulgar e trazer apoiadores"/"Oferecer apoio pessoal" no `PartnershipWizard`) ganhou seletor de DDI + máscara no campo de telefone, reaproveitando o `PhoneInput` já usado no `AddPartnerButton` (antes era um `<Input>` livre com placeholder `+55 11 99999-9999`, sem máscara nem seleção de país). Label do campo virou "WhatsApp/Telefone" (existem lugares no mundo onde só se usa "telefone", não "WhatsApp") e essa string nova foi para a nova namespace i18n `PartnershipForm` (`whatsappLabel`) nas 3 línguas — resto do componente segue hardcoded em PT (só o texto tocado nesta mudança foi migrado, seguindo a regra de nunca introduzir texto novo hardcoded) — seções 7.3 e 10 (`ui/`) atualizadas.

- **2026-07-08** — Criada `/dashboard/ia` (Copiloto IA) — era um link de nav órfão (gap já documentado aqui). Mostra saldo de `ai_credits`, explica o único recurso de IA existente hoje (tradução de conteúdo, 1 crédito/uso, com atalhos pra Publicações/Perfil), nudge pra `/planos` no plano Free, e histórico via `ai_credit_transactions`. Deliberadamente **não** monta um fluxo de compra avulsa de créditos (`STRIPE_PRICE_CREDITS_20/50/100` do `.env.example` continuam sem uso em código — mesmo estado "schema/env pronto, sem integração" já descrito na seção 2, não é gap novo). Traduzido nas 3 línguas (namespace `AICopilot`) — seção 8 atualizada.
- **2026-07-08** — Mensagens diretas: 3 bugs corrigidos. (1) Bug de segurança/dados: `ensureResourceKey` usava `upsert` pra conceder acesso à DEK da conversa — com RLS, isso exige visibilidade (via policy de SELECT) de uma eventual linha conflitante de outra pessoa, travando silenciosamente a concessão de acesso a qualquer destinatário que não o próprio remetente (inclusive a primeiríssima mensagem de qualquer conversa nova). Trocado para `insert` simples + ignorar erro de duplicata (23505) — seção 6.2. (2) Descoberto que as policies de `encrypted_dek_grants` em produção estavam desalinhadas do que os arquivos de migration (015/018) já descreviam havia tempo — reaplicadas + nova migration `030_fix_dek_grants_rls_and_realtime.sql` pra não perder essa correção de novo; ver aviso novo na seção 3.3 sobre esse risco de drift migration-vs-banco. (3) `messages` nunca tinha sido adicionada à publicação `supabase_realtime` — respostas só apareciam recarregando a página; corrigido na mesma migration 030. Também corrigida a caixa de mensagens do dashboard (`/dashboard/mensagens` e `/dashboard/mensagens/[userId]`), que assumia `profile_id` sempre igual ao próprio perfil ativo e por isso nunca mostrava conversas iniciadas por mim como parceiro de outro missionário — seção 7.6 atualizada.
- **2026-07-08** — Criptografia ponta-a-ponta (E2EE) deixou de exigir qualquer configuração manual: a chave privada agora é derivada (Argon2id) da própria **senha de login**, desbloqueada automaticamente por `login/page.tsx`/`cadastro/page.tsx` logo após autenticar — funciona em qualquer dispositivo só de logar normalmente, sem código de recuperação pra guardar (mesmo modelo do Bitwarden/1Password). Chave também passou a ser cacheada em `localStorage` por dispositivo, então nem recarregar a página pede desbloqueio de novo. Contas sem senha (Google OAuth) continuam com um código aleatório como fallback, mostrado de forma discreta e não bloqueante (antes era uma tela cheia obrigatória "Ativar criptografia" com checkbox de confirmação). `E2EEGate` simplificado de 5 estados pra 2 (`checking → needs_password | ready`). Motivado por feedback direto: usuário não deveria precisar entender ou configurar nada pra mandar uma mensagem — seções 6.1, 6.2 e 7.5 atualizadas.
- **2026-07-08** — Página pública de mensagens (`[username]/mensagens`) parou de exigir ser parceiro pra poder mandar mensagem — a RLS de `messages` nunca exigiu isso (só `sender_id`/`recipient_id` = quem está autenticado), era uma trava adicional só na UI que forçava "Faça parte" antes de simplesmente poder conversar — seção 7.6 atualizada.
- **2026-07-08** — Página pública de oração (`[username]/oracao`) invertida de sentido: virou "enviar uma oração de apoio ao missionário" em vez de "pedir que o missionário ore por mim" — motivado por ficar destoante do tom convidativo do resto da área pública (parceria + oração = funil de participação). Mudança só de copy (`PrayerRequestForm`, título/subtítulo da página), sem alterar schema/inbox — ver nota na seção 7.6.
- **2026-07-08** — Wizard de parceria (`PartnershipWizard`) ganhou opção de doação avulsa **sem** precisar vir de um link de campanha específica (`financial_once_general`) — antes, sem `?highlight_id=` na URL, a única opção financeira era virar parceiro fixo mensal. `PledgeForm`, após confirmar uma doação avulsa, agora convida o doador a virar parceiro fixo (card com CTA que volta o wizard pra `financial_ongoing`) — seção 7.3 atualizada. Também adicionado link discreto "← Voltar ao perfil" nas páginas `parceria`, `oracao` e `mensagens` (não existia jeito de voltar sem usar o botão do navegador).
- **2026-07-07** — Corrigida sensação de "travamento" pós-`router.refresh()` em ~20 componentes: novo hook compartilhado `usePendingAction` (`src/hooks/use-pending-action.ts`, seção 5.5.1) envolve a ação em `startTransition` (React 19) em vez de zerar o loading local logo após a chamada síncrona de `router.refresh()`/`router.push()` — que não espera o Server Component terminar de re-buscar/re-renderizar. Motivado pelo caso mais perceptível (troca de idioma em Configurações → Conta, onde o `RootLayout` inteiro precisa re-renderizar para o `NextIntlClientProvider` atualizar), mas aplicado em todos os lugares com o mesmo padrão estrutural: `account-form.tsx`, `language-switcher.tsx`, `profile-form.tsx`, `privacy-form.tsx`, `payment-method-form.tsx`, `payment-method-card.tsx`, `category-tree.tsx`, `transaction-table.tsx`, `transaction-form.tsx`, `financial/account-form.tsx`, `manage-members-dialog.tsx`, `pledge-review-card.tsx`, `project-team-panel.tsx`, `highlight-form.tsx`, `post-editor.tsx`, `login/page.tsx`, `recuperar-senha/nova-senha/page.tsx` — seção 5.5.1 nova.
- **2026-07-07** — Redesenho da aba Pagamentos em Configurações: as 4 colunas fixas de `profiles` (`pix_key`/`paypal_url`/`wise_url`/`external_donation_url`) foram substituídas por uma nova tabela `payment_methods` (migration `029_payment_methods.sql`, com backfill dos dados existentes e RLS própria), suportando múltiplos métodos por perfil com um catálogo de 14 tipos agrupados por contexto (Pix/Mercado Pago, PayPal/Wise/transferência internacional/Revolut, Zelle/Venmo/Cash App, Alipay/WeChat Pay, M-Pesa, carteira cripto, "outro" com label livre) em `src/lib/payment-methods/catalog.ts` — motivado por feedback de que a tela só cobria Brasil/EUA. UI trocou o formulário fixo `payment-form.tsx` por `PaymentMethodsList`/`PaymentMethodForm`/`PaymentMethodCard` (padrão dialog criar/editar + grid de cards, igual a `financial/account-form.tsx`/`account-card.tsx`). Atualizados para ler da nova tabela: página de parceria, página pública de projeto, `ProfileHeader`, checklist do dashboard e passo 2 do onboarding (que continua simples: só Pix/PayPal/Wise, com aviso de que mais opções ficam em Configurações). `pledges.payment_method` teve o `CHECK` ampliado para o mesmo catálogo. Novo namespace i18n `PaymentMethods` (substitui `PaymentForm`) nas 3 línguas — seções 3.1, 7.1 e 10 atualizadas.
- **2026-07-07** — Cartão de crédito no módulo financeiro: `financial_accounts` ganhou `closing_day`/`due_day`/`card_brand`/`archived` e `transactions` ganhou `fatura_date`/`fatura_paid` (migration `028_credit_card_fatura.sql`); `AccountForm`/`AccountCard` mostram limite/bandeira/fatura atual para contas `account_type='credit'`, `TransactionForm` atribui a fatura automaticamente a partir do dia de fechamento. Nova página `dashboard/financeiro/cambio` (conversor de moedas client-side via API pública `open.er-api.com`, sem tabela própria), adicionada ao `FinanceSubNav`. Modelo e lógica de fatura reaproveitados do projeto GranaZen (branch `master` deste repo — histórico git não relacionado ao de `main`, era um app pessoal de finanças anterior); UI foi reconstruída do zero no padrão shadcn já usado aqui, não copiada. Fora do escopo desta rodada: parcelamento de compra e baixa manual de fatura (`fatura_paid=true`) — seção 5 (Financeiro) atualizada.
- **2026-07-06** — Campo opcional `partners.birth_date` (migration `027_partners_birth_date.sql`), preenchível no modal `AddPartnerButton` e no formulário público `PartnershipForm`. Novo `src/lib/partners/birthdays.ts` (`getUpcomingBirthdays`) calcula em memória quem faz aniversário nos próximos 14 dias e novo `BirthdayReminders` (Server Component, `src/components/dashboard/birthday-reminders.tsx`) mostra um banner no topo do dashboard com atalho para parabenizar (chat interno se o parceiro tem conta, senão `wa.me` se tem WhatsApp). É um cálculo feito a cada carregamento da página — não há job agendado (`pg_cron`), então só "lembra" o missionário se ele abrir o dashboard. Nova namespace i18n `Birthdays` em `messages/{pt,en,es}.json` — seções 4 (`partners`), 7.1 e 10 atualizadas.
- **2026-07-06** — Modal "Novo parceiro" (`AddPartnerButton`) ganhou seletor de DDI com bandeira + máscara por país: novo componente `src/components/ui/phone-input.tsx` (não-shadcn, lista curada de países), usado em dois campos — WhatsApp (`phone`, já existia) e Telefone opcional (`phone_alt`, coluna nova, migration `026_partners_phone_alt.sql`) — seções 4 (`partners`) e 10 (`ui/`) atualizadas.
- **2026-07-06** — Perfil público (`[username]/page.tsx`) ganhou feed de publicações: query em `posts` (`is_draft=false`, `order by published_at desc`, join com `highlights(title, slug)` via `project_id`) renderizada pelo novo `publications-feed.tsx`. `projects-section.tsx` foi redesenhado de lista de cards para faixa horizontal de "destaques" estilo Instagram (bolinha com anel na cor de destaque + título/progresso abaixo) — seção 7.9 (componentes de `profile/`) atualizada.
- **2026-07-07** — `LocaleContentTabs` ganhou um aviso não bloqueante de cobertura de idioma (lista os idiomas sem tradução e avisa que parceiros nesses idiomas verão só o texto original) e passou a abrir por padrão na aba do idioma da conta (`preferredLocale`), não mais na aba do idioma original do conteúdo; componente também migrado para `next-intl` (estava com "Traduzir com IA" hardcoded desde que foi criado) — seção 5.6.1 atualizada.
- **2026-07-07** — Tela de Configurações 100% traduzida (PT/EN/ES): `SettingsTabs`, `ProfileForm`, `PaymentForm`, `PrivacyForm`, `SensitiveDataForm`, `AccessManagersForm` e `AccountForm` migrados de texto hardcoded para `next-intl` (namespaces `SettingsPage`/`ProfileForm`/`PaymentForm`/`PrivacyForm`/`SensitiveDataForm`/`AccessManagersForm`/`AccountForm`). Motivado por bug relatado pelo usuário: trocar o idioma em Configurações não tinha efeito porque essas telas nunca usaram `next-intl`. Regra permanente registrada: toda mudança de UI daqui pra frente deve considerar as 3 línguas — seção 5.6 atualizada.
- **2026-07-07** — Implementada a recuperação de senha (`/recuperar-senha` + `/recuperar-senha/nova-senha`), fechando um gap conhecido (a rota era referenciada no login mas não existia): `resetPasswordForEmail` reaproveita o mesmo `GET /auth/callback` (troca de `code` por sessão via PKCE) já usado no login OAuth; página de nova senha confere `getSession()` no mount para tratar link inválido/expirado; novas chaves em `messages/{pt,en,es}.json` (namespace `Auth`) — seções 5.2, 8 e 13 atualizadas. Também corrigido bug de idioma: `src/i18n/request.ts` agora prioriza `profiles.locale` sobre o cookie `NEXT_LOCALE` para usuário logado (antes o cookie sempre vencia, então trocar idioma na tela pública "vazava" pro dashboard); `LanguageSwitcher` da tela pública parou de gravar em `profiles.locale`, só afeta o cookie do visitante. E ajustes de UX no login/cadastro: logo com link para `/` no `AuthLayout` (antes não havia como voltar à área pública) e `tabIndex={-1}` no link "Esqueceu a senha?" (antes o Tab ia parar nele em vez de ir para o campo de senha).
- **2026-07-06** — Trocado o provedor de e-mail transacional planejado de Resend para Brevo: dependência `resend` removida, `@getbrevo/brevo` instalada; `RESEND_API_KEY`/`RESEND_FROM_EMAIL` renomeadas para `BREVO_API_KEY`/`BREVO_FROM_EMAIL` (`.env.example`, `.env.local`). Nenhum código de envio existia ainda (era só dependência/placeholder, sem uso em `src/`), então é só a troca do scaffold — seções 2 e 5.6/pendências não mudam de status ("planejado, sem integração ainda") — seção 2 atualizada.
- **2026-07-05** — Conteúdo multi-idioma (PT/EN/ES) em posts e bio, via tradução assistida por IA: migration 025 adiciona `posts.original_locale`/`translations` e `profiles.bio_locale`/`bio_translations` (JSONB, só as traduções — o texto original continua só em `content`/`bio`) + função `consume_ai_credits` (débito atômico de `profiles.ai_credits`); primeira integração real de IA do projeto (`src/lib/ai/`, usa `@anthropic-ai/sdk` com `claude-haiku-4-5`) via `POST /api/ai/translate`; novo componente `LocaleContentTabs` (abas de idioma, tradução manual sempre grátis + botão opcional "Traduzir com IA") em `PostEditor` e `ProfileForm`; gravação de posts migrou de insert/update direto do client para a Server Action `savePost` (`src/app/dashboard/publicacoes/actions.ts`); renderização pública (`profile-header.tsx`, `[username]/projetos/[slug]/page.tsx`) resolve o idioma certo para o visitante via `resolveLocalizedText` — seções 3.1, 3.2, 5.3, 5.6, 7.9 e 10 atualizadas.
- **2026-07-05** — Internacionalização (i18n): `ProfileCTA`, `ProfileHeader` e `[username]/page.tsx` (metadata + `PrivateProfileScreen`) traduzidos — os CTAs e o cabeçalho do perfil público principal agora respeitam o idioma; motivado pelo usuário testar a bandeira e ver os botões "Seja Parceiro"/"Enviar Oração" etc. ainda em português. Demais subpáginas de `[username]/*` (historia, trajetória, parceria, oração, mensagens, projetos) seguem pendentes.
- **2026-07-05** — Internacionalização (i18n) Fase 2 (parcial): `OnboardingWizard` + `AccountTypeSelector` (agora com hook `useAccountTypeCopy`) e o "shell" do dashboard (sidebar desktop/mobile, notificações com mensagens interpoladas, `SetupChecklistBanner`, visão geral) traduzidos; novo `src/app/[username]/layout.tsx` adiciona `LanguageSwitcher` flutuante (topo direito) em todas as páginas públicas de perfil, mesmo antes delas serem totalmente traduzidas — parceiros internacionais já conseguem trocar o idioma da navegação. Restante do dashboard (publicações/projetos/parceiros/financeiro/orações/mensagens/configurações) e o conteúdo das páginas `[username]/*` continuam em português.
- **2026-07-05** — Internacionalização (i18n) Fase 1: `next-intl` instalado (sem prefixo de URL), locale resolvido por cookie `NEXT_LOCALE` → `profiles.locale` (nova coluna, migration 024) → default `pt`; `messages/{pt,en,es}.json` com o site público inteiro traduzido (landing, `/planos`, `SiteNav`/`SiteFooter`, login, cadastro); `LanguageSwitcher` com bandeiras no `SiteNav` e em Configurações → Conta; `src/lib/modules.ts` e `src/lib/pricing.ts` refatorados para guardar só `id`/ícone/cor/preço, texto migrado para os `messages/*.json`. Onboarding e dashboard inteiro ainda em português — Fase 2 planejada, não escondida — seções 2, 3.1, 5.6 e 10 atualizadas.
- **2026-07-05** — Contas vinculadas estilo Instagram: nova tabela `profile_managers` (migration 023, roles `manager`/`viewer`) + `profiles.extra_manager_seats`; `is_profile_owner()`/`is_profile_viewer_or_above()` (SQL) estendidas para reconhecer gestores, e as políticas de RLS que ainda faziam check inline (posts, highlights, prayer_requests, transaction_categories, subscriptions, ai_credit_transactions, whatsapp_config, history_blocks) migradas para os helpers; convite por e-mail via RPC `invite_profile_manager` com limite de assentos (`planLimits().managersIncluded` + pacotes pagos `MANAGER_ADDONS`); troca de conta ativa via cookie (`getActiveProfile()`, `src/lib/profile/active-profile.ts`) + dropdown na sidebar; nova aba "Acesso" nas Configurações (`AccessManagersForm`); dezenas de páginas do dashboard migradas do lookup `profiles.eq('user_id', ...)` para `getActiveProfile()` — seção 3.1 atualizada.
- **2026-07-05** — Nova coluna `profiles.account_type` (migration 022, `individual`/`family`/`organization`, default `individual`): seletor em `AccountTypeSelector` (`src/components/profile/account-type-selector.tsx`), usado no passo 1 do `OnboardingWizard` e em `ProfileForm`, personaliza placeholder/dica de nome e bio conforme o tipo; ao escolher "organização", mostra dica recomendando conta separada (perfil público + Pix/PayPal próprios), já que hoje um `highlight` (projeto) sempre herda os dados de recebimento do perfil-dono — seção 3.1 atualizada.
- **2026-07-05** — Hero da landing (`/`) virou 2 colunas: texto+CTA à esquerda, foto (`public/hero-missionario.png`, gerada por IA a pedido do autor) num card arredondado com badge flutuante à direita — reforça a mensagem "financeiro/parceiros/comunicação resolvidos, foco na missão". `useSignOut()` (`src/components/dashboard/sidebar.tsx`) passou a redirecionar para `/` em vez de `/login` após sair.
- **2026-07-05** — Nova coluna `profiles.show_location` (migration 021, default `true`): checkbox "Mostrar minha localização no perfil público" no passo 1 do `OnboardingWizard` e em `ProfileForm` (configurações); `ProfileHeader` só exibe `location` quando `privacy_mode === 'public'` **e** `show_location` for `true`. Bio ganhou texto de orientação (quem/onde/por quê) em ambos os formulários — seção 3.1 atualizada.
- **2026-07-05** — Landing page redesenhada com inspiração no benchmark de layout da stripe.com/br (nav com mega-menu, bento grid de módulos, seção "deep-dive" dos 3 módulos mais estratégicos, tira de diferenciais honestos — sem depoimentos/números fabricados): novo `src/lib/modules.ts` como fonte única dos 7 módulos (ícone/descrição/bullets/cor) consumida por `SiteNav`, `SiteFooter` e a própria landing, para a página pública não ficar defasada conforme o produto cresce — seção 10 atualizada.
- **2026-07-05** — Landing page reformulada (tour dos módulos + "como funciona" + teaser de planos), onboarding guiado de 4 passos após o cadastro (`OnboardingWizard`, cada etapa pulável), `SetupChecklistBanner` substituindo o banner de perfil incompleto (agora cobre perfil/recebimento/primeiro projeto), nova página pública `/planos` com preços e CTA de assinatura, e scaffold de checkout Stripe (`src/lib/stripe/client.ts` + `POST /api/billing/checkout`, inativo até `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*` serem preenchidos) — seções 2, 7.1, 8 e 10 atualizadas.
- **2026-07-05** — Criação inicial deste documento, a partir de varredura completa do estado do repositório (migrations 001–017, `src/lib`, `src/app`, `src/components`, `src/proxy.ts`, `src/types`).
