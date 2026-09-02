/**
 * Handler compartilhado do webhook de WhatsApp (TalkToMe).
 *
 * Fluxo:
 *   payload -> telefone normalizado -> deduplicação -> negócio (ou onboarding)
 *   -> orquestrador -> log em whatsapp_raw_events -> resposta
 *
 * Nenhum dado é compartilhado entre negócios: o restaurant_id sempre vem do
 * telefone que enviou a mensagem.
 */

import { dedupeKey, normalizePhone } from "./phone";
import { resolveOrOnboard, loadSession, saveSession } from "./onboarding.server";

export interface WebhookOutcome {
  status: number;
  body: Record<string, unknown>;
}

export function extractMessage(body: any): { phone: string | null; text: string; messageId: string | null } {
  const phone = normalizePhone(
    body?.phone ?? body?.contact?.phone ?? body?.contact?.number ?? body?.from ?? body?.sender?.phone,
  );
  const rawText =
    body?.text ??
    body?.message?.text ??
    body?.message?.body ??
    body?.message?.transcription ??
    (typeof body?.message === "string" ? body.message : "") ??
    "";
  const messageId = body?.message_id ?? body?.id ?? body?.message?.id ?? null;
  return { phone, text: typeof rawText === "string" ? rawText.trim() : "", messageId: messageId ? String(messageId) : null };
}

/** Evita processar a mesma mensagem duas vezes (retry do provedor). */
async function alreadyHandled(db: any, phone: string, key: string): Promise<boolean> {
  const session = await loadSession(db, phone);
  const ctx = session?.context ?? {};
  if (ctx["last_key"] === key) return true;
  return false;
}

export async function handleWhatsAppWebhook(db: any, body: any): Promise<WebhookOutcome> {
  const { phone, text, messageId } = extractMessage(body);

  if (!phone) {
    return { status: 400, body: { error: "telefone não identificado no payload" } };
  }
  if (!text) {
    return { status: 400, body: { error: "mensagem vazia" } };
  }

  const key = dedupeKey({ messageId, phone, text });
  if (await alreadyHandled(db, phone, key)) {
    const session = await loadSession(db, phone);
    return { status: 200, body: { reply: session?.context?.["last_reply"] ?? "", duplicate: true } };
  }

  /* ---- comandos internos do sistema (scheduler) ---- */
  const { extractSystemCommand, handleSystemCommand } = await import("@/lib/proactive/commands.server");
  const systemCommand = extractSystemCommand(body);
  if (systemCommand) {
    const session = await loadSession(db, phone);
    if (!session?.restaurant_id) return { status: 200, body: { action: "none" } };
    const result = await handleSystemCommand(db, systemCommand, session.restaurant_id, phone);
    return { status: 200, body: result as Record<string, unknown> };
  }

  /* ---- identidade + negócio do telefone (cria na primeira conversa) ---- */
  const resolved = await resolveOrOnboard(db, { phone, message: text, contactId: phone });
  if (resolved.kind === "reply") {
    await saveSessionReply(db, phone, key, resolved.reply);
    return { status: 200, body: { reply: resolved.reply, onboarding: true } };
  }

  const restaurantId = resolved.restaurantId;
  const messageForAI = resolved.bufferedMessage ?? text;

  /* Evento cru primeiro: é ele que dá rastreabilidade e idempotência. */
  const { data: eventRow } = await db
    .from("whatsapp_raw_events")
    .insert({
      restaurant_id: restaurantId,
      contact_id: phone,
      message_type: "text",
      raw_message: text,
    })
    .select("id")
    .maybeSingle();
  const eventId: string | null = eventRow?.id ?? null;

  const { runOrchestrator } = await import("./orchestrator.server");
  const result = await runOrchestrator(db, {
    restaurantId,
    contactId: phone,
    message: messageForAI,
    eventId,
    userId: resolved.userId,
    idempotencyKey: eventId ? `whatsapp:${eventId}` : `whatsapp:${key}`,
  });

  if (eventId) {
    await db
      .from("whatsapp_raw_events")
      .update({
        interpreted_json: result.interpretation,
        classification: result.classification,
        linked_movement_id: result.movementId,
      })
      .eq("id", eventId);
  }

  const reply = resolved.prefix ? `${resolved.prefix}\n\n${result.reply}` : result.reply;
  await saveSessionReply(db, phone, key, reply, restaurantId);

  return { status: 200, body: { reply } };
}

async function saveSessionReply(
  db: any,
  phone: string,
  key: string,
  reply: string,
  restaurantId?: string,
) {
  const session = await loadSession(db, phone);
  await saveSession(db, phone, {
    ...(restaurantId ? { restaurant_id: restaurantId, mode: "active" } : {}),
    context: { ...(session?.context ?? {}), last_key: key, last_reply: reply },
  });
}
