import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fonte única de verdade financeira da LUUD.
 *
 * Regra usada em TODAS as telas (Dashboard, Lucro por Plataforma,
 * Consolidado do Período, Movimentações e Simulador):
 *
 *   Faturamento Total = soma do valor bruto de todas as vendas
 *   Taxas das plataformas = bruto − repasse líquido das vendas importadas
 *   Despesas manuais = saídas lançadas em Movimentações
 *   Total Gasto = taxas das plataformas + despesas manuais
 *   Lucro Estimado = Faturamento Total − Total Gasto
 *
 * As movimentações criadas automaticamente para as taxas (source_ref "taxa:*")
 * são ignoradas no cálculo de despesas manuais para nunca contar duas vezes.
 */

export const PLATFORM_FEE_REF_PREFIX = "taxa:";
export const PLATFORM_FEE_CATEGORY = "Taxa da Plataforma";

export type ChannelKey = "ifood" | "99food" | "loja" | "whatsapp";

export const CHANNELS: { key: ChannelKey; label: string; color: string }[] = [
  { key: "ifood", label: "iFood", color: "oklch(0.72 0.18 25)" },
  { key: "99food", label: "99Food", color: "oklch(0.78 0.16 75)" },
  { key: "loja", label: "Loja própria", color: "var(--primary)" },
  { key: "whatsapp", label: "WhatsApp", color: "oklch(0.72 0.18 148)" },
];

export interface ChannelStats {
  key: ChannelKey;
  label: string;
  color: string;
  faturamento: number;
  pedidos: number;
  ticket: number;
  taxas: number;
  lucro: number;
  margem: number;
  taxaPct: number;
}

export interface FinanceSummary {
  faturamento: number;
  pedidos: number;
  ticketMedio: number;
  taxasPlataforma: number;
  despesasManuais: number;
  totalGasto: number;
  lucro: number;
  margem: number;
  lucroPorPedido: number;
  channels: ChannelStats[];
  despesasPorCategoria: { name: string; value: number }[];
}

export function emptySummary(): FinanceSummary {
  return {
    faturamento: 0,
    pedidos: 0,
    ticketMedio: 0,
    taxasPlataforma: 0,
    despesasManuais: 0,
    totalGasto: 0,
    lucro: 0,
    margem: 0,
    lucroPorPedido: 0,
    channels: CHANNELS.map((c) => ({
      ...c,
      faturamento: 0,
      pedidos: 0,
      ticket: 0,
      taxas: 0,
      lucro: 0,
      margem: 0,
      taxaPct: 0,
    })),
    despesasPorCategoria: [],
  };
}

/** É uma movimentação criada automaticamente a partir das taxas importadas? */
export function isPlatformFeeMovement(m: { source_ref?: string | null }): boolean {
  return !!m.source_ref?.startsWith(PLATFORM_FEE_REF_PREFIX);
}

export async function fetchFinanceSummary(
  restaurantId: string,
  from: string,
  to: string,
): Promise<FinanceSummary> {
  const [salesRes, movRes] = await Promise.all([
    supabase
      .from("sales")
      .select("source, sale_date, orders_count, gross_amount, net_amount")
      .eq("restaurant_id", restaurantId)
      .gte("sale_date", from)
      .lte("sale_date", to),
    supabase
      .from("movements")
      .select("amount, type, source_ref, categories(name)")
      .eq("restaurant_id", restaurantId)
      .gte("movement_date", from)
      .lte("movement_date", to),
  ]);

  const sales = salesRes.data ?? [];
  const movs = (movRes.data ?? []) as unknown as {
    amount: number;
    type: string;
    source_ref: string | null;
    categories?: { name: string } | null;
  }[];

  const byChannel = new Map<ChannelKey, { faturamento: number; pedidos: number; taxas: number }>();
  for (const c of CHANNELS) byChannel.set(c.key, { faturamento: 0, pedidos: 0, taxas: 0 });

  let faturamento = 0;
  let pedidos = 0;
  let taxasPlataforma = 0;

  for (const s of sales) {
    const gross = Number(s.gross_amount || 0);
    const net = Number(s.net_amount || 0);
    const orders = Number(s.orders_count || 0);
    const taxas = Math.max(0, gross - net);
    faturamento += gross;
    pedidos += orders;
    taxasPlataforma += taxas;
    const key = (byChannel.has(s.source as ChannelKey) ? s.source : "loja") as ChannelKey;
    const acc = byChannel.get(key)!;
    acc.faturamento += gross;
    acc.pedidos += orders;
    acc.taxas += taxas;
  }

  // despesas manuais (saídas), ignorando as taxas lançadas automaticamente
  let despesasManuais = 0;
  const byCat = new Map<string, number>();
  for (const m of movs) {
    if (m.type !== "saida") continue;
    const value = Number(m.amount || 0);
    const name = m.categories?.name ?? "Sem categoria";
    byCat.set(name, (byCat.get(name) ?? 0) + value);
    if (isPlatformFeeMovement(m)) continue;
    despesasManuais += value;
  }
  // as taxas entram no ranking pelo valor real das vendas
  if (taxasPlataforma > 0) byCat.set(PLATFORM_FEE_CATEGORY, taxasPlataforma);

  const totalGasto = taxasPlataforma + despesasManuais;
  const lucro = faturamento - totalGasto;

  const channels: ChannelStats[] = CHANNELS.map((c) => {
    const a = byChannel.get(c.key)!;
    const lucroCanal = a.faturamento - a.taxas;
    return {
      ...c,
      faturamento: a.faturamento,
      pedidos: a.pedidos,
      ticket: a.pedidos > 0 ? a.faturamento / a.pedidos : 0,
      taxas: a.taxas,
      lucro: lucroCanal,
      margem: a.faturamento > 0 ? (lucroCanal / a.faturamento) * 100 : 0,
      taxaPct: a.faturamento > 0 ? (a.taxas / a.faturamento) * 100 : 0,
    };
  });

  return {
    faturamento,
    pedidos,
    ticketMedio: pedidos > 0 ? faturamento / pedidos : 0,
    taxasPlataforma,
    despesasManuais,
    totalGasto,
    lucro,
    margem: faturamento > 0 ? (lucro / faturamento) * 100 : 0,
    lucroPorPedido: pedidos > 0 ? lucro / pedidos : 0,
    channels,
    despesasPorCategoria: Array.from(byCat.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Hook compartilhado: sempre os mesmos números em qualquer tela. */
export function useFinanceSummary(restaurantId: string | undefined, from: string, to: string) {
  return useQuery({
    enabled: !!restaurantId,
    queryKey: ["finance", restaurantId, from, to],
    queryFn: () => fetchFinanceSummary(restaurantId!, from, to),
  });
}
