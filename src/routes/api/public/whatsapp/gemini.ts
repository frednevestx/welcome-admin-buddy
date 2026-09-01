import { createFileRoute } from "@tanstack/react-router";

/**
 * Ponte TalkToMe (WhatsApp) -> LUUD.
 * URL pública: POST /api/public/whatsapp/gemini
 *
 * Só transporte: toda a lógica (onboarding automático, contexto, interpretação,
 * ação e resposta) vive em src/lib/whatsapp/webhook.server.ts.
 *
 * Secrets: GEMINI_API_KEY, LOVABLE_API_KEY (fallback), TALKTOME_API_KEY.
 */

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/whatsapp/gemini")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { handleWhatsAppWebhook } = await import("@/lib/whatsapp/webhook.server");
          const outcome = await handleWhatsAppWebhook(supabaseAdmin as any, body);
          return json(outcome.body, outcome.status);
        } catch (err) {
          console.error("[whatsapp/gemini]", err);
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
