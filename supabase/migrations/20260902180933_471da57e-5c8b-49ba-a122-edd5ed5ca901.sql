-- =========================================================
-- 1. Normalização de telefone (BR)
-- =========================================================
CREATE OR REPLACE FUNCTION public.normalize_phone(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text; ddd text; local text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_raw, '\D', '', 'g');
  d := regexp_replace(d, '^0+', '');
  IF length(d) < 10 THEN RETURN NULL; END IF;
  IF length(d) IN (10, 11) THEN d := '55' || d; END IF;
  IF left(d, 2) = '55' AND length(d) = 12 THEN
    ddd := substr(d, 3, 2);
    local := substr(d, 5);
    IF length(local) = 8 AND left(local, 1) IN ('6','7','8','9') THEN
      d := '55' || ddd || '9' || local;
    END IF;
  END IF;
  RETURN d;
END;
$$;

-- =========================================================
-- 2. Identidades WhatsApp
-- =========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL,
  talktome_contact_id text,
  display_name text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'known',
  has_conflict boolean NOT NULL DEFAULT false,
  conflict_note text,
  first_message_at timestamptz,
  last_message_at timestamptz,
  verified_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_identities_status_chk
    CHECK (status IN ('known','onboarding','verified','blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_identities_phone_uidx
  ON public.whatsapp_identities (phone_normalized);
CREATE INDEX IF NOT EXISTS whatsapp_identities_user_idx
  ON public.whatsapp_identities (user_id);
CREATE INDEX IF NOT EXISTS whatsapp_identities_restaurant_idx
  ON public.whatsapp_identities (restaurant_id);
CREATE INDEX IF NOT EXISTS whatsapp_identities_status_idx
  ON public.whatsapp_identities (status);

GRANT SELECT ON public.whatsapp_identities TO authenticated;
GRANT ALL ON public.whatsapp_identities TO service_role;

ALTER TABLE public.whatsapp_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem identidades"
  ON public.whatsapp_identities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dono lê a própria identidade"
  ON public.whatsapp_identities FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER whatsapp_identities_updated_at
  BEFORE UPDATE ON public.whatsapp_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. Códigos de acesso (OTP por WhatsApp) — só o servidor acessa
-- =========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  request_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_access_codes_phone_idx
  ON public.whatsapp_access_codes (phone_normalized, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_access_codes_ip_idx
  ON public.whatsapp_access_codes (request_ip, created_at DESC);

GRANT ALL ON public.whatsapp_access_codes TO service_role;

ALTER TABLE public.whatsapp_access_codes ENABLE ROW LEVEL SECURITY;
-- Sem policies: nenhum cliente (anon/authenticated) lê ou escreve.

-- =========================================================
-- 4. Auditoria
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL DEFAULT 'system',
  actor_phone text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'system',
  before_data jsonb,
  after_data jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_origin_chk CHECK (origin IN ('whatsapp','web','admin','system')),
  CONSTRAINT audit_log_actor_kind_chk CHECK (actor_kind IN ('user','admin','system'))
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_restaurant_idx ON public.audit_log (restaurant_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log (actor_user_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem auditoria"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 5. Arquivamento de negócios e perfis (sem apagar)
-- =========================================================
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS restaurants_archived_idx ON public.restaurants (archived_at);

-- Movimentações já possuem status (active/superseded/deleted): nada a alterar.

-- =========================================================
-- 6. Inventário: importa todos os telefones existentes
--    (idempotente, não apaga nada)
-- =========================================================

-- 6a. Telefones vindos das conversas
INSERT INTO public.whatsapp_identities
  (phone_normalized, talktome_contact_id, first_message_at, last_message_at, status)
SELECT
  public.normalize_phone(e.contact_id) AS phone_normalized,
  (array_agg(e.contact_id ORDER BY e.created_at DESC))[1] AS talktome_contact_id,
  min(e.created_at),
  max(e.created_at),
  'known'
FROM public.whatsapp_raw_events e
WHERE public.normalize_phone(e.contact_id) IS NOT NULL
GROUP BY public.normalize_phone(e.contact_id)
ON CONFLICT (phone_normalized) DO UPDATE
  SET first_message_at = LEAST(COALESCE(public.whatsapp_identities.first_message_at, EXCLUDED.first_message_at), EXCLUDED.first_message_at),
      last_message_at  = GREATEST(COALESCE(public.whatsapp_identities.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at),
      talktome_contact_id = COALESCE(public.whatsapp_identities.talktome_contact_id, EXCLUDED.talktome_contact_id),
      updated_at = now();

-- 6b. Telefones vindos das sessões de onboarding
INSERT INTO public.whatsapp_identities
  (phone_normalized, talktome_contact_id, restaurant_id, status, last_message_at)
SELECT
  public.normalize_phone(s.phone),
  (array_agg(s.phone))[1],
  (array_agg(s.restaurant_id) FILTER (WHERE s.restaurant_id IS NOT NULL))[1],
  'known',
  max(s.last_interaction_at)
FROM public.whatsapp_sessions s
WHERE public.normalize_phone(s.phone) IS NOT NULL
GROUP BY public.normalize_phone(s.phone)
ON CONFLICT (phone_normalized) DO UPDATE
  SET restaurant_id = COALESCE(public.whatsapp_identities.restaurant_id, EXCLUDED.restaurant_id),
      last_message_at = GREATEST(COALESCE(public.whatsapp_identities.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at),
      talktome_contact_id = COALESCE(public.whatsapp_identities.talktome_contact_id, EXCLUDED.talktome_contact_id),
      updated_at = now();

-- 6c. Telefones cadastrados nos negócios
INSERT INTO public.whatsapp_identities
  (phone_normalized, restaurant_id, user_id, display_name, status)
SELECT
  public.normalize_phone(r.whatsapp),
  (array_agg(r.id ORDER BY r.created_at))[1],
  (array_agg(r.owner_id ORDER BY r.created_at))[1],
  (array_agg(r.name ORDER BY r.created_at))[1],
  'known'
FROM public.restaurants r
WHERE public.normalize_phone(r.whatsapp) IS NOT NULL
GROUP BY public.normalize_phone(r.whatsapp)
ON CONFLICT (phone_normalized) DO UPDATE
  SET restaurant_id = COALESCE(public.whatsapp_identities.restaurant_id, EXCLUDED.restaurant_id),
      user_id = COALESCE(public.whatsapp_identities.user_id, EXCLUDED.user_id),
      display_name = COALESCE(public.whatsapp_identities.display_name, EXCLUDED.display_name),
      updated_at = now();

-- 6d. Completa o usuário a partir do dono do negócio e marca verificados
UPDATE public.whatsapp_identities i
SET user_id = r.owner_id, updated_at = now()
FROM public.restaurants r
WHERE i.restaurant_id = r.id AND i.user_id IS NULL;

UPDATE public.whatsapp_identities
SET status = 'verified', verified_at = COALESCE(verified_at, now()), updated_at = now()
WHERE user_id IS NOT NULL AND restaurant_id IS NOT NULL AND status = 'known';

-- 6e. Marca conflito quando o mesmo telefone aparece em mais de um negócio
UPDATE public.whatsapp_identities i
SET has_conflict = true,
    conflict_note = 'telefone cadastrado em mais de um negócio',
    updated_at = now()
WHERE (
  SELECT count(DISTINCT r.id) FROM public.restaurants r
  WHERE public.normalize_phone(r.whatsapp) = i.phone_normalized
) > 1;

-- 6f. Registro do inventário na auditoria
INSERT INTO public.audit_log (actor_kind, action, entity, origin, note, after_data)
SELECT 'system', 'inventory.import', 'whatsapp_identities', 'system',
       'importação inicial de telefones existentes (nenhum dado apagado)',
       jsonb_build_object('identities', (SELECT count(*) FROM public.whatsapp_identities));