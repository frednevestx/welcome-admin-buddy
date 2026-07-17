import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, isoDate } from "@/lib/format";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/evolucao")({
  component: EvolutionPage,
});

type Bucket = "day" | "week" | "month" | "year";

function EvolutionPage() {
  const { restaurant } = useRestaurant();
  const [bucket, setBucket] = useState<Bucket>("day");

  const days = bucket === "day" ? 30 : bucket === "week" ? 84 : bucket === "month" ? 365 : 365 * 3;
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - days);

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["evolution", restaurant?.id, bucket],
    queryFn: async () => {
      const rid = restaurant!.id;
      const [salesRes, movRes] = await Promise.all([
        supabase.from("sales").select("sale_date, orders_count, gross_amount").eq("restaurant_id", rid).gte("sale_date", isoDate(from)).lte("sale_date", isoDate(to)),
        supabase.from("movements").select("movement_date, amount").eq("restaurant_id", rid).gte("movement_date", isoDate(from)).lte("movement_date", isoDate(to)),
      ]);
      const map = new Map<string, { key: string; vendido: number; gasto: number; sobrou: number; pedidos: number }>();
      function bucketKey(d: string) {
        const dt = new Date(d + "T00:00:00");
        if (bucket === "day") return isoDate(dt);
        if (bucket === "week") { const day = dt.getDay(); const monday = new Date(dt); monday.setDate(dt.getDate() - ((day + 6) % 7)); return isoDate(monday); }
        if (bucket === "month") return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
        return `${dt.getFullYear()}-01-01`;
      }
      function ensure(k: string) {
        if (!map.has(k)) map.set(k, { key: k, vendido: 0, gasto: 0, sobrou: 0, pedidos: 0 });
        return map.get(k)!;
      }
      for (const s of salesRes.data ?? []) {
        const b = ensure(bucketKey(s.sale_date));
        b.vendido += Number(s.gross_amount || 0);
        b.pedidos += Number(s.orders_count || 0);
      }
      for (const m of movRes.data ?? []) {
        const b = ensure(bucketKey(m.movement_date));
        b.gasto += Number(m.amount || 0);
      }
      const arr = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
      for (const r of arr) r.sobrou = r.vendido - r.gasto;
      return arr;
    },
  });

  const data = q.data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evolução</h1>
        <p className="text-sm text-muted-foreground mt-1">Como os números vêm se comportando ao longo do tempo.</p>
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList>
          <TabsTrigger value="day">Dia</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="month">Mês</TabsTrigger>
          <TabsTrigger value="year">Ano</TabsTrigger>
        </TabsList>
      </Tabs>

      <ChartCard title="Total Vendido" data={data} dataKey="vendido" color="var(--primary)" />
      <ChartCard title="Total Gasto" data={data} dataKey="gasto" color="var(--destructive)" />
      <ChartCard title="Quanto Sobrou" data={data} dataKey="sobrou" color="var(--chart-2)" />
      <ChartCard title="Pedidos" data={data} dataKey="pedidos" color="var(--chart-3)" isCurrency={false} />
    </div>
  );
}

function ChartCard({ title, data, dataKey, color, isCurrency = true }: { title: string; data: any[]; dataKey: string; color: string; isCurrency?: boolean }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium mb-4">{title}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="key" tickFormatter={(v) => formatDate(v)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => isCurrency ? "R$" + Math.round(v / 100) / 10 + "k" : String(v)} />
            <ReTooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(l) => formatDate(String(l))}
              formatter={(v: any) => isCurrency ? formatBRL(Number(v)) : String(v)}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#g-${dataKey})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
