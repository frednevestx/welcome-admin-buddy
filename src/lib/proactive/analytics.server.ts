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
