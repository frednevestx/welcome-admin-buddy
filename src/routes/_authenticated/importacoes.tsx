import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, X, Sparkles, Plus, Trash2, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatBRL } from "@/lib/format";
import { processarPedidosManuais } from "@/lib/pedidos-manuais.functions";

export const Route = createFileRoute("/_authenticated/importacoes")({
  component: EntradaVendasPage,
  head: () => ({
    meta: [
      { title: "Entrada de Vendas — LUUD" },
      { name: "description", content: "Importe planilhas do iFood/99Food ou lance pedidos manualmente na planilha inteligente." },
    ],
  }),
});

function EntradaVendasPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrada de Vendas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre suas vendas importando planilhas do iFood/99Food ou lançando pedidos manuais na planilha inteligente.
        </p>
      </div>
      <Tabs defaultValue="planilha" className="w-full">
        <TabsList>
          <TabsTrigger value="planilha" className="gap-2"><TableIcon className="h-4 w-4" /> Planilha inteligente</TabsTrigger>
          <TabsTrigger value="import" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Importar iFood / 99Food</TabsTrigger>
        </TabsList>
        <TabsContent value="planilha" className="mt-4">
          <PlanilhaInteligente />
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <ImportsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// PLANILHA INTELIGENTE
// ============================================================

type PedidoRow = {
  id: string;
  descricao: string | null;
  cliente: string | null;
  telefone: string | null;
  cidade: string | null;
  quantidade: number | null;
  valor: number | null;
  forma_pagamento: string | null;
  pedido_data: string | null;
  observacao: string | null;
  processed_at: string | null;
  movement_id: string | null;
};

const EMPTY_ROW = (): Omit<PedidoRow, "id"> => ({
  descricao: "",
  cliente: "",
  telefone: "",
  cidade: "",
  quantidade: null,
  valor: null,
  forma_pagamento: "",
  pedido_data: new Date().toISOString().slice(0, 10),
  observacao: "",
  processed_at: null,
  movement_id: null,
});

