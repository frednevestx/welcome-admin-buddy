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
  | {
      kind: "create_reminder";
      description: string;
      due_date: string;
      reminder_kind: "compromisso" | "tarefa" | "acompanhamento";
    }
  | {
      kind: "create_payable";
      description: string;
      amount: number;
      due_date: string;
      supplier_id: string | null;
    }
  | { kind: "analysis"; subject: string }
  | { kind: "confirm_update"; movement_id: string; label: string; changes: MovementChangesCtx }
  | { kind: "confirm_delete"; movement_id: string; label: string }
  | {
      /**
       * Lançamentos JÁ gravados (status active, confirmed_by_user = false)
       * aguardando o sim/não do usuário. Um único lançamento também usa isso.
       */
      kind: "confirm_movements";
      ids: string[];
      summary: string;
      created_at: string;
    }
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
  /** Sugestões proativas já mostradas há pouco (para não repetir). */
  hint_history?: string[] | null;
}

export const CONTEXT_TTL_MS = 30 * 60 * 1000;

export interface DueConversationItem {
  id: string;
  source: "reminder" | "payable";
  description: string;
  due_date: string;
  amount: number | null;
}

const isoToday = () => new Date().toISOString().slice(0, 10);

/** Itens vencidos que ainda não foram mencionados hoje nesta conversa. */
export async function loadDueConversationItems(
  db: any,
  restaurantId: string,
  contactId: string | null,
  limit = 3,
): Promise<DueConversationItem[]> {
  const today = isoToday();
  const dayStart = `${today}T00:00:00.000Z`;

  let remindersQuery = db
    .from("reminders")
    .select("id, description, due_date")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .lte("due_date", today)
    .or(`sent_at.is.null,sent_at.lt.${dayStart}`)
    .order("due_date", { ascending: true });
  if (contactId) remindersQuery = remindersQuery.or(`contact_id.eq.${contactId},contact_id.is.null`);

  const [{ data: reminders }, { data: payables }] = await Promise.all([
    remindersQuery,
    db
      .from("payables")
      .select("id, description, amount, due_date")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .lte("due_date", today)
      .order("due_date", { ascending: true }),
  ]);

  const payableRows = payables ?? [];
  const payableKeys = payableRows.map((row: any) => `payable_due:${row.id}:${today}`);
  let mentioned = new Set<string>();
  if (payableKeys.length > 0) {
    const { data: events } = await db
      .from("system_events")
      .select("dedupe_key")
      .eq("restaurant_id", restaurantId)
      .in("dedupe_key", payableKeys)
      .gte("sent_at", dayStart);
    mentioned = new Set((events ?? []).map((event: any) => event.dedupe_key));
  }

  return [
    ...(reminders ?? []).map((row: any) => ({
      id: row.id,
      source: "reminder" as const,
      description: row.description,
      due_date: row.due_date,
      amount: null,
    })),
    ...payableRows
      .filter((row: any) => !mentioned.has(`payable_due:${row.id}:${today}`))
      .map((row: any) => ({
        id: row.id,
        source: "payable" as const,
        description: row.description,
        due_date: row.due_date,
        amount: Number(row.amount),
      })),
  ]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, limit);
}

/** Registra a menção sem concluir nem alterar o status do item. */
export async function markDueConversationItemsMentioned(
  db: any,
  restaurantId: string,
  contactId: string | null,
  items: DueConversationItem[],
) {
  if (items.length === 0) return;
  const mentionedAt = new Date().toISOString();
  const reminderIds = items.filter((item) => item.source === "reminder").map((item) => item.id);
  if (reminderIds.length > 0) {
    await db.from("reminders").update({ sent_at: mentionedAt }).in("id", reminderIds).eq("restaurant_id", restaurantId);
  }

  const today = isoToday();
  const payableItems = items.filter((item) => item.source === "payable");
  if (payableItems.length > 0) {
    await db.from("system_events").insert(
      payableItems.map((item) => ({
        restaurant_id: restaurantId,
        contact_id: contactId,
        kind: "reminder",
        title: "Conta vencida mencionada",
        body: item.description,
        reason: `conta vencida em ${item.due_date}`,
        severity: "warning",
        impact_amount: item.amount,
        dedupe_key: `payable_due:${item.id}:${today}`,
        reference_value: item.amount,
        status: "shown",
        sent_at: mentionedAt,
        payload: { payable_id: item.id, due_date: item.due_date },
        reference_date: today,
      })),
    );
  }
}

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
    hint_history: ctx.hint_history ?? null,
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
