/**
 * Cliente mínimo da API do TalkToMe (app.talktome.com.br).
 *
 * ATENÇÃO: o endpoint de envio de mensagem e o formato do corpo abaixo são uma
 * suposição inicial. É PRECISO CONFIRMAR na documentação oficial
 * (https://app.talktome.com.br/api/docs) tanto a URL quanto o payload aceito.
 * Ao confirmar, basta ajustar as constantes/objeto abaixo.
 */

export const TALKTOME_API_BASE = "https://app.talktome.com.br/api";
/** TODO: confirmar o caminho correto de envio de mensagem na doc oficial. */
export const TALKTOME_SEND_MESSAGE_PATH = "/v1/messages/send";

export function isTalkToMeConfigured(): boolean {
  return !!process.env.TALKTOME_API_KEY;
}

export interface TalkToMeSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

/** Envia uma mensagem de texto para um telefone (formato internacional, ex: 5511999999999). */
export async function sendTalkToMeMessage(phone: string, text: string): Promise<TalkToMeSendResult> {
  const apiKey = process.env.TALKTOME_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, error: "TALKTOME_API_KEY não configurada" };
  }

  try {
    const res = await fetch(`${TALKTOME_API_BASE}${TALKTOME_SEND_MESSAGE_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      // TODO: confirmar nomes dos campos na doc oficial do TalkToMe.
      body: JSON.stringify({ phone, message: text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: body.slice(0, 500) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message ?? e) };
  }
}
