import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { PlanGate } from "@/components/plan-gate";
import { PeriodSelector } from "@/components/period-selector";
import { usePeriod } from "@/hooks/use-period";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid, Legend } from "recharts";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lucro-plataforma")({
  component: () => (
    <PlanGate min="pro" featureName="Lucro por Plataforma" description="Descubra qual canal de venda te dá mais lucro de verdade.">
      <LucroPlataformaPage />
    </PlanGate>
  ),
});

type ChannelKey = "ifood" | "99food" | "loja";

const CHANNELS: { key: ChannelKey; label: string; color: string }[] = [
  { key: "ifood", label: "iFood", color: "hsl(var(--chart-1, 12 76% 61%))" },
  { key: "99food", label: "99Food", color: "hsl(var(--chart-2, 173 58% 39%))" },
  { key: "loja", label: "Loja Própria", color: "hsl(var(--chart-3, 197 37% 44%))" },
];

const DEFAULT_FEES: Record<ChannelKey, number> = { ifood: 23, "99food": 20, loja: 0 };
const FEE_STORAGE_KEY = "channel-fees-v1";

function LucroPlataformaPage() {
  const { restaurant } = useRestaurant();
  const { period, setPeriod } = usePeriod("30d");
  const [fees, setFees] = useState<Record<ChannelKey, number>>(DEFAULT_FEES);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEE_STORAGE_KEY);
      if (raw) setFees({ ...DEFAULT_FEES, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function updateFee(key: ChannelKey, value: number) {
    const next = { ...fees, [key]: value };
    setFees(next);
    try { localStorage.setItem(FEE_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  const sales = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["channel-sales", restaurant?.id, period.from, period.to],
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("source, orders_count, gross_amount, net_amount, sale_date")
        .eq("restaurant_id", restaurant!.id)
        .gte("sale_date", period.from)
        .lte("sale_date", period.to);
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const by: Record<ChannelKey, { faturamento: number; pedidos: number }> = {
      ifood: { faturamento: 0, pedidos: 0 },
      "99food": { faturamento: 0, pedidos: 0 },
      loja: { faturamento: 0, pedidos: 0 },
    };
    for (const s of sales.data ?? []) {
      const k = (s.source as ChannelKey) in by ? (s.source as ChannelKey) : "loja";
      by[k].faturamento += Number(s.gross_amount || 0);
      by[k].pedidos += Number(s.orders_count || 0);
    }
    const rows = CHANNELS.map((c) => {
      const feePct = fees[c.key] ?? 0;
      const taxa = by[c.key].faturamento * (feePct / 100);
      const lucro = by[c.key].faturamento - taxa;
      const ticket = by[c.key].pedidos > 0 ? by[c.key].faturamento / by[c.key].pedidos : 0;
      const margem = by[c.key].faturamento > 0 ? (lucro / by[c.key].faturamento) * 100 : 0;
      return { ...c, faturamento: by[c.key].faturamento, pedidos: by[c.key].pedidos, ticket, taxa, lucro, margem, feePct };
    });
    const totalFat = rows.reduce((a, r) => a + r.faturamento, 0);
    const totalLucro = rows.reduce((a, r) => a + r.lucro, 0);
    return { rows, totalFat, totalLucro };
  }, [sales.data, fees]);

  const rankedByMargem = [...stats.rows].filter((r) => r.faturamento > 0).sort((a, b) => b.margem - a.margem);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lucro por Plataforma</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare o desempenho real de cada canal descontando as taxas.</p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Taxas por plataforma</div>
            <div className="text-xs text-muted-foreground">Ajuste conforme sua realidade — salvo no navegador.</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CHANNELS.map((c) => (
            <div key={c.key} className="space-y-1">
              <Label className="text-xs">{c.label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={fees[c.key]}
                  onChange={(e) => updateFee(c.key, Number(e.target.value))}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.rows.map((r) => (
          <Card key={r.key} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{r.label}</div>
              <span className="text-xs text-muted-foreground">Taxa {formatPct(r.feePct)}</span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Faturamento</div>
              <div className="text-xl font-semibold">{formatBRL(r.faturamento)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Pedidos</div>
                <div className="font-medium">{formatNumber(r.pedidos)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ticket médio</div>
                <div className="font-medium">{formatBRL(r.ticket)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Taxa</div>
                <div className="font-medium text-destructive">−{formatBRL(r.taxa)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lucro estimado</div>
                <div className="font-semibold">{formatBRL(r.lucro)}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Margem</span>
              <span className={`text-sm font-semibold ${r.margem >= 30 ? "text-emerald-600" : r.margem >= 15 ? "text-amber-600" : "text-destructive"}`}>
                {formatPct(r.margem)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Faturamento vs Lucro por canal</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.rows}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <ReTooltip formatter={(v: any) => formatBRL(Number(v))} />
              <Legend />
              <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--chart-2, 173 58% 39%))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <div className="text-sm font-medium">Ranking de lucratividade</div>
        </div>
        {rankedByMargem.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Sem vendas no período.</div>
        ) : (
          <div className="space-y-2">
            {rankedByMargem.map((r, i) => (
              <div key={r.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full grid place-items-center text-xs font-bold bg-primary/10 text-primary">{i + 1}º</div>
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{formatNumber(r.pedidos)} pedidos · {formatBRL(r.faturamento)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{formatBRL(r.lucro)}</div>
                  <div className={`text-xs flex items-center justify-end gap-1 ${r.margem >= 30 ? "text-emerald-600" : r.margem >= 15 ? "text-amber-600" : "text-destructive"}`}>
                    {r.margem >= 20 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPct(r.margem)} margem
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {stats.totalFat > 0 && (
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">Consolidado do período</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Faturamento total</div>
              <div className="text-lg font-semibold">{formatBRL(stats.totalFat)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Taxas totais</div>
              <div className="text-lg font-semibold text-destructive">−{formatBRL(stats.totalFat - stats.totalLucro)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Lucro total</div>
              <div className="text-lg font-semibold">{formatBRL(stats.totalLucro)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Margem média</div>
              <div className="text-lg font-semibold">{formatPct((stats.totalLucro / stats.totalFat) * 100)}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
