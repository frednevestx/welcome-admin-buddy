import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { periodFromKey, previousPeriod } from "@/lib/period";
import { formatBRL, formatPct } from "@/lib/format";
import { AlertTriangle, TrendingUp, TrendingDown, Info, PartyPopper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertsPage,
});

interface Alert { icon: React.ReactNode; title: string; description: string; tone: "good" | "bad" | "info"; }

function AlertsPage() {
  const { restaurant } = useRestaurant();

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["alerts", restaurant?.id],
    queryFn: async (): Promise<Alert[]> => {
      const rid = restaurant!.id;
      const cur = periodFromKey("7d");
      const prev = previousPeriod(cur);

      async function agg(from: string, to: string) {
        const [sales, movs] = await Promise.all([
          supabase.from("sales").select("gross_amount").eq("restaurant_id", rid).gte("sale_date", from).lte("sale_date", to),
          supabase.from("movements").select("amount, categories(name)").eq("restaurant_id", rid).gte("movement_date", from).lte("movement_date", to),
        ]);
        const vendido = (sales.data ?? []).reduce((a, s) => a + Number(s.gross_amount || 0), 0);
        const gasto = (movs.data ?? []).reduce((a, m) => a + Number(m.amount || 0), 0);
        const catMap = new Map<string, number>();
        for (const m of movs.data ?? []) {
          const n = (m as any).categories?.name ?? "Sem categoria";
          catMap.set(n, (catMap.get(n) || 0) + Number(m.amount || 0));
        }
        return { vendido, gasto, sobrou: vendido - gasto, catMap };
      }

      const [c, p] = await Promise.all([agg(cur.from, cur.to), agg(prev.from, prev.to)]);
      const alerts: Alert[] = [];

      // Vendas
      if (c.vendido > p.vendido && p.vendido > 0) {
        const pct = ((c.vendido - p.vendido) / p.vendido) * 100;
        alerts.push({ tone: "good", icon: <PartyPopper className="h-4 w-4" />, title: "Você vendeu mais que semana passada!", description: `Aumento de ${formatPct(pct)}. Total vendido: ${formatBRL(c.vendido)}.` });
      } else if (c.vendido < p.vendido && p.vendido > 0) {
        const pct = ((p.vendido - c.vendido) / p.vendido) * 100;
        alerts.push({ tone: "bad", icon: <TrendingDown className="h-4 w-4" />, title: "Vendas caíram esta semana", description: `Queda de ${formatPct(pct)} em relação à semana anterior.` });
      }

      // Sobrou
      if (c.sobrou < p.sobrou) {
        alerts.push({ tone: "bad", icon: <AlertTriangle className="h-4 w-4" />, title: "Sobrou menos dinheiro", description: `Você fechou a semana com ${formatBRL(c.sobrou)} contra ${formatBRL(p.sobrou)} da semana anterior.` });
      } else if (c.sobrou > p.sobrou) {
        alerts.push({ tone: "good", icon: <TrendingUp className="h-4 w-4" />, title: "Sobrou mais dinheiro", description: `${formatBRL(c.sobrou)} nesta semana.` });
      }

      // Categorias com aumento
      for (const [name, val] of c.catMap.entries()) {
        const prevVal = p.catMap.get(name) ?? 0;
        if (val > prevVal * 1.2 && prevVal > 0) {
          const pct = ((val - prevVal) / prevVal) * 100;
          alerts.push({ tone: "info", icon: <TrendingUp className="h-4 w-4" />, title: `Gastos com ${name} aumentaram`, description: `${formatPct(pct)} a mais que semana anterior (${formatBRL(val)}).` });
        }
      }

      // Maior gasto
      if (c.catMap.size > 0) {
        const top = Array.from(c.catMap.entries()).sort((a, b) => b[1] - a[1])[0];
        alerts.push({ tone: "info", icon: <Info className="h-4 w-4" />, title: `Seu maior gasto é ${top[0]}`, description: `${formatBRL(top[1])} nesta semana.` });
      }

      if (alerts.length === 0) {
        alerts.push({ tone: "info", icon: <Info className="h-4 w-4" />, title: "Ainda não há alertas", description: "Cadastre movimentações e importe vendas para gerar alertas inteligentes." });
      }
      return alerts;
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-sm text-muted-foreground mt-1">O que mudou na sua semana.</p>
      </div>
      <div className="space-y-3">
        {(q.data ?? []).map((a, i) => (
          <Card key={i} className="p-4 flex gap-4 items-start">
            <div className={
              "h-9 w-9 rounded-lg grid place-items-center shrink-0 " +
              (a.tone === "good" ? "bg-primary/10 text-primary" : a.tone === "bad" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground")
            }>{a.icon}</div>
            <div className="min-w-0">
              <div className="font-medium">{a.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{a.description}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
