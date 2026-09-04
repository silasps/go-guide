-- ============================================================
-- notifications nunca tinha sido adicionada à publicação supabase_realtime
-- — o NotificationsBell (useNotifications) já assinava postgres_changes
-- pra INSERT/UPDATE, mas o evento nunca disparava, então uma notificação
-- nova só aparecia recarregando a página. Mesmo bug já corrigido pra
-- `messages` na migration 030; idêntico aqui.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
