-- ============================================================
-- Notifica o dono do post quando alguém comenta (não notifica se a
-- pessoa comentou no próprio post). Payload carrega username/post_id
-- pra o sino levar direto pro post + comentários, não só pra uma área
-- genérica como as outras notificações.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_fn_notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_user_id uuid;
  v_username text;
  v_commenter_name text;
BEGIN
  SELECT p.user_id, p.username INTO v_owner_user_id, v_username
  FROM posts po
  JOIN profiles p ON p.id = po.profile_id
  WHERE po.id = NEW.post_id;

  SELECT display_name INTO v_commenter_name FROM profiles WHERE id = NEW.profile_id;

  IF v_owner_user_id IS NOT NULL AND v_owner_user_id <> auth.uid() THEN
    PERFORM notify(v_owner_user_id, 'new_comment', jsonb_build_object(
      'post_id', NEW.post_id,
      'comment_id', NEW.id,
      'username', v_username,
      'commenter_name', v_commenter_name
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_new_comment
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_new_comment();
