ALTER TABLE public.categories
  ADD COLUMN color text NOT NULL DEFAULT '#2F6B4F',
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_color_palette_check CHECK (color IN (
    '#2F6B4F','#C49A3A','#2F7D8C','#8A5A44','#6B7280',
    '#B45309','#9F3A4A','#4F6D7A','#647A3C','#7C5C8E'
  ));

ALTER TABLE public.categories DROP CONSTRAINT categories_restaurant_id_name_key;

CREATE UNIQUE INDEX categories_active_restaurant_type_name_key
  ON public.categories (restaurant_id, movement_type, lower(name))
  NULLS NOT DISTINCT
  WHERE archived_at IS NULL;

WITH inferred AS (
  SELECT c.id, min(m.type)::text::public.movement_type AS inferred_type
  FROM public.categories c
  JOIN public.movements m ON m.category_id = c.id
  WHERE c.movement_type IS NULL
  GROUP BY c.id
  HAVING count(DISTINCT m.type) = 1
)
UPDATE public.categories c
SET movement_type = inferred.inferred_type
FROM inferred
WHERE c.id = inferred.id;

CREATE OR REPLACE FUNCTION public.seed_default_categories(_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  existing_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id) THEN
    RAISE EXCEPTION 'negócio não encontrado';
  END IF;

  FOR item IN
    SELECT * FROM (VALUES
      ('Fornecedores',       'saida'::public.movement_type,  false, '#2F6B4F'),
      ('Mercadoria/Insumos', 'saida'::public.movement_type,  false, '#C49A3A'),
      ('Aluguel',            'saida'::public.movement_type,  false, '#2F7D8C'),
      ('Funcionários',       'saida'::public.movement_type,  false, '#8A5A44'),
      ('Impostos e taxas',   'saida'::public.movement_type,  false, '#6B7280'),
      ('Contas',             'saida'::public.movement_type,  false, '#B45309'),
      ('Gás',                'saida'::public.movement_type,  false, '#9F3A4A'),
      ('Transporte',         'saida'::public.movement_type,  false, '#4F6D7A'),
      ('Marketing',          'saida'::public.movement_type,  false, '#647A3C'),
      ('Outros',             'saida'::public.movement_type,  true,  '#7C5C8E'),
      ('Vendas',             'entrada'::public.movement_type,false, '#2F6B4F'),
      ('Outras entradas',    'entrada'::public.movement_type,true,  '#C49A3A')
    ) AS defaults(name, movement_type, is_system, color)
  LOOP
    SELECT c.id INTO existing_id
    FROM public.categories c
    WHERE c.restaurant_id = _restaurant_id
      AND c.archived_at IS NULL
      AND lower(c.name) = lower(item.name)
      AND (c.movement_type IS NULL OR c.movement_type = item.movement_type)
    ORDER BY (c.movement_type = item.movement_type) DESC, c.created_at, c.id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE public.categories
      SET movement_type = item.movement_type,
          is_default = true,
          is_system = item.is_system
      WHERE id = existing_id;
    ELSE
      INSERT INTO public.categories (
        restaurant_id, name, movement_type, is_default, is_system, color
      ) VALUES (
        _restaurant_id, item.name, item.movement_type, true, item.is_system, item.color
      );
    END IF;

    existing_id := NULL;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_default_categories(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_categories(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.seed_categories_after_restaurant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.seed_default_categories(NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_categories_after_restaurant_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_categories_after_restaurant_insert() TO service_role;

CREATE TRIGGER seed_categories_after_restaurant_insert
AFTER INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.seed_categories_after_restaurant_insert();

DO $seed_existing$
DECLARE business record;
BEGIN
  FOR business IN SELECT id FROM public.restaurants LOOP
    PERFORM public.seed_default_categories(business.id);
  END LOOP;
END;
$seed_existing$;

CREATE OR REPLACE FUNCTION public.validate_movement_category_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  selected_category public.categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id
     AND NEW.type IS NOT DISTINCT FROM OLD.type THEN
    RETURN NEW;
  END IF;

  SELECT * INTO selected_category FROM public.categories WHERE id = NEW.category_id;
  IF selected_category.id IS NULL THEN RAISE EXCEPTION 'categoria não encontrada'; END IF;
  IF selected_category.restaurant_id <> NEW.restaurant_id THEN RAISE EXCEPTION 'categoria pertence a outro negócio'; END IF;
  IF selected_category.archived_at IS NOT NULL THEN RAISE EXCEPTION 'categoria arquivada não pode ser atribuída'; END IF;
  IF selected_category.movement_type IS NOT NULL AND selected_category.movement_type <> NEW.type THEN
    RAISE EXCEPTION 'categoria incompatível com o tipo do lançamento';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_movement_category_assignment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_movement_category_assignment() TO service_role;

CREATE TRIGGER validate_movement_category_assignment
BEFORE INSERT OR UPDATE OF category_id, type ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.validate_movement_category_assignment();

CREATE OR REPLACE FUNCTION public.protect_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system AND NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
      RAISE EXCEPTION 'categoria de sistema não pode ser arquivada';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = OLD.restaurant_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'categorias não podem ser excluídas fisicamente; arquive a categoria';
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_categories() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_categories() TO service_role;

CREATE TRIGGER protect_categories
BEFORE UPDATE OF archived_at OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.protect_categories();

CREATE OR REPLACE FUNCTION public.filter_movements(
  _restaurant_id uuid,
  _from timestamptz,
  _to timestamptz,
  _type public.movement_type DEFAULT NULL,
  _category_ids uuid[] DEFAULT NULL,
  _include_uncategorized boolean DEFAULT false,
  _search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, restaurant_id uuid, type public.movement_type,
  category_id uuid, category_name text, supplier_id uuid, supplier_name text,
  description text, amount numeric, movement_date date, payment_method text,
  notes text, origin public.data_origin, status text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT m.id, m.restaurant_id, m.type, m.category_id, c.name,
         m.supplier_id, s.name, m.description, m.amount, m.movement_date,
         m.payment_method, m.notes, m.origin, m.status, m.created_at
  FROM public.movements m
  LEFT JOIN public.categories c ON c.id = m.category_id AND c.restaurant_id = m.restaurant_id
  LEFT JOIN public.suppliers s ON s.id = m.supplier_id AND s.restaurant_id = m.restaurant_id
  WHERE m.restaurant_id = _restaurant_id
    AND m.status = 'active'
    AND m.superseded_by IS NULL
    AND m.movement_date >= (_from AT TIME ZONE 'America/Sao_Paulo')::date
    AND m.movement_date <= (_to AT TIME ZONE 'America/Sao_Paulo')::date
    AND (_type IS NULL OR m.type = _type)
    AND (_category_ids IS NULL OR m.category_id = ANY(_category_ids) OR (_include_uncategorized AND m.category_id IS NULL))
    AND (NULLIF(btrim(_search), '') IS NULL OR m.description ILIKE '%' || btrim(_search) || '%' OR s.name ILIKE '%' || btrim(_search) || '%')
  ORDER BY m.movement_date DESC, m.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.filter_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filter_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text) TO authenticated, service_role;

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
    COALESCE(sum(f.amount) FILTER (WHERE f.type = 'entrada'), 0)::numeric,
    COALESCE(sum(f.amount) FILTER (WHERE f.type = 'saida'), 0)::numeric,
    (COALESCE(sum(f.amount) FILTER (WHERE f.type = 'entrada'), 0) - COALESCE(sum(f.amount) FILTER (WHERE f.type = 'saida'), 0))::numeric
  FROM public.filter_movements(_restaurant_id, _from, _to, _type, _category_ids, _include_uncategorized, _search) f
  WHERE f.type IN ('entrada', 'saida');
$function$;

REVOKE ALL ON FUNCTION public.summarize_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.summarize_movements(uuid,timestamptz,timestamptz,public.movement_type,uuid[],boolean,text) TO authenticated, service_role;