/**
 * SERVIÇO CENTRAL DE MOVIMENTAÇÕES.
 *
 * WhatsApp e painel web usam este módulo — as regras não são duplicadas.
 * Toda operação:
 *   - exige negócio (restaurant_id) e conhece a origem (`whatsapp` | `web`);
 *   - é idempotente (mesma chave nunca cria dois lançamentos);
 *   - é auditada em `audit_log`;
 *   - nunca apaga fisicamente: exclusão é lógica (status = 'deleted').
 */

import { audit, type AuditOrigin } from "@/lib/audit.server";

export interface MovementActor {
  restaurantId: string;
  userId?: string | null;
  phone?: string | null;
  origin: AuditOrigin;
  sourceEventId?: string | null;
  idempotencyKey?: string | null;
}

export interface MovementInput {
  type: "entrada" | "saida" | "transferencia";
  amount: number;
  movement_date: string;
  description?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  confirmed_by_user?: boolean;
}

export interface MovementResult {
  id: string | null;
  duplicated: boolean;
  error?: string;
}

function validate(actor: MovementActor, input: MovementInput): string | null {
  if (!actor.restaurantId) return "negócio não identificado";
  if (!input.type) return "tipo do lançamento não informado";
  if (!(Number(input.amount) > 0)) return "valor inválido";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.movement_date)) return "data inválida";
  return null;
}

