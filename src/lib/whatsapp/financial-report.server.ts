import { calculateFinancialBreakdown } from "@/lib/finance";
import { formatBRL, formatDateBR } from "@/lib/format";
import { createMovement, type MovementActor } from "@/lib/movements/service.server";
import type { FinancialReportData, FinancialReportItem, FinancialReportSale } from "./interpret.server";

export interface NormalizedFinancialReport {
  report_date: string;
  sales: FinancialReportSale[];
  expenses: FinancialReportItem[];
  reported_net_profit: number | null;
}

export interface PreparedFinancialReport {
  ids: string[];
  summary: string;
  failures: string[];
  duplicated: number;
}

const validDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function validItem(value: unknown): value is FinancialReportItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.description === "string" && item.description.trim().length > 0 && Number(item.amount) > 0;
}

export function normalizeFinancialReport(
  value: Pick<FinancialReportData, "report_date" | "sales" | "expenses" | "reported_net_profit">,
  fallbackDate: string,
): NormalizedFinancialReport | null {
  if (!Array.isArray(value.sales)) return null;
  const sales = value.sales
    .filter(validItem)
    .map((sale) => ({
      description: sale.description.trim(),
      amount: Number(sale.amount),
      costs: Array.isArray(sale.costs)
        ? sale.costs.filter(validItem).map((cost) => ({ description: cost.description.trim(), amount: Number(cost.amount) }))
        : [],
    }))
    .filter((sale) => sale.costs.length > 0);
  if (sales.length < 2) return null;

  const expenses = Array.isArray(value.expenses)
    ? value.expenses.filter(validItem).map((item) => ({ description: item.description.trim(), amount: Number(item.amount) }))
    : [];
  const reported = value.reported_net_profit === null || value.reported_net_profit === undefined
    ? null
    : Number(value.reported_net_profit);
  return {
    report_date: validDate(value.report_date) ? value.report_date : fallbackDate,
    sales,
    expenses,
    reported_net_profit: reported !== null && Number.isFinite(reported) ? reported : null,
  };
}

export function buildFinancialReportSummary(report: NormalizedFinancialReport): string {
  const costs = report.sales.flatMap((sale) => sale.costs);
  const count = report.sales.length + costs.length + report.expenses.length;
  const totals = calculateFinancialBreakdown({
    revenues: report.sales.map((sale) => sale.amount),
    costs: costs.map((cost) => cost.amount),
    expenses: report.expenses.map((expense) => expense.amount),
  });
  const divergence =
    report.reported_net_profit !== null && Math.abs(report.reported_net_profit - totals.operatingResult) > 0.01
      ? `\n⚠️ Divergência: o relatório informa lucro líquido de ${formatBRL(report.reported_net_profit)}, mas o resultado operacional calculado é ${formatBRL(totals.operatingResult)} (diferença de ${formatBRL(Math.abs(report.reported_net_profit - totals.operatingResult))}).`
      : "";

  return [
    `📊 RESUMO — ${formatDateBR(report.report_date)}`,
    "",
    `Identifiquei ${count} lançamentos:`,
    "",
    `🟢 RECEBIMENTOS — ${report.sales.length}`,
    ...report.sales.map((sale) => `- ${formatBRL(sale.amount)} — ${sale.description}`),
    "",
    `🔴 CUSTOS — ${costs.length}`,
    ...costs.map((cost) => `- ${formatBRL(cost.amount)} — ${cost.description}`),
    ...(report.expenses.length > 0
      ? ["", `🟠 DESPESAS — ${report.expenses.length}`, ...report.expenses.map((expense) => `- ${formatBRL(expense.amount)} — ${expense.description}`)]
      : []),
    "",
    "📈 RESUMO FINANCEIRO",
    "",
    `Faturamento bruto: ${formatBRL(totals.grossRevenue)}`,
    `Custos: ${formatBRL(totals.totalCosts)}`,
    `Despesas: ${formatBRL(totals.totalExpenses)}`,
    `Resultado após custos: ${formatBRL(totals.resultAfterCosts)}`,
    `Resultado operacional: ${formatBRL(totals.operatingResult)}`,
    `Margem sobre faturamento bruto: ${totals.grossRevenueMarginPct.toFixed(2).replace(".", ",")}%${divergence}`,
    "",
    `Confirma os ${count} lançamentos? (sim/não)`,
  ].join("\n");
}

export async function prepareFinancialReport(
  db: any,
  actor: MovementActor,
  report: NormalizedFinancialReport,
): Promise<PreparedFinancialReport> {
  const rows = [
    ...report.sales.map((sale) => ({ type: "entrada" as const, description: sale.description, amount: sale.amount, expense_kind: null })),
    ...report.sales.flatMap((sale) =>
      sale.costs.map((cost) => ({ type: "saida" as const, description: cost.description, amount: cost.amount, expense_kind: "custo" as const })),
    ),
    ...report.expenses.map((expense) => ({ type: "saida" as const, description: expense.description, amount: expense.amount, expense_kind: "despesa" as const })),
  ];
  const ids: string[] = [];
  const failures: string[] = [];
  let duplicated = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;
    const result = await createMovement(
      db,
      { ...actor, idempotencyKey: actor.idempotencyKey ? `${actor.idempotencyKey}#report-${index}` : null },
      {
        ...row,
        movement_date: report.report_date,
        confirmed_by_user: false,
      },
    );
    if (result.id) {
      ids.push(result.id);
      if (result.duplicated) duplicated += 1;
    } else {
      failures.push(`${row.description}${result.error ? ` (${result.error})` : ""}`);
    }
  }

  return { ids, summary: buildFinancialReportSummary(report), failures, duplicated };
}