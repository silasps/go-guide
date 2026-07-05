-- ============================================================
-- Datas da viagem/prazo e marcação de quando um projeto foi concluído
-- (usado no hero da página pública e na trajetória/histórico)
-- ============================================================
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS trip_start_date DATE,
  ADD COLUMN IF NOT EXISTS funding_deadline DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_highlight_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_highlight_completed_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW EXECUTE FUNCTION set_highlight_completed_at();
