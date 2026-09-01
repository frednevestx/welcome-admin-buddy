import { createFileRoute } from "@tanstack/react-router";

/**
 * Ponte TalkToMe (WhatsApp) -> LUUD.
 * URL pública: POST /api/public/whatsapp/gemini
 *
 * Esta rota é só TRANSPORTE + LOG. Toda a inteligência conversacional vive no
 * orquestrador (src/lib/whatsapp/orchestrator.server.ts):
 *   resolver negócio -> contexto -> interpretação -> ação -> resposta (+1 insight)
 *
 * Secrets usadas: GEMINI_API_KEY, LOVABLE_API_KEY (fallback),
 * DEFAULT_RESTAURANT_ID (opcional).
 */

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

async function resolveRestaurantId(db: any, body: any): Promise<string | null> {
  const direct = body?.restaurant_id ?? body?.metadata?.restaurant_id;
  if (direct) return direct;

  // Payload real do TalkToMe: { text, phone } — casa o phone recebido com o
  // whatsapp cadastrado no negócio (últimos 8 dígitos).
  const incomingPhone = body?.phone ?? null;
  if (incomingPhone) {
    const digits = String(incomingPhone).replace(/\D/g, "");
    const { data } = await db
      .from("restaurants")
      .select("id")
      .ilike("whatsapp", `%${digits.slice(-8)}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }

  return process.env.DEFAULT_RESTAURANT_ID ?? null;
}

export const Route = createFileRoute("/api/public/whatsapp/gemini")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;

          const restaurantId = await resolveRestaurantId(db, body);
          const contactId = body?.phone ?? body?.contact?.id ?? body?.contact_id ?? null;
          const rawMessage: string =
            body?.text ?? body?.message?.text ?? body?.message?.transcription ?? "";

          // ---- Comandos internos do sistema (scheduler/TalkToMe) ----
          const { extractSystemCommand, handleSystemCommand } = await import(
            "@/lib/proactive/commands.server"
          );
          const systemCommand = extractSystemCommand(body);
          if (systemCommand) {
            if (!restaurantId) return json({ action: "none" });
            return json(await handleSystemCommand(db, systemCommand, restaurantId, contactId));
          }

          if (!restaurantId) {
            return json({
              reply:
                "Não consegui identificar o negócio dessa conversa. Verifique se o número de WhatsApp está cadastrado no LUUD.",
            });
          }
          if (!rawMessage) return json({ error: "payload incompleto" }, 400);

          const { runOrchestrator } = await import("@/lib/whatsapp/orchestrator.server");
          const result = await runOrchestrator(db, {
            restaurantId,
            contactId,
            message: rawMessage,
            eventId: null,
          });

          // Log da conversa (depois da orquestração: ela precisa saber se esta é a
          // primeira mensagem do dia).
          const { data: eventRow } = await db
            .from("whatsapp_raw_events")
            .insert({
              restaurant_id: restaurantId,
              contact_id: contactId,
              message_type: "text",
              raw_message: rawMessage,
              interpreted_json: result.interpretation,
              classification: result.classification,
              linked_movement_id: result.movementId,
            })
            .select("id")
            .maybeSingle();

          if (result.movementId && eventRow?.id) {
            await db
              .from("movements")
              .update({ created_from_event_id: eventRow.id, source_ref: `whatsapp:${eventRow.id}` })
              .eq("id", result.movementId);
          }

          return json({ reply: result.reply });
        } catch (err) {
          console.error("[whatsapp/gemini]", err);
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
