import type {
  AuthStart,
  IntegrationProvider,
  NormalizedOrder,
  ProviderTokens,
} from "../types";

const BASE = "https://merchant-api.ifood.com.br";

function creds() {
  return {
    clientId: process.env["IFOOD_CLIENT_ID"] ?? "",
    clientSecret: process.env["IFOOD_CLIENT_SECRET"] ?? "",
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Converte o pedido bruto do iFood no padrão interno da LUUD. */
export function normalizeIfoodOrder(raw: any): NormalizedOrder {
  const total = raw?.total ?? {};
  const benefits = num(total.benefits);
  const gross = num(total.subTotal) || num(total.orderAmount);
  const deliveryFee = num(total.deliveryFee);
  const items = Array.isArray(raw?.items)
    ? raw.items.map((i: any) => ({
        name: String(i?.name ?? "Item"),
        quantity: num(i?.quantity) || 1,
        unit_price: num(i?.unitPrice),
        total: num(i?.totalPrice) || num(i?.unitPrice) * (num(i?.quantity) || 1),
      }))
    : [];

  const charges = Array.isArray(raw?.charges) ? raw.charges : [];
  const findCharge = (type: string) =>
    num(charges.find((c: any) => String(c?.type ?? "").toUpperCase().includes(type))?.value);

  const commission = findCharge("COMMISSION");
  const marketing = findCharge("MARKETING") || findCharge("PROMOTION");
  const otherFees = num(total.additionalFees);
  const cancelled = String(raw?.salesChannel ?? "") === "CANCELLED" ||
    String(raw?.status ?? raw?.orderStatus ?? "").toUpperCase().includes("CANCEL");

  const netAmount = gross + deliveryFee - commission - marketing - otherFees - benefits;

  return {
    external_order_id: String(raw?.id ?? raw?.orderId ?? ""),
    order_number: raw?.displayId ? String(raw.displayId) : null,
    ordered_at: String(raw?.createdAt ?? raw?.orderTiming ?? new Date().toISOString()),
    customer_name: raw?.customer?.name ? String(raw.customer.name) : null,
    items,
    gross_amount: gross,
    commission,
    delivery_fee: deliveryFee,
    marketing_fee: marketing,
    other_fees: otherFees,
    coupons: benefits,
    cancellation_amount: cancelled ? gross : 0,
    is_cancelled: cancelled,
    payout_amount: num(total.orderAmount) - commission - marketing - otherFees,
    net_amount: cancelled ? 0 : netAmount,
    payment_method:
      raw?.payments?.methods?.[0]?.method != null
        ? String(raw.payments.methods[0].method)
        : null,
    raw_payload: raw,
  };
}

export const ifoodProvider: IntegrationProvider = {
  id: "ifood",

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
          "As credenciais de parceiro do iFood ainda não foram configuradas nesta conta LUUD.",
      };
    }
    // Fluxo oficial de autorização distribuída do iFood: userCode.
    const res = await fetch(`${BASE}/authentication/v1.0/oauth/userCode`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ clientId: c.clientId }),
    });
    if (!res.ok) throw new Error(`iFood userCode falhou (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as any;
    return {
      kind: "user_code",
      userCode: String(json.userCode),
      verificationUrl: String(json.verificationUrlComplete ?? json.verificationUrl),
      expiresInSeconds: num(json.expiresIn) || 600,
      authorizationCodeVerifier: String(json.authorizationCodeVerifier ?? ""),
    };
  },

  async completeAuth({ code, verifier }): Promise<ProviderTokens> {
    const c = creds();
    const res = await fetch(`${BASE}/authentication/v1.0/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "authorization_code",
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        authorizationCode: code ?? "",
        authorizationCodeVerifier: verifier ?? "",
      }),
    });
    if (!res.ok) throw new Error(`iFood token falhou (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as any;
    const tokens: ProviderTokens = {
      accessToken: String(json.accessToken ?? json.access_token),
      refreshToken: json.refreshToken ? String(json.refreshToken) : null,
      expiresAt: new Date(Date.now() + (num(json.expiresIn) || 10800) * 1000).toISOString(),
    };
    // Descobre a loja autorizada.
    const mres = await fetch(`${BASE}/merchant/v1.0/merchants`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (mres.ok) {
      const merchants = (await mres.json()) as any[];
      const first = Array.isArray(merchants) ? merchants[0] : null;
      tokens.merchantId = first?.id ? String(first.id) : null;
      tokens.merchantName = first?.name ? String(first.name) : null;
    }
    return tokens;
  },

  async refreshTokens(refreshToken: string): Promise<ProviderTokens> {
    const c = creds();
    const res = await fetch(`${BASE}/authentication/v1.0/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grantType: "refresh_token",
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`iFood refresh falhou (${res.status})`);
    const json = (await res.json()) as any;
    return {
      accessToken: String(json.accessToken ?? json.access_token),
      refreshToken: json.refreshToken ? String(json.refreshToken) : refreshToken,
      expiresAt: new Date(Date.now() + (num(json.expiresIn) || 10800) * 1000).toISOString(),
    };
  },

  async fetchOrders({ tokens, since, until }): Promise<NormalizedOrder[]> {
    if (!tokens.merchantId) return [];
    const url = new URL(`${BASE}/order/v1.0/orders`);
    url.searchParams.set("merchantId", tokens.merchantId);
    url.searchParams.set("createdAtStart", `${since}T00:00:00.000Z`);
    url.searchParams.set("createdAtEnd", `${until}T23:59:59.000Z`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) throw new Error(`iFood pedidos falhou (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as any;
    const list: any[] = Array.isArray(json) ? json : (json?.orders ?? []);
    return list.map(normalizeIfoodOrder).filter((o) => o.external_order_id);
  },

  async parseWebhook({ body }) {
    const raw = body as any;
    const order = raw?.order ?? raw;
    return {
      merchantId: raw?.merchantId ? String(raw.merchantId) : null,
      orders: order?.id || order?.orderId ? [normalizeIfoodOrder(order)] : [],
    };
  },
};
