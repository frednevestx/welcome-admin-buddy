import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de entrada do WhatsApp via TalkToMe.
 * URL pública: POST /api/public/whatsapp/talktome
 *
 * Mesmo comportamento de /api/public/whatsapp/gemini: as duas rotas apontam
 * para o handler compartilhado (onboarding automático + orquestrador).
 * Além de responder no corpo HTTP, esta rota também envia a resposta pelo
 * canal do TalkToMe, para provedores que não usam a resposta da requisição.
 */

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/whatsapp/talktome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: any;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { handleWhatsAppWebhook } = await import("@/lib/whatsapp/webhook.server");
          const { extractMessage } = await import("@/lib/whatsapp/webhook.server");

          const outcome = await handleWhatsAppWebhook(supabaseAdmin as any, body);
          const reply = outcome.body["reply"];

          if (typeof reply === "string" && reply.trim()) {
            const { phone } = extractMessage(body);
            if (phone) {
              const { sendTalkToMeMessage, isTalkToMeConfigured } = await import(
                "@/lib/integrations/talktome/client.server"
              );
              if (isTalkToMeConfigured()) {
                const sent = await sendTalkToMeMessage(phone, reply);
                if (!sent.ok) console.error("[talktome] falha ao responder", sent.status, sent.error);
              }
            }
          }

          return json(outcome.body, outcome.status);
        } catch (err) {
          console.error("[whatsapp/talktome]", err);
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
