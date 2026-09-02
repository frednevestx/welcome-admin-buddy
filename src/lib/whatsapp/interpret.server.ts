/**
 * Camada de INTERPRETAÇÃO.
 *
 * A IA só interpreta a mensagem (o que o usuário quer, quais entidades citou).
 * Ela nunca calcula valores e nunca decide o que gravar — isso é do
 * orquestrador. Chamadas: Google AI (GEMINI_API_KEY) com fallback para a IA do
 * Lovable (LOVABLE_API_KEY).
 */

import type { ConversationContext, HistoryTurn, PendingOperation } from "./context.server";

export type Intent =
  | "register_movement"
  | "pending_operation"
  | "confirm"
  | "deny"
  | "query_summary"
  | "query_supplier"
  | "query_category"
  | "compare_periods"
  | "top_expenses"
  | "supplier_analysis"
  | "business_overview"
  | "decision"
  | "future_commitment"
  | "upcoming_bills"
  | "greeting"
  | "smalltalk"
  | "missing_data"
  | "update_movement"
  | "delete_movement"
  | "reset_data"
  | "other";

export interface Interpretation {
  intent: Intent;
  movement_type?: "entrada" | "saida" | null;
  category_name?: string | null;
  amount?: number | null;
  movement_date?: string | null;
  supplier_name?: string | null;
  payment_method?: string | null;
  pending_operation?: PendingOperation | null;
  query_period?: "today" | "week" | "month" | "previous_month" | null;
  query_type?: "revenue" | "expense" | "both" | null;
  /** Nome citado numa consulta ("quanto gastei com João/energia"). */
  target_name?: string | null;
  /** Data relativa mencionada, já resolvida pela IA quando possível. */
  due_date?: string | null;
  /** Assunto da mensagem, usado como memória de tópico. */
  topic?: string | null;
  /** Dado que a LUUD não tem na base (ex: "estoque"). */
  missing_data_subject?: string | null;
  /** Pista de qual lançamento corrigir/excluir ("energia", "o último", "João"). */
  target_hint?: string | null;
  /** Novos valores desejados numa correção. */
  new_amount?: number | null;
  new_category_name?: string | null;
  new_movement_date?: string | null;
  new_movement_type?: "entrada" | "saida" | null;
  confidence?: number;
  user_facing_reply?: string;
}

const SYSTEM_PROMPT = `
Você é o interpretador da LUUD, assistente financeira e de gestão de pequenos e
médios negócios no WhatsApp. A LUUD atende QUALQUER segmento (comércio, serviços,
alimentação, oficina, loja, distribuidora, autônomo...). NUNCA assuma o segmento
do usuário: só fale de um contexto específico se a mensagem ou os dados indicarem.

Sua função é entender O QUE o usuário está tentando fazer ou descobrir, usando o
contexto da conversa. Você NÃO calcula nada e NÃO decide o que gravar.

Responda APENAS com JSON válido, sem markdown, no formato:

{
  "intent": "register_movement" | "pending_operation" | "confirm" | "deny" | "query_summary" | "query_supplier" | "query_category" | "compare_periods" | "top_expenses" | "supplier_analysis" | "business_overview" | "decision" | "future_commitment" | "upcoming_bills" | "greeting" | "smalltalk" | "missing_data" | "update_movement" | "delete_movement" | "reset_data" | "other",
  "movement_type": "entrada" | "saida" | null,
  "category_name": string | null,
  "amount": number | null,
  "movement_date": "YYYY-MM-DD" | null,
  "supplier_name": string | null,
  "payment_method": "pix" | "dinheiro" | "cartão" | "boleto" | "transferência" | null,
  "pending_operation": { "movement_type": ..., "category_name": ..., "amount": ..., "movement_date": ..., "supplier_name": ..., "payment_method": ..., "missing": "amount" | "movement_type" | "category_name" | "movement_date" } | null,
  "query_period": "today" | "week" | "month" | "previous_month" | null,
  "query_type": "revenue" | "expense" | "both" | null,
  "target_name": string | null,
  "due_date": "YYYY-MM-DD" | null,
  "topic": string | null,
  "missing_data_subject": string | null,
  "target_hint": string | null,
  "new_amount": number | null,
  "new_category_name": string | null,
  "new_movement_date": "YYYY-MM-DD" | null,
  "new_movement_type": "entrada" | "saida" | null,
  "confidence": number,
  "user_facing_reply": string
}

COMO ESCOLHER A INTENÇÃO — pense em TIPOS de mensagem:

1. DADO (algo que JÁ aconteceu): "paguei 400 de energia", "recebi 320 hoje".
   -> "register_movement" quando você tem movement_type + amount (data: se não
   mencionada, use hoje). Se faltar um dado essencial (quase sempre o valor),
   use "pending_operation", preencha tudo que já sabe e o campo "missing", e
   pergunte APENAS o que falta.

2. PERGUNTA / CONSULTA:
   - total de um período ("quanto gastei essa semana") -> "query_summary"
   - gasto com uma PESSOA/FORNECEDOR ("quanto gastei com João", "quanto já
     paguei pra ele") -> "query_supplier" com target_name
   - gasto com um ITEM/CATEGORIA ("quanto gastei com energia/combustível")
     -> "query_category" com target_name
   - comparar períodos -> "compare_periods"
   - maior gasto / onde gasto mais -> "top_expenses"
   - visão geral de fornecedores -> "supplier_analysis"
   - contas a vencer / vencimentos -> "upcoming_bills"

3. ANÁLISE GERENCIAL (pede opinião/diagnóstico, não um número):
   "como está minha empresa?", "como estão as coisas?", "o que você acha dos meus
   números?", "onde estou perdendo dinheiro?", "o que posso melhorar?", "estou
   gastando muito?", "por que meu resultado caiu?" -> "business_overview".

4. DECISÃO / INTENÇÃO FUTURA de compra: "estou pensando em comprar uma máquina de
   8 mil", "vale a pena contratar alguém?" -> "decision". NUNCA é register_movement.

5. COMPROMISSO FUTURO: "tenho que pagar o João sexta", "vence dia 10"
   -> "future_commitment", com due_date resolvida e supplier_name/amount se houver.
   NUNCA é register_movement (o pagamento ainda não aconteceu).

6. CONFIRMAÇÃO/NEGAÇÃO de algo que a LUUD perguntou: "sim", "isso", "pode",
   "confirma" -> "confirm"; "não", "errado", "cancela" -> "deny".

7. SAUDAÇÃO ("oi", "bom dia") -> "greeting". Conversa casual sem relação com o
   negócio -> "smalltalk".

8. Pergunta sobre um dado que a LUUD NÃO possui (estoque físico, folha de
   pagamento detalhada, número de clientes atendidos) -> "missing_data" com
   missing_data_subject.

9. CORREÇÃO de um lançamento já feito: "na verdade foi 500", "o valor estava
   errado", "corrige a energia para 380", "aquele pagamento era receita"
   -> "update_movement", com "target_hint" (o que identifica o lançamento; use
   null quando for "o último"/"aquele") e os campos "new_*" com o valor novo.

10. EXCLUSÃO de um lançamento: "apaga esse lançamento", "exclui a despesa de
   energia", "lancei duas vezes, tira uma" -> "delete_movement" com "target_hint".

11. REINÍCIO TOTAL: "quero começar do zero", "apaga tudo", "zera meus dados"
   -> "reset_data".

REGRAS:
- "movement_type": "entrada" para receita/recebimento, "saida" para despesa/pagamento.
- "category_name": categoria curta e genérica em português ("Vendas", "Energia",
  "Insumos", "Combustível", "Aluguel"). Não invente categorias hiperespecíficas.
- "supplier_name": só o nome da pessoa/empresa que recebeu ou vendeu, quando citado.
- "payment_method": só se o usuário disser explicitamente. Nunca peça essa informação.
- Se a mensagem usa pronome ("ele", "dela", "isso"), resolva pelo CONTEXTO recebido
  e escreva o nome real em target_name/supplier_name.
- "user_facing_reply": um rascunho de resposta curta, humana e natural, em pt-BR.
  Varie as palavras, nunca soe robótico, nunca escreva "Recebido." ou "Operação
  realizada.". Para intents com números (query_*, compare_periods, top_expenses,
  supplier_analysis, business_overview) o sistema SUBSTITUI esse texto pelos dados
  reais — não invente valores.
- NUNCA invente informação para parecer inteligente.
`.trim();

