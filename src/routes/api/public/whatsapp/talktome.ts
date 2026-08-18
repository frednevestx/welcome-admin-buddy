import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de entrada do WhatsApp via TalkToMe.
 * URL pública: /api/public/whatsapp/talktome  (aceita apenas POST)
 *
 * ATENÇÃO: o formato do payload abaixo é uma suposição inicial:
 *   { contact: { phone: string, name?: string }, message: { text: string } }
 * É PRECISO CONFIRMAR o schema exato na documentação oficial
 * (https://app.talktome.com.br/api/docs). O parser é tolerante e aceita alguns
 * apelidos comuns de campo até essa confirmação.
 *
 * Etapa 1 (atual): apenas provar o loop de comunicação — registra a sessão,
 * loga o payload cru e responde uma mensagem fixa. Sem IA ainda.
 */

const CONFIRMATION_TEXT =
  "Recebi sua mensagem! 👋 Em breve vou conseguir te ajudar de verdade. (teste de integração LUUD)";

function onlyDigits(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v).replace(/\D/g, "") : "";
}

interface ParsedInbound {
  phone: string;
  name: string | null;
  text: string;
}

function parseInbound(body: any): ParsedInbound | null {
  const phone = onlyDigits(
    body?.contact?.phone ?? body?.contact?.number ?? body?.phone ?? body?.from ?? body?.sender?.phone,
  );
  if (!phone) return null;

  const name =
    body?.contact?.name ?? body?.sender?.name ?? body?.name ?? null;
  const text =
    body?.message?.text ?? body?.message?.body ?? body?.text ?? body?.message ?? "";

  return {
    phone,
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    text: typeof text === "string" ? text : "",
  };
}

export const Route = createFileRoute("/api/public/whatsapp/talktome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();

        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const inbound = parseInbound(body);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        // Log do payload cru recebido (reaproveita sync_logs, origem 'talktome_webhook').
        const logRow = {
          kind: "webhook" as const,
          status: (inbound ? "success" : "error") as "success" | "error",
          source: "talktome_webhook",
          payload: body as any,
          finished_at: new Date().toISOString(),
          records_processed: inbound ? 1 : 0,
          error_message: inbound ? null : "Telefone não identificado no payload",
        };

        if (!inbound) {
          await db.from("sync_logs").insert(logRow);
          return new Response("Missing contact phone", { status: 400 });
        }

        // (a) tenta achar o negócio pelo WhatsApp cadastrado
        const { data: restaurants } = await db
          .from("restaurants")
          .select("id, whatsapp")
          .not("whatsapp", "is", null);

        const restaurantId =
          (restaurants ?? []).find((r: any) => onlyDigits(r.whatsapp).endsWith(inbound.phone.slice(-11)))?.id ??
          null;

        // (b) upsert da sessão por telefone
        const { error: sessionError } = await db.from("whatsapp_sessions").upsert(
          {
            phone: inbound.phone,
            restaurant_id: restaurantId,
            last_interaction_at: new Date().toISOString(),
          },
          { onConflict: "phone" },
        );

        await db.from("sync_logs").insert({
          ...logRow,
          restaurant_id: restaurantId,
          status: sessionError ? "error" : "success",
          error_message: sessionError?.message ?? null,
        });

        if (sessionError) {
          console.error("[talktome] falha ao salvar sessão", sessionError.message);
          return new Response("Session error", { status: 500 });
        }

        // Resposta fixa de confirmação pelo canal do TalkToMe
        const { sendTalkToMeMessage } = await import("@/lib/integrations/talktome/client.server");
        const sent = await sendTalkToMeMessage(inbound.phone, CONFIRMATION_TEXT);
        if (!sent.ok) {
          console.error("[talktome] falha ao responder", sent.status, sent.error);
        }

        return Response.json({
          ok: true,
          phone: inbound.phone,
          matchedRestaurant: !!restaurantId,
          replied: sent.ok,
        });
      },
    },
  },
});
