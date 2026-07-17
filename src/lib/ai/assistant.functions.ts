import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export type AssistantMode =
  | "chat"
  | "diagnostico"
  | "recomendacoes"
  | "precificacao"
  | "prolabore"
  | "previsao_metas"
  | "insights";

interface AskInput {
  messages: AssistantMessage[];
  mode: AssistantMode;
}

const MODE_INSTRUCTIONS: Record<AssistantMode, string> = {
  chat:
    "Responda à pergunta do usuário como consultor financeiro. Use os dados do snapshot. Seja direto, use bullets curtos, indique números e cite o impacto financeiro.",
  diagnostico:
    "Gere o diagnóstico diário. Compare o dia mais recente com a média dos 7 dias anteriores. Aponte quedas/altas de vendas, lucro, CMV, ticket médio, canal com mais vendas, gastos que subiram. Formato: lista de 5–8 bullets curtos, com números e %.",
  recomendacoes:
    "Liste 5–8 recomendações práticas e acionáveis com base nos dados. Para cada uma: (1) o que fazer, (2) por quê (baseado no dado), (3) impacto estimado em R$ ou % ao mês.",
  precificacao:
    "Analise a precificação. Para cada categoria/produto identificado, sugira: preço recomendado, margem esperada, lucro esperado, impacto das taxas de plataforma, impacto do CMV, e comparação com o preço médio praticado. Justifique cada sugestão. Se não houver histórico de preço, faça recomendações gerais sobre a política de precificação.",
  prolabore:
    "Calcule quanto o dono pode retirar de pró-labore neste mês sem comprometer a saúde financeira. Considere: lucro do mês corrente, ritmo de despesas fixas, capital de giro necessário (mínimo 20% do faturamento mensal) e reserva mínima. Ao final, responda em uma linha destacada: 'Você pode retirar até R$ X neste mês.' Se não recomendar retirada, explique o motivo em 2–3 bullets.",
  previsao_metas:
    "Com base no ritmo atual das vendas e na meta ativa, calcule: probabilidade de atingir a meta, quanto falta, quanto precisa vender por dia até o fim do período, previsão de faturamento e de lucro no fim do período. Se não houver meta ativa, sugira uma meta realista baseada no histórico.",
  insights:
    "Gere de 6 a 10 insights personalizados e específicos sobre o comportamento financeiro do restaurante. Padrões por dia da semana, sazonalidade, mudanças de fornecedores, evolução de ticket médio, produtos/canais mais lucrativos, tendências de custos. Cada insight em uma linha, com número e contexto.",
};

const BASE_SYSTEM = `Você é uma IA consultora financeira especializada em restaurantes, delivery e food service. Seu papel NÃO é apenas mostrar números, é responder às perguntas mais importantes do empresário:
1. O que aconteceu?
2. Por que aconteceu?
3. Qual o impacto financeiro (em R$ ou %)?
4. O que devo fazer agora?
5. Quanto posso ganhar ou economizar se seguir essa recomendação?

Regras:
- Sempre em português do Brasil.
- Sempre cite números concretos do snapshot (R$, %, quantidades).
- Se um dado faltar, diga explicitamente "sem dados suficientes para X" — nunca invente.
- Formato: markdown simples (bullets com "-", negrito com **). Sem tabelas grandes.
- Respostas curtas e diretas: máximo 12 bullets ou 250 palavras, salvo pedido explícito do usuário.
- Não repita o snapshot bruto. Sintetize.
`;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

