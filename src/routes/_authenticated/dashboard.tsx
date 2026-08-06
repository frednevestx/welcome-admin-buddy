import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { usePeriod } from "@/hooks/use-period";
import { PeriodSelector } from "@/components/period-selector";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatNumber, formatPct, formatDate, isoDate } from "@/lib/format";
import { periodFromKey, type PeriodKey } from "@/lib/period";
import { currentGoalWindow, goalPeriodLabel, type GoalPeriod } from "@/lib/goals";
import {
  TrendingDown,
  ShoppingBag,
  Wallet,
  PiggyBank,
  BarChart3,
  Target,
  Receipt,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip as ReTooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { TrialBanner } from "@/components/trial-banner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  validateSearch: (search: Record<string, unknown>): { from?: string; to?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
});

type RankingRange = "today" | "7d" | "30d" | "90d" | "year";

function rangeToDates(r: RankingRange): { from: string; to: string; label: string } {
  const today = new Date();
  if (r === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { from: isoDate(start), to: isoDate(today), label: "Ano" };
  }
  const key: PeriodKey = r as PeriodKey;
  const p = periodFromKey(key);
  const label =
    r === "today" ? "Hoje" : r === "7d" ? "7 dias" : r === "30d" ? "30 dias" : "90 dias";
  return { from: p.from, to: p.to, label };
}

