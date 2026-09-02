import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeriodSelector } from "@/components/period-selector";
import { usePeriod } from "@/hooks/use-period";
import { formatCurrency } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Visão geral | LUUD" },
      { name: "description", content: "Entradas, saídas, resultado e últimos lançamentos do seu negócio." },
      { property: "og:title", content: "Visão geral | LUUD" },
      { property: "og:description", content: "Acompanhe entradas, saídas e resultado do seu negócio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Row {
  id: string;
  type: "entrada" | "saida" | "transferencia";
  amount: number;
  movement_date: string;
  description: string | null;
  origin: string;
  status: string;
  categories: { name: string } | null;
}

function Dashboard() {
  const { restaurant } = useRestaurant();
  const { period, setPeriod, range } = usePeriod();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dash-movements", restaurant?.id, range.from, range.to],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("id, type, amount, movement_date, description, origin, status, categories(name)")
        .eq("restaurant_id", restaurant!.id)
        .eq("status", "active")
        .gte("movement_date", range.from)
        .lte("movement_date", range.to)
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const entradas = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0);
  const saidas = rows.filter((r) => r.type === "saida").reduce((s, r) => s + Number(r.amount), 0);
  const resultado = entradas - saidas;

  const cards = [
    { label: "Entradas", value: entradas, icon: ArrowUpRight, tone: "text-emerald-600" },
    { label: "Saídas", value: saidas, icon: ArrowDownRight, tone: "text-destructive" },
    { label: "Resultado", value: resultado, icon: Wallet, tone: resultado >= 0 ? "text-emerald-600" : "text-destructive" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">
            {restaurant?.name ?? "Seu negócio"} — tudo o que a LUUD registrou no período.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-semibold ${c.tone}`}>{formatCurrency(c.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Últimos lançamentos</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/movimentacoes">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && rows.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-3 py-4">
              <p>Nenhum lançamento no período.</p>
              <p className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Mande uma mensagem no WhatsApp da LUUD: “paguei 120 de gás hoje”.
              </p>
            </div>
          )}
          {rows.slice(0, 12).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.description || "Sem descrição"}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{new Date(r.movement_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                  {r.categories?.name && <span>· {r.categories.name}</span>}
                  <Badge variant="secondary" className="text-[10px]">
                    {r.origin === "automatico" ? "WhatsApp" : r.origin}
                  </Badge>
                </div>
              </div>
              <div
                className={`text-sm font-semibold shrink-0 ${
                  r.type === "entrada" ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {r.type === "entrada" ? "+" : "-"}
                {formatCurrency(Number(r.amount))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
