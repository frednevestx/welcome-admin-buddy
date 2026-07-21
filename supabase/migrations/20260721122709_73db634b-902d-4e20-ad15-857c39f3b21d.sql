
-- Tour completion flag
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false;

-- Ticket status enum
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open','awaiting_user','awaiting_support','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_author_role AS ENUM ('user','admin','ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'awaiting_support',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete tickets" ON public.support_tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role public.ticket_author_role NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read messages of accessible tickets" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
      AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
CREATE POLICY "insert messages on accessible tickets" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
      AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
    AND (author_id = auth.uid() OR author_role = 'ai')
  );

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets(user_id, last_message_at DESC);

-- Bump last_message_at
CREATE OR REPLACE FUNCTION public.bump_ticket_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets
  SET last_message_at = NEW.created_at,
      updated_at = now(),
      status = CASE
        WHEN NEW.author_role = 'user' THEN 'awaiting_support'::public.ticket_status
        WHEN NEW.author_role IN ('admin','ai') THEN 'awaiting_user'::public.ticket_status
        ELSE status
      END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS support_messages_bump ON public.support_messages;
CREATE TRIGGER support_messages_bump AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_last_message();
