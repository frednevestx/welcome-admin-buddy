# Cadastro exclusivo por WhatsApp, acesso e reconciliação de negócios

## Resultado esperado

- O cadastro público acontece somente pela conversa no WhatsApp.
- `/acesso` concentra código por WhatsApp e login por e-mail/senha para contas existentes e equipe administrativa.
- A antiga tela `/auth` deixa de existir; acessos antigos a esse endereço recebem redirecionamento permanente para `/acesso`.
- O painel administrativo permite mesclar com segurança um negócio duplicado criado pelo WhatsApp no negócio real escolhido.
- Textos públicos e de onboarding passam a falar de “negócio”, sem referências de produto a restaurante, delivery, iFood ou 99Food.

## 1. Remover cadastro por e-mail e consolidar o acesso

- Excluir a interface atual de `src/routes/auth.tsx`, eliminando o único `supabase.auth.signUp` do projeto e o login Google legado.
- Manter apenas um redirecionamento de compatibilidade `/auth` → `/acesso`, sem formulário ou lógica de autenticação.
- Atualizar o layout autenticado e a verificação adicional de `/admin/usuarios` para enviar sessões ausentes a `/acesso`; a saída também volta para `/acesso`.
- Atualizar o retorno da recuperação de senha e o link da landing para `/acesso`.
- Completar os metadados de `/reset-password` e preservar os metadados próprios das demais páginas públicas.

## 2. Preservar acesso administrativo em `/acesso`

- Manter os formulários existentes de código por WhatsApp e e-mail/senha, sem cadastro novo.
- Trocar o alternador para uma mensagem clara de “conta existente ou equipe administrativa”.
- Após qualquer login, consultar a role validada no banco: administradores vão para `/admin`; demais usuários vão para `/dashboard`.
- Manter recuperação de senha apontando para `/reset-password` e retornar dali para `/acesso`.

## 3. Mesclagem administrativa transacional

### Banco e segurança

- Criar uma função transacional administrativa para mesclar `sourceId` em `targetId`.
- Validar dentro da transação: ator admin, IDs diferentes, ambos existentes e ativos, origem identificada pelo owner com e-mail `wa<telefone>@luud.app`, destino sem esse padrão, e identidade WhatsApp vinculada à origem.
- Bloquear conflitos quando o destino já tiver outro WhatsApp ou quando houver mais de uma identidade incompatível.
- Na mesma transação:
  1. mover todas as linhas de `movements` da origem para o destino, sem alterar datas, status ou IDs;
  2. apontar a identidade correspondente para o destino e para o owner do destino;
  3. atualizar a sessão WhatsApp correspondente para o destino;
  4. preencher `restaurants.whatsapp` do destino somente se vazio;
  5. apontar o perfil do owner do destino para o destino;
  6. arquivar a origem com `archived_at`, sem apagar usuário, perfil ou dados;
  7. inserir um registro bloqueante em `audit_log` com origem, destino, telefone mascarável e contagens movidas.
- Restringir a execução ao backend administrativo; nenhuma permissão de mesclagem será aberta ao navegador.

### Painel `/admin`

- Enriquecer `listBusinessesAdmin` com owner, e-mail mascarado/classificação, quantidade de movimentos e identidade vinculada.
- Na aba “Negócios”, separar candidatos “sem WhatsApp” e “criados pelo WhatsApp”.
- Adicionar seleção explícita de origem e destino, prévia das contagens, aviso de que não há desfazer automático e confirmação digitada `MESCLAR`.
- Exibir o resultado da operação e atualizar negócios, identidades, visão geral e auditoria após sucesso.

## 4. Limpeza de linguagem visível

- Revisar metadados e textos de `src/routes/__root.tsx`, `src/routes/index.tsx`, `/acesso` e `/reset-password`.
- Atualizar mensagens do onboarding conversacional e exemplos do diálogo/tour para “negócio” e exemplos genéricos.
- Remover referências visíveis a iFood/99Food/delivery encontradas no tour e no suporte, sem tocar em integrações, enums, dados do usuário ou nomes internos `restaurant*`.
- Manter os assets antigos não utilizados fora da interface; a landing atual não renderiza as imagens `brand-*`, então não haverá troca visual desnecessária.

## Arquivos previstos

- `src/routes/auth.tsx` (remoção) e um redirecionamento compatível para `/auth`
- `src/routes/acesso.tsx`
- `src/routes/reset-password.tsx`
- `src/routes/index.tsx`
- `src/routes/__root.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/admin.usuarios.tsx`
- `src/routes/_authenticated/admin.index.tsx`
- `src/lib/admin/admin.functions.ts`
- `src/lib/whatsapp/onboarding.server.ts`
- `src/components/onboarding-dialog.tsx`
- `src/hooks/use-product-tour.ts`
- `src/routes/_authenticated/suporte.tsx`
- migration gerada pela ferramenta do banco para a função transacional
- `roadmap.md`

## Validação por etapa

1. **Acesso:** confirmar ausência de `signUp`, redirecionamento `/auth` → `/acesso`, proteção de todas as rotas autenticadas e recuperação de senha.
2. **Login:** testar código por WhatsApp e e-mail/senha com sessão real; confirmar `/admin` para admin e `/dashboard` para usuário comum.
3. **Mesclagem:** criar dados temporários equivalentes a negócio real sem WhatsApp + negócio fantasma `wa<telefone>@luud.app`; adicionar movimentos e identidade; executar pela função usada no painel; confirmar movimentos, identidade, telefone do destino, origem arquivada e auditoria; remover todos os dados temporários.
4. **Onboarding:** simular novo contato e confirmação pelo WhatsApp; confirmar criação de usuário, negócio com `restaurants.whatsapp`, perfil e identidade vinculados.
5. **Copy:** busca final de textos proibidos nas superfícies visíveis, ignorando nomes internos, integrações e dados digitados pelo usuário.
6. **Interface:** validar landing, `/acesso`, `/reset-password` e `/admin` em desktop e celular, sem erros no navegador; executar verificação de tipos ao final.

## Riscos controlados

- A mesclagem não será feita por atualizações independentes: qualquer falha reverte tudo.
- Origem e destino não poderão ser invertidos silenciosamente; a origem precisa ser o cadastro sintético do WhatsApp e o destino o negócio real.
- WhatsApps conflitantes bloqueiam a operação em vez de sobrescrever dados.
- O usuário sintético e o histórico da origem permanecem preservados para auditoria; não haverá exclusão física.
- Tabelas, colunas, hooks e componentes com `restaurant` permanecem com os mesmos nomes.
