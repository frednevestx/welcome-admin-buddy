/**
 * PROATIVIDADE E DESCOBERTA.
 *
 * Depois da resposta principal, no máximo UMA sugestão curta, contextual, que
 * ensina o usuário a fazer perguntas melhores. Nunca substitui a resposta,
 * nunca exige confirmação, nunca muda o assunto.
 */

export interface HintContext {
  /** intent resolvida pelo orquestrador */
  intent: string;
  /** sugestões já mostradas recentemente (chaves) */
  recent: string[];
  /** dados úteis para personalizar */
  supplierName?: string | null;
  categoryName?: string | null;
  /** houve erro/pendência/confirmação em aberto? */
  suppressed?: boolean;
}

interface Hint {
  key: string;
  text: string;
}

const GENERIC: Hint[] = [
  { key: "natural", text: "💡 Pode falar comigo do jeito que você falaria com uma pessoa — não precisa decorar comandos." },
  { key: "overview", text: "💡 Quando quiser um retrato do momento, pergunte: \"Como está minha empresa?\"" },
  { key: "where_spending", text: "💡 Tente me perguntar: \"Onde estou gastando demais?\"" },
  { key: "compare", text: "💡 Também posso comparar este mês com o anterior — só pedir." },
  { key: "top_supplier", text: "💡 Se quiser, eu mostro qual fornecedor está te custando mais." },
  { key: "reminder", text: "💡 Posso criar lembretes para compromissos futuros, tipo \"tenho que pagar o João sexta\"." },
];

/**
 * Sugestões por assunto, em ordem de prioridade:
 * relacionada à mensagem atual -> aprofundamento -> descoberta.
 */
const BY_INTENT: Record<string, Hint[]> = {
  register_movement: [
    { key: "supplier_month", text: "💡 Você também pode me perguntar: \"Quanto já gastei com esse fornecedor este mês?\"" },
    { key: "category_month", text: "💡 Se quiser conferir, pergunte: \"Quanto gastei com essa categoria este mês?\"" },
    { key: "fix", text: "💡 Se algum valor sair errado, é só dizer: \"na verdade foi R$ 380\"." },
  ],
  query_supplier: [
    { key: "top_supplier", text: "💡 Para entender melhor esse gasto, pergunte: \"Qual fornecedor está me custando mais?\"" },
    { key: "compare", text: "💡 Posso comparar esse gasto com o mês anterior, se quiser." },
  ],
  query_category: [
    { key: "where_spending", text: "💡 Para aprofundar, tente: \"Onde estou gastando demais?\"" },
    { key: "compare", text: "💡 Também consigo comparar essa categoria com o mês passado." },
  ],
  query_summary: [
    { key: "overview", text: "💡 Para uma leitura mais completa, pergunte: \"Como está minha empresa?\"" },
    { key: "top_expenses", text: "💡 Posso te mostrar qual foi seu maior gasto do período." },
  ],
  business_overview: [
    { key: "where_spending", text: "💡 Para aprofundar, tente perguntar: \"Onde estou gastando demais?\"" },
    { key: "improve", text: "💡 Também posso responder: \"O que posso melhorar?\"" },
  ],
  compare_periods: [
    { key: "where_spending", text: "💡 Se quiser saber a causa, pergunte: \"Onde estou gastando demais?\"" },
  ],
  top_expenses: [
    { key: "top_supplier", text: "💡 Posso também apontar qual fornecedor pesa mais na sua saída." },
  ],
  supplier_analysis: [
    { key: "supplier_month", text: "💡 Pergunte por um nome específico, tipo: \"quanto gastei com o João?\"" },
  ],
  decision: [
    { key: "weight", text: "💡 Também posso comparar esse investimento com seu resultado recente e mostrar o peso dele no caixa." },
  ],
  future_commitment: [
    { key: "reminder", text: "💡 Se quiser, eu passo a te lembrar desses compromissos automaticamente." },
  ],
  greeting: [
    { key: "natural", text: "💡 Pode me contar as movimentações do jeito que preferir — eu organizo o resto." },
  ],
  smalltalk: [{ key: "natural", text: "💡 Pode falar comigo naturalmente, do jeito que falaria com uma pessoa." }],
};

/** Intents em que a resposta precisa ser objetiva: nunca sugerir nada. */
const NEVER = new Set([
  "confirm",
  "deny",
  "missing_data",
  "pending_operation",
  "reset_data",
  "update_movement",
  "delete_movement",
  "farewell",
  "error",
]);

const CLOSING = /\b(obrigad|valeu|tchau|até (mais|logo)|boa noite|falou|é isso|s[óo] isso)\b/i;

/** Escolhe no máximo uma sugestão. Devolve null quando não deve sugerir. */
export function pickHint(input: HintContext & { message?: string }): Hint | null {
  if (input.suppressed) return null;
  if (NEVER.has(input.intent)) return null;
  if (input.message && CLOSING.test(input.message)) return null;

  const recent = new Set(input.recent ?? []);
  const pool = [...(BY_INTENT[input.intent] ?? []), ...GENERIC];

  for (const hint of pool) {
    if (recent.has(hint.key)) continue;
    let text = hint.text;
    if (hint.key === "supplier_month" && input.supplierName) {
      text = `💡 Você também pode me perguntar: "Quanto já gastei com ${input.supplierName} este mês?"`;
    }
    if (hint.key === "category_month" && input.categoryName) {
      text = `💡 Você também pode me perguntar: "Quanto gastei com ${input.categoryName} este mês?"`;
    }
    return { key: hint.key, text };
  }
  return null;
}

/** Anexa a sugestão ao final da resposta principal. */
export function appendHint(reply: string, hint: Hint | null): string {
  if (!hint) return reply;
  return `${reply.trimEnd()}\n\n${hint.text}`;
}

/** Mantém a rotação: guarda no máximo as 5 últimas chaves usadas. */
export function rotateHints(recent: string[] | null | undefined, key: string): string[] {
  const list = [key, ...(recent ?? []).filter((k) => k !== key)];
  return list.slice(0, 5);
}
