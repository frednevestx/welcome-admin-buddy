import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { PlanGate } from "@/components/plan-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatPct, isoDate } from "@/lib/format";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cmv")({
  component: () => (
    <PlanGate min="pro" featureName="Controle de CMV" description="Compare o custo de mercadoria vendida com sua meta.">
      <CmvPage />
    </PlanGate>
  ),
});

type Granularity = "day" | "week" | "month";

function CmvPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [days, setDays] = useState(30);
  const [targetInput, setTargetInput] = useState("");

  const cmvSettings = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["cmv-settings", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase.from("cmv_settings").select("target_percent").eq("restaurant_id", restaurant!.id).maybeSingle();
      return data;
    },
  });

  const target = Number(cmvSettings.data?.target_percent ?? 30);

  const rangeFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return isoDate(d);
  }, [days]);

  const purchases = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["cmv-purchases", restaurant?.id, rangeFrom],
    queryFn: async () => {
      const { data } = await supabase.from("movements")
        .select("amount, movement_date, category_id, categories(name)")
        .eq("restaurant_id", restaurant!.id)
        .eq("type", "saida")
        .gte("movement_date", rangeFrom)
        .order("movement_date");
      return (data ?? []) as any[];
    },
  });

  const sales = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["cmv-sales", restaurant?.id, rangeFrom],
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("gross_amount, net_amount, sale_date")
        .eq("restaurant_id", restaurant!.id)
        .gte("sale_date", rangeFrom)
        .order("sale_date");
      return (data ?? []) as any[];
    },
  });

  const summary = useMemo(() => {
    const totalPurchases = (purchases.data ?? []).reduce((s, m) => s + Number(m.amount), 0);
    const totalSales = (sales.data ?? []).reduce((s, m) => s + Number(m.gross_amount), 0);
    const cmv = totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;
    const status: "good" | "warn" | "bad" =
      cmv === 0 ? "warn" : cmv <= target ? "good" : cmv <= target + 5 ? "warn" : "bad";
    return { totalPurchases, totalSales, cmv, status };
  }, [purchases.data, sales.data, target]);

  function bucketKey(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    if (granularity === "day") return dateStr;
    if (granularity === "week") {
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      return isoDate(d);
    }
    return dateStr.slice(0, 7);
  }

  const evolution = useMemo(() => {
    const map = new Map<string, { compras: number; vendas: number }>();
    (purchases.data ?? []).forEach((m) => {
      const k = bucketKey(m.movement_date);
      const b = map.get(k) ?? { compras: 0, vendas: 0 };
      b.compras += Number(m.amount);
      map.set(k, b);
    });
    (sales.data ?? []).forEach((m) => {
      const k = bucketKey(m.sale_date);
      const b = map.get(k) ?? { compras: 0, vendas: 0 };
      b.vendas += Number(m.gross_amount);
      map.set(k, b);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      period: k,
      label: granularity === "month" ? k : new Date(k + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      cmv: v.vendas > 0 ? (v.compras / v.vendas) * 100 : 0,
      compras: v.compras,
      vendas: v.vendas,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases.data, sales.data, granularity]);

  const categoryRank = useMemo(() => {
    const map = new Map<string, number>();
    (purchases.data ?? []).forEach((m) => {
      const name = m.categories?.name ?? "Sem categoria";
      map.set(name, (map.get(name) ?? 0) + Number(m.amount));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [purchases.data]);

  const saveTarget = useMutation({
    mutationFn: async () => {
      const val = Number(targetInput);
      if (!restaurant || isNaN(val) || val <= 0 || val >= 100) throw new Error("Informe um valor entre 1 e 99");
      const { error } = await supabase.from("cmv_settings").upsert({
        restaurant_id: restaurant.id, target_percent: val,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTargetInput("");
      qc.invalidateQueries({ queryKey: ["cmv-settings"] });
      toast.success("Meta atualizada");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  const statusColor = summary.status === "good" ? "text-green-600" : summary.status === "warn" ? "text-yellow-600" : "text-destructive";
  const statusEmoji = summary.status === "good" ? "🟢" : summary.status === "warn" ? "🟡" : "🔴";
  const statusLabel = summary.status === "good" ? "Dentro da meta" : summary.status === "warn" ? "Atenção" : "Acima do recomendado";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controle de CMV</h1>
          <p className="text-sm text-muted-foreground mt-1">Quanto dos seus ingredientes vira o que você vende.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-card">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-md ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 md:col-span-2">
          <div className="text-xs uppercase text-muted-foreground">CMV atual</div>
          <div className={`text-4xl font-bold mt-1 ${statusColor}`}>
            {formatPct(summary.cmv)}
          </div>
          <div className="text-sm mt-2 flex items-center gap-2">
            <span className={statusColor}>{statusEmoji} {statusLabel}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Compras: {formatBRL(summary.totalPurchases)} · Vendas: {formatBRL(summary.totalSales)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Meta</div>
          <div className="text-2xl font-semibold mt-1">{formatPct(target)}</div>
          <div className="text-xs text-muted-foreground mt-1">Ajustável abaixo</div>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Diferença</div>
          <div className={`text-2xl font-semibold mt-1 inline-flex items-center gap-1 ${statusColor}`}>
            {summary.cmv > target ? <TrendingUp className="h-5 w-5" /> : summary.cmv < target ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
            {summary.cmv > 0 ? `${(summary.cmv - target).toFixed(1)}pp` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.cmv > target ? "acima da meta" : "abaixo da meta"}
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-medium">Evolução do CMV</div>
          <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-card">
            {(["day", "week", "month"] as Granularity[]).map((g) => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-3 py-1 text-xs rounded-md ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {g === "day" ? "Dia" : g === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
        {evolution.length > 1 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution}>
                <defs>
                  <linearGradient id="cmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <ReTooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                <ReferenceLine y={target} stroke="var(--destructive)" strokeDasharray="3 3" label={{ value: `Meta ${target}%`, fontSize: 10, position: "right" }} />
                <Area type="monotone" dataKey="cmv" stroke="var(--primary)" strokeWidth={2} fill="url(#cmvGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-10">
            Registre compras e vendas para ver a evolução.
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 space-y-3">
          <div className="font-medium">Categorias que mais impactam</div>
          <div className="space-y-2">
            {categoryRank.map(([name, value]) => {
              const pct = summary.totalPurchases > 0 ? (value / summary.totalPurchases) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-medium">{formatBRL(value)}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(1)}% das compras</div>
                </div>
              );
            })}
            {categoryRank.length === 0 && <div className="text-sm text-muted-foreground">Sem dados no período.</div>}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="font-medium">Definir meta de CMV</div>
          <p className="text-xs text-muted-foreground">Negócios saudáveis costumam operar entre 28% e 35%.</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Novo alvo (%)</Label>
              <Input type="number" step="0.5" min="1" max="99" placeholder={String(target)} value={targetInput} onChange={(e) => setTargetInput(e.target.value)} />
            </div>
            <Button onClick={() => saveTarget.mutate()} disabled={!targetInput || saveTarget.isPending} className="self-end">
              <Save className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}