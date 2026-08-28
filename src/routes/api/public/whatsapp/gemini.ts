import { createFileRoute } from "@tanstack/react-router";

/**
 * Ponte TalkToMe (WhatsApp) -> Gemini -> LUUD.
 * URL pública: POST /api/public/whatsapp/gemini
 *
 * Toda a inteligência conversacional vive AQUI (no backend do LUUD).
 * O TalkToMe é apenas o transporte ("o telefone").
 *
 * Secrets usadas: GEMINI_API_KEY, DEFAULT_RESTAURANT_ID (opcional),
 * SUPABASE_SERVICE_ROLE_KEY (já configurada pelo backend).
 */

const SYSTEM_PROMPT = `
Você é a LUUD, assistente financeira e de gestão de pequenos negócios, no WhatsApp.
Você atende QUALQUER tipo de negócio (comércio, serviços, alimentação, etc). NUNCA
assuma o segmento do usuário: só fale de um contexto específico (delivery, loja,
oficina...) se os dados ou a própria mensagem do usuário indicarem isso.

Responda APENAS com JSON válido, sem markdown, sem texto extra, no formato:

{
  "intent": "register_movement" | "pending_operation" | "query_summary" | "compare_periods" | "top_expenses" | "supplier_analysis" | "upcoming_bills" | "greeting" | "question" | "other",
  "movement_type": "entrada" | "saida" | null,
  "category_name": string | null,
  "amount": number | null,
  "movement_date": "YYYY-MM-DD" | null,
  "source": string | null,
  "pending_operation": { "movement_type": ..., "category_name": ..., "amount": ..., "movement_date": ..., "missing": "amount" | "movement_type" | "category_name" | "movement_date" } | null,
  "query_type": "revenue" | "expense" | "both" | null,
  "query_period": "today" | "week" | "month" | null,
  "confidence": number,
  "user_facing_reply": string
}

REGRAS:
- "movement_type" é "entrada" para qualquer receita/recebimento e "saida" para
  qualquer despesa/pagamento.
- "category_name" deve ser uma categoria curta em português (ex: "Vendas",
  "Aluguel", "Insumos"). Não invente categorias muito específicas.
- Use intent "register_movement" SOMENTE quando você tiver movement_type, amount e
  movement_date. Se a data não for mencionada, assuma a data de hoje.
- Se o usuário claramente está registrando algo mas falta uma informação essencial
  (normalmente o valor), use intent "pending_operation", preencha "pending_operation"
  com tudo que já foi coletado e o campo "missing", e pergunte no "user_facing_reply"
  APENAS o que falta (ex: "Qual foi o valor pago?").
- Perguntas sobre totais de um período ("quanto vendi hoje", "quanto gastei essa
  semana") => "query_summary" com "query_type" e "query_period".
- Comparação entre períodos ("como foi meu mês comparado ao anterior") => "compare_periods".
- Maiores gastos / onde estou gastando mais => "top_expenses".
- Perguntas sobre fornecedores => "supplier_analysis".
- Perguntas sobre contas a pagar / vencimentos futuros => "upcoming_bills".
- Saudação simples ("oi", "bom dia", "olá") => "greeting".
- Qualquer outra coisa => "question" ou "other".
- Para intents calculadas pelo sistema (query_summary, compare_periods, top_expenses,
  supplier_analysis, upcoming_bills) NUNCA invente números: o sistema calcula e
  substitui o texto.
- RESPOSTA PROPORCIONAL: pergunta simples => resposta curta e simples. Pergunta
  analítica => resposta com dados reais.
- NUNCA invente um dado que não existe. Se o usuário perguntar algo que a LUUD não
  tem na base (ex: estoque, número de clientes atendidos, folha de pagamento
  detalhada), diga claramente que esse dado não está registrado hoje.
- OBRIGATÓRIO: "user_facing_reply" NUNCA pode ficar vazio ou igual a "Recebido.".
  Se o usuário perguntar o que você faz, explique que você é a assistente
  financeira e de gestão da LUUD: registra entradas e saídas por mensagem, organiza
  categorias e responde sobre caixa, faturamento, gastos e resultado do negócio —
  com 2 exemplos curtos (ex: "recebi 320 hoje" ou "quanto gastei essa semana?").
`.trim();

