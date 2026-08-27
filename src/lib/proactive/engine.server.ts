/**
 * Camada PROATIVA da LUUD.
 *
 * Filosofia: "o backend percebe, a IA explica, o empresário decide".
 *  - Toda a matemática (consultar, comparar, detectar, relevância, cooldown)
 *    acontece aqui, em código.
 *  - O Gemini recebe FATOS prontos e só escreve o texto em linguagem natural.
 *
 * Não substitui nada da linha reativa: é uma segunda linha em paralelo.
 */

export type EventKind = "alert" | "suggestion" | "summary" | "reminder";

export interface DetectedEvent {
  kind: EventKind;
  dedupeKey: string;
  reason: string;
  title: string;
  /** Valor de referência usado pra saber se a situação PIOROU desde o último aviso. */
  referenceValue: number;
  impactAmount: number | null;
  severity: "info" | "warning" | "critical";
  /** Fatos numéricos já calculados — é isso (e só isso) que a IA recebe. */
  facts: Record<string, unknown>;
}

const COOLDOWN_DAYS = 7;
/** Só reabre um alerta dentro do cooldown se piorou pelo menos isso. */
const WORSENING_THRESHOLD = 0.15;

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const iso = (d: Date) => d.toISOString().slice(0, 10);

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

interface MovementRow {
  type: string;
  amount: number;
  movement_date: string;
  category_id: string | null;
}

async function loadMovements(db: any, restaurantId: string, sinceISO: string): Promise<MovementRow[]> {
  const { data } = await db
    .from("movements_current")
    .select("type, amount, movement_date, category_id")
    .eq("restaurant_id", restaurantId)
    .gte("movement_date", sinceISO);
  return (data ?? []).map((r: any) => ({
    type: r.type,
    amount: Number(r.amount) || 0,
    movement_date: r.movement_date,
    category_id: r.category_id ?? null,
  }));
}

async function loadCategoryNames(db: any, restaurantId: string): Promise<Map<string, string>> {
  const { data } = await db.from("categories").select("id, name").eq("restaurant_id", restaurantId);
  return new Map<string, string>((data ?? []).map((c: any) => [c.id, c.name]));
}

function sumIn(rows: MovementRow[], type: string, from: string, to: string): number {
  return rows
    .filter((r) => r.type === type && r.movement_date >= from && r.movement_date <= to)
    .reduce((a, r) => a + r.amount, 0);
}

/* ============================ DETECÇÃO ============================ */

/**
 * Motor simples de alertas financeiros — sempre comparando o restaurante
 * com o PRÓPRIO histórico (30d atuais x 30d anteriores x média dos 90d anteriores).
 */
export async function detectFinancialAlerts(db: any, restaurantId: string): Promise<DetectedEvent[]> {
  const rows = await loadMovements(db, restaurantId, daysAgo(120));
  const catNames = await loadCategoryNames(db, restaurantId);

  const today = iso(new Date());
  const cur = { from: daysAgo(29), to: today };
  const prev = { from: daysAgo(59), to: daysAgo(30) };
  const hist = { from: daysAgo(119), to: daysAgo(30) }; // 90 dias anteriores

  const events: DetectedEvent[] = [];

  // --- Faturamento ---
  const revCur = sumIn(rows, "entrada", cur.from, cur.to);
  const revPrev = sumIn(rows, "entrada", prev.from, prev.to);
  const revHistAvg = sumIn(rows, "entrada", hist.from, hist.to) / 3;
  const revBase = Math.max(revPrev, revHistAvg);
  if (revBase >= 100 && revCur < revBase * 0.8) {
    const dropPct = ((revBase - revCur) / revBase) * 100;
    events.push({
      kind: "alert",
      dedupeKey: "revenue_drop",
      reason: `faturamento 30d ${brl(revCur)} vs base ${brl(revBase)} (-${dropPct.toFixed(1)}%)`,
      title: "Queda de faturamento",
      referenceValue: revCur,
      impactAmount: revCur - revBase,
      severity: dropPct >= 40 ? "critical" : "warning",
      facts: {
        tipo: "queda_de_faturamento",
        faturamento_ultimos_30d: brl(revCur),
        faturamento_30d_anteriores: brl(revPrev),
        media_mensal_90d_anteriores: brl(revHistAvg),
        queda_percentual: `${dropPct.toFixed(1)}%`,
      },
    });
  }

  // --- Despesas por categoria ---
  const byCatCur = new Map<string, number>();
  const byCatHist = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== "saida") continue;
    const key = r.category_id ?? "sem-categoria";
    if (r.movement_date >= cur.from && r.movement_date <= cur.to) {
      byCatCur.set(key, (byCatCur.get(key) ?? 0) + r.amount);
    } else if (r.movement_date >= hist.from && r.movement_date <= hist.to) {
      byCatHist.set(key, (byCatHist.get(key) ?? 0) + r.amount);
    }
  }
  for (const [catId, valueCur] of byCatCur) {
    const baseAvg = (byCatHist.get(catId) ?? 0) / 3;
    if (baseAvg < 50) continue; // sem histórico suficiente pra comparar
    if (valueCur < baseAvg * 1.3) continue;
    const upPct = ((valueCur - baseAvg) / baseAvg) * 100;
    const name = catNames.get(catId) ?? "Sem categoria";
    events.push({
      kind: "alert",
      dedupeKey: `expense_increase:${catId}`,
      reason: `${name}: ${brl(valueCur)} vs média ${brl(baseAvg)} (+${upPct.toFixed(1)}%)`,
      title: `Gastos com ${name} aumentaram`,
      referenceValue: valueCur,
      impactAmount: valueCur - baseAvg,
      severity: upPct >= 80 ? "critical" : "warning",
      facts: {
        tipo: "aumento_de_despesa",
        categoria: name,
        gasto_ultimos_30d: brl(valueCur),
        media_mensal_anterior: brl(baseAvg),
        aumento_percentual: `${upPct.toFixed(1)}%`,
        diferenca: brl(valueCur - baseAvg),
      },
    });
  }

  // --- Resultado (entradas - saídas) ---
  const resCur = revCur - sumIn(rows, "saida", cur.from, cur.to);
  const resPrev = revPrev - sumIn(rows, "saida", prev.from, prev.to);
  if (resPrev > 0 && resCur < resPrev * 0.75) {
    const dropPct = ((resPrev - resCur) / resPrev) * 100;
    events.push({
      kind: "alert",
      dedupeKey: "result_drop",
      reason: `resultado ${brl(resCur)} vs ${brl(resPrev)} (-${dropPct.toFixed(1)}%)`,
      title: "Resultado do mês piorou",
      referenceValue: resCur,
      impactAmount: resCur - resPrev,
      severity: resCur < 0 ? "critical" : "warning",
      facts: {
        tipo: "piora_do_resultado",
        resultado_ultimos_30d: brl(resCur),
        resultado_30d_anteriores: brl(resPrev),
        piora_percentual: `${dropPct.toFixed(1)}%`,
      },
    });
  }

  return events;
}

