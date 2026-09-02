/**
 * Cliente da API do TalkToMe (WhatsApp oficial).
 *
 * Fluxo real confirmado contra https://api.talktome.com.br/api/openapi.json:
 *  1. resolve o canal WhatsApp e a equipe (GET /api/channels, /api/teams)
 *  2. localiza (ou cria) o contato pelo telefone (platform_id)
 *  3. tenta abrir a conversa com a mensagem (POST /api/threads)
 *  4. se o contato já está em atendimento, envia na conversa existente
 *     (POST /api/threads/{id}/messages)
 *
 * Autenticação: header X-API-Key com TALKTOME_API_KEY.
 */

export const TALKTOME_API_BASE = "https://api.talktome.com.br/api";

export function isTalkToMeConfigured(): boolean {
  return !!process.env.TALKTOME_API_KEY;
}

function headers(apiKey: string) {
  return { "Content-Type": "application/json", "X-API-Key": apiKey };
}

async function api(apiKey: string, path: string, init?: RequestInit) {
  const res = await fetch(`${TALKTOME_API_BASE}${path}`, {
    ...init,
    headers: { ...headers(apiKey), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

let routing: { channelId: number; teamId: number } | null = null;

async function resolveRouting(apiKey: string) {
  if (routing) return routing;
  const envChannel = Number(process.env.TALKTOME_CHANNEL_ID ?? "");
  const envTeam = Number(process.env.TALKTOME_TEAM_ID ?? "");

  let channelId = Number.isFinite(envChannel) && envChannel > 0 ? envChannel : 0;
  let teamId = Number.isFinite(envTeam) && envTeam > 0 ? envTeam : 0;

  if (!channelId) {
    const ch = await api(apiKey, "/channels");
    const list = Array.isArray(ch.body) ? ch.body : [];
    const wa = list.find((c: any) => c.channel_type === "whatsapp" && c.is_active) ?? list[0];
    if (!wa) return null;
    channelId = wa.id;
  }
  if (!teamId) {
    const tm = await api(apiKey, "/teams");
    const list = Array.isArray(tm.body) ? tm.body : [];
    if (!list[0]) return null;
    teamId = list[0].id;
  }
  routing = { channelId, teamId };
  return routing;
}

async function resolveContactId(apiKey: string, phone: string, channelId: number): Promise<number | null> {
  const found = await api(apiKey, `/contacts?where=(platform_id,eq,${encodeURIComponent(phone)})&per_page=5`);
  const items = found.body?.items ?? [];
  const match = items.find((c: any) => String(c.platform_id) === phone);
  if (match) return match.id;

  const created = await api(apiKey, "/contacts", {
    method: "POST",
    body: JSON.stringify({ name: phone, platform_id: phone, channel_id: channelId }),
  });
  if (created.ok && created.body?.id) return created.body.id;
  console.error("[talktome] falha ao criar contato", created.status, JSON.stringify(created.body).slice(0, 300));
  return null;
}

/** "/1787062190/inbox/34" -> 34 */
function threadIdFromUrl(url?: string): number | null {
  const m = /\/inbox\/(\d+)/.exec(url ?? "");
  return m ? Number(m[1]) : null;
}

export interface TalkToMeSendResult {
  ok: boolean;
  status: number;
  error?: string;
  threadId?: number;
}

/** Envia uma mensagem de texto para um telefone no formato internacional (5562999999999). */
export async function sendTalkToMeMessage(phone: string, text: string): Promise<TalkToMeSendResult> {
  const apiKey = process.env.TALKTOME_API_KEY;
  if (!apiKey) return { ok: false, status: 0, error: "TALKTOME_API_KEY não configurada" };

  try {
    const route = await resolveRouting(apiKey);
    if (!route) return { ok: false, status: 0, error: "Canal/equipe do WhatsApp não encontrados" };

    const contactId = await resolveContactId(apiKey, phone, route.channelId);
    if (!contactId) return { ok: false, status: 0, error: "Não foi possível resolver o contato" };

    const thread = await api(apiKey, "/threads", {
      method: "POST",
      body: JSON.stringify({
        contact_id: contactId,
        channel_id: route.channelId,
        team_id: route.teamId,
        message: text,
      }),
    });
    if (thread.ok) return { ok: true, status: thread.status, threadId: thread.body?.id };

    // Contato já em atendimento: envia na conversa aberta.
    const existing = threadIdFromUrl(thread.body?.url);
    if (existing) {
      const msg = await api(apiKey, `/threads/${existing}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (msg.ok) return { ok: true, status: msg.status, threadId: existing };
      return {
        ok: false,
        status: msg.status,
        error: String(msg.body?.message ?? msg.body ?? "falha ao enviar").slice(0, 300),
      };
    }

    return {
      ok: false,
      status: thread.status,
      error: String(thread.body?.message ?? thread.body ?? "falha ao abrir conversa").slice(0, 300),
    };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message ?? e) };
  }
}
