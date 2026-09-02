/**
 * Auditoria central da LUUD.
 *
 * Toda ação relevante (criação de usuário/negócio, vínculo de WhatsApp,
 * criação/correção/exclusão/recuperação de lançamento, reset financeiro,
 * limpeza administrativa e leitura de conversas pelo admin) passa por aqui.
 *
 * A auditoria NUNCA é apagada pelos comandos de reset.
 */

export type AuditOrigin = "whatsapp" | "web" | "admin" | "system";
export type AuditActorKind = "user" | "admin" | "system";

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  restaurantId?: string | null;
  actorUserId?: string | null;
  actorKind?: AuditActorKind;
  actorPhone?: string | null;
  origin?: AuditOrigin;
  before?: unknown;
  after?: unknown;
  note?: string | null;
}

/** Grava um evento de auditoria. Nunca lança: auditoria não derruba o fluxo. */
export async function audit(db: any, input: AuditInput): Promise<void> {
  try {
    await db.from("audit_log").insert({
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      restaurant_id: input.restaurantId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_kind: input.actorKind ?? "system",
      actor_phone: input.actorPhone ?? null,
      origin: input.origin ?? "system",
      before_data: (input.before ?? null) as any,
      after_data: (input.after ?? null) as any,
      note: input.note ?? null,
    });
  } catch (err) {
    console.error("[audit] falha ao registrar", input.action, err);
  }
}
