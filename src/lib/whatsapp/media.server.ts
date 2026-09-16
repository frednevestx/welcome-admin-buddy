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

const GEMINI_MODEL = "gemini-3.7-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB de teto de segurança

async function fetchAsBase64(
  url: string,
  fallbackMime: string,
): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || fallbackMime;
    if (!mime.toLowerCase().startsWith("image/")) return null;
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
  if (apiKey) {
    for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
        if (res.ok && !data?.error) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        } else {
          console.error("[whatsapp/media] Gemini indisponível", res.status, data?.error?.message);
          if (res.status < 500) break;
        }
      } catch (err) {
        console.error("[whatsapp/media] falha ao chamar Gemini", err);
      }
    }
  }

  const lovableApiKey = process.env.LOVABLE_API_KEY;
  if (!lovableApiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableApiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${inlineData.mimeType};base64,${inlineData.data}` },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });
    const data = (await res.json()) as any;
    if (!res.ok || data?.error) {
      console.error(
        "[whatsapp/media] IA Lovable indisponível",
        res.status,
        JSON.stringify(data?.error ?? {}),
      );
      return null;
    }
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("[whatsapp/media] falha ao chamar IA Lovable", err);
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
Esta imagem foi enviada por ${name ?? "um usuário"} no WhatsApp para a secretária inteligente da empresa.
Leia e interprete todo o conteúdo escrito que estiver legível, incluindo comprovantes, notas fiscais, recibos, listas, pedidos, anotações e capturas de tela.
Transforme o conteúdo em uma mensagem curta e objetiva, em português do Brasil, como se ${name ?? "o usuário"} tivesse digitado as informações para a secretária.
Preserve todos os dados relevantes e legíveis, como itens, quantidades, valores, datas, nomes, formas de pagamento e totais. Não invente nem complete informações ilegíveis.
Se não houver conteúdo escrito útil ou legível, responda exatamente: SEM_CONTEUDO_LEGIVEL
Responda APENAS com a mensagem extraída, sem aspas, introdução ou explicação.
`.trim();

  const result = await callGeminiInline({ mimeType: file.mime, data: file.base64 }, prompt);
  if (!result || result.includes("SEM_CONTEUDO_LEGIVEL")) return null;
  return result;
}

/**
 * FALLBACK: só é chamado quando a TalkToMe manda audio_url mas "text" (a
 * transcrição dela) vem vazio. Transcreve o áudio como texto simples.
 */
export async function transcribeAudioAsMessage(audioUrl: string): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: audioUrl }),
      },
    );
    const data = (await res.json()) as any;
    if (!res.ok) {
      console.error("[whatsapp/media] Deepgram indisponível", res.status, data?.err_msg);
      return null;
    }
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
    return transcript && transcript.length > 0 ? transcript : null;
  } catch (err) {
    console.error("[whatsapp/media] falha ao chamar Deepgram", err);
    return null;
  }
}
