/**
 * ORQUESTRADOR CONVERSACIONAL da LUUD.
 *
 * A pergunta aqui não é "qual a intent?", e sim: "o que o usuário quer fazer ou
 * descobrir, o que já sei do contexto, quais dados reais existem e qual é a
 * melhor próxima ação?".
 *
 * Regra que não muda: TODO número vem do backend. A IA interpreta e redige.
 */

import {
  clearPending,
  loadContext,
  recentHistory,
  isFirstInteractionToday,
  saveContext,
  type ConversationContext,
  type PendingOffer,
  type PendingOperation,

} from "./context.server";
import { interpret, type Interpretation } from "./interpret.server";
import { BUSY_REPLY, fallbackReply, greetingReply, narrate } from "./reply.server";
import {
  comparePeriods,
  findSupplier,
  getBusinessOverviewFacts,
  getCategorySpendFacts,
  getSupplierAnalysis,
  getSupplierSpendFacts,
  getTopExpenses,
  periodRangeOf,
  type QueryPeriod,
} from "@/lib/proactive/analytics.server";
import { isResetPhrase, parseChoice, parseYesNo } from "./phone";
import {
  applyMovementUpdate,
  changesLabel,
  describeMovement,
  findMovementCandidates,
  resetMovements,
  softDeleteMovement,
  RESET_CONFIRM_MESSAGE,
  type MovementChanges,
} from "./edits.server";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface OrchestratorResult {
  reply: string;
  /** new | update | duplicate | unknown — mesmo contrato de antes. */
  classification: string;
  movementId: string | null;
  interpretation: Interpretation | { intent: string } | null;
}

/* ----------------------------- helpers ----------------------------- */

function baseCtxEarly(ctx: ConversationContext): ConversationContext {
  return { entities: ctx.entities ?? null, topic: ctx.topic ?? null, hint_history: ctx.hint_history ?? null };
}


async function findPendingConfirmation(db: any, restaurantId: string, contactId: string | null) {
  if (!contactId) return null;
  const { data } = await db
    .from("whatsapp_raw_events")
    .select("linked_movement_id, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .not("linked_movement_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.linked_movement_id) return null;
  if (Date.now() - new Date(data.created_at).getTime() > 30 * 60 * 1000) return null;

  const { data: mv } = await db
    .from("movements")
    .select("*")
    .eq("id", data.linked_movement_id)
    .eq("confirmed_by_user", false)
    .maybeSingle();
  return mv ?? null;
}

async function findOrCreateCategory(
  db: any,
  restaurantId: string,
  categoryName: string,
  movementType: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from("categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", categoryName)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await db
    .from("categories")
    .insert({ restaurant_id: restaurantId, name: categoryName, movement_type: movementType, is_default: false })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

async function classifyMovement(
  db: any,
  restaurantId: string,
  parsed: Interpretation,
  categoryId: string | null,
): Promise<string> {
  if (!parsed.amount || !parsed.movement_date) return "unknown";
  const { data: candidates } = await db
    .from("movements_current")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("type", parsed.movement_type)
    .eq("movement_date", parsed.movement_date);

  if (!candidates || candidates.length === 0) return "new";
  const exact = candidates.find(
    (m: any) => Math.abs(Number(m.amount) - Number(parsed.amount)) < 0.01 && m.category_id === categoryId,
  );
  if (exact) return "duplicate";
  if (candidates.find((m: any) => m.category_id === categoryId)) return "update";
  return "new";
}

async function sumPeriod(db: any, restaurantId: string, period: QueryPeriod) {
  const { from, to, label } = periodRangeOf(period);
  const { data } = await db
    .from("movements_current")
    .select("type, amount")
    .eq("restaurant_id", restaurantId)
    .gte("movement_date", from)
    .lte("movement_date", to);
  let revenue = 0;
  let expense = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount) || 0;
    if (row.type === "entrada") revenue += amount;
    else if (row.type === "saida") expense += amount;
  }
  return { revenue, expense, label, count: (data ?? []).length };
}

