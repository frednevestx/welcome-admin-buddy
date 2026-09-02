/**
 * Código de acesso de 6 dígitos entregue pelo WhatsApp.
 *
 * Regras: o código nunca é gravado nem logado em texto puro (só o hash),
 * vale 10 minutos, é de uso único, tem limite de tentativas e de reenvios
 * por telefone. Códigos anteriores do mesmo telefone são invalidados.
 */

import { createHash, randomInt } from "crypto";

export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 5;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export interface IssueResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export async function issueCode(db: any, phone: string, requestIp?: string | null): Promise<IssueResult> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("whatsapp_access_codes")
    .select("id")
    .eq("phone_normalized", phone)
    .gte("created_at", since);
  if ((recent?.length ?? 0) >= MAX_CODES_PER_HOUR) {
    return { ok: false, error: "Muitos códigos pedidos. Tente novamente daqui a pouco." };
  }

  await db
    .from("whatsapp_access_codes")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("phone_normalized", phone)
    .is("consumed_at", null)
    .is("invalidated_at", null);

  const code = generateCode();
  const { error } = await db.from("whatsapp_access_codes").insert({
    phone_normalized: phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    request_ip: requestIp ?? null,
  });
  if (error) return { ok: false, error: "Não foi possível gerar o código agora." };

  return { ok: true, code };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

export async function verifyCode(db: any, phone: string, code: string): Promise<VerifyResult> {
  const { data: row } = await db
    .from("whatsapp_access_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("phone_normalized", phone)
    .is("consumed_at", null)
    .is("invalidated_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, error: "Peça um novo código." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Código expirado. Peça um novo." };
  }
  if (Number(row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await db.from("whatsapp_access_codes").update({ invalidated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: "Muitas tentativas. Peça um novo código." };
  }

  if (row.code_hash !== hashCode(phone, code.trim())) {
    await db
      .from("whatsapp_access_codes")
      .update({ attempts: Number(row.attempts ?? 0) + 1 })
      .eq("id", row.id);
    return { ok: false, error: "Código incorreto." };
  }

  await db.from("whatsapp_access_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true };
}
