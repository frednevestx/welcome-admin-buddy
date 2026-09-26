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

function normalizeSupplierName(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export interface SaveMovementPayload {
  id?: string | null;
  type: "entrada" | "saida" | "transferencia" | "ajuste";
  amount: number;
  movement_date: string;
  description?: string | null;
  category_id?: string | null;
  supplier_name?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  is_fixed?: boolean;
  fixed_parent_id?: string | null;
  category_only?: boolean;
}

export interface MovementFiltersPayload {
  restaurant_id: string;
  from: string;
  to: string;
  type?: "entrada" | "saida" | null;
  category_ids?: string[] | null;
  include_uncategorized?: boolean;
  search?: string | null;
  limit?: number;
  offset?: number;
}

function rpcFilters(data: MovementFiltersPayload) {
  return {
    _restaurant_id: data.restaurant_id,
    _from: `${data.from}T00:00:00-03:00`,
    _to: `${data.to}T23:59:59-03:00`,
    _type: data.type ?? null,
    _category_ids: data.category_ids?.length ? data.category_ids : null,
    _include_uncategorized: data.include_uncategorized ?? false,
    _search: data.search?.trim() || null,
  };
}

export const listMovementsWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MovementFiltersPayload) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    if (restaurantId !== data.restaurant_id) throw new Error("Negócio inválido.");
    const { data: rows, error } = await supabase.rpc("filter_movements", {
      ...rpcFilters(data),
      _limit: Math.min(Math.max(data.limit ?? 50, 1), 1000),
      _offset: Math.max(data.offset ?? 0, 0),
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const summarizeMovementsWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MovementFiltersPayload) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    if (restaurantId !== data.restaurant_id) throw new Error("Negócio inválido.");
    const { data: rows, error } = await supabase.rpc("summarize_movements", rpcFilters(data));
    if (error) throw new Error(error.message);
    return rows?.[0] ?? { entradas: 0, saidas: 0, resultado: 0 };
  });

export const saveMovementWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveMovementPayload) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await currentRestaurant(supabase, userId);
    const { createMovement, updateMovement } = await import("./service.server");
    const actor = { restaurantId, userId, origin: "web" as const };
    if (data.category_only) {
      if (!data.id) throw new Error("Lançamento não encontrado.");
      const result = await updateMovement(supabase, actor, data.id, { category_id: data.category_id ?? null });
      if (result.error) throw new Error(result.error);
      return { id: result.id };
    }

    let supplierId: string | null = null;
    const supplierName = data.supplier_name?.trim();
    if (supplierName) {
      if (supplierName.length > 120) throw new Error("O nome do fornecedor deve ter no máximo 120 caracteres.");
      const { data: candidates, error: supplierLookupError } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("restaurant_id", restaurantId);
      if (supplierLookupError) throw new Error(supplierLookupError.message);
      const existing = (candidates ?? []).find(
        (candidate: { id: string; name: string }) => normalizeSupplierName(candidate.name) === normalizeSupplierName(supplierName),
      );
      if (existing?.id) supplierId = existing.id;
      else {
        const { data: created, error: supplierCreateError } = await supabase
          .from("suppliers")
          .insert({ restaurant_id: restaurantId, name: supplierName })
          .select("id")
          .maybeSingle();
        if (supplierCreateError) throw new Error(supplierCreateError.message);
        supplierId = created?.id ?? null;
      }
    }

    const input = {
      type: data.type,
      amount: Number(data.amount),
      movement_date: data.movement_date,
      description: data.description ?? null,
      category_id: data.category_id || null,
      supplier_id: supplierId,
      payment_method: data.payment_method || null,
      notes: data.notes || null,
      is_fixed: data.is_fixed ?? false,
      fixed_parent_id: data.fixed_parent_id ?? null,
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
