CREATE OR REPLACE FUNCTION public.filter_movements(
  _restaurant_id uuid,
  _from timestamptz,
  _to timestamptz,
  _type public.movement_type DEFAULT NULL,
  _category_ids uuid[] DEFAULT NULL,
  _include_uncategorized boolean DEFAULT false,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, restaurant_id uuid, type public.movement_type,
  category_id uuid, category_name text, category_color text, category_archived_at timestamptz,
  supplier_id uuid, supplier_name text, description text, amount numeric,
  movement_date date, payment_method text, notes text, origin public.data_origin,
  status text, created_at timestamptz, created_from_event_id uuid,
  integration_id uuid, is_fixed boolean, source_ref text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT m.id, m.restaurant_id, m.type, m.category_id, c.name, c.color, c.archived_at,
         m.supplier_id, s.name, m.description, m.amount, m.movement_date,
         m.payment_method, m.notes, m.origin, m.status, m.created_at,
         m.created_from_event_id, m.integration_id, m.is_fixed, m.source_ref
  FROM public.movements m
  LEFT JOIN public.categories c ON c.id = m.category_id AND c.restaurant_id = m.restaurant_id
  LEFT JOIN public.suppliers s ON s.id = m.supplier_id AND s.restaurant_id = m.restaurant_id
  WHERE m.restaurant_id = _restaurant_id
    AND m.status = 'active'
    AND m.superseded_by IS NULL
    AND m.movement_date >= (_from AT TIME ZONE 'America/Sao_Paulo')::date
    AND m.movement_date <= (_to AT TIME ZONE 'America/Sao_Paulo')::date
    AND (_type IS NULL OR m.type = _type)
    AND (
      (_category_ids IS NULL AND NOT _include_uncategorized)
      OR (_category_ids IS NOT NULL AND m.category_id = ANY(_category_ids))
      OR (_include_uncategorized AND m.category_id IS NULL)
    )
    AND (NULLIF(btrim(_search), '') IS NULL OR m.description ILIKE '%' || btrim(_search) || '%' OR s.name ILIKE '%' || btrim(_search) || '%')
  ORDER BY m.movement_date DESC, m.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 1000))
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.filter_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filter_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text,integer,integer) TO authenticated, service_role;