const GREETING_REPLY =
  "Olá! 👋 Sou a LUUD, sua assistente financeira e de gestão. Posso ajudar você a acompanhar suas finanças, analisar seus resultados e organizar melhor seu negócio.";

interface PendingOperation {
  movement_type?: "entrada" | "saida" | null;
  category_name?: string | null;
  amount?: number | null;
  movement_date?: string | null;
  missing?: string | null;
  /** Oferta pendente aguardando sim/não (ex: resumo de ontem). */
  offer?: "daily_summary" | null;
}

interface Parsed {
  intent?: string;
  movement_type?: "entrada" | "saida" | null;
  category_name?: string | null;
  amount?: number | null;
  movement_date?: string | null;
  source?: string | null;
  pending_operation?: PendingOperation | null;
  query_type?: "revenue" | "expense" | "both" | null;
  query_period?: "today" | "week" | "month" | null;
  confidence?: number;
  user_facing_reply?: string;
}

const FALLBACK_REPLY =
  "Sou a LUUD, sua assistente financeira e de gestão. Posso registrar entradas e saídas por mensagem e responder sobre o caixa do seu negócio. Exemplos: “recebi 320 hoje” ou “quanto gastei essa semana?”.";

const BUSY_REPLY =
  "Estou com muitas mensagens no momento e não consegui processar essa agora. Me manda de novo em alguns segundos, por favor.";

function buildSystemPrompt(pendingContext: PendingOperation | null): string {
  const today = new Date().toISOString().slice(0, 10);
  let systemPrompt = `${SYSTEM_PROMPT}\n\nA data de hoje é ${today}. Use esta data quando o usuário não mencionar nenhuma.`;
  if (pendingContext) {
    systemPrompt += `\n\nCONTEXTO DA CONVERSA: o usuário já estava registrando uma movimentação: ${JSON.stringify(
      pendingContext,
    )}. Falta "${pendingContext.missing ?? "amount"}". A mensagem atual provavelmente completa essa informação — junte os dados do contexto com a mensagem nova e devolva intent "register_movement" completo. Só ignore o contexto se a mensagem atual for claramente sobre outro assunto.`;
  }
  return systemPrompt;
}


