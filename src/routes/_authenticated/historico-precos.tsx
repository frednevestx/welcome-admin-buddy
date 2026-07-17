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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/historico-precos")({
  component: () => (
    <PlanGate min="pro" featureName="Histórico de Preços" description="Acompanhe a evolução do custo dos seus ingredientes.">
      <HistoricoPrecosPage />
    </PlanGate>
  ),
});

type Ingredient = { id: string; name: string; unit: string; current_price: number; supplier_id: string | null };
type PriceRow = { id: string; ingredient_id: string; unit_price: number; purchase_date: string; supplier_id: string | null };

function HistoricoPrecosPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [openIng, setOpenIng] = useState(false);
  const [openPrice, setOpenPrice] = useState(false);
  const [ingForm, setIngForm] = useState({ name: "", unit: "un" });
  const [priceForm, setPriceForm] = useState({ unit_price: "", purchase_date: new Date().toISOString().slice(0, 10), supplier_id: "" });

  const ings = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["ingredients", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ingredients")
        .select("id, name, unit, current_price, supplier_id")
        .eq("restaurant_id", restaurant!.id)
        .order("name");
      return (data ?? []) as Ingredient[];
    },
  });

  const history = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["price-history", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_history")
        .select("id, ingredient_id, unit_price, purchase_date, supplier_id")
        .eq("restaurant_id", restaurant!.id)
        .order("purchase_date", { ascending: true });
      return (data ?? []) as PriceRow[];
    },
  });

  const suppliers = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["suppliers-min", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("restaurant_id", restaurant!.id).order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const activeId = selected ?? ings.data?.[0]?.id ?? null;
  const active = ings.data?.find((i) => i.id === activeId) ?? null;
  const rows = useMemo(
    () => (history.data ?? []).filter((r) => r.ingredient_id === activeId),
    [history.data, activeId]
  );

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const prices = rows.map((r) => Number(r.unit_price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const last = prices[prices.length - 1];
    const first = prices[0];
    const variation = first > 0 ? ((last - first) / first) * 100 : 0;
    return { min, max, avg, last, variation };
  }, [rows]);

  const alerts = useMemo(() => {
    const out: { ingredient: string; variation: number }[] = [];
    (ings.data ?? []).forEach((i) => {
      const list = (history.data ?? []).filter((r) => r.ingredient_id === i.id).map((r) => Number(r.unit_price));
      if (list.length < 2) return;
      const last = list[list.length - 1];
      const prev = list[list.length - 2];
      const v = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      if (Math.abs(v) >= 10) out.push({ ingredient: i.name, variation: v });
    });
    return out;
  }, [ings.data, history.data]);

  const chartData = useMemo(
    () => rows.map((r) => ({
      date: new Date(r.purchase_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      price: Number(r.unit_price),
    })),
    [rows]
  );

  const createIng = useMutation({
    mutationFn: async () => {
      if (!ingForm.name.trim() || !restaurant) return;
      const { error } = await supabase.from("ingredients").insert({
        restaurant_id: restaurant.id, name: ingForm.name.trim(), unit: ingForm.unit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpenIng(false); setIngForm({ name: "", unit: "un" });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingrediente criado");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  const addPrice = useMutation({
    mutationFn: async () => {
      if (!activeId || !restaurant || !priceForm.unit_price) return;
      const { error } = await supabase.from("price_history").insert({
        restaurant_id: restaurant.id,
        ingredient_id: activeId,
        unit_price: Number(priceForm.unit_price),
        purchase_date: priceForm.purchase_date,
        supplier_id: priceForm.supplier_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpenPrice(false); setPriceForm({ unit_price: "", purchase_date: new Date().toISOString().slice(0, 10), supplier_id: "" });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Preço registrado");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Histórico de Preços</h1>
          <p className="text-sm text-muted-foreground mt-1">Registre cada compra e acompanhe a evolução do custo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenIng(true)}><Plus className="h-4 w-4" /> Ingrediente</Button>
          <Button onClick={() => setOpenPrice(true)} disabled={!activeId}><Plus className="h-4 w-4" /> Registrar preço</Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Alertas de variação</div>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {alerts.map((a) => (
                  <li key={a.ingredient}>
                    <b>{a.ingredient}</b> variou {a.variation > 0 ? "+" : ""}{a.variation.toFixed(1)}% na última compra
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <Card className="p-3 h-fit">
          <div className="text-xs uppercase text-muted-foreground mb-2 px-2">Ingredientes</div>
          <div className="space-y-1">
            {(ings.data ?? []).map((i) => (
              <button
                key={i.id}
                onClick={() => setSelected(i.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeId === i.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                <div className="font-medium truncate">{i.name}</div>
                <div className={`text-xs ${activeId === i.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {formatBRL(Number(i.current_price))} / {i.unit}
                </div>
              </button>
            ))}
            {(ings.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">Nenhum ingrediente</div>
            )}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          {active ? (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-semibold">{active.name}</div>
                  <div className="text-xs text-muted-foreground">Unidade: {active.unit}</div>
                </div>
                {stats && (
                  <div className={`inline-flex items-center gap-1 text-sm font-medium ${
                    stats.variation > 0 ? "text-destructive" : stats.variation < 0 ? "text-green-600" : "text-muted-foreground"
                  }`}>
                    {stats.variation > 0 ? <TrendingUp className="h-4 w-4" /> : stats.variation < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    {stats.variation > 0 ? "+" : ""}{stats.variation.toFixed(1)}% no período
                  </div>
                )}
              </div>

              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MiniCard label="Último" value={formatBRL(stats.last)} />
                  <MiniCard label="Médio" value={formatBRL(stats.avg)} />
                  <MiniCard label="Menor" value={formatBRL(stats.min)} accent="green" />
                  <MiniCard label="Maior" value={formatBRL(stats.max)} accent="red" />
                </div>
              )}

              {chartData.length > 1 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                      <ReTooltip formatter={(v: any) => formatBRL(Number(v))} />
                      <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-10">
                  Registre pelo menos 2 preços para ver a evolução.
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-2">Últimos registros</div>
                <div className="space-y-1 text-sm">
                  {rows.slice(-8).reverse().map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                      <span>{new Date(r.purchase_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      <span className="font-medium">{formatBRL(Number(r.unit_price))}</span>
                    </div>
                  ))}
                  {rows.length === 0 && <div className="text-xs text-muted-foreground">Nenhum registro ainda.</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-16">
              Crie um ingrediente para começar.
            </div>
          )}
        </Card>
      </div>

      <Dialog open={openIng} onOpenChange={setOpenIng}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo ingrediente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={ingForm.name} onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })} /></div>
            <div><Label>Unidade</Label>
              <Select value={ingForm.unit} onValueChange={(v) => setIngForm({ ...ingForm, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">Unidade (un)</SelectItem>
                  <SelectItem value="kg">Quilo (kg)</SelectItem>
                  <SelectItem value="g">Grama (g)</SelectItem>
                  <SelectItem value="l">Litro (l)</SelectItem>
                  <SelectItem value="ml">Mililitro (ml)</SelectItem>
                  <SelectItem value="cx">Caixa (cx)</SelectItem>
                  <SelectItem value="pct">Pacote (pct)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenIng(false)}>Cancelar</Button>
            <Button onClick={() => createIng.mutate()} disabled={!ingForm.name.trim() || createIng.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPrice} onOpenChange={setOpenPrice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar preço {active ? `— ${active.name}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Preço unitário (R$) *</Label>
              <Input type="number" step="0.01" value={priceForm.unit_price} onChange={(e) => setPriceForm({ ...priceForm, unit_price: e.target.value })} />
            </div>
            <div><Label>Data da compra</Label>
              <Input type="date" value={priceForm.purchase_date} onChange={(e) => setPriceForm({ ...priceForm, purchase_date: e.target.value })} />
            </div>
            <div><Label>Fornecedor</Label>
              <Select value={priceForm.supplier_id || "none"} onValueChange={(v) => setPriceForm({ ...priceForm, supplier_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(suppliers.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenPrice(false)}>Cancelar</Button>
            <Button onClick={() => addPrice.mutate()} disabled={!priceForm.unit_price || addPrice.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniCard({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" }) {
  const color = accent === "green" ? "text-green-600" : accent === "red" ? "text-destructive" : "";
  return (
    <div className="p-3 rounded-lg bg-secondary/40 border border-border/60">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}