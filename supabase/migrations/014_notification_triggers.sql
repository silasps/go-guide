-- ============================================================
-- Notificações automáticas via trigger Postgres.
-- Trigger (não código de aplicação) garante disparo mesmo vindo de
-- fora do Next.js — futuro app Expo, futura integração WhatsApp.
-- ============================================================
CREATE OR REPLACE FUNCTION notify(p_recipient_user_id uuid, p_type text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO notifications (recipient_user_id, type, payload)
  VALUES (p_recipient_user_id, p_type, p_payload);
END;
$$;

-- Nova oferta reportada -> notifica o missionário dono do perfil
CREATE OR REPLACE FUNCTION trg_fn_notify_new_pledge()
RETURNS TRIGGER AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM profiles WHERE id = NEW.profile_id;
  PERFORM notify(v_owner, 'new_pledge', jsonb_build_object(
    'pledge_id', NEW.id, 'amount', NEW.reported_amount, 'reporter_name', NEW.reporter_name, 'highlight_id', NEW.highlight_id
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_new_pledge
  AFTER INSERT ON pledges
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_new_pledge();

-- Oferta confirmada -> notifica quem reportou (se tinha conta)
CREATE OR REPLACE FUNCTION trg_fn_notify_pledge_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    IF NEW.highlight_id IS NOT NULL THEN
      SELECT title INTO v_title FROM highlights WHERE id = NEW.highlight_id;
    END IF;
    PERFORM notify(NEW.reporter_user_id, 'pledge_confirmed', jsonb_build_object(
      'pledge_id', NEW.id, 'amount', NEW.reported_amount, 'highlight_title', v_title
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_pledge_confirmed
  AFTER UPDATE ON pledges
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_pledge_confirmed();

-- Nova mensagem -> notifica o destinatário
CREATE OR REPLACE FUNCTION trg_fn_notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM notify(NEW.recipient_id, 'new_message', jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_new_message();

-- Novo parceiro -> notifica o missionário dono do perfil
CREATE OR REPLACE FUNCTION trg_fn_notify_new_partner()
RETURNS TRIGGER AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM profiles WHERE id = NEW.profile_id;
  PERFORM notify(v_owner, 'new_partner', jsonb_build_object('partner_id', NEW.id, 'name', NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_new_partner
  AFTER INSERT ON partners
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_new_partner();

-- Projeto seguido publica atualização -> notifica parceiros vinculados ao perfil
CREATE OR REPLACE FUNCTION trg_fn_notify_highlight_update()
RETURNS TRIGGER AS $$
DECLARE
  v_partner RECORD;
BEGIN
  IF NEW.project_id IS NOT NULL AND NEW.is_draft = false AND (TG_OP = 'INSERT' OR OLD.is_draft = true) THEN
    FOR v_partner IN
      SELECT DISTINCT user_id FROM partners WHERE profile_id = NEW.profile_id AND user_id IS NOT NULL
    LOOP
      PERFORM notify(v_partner.user_id, 'highlight_update', jsonb_build_object('post_id', NEW.id, 'highlight_id', NEW.project_id));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_highlight_update
  AFTER INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_highlight_update();
