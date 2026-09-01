/**
 * Contexto de conversa do WhatsApp.
 *
 * Reaproveita a tabela `conversation_state` (coluna `pending`, jsonb) que já
 * existia para operação incompleta — agora ela guarda o contexto inteiro:
 * operação pendente, oferta aguardando sim/não, assunto atual e entidades
 * citadas recentemente (ex: o último fornecedor mencionado).
 *
 * Memória curta de propósito: TTL de 30 minutos, no máximo 6 mensagens de
 * histórico. Nada de memória infinita.
 */

export interface PendingOperation {
  movement_type?: "entrada" | "saida" | null;
  category_name?: string | null;
  amount?: number | null;
  movement_date?: string | null;
  supplier_name?: string | null;
  payment_method?: string | null;
  missing?: string | null;
}

export interface MovementChangesCtx {
  amount?: number | null;
  category_name?: string | null;
  movement_date?: string | null;
  movement_type?: "entrada" | "saida" | null;
}

export type PendingOffer =
  | { kind: "daily_summary" }
  | { kind: "create_reminder"; description: string; due_date: string }
  | { kind: "analysis"; subject: string }
  | { kind: "confirm_update"; movement_id: string; label: string; changes: MovementChangesCtx }
  | { kind: "confirm_delete"; movement_id: string; label: string }
  | {
      kind: "choose_movement";
      action: "update" | "delete";
      ids: string[];
      labels: string[];
      changes?: MovementChangesCtx | null;
    }
  | { kind: "confirm_reset" };


export interface ConversationContext {
  /** Operação de registro incompleta, esperando o dado que falta. */
  pending?: PendingOperation | null;
  /** Pergunta aberta aguardando sim/não. */
  offer?: PendingOffer | null;
  /** Assunto corrente, só para dar continuidade ("ele", "isso"). */
  topic?: string | null;
  /** Entidades citadas há pouco. */
  entities?: { supplier_name?: string | null; category_name?: string | null } | null;
  /** Movimento gravado e ainda não confirmado + fornecedor a cadastrar. */
  supplier_to_create?: { name: string; movement_id: string | null } | null;
}

export const CONTEXT_TTL_MS = 30 * 60 * 1000;

export async function loadContext(
  db: any,
  restaurantId: string,
  contactId: string | null,
): Promise<ConversationContext> {
  if (!contactId) return {};
  const { data } = await db
    .from("conversation_state")
    .select("pending, updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (!data?.pending) return {};
  if (Date.now() - new Date(data.updated_at).getTime() > CONTEXT_TTL_MS) return {};

  const raw = data.pending as any;
  // Compatibilidade com o formato antigo (pending "cru" na raiz).
  if (raw && !("pending" in raw) && !("offer" in raw) && !("entities" in raw)) {
    if (raw.offer === "daily_summary") return { offer: { kind: "daily_summary" } };
    return { pending: raw as PendingOperation };
  }
  return raw as ConversationContext;
}

export async function saveContext(
  db: any,
  restaurantId: string,
  contactId: string | null,
  ctx: ConversationContext,
) {
  if (!contactId) return;
  await db.from("conversation_state").upsert(
    {
      restaurant_id: restaurantId,
      contact_id: contactId,
      pending: ctx as any,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,contact_id" },
  );
}

/** Limpa operação/oferta pendente, preservando as entidades citadas. */
export async function clearPending(
  db: any,
  restaurantId: string,
  contactId: string | null,
  ctx: ConversationContext,
) {
  await saveContext(db, restaurantId, contactId, {
    entities: ctx.entities ?? null,
    topic: ctx.topic ?? null,
  });
}

export interface HistoryTurn {
  message: string;
  intent: string | null;
}

/** Últimas mensagens desse contato, mais antiga primeiro. */
export async function recentHistory(
  db: any,
  restaurantId: string,
  contactId: string | null,
  limit = 6,
): Promise<HistoryTurn[]> {
  if (!contactId) return [];
  const { data } = await db
    .from("whatsapp_raw_events")
    .select("raw_message, interpreted_json, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .reverse()
    .map((r: any) => ({ message: r.raw_message ?? "", intent: r.interpreted_json?.intent ?? null }))
    .filter((t: HistoryTurn) => t.message.length > 0);
}

/** Primeira interação desse contato no dia? Medir ANTES de gravar o evento atual. */
export async function isFirstInteractionToday(
  db: any,
  restaurantId: string,
  contactId: string | null,
): Promise<boolean> {
  if (!contactId) return false;
  const startOfDay = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { count } = await db
    .from("whatsapp_raw_events")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .gte("created_at", startOfDay);
  return (count ?? 0) === 0;
}
