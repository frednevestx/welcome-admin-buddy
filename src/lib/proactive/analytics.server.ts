/**
 * Consultas analíticas sob demanda (chamadas pela conversa, não por push).
 * Toda a matemática acontece aqui; a IA nunca calcula números.
 */

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const iso = (d: Date) => d.toISOString().slice(0, 10);

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  const today = iso(now);
  return { from: iso(start), to: offset === 0 ? today : iso(end) };
}

async function loadRange(db: any, restaurantId: string, from: string, to: string) {
  const { data } = await db
    .from("movements_current")
    .select("type, amount, movement_date, category_id, supplier_id")
    .eq("restaurant_id", restaurantId)
    .gte("movement_date", from)
    .lte("movement_date", to);
  return (data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) || 0 }));
}

async function names(db: any, table: string, restaurantId: string) {
  const { data } = await db.from(table).select("id, name").eq("restaurant_id", restaurantId);
  return new Map<string, string>((data ?? []).map((c: any) => [c.id, c.name]));
}

const sumBy = (rows: any[], type: string) =>
  rows.filter((r) => r.type === type).reduce((a: number, r: any) => a + r.amount, 0);

/** "como foi meu mês comparado ao anterior?" */
export async function comparePeriods(db: any, restaurantId: string): Promise<string> {
  const cur = monthRange(0);
  const prev = monthRange(1);
  const [rowsCur, rowsPrev] = await Promise.all([
    loadRange(db, restaurantId, cur.from, cur.to),
    loadRange(db, restaurantId, prev.from, prev.to),
  ]);

  if (rowsCur.length === 0 && rowsPrev.length === 0) {
    return "Ainda não tenho lançamentos suficientes nesses dois períodos para comparar. Assim que houver movimentações registradas eu faço essa comparação.";
  }

  const rc = sumBy(rowsCur, "entrada");
  const rp = sumBy(rowsPrev, "entrada");
  const ec = sumBy(rowsCur, "saida");
  const ep = sumBy(rowsPrev, "saida");
  const pct = (a: number, b: number) => (b > 0 ? `${(((a - b) / b) * 100).toFixed(1)}%` : "sem base de comparação");

  return [
    `Mês atual (${cur.from} a ${cur.to}): entradas ${brl(rc)}, saídas ${brl(ec)}, resultado ${brl(rc - ec)}.`,
    `Mês anterior: entradas ${brl(rp)}, saídas ${brl(ep)}, resultado ${brl(rp - ep)}.`,
    `Variação de entradas: ${pct(rc, rp)} · variação de saídas: ${pct(ec, ep)}.`,
  ].join("\n");
}

/** Agregação simples de despesas por categoria. */
export async function getTopExpenses(db: any, restaurantId: string, days = 30): Promise<string> {
  const to = iso(new Date());
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const rows = await loadRange(db, restaurantId, iso(start), to);
  const catNames = await names(db, "categories", restaurantId);

  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== "saida") continue;
    const name = r.category_id ? catNames.get(r.category_id) ?? "Sem categoria" : "Sem categoria";
    totals.set(name, (totals.get(name) ?? 0) + r.amount);
  }
  if (totals.size === 0) return `Não encontrei despesas registradas nos últimos ${days} dias.`;

  const top = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const total = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  return [
    `Maiores despesas dos últimos ${days} dias (total ${brl(total)}):`,
    ...top.map(([n, v], i) => `${i + 1}. ${n} — ${brl(v)} (${((v / total) * 100).toFixed(0)}%)`),
  ].join("\n");
}

/** Análise por fornecedor, usando movements.supplier_id. */
export async function getSupplierAnalysis(db: any, restaurantId: string, days = 90): Promise<string> {
  const to = iso(new Date());
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const rows = await loadRange(db, restaurantId, iso(start), to);
  const supNames = await names(db, "suppliers", restaurantId);

  const agg = new Map<string, { total: number; count: number; last: string }>();
  for (const r of rows) {
    if (r.type !== "saida" || !r.supplier_id) continue;
    const key = supNames.get(r.supplier_id) ?? "Fornecedor sem nome";
    const cur = agg.get(key) ?? { total: 0, count: 0, last: r.movement_date };
    cur.total += r.amount;
    cur.count += 1;
    if (r.movement_date > cur.last) cur.last = r.movement_date;
    agg.set(key, cur);
  }
  if (agg.size === 0) {
    return `Não encontrei despesas ligadas a fornecedores nos últimos ${days} dias. Quando você vincular um fornecedor às saídas, eu passo a analisar por aqui.`;
  }

  const top = Array.from(agg.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);
  return [
    `Fornecedores nos últimos ${days} dias:`,
    ...top.map(
      ([n, v]) =>
        `• ${n} — ${brl(v.total)} em ${v.count} compra(s), ticket médio ${brl(v.total / v.count)}, última em ${v.last}`,
    ),
  ].join("\n");
}

