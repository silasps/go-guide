-- ============================================================
-- Estado de restrição da conta Stripe conectada persistido no
-- banco — antes, o webhook `account.updated` só disparava um e-mail
-- (`requirements.disabled_reason`) e nunca gravava nada, então a
-- aba Pagamentos (que só lê `is_active`, setado uma única vez no
-- onboarding) nunca refletia uma restrição posterior nem sua
-- resolução. Ver system.architecture.md 7.11.
-- ============================================================
ALTER TABLE payment_methods ADD COLUMN stripe_disabled_reason TEXT;
