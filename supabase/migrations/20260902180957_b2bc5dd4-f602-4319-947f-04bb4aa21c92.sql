-- whatsapp_raw_events
ALTER TABLE public.whatsapp_raw_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.whatsapp_raw_events TO authenticated;
GRANT ALL ON public.whatsapp_raw_events TO service_role;
CREATE POLICY "Dono lê eventos do próprio negócio"
  ON public.whatsapp_raw_events FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.has_role(auth.uid(), 'admin'));

-- conversation_state
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.conversation_state TO service_role;
CREATE POLICY "Admins leem estado de conversa"
  ON public.conversation_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- insights
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;
CREATE POLICY "Dono lê insights do próprio negócio"
  ON public.insights FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.has_role(auth.uid(), 'admin'));

-- view de movimentações ativas: passa a respeitar o RLS de quem consulta
ALTER VIEW public.movements_current SET (security_invoker = true);