/* ============ consultas específicas usadas pelo orquestrador ============ */

export type QueryPeriod = "today" | "week" | "month" | "previous_month";

export function periodRangeOf(period: QueryPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  const today = iso(now);
  if (period === "today") return { from: today, to: today, label: "hoje" };
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: iso(start), to: today, label: "nos últimos 7 dias" };
  }
  if (period === "previous_month") {
    const r = monthRange(1);
    return { from: r.from, to: r.to, label: "no mês passado" };
  }
  const r = monthRange(0);
  return { from: r.from, to: r.to, label: "neste mês" };
}

/** Match conservador de fornecedor por nome (aceita primeiro nome). */
export async function findSupplier(
  db: any,
  restaurantId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const wanted = name.trim().toLowerCase();
  if (wanted.length < 2) return null;
  const { data } = await db.from("suppliers").select("id, name").eq("restaurant_id", restaurantId);
  const rows = (data ?? []) as { id: string; name: string }[];

  const exact = rows.find((s) => s.name.trim().toLowerCase() === wanted);
  if (exact) return exact;

  const firstNameMatches = rows.filter((s) => {
    const n = s.name.trim().toLowerCase();
    return n.startsWith(`${wanted} `) || n.split(/\s+/)[0] === wanted || n.includes(wanted);
  });
  // Só aceita quando não há ambiguidade.
  return firstNameMatches.length === 1 ? firstNameMatches[0]! : null;
}

/** "quanto gastei com o João?" — fatos, não texto. */
export async function getSupplierSpendFacts(
  db: any,
  restaurantId: string,
  name: string,
  days = 180,
): Promise<Record<string, unknown> | null> {
  const supplier = await findSupplier(db, restaurantId, name);
  const to = iso(new Date());
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const rows = await loadRange(db, restaurantId, iso(start), to);

  const catNames = await names(db, "categories", restaurantId);
  const matched = supplier ? rows.filter((r: any) => r.supplier_id === supplier.id && r.type === "saida") : [];

  if (!supplier || matched.length === 0) {
    // Sem fornecedor vinculado: tenta pela descrição das saídas (WhatsApp grava o nome ali).
    const { data: byDesc } = await db
      .from("movements_current")
      .select("amount, movement_date, category_id")
      .eq("restaurant_id", restaurantId)
      .eq("type", "saida")
      .gte("movement_date", iso(start))
      .ilike("description", `%${name.trim()}%`);
    const rowsDesc = (byDesc ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) || 0 }));
    if (rowsDesc.length === 0) return null;
    const total = rowsDesc.reduce((a: number, r: any) => a + r.amount, 0);
    return {
      tipo: "gasto_por_nome",
      nome: name,
      fornecedor_cadastrado: false,
      periodo_dias: days,
      total: brl(total),
      lancamentos: rowsDesc.length,
      ultimo_pagamento: rowsDesc.map((r: any) => r.movement_date).sort().at(-1),
      categorias: Array.from(
        new Set(rowsDesc.map((r: any) => (r.category_id ? catNames.get(r.category_id) ?? "Sem categoria" : "Sem categoria"))),
      ),
    };
  }

  const total = matched.reduce((a: number, r: any) => a + r.amount, 0);
  const monthStart = monthRange(0).from;
  const thisMonth = matched
    .filter((r: any) => r.movement_date >= monthStart)
    .reduce((a: number, r: any) => a + r.amount, 0);

  return {
    tipo: "gasto_por_fornecedor",
    nome: supplier.name,
    fornecedor_cadastrado: true,
    periodo_dias: days,
    total: brl(total),
    total_neste_mes: brl(thisMonth),
    compras: matched.length,
    ticket_medio: brl(total / matched.length),
    ultimo_pagamento: matched.map((r: any) => r.movement_date).sort().at(-1),
    categorias: Array.from(
      new Set(matched.map((r: any) => (r.category_id ? catNames.get(r.category_id) ?? "Sem categoria" : "Sem categoria"))),
    ),
  };
}

