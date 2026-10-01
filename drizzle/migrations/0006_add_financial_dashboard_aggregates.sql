CREATE OR REPLACE FUNCTION public.dashboard_cashflow_series(
  _restaurant_id uuid,
  _from date,
  _to date
)
RETURNS TABLE(period_date date, entradas numeric, saidas numeric, resultado numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.movement_date AS period_date,
         COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'entrada'), 0)::numeric AS entradas,
         COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'saida'), 0)::numeric AS saidas,
         (COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'entrada'), 0) -
          COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'saida'), 0))::numeric AS resultado
  FROM public.movements m
  WHERE m.restaurant_id = _restaurant_id
    AND m.status = 'active'
    AND m.movement_date BETWEEN _from AND _to
  GROUP BY m.movement_date
  ORDER BY m.movement_date;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_cashflow_series(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_cashflow_series(uuid, date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_category_comparison(
  _restaurant_id uuid,
  _from date,
  _to date,
  _previous_from date,
  _previous_to date
)
RETURNS TABLE(category_id uuid, category_name text, category_color text, current_amount numeric, previous_amount numeric, uncategorized boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH category_totals AS (
    SELECT m.category_id,
           COALESCE(c.name, 'Sem categoria') AS category_name,
           c.color AS category_color,
           COALESCE(SUM(m.amount) FILTER (WHERE m.movement_date BETWEEN _from AND _to), 0)::numeric AS current_amount,
           COALESCE(SUM(m.amount) FILTER (WHERE m.movement_date BETWEEN _previous_from AND _previous_to), 0)::numeric AS previous_amount
    FROM public.movements m
    LEFT JOIN public.categories c
      ON c.id = m.category_id
     AND c.restaurant_id = m.restaurant_id
    WHERE m.restaurant_id = _restaurant_id
      AND m.status = 'active'
      AND m.type = 'saida'
      AND m.movement_date BETWEEN _previous_from AND _to
    GROUP BY m.category_id, c.name, c.color
  )
  SELECT category_id, category_name, category_color, current_amount, previous_amount, category_id IS NULL AS uncategorized
  FROM category_totals
  ORDER BY current_amount DESC, category_name;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_category_comparison(uuid, date, date, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_category_comparison(uuid, date, date, date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_supplier_summary(
  _restaurant_id uuid,
  _from date,
  _to date
)
RETURNS TABLE(supplier_id uuid, supplier_name text, total numeric, purchases bigint, average_ticket numeric, last_purchase date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id AS supplier_id,
         s.name AS supplier_name,
         COALESCE(SUM(m.amount), 0)::numeric AS total,
         COUNT(*)::bigint AS purchases,
         COALESCE(AVG(m.amount), 0)::numeric AS average_ticket,
         MAX(m.movement_date)::date AS last_purchase
  FROM public.movements m
  JOIN public.suppliers s
    ON s.id = m.supplier_id
   AND s.restaurant_id = m.restaurant_id
  WHERE m.restaurant_id = _restaurant_id
    AND m.status = 'active'
    AND m.type = 'saida'
    AND m.movement_date BETWEEN _from AND _to
  GROUP BY s.id, s.name
  ORDER BY total DESC, s.name;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_supplier_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_supplier_summary(uuid, date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_payable_paid(
  _payable_id uuid,
  _payment_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  payable_row public.payables%ROWTYPE;
  movement_id uuid;
  caller_id uuid := auth.uid();
BEGIN
  SELECT * INTO payable_row
  FROM public.payables
  WHERE id = _payable_id
    AND restaurant_id = public.current_restaurant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada.';
  END IF;

  IF payable_row.status = 'paid' AND payable_row.paid_movement_id IS NOT NULL THEN
    RETURN payable_row.paid_movement_id;
  END IF;

  INSERT INTO public.movements (
    restaurant_id, type, supplier_id, description, amount, movement_date,
    created_by, origin, status, confirmed_by_user, expense_kind
  ) VALUES (
    payable_row.restaurant_id, 'saida', payable_row.supplier_id,
    payable_row.description, payable_row.amount, _payment_date,
    caller_id, 'manual', 'active', true, 'despesa'
  ) RETURNING id INTO movement_id;

  UPDATE public.payables
  SET status = 'paid', paid_movement_id = movement_id, updated_at = now()
  WHERE id = payable_row.id;

  INSERT INTO public.audit_log (
    actor_user_id, actor_kind, action, entity, entity_id, restaurant_id,
    origin, before_data, after_data, note
  ) VALUES (
    caller_id, 'user', 'pay_payable', 'payables', payable_row.id::text,
    payable_row.restaurant_id, 'web',
    jsonb_build_object('status', payable_row.status, 'paid_movement_id', payable_row.paid_movement_id),
    jsonb_build_object('status', 'paid', 'paid_movement_id', movement_id),
    'Conta quitada pelo painel web'
  );

  RETURN movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payable_paid(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payable_paid(uuid, date) TO service_role;