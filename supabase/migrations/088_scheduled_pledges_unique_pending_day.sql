-- Impede duas ofertas agendadas pendentes pro mesmo missionário no mesmo
-- dia por parte da mesma pessoa — sem isso, um duplo-clique no botão ou
-- reabrir o formulário sem perceber que já tinha agendado gera dois
-- lembretes pra mesma data. Só olha status='pending': um agendamento já
-- cumprido/cancelado não deve travar um novo pra essa data (ver 086).
CREATE UNIQUE INDEX idx_scheduled_pledges_unique_pending_per_day
  ON public.scheduled_pledges (profile_id, reporter_user_id, scheduled_date)
  WHERE status = 'pending';