function parseModelJson(text: string): Parsed | null {
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as Parsed;
    if (!parsed.user_facing_reply || parsed.user_facing_reply.trim().length < 3) {
      parsed.user_facing_reply = FALLBACK_REPLY;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Google AI Studio (GEMINI_API_KEY). */
async function callGoogleGemini(message: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
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
    console.error("[whatsapp/gemini] Google AI indisponível", res.status, data?.error?.message);
    return null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/** Fallback: IA do Lovable (LOVABLE_API_KEY) — usada quando a cota do Google estoura. */
async function callLovableAI(message: string, systemPrompt: string): Promise<string | null> {
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
    console.error("[whatsapp/gemini] IA Lovable indisponível", res.status, JSON.stringify(data?.error ?? {}));
    return null;
  }
  return data?.choices?.[0]?.message?.content ?? null;
}

async function interpretWithGemini(message: string, pendingContext: PendingOperation | null): Promise<Parsed> {
  const systemPrompt = buildSystemPrompt(pendingContext);

  const googleText = await callGoogleGemini(message, systemPrompt);
  const fromGoogle = googleText ? parseModelJson(googleText) : null;
  if (fromGoogle) return fromGoogle;

  const lovableText = await callLovableAI(message, systemPrompt);
  const fromLovable = lovableText ? parseModelJson(lovableText) : null;
  if (fromLovable) return fromLovable;

  // Nenhum provedor respondeu — não perdemos o contexto pendente, só pedimos pra repetir.
  return { intent: "other", user_facing_reply: BUSY_REPLY };
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
    .insert({
      restaurant_id: restaurantId,
      name: categoryName,
      movement_type: movementType,
      is_default: false,
    })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

async function classifyMovement(
  db: any,
  restaurantId: string,
  parsed: Parsed,
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

/* ---------- memória de operação pendente (conversation_state) ---------- */

const PENDING_TTL_MS = 30 * 60 * 1000;

async function loadPending(db: any, restaurantId: string, contactId: string | null): Promise<PendingOperation | null> {
  if (!contactId) return null;
  const { data } = await db
    .from("conversation_state")
    .select("pending, updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (!data?.pending) return null;
  if (Date.now() - new Date(data.updated_at).getTime() > PENDING_TTL_MS) return null;
  return data.pending as PendingOperation;
}

async function savePending(db: any, restaurantId: string, contactId: string | null, pending: PendingOperation) {
  if (!contactId) return;
  await db
    .from("conversation_state")
    .upsert(
      { restaurant_id: restaurantId, contact_id: contactId, pending, updated_at: new Date().toISOString() },
      { onConflict: "restaurant_id,contact_id" },
    );
}

async function clearPending(db: any, restaurantId: string, contactId: string | null) {
  if (!contactId) return;
  await db
    .from("conversation_state")
    .update({ pending: null, updated_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId);
}

/* ---------- consultas de resumo ---------- */

function periodRange(period: "today" | "week" | "month"): { from: string; to: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = iso(now);
  if (period === "today") return { from: to, to, label: "hoje" };
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: iso(start), to, label: "nos últimos 7 dias" };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(start), to, label: "neste mês" };
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

async function answerQuery(db: any, restaurantId: string, parsed: Parsed): Promise<string> {
  const period = parsed.query_period ?? "today";
  const type = parsed.query_type ?? "both";
  const { from, to, label } = periodRange(period);

  const { data, error } = await db
    .from("movements_current")
    .select("type, amount")
    .eq("restaurant_id", restaurantId)
    .gte("movement_date", from)
    .lte("movement_date", to);
  if (error) throw new Error(error.message);

  let revenue = 0;
  let expense = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount) || 0;
    if (row.type === "entrada") revenue += amount;
    else if (row.type === "saida") expense += amount;
  }

  if (type === "revenue") return `Você recebeu ${brl(revenue)} ${label}.`;
  if (type === "expense") return `Você gastou ${brl(expense)} ${label}.`;
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}: entradas de ${brl(revenue)}, saídas de ${brl(
    expense,
  )} — resultado de ${brl(revenue - expense)}.`;
}

/* ---------- confirmação de movimentação criada ---------- */

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

function parseYesNo(message: string): "yes" | "no" | null {
  const m = message.trim().toLowerCase();
  if (["sim", "s", "confirmo", "isso", "correto", "ok"].some((w) => m === w || m.startsWith(`${w} `))) return "yes";
  if (["não", "nao", "n", "errado", "cancela"].some((w) => m === w || m.startsWith(`${w} `))) return "no";
  return null;
}

async function resolveRestaurantId(db: any, body: any): Promise<string | null> {
  const direct = body?.restaurant_id ?? body?.metadata?.restaurant_id;
  if (direct) return direct;

  // Payload real do TalkToMe: { text, phone } — bate o phone recebido contra o
  // whatsapp cadastrado no restaurante (comparando os últimos 8 dígitos).
  const incomingPhone = body?.phone ?? null;
  if (incomingPhone) {
    const digits = String(incomingPhone).replace(/\D/g, "");
    const { data } = await db
      .from("restaurants")
      .select("id")
      .ilike("whatsapp", `%${digits.slice(-8)}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }

  // Hoje só temos 1 restaurante de teste — DEFAULT_RESTAURANT_ID é o fallback.
  return process.env.DEFAULT_RESTAURANT_ID ?? null;
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/whatsapp/gemini")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;

          const restaurantId = await resolveRestaurantId(db, body);
          // Payload do TalkToMe: { text, phone } — phone vira o identificador de contato.
          const contactId = body?.phone ?? body?.contact?.id ?? body?.contact_id ?? null;
          const messageType = "text";
          const rawMessage: string = body?.text ?? body?.message?.text ?? body?.message?.transcription ?? "";

          // ---- Linha PROATIVA: comandos internos do sistema (scheduler/TalkToMe) ----
          const { extractSystemCommand, handleSystemCommand } = await import("@/lib/proactive/commands.server");
          const systemCommand = extractSystemCommand(body);
          if (systemCommand) {
            if (!restaurantId) return json({ action: "none" });
            return json(await handleSystemCommand(db, systemCommand, restaurantId, contactId));
          }


          if (!restaurantId) {
            return json({
              reply:
                "Não consegui identificar o negócio dessa conversa. Verifique se o número de WhatsApp está cadastrado no LUUD.",
            });
          }
          if (!rawMessage) return json({ error: "payload incompleto" }, 400);

          const confirmation = await findPendingConfirmation(db, restaurantId, contactId);
          if (confirmation) {
            const answer = parseYesNo(rawMessage);
            if (answer === "yes") {
              await db.from("movements").update({ confirmed_by_user: true }).eq("id", confirmation.id);
              return json({
                reply: `Confirmado: R$${confirmation.amount} registrado em ${confirmation.movement_date}.`,
              });
            }
            if (answer === "no") {
              await db
                .from("movements")
                .update({ status: "superseded", notes: "descartado pelo usuário" })
                .eq("id", confirmation.id);
              return json({ reply: "Sem problema, não vou registrar esse valor. Pode me mandar o correto." });
            }
          }

          // Memória: operação incompleta iniciada em mensagens anteriores.
          const pendingOp = await loadPending(db, restaurantId, contactId);

          const parsed = await interpretWithGemini(rawMessage, pendingOp);
          let classification = "unknown";
          let movementId: string | null = null;
          let categoryId: string | null = null;
          let replyText = parsed.user_facing_reply ?? FALLBACK_REPLY;

          if (parsed.intent === "register_movement" && parsed.amount && parsed.movement_date) {
            categoryId = parsed.category_name
              ? await findOrCreateCategory(db, restaurantId, parsed.category_name, parsed.movement_type ?? "saida")
              : null;
            classification = await classifyMovement(db, restaurantId, parsed, categoryId);
          }

          const { data: eventRow, error: evErr } = await db
            .from("whatsapp_raw_events")
            .insert({
              restaurant_id: restaurantId,
              contact_id: contactId,
              message_type: messageType,
              raw_message: rawMessage,
              interpreted_json: parsed,
              classification,
            })
            .select()
            .maybeSingle();
          if (evErr) throw new Error(evErr.message);

          if (parsed.intent === "query_summary") {
            replyText = await answerQuery(db, restaurantId, parsed);
          }

          if (parsed.intent === "pending_operation") {
            const pending: PendingOperation = {
              movement_type: parsed.pending_operation?.movement_type ?? parsed.movement_type ?? null,
              category_name: parsed.pending_operation?.category_name ?? parsed.category_name ?? null,
              amount: parsed.pending_operation?.amount ?? parsed.amount ?? null,
              movement_date:
                parsed.pending_operation?.movement_date ??
                parsed.movement_date ??
                new Date().toISOString().slice(0, 10),
              missing: parsed.pending_operation?.missing ?? "amount",
            };
            await savePending(db, restaurantId, contactId, pending);
          }

          if (classification === "new") {
            const { data: mv } = await db
              .from("movements")
              .insert({
                restaurant_id: restaurantId,
                type: parsed.movement_type,
                category_id: categoryId,
                description: parsed.category_name ?? "Registrado via WhatsApp",
                amount: parsed.amount,
                movement_date: parsed.movement_date,
                origin: "manual",
                source_ref: `whatsapp:${eventRow?.id}`,
                created_from_event_id: eventRow?.id,
                confirmed_by_user: false,
              })
              .select()
              .maybeSingle();
            movementId = mv?.id ?? null;
            replyText = `Entendi: ${parsed.category_name ?? parsed.movement_type} de R$${parsed.amount} em ${parsed.movement_date}. Confirma o registro? (sim/não)`;
            await clearPending(db, restaurantId, contactId);
          }

          if (classification === "update") {
            replyText = `Vi que você já tinha um valor registrado para ${parsed.category_name} em ${parsed.movement_date}. Isso é uma atualização daquele valor, ou uma movimentação nova e separada?`;
            await clearPending(db, restaurantId, contactId);
          }

          if (classification === "duplicate") {
            replyText = "Esse valor já está registrado — não vou duplicar. Se for algo diferente, me dá mais detalhe.";
            await clearPending(db, restaurantId, contactId);
          }

          if (movementId && eventRow?.id) {
            await db.from("whatsapp_raw_events").update({ linked_movement_id: movementId }).eq("id", eventRow.id);
          }

          return json({ reply: replyText });
        } catch (err) {
          console.error("[whatsapp/gemini]", err);
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
