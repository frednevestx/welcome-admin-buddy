## Objetivo

1. Reposicionar a landing (`src/routes/index.tsx`) de "software financeiro" para "IA que aumenta o lucro de restaurantes", com visual premium tech e mocks animados vivos.
2. Refinar a página `src/routes/auth.tsx` com a marca LUUD (logo + naming) e um visual consistente com a nova landing.

## Design System

- Paleta **Neon Mint** em `src/styles.css`: base `#0d1b2a`, superfícies `#1b4332`, primário `#2dd4a8`, glow `#73ffb8`. Novos tokens `--gradient-primary`, `--gradient-hero`, `--shadow-glow`.
- Fontes via `<link>` no `__root.tsx`: **Sora** (headings) + **Manrope** (body). Atualizar `--font-sans`/`--font-display` no `@theme`.
- Animações discretas: `fade-in`, `scale-in` existentes + novas `pulse-glow`, `float`, `ticker`, `typing`.

## Landing (`src/routes/index.tsx`)

1. Nav minimal: logo LUUD + "Entrar" / "Começar grátis".
2. **Hero split-screen**
   - Esquerda: eyebrow "IA para restaurantes", H1 "Você vende muito. Mas quanto realmente sobra?", subcopy, CTAs.
   - Direita: card glass com KPIs animados (faturamento, custos, lucro, margem) + **Painel IA LUUD**: análise concluída, R$ 4.280/mês, 4 bullets (embalagens 12%, Combo Família, taxa iFood 21%, reajuste 4%), CTA "Ver análise completa".
3. Barra de credibilidade com contadores animados: 900+ restaurantes • 2M+ pedidos • milhares de recomendações/mês.
4. **"Você se identifica?"** — grid de 6 dores com ícone.
5. **"Como a LUUD trabalha"** — fluxo horizontal de 4 passos (Vende → Organiza → IA analisa → Recomendações).
6. **Inteligência Artificial** — 2–3 exemplos de conversa em bolhas Usuário/IA LUUD com typing dot.
7. **Benefícios** — 4 cards de resultado.
8. **Demonstração viva** — 3 notificações flutuantes/ticker animado.
9. **Prova social** — 3 depoimentos com badges de métrica.
10. **Planos** — 3 cards (Básico / PRO / Premium IA) vendendo evolução.
11. **Chamada final** full-width.
12. Footer minimalista.

Todos os mocks (números, conversas, alertas) são estáticos/animados em CSS — sem chamadas reais à IA.

## Página Auth (`src/routes/auth.tsx`)

- Layout split: painel esquerdo (desktop) com fundo gradiente Neon Mint, logo LUUD grande, tagline "Descubra o lucro real do seu restaurante" e 3 bullets de valor (IA analisa, recomendações diárias, sem planilhas). Mobile mantém só o formulário com logo no topo.
- Painel direito: card do formulário atual (login / cadastro / Google) refinado com nova tipografia e tokens; título "Entrar na LUUD" / "Criar sua conta LUUD" no lugar de textos genéricos; botão Google com destaque; link "Esqueci a senha".
- Sem mexer na lógica de autenticação (Supabase / lovable OAuth) — apenas visual + copy + logo.

## Novos componentes

- `src/components/landing/hero-dashboard-mock.tsx`
- `src/components/landing/ai-chat-example.tsx`
- `src/components/landing/live-notification.tsx`
- `src/components/landing/animated-counter.tsx`

Reuso do `src/components/logo.tsx` existente na auth e nav.

## SEO

- Index: título "LUUD — IA que descobre o lucro real do seu restaurante", meta description focada em IA + lucro, og:title/description/og:image alinhados.
- Auth: título "Entrar na LUUD" + meta description curta.

## Fora de escopo

- Sem mudanças em rotas autenticadas, sidebar, onboarding ou backend.
- Sem chamadas reais à IA na landing.
- Sem alterar fluxo/lógica de auth — só UI.

## Detalhes técnicos

- `src/styles.css`: tokens Neon Mint em `:root`/`.dark`, gradientes/sombras semânticas, keyframes novos.
- `src/routes/__root.tsx`: preconnect + link Google Fonts (Sora 400/600/700, Manrope 400/500/700).
- `src/routes/index.tsx` e `src/routes/auth.tsx`: reescrever markup mantendo os componentes de rota; garantir responsividade (mobile empilha, desktop split).