function buildPrompt(ctx: ConversationContext, history: HistoryTurn[]): string {
  const today = new Date();
  const weekday = today.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  let p = `${SYSTEM_PROMPT}\n\nHoje é ${today.toISOString().slice(0, 10)} (${weekday}). Use esta data quando o usuário não mencionar nenhuma, e resolva datas relativas (ontem, amanhã, sexta) a partir dela.`;

  if (history.length) {
    p += `\n\nHISTÓRICO RECENTE DA CONVERSA (mais antigo primeiro):\n${history
      .map((h) => `- usuário: ${h.message}${h.intent ? ` [interpretado como ${h.intent}]` : ""}`)
      .join("\n")}`;
  }
  if (ctx.entities?.supplier_name || ctx.entities?.category_name) {
    p += `\n\nENTIDADES CITADAS RECENTEMENTE: ${JSON.stringify(ctx.entities)}. Use isso para resolver pronomes.`;
  }
  if (ctx.pending) {
    p += `\n\nOPERAÇÃO PENDENTE: o usuário estava registrando ${JSON.stringify(
      ctx.pending,
    )} e falta "${ctx.pending.missing ?? "amount"}". Se a mensagem atual fornecer esse dado, junte com o contexto e devolva "register_movement" completo. Se a mensagem for claramente sobre outro assunto, ignore a pendência e responda o novo assunto.`;
  }
  if (ctx.offer) {
    p += `\n\nA LUUD acabou de fazer uma pergunta de sim/não: ${JSON.stringify(
      ctx.offer,
    )}. Se a mensagem for uma resposta a ela, use "confirm" ou "deny".`;
  }
  return p;
}

function parseModelJson(text: string): Interpretation | null {
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as Interpretation;
    if (!parsed.intent) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function callGoogle(message: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  const data = (await res.json()) as any;
  if (!res.ok || data?.error) {
    console.error("[whatsapp/interpret] Google AI indisponível", res.status, data?.error?.message);
    return null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callLovable(message: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok || data?.error) {
    console.error("[whatsapp/interpret] IA Lovable indisponível", res.status, JSON.stringify(data?.error ?? {}));
    return null;
  }
  return data?.choices?.[0]?.message?.content ?? null;
}

/** null = nenhum provedor de IA respondeu (não perdemos o contexto pendente). */
export async function interpret(
  message: string,
  ctx: ConversationContext,
  history: HistoryTurn[],
): Promise<Interpretation | null> {
  const systemPrompt = buildPrompt(ctx, history);
  const google = await callGoogle(message, systemPrompt);
  const fromGoogle = google ? parseModelJson(google) : null;
  if (fromGoogle) return fromGoogle;

  const lovable = await callLovable(message, systemPrompt);
  return lovable ? parseModelJson(lovable) : null;
}
