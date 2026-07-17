
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT restaurant_id FROM public.profiles WHERE id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.current_restaurant_id() FROM PUBLIC, anon;

CREATE POLICY "Members can view their restaurant" ON public.restaurants
  FOR SELECT TO authenticated USING (id = public.current_restaurant_id() OR owner_id = auth.uid());
CREATE POLICY "Users can create restaurants" ON public.restaurants
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their restaurant" ON public.restaurants
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can delete their restaurant" ON public.restaurants
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  products TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TYPE public.movement_type AS ENUM ('compra', 'despesa');
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type public.movement_type NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX movements_rest_date_idx ON public.movements(restaurant_id, movement_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage movements" ON public.movements
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TYPE public.sale_source AS ENUM ('ifood', '99food', 'loja', 'whatsapp');
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source public.sale_source NOT NULL,
  sale_date DATE NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  marketing_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupons NUMERIC(12,2) NOT NULL DEFAULT 0,
  cancellations NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  import_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, source, sale_date)
);
CREATE INDEX sales_rest_date_idx ON public.sales(restaurant_id, sale_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage sales" ON public.sales
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TABLE public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source public.sale_source NOT NULL,
  filename TEXT NOT NULL,
  file_hash TEXT,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT ALL ON public.imports TO service_role;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage imports" ON public.imports
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE OR REPLACE FUNCTION public.seed_default_categories(_restaurant_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cat TEXT;
  defaults TEXT[] := ARRAY[
    'Carne','Massa','Acompanhamentos','Bebidas','Embalagens',
    'Temperos e Condimentos','Itens Diversos','Funcionários','Energia',
    'Água','Gás','Aluguel','Marketing','Limpeza','Internet','Impostos',
    'Contabilidade','Outros'
  ];
BEGIN
  FOREACH cat IN ARRAY defaults LOOP
    INSERT INTO public.categories (restaurant_id, name, is_default)
    VALUES (_restaurant_id, cat, true) ON CONFLICT (restaurant_id, name) DO NOTHING;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_default_categories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_categories(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.goal_period AS ENUM ('diaria','semanal','mensal');
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  period public.goal_period NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX goals_rest_active_idx ON public.goals(restaurant_id, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage goals" ON public.goals
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cmv_settings (
  restaurant_id UUID PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  target_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00 CHECK (target_percent > 0 AND target_percent < 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmv_settings TO authenticated;
GRANT ALL ON public.cmv_settings TO service_role;
ALTER TABLE public.cmv_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage cmv" ON public.cmv_settings
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  current_price NUMERIC(12,4) NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage ingredients" ON public.ingredients
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX price_history_ing_date_idx ON public.price_history(ingredient_id, purchase_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage price history" ON public.price_history
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TABLE public.wastages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'un',
  reason TEXT,
  lost_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  wastage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wastages_rest_date_idx ON public.wastages(restaurant_id, wastage_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wastages TO authenticated;
GRANT ALL ON public.wastages TO service_role;
ALTER TABLE public.wastages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage wastages" ON public.wastages
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.plan_tier AS ENUM ('basico', 'pro', 'premium');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'expired', 'canceled');
CREATE TYPE public.billing_cycle AS ENUM ('mensal', 'semestral', 'anual');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'premium',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle public.billing_cycle,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text NOT NULL DEFAULT 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS public.plan_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN s.status = 'trialing' AND s.trial_ends_at > now() THEN 'premium'::public.plan_tier
    WHEN s.status = 'active' THEN s.plan
    ELSE 'basico'::public.plan_tier
  END
  FROM public.subscriptions s WHERE s.user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_plan(_user_id uuid, _min public.plan_tier)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _min
    WHEN 'basico'  THEN true
    WHEN 'pro'     THEN public.effective_plan(_user_id) IN ('pro','premium')
    WHEN 'premium' THEN public.effective_plan(_user_id) = 'premium'
  END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'premium', 'trialing', now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  IF lower(NEW.email) = 'frednevestx@live.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at)
SELECT id, 'premium', 'trialing', now() + interval '7 days'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'frednevestx@live.com'
ON CONFLICT (user_id, role) DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_plan(uuid, public.plan_tier) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.my_effective_plan()
RETURNS public.plan_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.effective_plan(auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.my_effective_plan() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_effective_plan() FROM PUBLIC, anon;

CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.checkout_settings (
  plan public.plan_tier NOT NULL,
  cycle public.billing_cycle NOT NULL,
  url text NOT NULL DEFAULT '',
  discount_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, cycle)
);
GRANT SELECT ON public.checkout_settings TO authenticated, anon;
GRANT ALL ON public.checkout_settings TO service_role;
ALTER TABLE public.checkout_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read checkout settings" ON public.checkout_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage checkout settings" ON public.checkout_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.checkout_settings (plan, cycle, discount_label) VALUES
  ('basico',  'mensal',    NULL),
  ('basico',  'semestral', 'Economize 10%'),
  ('basico',  'anual',     'Economize 16%'),
  ('pro',     'mensal',    NULL),
  ('pro',     'semestral', 'Economize 10%'),
  ('pro',     'anual',     'Economize 16%'),
  ('premium', 'mensal',    NULL),
  ('premium', 'semestral', 'Economize 10%'),
  ('premium', 'anual',     'Economize 16%')
ON CONFLICT (plan, cycle) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_grant_plan_by_email(
  _email text, _plan public.plan_tier, _days integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _period_end timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _days IS NULL OR _days <= 0 THEN RAISE EXCEPTION 'invalid duration'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  _period_end := now() + make_interval(days => _days);
  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end, provider)
  VALUES (_uid, _plan, 'active', _period_end, 'manual')
  ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan, status = 'active',
        current_period_end = EXCLUDED.current_period_end,
        provider = 'manual', updated_at = now();
  RETURN _uid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_plan_by_email(text, public.plan_tier, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_plan_by_email(text, public.plan_tier, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_plan(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.subscriptions
  SET plan = 'basico', status = 'canceled', current_period_end = now(), updated_at = now()
  WHERE user_id = _user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_plan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_extend_plan(_user_id uuid, _days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _days IS NULL OR _days <= 0 THEN RAISE EXCEPTION 'invalid duration'; END IF;
  UPDATE public.subscriptions
  SET current_period_end = COALESCE(current_period_end, now()) + make_interval(days => _days),
      status = 'active', updated_at = now()
  WHERE user_id = _user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_extend_plan(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_extend_plan(uuid, integer) TO authenticated;
