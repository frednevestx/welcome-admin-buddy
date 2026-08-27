/**
 * Comandos internos do sistema (scheduler / TalkToMe), separados da mensagem
 * normal de usuário. Contrato de resposta:
 *   sem nada relevante -> { action: "none" }
 *   com mensagem       -> { action: "send", type: "alert"|"suggestion"|"summary", reply }
 *
 * O agrupamento futuro (resumo + alerta na mesma mensagem) já é possível:
 * os eventos gravados compartilham o mesmo `group_id`.
 */

import {
  buildDailySummaryFacts,
  detectFinancialAlerts,
  detectPurchaseSuggestions,
  dueReminders,
  markRemindersSent,
  recordEvent,
  shouldSend,
  writeMessage,
  type DetectedEvent,
} from "./engine.server";

export const SYSTEM_COMMANDS = [
  "__SYSTEM_DAILY_SUMMARY__",
  "__SYSTEM_CHECK_ALERTS__",
  "__SYSTEM_CHECK_REMINDERS__",
  "__SYSTEM_CHECK_SUGGESTIONS__",
] as const;

export type SystemCommand = (typeof SYSTEM_COMMANDS)[number];

export function extractSystemCommand(body: any): SystemCommand | null {
  const raw = String(body?.command ?? body?.text ?? "").trim().toUpperCase();
  return (SYSTEM_COMMANDS as readonly string[]).includes(raw) ? (raw as SystemCommand) : null;
}

export type SystemResponse =
  | { action: "none" }
  | { action: "send"; type: "alert" | "suggestion" | "summary"; reply: string };

const NONE: SystemResponse = { action: "none" };

/** Ordena por gravidade e devolve o evento mais relevante que passou no filtro. */
async function pickSendable(db: any, restaurantId: string, events: DetectedEvent[]) {
  const weight = { critical: 3, warning: 2, info: 1 } as const;
  const ordered = events.slice().sort((a, b) => weight[b.severity] - weight[a.severity]);
  for (const ev of ordered) {
    if (await shouldSend(db, restaurantId, ev)) return ev;
  }
  return null;
}

export async function handleSystemCommand(
  db: any,
  command: SystemCommand,
  restaurantId: string,
  contactId: string | null,
): Promise<SystemResponse> {
  if (command === "__SYSTEM_CHECK_ALERTS__") {
    const events = await detectFinancialAlerts(db, restaurantId);
    const ev = await pickSendable(db, restaurantId, events);
    if (!ev) return NONE;

    const reply = await writeMessage(
      "Escreva um alerta financeiro curto pro dono do negócio, explicando o que aconteceu, o impacto e o que ele pode fazer agora.",
      ev.facts,
      `${ev.title}: ${ev.reason}.`,
    );
    await recordEvent(db, restaurantId, contactId, ev, reply, null);
    return { action: "send", type: "alert", reply };
  }

  if (command === "__SYSTEM_CHECK_SUGGESTIONS__") {
    const events = await detectPurchaseSuggestions(db, restaurantId);
    const ev = await pickSendable(db, restaurantId, events);
    if (!ev) return NONE;

    const reply = await writeMessage(
      "Escreva uma sugestão curta baseada NO HISTÓRICO de compras. Deixe explícito que é pelo histórico dele, nunca afirme nada sobre estoque, e pergunte se ele quer um lembrete pra verificar.",
      ev.facts,
      `Pelo seu histórico, você costuma comprar ${ev.facts["categoria"]} a cada ${ev.facts["intervalo_medio_dias"]} dias. Quer que eu lembre você de verificar?`,
    );
    await recordEvent(db, restaurantId, contactId, ev, reply, null);
    return { action: "send", type: "suggestion", reply };
  }

  if (command === "__SYSTEM_CHECK_REMINDERS__") {
    const reminders = await dueReminders(db, restaurantId, contactId);
    if (!reminders.length) return NONE;

    const lines = reminders.map((r: any) => `- ${r.description} (${r.due_date}${r.due_time ? ` ${r.due_time}` : ""})`);
    const reply = await writeMessage(
      "Escreva um lembrete curto no WhatsApp com os itens abaixo. Não invente itens.",
      { tipo: "lembretes", itens: reminders.map((r: any) => ({ descricao: r.description, data: r.due_date, hora: r.due_time })) },
      `Lembrete:\n${lines.join("\n")}`,
    );
    await markRemindersSent(db, reminders.map((r: any) => r.id));
    await recordEvent(
      db,
      restaurantId,
      contactId,
      {
        kind: "reminder",
        dedupeKey: `reminders:${new Date().toISOString().slice(0, 10)}`,
        reason: `${reminders.length} lembrete(s) vencendo`,
        title: "Lembretes",
        referenceValue: reminders.length,
        impactAmount: null,
        severity: "info",
        facts: { itens: lines },
      },
      reply,
      null,
    );
    return { action: "send", type: "suggestion", reply };
  }

  // __SYSTEM_DAILY_SUMMARY__
  const facts = await buildDailySummaryFacts(db, restaurantId);
  const alerts = await detectFinancialAlerts(db, restaurantId);
  const relevant = await pickSendable(db, restaurantId, alerts);
  const groupId = crypto.randomUUID();

  const payload: Record<string, unknown> = { ...facts };
  if (relevant) payload["alerta_relevante_do_dia"] = relevant.facts;

  const reply = await writeMessage(
    "Escreva o resumo do dia pro dono do negócio: bem curto, com entradas, saídas e resultado. Se houver alerta relevante, cite em uma linha. Termine com uma sugestão prática.",
    payload,
    `Resumo de ${facts.data}: entradas ${facts.entradas_hoje}, saídas ${facts.saidas_hoje}, resultado ${facts.resultado_hoje}. No mês: ${facts.resultado_no_mes}.`,
  );

  await recordEvent(
    db,
    restaurantId,
    contactId,
    {
      kind: "summary",
      dedupeKey: `daily_summary:${facts.data}`,
      reason: "resumo diário",
      title: "Resumo do dia",
      referenceValue: 0,
      impactAmount: null,
      severity: "info",
      facts: payload,
    },
    reply,
    groupId,
  );
  if (relevant) await recordEvent(db, restaurantId, contactId, relevant, reply, groupId);

  return { action: "send", type: "summary", reply };
}