/**
 * Sugestões por padrão de compra — calculado sob demanda em `movements`,
 * sem tabela nova. Mínimo de 3 ocorrências consistentes.
 * NUNCA afirma "vai acabar o estoque": só "pelo seu histórico...".
 */
export async function detectPurchaseSuggestions(db: any, restaurantId: string): Promise<DetectedEvent[]> {
  const rows = await loadMovements(db, restaurantId, daysAgo(150));
  const catNames = await loadCategoryNames(db, restaurantId);

  const byCat = new Map<string, string[]>();
  for (const r of rows) {
    if (r.type !== "saida" || !r.category_id) continue;
    const list = byCat.get(r.category_id) ?? [];
    if (!list.includes(r.movement_date)) list.push(r.movement_date);
    byCat.set(r.category_id, list);
  }

  const events: DetectedEvent[] = [];
  const todayMs = new Date(`${iso(new Date())}T00:00:00Z`).getTime();

  for (const [catId, datesRaw] of byCat) {
    const dates = datesRaw.slice().sort();
    if (dates.length < 3) continue;

    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const a = new Date(`${dates[i - 1]}T00:00:00Z`).getTime();
      const b = new Date(`${dates[i]}T00:00:00Z`).getTime();
      intervals.push(Math.round((b - a) / 86400000));
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avg < 2 || avg > 45) continue;
    // consistência simples: todo intervalo dentro de ±50% da média
    const consistent = intervals.every((i) => Math.abs(i - avg) <= avg * 0.5);
    if (!consistent) continue;

    const last = dates[dates.length - 1]!;
    const daysSinceLast = Math.round((todayMs - new Date(`${last}T00:00:00Z`).getTime()) / 86400000);
    if (daysSinceLast < Math.max(1, Math.floor(avg) - 1)) continue;

    const name = catNames.get(catId) ?? "essa categoria";
    events.push({
      kind: "suggestion",
      dedupeKey: `purchase_pattern:${catId}`,
      reason: `${name}: ${dates.length} compras, intervalo médio ${avg.toFixed(1)}d, ${daysSinceLast}d desde a última`,
      title: `Padrão de compra: ${name}`,
      referenceValue: daysSinceLast,
      impactAmount: null,
      severity: "info",
      facts: {
        tipo: "padrao_de_compra",
        categoria: name,
        compras_identificadas: dates.length,
        intervalo_medio_dias: Number(avg.toFixed(1)),
        ultima_compra: last,
        dias_desde_a_ultima_compra: daysSinceLast,
        observacao: "não temos dado de estoque — falar apenas em termos de histórico",
      },
    });
  }

  return events;
}

