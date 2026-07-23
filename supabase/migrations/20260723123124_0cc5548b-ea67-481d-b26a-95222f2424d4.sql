
-- 1) Swap enum movement_type
CREATE TYPE public.movement_type_new AS ENUM ('entrada','saida','transferencia');

ALTER TABLE public.movements
  ALTER COLUMN type TYPE public.movement_type_new
  USING (
    CASE type::text
      WHEN 'compra' THEN 'saida'
      WHEN 'despesa' THEN 'saida'
      ELSE 'saida'
    END
  )::public.movement_type_new;

DROP TYPE public.movement_type;
ALTER TYPE public.movement_type_new RENAME TO movement_type;

-- 2) Add movement_type on categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS movement_type public.movement_type;

-- 3) Replace default seed function with typed categories
CREATE OR REPLACE FUNCTION public.seed_default_categories(_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  entradas TEXT[] := ARRAY['Venda WhatsApp','Venda Balcão','Outros Recebimentos'];
  saidas   TEXT[] := ARRAY['Ingredientes','Embalagens','Funcionários','Aluguel','Energia','Marketing','Impostos','Taxas Bancárias','Manutenção','Outros'];
  transf   TEXT[] := ARRAY['Sangria de Caixa'];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY entradas LOOP
    INSERT INTO public.categories (restaurant_id, name, is_default, movement_type)
    VALUES (_restaurant_id, cat, true, 'entrada')
    ON CONFLICT (restaurant_id, name) DO UPDATE SET movement_type = EXCLUDED.movement_type;
  END LOOP;
  FOREACH cat IN ARRAY saidas LOOP
    INSERT INTO public.categories (restaurant_id, name, is_default, movement_type)
    VALUES (_restaurant_id, cat, true, 'saida')
    ON CONFLICT (restaurant_id, name) DO UPDATE SET movement_type = EXCLUDED.movement_type;
  END LOOP;
  FOREACH cat IN ARRAY transf LOOP
    INSERT INTO public.categories (restaurant_id, name, is_default, movement_type)
    VALUES (_restaurant_id, cat, true, 'transferencia')
    ON CONFLICT (restaurant_id, name) DO UPDATE SET movement_type = EXCLUDED.movement_type;
  END LOOP;
END;
$function$;

-- 4) Backfill: seed defaults for every existing restaurant
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.restaurants LOOP
    PERFORM public.seed_default_categories(r.id);
  END LOOP;
END $$;

-- 5) Legacy uncategorized rows: leave movement_type NULL (usuário escolhe depois).
