/**
 * Cadastro automático pelo WhatsApp.
 *
 * Ninguém precisa criar conta no site: o primeiro contato pelo número oficial
 * (556291152495, ligado ao webhook TalkToMe) já cria usuário + negócio.
 *
 * Estado do onboarding vive em `whatsapp_sessions` (uma linha por telefone):
 *   mode = 'onboarding' | 'active'
 *   context = { step, name, business, buffered_message, last_key, last_reply }
 *
 * NÃO existe fallback para DEFAULT_RESTAURANT_ID: cada telefone tem o seu
 * próprio negócio, e nenhum dado é compartilhado entre negócios.
 */

import { looksFinancial, parseIdentity, parseYesNo, phoneTail } from "./phone";

export const WELCOME_MESSAGE = `Olá! Eu sou a IA financeira da LUUD. Vou ajudar você a organizar as finanças do seu negócio pelo WhatsApp, gratuitamente e sem mensalidade.

Para começar, me diga seu nome e o nome do seu negócio.

Exemplo: Sou João, da Loja Central.`;

export const ASK_AGAIN_MESSAGE = `Só preciso de duas informações: seu nome e o nome do seu negócio.

Pode responder assim: Sou João, da Loja Central.`;

export const CREATED_MESSAGE =
  "Tudo certo! Seu negócio foi criado. Agora você pode me enviar recebimentos, despesas, compras ou perguntar sobre seu fluxo de caixa.";

export interface SessionRow {
  phone: string;
  restaurant_id: string | null;
  mode: string;
  context: Record<string, any>;
}

export async function loadSession(db: any, phone: string): Promise<SessionRow | null> {
  const { data } = await db
    .from("whatsapp_sessions")
    .select("phone, restaurant_id, mode, context")
    .eq("phone", phone)
    .maybeSingle();
  return (data as SessionRow) ?? null;
}

