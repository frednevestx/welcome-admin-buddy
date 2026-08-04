import type { NormalizedOrder, ProviderId, ProviderTokens } from "./types";
import { getProvider } from "./registry.server";
import { decryptToken, encryptToken } from "./crypto.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export interface IntegrationRow {
  id: string;
  restaurant_id: string;
  provider: ProviderId;
  status: string;
  external_merchant_id: string | null;
  external_merchant_name: string | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
  orders_synced: number;
}

export async function saveTokens(integrationId: string, tokens: ProviderTokens) {
  const db = await admin();
  await db
    .from("integrations")
    .update({
      status: "connected",
      access_token_ciphertext: encryptToken(tokens.accessToken),
      refresh_token_ciphertext: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      token_expires_at: tokens.expiresAt ?? null,
      external_merchant_id: tokens.merchantId ?? null,
      external_merchant_name: tokens.merchantName ?? null,
      scopes: tokens.scopes ?? [],
      last_error: null,
    })
    .eq("id", integrationId);
}

/** Devolve tokens válidos, renovando automaticamente quando possível. */
export async function loadTokens(row: IntegrationRow): Promise<ProviderTokens | null> {
  if (!row.access_token_ciphertext) return null;
  const provider = getProvider(row.provider);
  let tokens: ProviderTokens = {
    accessToken: decryptToken(row.access_token_ciphertext),
    refreshToken: row.refresh_token_ciphertext ? decryptToken(row.refresh_token_ciphertext) : null,
    expiresAt: row.token_expires_at,
    merchantId: row.external_merchant_id,
    merchantName: row.external_merchant_name,
  };

  const expired = !!tokens.expiresAt && new Date(tokens.expiresAt).getTime() < Date.now() + 60_000;
  if (expired && provider && tokens.refreshToken) {
    const refreshed = await provider.refreshTokens(tokens.refreshToken);
    tokens = { ...tokens, ...refreshed };
    await saveTokens(row.id, tokens);
  } else if (expired) {
    const db = await admin();
    await db.from("integrations").update({ status: "expired" }).eq("id", row.id);
    return null;
  }
  return tokens;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Grava os pedidos brutos (somente leitura) e reconsolida as vendas do dia. */
export async function persistOrders(
  row: IntegrationRow,
  orders: NormalizedOrder[],
): Promise<number> {
  if (!orders.length) return 0;
  const db = await admin();

  const rows = orders.map((o) => {
    const at = new Date(o.ordered_at);
    return {
      restaurant_id: row.restaurant_id,
      integration_id: row.id,
      provider: row.provider,
      external_order_id: o.external_order_id,
      order_number: o.order_number ?? null,
      ordered_at: at.toISOString(),
      order_date: isoDate(at),
      order_hour: at.getUTCHours(),
      customer_name: o.customer_name ?? null,
      items: o.items,
      items_count: o.items.reduce((a, i) => a + (Number(i.quantity) || 0), 0),
      gross_amount: o.gross_amount,
      commission: o.commission,
      delivery_fee: o.delivery_fee,
      marketing_fee: o.marketing_fee,
      other_fees: o.other_fees,
      coupons: o.coupons,
      cancellation_amount: o.cancellation_amount,
      is_cancelled: o.is_cancelled,
      payout_amount: o.payout_amount,
      net_amount: o.net_amount,
      payment_method: o.payment_method ?? null,
      raw_payload: o.raw_payload,
    };
  });

  const { error } = await db
    .from("orders_imported")
    .upsert(rows, { onConflict: "restaurant_id,provider,external_order_id" });
  if (error) throw error;

  await reconsolidateSales(row, Array.from(new Set(rows.map((r) => r.order_date))));
  return rows.length;
}

/** Recalcula a linha de vendas automáticas por dia a partir dos pedidos importados. */
export async function reconsolidateSales(row: IntegrationRow, dates: string[]) {
  if (!dates.length) return;
  const db = await admin();
  const source = row.provider === "ifood" ? "ifood" : row.provider === "99food" ? "99food" : "loja";

  const { data: orders } = await db
    .from("orders_imported")
    .select(
      "order_date, gross_amount, commission, delivery_fee, marketing_fee, other_fees, coupons, cancellation_amount, net_amount",
    )
    .eq("restaurant_id", row.restaurant_id)
    .eq("provider", row.provider)
    .in("order_date", dates);

  await db
    .from("sales")
    .delete()
    .eq("restaurant_id", row.restaurant_id)
    .eq("source", source)
    .eq("origin", "automatico")
    .in("sale_date", dates);

  const byDate = new Map<string, any>();
  for (const o of orders ?? []) {
    const cur =
      byDate.get(o.order_date) ??
      {
        restaurant_id: row.restaurant_id,
        integration_id: row.id,
        origin: "automatico",
        source,
        sale_date: o.order_date,
        orders_count: 0,
        gross_amount: 0,
        commission: 0,
        delivery_fee: 0,
        marketing_fee: 0,
        fees: 0,
        coupons: 0,
        cancellations: 0,
        net_amount: 0,
        source_ref: `${row.provider}:auto`,
      };
    cur.orders_count += 1;
    cur.gross_amount += Number(o.gross_amount) || 0;
    cur.commission += Number(o.commission) || 0;
    cur.delivery_fee += Number(o.delivery_fee) || 0;
    cur.marketing_fee += Number(o.marketing_fee) || 0;
    cur.fees += Number(o.other_fees) || 0;
    cur.coupons += Number(o.coupons) || 0;
    cur.cancellations += Number(o.cancellation_amount) || 0;
    cur.net_amount += Number(o.net_amount) || 0;
    byDate.set(o.order_date, cur);
  }

  if (byDate.size) {
    const { error } = await db.from("sales").insert(Array.from(byDate.values()));
    if (error) throw error;
  }
}

export async function getIntegration(
  restaurantId: string,
  provider: ProviderId,
): Promise<IntegrationRow | null> {
  const db = await admin();
  const { data } = await db
    .from("integrations")
    .select(
      "id, restaurant_id, provider, status, external_merchant_id, external_merchant_name, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, orders_synced",
    )
    .eq("restaurant_id", restaurantId)
    .eq("provider", provider)
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function ensureIntegration(
  restaurantId: string,
  provider: ProviderId,
  userId: string | null,
): Promise<IntegrationRow> {
  const existing = await getIntegration(restaurantId, provider);
  if (existing) return existing;
  const db = await admin();
  const { data, error } = await db
    .from("integrations")
    .insert({ restaurant_id: restaurantId, provider, status: "connecting", connected_by: userId })
    .select(
      "id, restaurant_id, provider, status, external_merchant_id, external_merchant_name, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, orders_synced",
    )
    .single();
  if (error) throw error;
  return data as IntegrationRow;
}

/**
 * Executa uma sincronização completa ou incremental no backend,
 * registrando log de início/fim, quantidade e erro.
 */
export async function runSync(input: {
  row: IntegrationRow;
  kind: "historico" | "incremental" | "webhook" | "manual";
  days?: number;
}): Promise<{ ok: boolean; processed: number; error?: string }> {
  const db = await admin();
  const { row, kind } = input;

  const { data: log } = await db
    .from("sync_logs")
    .insert({
      integration_id: row.id,
      restaurant_id: row.restaurant_id,
      kind,
      status: "running",
    })
    .select("id")
    .single();

  try {
    const provider = getProvider(row.provider);
    if (!provider) throw new Error("Conector indisponível");
    const tokens = await loadTokens(row);
    if (!tokens) throw new Error("Integração sem token válido. Reconecte a plataforma.");

    const days = input.days ?? (kind === "historico" ? 365 : 7);
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await provider.fetchOrders({
      tokens,
      since: isoDate(since),
      until: isoDate(until),
    });
    const processed = await persistOrders(row, orders);

    await db
      .from("sync_logs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        records_processed: processed,
      })
      .eq("id", log?.id);

    await db
      .from("integrations")
      .update({
        status: "connected",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        orders_synced: (row.orders_synced ?? 0) + processed,
      })
      .eq("id", row.id);

    return { ok: true, processed };
  } catch (e: any) {
    const message = String(e?.message ?? e);
    console.error("[integrations] sync error", row.provider, message);
    await db
      .from("sync_logs")
      .update({ status: "error", finished_at: new Date().toISOString(), error_message: message })
      .eq("id", log?.id);
    await db.from("integrations").update({ status: "error", last_error: message }).eq("id", row.id);
    return { ok: false, processed: 0, error: message };
  }
}
