import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/importacoes")({
  component: ImportsPage,
});

type SourceKey = "ifood" | "99food";

interface ParsedRow {
  sale_date: string; // yyyy-mm-dd
  gross_amount: number;
  net_amount: number;
  orders_count: number;
  commission: number;
  fees: number;
  coupons: number;
  cancellations: number;
}

// Column name candidates by source (case/accents-insensitive)
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

// 99Food (relatório "Dados da loja")
const FOOD99_ALIASES: Record<keyof ParsedRow, string[]> = {
  sale_date: ["data", "date", "dia"],
  gross_amount: ["receita total de vendas", "receita total", "receita de vendas"],
  net_amount: ["valor liquido", "repasse", "valor a receber"],
  orders_count: ["total de vendas realizadas", "total de pedidos", "pedidos"],
  commission: ["despesas de comissao da loja", "comissao da loja", "comissao"],
  fees: ["taxa de canal de pagamento da loja", "taxa de pagamento", "taxa de canal"],
  coupons: ["despesas de ofertas da loja", "ofertas da loja", "cupons"],
  cancellations: ["cancelamentos", "cancelados"],
};


function normalize(s: string) {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(headers: string[], aliases: string[]): number {
  const norm = headers.map(normalize);
  for (const alias of aliases) {
    const a = normalize(alias);
    const idx = norm.findIndex((h) => h === a || h.includes(a));
    if (idx >= 0) return idx;
  }
  return -1;
}

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy
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

async function parseFile(file: File, source: SourceKey): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  if (json.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(json[0]);

  const ALIASES = source === "99food" ? FOOD99_ALIASES : IFOOD_ALIASES;
  const idx = {
    sale_date: findColumn(headers, ALIASES.sale_date),
    gross_amount: findColumn(headers, ALIASES.gross_amount),
    net_amount: findColumn(headers, ALIASES.net_amount),
    orders_count: findColumn(headers, ALIASES.orders_count),
    commission: findColumn(headers, ALIASES.commission),
    fees: findColumn(headers, ALIASES.fees),
    coupons: findColumn(headers, ALIASES.coupons),
    cancellations: findColumn(headers, ALIASES.cancellations),
  };

  if (idx.sale_date < 0) throw new Error("Não encontrei a coluna de data. Verifique se o arquivo tem uma coluna como 'Data'.");
  if (idx.gross_amount < 0 && idx.net_amount < 0) throw new Error("Não encontrei coluna de valor (bruto ou líquido).");

  // Aggregate by date
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

    // Se não veio o valor bruto no arquivo, recompõe a partir do líquido + o que a plataforma reteve
    if (gross === 0 && net > 0) {
      gross = net + commission + Math.abs(fees) + (source === "ifood" ? coupons : 0) + cancellations;
    }
    // No 99Food a coluna "Receita total de vendas" já vem com o cupom descontado — não subtrair de novo.
    const netFinal = net
      ? net
      : source === "99food"
        ? gross - commission - Math.abs(fees) - cancellations
        : gross - commission - Math.abs(fees) - coupons - cancellations;


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
      map.set(date, {
        sale_date: date,
        gross_amount: gross,
        net_amount: netFinal,
        orders_count: orders,
        commission,
        fees,
        coupons,
        cancellations,
      });
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  return { headers, rows };
}

function ImportsPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SourceKey>("ifood");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        gross: acc.gross + r.gross_amount,
        net: acc.net + r.net_amount,
        orders: acc.orders + r.orders_count,
      }),
      { gross: 0, net: 0, orders: 0 }
    );
  }, [rows]);

  const history = useQuery({
    queryKey: ["imports-history", restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [];
      const { data } = await supabase
        .from("imports")
        .select("id, filename, source, rows_imported, imported_at")
        .eq("restaurant_id", restaurant.id)
        .order("imported_at", { ascending: false })
        .limit(10);
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
        .insert({
          restaurant_id: restaurant.id,
          filename: file.name,
          source,
          rows_imported: rows.length,
        })
        .select("id")
        .single();
      if (impErr) throw impErr;

      const salesRows = rows.map((r) => ({
        restaurant_id: restaurant.id,
        import_id: imp.id,
        source,
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

      toast.success(`Importação concluída: ${rows.length} dia(s) salvos`);
      setFile(null);
      setRows([]);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(translateAuthError(e, "Erro ao importar"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie o relatório do iFood ou 99Food em CSV ou Excel. Nós somamos as vendas por dia automaticamente.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Origem</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={source === "ifood" ? "default" : "outline"}
                size="sm"
                onClick={() => setSource("ifood")}
              >
                iFood
              </Button>
              <Button
                type="button"
                variant={source === "99food" ? "default" : "outline"}
                size="sm"
                onClick={() => setSource("99food")}
              >
                99Food
              </Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setRows([]);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
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
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile label="Dias" value={String(rows.length)} />
              <SummaryTile label="Pedidos" value={String(totals.orders)} />
              <SummaryTile label="Total vendido" value={formatBRL(totals.gross)} />
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
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {formatBRL(r.commission + r.fees + r.coupons)}
                        </td>
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
            <p className="text-sm text-muted-foreground">
              Selecione o relatório exportado do painel do iFood ou 99Food.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reconhecemos colunas como Data, Valor Bruto, Valor Líquido, Pedidos, Comissão, Taxas e Cupons.
            </p>
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
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(h.imported_at).toLocaleDateString("pt-BR")}
                </div>
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
