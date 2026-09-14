-- ============================================================
-- Tendência da prestação de contas frente ao período anterior do mesmo
-- perfil — pedido do usuário depois de uma análise crítica da landing page
-- ("dá sensação de acompanhar uma jornada, não só ler um extrato isolado").
--
-- Decisão de privacidade: a function NUNCA devolve valores, nem o do
-- período atual nem o anterior — só a direção ('up'/'down'/'similar'),
-- porque um percentual de variação já seria suficiente pra alguém com o
-- valor atual (que a landing page já mostra, quando `financial_visibility
-- = 'exact'`) recalcular algebricamente o valor exato do período anterior
-- (previous = current / (1 + pct/100)) — isso vazaria dado de uma
-- atualização que o parceiro pode nem ter o link. Mesma filosofia de
-- minimização de dado do resto de 7.10-quater/7.10-quinquies.
--
-- Só compara quando os dois períodos têm o mesmo `periodLabel` (30d vs 30d,
-- nunca 30d vs 90d — outro jeito de vazar informação seria comparar
-- períodos de tamanhos diferentes e chamar isso de "tendência").
-- Compara a moeda dominante de arrecadação (`incomeByCurrency`) do período
-- atual; se o período anterior não tiver dado nessa mesma moeda, não
-- compara (retorna NULL, a página simplesmente não mostra nada).
-- ============================================================

CREATE OR REPLACE FUNCTION get_broadcast_trend(p_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH current_broadcast AS (
    SELECT profile_id, created_at, financial_snapshot
    FROM partner_broadcasts
    WHERE id = p_id
  ),
  current_currency AS (
    SELECT cb.currency, cb.amount
    FROM current_broadcast,
    LATERAL (
      SELECT key AS currency, value::numeric AS amount
      FROM jsonb_each_text(financial_snapshot -> 'incomeByCurrency')
      ORDER BY value::numeric DESC
      LIMIT 1
    ) cb
  ),
  previous_broadcast AS (
    SELECT pb.financial_snapshot
    FROM partner_broadcasts pb, current_broadcast cb
    WHERE pb.profile_id = cb.profile_id
      AND pb.id != p_id
      AND pb.financial_snapshot IS NOT NULL
      AND pb.created_at < cb.created_at
      AND pb.financial_snapshot ->> 'periodLabel' = cb.financial_snapshot ->> 'periodLabel'
    ORDER BY pb.created_at DESC
    LIMIT 1
  )
  SELECT
    CASE
      WHEN prev_amount IS NULL OR prev_amount <= 0 THEN NULL
      WHEN cc.amount > prev_amount * 1.1 THEN 'up'
      WHEN cc.amount < prev_amount * 0.9 THEN 'down'
      ELSE 'similar'
    END
  FROM current_currency cc
  LEFT JOIN previous_broadcast pb ON TRUE
  LEFT JOIN LATERAL (
    SELECT (pb.financial_snapshot -> 'incomeByCurrency' ->> cc.currency)::numeric AS prev_amount
  ) amounts ON TRUE;
$$;
