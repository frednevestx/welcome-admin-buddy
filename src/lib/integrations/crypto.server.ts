import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Chave AES-256 derivada do segredo do backend. Nunca vai para o navegador. */
function key(): Buffer {
  const raw =
    process.env["INTEGRATION_TOKEN_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!raw) throw new Error("INTEGRATION_TOKEN_SECRET não configurado");
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
