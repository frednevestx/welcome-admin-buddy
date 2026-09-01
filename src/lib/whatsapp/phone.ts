/**
 * Helpers PUROS do canal WhatsApp (sem banco, sem IA) — testáveis.
 */

/** Só dígitos, com DDI 55 garantido para números brasileiros. */
export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 10) return null;
  return digits;
}

/** Sufixo usado para casar números salvos em formatos diferentes. */
export function phoneTail(phone: string, size = 8): string {
  return phone.slice(-size);
}

export function phoneMatches(a: string, b: string): boolean {
  return phoneTail(a) === phoneTail(b);
}

/** Chave de idempotência: id da mensagem quando existe, senão telefone+texto. */
export function dedupeKey(input: { messageId?: string | null; phone: string; text: string }): string {
  if (input.messageId) return `id:${input.messageId}`;
  return `msg:${input.phone}:${input.text.trim().toLowerCase()}`;
}

export const RESET_PHRASE = "APAGAR TODOS OS DADOS";

/** Confirmação dupla do reinício: precisa ser exatamente a frase pedida. */
export function isResetPhrase(message: string): boolean {
  return message.trim().replace(/[.!]+$/, "").toUpperCase() === RESET_PHRASE;
}

export interface ParsedIdentity {
  name: string;
  business: string;
}

const NOISE = /^(sou|eu sou|meu nome (é|e)|me chamo|aqui (é|e) o|aqui (é|e) a)\s+/i;
const BUSINESS_PREFIX = /^(da|do|de|na|no|em|minha|meu|a|o)\s+/i;

function clean(part: string): string {
  return part
    .replace(NOISE, "")
    .replace(/^[\s,;-]+|[\s,;.!-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleize(v: string): string {
  return v
    .split(" ")
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Extrai nome da pessoa + nome do negócio de frases como:
 *  "Sou João, da Loja Central" / "João - Loja Central" /
 *  "meu nome é Ana e meu negócio é Ateliê Bela"
 */
export function parseIdentity(message: string): ParsedIdentity | null {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const patterns: RegExp[] = [
    /^(?:sou|eu sou|meu nome (?:é|e)|me chamo)?\s*(.+?)\s*(?:,|-|—|\|)\s*(?:d[aeo]s?|n[ao]s?)?\s*(.+)$/i,
    /^(.+?)\s+(?:e|,)?\s*(?:meu|minha)\s+(?:neg[óo]cio|loja|empresa)\s*(?:é|e|se chama)\s*(.+)$/i,
    /^(.+?)\s+d[aeo]\s+(.+)$/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const name = clean(m[1] ?? "");
    const business = clean((m[2] ?? "").replace(BUSINESS_PREFIX, ""));
    if (name.length >= 2 && business.length >= 2 && name.split(" ").length <= 5) {
      return { name: titleize(name), business: titleize(business) };
    }
  }
  return null;
}

/** "1" / "opção 2" / "o primeiro" -> índice 0-based, ou null. */
export function parseChoice(message: string, max: number): number | null {
  const m = message.trim().toLowerCase();
  const words: Record<string, number> = { primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3 };
  for (const [w, n] of Object.entries(words)) if (m.includes(w)) return n <= max ? n - 1 : null;
  const digits = m.match(/\b([1-9])\b/);
  if (!digits) return null;
  const n = Number(digits[1]);
  return n <= max ? n - 1 : null;
}

/** A mensagem já traz um dado financeiro? (usado no onboarding) */
export function looksFinancial(message: string): boolean {
  const m = message.toLowerCase();
  const hasMoney = /(r\$\s*)?\d{1,3}(\.\d{3})*(,\d{2})?/.test(m) && /\d/.test(m);
  const verbs = /(paguei|gastei|comprei|recebi|vendi|entrou|saiu|pagamento|despesa|receita|faturei)/i;
  return hasMoney && verbs.test(m);
}

/** "sim/não" tolerante. */
export function parseYesNo(message: string): "yes" | "no" | null {
  const m = message.trim().toLowerCase().replace(/[!.]/g, "");
  const yes = ["sim", "s", "confirmo", "confirma", "isso", "correto", "ok", "pode", "claro", "positivo", "exato", "certo"];
  const no = ["não", "nao", "n", "errado", "cancela", "cancelar", "negativo", "deixa", "para", "pare"];
  if (yes.some((w) => m === w || m.startsWith(`${w} `))) return "yes";
  if (no.some((w) => m === w || m.startsWith(`${w} `))) return "no";
  return null;
}