async function yesterdaySummary(db: any, restaurantId: string): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const day = iso(d);
  const { data } = await db
    .from("movements_current")
    .select("type, amount")
    .eq("restaurant_id", restaurantId)
    .eq("movement_date", day);
  if (!data || data.length === 0) return `Não encontrei nenhum lançamento registrado em ${day}.`;
  let revenue = 0;
  let expense = 0;
  for (const row of data) {
    const amount = Number(row.amount) || 0;
    if (row.type === "entrada") revenue += amount;
    else expense += amount;
  }
  return `Ontem (${day}): entradas de ${brl(revenue)}, saídas de ${brl(expense)} — resultado de ${brl(revenue - expense)}.`;
}

const NO_DUE_DATE_REPLY =
  "Hoje eu não guardo data de vencimento das contas — só a data em que o gasto aconteceu. Por isso não consigo listar contas a vencer sem inventar. Se quiser, eu crio um lembrete para você não perder o prazo, ou te mostro seus maiores gastos.";

/* --------------------------- orquestração --------------------------- */

export async function runOrchestrator(
  db: any,
  input: {
    restaurantId: string;
    contactId: string | null;
    message: string;
    eventId: string | null;
    /** usuário dono do negócio (para auditoria) */
    userId?: string | null;
    /** chave de idempotência da mensagem original */
    idempotencyKey?: string | null;
  },
): Promise<OrchestratorResult> {
  const { restaurantId, contactId, message, eventId } = input;

  const ctx = await loadContext(db, restaurantId, contactId);
  const history = await recentHistory(db, restaurantId, contactId);
  const firstToday = await isFirstInteractionToday(db, restaurantId, contactId);
  const quickYesNo = parseYesNo(message);

  const done = (reply: string, extra: Partial<OrchestratorResult> = {}): OrchestratorResult => ({
    reply,
    classification: "unknown",
    movementId: null,
    interpretation: null,
    ...extra,
  });

  /*
   * 1. Confirmação de lançamentos JÁ gravados e ainda não confirmados.
   *    A fonte de verdade é a oferta no contexto (ids explícitos). O caminho
   *    antigo (último evento com linked_movement_id) fica apenas como reserva
   *    para conversas que começaram antes desta versão.
   */
  const pendingIds =
    ctx.offer?.kind === "confirm_movements" && ctx.offer.ids.length
      ? ctx.offer.ids
      : null;

  if (pendingIds && quickYesNo) {
    const offer = ctx.offer as Extract<PendingOffer, { kind: "confirm_movements" }>;
    if (quickYesNo === "no") {
      await db
        .from("movements")
        .update({ status: "superseded", notes: "descartado pelo usuário" })
        .in("id", pendingIds)
        .eq("restaurant_id", restaurantId);
      await clearPending(db, restaurantId, contactId, ctx);
      return done(
        pendingIds.length > 1
          ? "Beleza, descartei esses lançamentos. Se quiser, me manda os valores corretos."
          : "Beleza, não vou registrar esse valor. Se quiser, me manda o correto.",
        { interpretation: { intent: "deny" } },
      );
    }

    /* Confirmação vaga ("ok", "certo") sobre uma oferta antiga: reafirma antes. */
    const ageMs = Date.now() - new Date(offer.created_at ?? 0).getTime();
    const vague = !/^\s*(sim|s|confirmo|isso)\b/i.test(message.trim());
    if (vague && ageMs > 10 * 60 * 1000) {
      await saveContext(db, restaurantId, contactId, {
        ...baseCtxEarly(ctx),
        supplier_to_create: ctx.supplier_to_create ?? null,
        offer: { ...offer, created_at: new Date().toISOString() },
      });
      return done(
        `Só para eu não errar, é isto que está esperando confirmação:\n${offer.summary}\n\nResponda "sim" que eu confirmo.`,
        { interpretation: { intent: "confirm" } },
      );
    }

    const outcome = await confirmMovements(db, restaurantId, pendingIds);
    if (outcome.confirmed.length === 0) {
      await clearPending(db, restaurantId, contactId, ctx);
      return done(
        "Tive um problema para confirmar esse registro no sistema e não quero te dizer que salvei sem ter salvo. Pode me mandar o lançamento de novo?",
        { interpretation: { intent: "confirm" } },
      );
    }

    let extra = "";
    if (ctx.supplier_to_create?.name) {
      const { data: sup } = await db
        .from("suppliers")
        .insert({ restaurant_id: restaurantId, name: ctx.supplier_to_create.name })
        .select("id")
        .maybeSingle();
      if (sup?.id) {
        await db.from("movements").update({ supplier_id: sup.id }).in("id", pendingIds);
        extra = ` Também cadastrei ${ctx.supplier_to_create.name} como fornecedor, então já consigo analisar seus gastos com ele.`;
      }
    }
    await clearPending(db, restaurantId, contactId, ctx);

    const lines = outcome.confirmed
      .map((m: any) => `• ${m.movement_date} — ${brl(Number(m.amount))}`)
      .join("\n");
    const head =
      outcome.confirmed.length > 1
        ? `Registrado. ${outcome.confirmed.length} lançamentos salvos:\n${lines}`
        : `Registrado. ${brl(Number(outcome.confirmed[0].amount))} em ${outcome.confirmed[0].movement_date}.`;
    const failed =
      outcome.failed.length > 0
        ? `\n\nAtenção: ${outcome.failed.length} lançamento(s) não conseguiram ser confirmados. Pode me mandar de novo?`
        : "";
    const aggregate = await categoryFeedback(db, restaurantId, outcome.confirmed);

    return done(`${head}${extra}${failed}${aggregate ? `\n${aggregate}` : ""}`, {
      interpretation: { intent: "confirm" },
      movementId: outcome.confirmed[0]?.id ?? null,
    });
  }

  const confirmation = pendingIds ? null : await findPendingConfirmation(db, restaurantId, contactId);
  if (confirmation && quickYesNo === "yes") {
    const outcome = await confirmMovements(db, restaurantId, [confirmation.id]);
    await clearPending(db, restaurantId, contactId, ctx);
    if (outcome.confirmed.length === 0) {
      return done(
        "Tive um problema para confirmar esse registro e não vou dizer que salvei sem ter salvo. Pode me mandar de novo?",
        { interpretation: { intent: "confirm" } },
      );
    }
    const aggregate = await categoryFeedback(db, restaurantId, outcome.confirmed);
    return done(
      `Registrado. ${brl(Number(confirmation.amount))} em ${confirmation.movement_date}.${aggregate ? `\n${aggregate}` : ""}`,
      { interpretation: { intent: "confirm" }, movementId: confirmation.id },
    );
  }
  if (confirmation && quickYesNo === "no") {
    await db
      .from("movements")
      .update({ status: "superseded", notes: "descartado pelo usuário" })
      .eq("id", confirmation.id);
    await clearPending(db, restaurantId, contactId, ctx);
    return done("Beleza, não vou registrar esse valor. Se quiser, me manda o correto.", {
      interpretation: { intent: "deny" },
    });
  }


  /* 2. Ofertas abertas (sim/não). */
  if (ctx.offer && quickYesNo) {
    if (ctx.offer.kind === "daily_summary") {
      await clearPending(db, restaurantId, contactId, ctx);
      if (quickYesNo === "yes") {
        return done(await yesterdaySummary(db, restaurantId), { interpretation: { intent: "confirm" } });
      }
      return done("Tranquilo. Quando quiser ver, é só pedir.", { interpretation: { intent: "deny" } });
    }
    if (ctx.offer.kind === "create_reminder") {
      const offer = ctx.offer;
      await clearPending(db, restaurantId, contactId, ctx);
      if (quickYesNo === "yes") {
        await db.from("reminders").insert({
          restaurant_id: restaurantId,
          contact_id: contactId,
          description: offer.description,
          due_date: offer.due_date,
          status: "pending",
        });
        return done(`Anotado: ${offer.description} em ${offer.due_date}. Vou te lembrar.`, {
          interpretation: { intent: "confirm" },
        });
      }
      return done("Ok, não vou criar o lembrete.", { interpretation: { intent: "deny" } });
    }
  }

  /* 2b. Reinício total: só executa com a frase exata. */
  if (ctx.offer?.kind === "confirm_reset") {
    if (isResetPhrase(message)) {
      const { count } = await resetMovements(db, restaurantId);
      await clearPending(db, restaurantId, contactId, ctx);
      return done(
        count === 0
          ? "Não havia lançamentos ativos, então seus dados já estão zerados."
          : `Pronto, começamos do zero: ${count} lançamento(s) saíram dos cálculos e o dashboard foi reiniciado. Seu negócio e seu histórico de auditoria continuam salvos.`,
        { interpretation: { intent: "reset_data" } },
      );
    }
    await clearPending(db, restaurantId, contactId, ctx);
    if (quickYesNo !== "yes") {
      return done("Cancelei o reinício — seus dados continuam como estavam.", {
        interpretation: { intent: "deny" },
      });
    }
    return done(
      "Para reiniciar de verdade eu preciso da frase exata. Se quiser seguir, mande novamente o pedido e depois digite: APAGAR TODOS OS DADOS",
      { interpretation: { intent: "reset_data" } },
    );
  }

  /* 2c. Correção confirmada. */
  if (ctx.offer?.kind === "confirm_update" && quickYesNo) {
    const offer = ctx.offer;
    await clearPending(db, restaurantId, contactId, ctx);
    if (quickYesNo === "no") {
      return done("Ok, deixei o lançamento como estava.", { interpretation: { intent: "deny" } });
    }
    const updated = await applyMovementUpdate(db, restaurantId, offer.movement_id, offer.changes);
    return done(
      updated
        ? `Corrigido: agora está como ${describeMovement(updated)}. O dashboard já reflete o novo valor.`
        : "Não encontrei mais esse lançamento para corrigir.",
      { interpretation: { intent: "update_movement" }, movementId: offer.movement_id },
    );
  }

  /* 2d. Exclusão confirmada. */
  if (ctx.offer?.kind === "confirm_delete" && quickYesNo) {
    const offer = ctx.offer;
    await clearPending(db, restaurantId, contactId, ctx);
    if (quickYesNo === "no") {
      return done("Beleza, mantive o lançamento.", { interpretation: { intent: "deny" } });
    }
    const removed = await softDeleteMovement(db, restaurantId, offer.movement_id);
    return done(
      removed
        ? `Excluí a ${describeMovement(removed)}. Ela saiu dos cálculos, mas fica registrada no histórico caso você precise recuperar.`
        : "Não encontrei mais esse lançamento.",
      { interpretation: { intent: "delete_movement" }, movementId: offer.movement_id },
    );
  }

  /* 2e. Escolha de qual lançamento corrigir/excluir. */
  if (ctx.offer?.kind === "choose_movement") {
    const offer = ctx.offer;
    const index = parseChoice(message, offer.ids.length);
    if (index !== null) {
      const movementId = offer.ids[index]!;
      const label = offer.labels[index] ?? "lançamento";
      if (offer.action === "delete") {
        await saveContext(db, restaurantId, contactId, {
          ...baseCtxEarly(ctx),
          offer: { kind: "confirm_delete", movement_id: movementId, label },
        });
        return done(`Confirma excluir a ${label}? Responda Sim para eu remover dos cálculos.`, {
          interpretation: { intent: "delete_movement" },
        });
      }
      await saveContext(db, restaurantId, contactId, {
        ...baseCtxEarly(ctx),
        offer: {
          kind: "confirm_update",
          movement_id: movementId,
          label,
          changes: offer.changes ?? {},
        },
      });
      return done(
        `Vou ajustar a ${label}${offer.changes ? ` (${changesLabel(offer.changes)})` : ""}. Confirma?`,
        { interpretation: { intent: "update_movement" } },
      );
    }
    if (quickYesNo === "no") {
      await clearPending(db, restaurantId, contactId, ctx);
      return done("Sem problema, não mexi em nada.", { interpretation: { intent: "deny" } });
    }
  }



  /* 3. Interpretação (com histórico + contexto). */
  const parsed = await interpret(message, ctx, history);
  if (!parsed) {
    // Nenhum provedor de IA respondeu — preservamos o contexto pendente.
    return done(BUSY_REPLY);
  }

  const entities = {
    supplier_name: parsed.supplier_name ?? parsed.target_name ?? ctx.entities?.supplier_name ?? null,
    category_name: parsed.category_name ?? ctx.entities?.category_name ?? null,
  };
  const baseCtx: ConversationContext = {
    entities,
    topic: parsed.topic ?? ctx.topic ?? null,
    hint_history: ctx.hint_history ?? null,
  };

  let classification = "unknown";
  let movementId: string | null = null;
  let reply = parsed.user_facing_reply?.trim() || fallbackReply();
  let awaitingUser = false;

  switch (parsed.intent) {
    /* ---------- DADO: registrar ---------- */
    case "register_movement": {
      if (!parsed.amount || !parsed.movement_type) {
        const pending: PendingOperation = {
          movement_type: parsed.movement_type ?? null,
          category_name: parsed.category_name ?? null,
          amount: parsed.amount ?? null,
          movement_date: parsed.movement_date ?? iso(new Date()),
          supplier_name: parsed.supplier_name ?? null,
          payment_method: parsed.payment_method ?? null,
          missing: parsed.amount ? "movement_type" : "amount",
        };
        await saveContext(db, restaurantId, contactId, { ...baseCtx, pending });
        awaitingUser = true;
        break;
      }

      const movementDate = parsed.movement_date ?? iso(new Date());
      const categoryId = parsed.category_name
        ? await findOrCreateCategory(db, restaurantId, parsed.category_name, parsed.movement_type)
        : null;
      classification = await classifyMovement(
        db,
        restaurantId,
        { ...parsed, movement_date: movementDate },
        categoryId,
      );

      let supplierId: string | null = null;
      let supplierToCreate: string | null = null;
      if (parsed.supplier_name) {
        const supplier = await findSupplier(db, restaurantId, parsed.supplier_name);
        if (supplier) supplierId = supplier.id;
        else supplierToCreate = parsed.supplier_name;
      }

      if (classification === "new") {
        const description = parsed.supplier_name
          ? `${parsed.category_name ?? "Pagamento"} — ${parsed.supplier_name}`
          : parsed.category_name ?? "Registrado via WhatsApp";
        /* Serviço central: mesma regra do painel web, com idempotência e auditoria. */
        const { createMovement } = await import("@/lib/movements/service.server");
        const created = await createMovement(
          db,
          {
            restaurantId,
            userId: input.userId ?? null,
            phone: contactId,
            origin: "whatsapp",
            sourceEventId: eventId,
            idempotencyKey: input.idempotencyKey ?? (eventId ? `whatsapp:${eventId}` : null),
          },
          {
            type: parsed.movement_type,
            amount: Number(parsed.amount),
            movement_date: movementDate,
            description,
            category_id: categoryId,
            supplier_id: supplierId,
            payment_method: parsed.payment_method ?? null,
            confirmed_by_user: false,
          },
        );
        movementId = created.id;


        const parts = [
          parsed.movement_type === "entrada" ? "entrada" : "saída",
          `de ${brl(Number(parsed.amount))}`,
          parsed.category_name ? `em ${parsed.category_name}` : null,
          parsed.supplier_name ? `para ${parsed.supplier_name}` : null,
          parsed.payment_method ? `no ${parsed.payment_method}` : null,
          `em ${movementDate}`,
        ].filter(Boolean);
        reply = `Entendi: ${parts.join(" ")}. Confirma?`;
        if (supplierToCreate) reply += ` (${supplierToCreate} ainda não está nos seus fornecedores — quer que eu cadastre?)`;

        await saveContext(db, restaurantId, contactId, {
          ...baseCtx,
          supplier_to_create: supplierToCreate ? { name: supplierToCreate, movement_id: movementId } : null,
        });
        awaitingUser = true;
      } else if (classification === "update") {
        reply = `Já tem um lançamento de ${parsed.category_name ?? "esse tipo"} em ${movementDate}. Isso é uma atualização daquele valor ou um lançamento novo e separado?`;
        await clearPending(db, restaurantId, contactId, baseCtx);
        awaitingUser = true;
      } else if (classification === "duplicate") {
        reply = "Esse valor já está registrado, então não vou duplicar. Se for outra coisa, me dá um detalhe a mais.";
        await clearPending(db, restaurantId, contactId, baseCtx);
      }
      break;
    }

    /* ---------- DADO incompleto ---------- */
    case "pending_operation": {
      const p = parsed.pending_operation ?? {};
      const pending: PendingOperation = {
        movement_type: p.movement_type ?? parsed.movement_type ?? null,
        category_name: p.category_name ?? parsed.category_name ?? null,
        amount: p.amount ?? parsed.amount ?? null,
        movement_date: p.movement_date ?? parsed.movement_date ?? iso(new Date()),
        supplier_name: p.supplier_name ?? parsed.supplier_name ?? null,
        payment_method: p.payment_method ?? parsed.payment_method ?? null,
        missing: p.missing ?? "amount",
      };
      await saveContext(db, restaurantId, contactId, { ...baseCtx, pending });
      awaitingUser = true;
      break;
    }

    /* ---------- CONSULTAS ---------- */
    case "query_summary": {
      const period = (parsed.query_period ?? "today") as QueryPeriod;
      const { revenue, expense, label, count } = await sumPeriod(db, restaurantId, period);
      if (count === 0) {
        reply = `Não encontrei nenhum lançamento ${label}.`;
        break;
      }
      const type = parsed.query_type ?? "both";
      if (type === "revenue") reply = `Você recebeu ${brl(revenue)} ${label}.`;
      else if (type === "expense") reply = `Você gastou ${brl(expense)} ${label}.`;
      else
        reply = `${label.charAt(0).toUpperCase()}${label.slice(1)}: entradas de ${brl(revenue)}, saídas de ${brl(
          expense,
        )} — resultado de ${brl(revenue - expense)}.`;
      break;
    }

    case "query_supplier": {
      const name = parsed.target_name ?? parsed.supplier_name ?? ctx.entities?.supplier_name ?? null;
      if (!name) {
        reply = "Com quem exatamente? Me diz o nome que eu somo os pagamentos.";
        awaitingUser = true;
        break;
      }
      const facts = await getSupplierSpendFacts(db, restaurantId, name);
      if (!facts) {
        reply = `Não encontrei nenhum pagamento registrado para ${name}. Se você lançou sem citar o nome, ele não entra nessa conta.`;
        break;
      }
      reply = await narrate(
        "Responda em 1 a 3 linhas quanto o usuário já pagou para essa pessoa/fornecedor, usando exatamente os valores dos fatos.",
        facts,
        `Com ${facts["nome"]}: ${facts["total"]} em ${facts["lancamentos"] ?? facts["compras"]} lançamento(s), último em ${facts["ultimo_pagamento"]}.`,
      );
      break;
    }

    case "query_category": {
      const name = parsed.target_name ?? parsed.category_name ?? ctx.entities?.category_name ?? null;
      if (!name) {
        reply = "Gasto com o quê? Me diz a categoria (energia, combustível, insumos...) que eu somo.";
        awaitingUser = true;
        break;
      }
      const facts = await getCategorySpendFacts(db, restaurantId, name, (parsed.query_period ?? "month") as QueryPeriod);
      if (!facts) {
        reply = `Não encontrei gastos registrados em ${name} nesse período. Se você lançou com outro nome de categoria, me diz qual que eu procuro.`;
        break;
      }
      reply = await narrate(
        "Responda em até 3 linhas: o valor gasto nessa categoria, como está em relação ao período anterior, e uma sugestão prática curta. Use exatamente os números dos fatos.",
        facts,
        `${facts["categoria"]} ${facts["periodo"]}: ${facts["total"]} (período anterior: ${facts["total_periodo_anterior"]}, variação ${facts["variacao_percentual"]}).`,
      );
      break;
    }

    case "compare_periods":
      reply = await comparePeriods(db, restaurantId);
      break;

    case "top_expenses":
      reply = await getTopExpenses(db, restaurantId);
      break;

    case "supplier_analysis":
      reply = await getSupplierAnalysis(db, restaurantId);
      break;

    /* ---------- ANÁLISE GERENCIAL ---------- */
    case "business_overview": {
      const facts = await getBusinessOverviewFacts(db, restaurantId);
      if (!facts["dados_suficientes"]) {
        reply =
          "Ainda não tenho lançamentos suficientes para te dar um diagnóstico honesto. Vai registrando suas entradas e saídas por aqui que em pouco tempo eu consigo te mostrar onde está o dinheiro.";
        break;
      }
      reply = await narrate(
        "Faça uma leitura gerencial em até 4 linhas seguindo FATO → INTERPRETAÇÃO → SUGESTÃO. Use exatamente os números dos fatos, cite no máximo 2 números por linha e finalize com UMA recomendação prática ou uma pergunta curta. Não afirme nada que não esteja nos fatos.",
        facts,
        `Neste mês: entradas ${facts["entradas_mes_atual"]}, saídas ${facts["saidas_mes_atual"]}, resultado ${facts["resultado_mes_atual"]} (mês anterior: ${facts["resultado_mes_anterior"]}). Quer que eu detalhe onde está saindo mais dinheiro?`,
      );
      break;
    }

    /* ---------- DECISÃO: não registra ---------- */
    case "decision": {
      const facts = await getBusinessOverviewFacts(db, restaurantId);
      const value = parsed.amount ? brl(Number(parsed.amount)) : null;
      reply = await narrate(
        "O usuário está PENSANDO em fazer um gasto — nada aconteceu ainda, então não confirme nenhum registro. Em até 4 linhas, mostre como o resultado atual do negócio se relaciona com esse valor e termine perguntando se ele quer que você compare os últimos meses. Use somente os números dos fatos.",
        { ...facts, valor_considerado: value, assunto: parsed.topic ?? parsed.category_name ?? null },
        value
          ? `Ainda não registrei nada — isso é uma intenção, não um gasto. Hoje seu resultado no mês é ${facts["resultado_mes_atual"]}, então ${value} pesa nessa conta. Quer que eu compare os últimos meses antes de você decidir?`
          : `Ainda não registrei nada, isso é só uma intenção. Seu resultado no mês é ${facts["resultado_mes_atual"]}. Quer que eu compare os últimos meses antes de você decidir?`,
      );
      break;
    }

    /* ---------- COMPROMISSO FUTURO: lembrete, não movimentação ---------- */
    case "future_commitment": {
      const due = parsed.due_date ?? parsed.movement_date ?? null;
      const who = parsed.supplier_name ?? parsed.target_name ?? null;
      const description = [
        "Pagar",
        who,
        parsed.amount ? `(${brl(Number(parsed.amount))})` : null,
        parsed.category_name && !who ? `- ${parsed.category_name}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      if (!due) {
        reply = `Entendi que é um compromisso futuro, então não vou lançar como gasto. Para qual dia é?`;
        awaitingUser = true;
        break;
      }
      await saveContext(db, restaurantId, contactId, {
        ...baseCtx,
        offer: { kind: "create_reminder", description, due_date: due },
      });
      reply = `Isso ainda não aconteceu, então não vou registrar como gasto. Quer que eu te lembre em ${due}${who ? ` de pagar o ${who}` : ""}?`;
      awaitingUser = true;
      break;
    }

    case "upcoming_bills":
      reply = NO_DUE_DATE_REPLY;
      break;

    /* ---------- CONVERSA ---------- */
    case "greeting": {
      if (firstToday) {
        await saveContext(db, restaurantId, contactId, { ...baseCtx, offer: { kind: "daily_summary" } });
        reply = await greetingReply({ message, offerSummary: true });
        awaitingUser = true;
      } else {
        reply = await greetingReply({ message, offerSummary: false });
      }
      break;
    }

    case "missing_data": {
      const subject = parsed.missing_data_subject ?? "esse dado";
      reply =
        parsed.user_facing_reply?.trim() ||
        `Hoje eu não tenho ${subject} registrado na LUUD, então não vou chutar um número. Eu acompanho suas entradas, saídas, categorias e fornecedores — se você começar a lançar isso por aqui, passo a te responder também.`;
      break;
    }

    /* ---------- CORREÇÃO de lançamento ---------- */
    case "update_movement": {
      const changes: MovementChanges = {
        amount: parsed.new_amount ?? parsed.amount ?? null,
        category_name: parsed.new_category_name ?? null,
        movement_date: parsed.new_movement_date ?? null,
        movement_type: parsed.new_movement_type ?? null,
      };
      const hasChange = Object.values(changes).some((v) => v !== null && v !== undefined);
      const candidates = await findMovementCandidates(db, restaurantId, parsed.target_hint ?? null);

      if (candidates.length === 0) {
        reply = "Não achei nenhum lançamento que combine com isso. Pode me dizer o valor ou o que era?";
        break;
      }
      if (!hasChange) {
        reply = `Encontrei a ${describeMovement(candidates[0]!)}. O que devo corrigir: o valor, a data ou a categoria?`;
        awaitingUser = true;
        await saveContext(db, restaurantId, contactId, {
          ...baseCtx,
          offer: {
            kind: "choose_movement",
            action: "update",
            ids: [candidates[0]!.id],
            labels: [describeMovement(candidates[0]!)],
            changes: null,
          },
        });
        break;
      }
      if (candidates.length > 1) {
        const labels = candidates.map(describeMovement);
        reply = `Encontrei mais de um lançamento parecido. Qual deles eu corrijo?\n${labels
          .map((l, i) => `${i + 1}. ${l}`)
          .join("\n")}`;
        awaitingUser = true;
        await saveContext(db, restaurantId, contactId, {
          ...baseCtx,
          offer: {
            kind: "choose_movement",
            action: "update",
            ids: candidates.map((c) => c.id),
            labels,
            changes,
          },
        });
        break;
      }
      const target = candidates[0]!;
      reply = `Vou ajustar a ${describeMovement(target)} — ${changesLabel(changes)}. Confirma?`;
      awaitingUser = true;
      await saveContext(db, restaurantId, contactId, {
        ...baseCtx,
        offer: { kind: "confirm_update", movement_id: target.id, label: describeMovement(target), changes },
      });
      break;
    }

    /* ---------- EXCLUSÃO de lançamento ---------- */
    case "delete_movement": {
      const candidates = await findMovementCandidates(db, restaurantId, parsed.target_hint ?? null);
      if (candidates.length === 0) {
        reply = "Não encontrei esse lançamento. Me diz o valor ou a que ele se refere que eu procuro.";
        break;
      }
      if (candidates.length > 1) {
        const labels = candidates.map(describeMovement);
        reply = `Qual desses eu excluo?\n${labels.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
        awaitingUser = true;
        await saveContext(db, restaurantId, contactId, {
          ...baseCtx,
          offer: { kind: "choose_movement", action: "delete", ids: candidates.map((c) => c.id), labels },
        });
        break;
      }
      const target = candidates[0]!;
      reply = `Confirma excluir a ${describeMovement(target)}? Ela sai dos cálculos, mas continua no histórico.`;
      awaitingUser = true;
      await saveContext(db, restaurantId, contactId, {
        ...baseCtx,
        offer: { kind: "confirm_delete", movement_id: target.id, label: describeMovement(target) },
      });
      break;
    }

    /* ---------- REINÍCIO total ---------- */
    case "reset_data": {
      reply = RESET_CONFIRM_MESSAGE;
      awaitingUser = true;
      await saveContext(db, restaurantId, contactId, { ...baseCtx, offer: { kind: "confirm_reset" } });
      break;
    }

    case "smalltalk":

    case "other":
    default:
      if (!parsed.user_facing_reply?.trim()) reply = fallbackReply();
      break;
  }

  /* Contexto: mantém a pendência viva quando o usuário mudou de assunto. */
  if (!awaitingUser && classification === "unknown") {
    const keepPending = ctx.pending && parsed.intent !== "register_movement";
    await saveContext(db, restaurantId, contactId, {
      ...baseCtx,
      pending: keepPending ? ctx.pending : null,
      offer: null,
    });
  }

  /* Insight: no máximo UM, e nunca competindo com uma pergunta aberta. */
  let hadInsight = false;
  if (!awaitingUser && !["greeting", "smalltalk"].includes(parsed.intent)) {
    try {
      const { pickInsightForReply } = await import("@/lib/proactive/insights.server");
      const insight = await pickInsightForReply(db, restaurantId, contactId);
      if (insight) {
        reply = `${reply}\n\n${insight}`;
        hadInsight = true;
      }
    } catch (err) {
      console.error("[orchestrator] insight falhou", err);
    }
  }

  /*
   * PROATIVIDADE: no máximo UMA sugestão curta, contextual, com rotação.
   * Nunca quando existe pergunta em aberto, insight anexado ou pendência.
   */
  try {
    const { appendHint, pickHint, rotateHints } = await import("./proactive-hints.server");
    const hint = pickHint({
      intent: parsed.intent,
      message,
      recent: ctx.hint_history ?? [],
      supplierName: entities.supplier_name,
      categoryName: entities.category_name,
      suppressed: awaitingUser || hadInsight || classification === "duplicate",
    });
    if (hint) {
      reply = appendHint(reply, hint);
      const current = await loadContext(db, restaurantId, contactId);
      await saveContext(db, restaurantId, contactId, {
        ...current,
        hint_history: rotateHints(ctx.hint_history, hint.key),
      });
    }
  } catch (err) {
    console.error("[orchestrator] sugestão falhou", err);
  }

  return { reply, classification, movementId, interpretation: parsed };
}
