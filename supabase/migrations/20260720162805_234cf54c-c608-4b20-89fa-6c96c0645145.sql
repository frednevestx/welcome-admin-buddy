DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE c.relkind='r' AND ns.nspname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.n);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.n);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;