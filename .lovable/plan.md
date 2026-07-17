## Objetivo

Importar o código do ZIP `luud-finance-fix-main` para este projeto vazio, provisionar um novo backend Lovable Cloud (Supabase novo, credenciais novas), aplicar o schema/RLS via migrations, e corrigir os bugs de login (Google + email/senha) e de criação de restaurante. Criar seu usuário `frednevestx@live.com` já como admin.

> Importante: como criaremos um Cloud novo, os dados do Supabase antigo (`lipyqhpwynvitfbdhvio`) NÃO serão migrados — só o schema é recriado. Se você precisa dos dados antigos, me diga antes de aprovar.

## Passos

1. **Importar código do ZIP**
   - Copiar `src/`, `public/`, `supabase/`, `components.json`, `package.json`, `bunfig.toml`, `tsconfig.json` e demais arquivos de config do ZIP para este projeto, **excluindo** `.git`, `node_modules`, `.lovable/`, `src/routeTree.gen.ts` e `src/integrations/supabase/client.ts` / `types.ts` (esses últimos serão regerados pelo Cloud novo).
   - Manter os wrappers de erro atuais (`src/server.ts`, `src/start.ts`) e o `vite.config.ts` deste projeto.

2. **Provisionar Lovable Cloud novo**
   - Ativar Cloud (cria projeto Supabase novo com URL/keys novas, injetadas automaticamente em `VITE_SUPABASE_*` / `SUPABASE_*`).
   - Regenerar `src/integrations/supabase/client.ts` e `types.ts` para o projeto novo.

3. **Aplicar schema via migrations**
   - Rodar as 2 migrations do ZIP (`supabase/migrations/*.sql`) no Cloud novo — cria todas as tabelas (restaurantes, user_roles, categorias, movimentações, planos, etc.), RLS e triggers.
   - Verificar/adicionar GRANTs no schema `public` (a Data API do Supabase moderno exige GRANTs explícitos).

4. **Configurar auth**
   - Habilitar Email/Password no Cloud novo.
   - Habilitar Google OAuth via `supabase--configure_social_auth` (login com Google pelo broker Lovable — não requer configuração manual de client_id/secret).
   - Garantir que `_authenticated/route.tsx` gerenciado está correto para o novo Cloud.

5. **Criar seu usuário admin**
   - Criar `frednevestx@live.com` com senha `Fred2013142536` via Auth Admin API.
   - Inserir role `admin` na tabela `user_roles` para esse user_id.

6. **Corrigir bugs específicos**
   - **Erro de login Google/email**: revisar `src/routes/auth.tsx` para usar `lovable.auth.signInWithOAuth("google", ...)` (broker) em vez de `supabase.auth.signInWithOAuth` direto; confirmar `redirect_uri` público.
   - **Erro ao criar restaurante**: revisar a rota/fluxo de criação (provavelmente em `onboarding-dialog.tsx` ou `configuracoes.tsx`) para conferir que `user_id` está sendo passado e que RLS/GRANTs permitem o INSERT do usuário autenticado.
   - Rodar dev server e validar login + criação de restaurante via Playwright.

## Detalhes técnicos

- Migrations: 482 linhas de SQL no arquivo principal (schema completo). Aplicadas via `supabase--migration`.
- Auth: `@lovable.dev/cloud-auth-js` já está nas deps — Google flui pelo broker.
- Admin user: criado via `supabaseAdmin.auth.admin.createUser({ email_confirm: true })` + `INSERT INTO user_roles`.
- `.env` / secrets: não copiar `.env` do ZIP. Todas as chaves do Supabase novo são injetadas automaticamente ao ativar Cloud. Secrets extras (ex: `LOVABLE_API_KEY` para o Assistente IA) serão criados sob demanda.
- Arquivos preservados deste projeto: `src/server.ts`, `src/start.ts`, `src/lib/error-*.ts`, `vite.config.ts` (wrappers de erro do template atual).

## O que NÃO será feito

- Migração de dados do Supabase antigo (`lipyqhpwynvitfbdhvio`).
- Reuso das chaves antigas — tudo passa a apontar para o Cloud novo deste projeto.
