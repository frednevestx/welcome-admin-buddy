import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const payableSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(160),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.string().uuid().nullable().optional(),
});

async function restaurantId(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("profiles").select("restaurant_id").eq("id", context.userId).maybeSingle();
  if (error || !data?.restaurant_id) throw new Error("Nenhum negócio vinculado à sua conta.");
  return data.restaurant_id as string;
}

export const listPayables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = await restaurantId(context);
    const [payables, reminders, suppliers] = await Promise.all([
      context.supabase.from("payables").select("id,description,amount,due_date,status,supplier_id,paid_movement_id,created_at,suppliers(name)").eq("restaurant_id", id).order("due_date"),
      context.supabase.from("reminders").select("id,description,due_date,due_time,status,kind").eq("restaurant_id", id).order("due_date"),
      context.supabase.from("suppliers").select("id,name").eq("restaurant_id", id).order("name"),
    ]);
    const error = payables.error ?? reminders.error ?? suppliers.error;
    if (error) throw error;
    return { payables: payables.data ?? [], reminders: reminders.data ?? [], suppliers: suppliers.data ?? [] };
  });

export const savePayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => payableSchema.parse(data))
  .handler(async ({ data, context }) => {
    const id = await restaurantId(context);
    const row = { restaurant_id: id, description: data.description, amount: data.amount, due_date: data.dueDate, supplier_id: data.supplierId ?? null, created_by: context.userId, status: "pending" };
    const query = data.id ? context.supabase.from("payables").update(row).eq("id", data.id).eq("restaurant_id", id) : context.supabase.from("payables").insert(row);
    const { error } = await query;
    if (error) throw error;
    return { ok: true };
  });

export const payPayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid(), paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: movementId, error } = await context.supabase.rpc("mark_payable_paid", { _payable_id: data.id, _payment_date: data.paymentDate });
    if (error) throw error;
    return { movementId };
  });

export const completeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const id = await restaurantId(context);
    const { error } = await context.supabase.from("reminders").update({ status: "done" }).eq("id", data.id).eq("restaurant_id", id);
    if (error) throw error;
    return { ok: true };
  });