/**
 * IDENTIDADE WHATSAPP — a fonte da verdade do vínculo.
 *
 *   telefone normalizado -> whatsapp_identities -> user_id -> restaurant_id
 *
 * Regras:
 * - todo número que já falou com a IA fica registrado (status `known`), mesmo
 *   sem conta ou negócio. Esses contatos NUNCA são apagados;
 * - nada de DEFAULT_RESTAURANT_ID, negócio padrão ou match por nome/email;
 * - se o mesmo telefone apontar para mais de um usuário/negócio, a identidade
 *   é marcada com conflito e o processamento para (resolução no painel admin).
 */

import { audit } from "@/lib/audit.server";
import { normalizePhone } from "@/lib/whatsapp/phone";

export type IdentityStatus = "known" | "onboarding" | "verified" | "blocked";

export interface WhatsAppIdentity {
  id: string;
  phone_normalized: string;
  talktome_contact_id: string | null;
  display_name: string | null;
  user_id: string | null;
  restaurant_id: string | null;
  status: IdentityStatus;
  has_conflict: boolean;
  conflict_note: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
  verified_at: string | null;
  blocked_at: string | null;
}

const SELECT =
  "id, phone_normalized, talktome_contact_id, display_name, user_id, restaurant_id, status, has_conflict, conflict_note, first_message_at, last_message_at, verified_at, blocked_at";

export { normalizePhone };

export async function findIdentity(db: any, phoneRaw: string): Promise<WhatsAppIdentity | null> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return null;
  const { data } = await db
    .from("whatsapp_identities")
    .select(SELECT)
    .eq("phone_normalized", phone)
    .maybeSingle();
  return (data as WhatsAppIdentity) ?? null;
}

/**
 * Registra (ou atualiza) o contato que acabou de mandar mensagem.
 * Nunca cria usuário nem negócio: só garante que o número está conhecido.
 */
export async function touchIdentity(
  db: any,
  input: { phoneRaw: string; contactId?: string | null; displayName?: string | null },
): Promise<WhatsAppIdentity | null> {
  const phone = normalizePhone(input.phoneRaw);
  if (!phone) return null;
  const now = new Date().toISOString();

  const existing = await findIdentity(db, phone);
  if (!existing) {
    const { data } = await db
      .from("whatsapp_identities")
      .insert({
        phone_normalized: phone,
        talktome_contact_id: input.contactId ?? input.phoneRaw ?? phone,
        display_name: input.displayName ?? null,
        status: "known",
        first_message_at: now,
        last_message_at: now,
      })
      .select(SELECT)
      .maybeSingle();
    if (data) {
      await audit(db, {
        action: "identity.created",
        entity: "whatsapp_identity",
        entityId: data.id,
        actorPhone: phone,
        origin: "whatsapp",
        after: { phone_normalized: phone, status: "known" },
        note: "primeiro contato pelo WhatsApp",
      });
    }
    return (data as WhatsAppIdentity) ?? null;
  }

  const patch: Record<string, any> = { last_message_at: now };
  if (!existing.first_message_at) patch["first_message_at"] = now;
  if (input.contactId && !existing.talktome_contact_id) patch["talktome_contact_id"] = input.contactId;
  if (input.displayName && !existing.display_name) patch["display_name"] = input.displayName;

  const { data } = await db
    .from("whatsapp_identities")
    .update(patch)
    .eq("id", existing.id)
    .select(SELECT)
    .maybeSingle();
  return ((data as WhatsAppIdentity) ?? existing) ?? null;
}

export async function setIdentityStatus(
  db: any,
  identityId: string,
  status: IdentityStatus,
): Promise<void> {
  const patch: Record<string, any> = { status };
  if (status === "verified") patch["verified_at"] = new Date().toISOString();
  if (status === "blocked") patch["blocked_at"] = new Date().toISOString();
  await db.from("whatsapp_identities").update(patch).eq("id", identityId);
}

/** Vincula definitivamente telefone -> usuário -> negócio. */
export async function linkIdentity(
  db: any,
  input: {
    identityId: string;
    userId: string;
    restaurantId: string;
    displayName?: string | null;
    origin?: "whatsapp" | "web" | "admin";
    actorUserId?: string | null;
  },
): Promise<WhatsAppIdentity | null> {
  const { data: before } = await db
    .from("whatsapp_identities")
    .select(SELECT)
    .eq("id", input.identityId)
    .maybeSingle();

  const { data } = await db
    .from("whatsapp_identities")
    .update({
      user_id: input.userId,
      restaurant_id: input.restaurantId,
      ...(input.displayName ? { display_name: input.displayName } : {}),
      status: "verified",
      verified_at: new Date().toISOString(),
      has_conflict: false,
      conflict_note: null,
    })
    .eq("id", input.identityId)
    .select(SELECT)
    .maybeSingle();

  await audit(db, {
    action: "identity.linked",
    entity: "whatsapp_identity",
    entityId: input.identityId,
    restaurantId: input.restaurantId,
    actorUserId: input.actorUserId ?? input.userId,
    actorKind: input.origin === "admin" ? "admin" : "user",
    actorPhone: before?.phone_normalized ?? null,
    origin: input.origin ?? "whatsapp",
    before: before ? { user_id: before.user_id, restaurant_id: before.restaurant_id, status: before.status } : null,
    after: { user_id: input.userId, restaurant_id: input.restaurantId, status: "verified" },
  });

  return (data as WhatsAppIdentity) ?? null;
}

export async function flagConflict(db: any, identityId: string, note: string): Promise<void> {
  await db
    .from("whatsapp_identities")
    .update({ has_conflict: true, conflict_note: note })
    .eq("id", identityId);
  await audit(db, {
    action: "identity.conflict",
    entity: "whatsapp_identity",
    entityId: identityId,
    origin: "system",
    note,
  });
}

/**
 * Procura vínculos antigos do telefone (negócio cadastrado com esse WhatsApp).
 * Devolve todos os candidatos para detectar conflito antes de reutilizar.
 */
export async function findLegacyLinks(
  db: any,
  phone: string,
): Promise<{ restaurantId: string; userId: string; name: string }[]> {
  const { data } = await db
    .from("restaurants")
    .select("id, name, owner_id, whatsapp, archived_at")
    .not("whatsapp", "is", null)
    .is("archived_at", null);
  return (data ?? [])
    .filter((r: any) => normalizePhone(r.whatsapp) === phone)
    .map((r: any) => ({ restaurantId: r.id, userId: r.owner_id, name: r.name }));
}

/** Máscara para exibição no painel admin: 5562*****9722 */
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return phone;
  return `${phone.slice(0, 4)}${"*".repeat(phone.length - 8)}${phone.slice(-4)}`;
}
