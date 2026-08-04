import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook público das integrações: /api/public/integrations/{provider}/webhook
 * Valida a assinatura da plataforma antes de gravar qualquer dado.
 */
export const Route = createFileRoute("/api/public/integrations/$provider/webhook")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const providerId = params.provider;
        const raw = await request.text();

        const { getProvider } = await import("@/lib/integrations/registry.server");
        const provider = getProvider(providerId as any);
        if (!provider) return new Response("Unknown provider", { status: 404 });

        const secret = process.env[`WEBHOOK_SECRET_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
        if (secret) {
          const signature =
            request.headers.get("x-ifood-signature") ??
            request.headers.get("x-signature") ??
            request.headers.get("x-hub-signature-256") ??
            "";
          const { createHmac, timingSafeEqual } = await import("node:crypto");
          const expected = createHmac("sha256", secret).update(raw).digest("hex");
          const a = Buffer.from(signature.replace(/^sha256=/, ""));
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = await provider.parseWebhook({ body, headers: request.headers });
        if (!parsed.orders.length) return Response.json({ ok: true, processed: 0 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        let query = db
          .from("integrations")
          .select(
            "id, restaurant_id, provider, status, external_merchant_id, external_merchant_name, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, orders_synced",
          )
          .eq("provider", providerId)
          .eq("status", "connected");
        if (parsed.merchantId) query = query.eq("external_merchant_id", parsed.merchantId);
        const { data: rows } = await query;
        const row = (rows ?? [])[0];
        if (!row) return Response.json({ ok: true, processed: 0, note: "no matching integration" });

        const { persistOrders } = await import("@/lib/integrations/sync.server");
        const processed = await persistOrders(row, parsed.orders);

        await db
          .from("sync_logs")
          .insert({
            integration_id: row.id,
            restaurant_id: row.restaurant_id,
            kind: "webhook",
            status: "success",
            finished_at: new Date().toISOString(),
            records_processed: processed,
          });
        await db
          .from("integrations")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", row.id);

        return Response.json({ ok: true, processed });
      },
    },
  },
});
