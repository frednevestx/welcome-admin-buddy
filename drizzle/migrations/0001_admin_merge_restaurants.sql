CREATE OR REPLACE FUNCTION public.admin_merge_restaurants(
  _source_id uuid,
  _target_id uuid,
  _actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source public.restaurants%ROWTYPE;
  v_target public.restaurants%ROWTYPE;
  v_source_email text;
  v_target_email text;
  v_phone text;
  v_identity_count integer;
  v_moved_movements integer;
  v_moved_sessions integer;
  v_moved_identities integer;
BEGIN
  IF NOT public.has_role(_actor_user_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  IF _source_id = _target_id THEN
    RAISE EXCEPTION 'Origem e destino devem ser diferentes.';
  END IF;

  SELECT * INTO v_source
  FROM public.restaurants
  WHERE id = _source_id
  FOR UPDATE;

  SELECT * INTO v_target
  FROM public.restaurants
  WHERE id = _target_id
  FOR UPDATE;

  IF v_source.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'Negócio de origem ou destino não encontrado.';
  END IF;

  IF v_source.archived_at IS NOT NULL OR v_target.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'A mesclagem exige dois negócios ativos.';
  END IF;

  SELECT email INTO v_source_email FROM auth.users WHERE id = v_source.owner_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = v_target.owner_id;

  IF COALESCE(v_source_email, '') !~ '^wa[0-9]+@luud[.]app$' THEN
    RAISE EXCEPTION 'A origem precisa ser um negócio criado pelo WhatsApp.';
  END IF;

  IF COALESCE(v_target_email, '') ~ '^wa[0-9]+@luud[.]app$' THEN
    RAISE EXCEPTION 'O destino precisa ser uma conta real existente.';
  END IF;

  SELECT count(*), min(phone_normalized)
    INTO v_identity_count, v_phone
  FROM public.whatsapp_identities
  WHERE restaurant_id = _source_id;

  IF v_identity_count <> 1 OR v_phone IS NULL THEN
    RAISE EXCEPTION 'A origem precisa ter exatamente uma identidade WhatsApp vinculada.';
  END IF;

  IF v_target.whatsapp IS NOT NULL
     AND public.normalize_phone(v_target.whatsapp) IS DISTINCT FROM public.normalize_phone(v_phone) THEN
    RAISE EXCEPTION 'O destino já possui outro WhatsApp vinculado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.whatsapp_identities
    WHERE restaurant_id = _target_id
      AND phone_normalized IS DISTINCT FROM v_phone
  ) THEN
    RAISE EXCEPTION 'O destino já possui uma identidade WhatsApp incompatível.';
  END IF;

  UPDATE public.movements
  SET restaurant_id = _target_id
  WHERE restaurant_id = _source_id;
  GET DIAGNOSTICS v_moved_movements = ROW_COUNT;

  UPDATE public.whatsapp_identities
  SET restaurant_id = _target_id,
      user_id = v_target.owner_id,
      status = 'verified',
      verified_at = COALESCE(verified_at, now()),
      has_conflict = false,
      conflict_note = NULL,
      updated_at = now()
  WHERE restaurant_id = _source_id;
  GET DIAGNOSTICS v_moved_identities = ROW_COUNT;

  UPDATE public.whatsapp_sessions
  SET restaurant_id = _target_id,
      updated_at = now()
  WHERE restaurant_id = _source_id OR public.normalize_phone(phone) = public.normalize_phone(v_phone);
  GET DIAGNOSTICS v_moved_sessions = ROW_COUNT;

  UPDATE public.restaurants
  SET whatsapp = COALESCE(whatsapp, v_phone),
      updated_at = now()
  WHERE id = _target_id;

  UPDATE public.profiles
  SET restaurant_id = _target_id,
      updated_at = now()
  WHERE id = v_target.owner_id;

  UPDATE public.restaurants
  SET archived_at = now(),
      updated_at = now()
  WHERE id = _source_id;

  INSERT INTO public.audit_log (
    actor_user_id,
    actor_kind,
    actor_phone,
    action,
    entity,
    entity_id,
    restaurant_id,
    origin,
    before_data,
    after_data,
    note
  ) VALUES (
    _actor_user_id,
    'admin',
    v_phone,
    'business.merged',
    'restaurant',
    _source_id::text,
    _target_id,
    'admin',
    jsonb_build_object(
      'source_id', _source_id,
      'source_name', v_source.name,
      'source_owner_id', v_source.owner_id,
      'source_owner_email', v_source_email,
      'source_whatsapp', v_source.whatsapp
    ),
    jsonb_build_object(
      'target_id', _target_id,
      'target_name', v_target.name,
      'target_owner_id', v_target.owner_id,
      'target_owner_email', v_target_email,
      'whatsapp', v_phone,
      'movements_moved', v_moved_movements,
      'identities_moved', v_moved_identities,
      'sessions_moved', v_moved_sessions,
      'source_archived', true
    ),
    'Mesclagem administrativa sem exclusão física; reversão somente por auditoria.'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'source_id', _source_id,
    'target_id', _target_id,
    'movements_moved', v_moved_movements,
    'identities_moved', v_moved_identities,
    'sessions_moved', v_moved_sessions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merge_restaurants(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_merge_restaurants(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_merge_restaurants(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_restaurants(uuid, uuid, uuid) TO service_role;