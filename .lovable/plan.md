# Suporte a imagens no WhatsApp

## Objetivo
Permitir que imagens recebidas pelo WhatsApp sejam lidas pelo Gemini e convertidas em texto antes de entrarem no mesmo fluxo conversacional já usado por texto e áudio.

## Implementação
- Ajustar a identificação de imagens para aceitar tanto `image/*` quanto o tipo simples `image` enviado pelo provedor.
- Baixar a imagem com limite de tamanho e validar que o conteúdo recebido é realmente uma imagem.
- Enviar imagem e instrução multimodal ao Gemini para transcrever e interpretar comprovantes, notas, listas e outros conteúdos escritos, sem inventar informações ilegíveis.
- Entregar o texto extraído ao fluxo atual de onboarding, histórico, interpretação, confirmação, auditoria e resposta da secretária.
- Manter áudio e texto inalterados; mídia só será processada quando o campo textual vier vazio.

## Arquivos
- `src/lib/whatsapp/media.server.ts`
- `src/lib/whatsapp/webhook.server.ts`

## Validação
- Conferir tipos do projeto.
- Simular payload de imagem do TalkToMe e confirmar que o texto extraído chega ao mesmo orquestrador.
- Confirmar fallback amigável para imagem inválida, vazia ou indisponível.
