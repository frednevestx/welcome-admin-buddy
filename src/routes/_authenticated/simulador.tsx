import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatBRL, formatPct } from "@/lib/format";
import { TrendingUp, TrendingDown, RotateCcw, Loader2 } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { usePeriod } from "@/hooks/use-period";
import { periodFromKey } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { useFinanceSummary } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/simulador")({
  validateSearch: (search: Record<string, unknown>): { from?: string; to?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  component: () => (
    <PlanGate min="pro" featureName="Simulador de Lucro" description="Simule cenários e descubra o que muda no seu bolso.">
      <SimuladorPage />
    </PlanGate>
  ),
});

interface Scenario {
  ticket: number;
  pedidos: number;
  cmvPct: number;
  taxaPct: number;
  despesasFixas: number;
}

const DEFAULT: Scenario = { ticket: 45, pedidos: 900, cmvPct: 32, taxaPct: 20, despesasFixas: 5000 };

function compute(s: Scenario) {
  const faturamento = s.ticket * s.pedidos;
  const cmv = faturamento * (s.cmvPct / 100);
  const taxa = faturamento * (s.taxaPct / 100);
  const lucro = faturamento - cmv - taxa - s.despesasFixas;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;
  return { faturamento, cmv, taxa, custoTotal: cmv + taxa + s.despesasFixas, lucro, margem, anual: lucro * 12 };
}

function SimuladorPage() {
  const { restaurant } = useRestaurant();
  const { from: searchFrom, to: searchTo } = Route.useSearch();
  const { period, setPeriod } = usePeriod("30d");
  const [base, setBase] = useState<Scenario>(DEFAULT);
  const [sim, setSim] = useState<Scenario>(DEFAULT);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);

  useEffect(() => {
    if (searchFrom && searchTo) setPeriod(periodFromKey("custom", { from: searchFrom, to: searchTo }));
  }, [searchFrom, searchTo, setPeriod]);

  const fin = useFinanceSummary(restaurant?.id, period.from, period.to);

  // Pré-carrega o cenário base com os números reais do período (mesma regra da Dashboard)
  useEffect(() => {
    const f = fin.data;
    const key = `${period.from}:${period.to}`;
    if (!f || loadedFrom === key) return;
    if (f.faturamento <= 0 || f.pedidos <= 0) {
      setLoadedFrom(key);
      return;
    }
    const real: Scenario = {
      ticket: +(f.faturamento / f.pedidos).toFixed(2),
      pedidos: Math.round(f.pedidos),
      cmvPct: 0,
      taxaPct: +((f.taxasPlataforma / f.faturamento) * 100).toFixed(1),
      despesasFixas: +f.despesasManuais.toFixed(2),
    };
    setBase(real);
    setSim(real);
    setLoadedFrom(key);
  }, [fin.data, period.from, period.to, loadedFrom]);

  const baseR = useMemo(() => compute(base), [base]);
  const simR = useMemo(() => compute(sim), [sim]);

  function set<K extends keyof Scenario>(key: K, value: number) {
    setSim({ ...sim, [key]: value });
  }

  function applyPreset(kind: "preco" | "pedidos" | "custos" | "taxa" | "reset") {
    if (kind === "reset") return setSim(base);
    if (kind === "preco") return setSim({ ...sim, ticket: +(sim.ticket * 1.1).toFixed(2) });
    if (kind === "pedidos") return setSim({ ...sim, pedidos: Math.round(sim.pedidos * 1.2) });
    if (kind === "custos") return setSim({ ...sim, cmvPct: +(sim.cmvPct * 0.85).toFixed(1) });
    if (kind === "taxa") return setSim({ ...sim, taxaPct: Math.max(0, +(sim.taxaPct - 5).toFixed(1)) });
  }


  const delta = simR.lucro - baseR.lucro;
  const deltaPct = baseR.lucro !== 0 ? (delta / Math.abs(baseR.lucro)) * 100 : 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulador de Lucro</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            {fin.isLoading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando seus números do período...</>
            ) : (
              "Cenário base carregado com os números reais do período."
            )}
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Parâmetros do cenário</div>
            <Button variant="ghost" size="sm" onClick={() => applyPreset("reset")}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
            </Button>
          </div>

          <SliderRow label="Ticket médio" value={sim.ticket} min={5} max={200} step={1} suffix="R$" onChange={(v) => set("ticket", v)} />
          <SliderRow label="Pedidos por mês" value={sim.pedidos} min={0} max={5000} step={10} onChange={(v) => set("pedidos", v)} />
          <SliderRow label="Custo dos ingredientes (CMV)" value={sim.cmvPct} min={0} max={80} step={0.5} suffix="%" onChange={(v) => set("cmvPct", v)} />
          <SliderRow label="Taxa de plataforma" value={sim.taxaPct} min={0} max={40} step={0.5} suffix="%" onChange={(v) => set("taxaPct", v)} />

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Despesas fixas mensais</Label>
            <Input type="number" value={sim.despesasFixas} onChange={(e) => set("despesasFixas", Number(e.target.value))} />
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">Cenários rápidos</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset("preco")}>+10% no preço</Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("pedidos")}>+20% em pedidos</Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("custos")}>−15% no CMV</Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("taxa")}>−5% na taxa</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-medium mb-3">Resultado simulado</div>
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Faturamento" value={formatBRL(simR.faturamento)} />
              <Metric label="Custo total" value={formatBRL(simR.custoTotal)} tone="red" />
              <Metric label="Lucro mensal" value={formatBRL(simR.lucro)} tone={simR.lucro >= 0 ? "green" : "red"} big />
              <Metric label="Margem" value={formatPct(simR.margem)} tone={simR.margem >= 15 ? "green" : simR.margem >= 5 ? "amber" : "red"} big />
            </div>
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="text-xs text-muted-foreground">Projeção anual</div>
              <div className="text-lg font-semibold">{formatBRL(simR.anual)}</div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-medium mb-3">Comparativo com cenário base</div>
            <div className="space-y-2 text-sm">
              <CompareRow label="Faturamento" a={baseR.faturamento} b={simR.faturamento} money />
              <CompareRow label="CMV" a={baseR.cmv} b={simR.cmv} money />
              <CompareRow label="Taxa" a={baseR.taxa} b={simR.taxa} money />
              <CompareRow label="Lucro" a={baseR.lucro} b={simR.lucro} money />
              <CompareRow label="Margem" a={baseR.margem} b={simR.margem} pct />
            </div>
            <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
              <div className="text-sm">Impacto no lucro</div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {delta >= 0 ? "+" : ""}{formatBRL(delta)} <span className="text-xs text-muted-foreground">({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="text-sm font-medium">{suffix === "R$" ? formatBRL(value) : `${value}${suffix ?? ""}`}</div>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function Metric({ label, value, tone, big }: { label: string; value: string; tone?: "green" | "red" | "amber"; big?: boolean }) {
  const color = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`${big ? "text-xl" : "text-base"} font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function CompareRow({ label, a, b, money, pct }: { label: string; a: number; b: number; money?: boolean; pct?: boolean }) {
  const fmt = (v: number) => (money ? formatBRL(v) : pct ? formatPct(v) : v.toFixed(2));
  const diff = b - a;
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{fmt(a)}</span>
        <span>→</span>
        <span className="font-medium">{fmt(b)}</span>
        <span className={`text-xs w-20 text-right ${diff >= 0 ? "text-emerald-600" : "text-destructive"}`}>
          {diff >= 0 ? "+" : ""}{fmt(diff)}
        </span>
      </div>
    </div>
  );
}
