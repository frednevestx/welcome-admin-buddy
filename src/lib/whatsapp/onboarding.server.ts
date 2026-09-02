/**
 * Cadastro automático pelo WhatsApp, sobre a IDENTIDADE persistente.
 *
 *   telefone normalizado -> whatsapp_identities -> user_id -> restaurant_id
 *
 * Regras:
 * - todo número que escreve fica registrado (status `known`) e NUNCA é apagado;
 * - ninguém precisa criar conta no site: o onboarding acontece na conversa;
 * - não existe negócio padrão nem DEFAULT_RESTAURANT_ID;
 * - se o telefone já tem vínculo antigo, ele é reaproveitado — nunca criamos
 *   uma segunda conta. Mais de um vínculo = conflito, processamento parado.
 *
 * O passo do onboarding vive em `whatsapp_sessions.context`:
 *   { step, name, business, buffered_message, last_key, last_reply }
 */

import { audit } from "@/lib/audit.server";
import {
  findLegacyLinks,
  flagConflict,
  linkIdentity,
  setIdentityStatus,
  touchIdentity,
  type WhatsAppIdentity,
} from "@/lib/identity/identity.server";
import { looksFinancial, parseIdentity, parseYesNo } from "./phone";

export const WELCOME_MESSAGE = `Olá! Eu sou a IA financeira da LUUD. Vou ajudar você a organizar as finanças do seu negócio pelo WhatsApp, gratuitamente e sem mensalidade.

Para começar, me diga seu nome e o nome do seu negócio.

Exemplo: Sou João, da Loja Central.`;

export const ASK_AGAIN_MESSAGE = `Só preciso de duas informações: seu nome e o nome do seu negócio.

Pode responder assim: Sou João, da Loja Central.`;

export const CREATED_MESSAGE =
  "Tudo certo! Seu negócio foi criado. Agora você pode me enviar recebimentos, despesas, compras ou perguntar sobre seu fluxo de caixa.";

export const BLOCKED_MESSAGE =
  "Este número está temporariamente sem acesso à LUUD. Se você acha que é um engano, responda por aqui que a equipe verifica.";

export const CONFLICT_MESSAGE =
  "Encontrei mais de um cadastro ligado a este número, então preferi não escolher por você. A equipe da LUUD vai revisar e eu te aviso por aqui.";

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

  await audit(db, {
    action: "user.created",
    entity: "user",
    entityId: userId,
    restaurantId: restaurant.id,
    actorPhone: input.phone,
    origin: "whatsapp",
    after: { name: input.name, business: input.business },
    note: "cadastro automático pelo WhatsApp",
  });
  await audit(db, {
    action: "business.created",
    entity: "restaurant",
    entityId: restaurant.id,
    restaurantId: restaurant.id,
    actorUserId: userId,
    actorPhone: input.phone,
    origin: "whatsapp",
    after: { name: input.business },
  });

  return { restaurantId: restaurant.id, userId };
}

export type OnboardingOutcome =
  | {
      kind: "ready";
      restaurantId: string;
      userId: string | null;
      identity: WhatsAppIdentity;
      bufferedMessage: string | null;
      prefix: string | null;
    }
  | { kind: "reply"; reply: string; identity: WhatsAppIdentity | null };

/**
 * Resolve o negócio do telefone. Se não existir, conduz o onboarding
 * conversacional e devolve a próxima pergunta.
 */
