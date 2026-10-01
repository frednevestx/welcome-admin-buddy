import type { MovementRow } from "@/lib/movements/view-model";

export type FinancialTotals = { entradas: number; saidas: number; resultado: number; margem: number };
export type FinancialVariation = { entradas: number | null; saidas: number | null; resultado: number | null; margem: number | null };
export type CashflowPoint = { date: string; entradas: number; saidas: number; resultado: number };
export type CategoryFact = { id: string | null; name: string; color: string | null; amount: number; previousAmount: number; variation: number | null };

export type DashboardOverview = {
  totals: FinancialTotals;
  previousTotals: FinancialTotals;
  variation: FinancialVariation;
  series: CashflowPoint[];
  categories: CategoryFact[];
  recent: MovementRow[];
  attention: {
    overduePayables: { count: number; total: number };
    upcomingPayables: { count: number; total: number };
    uncategorized: { count: number; total: number };
    risingCategory: CategoryFact | null;
    goal: { id: string; target: number; current: number; percent: number } | null;
    insight: { title: string; body: string | null; severity: string } | null;
  };
  firstSteps: { whatsapp: boolean; firstMovement: boolean; delivery: boolean };
};