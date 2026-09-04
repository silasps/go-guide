-- ============================================================
-- Oferta recusada -> notifica quem reportou (se tinha conta), com o
-- motivo que o missionário informou ao rejeitar. Espelha
-- trg_notify_pledge_confirmed (migration 014), só que pra status='rejected'.
-- A janela de reanálise (7 dias em destaque + 60 dias arquivada) é
-- inteiramente calculada em cima de `reviewed_at` na camada de aplicação —
-- não precisa de coluna nova nem de job agendado pra "expirar" nada.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_fn_notify_pledge_rejected()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    IF NEW.highlight_id IS NOT NULL THEN
      SELECT title INTO v_title FROM highlights WHERE id = NEW.highlight_id;
    END IF;
    PERFORM notify(NEW.reporter_user_id, 'pledge_rejected', jsonb_build_object(
      'pledge_id', NEW.id, 'amount', NEW.reported_amount, 'highlight_title', v_title, 'rejection_reason', NEW.rejection_reason
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_pledge_rejected
  AFTER UPDATE ON pledges
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_pledge_rejected();