export async function resolveOrOnboard(
  db: any,
  input: { phone: string; message: string; contactId?: string | null; displayName?: string | null },
): Promise<OnboardingOutcome> {
  const { phone, message } = input;

  /* 1. O contato passa a existir (e nunca é apagado). */
  const identity = await touchIdentity(db, {
    phoneRaw: phone,
    contactId: input.contactId ?? phone,
    displayName: input.displayName ?? null,
  });
  if (!identity) return { kind: "reply", reply: WELCOME_MESSAGE, identity: null };

  if (identity.status === "blocked") return { kind: "reply", reply: BLOCKED_MESSAGE, identity };
  if (identity.has_conflict) return { kind: "reply", reply: CONFLICT_MESSAGE, identity };

  const session = await loadSession(db, phone);

  /* 2. Já verificado: usa usuário e negócio vinculados. */
  if (identity.restaurant_id && identity.user_id) {
    if (session?.restaurant_id !== identity.restaurant_id || session?.mode !== "active") {
      await saveSession(db, phone, { restaurant_id: identity.restaurant_id, mode: "active" });
    }
    if (identity.status !== "verified") await setIdentityStatus(db, identity.id, "verified");
    return {
      kind: "ready",
      restaurantId: identity.restaurant_id,
      userId: identity.user_id,
      identity,
      bufferedMessage: null,
      prefix: null,
    };
  }

  /* 3. Vínculo antigo (negócio cadastrado com esse WhatsApp). */
  const legacy = await findLegacyLinks(db, identity.phone_normalized);
  if (legacy.length > 1) {
    await flagConflict(db, identity.id, `telefone ligado a ${legacy.length} negócios ativos`);
    return { kind: "reply", reply: CONFLICT_MESSAGE, identity };
  }
  if (legacy.length === 1) {
    const link = legacy[0]!;
    await linkIdentity(db, {
      identityId: identity.id,
      userId: link.userId,
      restaurantId: link.restaurantId,
      displayName: identity.display_name ?? link.name,
      origin: "whatsapp",
    });
    await saveSession(db, phone, { restaurant_id: link.restaurantId, mode: "active" });
    return {
      kind: "ready",
      restaurantId: link.restaurantId,
      userId: link.userId,
      identity: { ...identity, restaurant_id: link.restaurantId, user_id: link.userId, status: "verified" },
      bufferedMessage: null,
      prefix: null,
    };
  }

  /* 4. Onboarding conversacional. */
  const ctx: Record<string, any> = session?.context ?? {};
  const step: string = ctx["step"] ?? "start";
  if (identity.status === "known") await setIdentityStatus(db, identity.id, "onboarding");

  const confirmText = (name: string, business: string) =>
    `Perfeito, ${name}. Vou vincular este WhatsApp ao negócio ${business}. Está correto? Responda Sim para confirmar ou envie a correção.`;

  // ---- passo 1: primeira mensagem ----
  if (step === "start") {
    const buffered = looksFinancial(message) ? message : null;
    const parsed = parseIdentity(message);
    if (parsed && !buffered) {
      await saveSession(db, phone, {
        mode: "onboarding",
        context: { ...ctx, step: "confirm", name: parsed.name, business: parsed.business, buffered_message: null },
      });
      return { kind: "reply", reply: confirmText(parsed.name, parsed.business), identity };
    }
    await saveSession(db, phone, {
      mode: "onboarding",
      context: { ...ctx, step: "ask_identity", buffered_message: buffered },
    });
    return {
      kind: "reply",
      identity,
      reply: buffered
        ? `${WELCOME_MESSAGE}\n\nJá guardei o lançamento que você me mandou — registro ele assim que o seu negócio estiver criado.`
        : WELCOME_MESSAGE,
    };
  }

  // ---- passo 2: nome da pessoa + nome do negócio ----
  if (step === "ask_identity") {
    const parsed = parseIdentity(message);
    if (!parsed) {
      const buffered = ctx["buffered_message"] ?? (looksFinancial(message) ? message : null);
      await saveSession(db, phone, {
        mode: "onboarding",
        context: { ...ctx, step: "ask_identity", buffered_message: buffered },
      });
      return { kind: "reply", reply: ASK_AGAIN_MESSAGE, identity };
    }
    await saveSession(db, phone, {
      mode: "onboarding",
      context: { ...ctx, step: "confirm", name: parsed.name, business: parsed.business },
    });
    return { kind: "reply", reply: confirmText(parsed.name, parsed.business), identity };
  }

  // ---- passo 3: confirmação e criação ----
  if (step === "confirm") {
    const yn = parseYesNo(message);
    if (yn === "yes") {
      const name = ctx["name"] as string;
      const business = ctx["business"] as string;
      const result = await createUserAndBusiness(db, { phone: identity.phone_normalized, name, business });
      if ("error" in result) {
        console.error("[whatsapp/onboarding] falha ao criar negócio", result.error);
        return {
          kind: "reply",
          identity,
          reply: "Tive um problema para criar seu espaço agora. Pode me mandar novamente em alguns minutos?",
        };
      }
      await linkIdentity(db, {
        identityId: identity.id,
        userId: result.userId,
        restaurantId: result.restaurantId,
        displayName: name,
        origin: "whatsapp",
      });
      const buffered = (ctx["buffered_message"] as string | null) ?? null;
      await saveSession(db, phone, {
        restaurant_id: result.restaurantId,
        mode: "active",
        context: { ...ctx, step: "done", name, business, buffered_message: null },
      });
      return {
        kind: "ready",
        restaurantId: result.restaurantId,
        userId: result.userId,
        identity: { ...identity, restaurant_id: result.restaurantId, user_id: result.userId, status: "verified" },
        bufferedMessage: buffered,
        prefix: CREATED_MESSAGE,
      };
    }

    // Correção: se a mensagem já traz os dados certos, reconfirma.
    const parsed = parseIdentity(message);
    if (parsed) {
      await saveSession(db, phone, {
        mode: "onboarding",
        context: { ...ctx, step: "confirm", name: parsed.name, business: parsed.business },
      });
      return { kind: "reply", reply: confirmText(parsed.name, parsed.business), identity };
    }
    if (yn === "no") {
      await saveSession(db, phone, { mode: "onboarding", context: { ...ctx, step: "ask_identity" } });
      return { kind: "reply", reply: ASK_AGAIN_MESSAGE, identity };
    }
    return {
      kind: "reply",
      identity,
      reply: `Só para confirmar: ${ctx["name"]}, do negócio ${ctx["business"]}. Responda Sim para eu vincular, ou me mande a correção.`,
    };
  }

  await saveSession(db, phone, { mode: "onboarding", context: { ...ctx, step: "ask_identity" } });
  return { kind: "reply", reply: WELCOME_MESSAGE, identity };
}
