import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, formatNumber, formatPct, isoDate } from "@/lib/format";
import { FileText, Printer, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: ReportsPage,
});

type RangeKey = "mes-atual" | "mes-anterior" | "30d" | "90d" | "ano" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "mes-atual", label: "Mês atual" },
  { key: "mes-anterior", label: "Mês anterior" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Ano atual" },
  { key: "custom", label: "Personalizado" },
];

function resolveRange(key: RangeKey, custom: { from: string; to: string }): { from: string; to: string; label: string } {
  const now = new Date();
  if (key === "mes-atual") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDate(from), to: isoDate(now), label: "Mês atual" };
  }
  if (key === "mes-anterior") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: isoDate(from), to: isoDate(to), label: "Mês anterior" };
  }
  if (key === "ano") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: isoDate(from), to: isoDate(now), label: `Ano ${now.getFullYear()}` };
  }
  if (key === "custom") return { from: custom.from, to: custom.to, label: "Personalizado" };
  const days = key === "30d" ? 29 : 89;
  const from = new Date(); from.setDate(from.getDate() - days);
  return { from: isoDate(from), to: isoDate(now), label: key === "30d" ? "Últimos 30 dias" : "Últimos 90 dias" };
}

function ReportsPage() {
  const { restaurant } = useRestaurant();
  const [rangeKey, setRangeKey] = useState<RangeKey>("mes-atual");
  const [custom, setCustom] = useState({ from: isoDate(new Date()), to: isoDate(new Date()) });
  const [opts, setOpts] = useState({
    resumo: true,
    vendas: true,
    movimentacoes: true,
    categorias: true,
    evolucao: true,
    comparativos: true,
    alertas: true,
  });
  const [generated, setGenerated] = useState<null | { html: string; range: { from: string; to: string; label: string } }>(null);
  const [loading, setLoading] = useState(false);

  async function gerar() {
    if (!restaurant?.id) return;
    setLoading(true);
    try {
      const range = resolveRange(rangeKey, custom);
      const rid = restaurant.id;
      const [salesRes, movRes] = await Promise.all([
        supabase.from("sales").select("source, sale_date, orders_count, gross_amount, net_amount").eq("restaurant_id", rid).gte("sale_date", range.from).lte("sale_date", range.to),
        supabase.from("movements").select("movement_date, description, amount, type, categories(name)").eq("restaurant_id", rid).gte("movement_date", range.from).lte("movement_date", range.to).order("movement_date", { ascending: false }),
      ]);
      const sales = salesRes.data ?? [];
      const movs = movRes.data ?? [];

      const vendido = sales.reduce((a, s) => a + Number(s.gross_amount || 0), 0);
      const pedidos = sales.reduce((a, s) => a + Number(s.orders_count || 0), 0);
      const gasto = movs.reduce((a, m) => a + Number(m.amount || 0), 0);
      const sobrou = vendido - gasto;

      const bySource: Record<string, { vendido: number; pedidos: number }> = {};
      for (const s of sales) {
        bySource[s.source] = bySource[s.source] || { vendido: 0, pedidos: 0 };
        bySource[s.source].vendido += Number(s.gross_amount || 0);
        bySource[s.source].pedidos += Number(s.orders_count || 0);
      }

      const byCategory: Record<string, number> = {};
      for (const m of movs) {
        const n = (m as any).categories?.name ?? "Sem categoria";
        byCategory[n] = (byCategory[n] || 0) + Number(m.amount || 0);
      }
      const catRanking = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

      // Evolução por mês dentro do range
      const evo = new Map<string, { key: string; vendido: number; gasto: number }>();
      const keyOf = (d: string) => d.slice(0, 7);
      for (const s of sales) {
        const k = keyOf(s.sale_date);
        if (!evo.has(k)) evo.set(k, { key: k, vendido: 0, gasto: 0 });
        evo.get(k)!.vendido += Number(s.gross_amount || 0);
      }
      for (const m of movs) {
        const k = keyOf(m.movement_date);
        if (!evo.has(k)) evo.set(k, { key: k, vendido: 0, gasto: 0 });
        evo.get(k)!.gasto += Number(m.amount || 0);
      }
      const evoArr = Array.from(evo.values()).sort((a, b) => a.key.localeCompare(b.key));

      // Comparativo com período anterior
      const dur = new Date(range.to + "T00:00:00").getTime() - new Date(range.from + "T00:00:00").getTime();
      const prevTo = new Date(new Date(range.from + "T00:00:00").getTime() - 86400000);
      const prevFrom = new Date(prevTo.getTime() - dur);
      const [pSales, pMov] = await Promise.all([
        supabase.from("sales").select("orders_count, gross_amount").eq("restaurant_id", rid).gte("sale_date", isoDate(prevFrom)).lte("sale_date", isoDate(prevTo)),
        supabase.from("movements").select("amount").eq("restaurant_id", rid).gte("movement_date", isoDate(prevFrom)).lte("movement_date", isoDate(prevTo)),
      ]);
      const pVendido = (pSales.data ?? []).reduce((a, s) => a + Number(s.gross_amount || 0), 0);
      const pPedidos = (pSales.data ?? []).reduce((a, s) => a + Number(s.orders_count || 0), 0);
      const pGasto = (pMov.data ?? []).reduce((a, m) => a + Number(m.amount || 0), 0);
      const pSobrou = pVendido - pGasto;

      const alertas: string[] = [];
      if (vendido > pVendido && pVendido > 0) alertas.push(`Vendas cresceram ${formatPct(((vendido - pVendido) / pVendido) * 100)} vs período anterior.`);
      else if (vendido < pVendido && pVendido > 0) alertas.push(`Vendas caíram ${formatPct(((pVendido - vendido) / pVendido) * 100)} vs período anterior.`);
      if (sobrou < 0) alertas.push(`Atenção: o período fechou no negativo (${formatBRL(sobrou)}).`);
      if (catRanking[0]) alertas.push(`Maior gasto: ${catRanking[0][0]} (${formatBRL(catRanking[0][1])}).`);
      if (vendido > 0 && gasto / vendido > 0.7) alertas.push(`Gastos representam ${formatPct((gasto / vendido) * 100)} do faturamento.`);

      const html = buildHTML({
        restaurant: restaurant.name || "Restaurante",
        range,
        opts,
        resumo: { vendido, gasto, sobrou, pedidos },
        vendas: bySource,
        movs,
        catRanking,
        evo: evoArr,
        comp: { cur: { vendido, gasto, sobrou, pedidos }, prev: { vendido: pVendido, gasto: pGasto, sobrou: pSobrou, pedidos: pPedidos } },
        alertas,
      });

      setGenerated({ html, range });
    } finally {
      setLoading(false);
    }
  }

  function imprimir() {
    if (!generated) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(generated.html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }
  function baixar() {
    if (!generated) return;
    const blob = new Blob([generated.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${generated.range.from}-a-${generated.range.to}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function baixarCSV() {
    if (!generated) return;
    // Extrai tabelas do HTML gerado e converte em CSV multi-seção.
    const parser = new DOMParser();
    const doc = parser.parseFromString(generated.html, "text/html");
    const lines: string[] = [];
    const esc = (v: string) => {
      const s = v.replace(/\s+/g, " ").trim();
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    doc.querySelectorAll("section").forEach((sec) => {
      const title = sec.querySelector("h2")?.textContent?.trim() ?? "Seção";
      lines.push(""); lines.push(`# ${title}`);
      sec.querySelectorAll("table").forEach((t) => {
        t.querySelectorAll("tr").forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll("th,td")).map((c) => esc(c.textContent ?? ""));
          if (cells.length) lines.push(cells.join(";"));
        });
      });
      const cards = sec.querySelectorAll(".card");
      if (cards.length) {
        lines.push("Métrica;Valor");
        cards.forEach((c) => {
          const lbl = c.querySelector(".lbl")?.textContent?.trim() ?? "";
          const val = c.querySelector(".val")?.textContent?.trim() ?? "";
          lines.push(`${esc(lbl)};${esc(val)}`);
        });
      }
      sec.querySelectorAll("ul.alerts li").forEach((li) => {
        lines.push(esc(li.textContent ?? ""));
      });
    });
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${generated.range.from}-a-${generated.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Monte um relatório do seu jeito e imprima ou baixe.</p>
      </div>

      <Card className="p-5 space-y-5">
        <div>
          <Label className="text-sm font-medium mb-2 block">Período</Label>
          <Tabs value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
            <TabsList className="flex-wrap h-auto">
              {RANGES.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          {rangeKey === "custom" && (
            <div className="grid grid-cols-2 gap-3 mt-3 max-w-md">
              <div><Label className="text-xs">De</Label><Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
            </div>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium mb-3 block">Incluir no relatório</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { k: "resumo", l: "Resumo executivo (Vendido, Gasto, Sobrou)" },
              { k: "vendas", l: "Vendas por plataforma" },
              { k: "movimentacoes", l: "Lista de movimentações" },
              { k: "categorias", l: "Ranking por categoria" },
              { k: "evolucao", l: "Evolução mensal" },
              { k: "comparativos", l: "Comparativo com período anterior" },
              { k: "alertas", l: "Alertas inteligentes" },
            ].map((o) => (
              <label key={o.k} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={(opts as any)[o.k]} onCheckedChange={(c) => setOpts({ ...opts, [o.k]: !!c })} />
                {o.l}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={gerar} disabled={loading}><FileText className="h-4 w-4 mr-2" />{loading ? "Gerando..." : "Gerar relatório"}</Button>
          {generated && (
            <>
              <Button variant="outline" onClick={imprimir}><Printer className="h-4 w-4 mr-2" />Imprimir / PDF</Button>
              <Button variant="outline" onClick={baixar}><Download className="h-4 w-4 mr-2" />Baixar HTML</Button>
              <Button variant="outline" onClick={baixarCSV}><Download className="h-4 w-4 mr-2" />Baixar CSV</Button>
            </>
          )}
        </div>
      </Card>

      {generated && (
        <Card className="p-0 overflow-hidden">
          <iframe title="Prévia do relatório" srcDoc={generated.html} className="w-full h-[900px] bg-white" />
        </Card>
      )}
    </div>
  );
}

function buildHTML(d: {
  restaurant: string;
  range: { from: string; to: string; label: string };
  opts: Record<string, boolean>;
  resumo: { vendido: number; gasto: number; sobrou: number; pedidos: number };
  vendas: Record<string, { vendido: number; pedidos: number }>;
  movs: any[];
  catRanking: [string, number][];
  evo: { key: string; vendido: number; gasto: number }[];
  comp: { cur: any; prev: any };
  alertas: string[];
}) {
  const s = (v: number) => formatBRL(v);
  const pct = (c: number, p: number) => p === 0 ? "—" : formatPct(((c - p) / Math.abs(p)) * 100);
  const monthLabel = (k: string) => {
    const [y, m] = k.split("-");
    return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][Number(m) - 1] + "/" + y.slice(2);
  };

  const sections: string[] = [];

  if (d.opts.resumo) {
    sections.push(`
      <section>
        <h2>Resumo</h2>
        <div class="cards">
          <div class="card"><div class="lbl">Total Vendido</div><div class="val">${s(d.resumo.vendido)}</div></div>
          <div class="card"><div class="lbl">Total Gasto</div><div class="val red">${s(d.resumo.gasto)}</div></div>
          <div class="card"><div class="lbl">Sobrou</div><div class="val ${d.resumo.sobrou >= 0 ? "green" : "red"}">${s(d.resumo.sobrou)}</div></div>
          <div class="card"><div class="lbl">Pedidos</div><div class="val">${formatNumber(d.resumo.pedidos)}</div></div>
        </div>
      </section>`);
  }

  if (d.opts.vendas) {
    const rows = Object.entries(d.vendas).map(([src, v]) =>
      `<tr><td>${src === "ifood" ? "iFood" : src === "99food" ? "99Food" : "Loja"}</td><td class="num">${formatNumber(v.pedidos)}</td><td class="num">${s(v.vendido)}</td></tr>`
    ).join("") || `<tr><td colspan="3" class="empty">Sem vendas no período.</td></tr>`;
    sections.push(`
      <section>
        <h2>Vendas por plataforma</h2>
        <table><thead><tr><th>Plataforma</th><th class="num">Pedidos</th><th class="num">Vendido</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`);
  }

  if (d.opts.categorias) {
    const total = d.catRanking.reduce((a, [, v]) => a + v, 0);
    const rows = d.catRanking.map(([n, v]) =>
      `<tr><td>${n}</td><td class="num">${s(v)}</td><td class="num">${total ? formatPct((v / total) * 100) : "—"}</td></tr>`
    ).join("") || `<tr><td colspan="3" class="empty">Sem gastos no período.</td></tr>`;
    sections.push(`
      <section>
        <h2>Onde foi gasto</h2>
        <table><thead><tr><th>Categoria</th><th class="num">Valor</th><th class="num">%</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`);
  }

  if (d.opts.evolucao) {
    const rows = d.evo.map((r) =>
      `<tr><td>${monthLabel(r.key)}</td><td class="num">${s(r.vendido)}</td><td class="num red">${s(r.gasto)}</td><td class="num ${r.vendido - r.gasto >= 0 ? "green" : "red"}">${s(r.vendido - r.gasto)}</td></tr>`
    ).join("") || `<tr><td colspan="4" class="empty">Sem dados no período.</td></tr>`;
    sections.push(`
      <section>
        <h2>Evolução mensal</h2>
        <table><thead><tr><th>Mês</th><th class="num">Vendido</th><th class="num">Gasto</th><th class="num">Sobrou</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`);
  }

  if (d.opts.comparativos) {
    const rows = [
      ["Vendido", d.comp.cur.vendido, d.comp.prev.vendido],
      ["Gasto", d.comp.cur.gasto, d.comp.prev.gasto],
      ["Sobrou", d.comp.cur.sobrou, d.comp.prev.sobrou],
      ["Pedidos", d.comp.cur.pedidos, d.comp.prev.pedidos],
    ].map(([label, c, p]: any) =>
      `<tr><td>${label}</td><td class="num">${label === "Pedidos" ? formatNumber(c) : s(c)}</td><td class="num">${label === "Pedidos" ? formatNumber(p) : s(p)}</td><td class="num">${pct(c, p)}</td></tr>`
    ).join("");
    sections.push(`
      <section>
        <h2>Comparativo com período anterior</h2>
        <table><thead><tr><th>Métrica</th><th class="num">Atual</th><th class="num">Anterior</th><th class="num">Variação</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`);
  }

  if (d.opts.movimentacoes) {
    const rows = d.movs.slice(0, 200).map((m) =>
      `<tr><td>${formatDate(m.movement_date)}</td><td>${m.description || "—"}</td><td>${(m as any).categories?.name || "—"}</td><td class="num red">${s(Number(m.amount || 0))}</td></tr>`
    ).join("") || `<tr><td colspan="4" class="empty">Sem movimentações no período.</td></tr>`;
    sections.push(`
      <section>
        <h2>Movimentações</h2>
        <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`);
  }

  if (d.opts.alertas) {
    const rows = d.alertas.map((a) => `<li>${a}</li>`).join("") || `<li class="empty">Nada relevante a destacar.</li>`;
    sections.push(`<section><h2>Alertas</h2><ul class="alerts">${rows}</ul></section>`);
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatório — ${d.restaurant}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;margin:0;padding:32px;background:#fff}
  header{border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
  h1{margin:0;font-size:22px}
  .sub{color:#555;font-size:13px;margin-top:4px}
  section{margin:24px 0;page-break-inside:avoid}
  h2{font-size:15px;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid #ddd}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .card{border:1px solid #e5e5e5;border-radius:8px;padding:12px}
  .lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px}
  .val{font-size:20px;font-weight:600;margin-top:4px}
  .green{color:#0a7a3b}.red{color:#b42318}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left}
  th{background:#f7f7f7;font-weight:600;font-size:12px}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .empty{color:#888;text-align:center;padding:16px}
  .alerts{margin:0;padding-left:20px}
  .alerts li{margin:6px 0;font-size:13px}
  @media print{body{padding:16px}}
</style></head><body>
  <header>
    <h1>${d.restaurant} — Relatório</h1>
    <div class="sub">${d.range.label} · ${formatDate(d.range.from)} a ${formatDate(d.range.to)} · Gerado em ${formatDate(new Date())}</div>
  </header>
  ${sections.join("\n")}
</body></html>`;
}