function DashboardPage() {
  const { restaurant } = useRestaurant();
  const { from: searchFrom, to: searchTo } = Route.useSearch();
  const { period, setPeriod } = usePeriod("30d");

  // Após importar uma planilha, abrimos o dashboard já no período importado
  useEffect(() => {
    if (searchFrom && searchTo) {
      setPeriod(periodFromKey("custom", { from: searchFrom, to: searchTo }));
    }
  }, [searchFrom, searchTo, setPeriod]);
  const [evoRange, setEvoRange] = useState<"3" | "6" | "12">("6");
  const [rankingRange, setRankingRange] = useState<RankingRange>("30d");

  // Fonte única de verdade financeira (mesma regra em todas as telas)
  const fin = useFinanceSummary(restaurant?.id, period.from, period.to);
  const f = fin.data;

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["dashboard", restaurant?.id, period.from, period.to],
    queryFn: async () => {
      const rid = restaurant!.id;
      const { data: recent } = await supabase
        .from("movements")
        .select("id, movement_date, description, amount, type, categories(name)")
        .eq("restaurant_id", rid)
        .order("movement_date", { ascending: false })
        .limit(6);

      const today = periodFromKey("today");
      const p7 = periodFromKey("7d");
      const p30 = periodFromKey("30d");
      async function countOrders(from: string, to: string) {
        const { data } = await supabase
          .from("sales")
          .select("orders_count")
          .eq("restaurant_id", rid)
          .gte("sale_date", from)
          .lte("sale_date", to);
        return (data ?? []).reduce((a, s) => a + Number(s.orders_count || 0), 0);
      }
      const [pHoje, p7d, p30d] = await Promise.all([
        countOrders(today.from, today.to),
        countOrders(p7.from, p7.to),
        countOrders(p30.from, p30.to),
      ]);

      return {
        pedidos: { hoje: pHoje, d7: p7d, d30: p30d },
        recent: recent ?? [],
      };
    },
  });


  // Ranking de gastos com filtro próprio
  const rankQ = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["dashboard-rank", restaurant?.id, rankingRange],
    queryFn: async () => {
      const r = rangeToDates(rankingRange);
      const { data } = await supabase
        .from("movements")
        .select("amount, categories(name)")
        .eq("restaurant_id", restaurant!.id)
        .gte("movement_date", r.from)
        .lte("movement_date", r.to);
      const byCat: Record<string, number> = {};
      for (const m of data ?? []) {
        const name = (m as any).categories?.name ?? "Sem categoria";
        byCat[name] = (byCat[name] || 0) + Number(m.amount || 0);
      }
      return Object.entries(byCat)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  });

  // Meta ativa mais recente (prioriza mensal > semanal > diária)
  const goalQ = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["dashboard-goal", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, period, target_amount")
        .eq("restaurant_id", restaurant!.id)
        .eq("active", true);
      const goals = (data ?? []) as { id: string; period: GoalPeriod; target_amount: number }[];
      if (goals.length === 0) return null;
      const rank = { mensal: 3, semanal: 2, diaria: 1 } as const;
      const g = [...goals].sort((a, b) => rank[b.period] - rank[a.period])[0];
      const w = currentGoalWindow(g.period);
      const { data: s } = await supabase
        .from("sales")
        .select("gross_amount")
        .eq("restaurant_id", restaurant!.id)
        .gte("sale_date", w.from)
        .lte("sale_date", w.to);
      const vendido = (s ?? []).reduce((a, x) => a + Number(x.gross_amount || 0), 0);
      const projec = w.elapsedDays > 0 ? (vendido / w.elapsedDays) * w.totalDays : 0;
      return { goal: g, window: w, vendido, projecao: projec };
    },
  });

  const months = evoRange === "3" ? 3 : evoRange === "6" ? 6 : 12;
  const evoQ = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["dashboard-evo", restaurant?.id, evoRange],
    queryFn: async () => {
      const rid = restaurant!.id;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const [s, m] = await Promise.all([
        supabase
          .from("sales")
          .select("sale_date, gross_amount")
          .eq("restaurant_id", rid)
          .gte("sale_date", isoDate(start))
          .lte("sale_date", isoDate(now)),
        supabase
          .from("movements")
          .select("movement_date, amount")
          .eq("restaurant_id", rid)
          .gte("movement_date", isoDate(start))
          .lte("movement_date", isoDate(now)),
      ]);
      const map = new Map<string, { key: string; label: string; vendido: number; gasto: number; sobrou: number }>();
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      for (let i = 0; i < months; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map.set(k, { key: k, label: monthNames[d.getMonth()], vendido: 0, gasto: 0, sobrou: 0 });
      }
      const keyOf = (d: string) => d.slice(0, 7);
      for (const x of s.data ?? []) {
        const b = map.get(keyOf(x.sale_date));
        if (b) b.vendido += Number(x.gross_amount || 0);
      }
      for (const x of m.data ?? []) {
        const b = map.get(keyOf(x.movement_date));
        if (b) b.gasto += Number(x.amount || 0);
      }
      const arr = Array.from(map.values());
      for (const r of arr) r.sobrou = Math.max(0, r.vendido - r.gasto);
      return arr;
    },
  });

  const data = q.data;
  const bySourceEntries = (f?.channels ?? []).map((c) => [c.key, c.faturamento] as const);
  const sourceTotal = bySourceEntries.reduce((a, [, v]) => a + v, 0);
  const searchPeriod = { from: period.from, to: period.to };

  const goal = goalQ.data;
  const goalPct = goal && goal.goal.target_amount > 0
    ? Math.min(100, (goal.vendido / goal.goal.target_amount) * 100)
    : 0;
  const goalProjPct = goal && goal.goal.target_amount > 0
    ? (goal.projecao / goal.goal.target_amount) * 100
    : 0;
  const goalStatus: "ok" | "warn" | "bad" =
    goalProjPct >= 100 ? "ok" : goalProjPct >= 80 ? "warn" : "bad";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <TrialBanner />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Sua visão financeira em segundos.</p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Faturamento Total"
          value={formatBRL(f?.faturamento)}
          hint={`${formatNumber(f?.pedidos)} pedidos · ver por plataforma`}
          tone="primary"
          to="/lucro-plataforma"
          search={searchPeriod}
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Total Gasto"
          value={formatBRL(f?.totalGasto)}
          hint={
            f
              ? `Taxas ${formatBRL(f.taxasPlataforma)} + despesas ${formatBRL(f.despesasManuais)}`
              : "Taxas das plataformas + despesas"
          }
          tone="destructive"
          to="/movimentacoes"
          search={searchPeriod}
        />
        <StatCard
          icon={<PiggyBank className="h-4 w-4" />}
          label="Lucro Estimado"
          value={formatBRL(f?.lucro)}
          hint={f && f.faturamento > 0 ? formatPct(f.margem) + " de margem" : "—"}
          tone={f && f.lucro >= 0 ? "success" : "destructive"}
          to="/lucro-plataforma"
          search={searchPeriod}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/simulador" search={searchPeriod} className="block">
          <Card className="p-5 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Lucro médio por pedido</h2>
            </div>
            <div className="text-3xl font-semibold tabular-nums tracking-tight">
              {formatBRL(f?.lucroPorPedido)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatNumber(f?.pedidos)} pedidos · Lucro {formatBRL(f?.lucro)} · simular
            </div>
          </Card>
        </Link>


        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Pedidos</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Hoje" value={formatNumber(data?.pedidos.hoje)} />
            <MiniStat label="7 dias" value={formatNumber(data?.pedidos.d7)} />
            <MiniStat label="30 dias" value={formatNumber(data?.pedidos.d30)} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Meta inteligente</h2>
            </div>
            {!goal && (
              <Link to="/metas" className="text-xs text-primary hover:underline">
                Criar
              </Link>
            )}
          </div>
          {goal ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-2xl font-semibold tabular-nums">
                  {formatBRL(goal.vendido)}
                </div>
                <div className="text-xs text-muted-foreground">
                  de {formatBRL(goal.goal.target_amount)}
                </div>
              </div>
              <Progress value={goalPct} className="h-2" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{goalPeriodLabel(goal.goal.period)}</span>
                <span className="tabular-nums">{formatPct(goalPct)}</span>
              </div>
              <div
                className={cn(
                  "mt-3 text-xs flex items-center gap-1.5",
                  goalStatus === "ok"
                    ? "text-emerald-600"
                    : goalStatus === "warn"
                    ? "text-amber-600"
                    : "text-destructive",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    goalStatus === "ok"
                      ? "bg-emerald-500"
                      : goalStatus === "warn"
                      ? "bg-amber-500"
                      : "bg-destructive",
                  )}
                />
                Previsão no ritmo: {formatBRL(goal.projecao)}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Defina uma meta em <Link to="/metas" className="text-primary hover:underline">Metas</Link> para acompanhar aqui.
            </p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-medium mb-4">De onde vieram as vendas</h2>
        <div className="space-y-3">
          {bySourceEntries.map(([src, val]) => {
            const pct = sourceTotal > 0 ? (val / sourceTotal) * 100 : 0;
            return (
              <div key={src}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span>{prettySource(src)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBRL(val)} · {formatPct(pct)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: sourceColor(src) }} />
                </div>
              </div>
            );
          })}
          {sourceTotal === 0 && <p className="text-sm text-muted-foreground">Sem vendas no período.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
          <h2 className="text-sm font-medium truncate">Onde foi gasto o dinheiro</h2>
          <Tabs value={rankingRange} onValueChange={(v) => setRankingRange(v as RankingRange)}>
            <TabsList>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {rankQ.data && rankQ.data.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankQ.data} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <ReTooltip
                  cursor={{ fill: "var(--accent)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => formatBRL(Number(v))}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {rankQ.data.map((_, i) => (
                    <Cell key={i} fill="var(--primary)" fillOpacity={1 - i * 0.06} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem gastos no período.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-medium truncate">Evolução mensal</h2>
          </div>
          <Tabs value={evoRange} onValueChange={(v) => setEvoRange(v as "3" | "6" | "12")}>
            <TabsList>
              <TabsTrigger value="3">3 meses</TabsTrigger>
              <TabsTrigger value="6">6 meses</TabsTrigger>
              <TabsTrigger value="12">12 meses</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evoQ.data ?? []} margin={{ top: 6, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + Math.round(v / 100) / 10 + "k"} />
              <ReTooltip
                cursor={{ fill: "var(--accent)", opacity: 0.3 }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, n: any) => [formatBRL(Number(v)), n === "gasto" ? "Gasto" : "Sobrou"]}
              />
              <Bar dataKey="gasto" stackId="a" fill="var(--destructive)" radius={[0, 0, 6, 6]} />
              <Bar dataKey="sobrou" stackId="a" fill="oklch(0.72 0.18 148)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-medium mb-4">Últimas movimentações</h2>
        {data && data.recent.length > 0 ? (
          <div className="divide-y divide-border/60">
            {data.recent.map((m: any) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.description || m.categories?.name || "Movimentação"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(m.movement_date)} · {m.categories?.name || "—"}</div>
                </div>
                <div className="tabular-nums text-sm font-medium text-destructive">
                  − {formatBRL(m.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "success" | "destructive";
}) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "success" ? "text-primary" : "text-destructive";
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("h-8 w-8 rounded-lg grid place-items-center bg-secondary", toneClass)}>{icon}</span>
      </div>
      <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function prettySource(s: string) {
  if (s === "ifood") return "iFood";
  if (s === "99food") return "99Food";
  if (s === "loja") return "Loja própria";
  if (s === "whatsapp") return "WhatsApp";
  return s;
}
function sourceColor(s: string) {
  if (s === "ifood") return "oklch(0.72 0.18 25)";
  if (s === "99food") return "oklch(0.78 0.16 75)";
  if (s === "whatsapp") return "oklch(0.72 0.18 148)";
  return "var(--primary)";
}
