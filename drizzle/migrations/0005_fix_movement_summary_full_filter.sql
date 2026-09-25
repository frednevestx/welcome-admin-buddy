CREATE OR REPLACE FUNCTION public.summarize_movements(
  _restaurant_id uuid,
  _from timestamptz,
  _to timestamptz,
  _type public.movement_type DEFAULT NULL,
  _category_ids uuid[] DEFAULT NULL,
  _include_uncategorized boolean DEFAULT false,
  _search text DEFAULT NULL
)
RETURNS TABLE (entradas numeric, saidas numeric, resultado numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(sum(m.amount) FILTER (WHERE m.type = 'entrada'), 0)::numeric,
    COALESCE(sum(m.amount) FILTER (WHERE m.type = 'saida'), 0)::numeric,
    (COALESCE(sum(m.amount) FILTER (WHERE m.type = 'entrada'), 0) - COALESCE(sum(m.amount) FILTER (WHERE m.type = 'saida'), 0))::numeric
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
    AND m.type IN ('entrada', 'saida');
$function$;

REVOKE ALL ON FUNCTION public.summarize_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.summarize_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text) TO authenticated, service_role;