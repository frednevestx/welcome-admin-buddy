/**
 * Handler compartilhado do webhook de WhatsApp (TalkToMe).
 *
 * Fluxo:
 *   payload -> telefone normalizado -> [imagem/áudio -> texto via Gemini,
 *   se "text" vier vazio] -> deduplicação -> negócio (ou onboarding)
 *   -> orquestrador -> log em whatsapp_raw_events -> resposta
 *
 * Nenhum dado é compartilhado entre negócios: o restaurant_id sempre vem do
 * telefone que enviou a mensagem.
 *
 * Imagem/áudio são só uma PONTE: viram texto e caem no mesmo orquestrador
 * de sempre (register_movement, query_*, reset, etc.) — nenhuma lógica de
 * negócio nova foi criada para eles.
 */

import { dedupeKey, normalizePhone } from "./phone";
import { resolveOrOnboard, loadSession, saveSession } from "./onboarding.server";
import { describeImageAsMessage, transcribeAudioAsMessage } from "./media.server";

export interface WebhookOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Classifica o media_type que a TalkToMe manda (varia por tipo de WhatsApp:
 * "audio", "ptt" = voice note, "image", "video", "document", etc.).
 */
function classifyMediaType(mediaType: string | null): "audio" | "image" | "other" | null {
  if (!mediaType) return null;
  const t = mediaType.toLowerCase();
  if (t.includes("audio") || t.includes("ptt") || t.includes("voice") || t.includes("ogg")) return "audio";
  if (t.includes("image") || t.includes("jpeg") || t.includes("jpg") || t.includes("png")) return "image";
  return "other";
}

export function extractMessage(body: any): {
  phone: string | null;
  text: string;
  messageId: string | null;
  mediaUrl: string | null;
  mediaKind: "audio" | "image" | "other" | null;
  mediaType: string | null;
  name: string | null;
} {
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

  // Campo real enviado pela TalkToMe pra QUALQUER mídia (áudio, imagem,
  // vídeo, documento): media_url + media_type. Quando o contato manda
  // áudio, a TalkToMe já transcreve e popula "text" com a transcrição —
  // media_url/media_type só importam quando "text" vem vazio.
  const mediaUrlRaw = body?.media_url ?? body?.message?.media_url ?? null;
  const mediaTypeRaw = body?.media_type ?? body?.message?.media_type ?? null;
  const mediaUrl = typeof mediaUrlRaw === "string" && mediaUrlRaw.trim() ? mediaUrlRaw.trim() : null;
  const mediaType = typeof mediaTypeRaw === "string" && mediaTypeRaw.trim() ? mediaTypeRaw.trim() : null;
  const name = body?.name ?? body?.contact?.name ?? null;

  return {
    phone,
    text: typeof rawText === "string" ? rawText.trim() : "",
    messageId: messageId ? String(messageId) : null,
    mediaUrl,
    mediaKind: mediaUrl ? classifyMediaType(mediaType) : null,
    mediaType,
    name: typeof name === "string" && name.trim() ? name.trim() : null,
  };
}

/** Evita processar a mesma mensagem duas vezes (retry do provedor). */
async function alreadyHandled(db: any, phone: string, key: string): Promise<boolean> {
  const session = await loadSession(db, phone);
  const ctx = session?.context ?? {};
  if (ctx["last_key"] === key) return true;
  return false;
}

export async function handleWhatsAppWebhook(db: any, body: any): Promise<WebhookOutcome> {
  const { phone, text, messageId, mediaUrl, mediaKind, mediaType, name } = extractMessage(body);

  if (!phone) {
    return {
      status: 400,
      body: {
        error: "telefone não identificado no payload",
        debug_received_body: body,
      },
    };
  }

  // "text" já é o que a TalkToMe entende como mensagem pronta (texto digitado
  // ou áudio já transcrito por ela). Só recorremos ao Gemini quando ela NÃO
  // mandou nada utilizável em "text" — ou porque a transcrição falhou, ou
  // porque é uma mídia que a TalkToMe não transcreve (imagem).
  let effectiveText = text;
  let mediaOrigin: "image" | "audio" | null = null;

  if (!effectiveText && mediaUrl && mediaKind === "image") {
    try {
      const described = await describeImageAsMessage(mediaUrl, mediaType, name);
      if (described) {
        effectiveText = described;
        mediaOrigin = "image";
      }
    } catch (err) {
      console.error("[whatsapp/webhook] falha ao interpretar imagem", err);
    }
  }

  if (!effectiveText && mediaUrl && mediaKind === "audio") {
    try {
      const transcribed = await transcribeAudioAsMessage(mediaUrl);
      if (transcribed) {
        effectiveText = transcribed;
        mediaOrigin = "audio";
      }
    } catch (err) {
      console.error("[whatsapp/webhook] falha ao transcrever áudio", err);
    }
  }

  if (!effectiveText) {
    // Mídia chegou mas não deu pra entender (ou é um tipo não suportado
    // ainda, ex.: vídeo/documento): nunca 500, resposta amigável.
    if (mediaUrl) {
      return {
        status: 200,
        body: {
          reply: "Não consegui entender essa imagem ou áudio agora — pode descrever em texto ou mandar de novo?",
        },
      };
    }
    return {
      status: 400,
      body: {
        error: "mensagem vazia",
        debug_received_body: body,
        debug_extracted: { phone, text, mediaUrl, mediaKind, mediaType },
      },
    };
  }

  const key = dedupeKey({ messageId, phone, text: effectiveText });
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
  const resolved = await resolveOrOnboard(db, { phone, message: effectiveText, contactId: phone });
  if (resolved.kind === "reply") {
    await saveSessionReply(db, phone, key, resolved.reply);
    return { status: 200, body: { reply: resolved.reply, onboarding: true } };
  }

  const restaurantId = resolved.restaurantId;
  const messageForAI = resolved.bufferedMessage ?? effectiveText;

  /* Evento cru primeiro: é ele que dá rastreabilidade e idempotência. */
  const { data: eventRow } = await db
    .from("whatsapp_raw_events")
    .insert({
      restaurant_id: restaurantId,
      contact_id: phone,
      message_type: mediaOrigin ?? "text",
      raw_message: mediaOrigin ? `[${mediaOrigin}] ${effectiveText}` : effectiveText,
    })
    .select("id")
    .maybeSingle();
  const eventId: string | null = eventRow?.id ?? null;

  const { runOrchestrator } = await import("./orchestrator.server");
  let result;
  try {
    result = await runOrchestrator(db, {
      restaurantId,
      contactId: phone,
      message: messageForAI,
      eventId,
      userId: resolved.userId,
      idempotencyKey: eventId ? `whatsapp:${eventId}` : `whatsapp:${key}`,
    });
  } catch (err) {
    console.error("[whatsapp/webhook] orquestrador falhou", err);
    const reply =
      "Deu um problema aqui do meu lado e não consegui tratar sua mensagem — não registrei nada. Pode me mandar de novo?";
    await saveSessionReply(db, phone, key, reply, restaurantId);
    return { status: 200, body: { reply } };
  }

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
