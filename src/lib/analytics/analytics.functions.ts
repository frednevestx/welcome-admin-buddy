import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { previousPeriod } from "@/lib/period";

const schema = z.object({ key: z.enum(["today", "7d", "30d", "90d", "month", "previous", "custom"]), from: z.string(), to: z.string(), label: z.string() });
const n = (value: unknown) => Number(value ?? 0);

async function restaurantId(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("profiles").select("restaurant_id").eq("id", context.userId).maybeSingle();
  if (error || !data?.restaurant_id) throw new Error("Nenhum negócio vinculado à sua conta.");
  return data.restaurant_id as string;
}

export const getFinancialAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await restaurantId(context);
    const previous = previousPeriod(data);
    const [current, prior, series, categories, suppliers] = await Promise.all([
      context.supabase.rpc("summarize_movements", { _restaurant_id: id, _from: data.from, _to: data.to, _include_uncategorized: false }),
      context.supabase.rpc("summarize_movements", { _restaurant_id: id, _from: previous.from, _to: previous.to, _include_uncategorized: false }),
      context.supabase.rpc("dashboard_cashflow_series", { _restaurant_id: id, _from: data.from, _to: data.to }),
      context.supabase.rpc("dashboard_category_comparison", { _restaurant_id: id, _from: data.from, _to: data.to, _previous_from: previous.from, _previous_to: previous.to }),
      context.supabase.rpc("dashboard_supplier_summary", { _restaurant_id: id, _from: data.from, _to: data.to }),
    ]);
    const error = current.error ?? prior.error ?? series.error ?? categories.error ?? suppliers.error;
    if (error) throw error;
    return {
      current: current.data?.[0] ?? { entradas: 0, saidas: 0, resultado: 0 },
      previous: prior.data?.[0] ?? { entradas: 0, saidas: 0, resultado: 0 },
      previousPeriod: previous,
      series: (series.data ?? []).map((row: any) => ({ date: row.period_date, entradas: n(row.entradas), saidas: n(row.saidas), resultado: n(row.resultado) })),
      categories: (categories.data ?? []).map((row: any) => ({ id: row.category_id, name: row.category_name, color: row.category_color, current: n(row.current_amount), previous: n(row.previous_amount) })),
      suppliers: (suppliers.data ?? []).map((row: any) => ({ id: row.supplier_id, name: row.supplier_name, total: n(row.total), purchases: n(row.purchases), average: n(row.average_ticket), lastPurchase: row.last_purchase })),
    };
  });