async function buildSnapshot(supabase: any, restaurantId: string): Promise<string> {
  const since90 = isoDaysAgo(90);
  const since30 = isoDaysAgo(30);
  const since7 = isoDaysAgo(7);

  const [salesRes, movementsRes, wastagesRes, suppliersRes, categoriesRes, goalsRes, cmvRes, priceHistoryRes] =
    await Promise.all([
      supabase.from("sales").select("*").eq("restaurant_id", restaurantId).gte("sale_date", since90).order("sale_date", { ascending: false }),
      supabase.from("movements").select("*").eq("restaurant_id", restaurantId).gte("movement_date", since90).order("movement_date", { ascending: false }),
      supabase.from("wastages").select("*").eq("restaurant_id", restaurantId).gte("wastage_date", since90),
      supabase.from("suppliers").select("id, name, products").eq("restaurant_id", restaurantId),
      supabase.from("categories").select("id, name").eq("restaurant_id", restaurantId),
      supabase.from("goals").select("*").eq("restaurant_id", restaurantId).eq("active", true),
      supabase.from("cmv_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
      supabase.from("price_history").select("*").eq("restaurant_id", restaurantId).order("changed_at", { ascending: false }).limit(50),
    ]);

  const sales = salesRes.data ?? [];
  const movements = movementsRes.data ?? [];
  const wastages = wastagesRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const cmv = cmvRes.data ?? null;
  const priceHistory = priceHistoryRes.data ?? [];

  const catMap = new Map<string, string>(categories.map((c: any) => [c.id, c.name]));
  const supMap = new Map<string, string>(suppliers.map((s: any) => [s.id, s.name]));

  function periodStats(sinceISO: string) {
    const s = sales.filter((x: any) => x.sale_date >= sinceISO);
    const m = movements.filter((x: any) => x.movement_date >= sinceISO);
    const gross = sum(s, (x: any) => x.gross_amount);
    const net = sum(s, (x: any) => x.net_amount);
    const orders = sum(s, (x: any) => x.orders_count);
    const fees = sum(s, (x: any) => x.fees + x.commission + x.marketing_fee);
    const expenses = sum(m, (x: any) => x.amount);
    const profit = net - expenses;
    return {
      faturamento_bruto: gross,
      faturamento_liquido: net,
      pedidos: orders,
      ticket_medio: orders > 0 ? net / orders : 0,
      taxas_plataformas: fees,
      despesas: expenses,
      lucro_estimado: profit,
      margem_pct: net > 0 ? (profit / net) * 100 : 0,
    };
  }

  const p7 = periodStats(since7);
  const p30 = periodStats(since30);
  const p90 = periodStats(since90);

  // Sales by source (30d)
  const bySource: Record<string, { faturamento: number; pedidos: number }> = {};
  for (const s of sales.filter((x: any) => x.sale_date >= since30)) {
    const k = s.source ?? "outro";
    bySource[k] = bySource[k] ?? { faturamento: 0, pedidos: 0 };
    bySource[k].faturamento += Number(s.net_amount) || 0;
    bySource[k].pedidos += Number(s.orders_count) || 0;
  }

  // Movements by category (30d)
  const byCategory: Record<string, number> = {};
  for (const m of movements.filter((x: any) => x.movement_date >= since30)) {
    const k = m.category_id ? catMap.get(m.category_id) ?? "Sem categoria" : "Sem categoria";
    byCategory[k] = (byCategory[k] ?? 0) + (Number(m.amount) || 0);
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Top suppliers (30d)
  const bySupplier: Record<string, number> = {};
  for (const m of movements.filter((x: any) => x.movement_date >= since30 && x.supplier_id)) {
    const k = supMap.get(m.supplier_id) ?? "Fornecedor";
    bySupplier[k] = (bySupplier[k] ?? 0) + (Number(m.amount) || 0);
  }
  const topSuppliers = Object.entries(bySupplier).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Wastages (30d)
  const wastages30 = wastages.filter((x: any) => x.wastage_date >= since30);
  const totalWastage30 = sum(wastages30, (x: any) => x.lost_amount);

  // Yesterday vs prev-7-avg
  const days = Array.from(new Set(sales.map((s: any) => s.sale_date))).sort().reverse();
  const lastDay = days[0] ?? null;
  let lastDayNet = 0, prev7AvgNet = 0;
  if (lastDay) {
    lastDayNet = sum(sales.filter((s: any) => s.sale_date === lastDay), (s: any) => s.net_amount);
    const prev7Days = days.slice(1, 8);
    prev7AvgNet = prev7Days.length ? sum(sales.filter((s: any) => prev7Days.includes(s.sale_date)), (s: any) => s.net_amount) / prev7Days.length : 0;
  }

  // Estimated CMV (30d): sum of movements where category name includes "insumo"
  const insumos30 = sum(
    movements.filter((m: any) => {
      const cn = m.category_id ? catMap.get(m.category_id) : "";
      return (cn ?? "").toLowerCase().includes("insumo");
    }).filter((m: any) => m.movement_date >= since30),
    (m: any) => m.amount,
  );
  const cmvPctReal30 = p30.faturamento_liquido > 0 ? (insumos30 / p30.faturamento_liquido) * 100 : 0;

  const snapshot = {
    hoje: new Date().toISOString().slice(0, 10),
    ultimo_dia_com_venda: lastDay,
    variacao_ultimo_dia_vs_media_7d_pct:
      prev7AvgNet > 0 ? ((lastDayNet - prev7AvgNet) / prev7AvgNet) * 100 : null,
    periodos: {
      "7d": p7,
      "30d": p30,
      "90d": p90,
    },
    vendas_por_canal_30d: bySource,
    top_categorias_despesa_30d: topCategories.map(([nome, valor]) => ({ nome, valor })),
    top_fornecedores_30d: topSuppliers.map(([nome, valor]) => ({ nome, valor })),
    desperdicios_30d: { total: totalWastage30, ocorrencias: wastages30.length },
    cmv: {
      meta_pct: cmv?.target_percent ?? null,
      cmv_estimado_30d_pct: Number(cmvPctReal30.toFixed(2)),
      gasto_insumos_30d: insumos30,
    },
    metas_ativas: goals.map((g: any) => ({
      periodo: g.period,
      valor_meta: Number(g.target_amount),
      data_referencia: g.reference_date,
    })),
    ultimas_mudancas_de_preco: priceHistory.slice(0, 10).map((p: any) => ({
      produto: p.product_name,
      preco_antigo: Number(p.old_price ?? 0),
      preco_novo: Number(p.new_price ?? 0),
      data: p.changed_at,
    })),
    contagens: {
      fornecedores_cadastrados: suppliers.length,
      categorias_cadastradas: categories.length,
      dias_com_venda_90d: days.length,
    },
  };

  // Compact formatter
  const lines: string[] = [];
  lines.push(`SNAPSHOT FINANCEIRO (${snapshot.hoje})`);
  lines.push(`Último dia com venda: ${snapshot.ultimo_dia_com_venda ?? "n/d"}`);
  if (snapshot.variacao_ultimo_dia_vs_media_7d_pct != null)
    lines.push(`Variação do último dia vs média 7d anteriores: ${snapshot.variacao_ultimo_dia_vs_media_7d_pct.toFixed(1)}%`);
  for (const [k, p] of Object.entries(snapshot.periodos)) {
    lines.push(
      `[${k}] Faturamento líquido: ${fmtBRL(p.faturamento_liquido)} | Pedidos: ${p.pedidos} | Ticket: ${fmtBRL(p.ticket_medio)} | Despesas: ${fmtBRL(p.despesas)} | Lucro: ${fmtBRL(p.lucro_estimado)} (margem ${p.margem_pct.toFixed(1)}%) | Taxas plataformas: ${fmtBRL(p.taxas_plataformas)}`,
    );
  }
  lines.push(`Canais (30d): ${Object.entries(snapshot.vendas_por_canal_30d).map(([k, v]) => `${k}=${fmtBRL(v.faturamento)} (${v.pedidos} pedidos)`).join(", ") || "sem dados"}`);
  lines.push(`Top categorias de despesa (30d): ${snapshot.top_categorias_despesa_30d.map((c) => `${c.nome}=${fmtBRL(c.valor)}`).join(", ") || "sem dados"}`);
  lines.push(`Top fornecedores (30d): ${snapshot.top_fornecedores_30d.map((c) => `${c.nome}=${fmtBRL(c.valor)}`).join(", ") || "sem dados"}`);
  lines.push(`Desperdícios (30d): ${fmtBRL(snapshot.desperdicios_30d.total)} em ${snapshot.desperdicios_30d.ocorrencias} ocorrências`);
  lines.push(`CMV: meta ${snapshot.cmv.meta_pct ?? "n/d"}% | estimado 30d ${snapshot.cmv.cmv_estimado_30d_pct}% | gasto insumos 30d ${fmtBRL(snapshot.cmv.gasto_insumos_30d)}`);
  if (snapshot.metas_ativas.length)
    lines.push(`Metas ativas: ${snapshot.metas_ativas.map((g: any) => `${g.periodo}=${fmtBRL(g.valor_meta)} (ref ${g.data_referencia})`).join(", ")}`);
  else lines.push(`Metas ativas: nenhuma`);
  if (snapshot.ultimas_mudancas_de_preco.length)
    lines.push(`Mudanças recentes de preço: ${snapshot.ultimas_mudancas_de_preco.map((p: any) => `${p.produto} ${fmtBRL(p.preco_antigo)}→${fmtBRL(p.preco_novo)}`).join("; ")}`);
  lines.push(
    `Contagens: ${snapshot.contagens.fornecedores_cadastrados} fornecedores, ${snapshot.contagens.categorias_cadastradas} categorias, ${snapshot.contagens.dias_com_venda_90d} dias com venda em 90d`,
  );

  return lines.join("\n");
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as AskInput;
    if (!d || !Array.isArray(d.messages)) throw new Error("messages inválido");
    if (!d.mode) throw new Error("mode obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { supabase, userId } = context as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.restaurant_id) {
      return {
        content:
          "Você ainda não tem um restaurante cadastrado. Complete o onboarding para começar a receber análises da IA.",
      };
    }

    const snapshot = await buildSnapshot(supabase, profile.restaurant_id);

    const systemPrompt =
      BASE_SYSTEM +
      "\n\n===== DADOS DO RESTAURANTE =====\n" +
      snapshot +
      "\n===== FIM DOS DADOS =====\n\n" +
      "Instrução para esta resposta: " +
      MODE_INSTRUCTIONS[data.mode];

    const payload = {
      model: "openai/gpt-5.5",
      messages: [
        { role: "system", content: systemPrompt },
        ...data.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      return { content: "Muitas requisições em um curto período. Aguarde alguns segundos e tente novamente." };
    }
    if (res.status === 402) {
      return {
        content:
          "Créditos de IA esgotados. Peça ao administrador da conta Lovable para adicionar créditos no workspace.",
      };
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("[assistant] gateway error", res.status, t);
      throw new Error(`Erro na IA (${res.status})`);
    }

    const json = (await res.json()) as any;
    const content: string = json.choices?.[0]?.message?.content ?? "Sem resposta.";
    return { content };
  });
