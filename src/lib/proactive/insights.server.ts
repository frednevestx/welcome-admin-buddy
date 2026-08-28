/**
 * Fila INTERNA de insights.
 *
 * O motor de detecção (engine.server) continua igual, mas nada é mais empurrado
 * por cron. Aqui escolhemos, no máximo, UM insight pendente para anexar à
 * resposta normal da conversa — e marcamos como "shown" pra não repetir.
 */

import {
  detectFinancialAlerts,
  detectPurchaseSuggestions,
  shouldSend,
  writeMessage,
  type DetectedEvent,
} from "./engine.server";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Registra o insight como MOSTRADO (não enviado por push). */
async function markShown(
  db: any,
  restaurantId: string,
  contactId: string | null,
  ev: DetectedEvent,
  message: string,
) {
  await db.from("system_events").insert({
    restaurant_id: restaurantId,
    contact_id: contactId,
    kind: ev.kind,
    title: ev.title,
    body: message,
    reason: ev.reason,
    severity: ev.severity,
    impact_amount: ev.impactAmount,
    dedupe_key: ev.dedupeKey,
    reference_value: ev.referenceValue,
    status: "shown",
    sent_at: new Date().toISOString(),
    payload: ev.facts as any,
    reference_date: iso(new Date()),
  });
}

/**
 * Devolve o texto de UM insight pendente e relevante, ou null.
 * Nunca mais de um por resposta; o mesmo insight não volta (dedupe/cooldown).
 */
export async function pickInsightForReply(
  db: any,
  restaurantId: string,
  contactId: string | null,
): Promise<string | null> {
  try {
    const [alerts, suggestions] = await Promise.all([
      detectFinancialAlerts(db, restaurantId),
      detectPurchaseSuggestions(db, restaurantId),
    ]);
    const weight = { critical: 3, warning: 2, info: 1 } as const;
    const ordered = [...alerts, ...suggestions].sort((a, b) => weight[b.severity] - weight[a.severity]);

    for (const ev of ordered) {
      if (!(await shouldSend(db, restaurantId, ev))) continue;

      const isSuggestion = ev.kind === "suggestion";
      const text = await writeMessage(
        isSuggestion
          ? "Escreva em no máximo 2 linhas uma observação baseada NO HISTÓRICO de compras do usuário. Nunca afirme nada sobre estoque. Termine com uma pergunta curta."
          : "Escreva em no máximo 2 linhas um aviso financeiro objetivo: o que mudou, o impacto e uma pergunta curta se ele quer olhar isso.",
        ev.facts,
        `${ev.title}: ${ev.reason}.`,
      );

      await markShown(db, restaurantId, contactId, ev, text);
      return text;
    }
  } catch (err) {
    console.error("[insights] falha ao montar insight", err);
  }
  return null;
}
