/**
 * Ponte entre o painel web e o SERVIÇO CENTRAL de lançamentos.
 * As telas nunca escrevem direto em `movements`: tudo passa por aqui,
 * com auditoria, exclusão lógica e recuperação.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function currentRestaurant(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("restaurant_id").eq("id", userId).maybeSingle();
  if (!data?.restaurant_id) throw new Error("Nenhum negócio vinculado à sua conta.");
  return data.restaurant_id as string;
}

export interface SaveMovementPayload {
  id?: string | null;
  type: "entrada" | "saida" | "transferencia";
  amount: number;
  movement_date: string;
  description?: string | null;
  category_id?: string | null;
  supplier_name?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

export const saveMovementWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveMovementPayload) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    const { createMovement, updateMovement } = await import("./service.server");

    let supplierId: string | null = null;
    const supplierName = data.supplier_name?.trim();
    if (supplierName) {
      const { data: existing } = await supabase
        .from("suppliers")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("name", supplierName)
        .maybeSingle();
      if (existing?.id) supplierId = existing.id;
      else {
        const { data: created } = await supabase
          .from("suppliers")
          .insert({ restaurant_id: restaurantId, name: supplierName })
          .select("id")
          .maybeSingle();
        supplierId = created?.id ?? null;
      }
    }

    const actor = { restaurantId, userId, origin: "web" as const };
    const input = {
      type: data.type,
      amount: Number(data.amount),
      movement_date: data.movement_date,
      description: data.description ?? null,
      category_id: data.category_id || null,
      supplier_id: supplierId,
      payment_method: data.payment_method || null,
      notes: data.notes || null,
      confirmed_by_user: true,
    };

    const result = data.id
      ? await updateMovement(supabase, actor, data.id, input)
      : await createMovement(supabase, actor, input);

    if (result.error) throw new Error(result.error);
    return { id: result.id };
  });

export const archiveMovementWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    const { archiveMovement } = await import("./service.server");
    const r = await archiveMovement(
      supabase,
      { restaurantId, userId, origin: "web" },
      data.id,
      data.reason ?? "arquivado pelo painel",
    );
    if (r.error) throw new Error(r.error);
    return { ok: true };
  });

export const restoreMovementWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    const { restoreMovement } = await import("./service.server");
    const r = await restoreMovement(supabase, { restaurantId, userId, origin: "web" }, data.id);
    if (r.error) throw new Error(r.error);
    return { ok: true };
  });

export const listArchivedMovements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    const { data } = await supabase
      .from("movements")
      .select("id, movement_date, description, amount, type, notes")
      .eq("restaurant_id", restaurantId)
      .eq("status", "deleted")
      .order("movement_date", { ascending: false })
      .limit(50);
    return (data ?? []) as any[];
  });
