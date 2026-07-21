## Contexto

Bug do tema claro já foi corrigido nesta mesma mensagem (havia só `.dark`, criei tokens `.light` de verdade). O resto abaixo é escopo novo.

## 1. Sistema de Suporte (tickets)

Nova página `/suporte` (usuário) e integração no admin.

**Banco (migration):**
- `support_tickets` — id, user_id, restaurant_id, subject, status (`open`/`awaiting_user`/`awaiting_support`/`resolved`), priority, created_at, updated_at, last_message_at
- `support_messages` — id, ticket_id, author_id (nullable p/ IA), author_role (`user`/`admin`/`ai`), body, attachments (jsonb com paths), created_at
- Bucket privado `support-attachments` com RLS (usuário só vê próprios anexos; admin vê todos)
- RLS: user vê/edita só tickets próprios; admin (`has_role admin`) vê tudo
- GRANTs para `authenticated` e `service_role`

**UI usuário (`/suporte`):**
- Lista de tickets à esquerda, thread à direita (estilo chat, mas assíncrono)
- Botão "Novo ticket" → assunto + primeira mensagem + anexos (drag-drop imagem/PDF)
- Aviso: "Resposta em até 12h"
- Ao enviar mensagem, chama server fn que:
  1. Salva mensagem
  2. Se for a 1ª mensagem, roda IA (Lovable AI Gateway, `google/gemini-2.5-flash`) contra FAQ interno (temas simples: como criar restaurante, importar iFood, trocar plano, resetar senha, CMV, calculadora). Se IA tiver confiança alta, posta resposta automática como `author_role='ai'` e marca `awaiting_user`. Senão, deixa `awaiting_support`.

**UI admin:**
- Nova página `/admin/suporte` — inbox de tickets com filtros por status
- Em `/admin/usuarios`, adicionar ação "Abrir chat" na coluna Ações → abre drawer com thread completa + campo de resposta

## 2. Tutorial dinâmico (product tour)

Substituir o slideshow atual do `onboarding-dialog` por tour interativo real:
- Usar `driver.js` (leve, ~10KB, sem dependência pesada)
- 10 steps que apontam para elementos reais da UI via `data-tour` attrs: sidebar Dashboard, Movimentações, Importações, Metas, Alertas, CMV (badge PRO), Calculadora Preço (PRO), Lucro Plataforma (PRO), Assistente IA (Premium), Configurações
- Tour começa após criar restaurante + escolher tema, dispara navegação real entre páginas
- Botão "Refazer tour" em Configurações
- Persiste `tour_completed` em `restaurants`

## 3. Hero visual da landing (`/`)

Adicionar visual de negócio na home pública:
- Gerar imagem hero (imagegen premium) — cena minimalista de pessoa em notebook com gráficos financeiros verdes/azuis flutuando ao redor, estilo LUUD (preto + verde neon + azul)
- Aplicar como background com overlay gradient (`--gradient-hero`) + blur sutil nas bordas
- Adicionar animações minimalistas: números subindo, linhas de gráfico se desenhando (CSS puro + `animate-fade-in`)
- Copy reforçando "Descubra seu lucro"

## Detalhes técnicos

- IA de auto-resposta: server fn `answerTicketWithAI` chama `openai/gpt-5.5` via Lovable AI Gateway com prompt contendo FAQ + mensagem do usuário; retorna `{ shouldAnswer: boolean, answer: string }`
- Anexos: upload direto pro bucket via signed URL, path `{user_id}/{ticket_id}/{filename}`
- Tour: `data-tour="dashboard"` etc em cada `NavLink` da sidebar
- Landing hero: `src/assets/hero-luud.jpg` (1920x1024, premium quality porque é a primeira impressão)

## Fora de escopo

- Notificações push/email de nova resposta em ticket (posso adicionar depois se quiser)
- Multilíngua no tutorial (fica só em PT-BR)
