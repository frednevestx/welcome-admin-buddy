import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { PlanGate } from "@/components/plan-gate";
import { PeriodSelector } from "@/components/period-selector";
import { usePeriod } from "@/hooks/use-period";
import { periodFromKey } from "@/lib/period";
import { Card } from "@/components/ui/card";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid, Legend } from "recharts";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { useFinanceSummary, emptySummary } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/lucro-plataforma")({
  validateSearch: (search: Record<string, unknown>): { from?: string; to?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  component: () => (
    <PlanGate min="pro" featureName="Lucro por Plataforma" description="Descubra qual canal de venda te dá mais lucro de verdade.">
      <LucroPlataformaPage />
    </PlanGate>
  ),
});

function LucroPlataformaPage() {
  const { restaurant } = useRestaurant();
  const { from: searchFrom, to: searchTo } = Route.useSearch();
  const { period, setPeriod } = usePeriod("30d");

  useEffect(() => {
    if (searchFrom && searchTo) setPeriod(periodFromKey("custom", { from: searchFrom, to: searchTo }));
  }, [searchFrom, searchTo, setPeriod]);

  const fin = useFinanceSummary(restaurant?.id, period.from, period.to);
  const f = fin.data ?? emptySummary();
  const rows = f.channels;
  const rankedByMargem = [...rows].filter((r) => r.faturamento > 0).sort((a, b) => b.margem - a.margem);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lucro por Plataforma</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Taxas reais extraídas dos relatórios importados — mesma regra usada na Dashboard.
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {rows.map((r) => (
          <Card key={r.key} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{r.label}</div>
              <span className="text-xs text-muted-foreground">Taxa {formatPct(r.taxaPct)}</span>
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
                <div className="text-xs text-muted-foreground">Taxas</div>
                <div className="font-medium text-destructive">−{formatBRL(r.taxas)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Sobra do canal</div>
                <div className="font-semibold">{formatBRL(r.lucro)}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Margem do canal</span>
              <span className={`text-sm font-semibold ${r.margem >= 30 ? "text-emerald-600" : r.margem >= 15 ? "text-amber-600" : "text-destructive"}`}>
                {formatPct(r.margem)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Faturamento vs sobra por canal</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <ReTooltip formatter={(v: any) => formatBRL(Number(v))} />
              <Legend />
              <Bar dataKey="faturamento" name="Faturamento" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Sobra" fill="oklch(0.72 0.18 148)" radius={[4, 4, 0, 0]} />
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

      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Consolidado do período</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Faturamento total</div>
            <div className="text-lg font-semibold">{formatBRL(f.faturamento)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Taxas das plataformas</div>
            <div className="text-lg font-semibold text-destructive">−{formatBRL(f.taxasPlataforma)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Despesas lançadas</div>
            <div className="text-lg font-semibold text-destructive">−{formatBRL(f.despesasManuais)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Lucro estimado</div>
            <div className="text-lg font-semibold">{formatBRL(f.lucro)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Margem</div>
            <div className="text-lg font-semibold">{formatPct(f.margem)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
