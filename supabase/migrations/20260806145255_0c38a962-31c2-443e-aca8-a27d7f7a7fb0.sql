ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_parent_id uuid REFERENCES public.movements(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS movements_fixed_idx ON public.movements (restaurant_id, is_fixed);
CREATE INDEX IF NOT EXISTS movements_source_ref_idx ON public.movements (restaurant_id, source_ref);

-- Categorias novas: Despesa Fixa e Taxa da Plataforma
INSERT INTO public.categories (restaurant_id, name, is_default, movement_type)
SELECT r.id, c.name, true, 'saida'::public.movement_type
FROM public.restaurants r
CROSS JOIN (VALUES ('Despesa Fixa'), ('Taxa da Plataforma')) AS c(name)
ON CONFLICT (restaurant_id, name) DO UPDATE SET movement_type = EXCLUDED.movement_type;

CREATE OR REPLACE FUNCTION public.seed_default_categories(_restaurant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  entradas TEXT[] := ARRAY['Venda WhatsApp','Venda Balcão','Outros Recebimentos'];
  saidas   TEXT[] := ARRAY['Ingredientes','Embalagens','Funcionários','Aluguel','Energia','Marketing','Impostos','Taxas Bancárias','Manutenção','Despesa Fixa','Taxa da Plataforma','Outros'];
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