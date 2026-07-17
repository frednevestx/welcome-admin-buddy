import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Save, FileDown, Sparkles } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";

export const Route = createFileRoute("/_authenticated/calculadora-preco")({
  component: () => (
    <PlanGate min="pro" featureName="Calculadora Inteligente de Preço" description="Calcule custo, margem e o preço ideal de cada produto.">
      <CalculadoraPage />
    </PlanGate>
  ),
});

type Ingredient = { id: string; name: string; qty: number; unitPrice: number };
type Product = {
  id: string;
  name: string;
  yieldUnits: number;
  ingredients: Ingredient[];
  packaging: number;
  ifoodFee: number;
  cardFee: number;
  otherCosts: number;
  targetMargin: number;
  notes: string;
  createdAt: string;
};

const STORAGE_KEY = "systen:products";

function emptyIngredient(): Ingredient {
  return { id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0 };
}
function emptyProduct(): Product {
  return {
    id: crypto.randomUUID(), name: "", yieldUnits: 1,
    ingredients: [emptyIngredient()],
    packaging: 0, ifoodFee: 27, cardFee: 3, otherCosts: 0,
    targetMargin: 30, notes: "", createdAt: new Date().toISOString(),
  };
}

function CalculadoraPage() {
  const { restaurant } = useRestaurant();
  const scope = restaurant?.id || "guest";
  const [products, setProducts] = useState<Product[]>([]);
  const [current, setCurrent] = useState<Product>(emptyProduct());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${scope}`);
      if (raw) setProducts(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [scope]);

  function persist(list: Product[]) {
    setProducts(list);
    localStorage.setItem(`${STORAGE_KEY}:${scope}`, JSON.stringify(list));
  }

  const calc = useMemo(() => {
    const ingredientsTotal = current.ingredients.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const packaging = current.packaging * current.yieldUnits;
    const other = current.otherCosts * current.yieldUnits;
    const totalCost = ingredientsTotal + packaging + other;
    const unitCost = current.yieldUnits > 0 ? totalCost / current.yieldUnits : 0;

    const feeRate = (current.ifoodFee + current.cardFee) / 100;
    // preço mínimo: cobre custos + taxas sem margem
    // (preço * (1 - feeRate)) = unitCost => preço = unitCost / (1 - feeRate)
    const minPrice = feeRate < 1 ? unitCost / (1 - feeRate) : 0;
    // preço ideal: unitCost / (1 - feeRate - margem)
    const marginRate = current.targetMargin / 100;
    const denom = 1 - feeRate - marginRate;
    const idealPrice = denom > 0 ? unitCost / denom : 0;
    // preço sugerido: arredonda para .90
    const suggested = idealPrice > 0 ? Math.max(minPrice, Math.floor(idealPrice) + 0.9) : 0;

    const profitPerUnit = idealPrice - unitCost - idealPrice * feeRate;
    const actualMargin = idealPrice > 0 ? (profitPerUnit / idealPrice) * 100 : 0;

    return { ingredientsTotal, packaging, other, totalCost, unitCost, minPrice, idealPrice, suggested, profitPerUnit, actualMargin };
  }, [current]);

  function setIng(id: string, patch: Partial<Ingredient>) {
    setCurrent({ ...current, ingredients: current.ingredients.map((i) => i.id === id ? { ...i, ...patch } : i) });
  }
  function addIng() {
    setCurrent({ ...current, ingredients: [...current.ingredients, emptyIngredient()] });
  }
  function removeIng(id: string) {
    setCurrent({ ...current, ingredients: current.ingredients.filter((i) => i.id !== id) });
  }

  function save() {
    if (!current.name.trim()) { toast.error("Dê um nome ao produto"); return; }
    const existing = products.findIndex((p) => p.id === current.id);
    const updated = existing >= 0 ? products.map((p) => p.id === current.id ? current : p) : [...products, current];
    persist(updated);
    toast.success("Produto salvo");
  }
  function duplicate() {
    const dup: Product = { ...current, id: crypto.randomUUID(), name: current.name + " (cópia)", createdAt: new Date().toISOString() };
    persist([...products, dup]);
    setCurrent(dup);
    toast.success("Produto duplicado");
  }
  function load(p: Product) { setCurrent(p); }
  function del(id: string) {
    persist(products.filter((p) => p.id !== id));
    if (current.id === id) setCurrent(emptyProduct());
  }
  function fresh() { setCurrent(emptyProduct()); }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calculadora de Preço</h1>
          <p className="text-sm text-muted-foreground mt-1">Descubra o preço ideal que cobre custos, taxas e mantém sua margem.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fresh}><FileDown className="h-4 w-4" /> Novo</Button>
          <Button variant="outline" onClick={duplicate}><Copy className="h-4 w-4" /> Duplicar</Button>
          <Button onClick={save}><Save className="h-4 w-4" /> Salvar</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Nome do produto</Label>
                <Input value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} placeholder="Ex: Combo Família" />
              </div>
              <div><Label>Rendimento (unidades)</Label>
                <Input type="number" step="1" min="1" value={current.yieldUnits}
                  onChange={(e) => setCurrent({ ...current, yieldUnits: Number(e.target.value) || 1 })} />
              </div>
              <div><Label>Margem desejada (%)</Label>
                <Input type="number" step="0.5" value={current.targetMargin}
                  onChange={(e) => setCurrent({ ...current, targetMargin: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Ingredientes</div>
              <Button variant="ghost" size="sm" onClick={addIng}><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            <div className="space-y-2">
              {current.ingredients.map((i, idx) => (
                <div key={i.id} className="grid grid-cols-[1fr_90px_120px_36px] gap-2 items-center">
                  <Input placeholder={`Ingrediente ${idx + 1}`} value={i.name} onChange={(e) => setIng(i.id, { name: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Qtd" value={i.qty} onChange={(e) => setIng(i.id, { qty: Number(e.target.value) || 0 })} />
                  <Input type="number" step="0.01" placeholder="R$ unit" value={i.unitPrice} onChange={(e) => setIng(i.id, { unitPrice: Number(e.target.value) || 0 })} />
                  <Button variant="ghost" size="icon" onClick={() => removeIng(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-right">
              Total ingredientes: <b className="text-foreground">{formatBRL(calc.ingredientsTotal)}</b>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="font-medium">Custos e taxas</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Embalagem por unidade (R$)</Label>
                <Input type="number" step="0.01" value={current.packaging} onChange={(e) => setCurrent({ ...current, packaging: Number(e.target.value) || 0 })} />
              </div>
              <div><Label>Outras despesas por unidade (R$)</Label>
                <Input type="number" step="0.01" value={current.otherCosts} onChange={(e) => setCurrent({ ...current, otherCosts: Number(e.target.value) || 0 })} />
              </div>
              <div><Label>Taxa iFood (%)</Label>
                <Input type="number" step="0.1" value={current.ifoodFee} onChange={(e) => setCurrent({ ...current, ifoodFee: Number(e.target.value) || 0 })} />
              </div>
              <div><Label>Taxa cartão (%)</Label>
                <Input type="number" step="0.1" value={current.cardFee} onChange={(e) => setCurrent({ ...current, cardFee: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <Label>Observações</Label>
            <Textarea value={current.notes} onChange={(e) => setCurrent({ ...current, notes: e.target.value })} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 space-y-3" style={{ background: "linear-gradient(180deg, oklch(0.72 0.18 148 / 0.06), var(--card))" }}>
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Resultado
            </div>
            <ResultRow label="Custo total do lote" value={formatBRL(calc.totalCost)} />
            <ResultRow label="Custo unitário" value={formatBRL(calc.unitCost)} bold />
            <div className="h-px bg-border my-2" />
            <ResultRow label="Preço mínimo" value={formatBRL(calc.minPrice)} />
            <ResultRow label="Preço ideal" value={formatBRL(calc.idealPrice)} />
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mt-2">
              <div className="text-xs text-muted-foreground">Preço sugerido</div>
              <div className="text-2xl font-bold text-primary">{formatBRL(calc.suggested)}</div>
            </div>
            <ResultRow label="Lucro por unidade" value={formatBRL(calc.profitPerUnit)} />
            <ResultRow label="Margem real" value={`${calc.actualMargin.toFixed(1)}%`} />
          </Card>

          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-2">Produtos salvos ({products.length})</div>
            <div className="space-y-1 max-h-72 overflow-auto">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => load(p)}
                    className={`flex-1 text-left px-2 py-1.5 rounded text-sm truncate ${current.id === p.id ? "bg-secondary font-medium" : "hover:bg-secondary/60"}`}
                  >
                    {p.name || "Sem nome"}
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => del(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {products.length === 0 && <div className="text-xs text-muted-foreground p-2 text-center">Nenhum produto salvo.</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}