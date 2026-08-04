import type {
  AuthStart,
  IntegrationProvider,
  NormalizedOrder,
  ProviderTokens,
} from "../types";

/**
 * Conector 99Food. A 99Food libera a API por credencial de parceiro;
 * a estrutura já está pronta e ativa assim que as credenciais existirem.
 */
const BASE = process.env["NINETYNINE_API_BASE"] ?? "https://api.99food.com.br";

function creds() {
  return {
    clientId: process.env["NINETYNINE_CLIENT_ID"] ?? "",
    clientSecret: process.env["NINETYNINE_CLIENT_SECRET"] ?? "",
    redirectUri: process.env["NINETYNINE_REDIRECT_URI"] ?? "",
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalize99Order(raw: any): NormalizedOrder {
  const gross = num(raw?.subtotal ?? raw?.total);
  const commission = num(raw?.commission);
  const marketing = num(raw?.marketing_fee);
  const deliveryFee = num(raw?.delivery_fee);
  const coupons = num(raw?.discount ?? raw?.coupon);
  const cancelled = String(raw?.status ?? "").toUpperCase().includes("CANCEL");
  return {
    external_order_id: String(raw?.id ?? raw?.order_id ?? ""),
    order_number: raw?.short_id ? String(raw.short_id) : null,
    ordered_at: String(raw?.created_at ?? new Date().toISOString()),
    customer_name: raw?.customer?.name ? String(raw.customer.name) : null,
    items: Array.isArray(raw?.items)
      ? raw.items.map((i: any) => ({
          name: String(i?.name ?? "Item"),
          quantity: num(i?.quantity) || 1,
          unit_price: num(i?.unit_price),
          total: num(i?.total_price),
        }))
      : [],
    gross_amount: gross,
    commission,
    delivery_fee: deliveryFee,
    marketing_fee: marketing,
    other_fees: num(raw?.other_fees),
    coupons,
    cancellation_amount: cancelled ? gross : 0,
    is_cancelled: cancelled,
    payout_amount: num(raw?.payout ?? gross - commission - marketing),
    net_amount: cancelled ? 0 : gross + deliveryFee - commission - marketing - coupons,
    payment_method: raw?.payment_method ? String(raw.payment_method) : null,
    raw_payload: raw,
  };
}

export const ninetyNineFoodProvider: IntegrationProvider = {
  id: "99food",

  isConfigured() {
    const c = creds();
    return !!c.clientId && !!c.clientSecret;
  },

  async startAuth(): Promise<AuthStart> {
    const c = creds();
    if (!c.clientId || !c.clientSecret) {
      return {
        kind: "unavailable",
        reason:
          "As credenciais de parceiro da 99Food ainda não foram configuradas nesta conta LUUD.",
      };
    }
    const url = new URL(`${BASE}/oauth/authorize`);
    url.searchParams.set("client_id", c.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", c.redirectUri);
    url.searchParams.set("scope", "orders:read financial:read");
    return { kind: "redirect", url: url.toString() };
  },

  async completeAuth({ code }): Promise<ProviderTokens> {
    const c = creds();
    const res = await fetch(`${BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: c.clientId,
        client_secret: c.clientSecret,
        redirect_uri: c.redirectUri,
        code,
      }),
    });
    if (!res.ok) throw new Error(`99Food token falhou (${res.status})`);
    const json = (await res.json()) as any;
    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresAt: new Date(Date.now() + (num(json.expires_in) || 3600) * 1000).toISOString(),
      merchantId: json.merchant_id ? String(json.merchant_id) : null,
      merchantName: json.merchant_name ? String(json.merchant_name) : null,
    };
  },

  async refreshTokens(refreshToken: string): Promise<ProviderTokens> {
    const c = creds();
    const res = await fetch(`${BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`99Food refresh falhou (${res.status})`);
    const json = (await res.json()) as any;
    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : refreshToken,
      expiresAt: new Date(Date.now() + (num(json.expires_in) || 3600) * 1000).toISOString(),
    };
  },

  async fetchOrders({ tokens, since, until }): Promise<NormalizedOrder[]> {
    const url = new URL(`${BASE}/v1/orders`);
    url.searchParams.set("start_date", since);
    url.searchParams.set("end_date", until);
    if (tokens.merchantId) url.searchParams.set("merchant_id", tokens.merchantId);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    if (!res.ok) throw new Error(`99Food pedidos falhou (${res.status})`);
    const json = (await res.json()) as any;
    const list: any[] = Array.isArray(json) ? json : (json?.data ?? json?.orders ?? []);
    return list.map(normalize99Order).filter((o) => o.external_order_id);
  },

  async parseWebhook({ body }) {
    const raw = body as any;
    const order = raw?.order ?? raw?.data ?? raw;
    return {
      merchantId: raw?.merchant_id ? String(raw.merchant_id) : null,
      orders: order?.id || order?.order_id ? [normalize99Order(order)] : [],
    };
  },
};