/** Indicadores do dia + do mês, prontos pra IA escrever o resumo. */
export async function buildDailySummaryFacts(db: any, restaurantId: string) {
  const rows = await loadMovements(db, restaurantId, daysAgo(60));
  const catNames = await loadCategoryNames(db, restaurantId);
  const today = iso(new Date());
  const monthStart = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const revToday = sumIn(rows, "entrada", today, today);
  const expToday = sumIn(rows, "saida", today, today);
  const revMonth = sumIn(rows, "entrada", monthStart, today);
  const expMonth = sumIn(rows, "saida", monthStart, today);

  const topCat = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== "saida" || r.movement_date !== today) continue;
    const name = r.category_id ? catNames.get(r.category_id) ?? "Sem categoria" : "Sem categoria";
    topCat.set(name, (topCat.get(name) ?? 0) + r.amount);
  }
  const maior = Array.from(topCat.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

  const lancamentos = rows.filter((r) => r.movement_date === today).length;

  return {
    tipo: "resumo_diario",
    data: today,
    lancamentos_de_hoje: lancamentos,
    entradas_hoje: brl(revToday),
    saidas_hoje: brl(expToday),
    resultado_hoje: brl(revToday - expToday),
    entradas_no_mes: brl(revMonth),
    saidas_no_mes: brl(expMonth),
    resultado_no_mes: brl(revMonth - expMonth),
    maior_gasto_de_hoje: maior ? { categoria: maior[0], valor: brl(maior[1]) } : null,
  };
}

/* ============ RELEVÂNCIA / DEDUPE / COOLDOWN (evento ≠ mensagem) ============ */

/**
 * Um evento detectado só vira mensagem se: nunca foi avisado, ou o cooldown
 * passou, ou a situação piorou significativamente desde o último aviso.
 */
export async function shouldSend(db: any, restaurantId: string, ev: DetectedEvent): Promise<boolean> {
  const { data: last } = await db
    .from("system_events")
    .select("sent_at, reference_value")
    .eq("restaurant_id", restaurantId)
    .eq("dedupe_key", ev.dedupeKey)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last?.sent_at) return true;

  const daysSince = (Date.now() - new Date(last.sent_at).getTime()) / 86400000;
  if (daysSince >= COOLDOWN_DAYS) return true;

  const prevRef = Number(last.reference_value);
  if (!Number.isFinite(prevRef) || prevRef === 0) return false;

  // "piorou": despesa/dias subindo, ou faturamento/resultado caindo.
  const isUpwardBad = ev.dedupeKey.startsWith("expense_increase") || ev.dedupeKey.startsWith("purchase_pattern");
  const delta = (ev.referenceValue - prevRef) / Math.abs(prevRef);
  return isUpwardBad ? delta >= WORSENING_THRESHOLD : delta <= -WORSENING_THRESHOLD;
}

export async function recordEvent(
  db: any,
  restaurantId: string,
  contactId: string | null,
  ev: DetectedEvent,
  message: string,
  groupId: string | null,
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
    status: "sent",
    sent_at: new Date().toISOString(),
    group_id: groupId,
    payload: ev.facts as any,
    reference_date: iso(new Date()),
  });
}

/* ============================ LEMBRETES ============================ */

export async function dueReminders(db: any, restaurantId: string, contactId: string | null) {
  let q = db
    .from("reminders")
    .select("id, description, due_date, due_time, contact_id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .lte("due_date", iso(new Date()))
    .order("due_date", { ascending: true });
  if (contactId) q = q.or(`contact_id.eq.${contactId},contact_id.is.null`);
  const { data } = await q;
  return data ?? [];
}

export async function markRemindersSent(db: any, ids: string[]) {
  if (!ids.length) return;
  await db
    .from("reminders")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .in("id", ids);
}

/* ====================== IA: só escreve o texto ====================== */

const WRITER_SYSTEM = `
Você é a LUUD, assistente financeira de pequenos negócios, falando no WhatsApp.
Você vai receber FATOS já calculados pelo sistema. Sua única função é escrever a
mensagem em português do Brasil.

REGRAS ABSOLUTAS:
- NUNCA invente, recalcule ou altere números. Use exatamente os valores recebidos.
- Nunca afirme algo que não está nos fatos (ex: nunca diga que o estoque vai acabar).
- Máximo 4 linhas curtas. Sem markdown pesado, sem título, sem saudação longa.
- Termine com UMA sugestão de ação prática ou uma pergunta curta.
- Tom direto, humano e simples — quem lê é um dono de negócio ocupado.
`.trim();

async function writeWithGoogle(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: WRITER_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    },
  );
  const data = (await res.json()) as any;
  if (!res.ok || data?.error) {
    console.error("[proactive] Google AI indisponível", res.status, data?.error?.message);
    return null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

async function writeWithLovable(prompt: string): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: WRITER_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok || data?.error) {
    console.error("[proactive] IA Lovable indisponível", res.status, JSON.stringify(data?.error ?? {}));
    return null;
  }
  return data?.choices?.[0]?.message?.content?.trim() ?? null;
}

/** Gera o texto proativo a partir dos fatos. Fallback determinístico se a IA falhar. */
export async function writeMessage(
  instruction: string,
  facts: unknown,
  deterministicFallback: string,
): Promise<string> {
  const prompt = `${instruction}\n\nFATOS (JSON, não altere os números):\n${JSON.stringify(facts, null, 2)}`;
  const text = (await writeWithGoogle(prompt)) ?? (await writeWithLovable(prompt));
  return text && text.length > 5 ? text : deterministicFallback;
}
