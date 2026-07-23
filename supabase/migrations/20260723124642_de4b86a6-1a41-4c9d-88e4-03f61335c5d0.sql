
CREATE TABLE public.pedidos_manuais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  descricao text,
  cliente text,
  telefone text,
  cidade text,
  quantidade numeric(12,2),
  valor numeric(12,2),
  forma_pagamento text,
  pedido_data date,
  observacao text,
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pedidos_manuais_rest_date_idx ON public.pedidos_manuais(restaurant_id, pedido_data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_manuais TO authenticated;
GRANT ALL ON public.pedidos_manuais TO service_role;

ALTER TABLE public.pedidos_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage pedidos_manuais"
ON public.pedidos_manuais FOR ALL TO authenticated
USING (restaurant_id = public.current_restaurant_id())
WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TRIGGER pedidos_manuais_updated_at
BEFORE UPDATE ON public.pedidos_manuais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
