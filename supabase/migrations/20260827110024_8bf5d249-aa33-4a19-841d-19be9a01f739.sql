-- 1) Generalizar ai_insights (vazia, sem uso) -> system_events
ALTER TABLE public.ai_insights RENAME TO system_events;

ALTER TABLE public.system_events
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN reference_date SET DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS reference_value numeric,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id text;

CREATE INDEX IF NOT EXISTS system_events_dedupe_idx
  ON public.system_events (restaurant_id, dedupe_key, created_at DESC);

-- 2) Lembretes simples
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  contact_id text,
  description text NOT NULL,
  due_date date NOT NULL,
  due_time time,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_own_restaurant" ON public.reminders
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TRIGGER reminders_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS reminders_due_idx ON public.reminders (restaurant_id, due_date, status);

-- 3) Scheduler mínimo
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'luud-check-alerts',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://luudpro.app/api/public/whatsapp/gemini',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"command": "__SYSTEM_CHECK_ALERTS__"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'luud-daily-summary',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://luudpro.app/api/public/whatsapp/gemini',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"command": "__SYSTEM_DAILY_SUMMARY__"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'luud-check-reminders',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://luudpro.app/api/public/whatsapp/gemini',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"command": "__SYSTEM_CHECK_REMINDERS__"}'::jsonb
  );
  $$
);