import type { PlanTier } from "@/hooks/use-plan";

/** Mapa de rota → plano mínimo necessário. */
export const ROUTE_MIN_PLAN: Record<string, PlanTier> = {
  "/dashboard": "basico",
  "/metas": "basico",
  "/movimentacoes": "basico",
  "/categorias": "basico",
  "/comparativos": "basico",
  "/evolucao": "basico",
  "/alertas": "basico",
  "/importacoes": "basico",
  "/configuracoes": "basico",
  // Pro
  "/cmv": "pro",
  "/calculadora-preco": "pro",
  "/lucro-plataforma": "pro",
  "/fornecedores": "pro",
  "/historico-precos": "pro",
  "/simulador": "pro",
  "/relatorios": "pro",
  // Premium
  "/assistente-ia": "premium",
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  basico: "Básico",
  pro: "Pro",
  premium: "Premium IA",
};

export const PLAN_PROMISE: Record<PlanTier, string> = {
  basico: "Organize seu financeiro e descubra seu lucro real.",
  pro: "Descubra exatamente onde aumentar sua margem.",
  premium: "Tenha um consultor de IA analisando seu negócio 24 horas por dia.",
};

export const PLAN_TAGLINE: Record<PlanTier, string> = {
  basico: "Pare de apagar incêndios",
  pro: "Descubra onde ganhar mais dinheiro",
  premium: "Seu consultor financeiro 24 horas",
};

export const PLAN_PRICES: Record<PlanTier, { mensal: number; semestral: number; anual: number }> = {
  basico: { mensal: 49.9, semestral: 269.9, anual: 499.9 },
  pro: { mensal: 79.9, semestral: 429.9, anual: 799.9 },
  premium: { mensal: 109.9, semestral: 589.9, anual: 1099.9 },
};

const BASICO_FEATURES = [
  "Dashboard Financeiro",
  "Controle de Receitas",
  "Controle de Despesas",
  "Movimentações",
  "Categorias",
  "Fluxo de Caixa",
  "Comparativos",
  "Evolução Financeira",
  "Alertas",
  "Metas",
  "Acesso Mobile",
  "Importação de vendas",
  "Painel de indicadores",
];

const PRO_EXTRA = [
  "Controle de CMV",
  "Calculadora de Preço",
  "Lucro por Plataforma",
  "Histórico de Custos",
  "Controle de Fornecedores",
  "Simulador de Lucro",
  "Relatórios Avançados",
  "Exportação de Dados",
  "Indicadores Avançados",
  "Filtros Inteligentes",
];

const PREMIUM_EXTRA = [
  "IA Financeira",
  "Diagnósticos Automáticos",
  "Recomendações Inteligentes",
  "Precificação Inteligente",
  "Análise de Produtos",
  "Análise de Rentabilidade",
  "Previsão Financeira",
  "Sugestão de Pró-labore",
  "Planejamento de Metas",
  "Insights Automáticos",
  "Alertas Inteligentes",
  "Assistente Financeiro IA",
];

export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  basico: BASICO_FEATURES,
  pro: [...BASICO_FEATURES, ...PRO_EXTRA],
  premium: [...BASICO_FEATURES, ...PRO_EXTRA, ...PREMIUM_EXTRA],
};
