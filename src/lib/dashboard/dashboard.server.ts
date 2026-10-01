import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { currentGoalWindow } from "@/lib/goals";
import { previousPeriod, type Period } from "@/lib/period";
import type { CategoryFact, DashboardOverview, FinancialTotals } from "./dashboard.types";

type Db = SupabaseClient<Database>;
const number = (value: unknown) => Number(value ?? 0);
const variation = (current: number, previous: number) => previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;
const totals = (row: Record<string, unknown> | null | undefined): FinancialTotals => {
  const entradas = number(row?.entradas);
  const saidas = number(row?.saidas);
  const resultado = number(row?.resultado);
  return { entradas, saidas, resultado, margem: entradas > 0 ? (resultado / entradas) * 100 : 0 };
};

async function restaurantIdFor(db: Db, userId: string): Promise<string> {
  const { data, error } = await db.from("profiles").select("restaurant_id").eq("id", userId).maybeSingle();
  if (error || !data?.restaurant_id) throw new Error("Nenhum negócio vinculado à sua conta.");
  return data.restaurant_id;
}

export async function loadDashboardOverview(db: Db, userId: string, period: Period): Promise<DashboardOverview> {
  const restaurantId = await restaurantIdFor(db, userId);
  const previous = previousPeriod(period);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const monthWindow = currentGoalWindow("mensal", new Date(`${today}T12:00:00-03:00`));

  const [currentSummary, previousSummary, seriesResult, categoryResult, recentResult, payablesResult, uncategorizedResult, goalResult, goalSummary, insightResult, identityResult, movementCount, integrationResult] = await Promise.all([
    db.rpc("summarize_movements", { _restaurant_id: restaurantId, _from: period.from, _to: period.to, _type: null, _category_ids: null, _include_uncategorized: false, _search: null }),
    db.rpc("summarize_movements", { _restaurant_id: restaurantId, _from: previous.from, _to: previous.to, _type: null, _category_ids: null, _include_uncategorized: false, _search: null }),
    db.rpc("dashboard_cashflow_series", { _restaurant_id: restaurantId, _from: period.from, _to: period.to }),
    db.rpc("dashboard_category_comparison", { _restaurant_id: restaurantId, _from: period.from, _to: period.to, _previous_from: previous.from, _previous_to: previous.to }),
    db.rpc("filter_movements", { _restaurant_id: restaurantId, _from: period.from, _to: period.to, _type: null, _category_ids: null, _include_uncategorized: false, _search: null, _limit: 10, _offset: 0 }),
    db.from("payables").select("amount,due_date,status").eq("restaurant_id", restaurantId).eq("status", "pending"),
    db.from("movements").select("amount", { count: "exact" }).eq("restaurant_id", restaurantId).eq("status", "active").is("category_id", null).gte("movement_date", period.from).lte("movement_date", period.to),
    db.from("goals").select("id,target_amount").eq("restaurant_id", restaurantId).eq("period", "mensal").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.rpc("summarize_movements", { _restaurant_id: restaurantId, _from: monthWindow.start, _to: monthWindow.end, _type: "entrada", _category_ids: null, _include_uncategorized: false, _search: null }),
    db.from("system_events").select("title,body,severity").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("whatsapp_identities").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("status", "active"),
    db.from("movements").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("status", "active"),
    db.from("integrations").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("status", "connected"),
  ]);

  const errors = [currentSummary.error, previousSummary.error, seriesResult.error, categoryResult.error, recentResult.error, payablesResult.error, uncategorizedResult.error, goalResult.error, goalSummary.error];
  const firstError = errors.find(Boolean);
  if (firstError) throw firstError;

  const current = totals(currentSummary.data?.[0] as Record<string, unknown> | undefined);
  const prior = totals(previousSummary.data?.[0] as Record<string, unknown> | undefined);
  const categories: CategoryFact[] = (categoryResult.data ?? []).map((row) => {
    const amount = number(row.current_amount);
    const previousAmount = number(row.previous_amount);
    return { id: row.category_id, name: row.category_name, color: row.category_color, amount, previousAmount, variation: variation(amount, previousAmount) };
  });
  const pending = payablesResult.data ?? [];
  const overdue = pending.filter((item) => item.due_date < today);
  const upcoming = pending.filter((item) => item.due_date >= today);
  const goal = goalResult.data;
  const goalCurrent = number(goalSummary.data?.[0]?.entradas);

  return {
    totals: current,
    previousTotals: prior,
    variation: { entradas: variation(current.entradas, prior.entradas), saidas: variation(current.saidas, prior.saidas), resultado: variation(current.resultado, prior.resultado), margem: current.margem - prior.margem },
    series: (seriesResult.data ?? []).map((row) => ({ date: row.period_date, entradas: number(row.entradas), saidas: number(row.saidas), resultado: number(row.resultado) })),
    categories: categories.slice(0, 5),
    recent: (recentResult.data ?? []).map((row) => ({ ...row, amount: number(row.amount) })),
    attention: {
      overduePayables: { count: overdue.length, total: overdue.reduce((sum, item) => sum + number(item.amount), 0) },
      upcomingPayables: { count: upcoming.length, total: upcoming.reduce((sum, item) => sum + number(item.amount), 0) },
      uncategorized: { count: uncategorizedResult.count ?? 0, total: (uncategorizedResult.data ?? []).reduce((sum, item) => sum + number(item.amount), 0) },
      risingCategory: categories.filter((item) => item.previousAmount > 0 && (item.variation ?? 0) > 0).sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0))[0] ?? null,
      goal: goal ? { id: goal.id, target: number(goal.target_amount), current: goalCurrent, percent: number(goal.target_amount) > 0 ? (goalCurrent / number(goal.target_amount)) * 100 : 0 } : null,
      insight: insightResult.data ?? null,
    },
    firstSteps: { whatsapp: (identityResult.count ?? 0) > 0, firstMovement: (movementCount.count ?? 0) > 0, delivery: (integrationResult.count ?? 0) > 0 },
  };
}