/** Já existe um lançamento criado por essa mesma mensagem/ação? */
async function findByIdempotency(db: any, actor: MovementActor): Promise<string | null> {
  const key = actor.idempotencyKey ?? (actor.sourceEventId ? `event:${actor.sourceEventId}` : null);
  if (!key) return null;
  const { data } = await db
    .from("movements")
    .select("id")
    .eq("restaurant_id", actor.restaurantId)
    .eq("source_ref", key)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createMovement(
  db: any,
  actor: MovementActor,
  input: MovementInput,
): Promise<MovementResult> {
  const problem = validate(actor, input);
  if (problem) return { id: null, duplicated: false, error: problem };

  const existing = await findByIdempotency(db, actor);
  if (existing) return { id: existing, duplicated: true };

  const key = actor.idempotencyKey ?? (actor.sourceEventId ? `event:${actor.sourceEventId}` : null);

  const { data, error } = await db
    .from("movements")
    .insert({
      restaurant_id: actor.restaurantId,
      type: input.type,
      amount: input.amount,
      movement_date: input.movement_date,
      description: input.description ?? null,
      category_id: input.category_id ?? null,
      supplier_id: input.supplier_id ?? null,
      payment_method: input.payment_method ?? null,
      notes: input.notes ?? null,
      created_by: actor.userId ?? null,
      origin: actor.origin === "whatsapp" ? "automatico" : "manual",
      source_ref: key,
      created_from_event_id: actor.sourceEventId ?? null,
      status: "active",
      confirmed_by_user: input.confirmed_by_user ?? false,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return { id: null, duplicated: false, error: error?.message ?? "não foi possível registrar" };
  }

  await audit(db, {
    action: "movement.created",
    entity: "movement",
    entityId: data.id,
    restaurantId: actor.restaurantId,
    actorUserId: actor.userId ?? null,
    actorKind: actor.origin === "admin" ? "admin" : actor.userId ? "user" : "system",
    actorPhone: actor.phone ?? null,
    origin: actor.origin,
    after: { ...input, source_ref: key },
  });

  return { id: data.id, duplicated: false };
}

export async function confirmMovement(db: any, actor: MovementActor, movementId: string): Promise<void> {
  await db
    .from("movements")
    .update({ confirmed_by_user: true })
    .eq("id", movementId)
    .eq("restaurant_id", actor.restaurantId);
  await audit(db, {
    action: "movement.confirmed",
    entity: "movement",
    entityId: movementId,
    restaurantId: actor.restaurantId,
    actorUserId: actor.userId ?? null,
    actorPhone: actor.phone ?? null,
    origin: actor.origin,
  });
}

export async function updateMovement(
  db: any,
  actor: MovementActor,
  movementId: string,
  patch: Partial<MovementInput>,
): Promise<MovementResult> {
  const { data: before } = await db
    .from("movements")
    .select("*")
    .eq("id", movementId)
    .eq("restaurant_id", actor.restaurantId)
    .maybeSingle();
  if (!before) return { id: null, duplicated: false, error: "lançamento não encontrado" };

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined && v !== null) clean[k] = v;
  if (Object.keys(clean).length === 0) return { id: movementId, duplicated: false };

  const { error } = await db.from("movements").update(clean).eq("id", movementId).eq("restaurant_id", actor.restaurantId);
  if (error) return { id: null, duplicated: false, error: error.message };

  if (clean["amount"] != null) {
    await db.from("financial_adjustments").insert({
      restaurant_id: actor.restaurantId,
      target_table: "movements",
      target_id: movementId,
      field: "amount",
      original_value: Number(before.amount),
      adjusted_value: Number(clean["amount"]),
      delta_amount: Number(clean["amount"]) - Number(before.amount),
      reason: `correção via ${actor.origin}`,
      created_by: actor.userId ?? null,
    });
  }

  await audit(db, {
    action: "movement.updated",
    entity: "movement",
    entityId: movementId,
    restaurantId: actor.restaurantId,
    actorUserId: actor.userId ?? null,
    actorPhone: actor.phone ?? null,
    origin: actor.origin,
    before: { amount: before.amount, movement_date: before.movement_date, category_id: before.category_id, type: before.type },
    after: clean,
  });

  return { id: movementId, duplicated: false };
}

/** Exclusão LÓGICA — sai dos cálculos, continua recuperável. */
export async function archiveMovement(
  db: any,
  actor: MovementActor,
  movementId: string,
  reason = "excluído pelo usuário",
): Promise<MovementResult> {
  const { data: before } = await db
    .from("movements")
    .select("*")
    .eq("id", movementId)
    .eq("restaurant_id", actor.restaurantId)
    .maybeSingle();
  if (!before) return { id: null, duplicated: false, error: "lançamento não encontrado" };

  await db
    .from("movements")
    .update({ status: "deleted", notes: reason })
    .eq("id", movementId)
    .eq("restaurant_id", actor.restaurantId);

  await audit(db, {
    action: "movement.archived",
    entity: "movement",
    entityId: movementId,
    restaurantId: actor.restaurantId,
    actorUserId: actor.userId ?? null,
    actorPhone: actor.phone ?? null,
    origin: actor.origin,
    before: { status: before.status, amount: before.amount },
    after: { status: "deleted" },
    note: reason,
  });
  return { id: movementId, duplicated: false };
}

export async function restoreMovement(
  db: any,
  actor: MovementActor,
  movementId: string,
): Promise<MovementResult> {
  const { data: before } = await db
    .from("movements")
    .select("id, status, amount")
    .eq("id", movementId)
    .eq("restaurant_id", actor.restaurantId)
    .maybeSingle();
  if (!before) return { id: null, duplicated: false, error: "lançamento não encontrado" };

  await db
    .from("movements")
    .update({ status: "active", notes: "recuperado" })
    .eq("id", movementId)
    .eq("restaurant_id", actor.restaurantId);

  await audit(db, {
    action: "movement.restored",
    entity: "movement",
    entityId: movementId,
    restaurantId: actor.restaurantId,
    actorUserId: actor.userId ?? null,
    actorPhone: actor.phone ?? null,
    origin: actor.origin,
    before: { status: before.status },
    after: { status: "active" },
  });
  return { id: movementId, duplicated: false };
}

/**
 * "Começar do zero" do negócio: tira TODOS os lançamentos ativos dos cálculos.
 * Preserva usuário, telefone, negócio, contatos e auditoria.
 */
export async function resetBusinessFinance(
  db: any,
  actor: MovementActor,
): Promise<{ count: number; total: number }> {
  const { data } = await db
    .from("movements")
    .select("id, amount")
    .eq("restaurant_id", actor.restaurantId)
    .eq("status", "active");
  const rows = (data ?? []) as any[];
  const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

  if (rows.length > 0) {
    await db
      .from("movements")
      .update({ status: "deleted", notes: `reinício solicitado via ${actor.origin}` })
      .eq("restaurant_id", actor.restaurantId)
      .eq("status", "active");
  }

  await audit(db, {
    action: "finance.reset",
    entity: "restaurant",
    entityId: actor.restaurantId,
    restaurantId: actor.restaurantId,
    actorUserId: actor.userId ?? null,
    actorPhone: actor.phone ?? null,
    origin: actor.origin,
    after: { movements_archived: rows.length, total },
    note: "reset financeiro: contatos, usuário, negócio e auditoria preservados",
  });

  return { count: rows.length, total };
}