const PAYMENT_OPTIONS = ["", "Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "WhatsApp", "Balcão"];

function PlanilhaInteligente() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const processar = useServerFn(processarPedidosManuais);
  const [processing, setProcessing] = useState(false);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos-manuais", restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [] as PedidoRow[];
      const { data, error } = await supabase
        .from("pedidos_manuais")
        .select("id, descricao, cliente, telefone, cidade, quantidade, valor, forma_pagamento, pedido_data, observacao, processed_at, movement_id")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PedidoRow[];
    },
    enabled: !!restaurant,
  });

  const [draft, setDraft] = useState<Record<string, Partial<PedidoRow>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const rows = pedidos ?? [];

  const totals = useMemo(() => {
    const unprocessed = rows.filter((r) => !r.processed_at && Number(r.valor) > 0);
    return {
      total: rows.length,
      pendentes: unprocessed.length,
      valorPendente: unprocessed.reduce((a, r) => a + (Number(r.valor) || 0), 0),
      processados: rows.filter((r) => r.processed_at).length,
    };
  }, [rows]);

  const addRow = useCallback(async () => {
    if (!restaurant) return;
    const { data, error } = await supabase
      .from("pedidos_manuais")
      .insert({ restaurant_id: restaurant.id, ...EMPTY_ROW() })
      .select("id")
      .single();
    if (error) {
      toast.error(translateAuthError(error, "Erro ao adicionar linha"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["pedidos-manuais", restaurant.id] });
  }, [restaurant, qc]);

  const removeRow = useCallback(async (id: string) => {
    const { error } = await supabase.from("pedidos_manuais").delete().eq("id", id);
    if (error) {
      toast.error(translateAuthError(error, "Erro ao remover"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["pedidos-manuais", restaurant?.id] });
  }, [qc, restaurant]);

  const persist = useCallback(async (id: string, patch: Partial<PedidoRow>) => {
    setSavingIds((s) => new Set(s).add(id));
    const { error } = await supabase.from("pedidos_manuais").update(patch).eq("id", id);
    setSavingIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    if (error) {
      toast.error(translateAuthError(error, "Erro ao salvar"));
    }
  }, []);

  const onFieldChange = useCallback(
    (id: string, field: keyof PedidoRow, value: any) => {
      setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(async () => {
        const current = { ...(draft[id] ?? {}), [field]: value };
        await persist(id, current);
        setDraft((d) => {
          const n = { ...d };
          delete n[id];
          return n;
        });
        qc.invalidateQueries({ queryKey: ["pedidos-manuais", restaurant?.id] });
      }, 800);
    },
    [draft, persist, qc, restaurant],
  );

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  async function handleProcessar() {
    setProcessing(true);
    try {
      const res = (await processar()) as { processed: number };
      if (res.processed === 0) {
        toast.info("Nenhum pedido pendente para processar.");
      } else {
        toast.success(`${res.processed} pedido(s) viraram vendas no caixa`);
      }
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(translateAuthError(e, "Erro ao processar pedidos"));
    } finally {
      setProcessing(false);
    }
  }

  function cellValue<K extends keyof PedidoRow>(row: PedidoRow, field: K): PedidoRow[K] {
    const d = draft[row.id];
    if (d && field in d) return (d as any)[field];
    return row[field];
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              Preencha os pedidos linha a linha. Salvamento automático. Ao clicar em <b>Processar com IA</b>, os pedidos pendentes viram vendas no caixa (categoria Venda WhatsApp/Balcão conforme a forma de pagamento).
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-2">
              <Plus className="h-4 w-4" /> Nova linha
            </Button>
            <Button size="sm" onClick={handleProcessar} disabled={processing || totals.pendentes === 0} className="gap-2">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Processar com IA ({totals.pendentes})
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryTile label="Linhas" value={String(totals.total)} />
          <SummaryTile label="Pendentes" value={String(totals.pendentes)} />
          <SummaryTile label="Valor pendente" value={formatBRL(totals.valorPendente)} />
          <SummaryTile label="Já no caixa" value={String(totals.processados)} />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium w-24">Data</th>
                <th className="px-2 py-2 font-medium">Descrição</th>
                <th className="px-2 py-2 font-medium">Cliente</th>
                <th className="px-2 py-2 font-medium w-32">Telefone</th>
                <th className="px-2 py-2 font-medium w-20 text-right">Qtd</th>
                <th className="px-2 py-2 font-medium w-28 text-right">Valor</th>
                <th className="px-2 py-2 font-medium w-40">Pagamento</th>
                <th className="px-2 py-2 font-medium w-32">Cidade</th>
                <th className="px-2 py-2 font-medium">Obs.</th>
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Nenhum pedido ainda. Clique em <b>Nova linha</b> para começar.
                </td></tr>
              )}
              {rows.map((r) => {
                const done = !!r.processed_at;
                return (
                  <tr key={r.id} className={`border-t border-border/60 ${done ? "opacity-60" : ""}`}>
                    <td className="px-2 py-1">
                      <Input
                        type="date"
                        disabled={done}
                        value={(cellValue(r, "pedido_data") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "pedido_data", e.target.value || null)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        disabled={done}
                        value={(cellValue(r, "descricao") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "descricao", e.target.value)}
                        placeholder="Ex: 2 pizzas grandes + refri"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        disabled={done}
                        value={(cellValue(r, "cliente") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "cliente", e.target.value)}
                        placeholder="Nome"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        disabled={done}
                        value={(cellValue(r, "telefone") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "telefone", e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="1"
                        disabled={done}
                        value={(cellValue(r, "quantidade") as number | null) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "quantidade", e.target.value === "" ? null : Number(e.target.value))}
                        className="h-8 text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={done}
                        value={(cellValue(r, "valor") as number | null) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "valor", e.target.value === "" ? null : Number(e.target.value))}
                        placeholder="0,00"
                        className="h-8 text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        disabled={done}
                        value={(cellValue(r, "forma_pagamento") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "forma_pagamento", e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {PAYMENT_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o || "—"}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        disabled={done}
                        value={(cellValue(r, "cidade") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "cidade", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        disabled={done}
                        value={(cellValue(r, "observacao") as string) ?? ""}
                        onChange={(e) => onFieldChange(r.id, "observacao", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      {savingIds.has(r.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin inline-block text-muted-foreground" />
                      ) : done ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3 w-3" /> IA</span>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// IMPORT iFood / 99Food (código original)
// ============================================================

type SourceKey = "ifood" | "99food";

interface ParsedRow {
  sale_date: string;
  gross_amount: number;
  net_amount: number;
  orders_count: number;
  commission: number;
  fees: number;
  coupons: number;
  cancellations: number;
}

const IFOOD_ALIASES: Record<keyof ParsedRow, string[]> = {
  sale_date: ["data", "date", "dia", "data pedido", "data do pedido", "data de fechamento"],
  gross_amount: ["valor bruto", "bruto", "total bruto", "valor total", "total vendas", "gross"],
  net_amount: ["valor liquido", "liquido", "repasse", "valor a receber", "net"],
  orders_count: ["pedidos", "qtd pedidos", "quantidade", "n pedidos", "orders", "total pedidos"],
  commission: ["comissao", "taxa", "taxa marketplace", "commission"],
  fees: ["taxa entrega", "taxas", "taxa servico", "fees", "outras taxas"],
  coupons: ["cupons", "cupom", "desconto", "descontos", "promocao", "coupons"],
  cancellations: ["cancelamentos", "cancelados", "cancelado", "cancellations"],
};

const FOOD99_ALIASES: Record<keyof ParsedRow, string[]> = {
  sale_date: ["data", "date", "dia"],
  gross_amount: ["receita total de vendas", "receita total", "receita de vendas"],
  net_amount: ["valor liquido", "repasse", "valor a receber"],
  orders_count: ["total de vendas realizadas", "total de pedidos", "pedidos"],
  commission: ["despesas de comissao da loja", "comissao da loja", "comissao"],
  fees: ["taxa de canal de pagamento da loja", "taxa de pagamento", "taxa de canal"],
  coupons: ["despesas de ofertas da loja", "ofertas da loja", "cupons"],
  cancellations: ["valor da perda de pedido por cancelamentos", "valor de cancelamentos"],
};

function normalize(s: string) {
  return s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function findColumn(headers: string[], aliases: string[], numeric = false): number {
  const norm = headers.map(normalize);
  for (const alias of aliases) {
    const a = normalize(alias);
    const idx = norm.findIndex(
      (h) =>
        (h === a || h.includes(a)) &&
        // colunas de percentual e de data nunca servem como valor monetário
        (!numeric || (!h.includes("percentual") && !h.includes("data") && !h.includes("date"))),
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

const DATE_LIKE = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/;
function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (v instanceof Date) return 0;
  if (typeof v === "number") return v;
  const raw = String(v).trim();
  if (DATE_LIKE.test(raw)) return 0; // nunca interpretar data como valor
  const s = raw.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/\d/.test(s)) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (br) {
    const y = br[3].length === 2 ? "20" + br[3] : br[3];
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Detecta o Relatório de Conciliação do iFood (uma linha por lançamento financeiro). */
function isIfoodConciliation(headers: string[]): boolean {
  const h = headers.map(normalize);
  const has = (n: string) => h.some((x) => x === n);
  return has("fato gerador") && has("tipo lancamento") && has("valor") && has("pedido associado ifood");
}

/**
 * Leitor do Relatório de Conciliação do iFood.
 * Agrupa por dia do pedido: pedidos distintos, cesta bruta por pedido,
 * custos por tipo de lançamento e repasse = soma da coluna "valor".
 */
function parseIfoodConciliation(json: Record<string, unknown>[]): ParsedRow[] {
  interface Acc extends ParsedRow {
    orderIds: Set<string>;
  }
  const map = new Map<string, Acc>();
  const seenOrders = new Set<string>();

  for (const r of json) {
    const date =
      toDate(r["data_criacao_pedido_associado"]) ??
      toDate(r["data_faturamento"]) ??
      toDate(r["data_apuracao_inicio"]);
    if (!date) continue;

    const valor = toNumber(r["valor"]);
    const tipo = normalize(String(r["tipo_lancamento"] ?? ""));
    const fato = normalize(String(r["fato_gerador"] ?? ""));
    const desc = normalize(String(r["descricao_lancamento"] ?? ""));
    const orderId = String(r["pedido_associado_ifood"] ?? "").trim();

    let acc = map.get(date);
    if (!acc) {
      acc = {
        sale_date: date,
        gross_amount: 0,
        net_amount: 0,
        orders_count: 0,
        commission: 0,
        fees: 0,
        coupons: 0,
        cancellations: 0,
        orderIds: new Set<string>(),
      };
      map.set(date, acc);
    }

    // repasse real do iFood
    acc.net_amount += valor;

    // pedido distinto + cesta bruta (uma vez por pedido)
    if (orderId && !seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      acc.orderIds.add(orderId);
      acc.gross_amount += toNumber(r["valor_cesta_final"]);
    }

    const abs = Math.abs(valor);
    if (fato.includes("cancelamento")) {
      acc.cancellations += abs;
    } else if (tipo.includes("retencao") || desc.includes("comissao") || desc.includes("taxa de servico")) {
      acc.commission += abs;
    } else if (fato.includes("frete") || desc.includes("entrega") || desc.includes("pagamento")) {
      acc.fees += abs;
    } else if (tipo.includes("subsidio") && valor < 0) {
      // promoção custeada pela loja é custo; custeada pelo iFood é crédito
      acc.coupons += abs;
    }
  }

  return Array.from(map.values())
    .map(({ orderIds, ...row }) => ({ ...row, orders_count: orderIds.size }))
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date));
}

/** Detecta o relatório "Dados da loja" da 99Food (uma linha por dia). */
function is99FoodDaily(headers: string[]): boolean {
  const h = headers.map(normalize);
  const has = (n: string) => h.some((x) => x.includes(n));
  return has("total de vendas realizadas") && has("receita total de vendas");
}

/**
 * Leitor do relatório diário da 99Food: mapeia colunas por nome exato,
 * evitando confundir contagens/percentuais com valores.
 */
function parse99FoodDaily(json: Record<string, unknown>[]): ParsedRow[] {
  const map = new Map<string, ParsedRow>();
  const pick = (r: Record<string, unknown>, needle: string): unknown => {
    const key = Object.keys(r).find((k) => normalize(k) === normalize(needle));
    return key ? r[key] : "";
  };

  for (const r of json) {
    const date = toDate(pick(r, "Data"));
    if (!date) continue;

    const orders = Math.round(toNumber(pick(r, "Total de vendas realizadas")));
    const gross = toNumber(pick(r, "Receita total de vendas"));
    const commission = Math.abs(toNumber(pick(r, "Despesas de comissão da loja")));
    const paymentFee = Math.abs(toNumber(pick(r, "Taxa de canal de pagamento da loja")));
    const coupons = Math.abs(toNumber(pick(r, "Despesas de ofertas da loja")));
    const rewards = Math.abs(toNumber(pick(r, "Recompensas da plataforma")));
    const cancellations = Math.abs(
      toNumber(pick(r, "Valor da perda de pedido por cancelamentos por parte da loja")),
    );

    // repasse = venda - comissão - taxa de pagamento - ofertas custeadas - cancelamentos + recompensas
    const net = gross - commission - paymentFee - coupons - cancellations + rewards;

    const acc = map.get(date);
    if (acc) {
      acc.orders_count += orders;
      acc.gross_amount += gross;
      acc.commission += commission;
      acc.fees += paymentFee;
      acc.coupons += coupons;
      acc.cancellations += cancellations;
      acc.net_amount += net;
    } else {
      map.set(date, {
        sale_date: date,
        orders_count: orders,
        gross_amount: gross,
        commission,
        fees: paymentFee,
        coupons,
        cancellations,
        net_amount: net,
      });
    }
  }

  return Array.from(map.values())
    .filter((r) => r.orders_count > 0 || r.gross_amount !== 0)
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date));
}



async function parseFile(
  file: File,
  source: SourceKey,
): Promise<{ headers: string[]; rows: ParsedRow[]; detected: SourceKey }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  if (json.length === 0) return { headers: [], rows: [], detected: source };
  const headers = Object.keys(json[0]);

  if (isIfoodConciliation(headers)) {
    return { headers, rows: parseIfoodConciliation(json), detected: "ifood" };
  }

  if (is99FoodDaily(headers)) {
    return { headers, rows: parse99FoodDaily(json), detected: "99food" };
  }


  const ALIASES = source === "99food" ? FOOD99_ALIASES : IFOOD_ALIASES;
  const idx = {
    sale_date: findColumn(headers, ALIASES.sale_date),
    gross_amount: findColumn(headers, ALIASES.gross_amount, true),
    net_amount: findColumn(headers, ALIASES.net_amount, true),
    orders_count: findColumn(headers, ALIASES.orders_count, true),
    commission: findColumn(headers, ALIASES.commission, true),
    fees: findColumn(headers, ALIASES.fees, true),
    coupons: findColumn(headers, ALIASES.coupons, true),
    cancellations: findColumn(headers, ALIASES.cancellations, true),
  };

  if (idx.sale_date < 0) throw new Error("Não encontrei a coluna de data. Verifique se o arquivo tem uma coluna como 'Data'.");
  if (idx.gross_amount < 0 && idx.net_amount < 0) throw new Error("Não encontrei coluna de valor (bruto ou líquido).");

  const map = new Map<string, ParsedRow>();
  for (const r of json) {
    const vals = Object.values(r);
    const date = toDate(vals[idx.sale_date]);
    if (!date) continue;
    let gross = idx.gross_amount >= 0 ? toNumber(vals[idx.gross_amount]) : 0;
    const net = idx.net_amount >= 0 ? toNumber(vals[idx.net_amount]) : 0;
    const orders = idx.orders_count >= 0 ? toNumber(vals[idx.orders_count]) : 1;
    const commission = idx.commission >= 0 ? toNumber(vals[idx.commission]) : 0;
    const fees = idx.fees >= 0 ? toNumber(vals[idx.fees]) : 0;
    const coupons = idx.coupons >= 0 ? toNumber(vals[idx.coupons]) : 0;
    const cancellations = idx.cancellations >= 0 ? toNumber(vals[idx.cancellations]) : 0;
    if (gross === 0 && net > 0) {
      gross = net + commission + Math.abs(fees) + (source === "ifood" ? coupons : 0) + cancellations;
    }
    const netFinal = net ? net : source === "99food" ? gross - commission - Math.abs(fees) - cancellations : gross - commission - Math.abs(fees) - coupons - cancellations;
    const existing = map.get(date);
    if (existing) {
      existing.gross_amount += gross;
      existing.net_amount += netFinal;
      existing.orders_count += orders;
      existing.commission += commission;
      existing.fees += fees;
      existing.coupons += coupons;
      existing.cancellations += cancellations;
    } else {
      map.set(date, { sale_date: date, gross_amount: gross, net_amount: netFinal, orders_count: orders, commission, fees, coupons, cancellations });
    }
  }
  const rows = Array.from(map.values()).sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  return { headers, rows, detected: source };
}

function ImportsSection() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SourceKey>("ifood");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({ gross: acc.gross + r.gross_amount, net: acc.net + r.net_amount, orders: acc.orders + r.orders_count }),
    { gross: 0, net: 0, orders: 0 },
  ), [rows]);

  const history = useQuery({
    queryKey: ["imports-history", restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [];
      const { data } = await supabase.from("imports").select("id, filename, source, rows_imported, imported_at").eq("restaurant_id", restaurant.id).order("imported_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!restaurant,
  });

  async function handleFile(f: File) {
    setFile(f);
    setRows([]);
    setParsing(true);
    try {
      const res = await parseFile(f, source);
      if (res.rows.length === 0) throw new Error("Nenhuma linha válida encontrada no arquivo.");
      setRows(res.rows);
      if (res.detected !== source) {
        setSource(res.detected);
        toast.info(`Detectamos um relatório do ${res.detected === "ifood" ? "iFood" : "99Food"}.`);
      }
      toast.success(`${res.rows.length} dia(s) prontos para importar`);
    } catch (e: any) {
      toast.error(translateAuthError(e, "Não foi possível ler o arquivo"));
      setFile(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!restaurant || rows.length === 0 || !file) return;
    setImporting(true);
    try {
      const { data: imp, error: impErr } = await supabase
        .from("imports")
        .insert({ restaurant_id: restaurant.id, filename: file.name, source, rows_imported: rows.length })
        .select("id")
        .single();
      if (impErr) throw impErr;

      const dates = rows.map((r) => r.sale_date);
      // reimportar o mesmo período substitui os dias, nunca duplica
      const { error: delErr } = await supabase
        .from("sales")
        .delete()
        .eq("restaurant_id", restaurant.id)
        .eq("source", source)
        .in("sale_date", dates);
      if (delErr) throw delErr;

      const salesRows = rows.map((r) => ({
        restaurant_id: restaurant.id,
        import_id: imp.id,
        source,
        origin: "importado" as const,
        source_ref: `${source}:planilha`,
        sale_date: r.sale_date,
        gross_amount: r.gross_amount,
        net_amount: r.net_amount,
        orders_count: Math.round(r.orders_count),
        commission: r.commission,
        fees: r.fees,
        coupons: r.coupons,
        cancellations: r.cancellations,
      }));
      const { error: salesErr } = await supabase.from("sales").insert(salesRows);
      if (salesErr) throw salesErr;

      const from = dates.reduce((a, b) => (a < b ? a : b));
      const to = dates.reduce((a, b) => (a > b ? a : b));

      toast.success(`Importação concluída: ${rows.length} dia(s) sincronizados`);
      setFile(null);
      setRows([]);
      if (inputRef.current) inputRef.current.value = "";
      await qc.invalidateQueries();
      navigate({ to: "/dashboard", search: { from, to } });
    } catch (e: any) {
      toast.error(translateAuthError(e, "Erro ao importar"));
    } finally {
      setImporting(false);
    }
  }


  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Origem</Label>
            <div className="flex gap-2">
              <Button type="button" variant={source === "ifood" ? "default" : "outline"} size="sm" onClick={() => setSource("ifood")}>iFood</Button>
              <Button type="button" variant={source === "99food" ? "default" : "outline"} size="sm" onClick={() => setSource("99food")}>99Food</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo (.csv, .xlsx, .xls)</Label>
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                id="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-accent"
              />
              {file && (
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setRows([]); if (inputRef.current) inputRef.current.value = ""; }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo arquivo...
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryTile label="Dias" value={String(rows.length)} />
              <SummaryTile label="Pedidos" value={String(totals.orders)} />
              <SummaryTile label="Total vendido" value={formatBRL(totals.gross)} />
              <SummaryTile label="Total a receber" value={formatBRL(totals.net)} />
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium text-right">Pedidos</th>
                      <th className="px-3 py-2 font-medium text-right">Vendido</th>
                      <th className="px-3 py-2 font-medium text-right">Taxas</th>
                      <th className="px-3 py-2 font-medium text-right">A receber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.sale_date} className="border-t border-border/60">
                        <td className="px-3 py-2">{r.sale_date.split("-").reverse().join("/")}</td>
                        <td className="px-3 py-2 text-right">{r.orders_count}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(r.gross_amount)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatBRL(r.commission + r.fees + r.coupons)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatBRL(r.net_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar importação
              </Button>
            </div>
          </div>
        )}

        {!file && !parsing && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Selecione o relatório exportado do painel do iFood ou 99Food.</p>
            <p className="text-xs text-muted-foreground mt-1">Reconhecemos colunas como Data, Valor Bruto, Valor Líquido, Pedidos, Comissão, Taxas e Cupons.</p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Importações recentes</h2>
        </div>
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não importou nenhum arquivo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.data!.map((h) => (
              <li key={h.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{h.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.source === "ifood" ? "iFood" : h.source === "99food" ? "99Food" : "Loja"} · {h.rows_imported} dia(s)
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{new Date(h.imported_at).toLocaleDateString("pt-BR")}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