export async function saveSession(
  db: any,
  phone: string,
  patch: { restaurant_id?: string | null; mode?: string; context?: Record<string, any> },
) {
  await db.from("whatsapp_sessions").upsert(
    {
      phone,
      ...(patch.restaurant_id !== undefined ? { restaurant_id: patch.restaurant_id } : {}),
      ...(patch.mode ? { mode: patch.mode } : {}),
      ...(patch.context ? { context: patch.context } : {}),
      last_interaction_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}

/** Negócio já cadastrado com esse WhatsApp? (casa pelos últimos 8 dígitos) */
export async function findRestaurantByPhone(db: any, phone: string): Promise<string | null> {
  const { data } = await db
    .from("restaurants")
    .select("id, whatsapp")
    .not("whatsapp", "is", null)
    .ilike("whatsapp", `%${phoneTail(phone)}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

function waEmail(phone: string) {
  return `wa${phone}@luud.app`;
}

/** Cria (ou reaproveita) o usuário do telefone e o negócio dele. */
export async function createUserAndBusiness(
  db: any,
  input: { phone: string; name: string; business: string },
): Promise<{ restaurantId: string; userId: string } | { error: string }> {
  const email = waEmail(input.phone);

  let userId: string | null = null;
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password: `luud-${input.phone}-${crypto.randomUUID().slice(0, 12)}`,
    email_confirm: true,
    user_metadata: { full_name: input.name, whatsapp: input.phone, source: "whatsapp" },
  });
  if (created?.user?.id) userId = created.user.id;

  if (!userId) {
    // Já existia: recupera pelo profile criado no primeiro cadastro.
    const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    userId = profile?.id ?? null;
  }
  if (!userId) return { error: createError?.message ?? "não foi possível criar o usuário" };

  const { data: restaurant, error: restaurantError } = await db
    .from("restaurants")
    .insert({
      name: input.business,
      owner_id: userId,
      whatsapp: input.phone,
      onboarding_completed: true,
    })
    .select("id")
    .maybeSingle();
  if (!restaurant?.id) return { error: restaurantError?.message ?? "não foi possível criar o negócio" };

  await db.rpc("seed_default_categories", { _restaurant_id: restaurant.id });
  await db
    .from("profiles")
    .update({ restaurant_id: restaurant.id, full_name: input.name })
    .eq("id", userId);

  return { restaurantId: restaurant.id, userId };
}

export type OnboardingOutcome =
  | { kind: "ready"; restaurantId: string; bufferedMessage: string | null; prefix: string | null }
  | { kind: "reply"; reply: string };

/**
 * Resolve o negócio do telefone. Se não existir, conduz o onboarding
 * conversacional e devolve a próxima pergunta.
 */
export async function resolveOrOnboard(
  db: any,
  input: { phone: string; message: string },
): Promise<OnboardingOutcome> {
  const { phone, message } = input;
  const session = await loadSession(db, phone);

  const existing = session?.restaurant_id ?? (await findRestaurantByPhone(db, phone));
  if (existing) {
    if (session?.restaurant_id !== existing || session?.mode !== "active") {
      await saveSession(db, phone, { restaurant_id: existing, mode: "active" });
    }
    return { kind: "ready", restaurantId: existing, bufferedMessage: null, prefix: null };
  }

  const ctx: Record<string, any> = session?.context ?? {};
  const step: string = ctx["step"] ?? "start";

  const confirmText = (name: string, business: string) =>
    `Perfeito, ${name}. Vou criar seu espaço gratuito para ${business}. Está correto? Responda Sim para confirmar ou envie a correção.`;

  // ---- passo 1: primeira mensagem ----
  if (step === "start") {
    const buffered = looksFinancial(message) ? message : null;
    const identity = parseIdentity(message);
    if (identity && !buffered) {
      await saveSession(db, phone, {
        mode: "onboarding",
        context: { step: "confirm", name: identity.name, business: identity.business, buffered_message: null },
      });
      return { kind: "reply", reply: confirmText(identity.name, identity.business) };
    }
    await saveSession(db, phone, {
      mode: "onboarding",
      context: { step: "ask_identity", buffered_message: buffered },
    });
    return {
      kind: "reply",
      reply: buffered
        ? `${WELCOME_MESSAGE}\n\nJá guardei o lançamento que você me mandou — registro ele assim que o seu negócio estiver criado.`
        : WELCOME_MESSAGE,
    };
  }

  // ---- passo 2: nome da pessoa + nome do negócio ----
  if (step === "ask_identity") {
    const identity = parseIdentity(message);
    if (!identity) {
      const buffered = ctx["buffered_message"] ?? (looksFinancial(message) ? message : null);
      await saveSession(db, phone, { mode: "onboarding", context: { ...ctx, step: "ask_identity", buffered_message: buffered } });
      return { kind: "reply", reply: ASK_AGAIN_MESSAGE };
    }
    await saveSession(db, phone, {
      mode: "onboarding",
      context: { ...ctx, step: "confirm", name: identity.name, business: identity.business },
    });
    return { kind: "reply", reply: confirmText(identity.name, identity.business) };
  }

  // ---- passo 3: confirmação e criação ----
  if (step === "confirm") {
    const yn = parseYesNo(message);
    if (yn === "yes") {
      const name = ctx["name"] as string;
      const business = ctx["business"] as string;
      const result = await createUserAndBusiness(db, { phone, name, business });
      if ("error" in result) {
        console.error("[whatsapp/onboarding] falha ao criar negócio", result.error);
        return {
          kind: "reply",
          reply: "Tive um problema para criar seu espaço agora. Pode me mandar novamente em alguns minutos?",
        };
      }
      const buffered = (ctx["buffered_message"] as string | null) ?? null;
      await saveSession(db, phone, {
        restaurant_id: result.restaurantId,
        mode: "active",
        context: { step: "done", name, business },
      });
      return {
        kind: "ready",
        restaurantId: result.restaurantId,
        bufferedMessage: buffered,
        prefix: CREATED_MESSAGE,
      };
    }

    // Correção: se a mensagem já traz os dados certos, reconfirma.
    const identity = parseIdentity(message);
    if (identity) {
      await saveSession(db, phone, {
        mode: "onboarding",
        context: { ...ctx, step: "confirm", name: identity.name, business: identity.business },
      });
      return { kind: "reply", reply: confirmText(identity.name, identity.business) };
    }
    if (yn === "no") {
      await saveSession(db, phone, { mode: "onboarding", context: { ...ctx, step: "ask_identity" } });
      return { kind: "reply", reply: ASK_AGAIN_MESSAGE };
    }
    return {
      kind: "reply",
      reply: `Só para confirmar: ${ctx["name"]}, do negócio ${ctx["business"]}. Responda Sim para eu criar, ou me mande a correção.`,
    };
  }

  await saveSession(db, phone, { mode: "onboarding", context: { step: "ask_identity" } });
  return { kind: "reply", reply: WELCOME_MESSAGE };
}
