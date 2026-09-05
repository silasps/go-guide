-- Impede duas ofertas agendadas pendentes pro mesmo missionário, mesmo
-- projeto e mesmo dia por parte da mesma pessoa — sem isso, um duplo-clique
-- no botão ou reabrir o formulário sem perceber que já tinha agendado gera
-- dois lembretes pra mesma data. Só olha status='pending': um agendamento já
-- cumprido/cancelado não deve travar um novo pra essa data (ver 086).
--
-- Inclui highlight_id na chave (não só profile_id/reporter_user_id/data):
-- sem isso, a mesma pessoa não conseguia agendar ofertas pra DOIS PROJETOS
-- diferentes do mesmo missionário na mesma data — bug real encontrado em
-- produção (duas linhas legítimas, cada uma pra um projeto, travaram a
-- criação deste índice). COALESCE normaliza NULL (oferta geral, sem projeto
-- específico) pra um valor fixo, senão o Postgres trata cada NULL como
-- distinto e a proteção contra duplo-clique não pegaria esse caso.
CREATE UNIQUE INDEX idx_scheduled_pledges_unique_pending_per_day
  ON public.scheduled_pledges (profile_id, reporter_user_id, scheduled_date, COALESCE(highlight_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'pending';
