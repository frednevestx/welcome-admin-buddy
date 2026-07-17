import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatPct } from "@/lib/format";
import { currentGoalWindow, goalPeriodLabel, type GoalPeriod } from "@/lib/goals";
import { Target, Trash2, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metas")({
  component: MetasPage,
});

type GoalRow = {
  id: string;
  period: GoalPeriod;
  target_amount: number;
  active: boolean;
  created_at: string;
};

function MetasPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();

  const [period, setPeriod] = useState<GoalPeriod>("mensal");
  const [amount, setAmount] = useState("");

  const goalsQ = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["goals", restaurant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, period, target_amount, active, created_at")
        .eq("restaurant_id", restaurant!.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GoalRow[];
    },
  });

  // Progresso: pega vendas por janela para cada meta ativa
  const progressQ = useQuery({
    enabled: !!restaurant?.id && !!goalsQ.data,
    queryKey: ["goals-progress", restaurant?.id, goalsQ.data?.map((g) => g.id).join(",")],
    queryFn: async () => {
      const goals = goalsQ.data ?? [];
      const result: Record<string, number> = {};
      for (const g of goals) {
        const w = currentGoalWindow(g.period);
        const { data } = await supabase
          .from("sales")
          .select("gross_amount")
          .eq("restaurant_id", restaurant!.id)
          .gte("sale_date", w.from)
          .lte("sale_date", w.to);
        result[g.id] = (data ?? []).reduce((a, s) => a + Number(s.gross_amount || 0), 0);
      }
      return result;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", "."));
      if (!value || value <= 0) throw new Error("Informe um valor válido");
      // Desativa metas anteriores desse mesmo período
      await supabase
        .from("goals")
        .update({ active: false })
        .eq("restaurant_id", restaurant!.id)
        .eq("period", period)
        .eq("active", true);
      const { error } = await supabase.from("goals").insert({
        restaurant_id: restaurant!.id,
        period,
        target_amount: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta criada");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-goal"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar meta"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta removida");
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-goal"] });
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina quanto você quer vender por dia, semana ou mês.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">Nova meta</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label>Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">Meta diária</SelectItem>
                <SelectItem value="semanal">Meta semanal</SelectItem>
                <SelectItem value="mensal">Meta mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quanto você quer vender?</Label>
            <Input
              inputMode="decimal"
              placeholder="Ex.: 30.000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Salvar meta
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(goalsQ.data ?? []).length === 0 && (
          <Card className="p-8 text-center md:col-span-2">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Ainda não há metas. Crie uma acima para ver seu progresso em tempo real.
            </p>
          </Card>
        )}

        {(goalsQ.data ?? []).map((g) => {
          const w = currentGoalWindow(g.period);
          const vendido = progressQ.data?.[g.id] ?? 0;
          const pct = g.target_amount > 0 ? Math.min(100, (vendido / g.target_amount) * 100) : 0;
          const falta = Math.max(0, g.target_amount - vendido);
          const projec = w.elapsedDays > 0 ? (vendido / w.elapsedDays) * w.totalDays : 0;
          const projPct = g.target_amount > 0 ? (projec / g.target_amount) * 100 : 0;
          const status =
            projPct >= 100 ? "ok" : projPct >= 80 ? "warn" : "bad";

          return (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {goalPeriodLabel(g.period)}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums mt-0.5">
                    {formatBRL(g.target_amount)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(g.id)}
                  aria-label="Remover meta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Progress value={pct} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Vendido: <span className="text-foreground font-medium">{formatBRL(vendido)}</span></span>
                  <span className="tabular-nums">{formatPct(pct)}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Falta atingir" value={formatBRL(falta)} />
                <MiniStat
                  label="Previsão no ritmo"
                  value={formatBRL(projec)}
                  tone={status}
                />
              </div>

              <div className={`mt-4 text-xs flex items-center gap-1.5 ${
                status === "ok" ? "text-emerald-600" : status === "warn" ? "text-amber-600" : "text-destructive"
              }`}>
                <TrendingUp className="h-3.5 w-3.5" />
                {status === "ok"
                  ? "No ritmo atual, você vai bater a meta"
                  : status === "warn"
                  ? "Perto de bater, mas precisa acelerar um pouco"
                  : "No ritmo atual, a meta não será atingida"}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const dot =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : tone === "bad"
      ? "bg-destructive"
      : "bg-muted-foreground/40";
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {tone && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