/** "quanto gastei com energia?" / "estou gastando muito com combustível" */
export async function getCategorySpendFacts(
  db: any,
  restaurantId: string,
  name: string,
  period: QueryPeriod = "month",
): Promise<Record<string, unknown> | null> {
  const catNames = await names(db, "categories", restaurantId);
  const wanted = name.trim().toLowerCase();
  const matchIds = Array.from(catNames.entries())
    .filter(([, n]) => n.toLowerCase().includes(wanted) || wanted.includes(n.toLowerCase()))
    .map(([id]) => id);

  const { from, to, label } = periodRangeOf(period);
  const rows = await loadRange(db, restaurantId, from, to);
  const sel = rows.filter(
    (r: any) =>
      r.type === "saida" &&
      (matchIds.includes(r.category_id) || false),
  );

  if (sel.length === 0) return null;

  // Base de comparação: mesmo intervalo em dias, imediatamente anterior.
  const spanDays = Math.max(
    1,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1,
  );
  const prevTo = new Date(new Date(from).getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * 86400000);
  const prevRows = await loadRange(db, restaurantId, iso(prevFrom), iso(prevTo));
  const prevTotal = prevRows
    .filter((r: any) => r.type === "saida" && matchIds.includes(r.category_id))
    .reduce((a: number, r: any) => a + r.amount, 0);

  const total = sel.reduce((a: number, r: any) => a + r.amount, 0);
  const revenue = sumBy(rows, "entrada");

  return {
    tipo: "gasto_por_categoria",
    categoria: name,
    periodo: label,
    total: brl(total),
    lancamentos: sel.length,
    total_periodo_anterior: brl(prevTotal),
    variacao_percentual: prevTotal > 0 ? `${(((total - prevTotal) / prevTotal) * 100).toFixed(1)}%` : "sem base de comparação",
    percentual_do_faturamento_do_periodo: revenue > 0 ? `${((total / revenue) * 100).toFixed(1)}%` : "sem faturamento registrado no período",
  };
}

/** Pacote de fatos para análise gerencial ("como está minha empresa?"). */
export async function getBusinessOverviewFacts(
  db: any,
  restaurantId: string,
): Promise<Record<string, unknown>> {
  const cur = monthRange(0);
  const prev = monthRange(1);
  const [rowsCur, rowsPrev] = await Promise.all([
    loadRange(db, restaurantId, cur.from, cur.to),
    loadRange(db, restaurantId, prev.from, prev.to),
  ]);
  const catNames = await names(db, "categories", restaurantId);
  const supNames = await names(db, "suppliers", restaurantId);

  if (rowsCur.length === 0 && rowsPrev.length === 0) {
    return { tipo: "visao_geral", dados_suficientes: false, periodo: `${cur.from} a ${cur.to}` };
  }

  const rc = sumBy(rowsCur, "entrada");
  const ec = sumBy(rowsCur, "saida");
  const rp = sumBy(rowsPrev, "entrada");
  const ep = sumBy(rowsPrev, "saida");
  const pct = (a: number, b: number) => (b > 0 ? `${(((a - b) / b) * 100).toFixed(1)}%` : "sem base de comparação");

  const byCat = new Map<string, number>();
  for (const r of rowsCur) {
    if (r.type !== "saida") continue;
    const n = r.category_id ? catNames.get(r.category_id) ?? "Sem categoria" : "Sem categoria";
    byCat.set(n, (byCat.get(n) ?? 0) + r.amount);
  }
  const topCats = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n, v]) => ({ categoria: n, valor: brl(v), percentual_das_saidas: ec > 0 ? `${((v / ec) * 100).toFixed(0)}%` : "n/d" }));

  const bySup = new Map<string, number>();
  for (const r of rowsCur) {
    if (r.type !== "saida" || !r.supplier_id) continue;
    const n = supNames.get(r.supplier_id) ?? "Fornecedor sem nome";
    bySup.set(n, (bySup.get(n) ?? 0) + r.amount);
  }
  const topSupplier = Array.from(bySup.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    tipo: "visao_geral",
    dados_suficientes: true,
    periodo_atual: `${cur.from} a ${cur.to}`,
    entradas_mes_atual: brl(rc),
    saidas_mes_atual: brl(ec),
    resultado_mes_atual: brl(rc - ec),
    margem_mes_atual: rc > 0 ? `${(((rc - ec) / rc) * 100).toFixed(1)}%` : "sem faturamento registrado",
    entradas_mes_anterior: brl(rp),
    saidas_mes_anterior: brl(ep),
    resultado_mes_anterior: brl(rp - ep),
    variacao_entradas: pct(rc, rp),
    variacao_saidas: pct(ec, ep),
    maiores_categorias_de_saida: topCats,
    fornecedor_mais_caro: topSupplier ? { nome: topSupplier[0], valor: brl(topSupplier[1]) } : null,
    lancamentos_no_mes: rowsCur.length,
  };
}
