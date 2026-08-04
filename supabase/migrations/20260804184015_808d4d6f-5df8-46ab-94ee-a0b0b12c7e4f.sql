-- ENUMS
CREATE TYPE public.integration_provider AS ENUM ('ifood','99food','rappi','consumer','saipos','goomer','cardapioweb','open_finance');
CREATE TYPE public.integration_status AS ENUM ('disconnected','connecting','connected','error','expired');
CREATE TYPE public.data_origin AS ENUM ('automatico','manual','ajuste','importado');
CREATE TYPE public.sync_kind AS ENUM ('historico','incremental','webhook','manual');
CREATE TYPE public.sync_status AS ENUM ('running','success','error');

-- INTEGRATIONS
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  external_merchant_id text,
  external_merchant_name text,
  scopes text[] NOT NULL DEFAULT '{}',
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  orders_synced integer NOT NULL DEFAULT 0,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, provider)
);

GRANT SELECT ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_select_own" ON public.integrations FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id());
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SYNC LOGS
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  kind public.sync_kind NOT NULL,
  status public.sync_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_processed integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_logs_select_own" ON public.sync_logs FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id());
CREATE INDEX sync_logs_integration_idx ON public.sync_logs (integration_id, started_at DESC);

-- ORDERS IMPORTED (read-only for users)
CREATE TABLE public.orders_imported (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider public.integration_provider NOT NULL,
  external_order_id text NOT NULL,
  order_number text,
  ordered_at timestamptz NOT NULL,
  order_date date NOT NULL,
  order_hour smallint,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_count integer NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  marketing_fee numeric NOT NULL DEFAULT 0,
  other_fees numeric NOT NULL DEFAULT 0,
  coupons numeric NOT NULL DEFAULT 0,
  cancellation_amount numeric NOT NULL DEFAULT 0,
  is_cancelled boolean NOT NULL DEFAULT false,
  payout_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  raw_payload jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, provider, external_order_id)
);

GRANT SELECT ON public.orders_imported TO authenticated;
GRANT ALL ON public.orders_imported TO service_role;
ALTER TABLE public.orders_imported ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_imported_select_own" ON public.orders_imported FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id());
CREATE INDEX orders_imported_date_idx ON public.orders_imported (restaurant_id, order_date DESC);

-- FINANCIAL ADJUSTMENTS
CREATE TABLE public.financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  field text,
  original_value numeric,
  adjusted_value numeric,
  delta_amount numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.financial_adjustments TO authenticated;
GRANT ALL ON public.financial_adjustments TO service_role;
ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adjustments_select_own" ON public.financial_adjustments FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "adjustments_insert_own" ON public.financial_adjustments FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = public.current_restaurant_id() AND created_by = auth.uid());
CREATE TRIGGER financial_adjustments_updated_at BEFORE UPDATE ON public.financial_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AI INSIGHTS
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reference_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  impact_amount numeric,
  severity text NOT NULL DEFAULT 'info',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_insights_select_own" ON public.ai_insights FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id());
CREATE INDEX ai_insights_date_idx ON public.ai_insights (restaurant_id, reference_date DESC);

-- FINANCIAL METRICS
CREATE TABLE public.financial_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  revenue_auto numeric NOT NULL DEFAULT 0,
  revenue_manual numeric NOT NULL DEFAULT 0,
  cost_auto numeric NOT NULL DEFAULT 0,
  cost_manual numeric NOT NULL DEFAULT 0,
  gross_profit numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  margin_pct numeric NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  average_ticket numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, metric_date)
);

GRANT SELECT ON public.financial_metrics TO authenticated;
GRANT ALL ON public.financial_metrics TO service_role;
ALTER TABLE public.financial_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_metrics_select_own" ON public.financial_metrics FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id());

-- ORIGIN ON EXISTING TABLES
ALTER TABLE public.movements
  ADD COLUMN origin public.data_origin NOT NULL DEFAULT 'manual',
  ADD COLUMN source_ref text,
  ADD COLUMN integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN origin public.data_origin NOT NULL DEFAULT 'manual',
  ADD COLUMN source_ref text,
  ADD COLUMN integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL;

UPDATE public.sales SET origin = 'importado' WHERE import_id IS NOT NULL;