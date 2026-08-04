import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProviderId } from "@/lib/integrations/types";

const VALID: ProviderId[] = [
  "ifood",
  "99food",
  "rappi",
  "consumer",
  "saipos",
  "goomer",
  "cardapioweb",
  "open_finance",
];

function validateProvider(data: unknown): { provider: ProviderId } {
  const d = data as { provider?: string };
  if (!d?.provider || !VALID.includes(d.provider as ProviderId)) {
    throw new Error("Plataforma inválida");
  }
  return { provider: d.provider as ProviderId };
}

async function restaurantIdOf(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("restaurant_id").eq("id", userId).maybeSingle();
  return data?.restaurant_id ?? null;
}

export interface IntegrationStateDTO {
  provider: ProviderId;
  status: string;
  configured: boolean;
  merchantName: string | null;
  lastSyncAt: string | null;
  ordersSynced: number;
  lastError: string | null;
}

/** Lista o estado de cada integração do negócio (sem nunca expor tokens). */
export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { integrations: [] as IntegrationStateDTO[] };

    const { data } = await supabase
      .from("integrations")
      .select("provider, status, external_merchant_name, last_sync_at, orders_synced, last_error")
      .eq("restaurant_id", restaurantId);

    const { getProvider } = await import("@/lib/integrations/registry.server");

    const integrations: IntegrationStateDTO[] = (data ?? []).map((r: any) => ({
      provider: r.provider,
      status: r.status,
      configured: !!getProvider(r.provider)?.isConfigured(),
      merchantName: r.external_merchant_name ?? null,
      lastSyncAt: r.last_sync_at ?? null,
      ordersSynced: r.orders_synced ?? 0,
      lastError: r.last_error ?? null,
    }));

    const configuredMap: Record<string, boolean> = {};
    for (const p of VALID) configuredMap[p] = !!getProvider(p)?.isConfigured();

    return { integrations, configuredMap };
  });

/** Inicia a autorização oficial da plataforma. Nunca pede usuário e senha. */
export const startIntegrationAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProvider)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { ok: false as const, reason: "Cadastre seu negócio antes de conectar." };

    const { getProvider } = await import("@/lib/integrations/registry.server");
    const provider = getProvider(data.provider);
    if (!provider) {
      return { ok: false as const, reason: "Este conector ainda não está disponível." };
    }
    if (!provider.isConfigured()) {
      return {
        ok: false as const,
        reason:
          "Falta a credencial oficial de parceiro desta plataforma na LUUD. Assim que ela for cadastrada, a conexão fica disponível para todos os negócios.",
      };
    }

    const { ensureIntegration } = await import("@/lib/integrations/sync.server");
    await ensureIntegration(restaurantId, data.provider, userId);

    const start = await provider.startAuth();
    return { ok: true as const, start };
  });

/** Conclui a autorização com o código devolvido pela plataforma. */
export const completeIntegrationAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const base = validateProvider(data);
    const d = data as { code?: string; verifier?: string };
    return { ...base, code: d.code ?? "", verifier: d.verifier ?? "" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { ok: false as const, reason: "Negócio não encontrado." };

    const { getProvider } = await import("@/lib/integrations/registry.server");
    const provider = getProvider(data.provider);
    if (!provider) return { ok: false as const, reason: "Conector indisponível." };

    const { ensureIntegration, saveTokens, runSync, getIntegration } = await import(
      "@/lib/integrations/sync.server"
    );
    const row = await ensureIntegration(restaurantId, data.provider, userId);
    try {
      const tokens = await provider.completeAuth({ code: data.code, verifier: data.verifier });
      await saveTokens(row.id, tokens);
      const fresh = (await getIntegration(restaurantId, data.provider))!;
      const result = await runSync({ row: fresh, kind: "historico", days: 365 });
      return { ok: true as const, processed: result.processed, syncError: result.error ?? null };
    } catch (e: any) {
      return { ok: false as const, reason: String(e?.message ?? e) };
    }
  });

/** Sincroniza agora (incremental) — executa no backend. */
export const syncIntegrationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProvider)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { ok: false as const, reason: "Negócio não encontrado." };

    const { getIntegration, runSync } = await import("@/lib/integrations/sync.server");
    const row = await getIntegration(restaurantId, data.provider);
    if (!row) return { ok: false as const, reason: "Integração não conectada." };
    const result = await runSync({ row, kind: "manual", days: 30 });
    return result.ok
      ? { ok: true as const, processed: result.processed }
      : { ok: false as const, reason: result.error ?? "Falha na sincronização" };
  });

/** Desconecta a plataforma e apaga os tokens. Os dados históricos são preservados. */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProvider)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("integrations")
      .update({
        status: "disconnected",
        access_token_ciphertext: null,
        refresh_token_ciphertext: null,
        token_expires_at: null,
        last_error: null,
      })
      .eq("restaurant_id", restaurantId)
      .eq("provider", data.provider);

    return { ok: true as const };
  });

/** Cria um ajuste financeiro sobre um registro importado, preservando o original. */
export const createFinancialAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as {
      targetTable?: string;
      targetId?: string;
      reason?: string;
      originalValue?: number;
      adjustedValue?: number;
    };
    if (!d?.targetTable || !d?.targetId) throw new Error("Registro alvo obrigatório");
    if (!d.reason || d.reason.trim().length < 3) throw new Error("Informe o motivo do ajuste");
    return {
      targetTable: d.targetTable,
      targetId: d.targetId,
      reason: d.reason.trim().slice(0, 500),
      originalValue: Number(d.originalValue ?? 0),
      adjustedValue: Number(d.adjustedValue ?? 0),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { ok: false as const, reason: "Negócio não encontrado." };

    const delta = data.adjustedValue - data.originalValue;

    const { error } = await supabase.from("financial_adjustments").insert({
      restaurant_id: restaurantId,
      target_table: data.targetTable,
      target_id: data.targetId,
      field: "amount",
      original_value: data.originalValue,
      adjusted_value: data.adjustedValue,
      delta_amount: delta,
      reason: data.reason,
      created_by: userId,
    });
    if (error) return { ok: false as const, reason: error.message };

    // O ajuste entra como lançamento próprio, com origem "ajuste".
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (delta !== 0) {
      await (supabaseAdmin as any).from("movements").insert({
        restaurant_id: restaurantId,
        type: delta > 0 ? "entrada" : "saida",
        origin: "ajuste",
        source_ref: `${data.targetTable}:${data.targetId}`,
        description: `Ajuste: ${data.reason}`,
        amount: Math.abs(delta),
        movement_date: new Date().toISOString().slice(0, 10),
        created_by: userId,
      });
    }

    return { ok: true as const, delta };
  });

/** Resumo curto para o card do dashboard. */
export const integrationSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const restaurantId = await restaurantIdOf(supabase, userId);
    if (!restaurantId) return { cards: [] as any[] };

    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from("integrations")
      .select("provider, status, last_sync_at")
      .eq("restaurant_id", restaurantId)
      .eq("status", "connected");

    const cards = [];
    for (const r of rows ?? []) {
      const { data: orders } = await supabase
        .from("orders_imported")
        .select("net_amount")
        .eq("restaurant_id", restaurantId)
        .eq("provider", r.provider)
        .eq("order_date", today);
      cards.push({
        provider: r.provider,
        status: r.status,
        lastSyncAt: r.last_sync_at,
        ordersToday: (orders ?? []).length,
        revenueToday: (orders ?? []).reduce((a: number, o: any) => a + (Number(o.net_amount) || 0), 0),
      });
    }
    return { cards };
  });
