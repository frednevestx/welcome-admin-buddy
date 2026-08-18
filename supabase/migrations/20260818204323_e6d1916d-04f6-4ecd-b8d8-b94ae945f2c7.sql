CREATE TABLE public.whatsapp_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  phone text NOT NULL,
  mode text NOT NULL DEFAULT 'menu',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX whatsapp_sessions_phone_key ON public.whatsapp_sessions (phone);
CREATE INDEX whatsapp_sessions_restaurant_idx ON public.whatsapp_sessions (restaurant_id);

GRANT ALL ON public.whatsapp_sessions TO service_role;

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Adapta sync_logs para aceitar eventos que não vêm de uma integração conectada
ALTER TABLE public.sync_logs ALTER COLUMN integration_id DROP NOT NULL;
ALTER TABLE public.sync_logs ALTER COLUMN restaurant_id DROP NOT NULL;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'integration';
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS payload jsonb;