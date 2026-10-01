import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentGoalWindow } from "@/lib/goals";

const goalPeriod = z.enum(["diaria", "semanal", "mensal"]);

async function restaurantId(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("profiles").select("restaurant_id").eq("id", context.userId).maybeSingle();
  if (error || !data?.restaurant_id) throw new Error("Nenhum negócio vinculado à sua conta.");
  return data.restaurant_id as string;
}

export const listGoalsWithProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = await restaurantId(context);
    const { data: goals, error } = await context.supabase.from("goals").select("id,period,target_amount,reference_date,active,created_at").eq("restaurant_id", id).order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all((goals ?? []).map(async (goal: any) => {
      const window = currentGoalWindow(goal.period);
      const { data, error: summaryError } = await context.supabase.rpc("summarize_movements", { _restaurant_id: id, _from: window.start, _to: window.end, _type: "entrada", _category_ids: null, _include_uncategorized: false, _search: null });
      if (summaryError) throw summaryError;
      const current = Number(data?.[0]?.entradas ?? 0);
      const target = Number(goal.target_amount);
      return { ...goal, target_amount: target, current, percent: target > 0 ? (current / target) * 100 : 0, window };
    }));
  });

export const saveGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ period: goalPeriod, target: z.number().positive(), referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const id = await restaurantId(context);
    const { error: deactivateError } = await context.supabase.from("goals").update({ active: false }).eq("restaurant_id", id).eq("period", data.period).eq("active", true);
    if (deactivateError) throw deactivateError;
    const { error } = await context.supabase.from("goals").insert({ restaurant_id: id, period: data.period, target_amount: data.target, reference_date: data.referenceDate, active: true, created_by: context.userId });
    if (error) throw error;
    return { ok: true };
  });