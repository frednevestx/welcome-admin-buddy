import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/conversas")({
  component: Conversas,
  head: () => ({
    meta: [
      { title: "Conversas | LUUD" },
      { name: "description", content: "Histórico das mensagens que a LUUD interpretou no seu WhatsApp." },
      { property: "og:title", content: "Conversas | LUUD" },
      { property: "og:description", content: "Veja o que a LUUD entendeu de cada mensagem do WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Conversas() {
  const { restaurant } = useRestaurant();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["conversas", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_raw_events")
        .select("id, created_at, raw_message, classification, linked_movement_id")
        .eq("restaurant_id", restaurant!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Conversas</h1>
        <p className="text-sm text-muted-foreground">
          Tudo o que chegou pelo WhatsApp e como a LUUD interpretou.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas mensagens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conversa registrada ainda.</p>
          )}
          {events.map((e: any) => (
            <div key={e.id} className="rounded-md border border-border/60 px-3 py-2 space-y-1">
              <div className="text-sm">{e.raw_message || "—"}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                {e.classification && (
                  <Badge variant="secondary" className="text-[10px]">
                    {e.classification}
                  </Badge>
                )}
                {e.linked_movement_id && <span>· lançamento criado</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
