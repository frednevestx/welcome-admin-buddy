import { createFileRoute } from "@tanstack/react-router";

/**
 * Sincronização automática em background para plataformas sem webhook.
 * Chamada por job agendado (cron) — nunca depende do navegador.
 */
export const Route = createFileRoute("/api/public/integrations/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        const { data: rows } = await db
          .from("integrations")
          .select(
            "id, restaurant_id, provider, status, external_merchant_id, external_merchant_name, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, orders_synced",
          )
          .in("status", ["connected", "error"]);

        const { runSync } = await import("@/lib/integrations/sync.server");
        const results: { provider: string; ok: boolean; processed: number }[] = [];
        for (const row of rows ?? []) {
          const r = await runSync({ row, kind: "incremental", days: 3 });
          results.push({ provider: row.provider, ok: r.ok, processed: r.processed });
        }

        return Response.json({ ok: true, integrations: results.length, results });
      },
    },
  },
});
