/**
 * Camada "Integration Provider" da LUUD.
 *
 * Este arquivo é client-safe: só tipos + catálogo. Nenhuma credencial aqui.
 */

export type ProviderId =
  | "ifood"
  | "99food"
  | "rappi"
  | "consumer"
  | "saipos"
  | "goomer"
  | "cardapioweb"
  | "open_finance";

export type IntegrationStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "expired";

export type DataOrigin = "automatico" | "manual" | "ajuste" | "importado";

export type ProviderCategory = "delivery" | "pdv" | "banco";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  category: ProviderCategory;
  tagline: string;
  /** Já tem conector implementado na LUUD. */
  implemented: boolean;
  /** Precisa de credencial de parceiro/desenvolvedor da plataforma. */
  requiresPartnerCredentials: boolean;
  /** Nome legível do que a plataforma envia. */
  brings: string[];
}

export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    id: "ifood",
    name: "iFood",
    category: "delivery",
    tagline: "Pedidos, taxas, comissões, cupons, cancelamentos e repasses.",
    implemented: true,
    requiresPartnerCredentials: true,
    brings: ["Pedidos", "Produtos vendidos", "Taxas e comissões", "Cupons", "Cancelamentos", "Repasses"],
  },
  {
    id: "99food",
    name: "99Food",
    category: "delivery",
    tagline: "Sincronização de pedidos e taxas da 99Food.",
    implemented: true,
    requiresPartnerCredentials: true,
    brings: ["Pedidos", "Taxas", "Cancelamentos", "Repasses"],
  },
  {
    id: "rappi",
    name: "Rappi",
    category: "delivery",
    tagline: "Em breve — pedidos e taxas da Rappi.",
    implemented: false,
    requiresPartnerCredentials: true,
    brings: ["Pedidos", "Taxas"],
  },
  {
    id: "consumer",
    name: "Consumer",
    category: "pdv",
    tagline: "Em breve — vendas do PDV Consumer.",
    implemented: false,
    requiresPartnerCredentials: true,
    brings: ["Vendas", "Formas de pagamento"],
  },
  {
    id: "saipos",
    name: "Saipos",
    category: "pdv",
    tagline: "Em breve — vendas e pedidos do Saipos.",
    implemented: false,
    requiresPartnerCredentials: true,
    brings: ["Vendas", "Pedidos"],
  },
  {
    id: "goomer",
    name: "Goomer",
    category: "pdv",
    tagline: "Em breve — pedidos do cardápio digital Goomer.",
    implemented: false,
    requiresPartnerCredentials: true,
    brings: ["Pedidos", "Produtos"],
  },
  {
    id: "cardapioweb",
    name: "Cardápio Web",
    category: "pdv",
    tagline: "Em breve — pedidos do Cardápio Web.",
    implemented: false,
    requiresPartnerCredentials: true,
    brings: ["Pedidos"],
  },
  {
    id: "open_finance",
    name: "Bancos / PIX (Open Finance)",
    category: "banco",
    tagline: "Em breve — extrato bancário e PIX via Open Finance.",
    implemented: false,
    requiresPartnerCredentials: true,
    brings: ["Extrato", "PIX recebidos", "Transferências"],
  },
];

export function providerMeta(id: ProviderId): ProviderMeta {
  return PROVIDER_CATALOG.find((p) => p.id === id) ?? PROVIDER_CATALOG[0]!;
}

/** Pedido normalizado no padrão interno da LUUD. */
export interface NormalizedOrder {
  external_order_id: string;
  order_number?: string | null;
  ordered_at: string;
  customer_name?: string | null;
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  gross_amount: number;
  commission: number;
  delivery_fee: number;
  marketing_fee: number;
  other_fees: number;
  coupons: number;
  cancellation_amount: number;
  is_cancelled: boolean;
  payout_amount: number;
  net_amount: number;
  payment_method?: string | null;
  raw_payload: unknown;
}

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  merchantId?: string | null;
  merchantName?: string | null;
  scopes?: string[];
}

/** Início de autorização oficial (nunca usuário/senha do restaurante). */
export type AuthStart =
  | { kind: "redirect"; url: string }
  | { kind: "user_code"; userCode: string; verificationUrl: string; expiresInSeconds: number; authorizationCodeVerifier: string }
  | { kind: "unavailable"; reason: string };

/**
 * Toda integração implementa esta interface. Novas plataformas entram
 * registrando um provider no registry, sem mexer no resto do sistema.
 */
export interface IntegrationProvider {
  id: ProviderId;
  /** Retorna false quando as credenciais de parceiro ainda não foram configuradas. */
  isConfigured(): boolean;
  startAuth(): Promise<AuthStart>;
  completeAuth(input: { code?: string; verifier?: string }): Promise<ProviderTokens>;
  refreshTokens(refreshToken: string): Promise<ProviderTokens>;
  fetchOrders(input: {
    tokens: ProviderTokens;
    since: string;
    until: string;
  }): Promise<NormalizedOrder[]>;
  parseWebhook(input: { body: unknown; headers: Headers }): Promise<{
    merchantId: string | null;
    orders: NormalizedOrder[];
  }>;
}
