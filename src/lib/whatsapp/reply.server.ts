/**
 * Camada de REDAÇÃO.
 *
 * Recebe fatos já calculados pelo backend e devolve um texto humano. Reaproveita
 * o `writeMessage` do motor proativo (mesmas regras absolutas: nunca inventar ou
 * recalcular número) e sempre tem um fallback determinístico.
 */

import { writeMessage } from "@/lib/proactive/engine.server";

/** Texto natural a partir de fatos. Fallback determinístico se a IA falhar. */
export async function narrate(
  instruction: string,
  facts: unknown,
  deterministicFallback: string,
): Promise<string> {
  return writeMessage(instruction, facts, deterministicFallback);
}

/**
 * Saudação natural (com variação) em vez de uma string fixa. Se a IA não
 * responder, usa uma das variações locais.
 */
const GREETING_VARIANTS = [
  "Oi! Tudo bem? Como posso ajudar no seu negócio hoje?",
  "Olá! 👋 Por aqui, tudo pronto. O que você quer ver hoje?",
  "Oi! Pode me contar o que aconteceu no negócio hoje ou me perguntar seus números.",
  "Olá! Se quiser, me manda um lançamento ou uma pergunta sobre suas contas.",
];

function randomGreeting(): string {
  return GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)]!;
}

export async function greetingReply(input: {
  message: string;
  offerSummary: boolean;
}): Promise<string> {
  const base = randomGreeting();
  const fallback = input.offerSummary ? `${base}\n\nQuer ver como fechou ontem?` : base;

  return narrate(
    input.offerSummary
      ? 'Responda a esta saudação em 1 ou 2 linhas, de forma calorosa e variada (evite repetir sempre a mesma frase). Você é a LUUD, assistente financeira e de gestão do negócio. Termine perguntando se ele quer ver como fechou o dia de ontem.'
      : "Responda a esta saudação em 1 linha, de forma calorosa e variada (evite repetir sempre a mesma frase). Você é a LUUD, assistente financeira e de gestão do negócio. Ofereça ajuda sem listar funcionalidades.",
    { mensagem_do_usuario: input.message, primeira_do_dia: input.offerSummary },
    fallback,
  );
}

const FALLBACK_VARIANTS = [
  "Não consegui entender direito o que você precisa. Pode me explicar de outro jeito? Por exemplo: “paguei 300 de energia hoje” ou “quanto gastei essa semana?”.",
  "Acho que não peguei o que você quis dizer. Me explica um pouco melhor? Ex.: “recebi 520 hoje” ou “onde estou gastando mais?”.",
  "Essa eu não entendi bem. Pode reformular? Você pode me mandar um lançamento (“comprei material por 850”) ou uma pergunta (“quanto gastei esse mês?”).",
];

export function fallbackReply(): string {
  return FALLBACK_VARIANTS[Math.floor(Math.random() * FALLBACK_VARIANTS.length)]!;
}

export const BUSY_REPLY =
  "Estou com muitas mensagens no momento e não consegui processar essa agora. Me manda de novo em alguns segundos, por favor.";
