/**
 * Acesso web pelo WhatsApp: telefone -> código de 6 dígitos -> sessão real.
 * A sessão é criada pelo servidor (link mágico de uso único), nunca pelo cliente.
 */

import { createServerFn } from "@tanstack/react-start";
import { normalizePhone } from "@/lib/whatsapp/phone";

export const requestAccessCode = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Telefone inválido. Use DDD + número." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: identity } = await supabaseAdmin
      .from("whatsapp_identities")
      .select("id, user_id, status, has_conflict")
      .eq("phone_normalized", phone)
      .maybeSingle();

    if (!identity) {
      return {
        ok: false,
        error: "Número ainda não conhecido. Fale primeiro com a LUUD no WhatsApp para criar seu acesso.",
      };
    }
    if (identity.status === "blocked") return { ok: false, error: "Acesso bloqueado. Fale com o suporte." };
    if (identity.has_conflict) return { ok: false, error: "Cadastro em revisão. Fale com o suporte." };
    if (!identity.user_id) {
      return { ok: false, error: "Cadastro incompleto. Termine o cadastro pelo WhatsApp." };
    }

    const { issueCode } = await import("./whatsapp-otp.server");
    const issued = await issueCode(supabaseAdmin, phone, null);
    if (!issued.ok || !issued.code) return { ok: false, error: issued.error ?? "Falha ao gerar código." };

    const { sendTalkToMeMessage, isTalkToMeConfigured } = await import(
      "@/lib/integrations/talktome/client.server"
    );
    if (!isTalkToMeConfigured()) {
      return { ok: false, error: "Envio pelo WhatsApp indisponível no momento. Tente novamente mais tarde." };
    }
    const sent = await sendTalkToMeMessage(
      phone,
      `Seu código de acesso à LUUD é ${issued.code}. Ele vale por 10 minutos. Nunca compartilhe com ninguém.`,
    );
    if (!sent.ok) {
      console.error("[acesso] falha ao enviar código", sent.status, sent.error);
      return { ok: false, error: "Não conseguimos enviar o código agora. Tente novamente." };
    }

    return { ok: true };
  });

export const verifyAccessCode = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string }) => input)
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Telefone inválido." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCode } = await import("./whatsapp-otp.server");

    const check = await verifyCode(supabaseAdmin, phone, data.code);
    if (!check.ok) return { ok: false, error: check.error };

    const { data: identity } = await supabaseAdmin
      .from("whatsapp_identities")
      .select("user_id")
      .eq("phone_normalized", phone)
      .maybeSingle();
    if (!identity?.user_id) return { ok: false, error: "Cadastro incompleto." };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(identity.user_id);
    const email = userRes?.user?.email;
    if (!email) return { ok: false, error: "Conta sem e-mail cadastrado. Fale com o suporte." };

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      console.error("[acesso] falha ao gerar sessão", linkError);
      return { ok: false, error: "Não foi possível abrir a sessão. Tente novamente." };
    }

    const { audit } = await import("@/lib/audit.server");
    await audit(supabaseAdmin, {
      action: "auth.whatsapp_code",
      entity: "user",
      entityId: identity.user_id,
      actorUserId: identity.user_id,
      actorKind: "user",
      actorPhone: phone,
      origin: "web",
      note: "acesso liberado por código do WhatsApp",
    });

    return { ok: true, tokenHash: link.properties.hashed_token };
  });
