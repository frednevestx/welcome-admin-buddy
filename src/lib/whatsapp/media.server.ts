/**
 * Leitura de mídia (imagem/áudio) via Gemini, usada como PONTE para o
 * orquestrador existente — nunca substitui a lógica de negócio.
 *
 * Fluxo:
 *   imagem/comprovante -> Gemini Vision -> frase equivalente ao que o
 *   usuário teria digitado -> segue pro interpret()/orchestrator normais,
 *   com confirmação, categoria e auditoria de sempre.
 *
 *   áudio (FALLBACK: só quando a TalkToMe manda audio_url mas não manda
 *   transcrição em "text") -> Gemini transcreve -> mesmo fluxo de texto.
 *
 * Nunca lança: qualquer falha vira null e quem chama decide a mensagem
 * amigável de erro (nunca 500 pro usuário final).
 */

const GEMINI_MODEL = "gemini-3.6-flash";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB de teto de segurança

async function fetchAsBase64(
  url: string,
  fallbackMime: string,
): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || fallbackMime;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_MEDIA_BYTES) return null;
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return { base64: btoa(binary), mime };
  } catch (err) {
    console.error("[whatsapp/media] falha ao baixar mídia", err);
    return null;
  }
}

async function callGeminiInline(
  inlineData: { mimeType: string; data: string },
  prompt: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: inlineData.mimeType, data: inlineData.data } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );
    const data = (await res.json()) as any;
    if (!res.ok || data?.error) {
      console.error("[whatsapp/media] Gemini indisponível", res.status, data?.error?.message);
      return null;
    }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.error("[whatsapp/media] falha ao chamar Gemini", err);
    return null;
  }
}

/**
 * Converte uma imagem (nota fiscal, comprovante, print de pagamento) numa
 * frase em 1ª pessoa equivalente ao que o usuário teria digitado, para que
 * o interpret() normal (register_movement, query_*, etc.) processe sem
 * precisar de nenhuma lógica nova no orquestrador.
 */
export async function describeImageAsMessage(
  imageUrl: string,
  mime: string | null,
  name: string | null,
): Promise<string | null> {
  const file = await fetchAsBase64(imageUrl, mime ?? "image/jpeg");
  if (!file) return null;

  const prompt = `
A imagem é um comprovante, nota fiscal, print de pagamento ou recibo enviado por ${name ?? "um usuário"} no WhatsApp para um assistente financeiro.
Escreva UMA frase curta, em português do Brasil, em primeira pessoa, como se ${name ?? "o usuário"} estivesse descrevendo esse pagamento por escrito (ex.: "paguei 45,90 para o Mercado Central hoje", "recebi 320 de um cliente via pix").
Inclua o valor (se legível), se foi pagamento (saída) ou recebimento (entrada), e o nome do fornecedor/cliente se aparecer.
Se não conseguir identificar nenhum dado financeiro na imagem, responda exatamente: SEM_DADOS_FINANCEIROS
Responda APENAS a frase, sem aspas, sem explicação.
`.trim();

  const result = await callGeminiInline({ mimeType: file.mime, data: file.base64 }, prompt);
  if (!result || result.includes("SEM_DADOS_FINANCEIROS")) return null;
  return result;
}

/**
 * FALLBACK: só é chamado quando a TalkToMe manda audio_url mas "text" (a
 * transcrição dela) vem vazio. Transcreve o áudio como texto simples.
 */
export async function transcribeAudioAsMessage(audioUrl: string): Promise<string | null> {
  const file = await fetchAsBase64(audioUrl, "audio/ogg");
  if (!file) return null;

  const prompt = `
Transcreva o áudio abaixo, enviado por um usuário no WhatsApp para um assistente financeiro em português do Brasil.
Responda APENAS com a transcrição em texto corrido, sem comentários, sem aspas.
Se o áudio estiver inaudível ou vazio, responda exatamente: SEM_AUDIO
`.trim();

  const result = await callGeminiInline({ mimeType: file.mime, data: file.base64 }, prompt);
  if (!result || result.includes("SEM_AUDIO")) return null;
  return result;
}
