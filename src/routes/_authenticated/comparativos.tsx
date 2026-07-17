import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { periodFromKey, previousPeriod, type PeriodKey } from "@/lib/period";
import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comparativos")({
  component: ComparePage,
});

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje x Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
];

function ComparePage() {
  const { restaurant } = useRestaurant();
  const [key, setKey] = useState<PeriodKey>("7d");

  const current = periodFromKey(key);
  const previous = previousPeriod(current);

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["compare", restaurant?.id, key],
    queryFn: async () => {
      const rid = restaurant!.id;
      async function agg(from: string, to: string) {
        const [salesRes, movRes] = await Promise.all([
          supabase.from("sales").select("orders_count, gross_amount").eq("restaurant_id", rid).gte("sale_date", from).lte("sale_date", to),
          supabase.from("movements").select("amount").eq("restaurant_id", rid).gte("movement_date", from).lte("movement_date", to),
        ]);
        const vendido = (salesRes.data ?? []).reduce((a, s) => a + Number(s.gross_amount || 0), 0);
        const pedidos = (salesRes.data ?? []).reduce((a, s) => a + Number(s.orders_count || 0), 0);
        const gasto = (movRes.data ?? []).reduce((a, m) => a + Number(m.amount || 0), 0);
        return { vendido, gasto, sobrou: vendido - gasto, pedidos };
      }
      const [cur, prev] = await Promise.all([agg(current.from, current.to), agg(previous.from, previous.to)]);
      return { cur, prev };
    },
  });

  const cur = q.data?.cur ?? { vendido: 0, gasto: 0, sobrou: 0, pedidos: 0 };
  const prev = q.data?.prev ?? { vendido: 0, gasto: 0, sobrou: 0, pedidos: 0 };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comparativos</h1>
        <p className="text-sm text-muted-foreground mt-1">Compare com o período anterior.</p>
      </div>

      <Tabs value={key} onValueChange={(v) => setKey(v as PeriodKey)}>
        <TabsList>
          {OPTIONS.map((o) => <TabsTrigger key={o.key} value={o.key}>{o.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CompareCard label="Total Vendido" cur={cur.vendido} prev={prev.vendido} format={formatBRL} />
        <CompareCard label="Total Gasto" cur={cur.gasto} prev={prev.gasto} format={formatBRL} invert />
        <CompareCard label="Quanto Sobrou" cur={cur.sobrou} prev={prev.sobrou} format={formatBRL} />
        <CompareCard label="Pedidos" cur={cur.pedidos} prev={prev.pedidos} format={formatNumber} />
      </div>
    </div>
  );
}

function CompareCard({ label, cur, prev, format, invert }: { label: string; cur: number; prev: number; format: (n: number) => string; invert?: boolean }) {
  const diff = cur - prev;
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : (cur > 0 ? 100 : 0);
  const up = diff > 0;
  const flat = diff === 0;
  const good = invert ? !up : up;

  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-2">{format(cur)}</div>
      <div className="text-xs text-muted-foreground mt-1">Antes: {format(prev)}</div>
      <div className={cn("mt-3 inline-flex items-center gap-1 text-sm font-medium",
        flat ? "text-muted-foreground" : good ? "text-primary" : "text-destructive")}
      >
        {flat ? <Minus className="h-3.5 w-3.5" /> : up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        <span className="tabular-nums">{formatPct(Math.abs(pct))}</span>
      </div>
    </Card>
  );
}
