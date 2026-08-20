import { createFileRoute } from "@tanstack/react-router";

/**
 * Ponte TalkToMe (WhatsApp) -> Gemini -> LUUD.
 * URL pública: POST /api/public/whatsapp/gemini
 *
 * Neste stack (TanStack Start) a lógica de servidor roda como server route —
 * equivalente a uma Edge Function, mas no mesmo deploy do app.
 *
 * Secrets usadas: GEMINI_API_KEY, DEFAULT_RESTAURANT_ID (opcional),
 * SUPABASE_SERVICE_ROLE_KEY (já configurada pelo backend).
 */

const SYSTEM_PROMPT = `
Você é o interpretador de mensagens do LUUD, um sistema financeiro para restaurantes.
Extraia da mensagem do usuário os dados operacionais mencionados.
Responda APENAS com JSON válido, sem markdown, sem texto extra, no formato:

{
  "intent": "register_movement" | "question" | "other",
  "movement_type": "entrada" | "saida" | null,
  "category_name": string | null,
  "amount": number | null,
  "movement_date": "YYYY-MM-DD" | null,
  "source": string | null,
  "confidence": number,
  "user_facing_reply": string
}

"movement_type" é "entrada" para qualquer receita/recebimento (venda, repasse de
iFood/99Food, etc) e "saida" para qualquer despesa/pagamento.
"category_name" deve ser uma categoria curta em português (ex: "iFood", "Aluguel",
"Insumos") — não invente categorias muito específicas.
Se a mensagem não contiver um fato financeiro claro, use intent "question" ou "other"
e responda normalmente em "user_facing_reply", em português, tom direto e profissional.
Se faltar alguma informação essencial (valor ou data), pergunte no "user_facing_reply"
em vez de inventar. Se a data não for mencionada, assuma a data de hoje.
`.trim();

interface Parsed {
  intent?: string;
  movement_type?: "entrada" | "saida" | null;
  category_name?: string | null;
  amount?: number | null;
  movement_date?: string | null;
  source?: string | null;
  confidence?: number;
  user_facing_reply?: string;
}

async function interpretWithGemini(message: string): Promise<Parsed> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `${SYSTEM_PROMPT}\n\nA data de hoje é ${today}. Use esta data quando o usuário não mencionar nenhuma.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  const data = (await res.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text) as Parsed;
  } catch {
    return { intent: "other", user_facing_reply: "Não entendi, pode reformular?" };
  }
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

  const businessPhone =
    body?.instance?.phone ?? body?.to ?? body?.business_phone ?? body?.recipient?.phone ?? null;
  if (businessPhone) {
    const digits = String(businessPhone).replace(/\D/g, "");
    const { data } = await db
      .from("restaurants")
      .select("id")
      .ilike("whatsapp", `%${digits.slice(-8)}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }
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
          const contactId = body?.contact?.id ?? body?.contact_id ?? null;
          const messageType = body?.message?.type ?? "text";
          const rawMessage: string = body?.message?.text ?? body?.message?.transcription ?? body?.text ?? "";

          if (!restaurantId) {
            return json({
              reply:
                "Não consegui identificar o negócio dessa conversa. Verifique se o número de WhatsApp está cadastrado no LUUD.",
            });
          }
          if (!rawMessage) return json({ error: "payload incompleto" }, 400);

          const pending = await findPendingConfirmation(db, restaurantId, contactId);
          if (pending) {
            const answer = parseYesNo(rawMessage);
            if (answer === "yes") {
              await db.from("movements").update({ confirmed_by_user: true }).eq("id", pending.id);
              return json({ reply: `Confirmado: R$${pending.amount} registrado em ${pending.movement_date}.` });
            }
            if (answer === "no") {
              await db
                .from("movements")
                .update({ status: "superseded", notes: "descartado pelo usuário" })
                .eq("id", pending.id);
              return json({ reply: "Sem problema, não vou registrar esse valor. Pode me mandar o correto." });
            }
          }

          const parsed = await interpretWithGemini(rawMessage);
          let classification = "unknown";
          let movementId: string | null = null;
          let categoryId: string | null = null;

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

          let replyText = parsed.user_facing_reply ?? "Recebido.";

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
          }

          if (classification === "update") {
            replyText = `Vi que você já tinha um valor registrado para ${parsed.category_name} em ${parsed.movement_date}. Isso é uma atualização daquele valor, ou uma movimentação nova e separada?`;
          }

          if (classification === "duplicate") {
            replyText = "Esse valor já está registrado — não vou duplicar. Se for algo diferente, me dá mais detalhe.";
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
