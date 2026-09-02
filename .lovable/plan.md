# LUUD: identidade WhatsApp, acesso por código e proatividade

## Inventário (já levantado, somente leitura)

| Contato nos eventos | Mensagens | Situação |
|---|---|---|
| `5562993969722` | 32 | mesma pessoa que abaixo, formato com 9 extra |
| `556293969722` | 29 | vinculada ao negócio "Restaurante Fred", que será arquivado na limpeza |
| `5511999999999` | 6 | número de teste |
| `556283164248` | 1 | sem vínculo |
| `556284532950` | 1 | sem vínculo |
| `debug` | 21 | não é telefone |
| (vazio/nulo) | 27 | sem contato registrado |

Base atual: 7 negócios, 5 perfis, 76 movimentações, 2 sessões WhatsApp. Só o "Restaurante Fred" tem `whatsapp` preenchido (`62993969722`, sem DDI).

Conflito real encontrado: o seu número aparece em dois formatos (`5562993969722` e `556293969722`), somando 61 mensagens. A migração unifica os dois no telefone normalizado **sem apagar nenhum evento**.

## O que será construído

### 1. Identidade WhatsApp persistente
Nova tabela `whatsapp_identities` (telefone normalizado único, id do contato TalkToMe, nome, usuário, negócio, status `known|onboarding|verified|blocked`, primeira/última mensagem, verificação, timestamps). O vínculo oficial passa a ser telefone → identidade → usuário → negócio. `DEFAULT_RESTAURANT_ID` deixa de ser usado como vínculo.

Migração idempotente: cria a tabela, importa todos os telefones de eventos, sessões e negócios, normaliza, unifica apenas duplicidades comprovadamente do mesmo número, guarda o id original do TalkToMe, marca sem conta como `known`, e **não apaga nada**. Se um telefone apontar para mais de um usuário/negócio, a identidade fica marcada como conflito e o processamento para, para resolução no painel admin.

### 2. Acesso web por código do WhatsApp
- Nova tela pública `/acesso`: telefone → "Enviar código pelo WhatsApp" → 6 dígitos, contador de expiração, reenvio limitado.
- O código sai pelo canal TalkToMe já configurado (556291152495). Guardado só como hash, expira em 10 min, uso único, limite de tentativas e de reenvios por telefone e IP, códigos anteriores invalidados, nunca em log.
- Após validar, o servidor cria a sessão real do usuário (não sessão inventada no frontend).
- Número desconhecido → orientação para falar primeiro no WhatsApp. Conhecido sem vínculo → conclui onboarding.
- Login por email/senha e Google sai da experiência do usuário final.

### 3. Acesso administrativo separado
Rota `/admin/login` com email e senha, conta `frednevestx@live.com` (senha informada será definida por mim no backend e deve ser trocada depois). Role `admin` validada no servidor e nas políticas do banco — nunca por comparação de email no frontend.

### 4. Serviço central de movimentações
Um único serviço de domínio para criar, corrigir, arquivar, restaurar e reiniciar lançamentos, validando usuário, negócio, origem (`whatsapp`/`web`), evento de origem e chave de idempotência. WhatsApp e painel web passam a chamar o mesmo serviço, e o dashboard lê exatamente os mesmos dados ativos que a IA. Reenvio da mesma mensagem pelo TalkToMe nunca cria dois lançamentos.

### 5. Webhook unificado
`/api/public/whatsapp/talktome` e `/api/public/whatsapp/gemini` passam pelo mesmo fluxo interno: extrai telefone/nome/texto, registra o evento, resolve a identidade, conduz o onboarding, só então chama a IA, processa a movimentação, responde pelo TalkToMe e registra sucesso, erro, latência e duplicidade. Mensagem financeira enviada antes do cadastro fica pendente e é processada uma única vez depois.

### 6. Reset e limpeza (sem destruir contatos)
- **Reset financeiro** (usuário, pela frase exata `APAGAR TODOS OS DADOS`): arquiva os lançamentos do negócio vinculado ao telefone autenticado, preservando usuário, telefone, negócio, contatos e auditoria.
- **Limpeza administrativa**: tela de pré-visualização com a contagem exata do que será afetado; arquiva todos os 7 negócios antigos ("joao" x2, "restautannte", "comida arabe", "loja do ze", "restaurante luud" e "Restaurante Fred") e os perfis correspondentes, preservando todos os contatos WhatsApp, histórico de conversas e a conta admin. O seu número volta ao onboarding e cria um negócio novo no próximo contato. Nada é executado na migração; só após confirmação explícita na tela.

### 7. Painel do usuário simplificado
Menu reduzido a: Visão geral, Lançamentos, Conversas, Negócio, Ajuda. Visão geral com entradas, saídas, resultado, fluxo de caixa e últimos lançamentos; cada lançamento com valor, data, categoria, origem, status e ações de corrigir/arquivar. Mobile-first.

Removidos de vez (decisão sua): CMV, calculadora de preço, simulador, lucro por plataforma, integrações iFood/99Food, relatórios complexos, comparativos, evolução, importações, alertas, metas, histórico de preços, fornecedores e assistente-ia web. Some também todo texto de plano/PRO/premium/trial/checkout, substituído por "Grátis para todos. Sem mensalidade."

### 8. Painel administrativo
Áreas: visão geral da operação, contatos WhatsApp conhecidos, usuários ativados, negócios vinculados, identidades pendentes/duplicadas, conversas processadas, movimentações criadas/corrigidas/excluídas, auditoria, saúde do webhook e da IA, e migração/pré-visualização de limpeza. Telefone exibido mascarado. Admin pode vincular, corrigir vínculo, bloquear/desbloquear, concluir onboarding manual, resolver conflitos, ver erros, recuperar lançamento arquivado e auditar resets. Ver conteúdo de conversa gera registro de auditoria.

### 9. Correção e exclusão por conversa
"Na verdade foi R$ 380", "corrija para R$ 150", "mude a categoria para telefone", "a data estava errada", "apaga esse lançamento" — sempre mostrando o lançamento identificado e pedindo confirmação; com mais de um candidato, mostra as opções e não escolhe sozinho. Exclusão sempre lógica, com auditoria e recuperação.

### 10. Camada de proatividade e descoberta
Depois da resposta principal, no máximo **uma** sugestão curta de uma linha, contextual ao assunto, com rotação para não repetir sugestões recentes (histórico guardado no contexto da conversa). Sem sugestão quando: a resposta é objetiva demais, o usuário está encerrando, houve erro, existe confirmação pendente, o assunto é sensível, nada relevante se aplica, ou a sugestão já apareceu há pouco. Nunca substitui a resposta, nunca exige confirmação, nunca muda o assunto. Prioridade: relacionada à mensagem atual → aprofundamento → capacidade ainda não usada → valor gerencial → dica geral. Tom humano, consultivo, um emoji no máximo.

## Detalhes técnicos

- Migrações: `whatsapp_identities` (índice único no telefone normalizado, índices em usuário e negócio), `whatsapp_access_codes` (hash, expiração, tentativas), `audit_log` (ator, ação, entidade, antes/depois, origem), colunas de arquivamento em `movements`/`restaurants`/`profiles`, e a migração de inventário/normalização. Todas com GRANT e RLS: cada usuário só alcança o próprio negócio; rotas admin validam role no servidor.
- Auditoria registra: criação de usuário, criação/alteração de negócio, vínculo/desvínculo WhatsApp, criação/correção/exclusão/recuperação de movimentação, reset financeiro, limpeza administrativa e acesso admin a conversas.
- Módulos: `src/lib/identity/*` (normalização e resolução), `src/lib/movements/service.server.ts` (serviço central), `src/lib/auth/whatsapp-otp.*` (código e sessão), `src/lib/whatsapp/proactive-hints.server.ts` (sugestões), mais o webhook unificado em `src/lib/whatsapp/webhook.server.ts`.
- Validação: build, lint, testes das funções puras (normalização de telefone, geração/validação de código, seleção de sugestão) e os 13 cenários pedidos, incluindo o número `9939969722` preservado e não duplicado.

## Ordem de execução

1. Migrações de identidade, código de acesso e auditoria (sem apagar dados).
2. Serviço central de movimentações + webhook unificado.
3. Onboarding pelo WhatsApp sobre a nova identidade.
4. Acesso web por código e rota admin separada.
5. Enxugamento do painel do usuário e remoção de planos/páginas.
6. Painel administrativo com inventário e pré-visualização de limpeza.
7. Camada de proatividade.
8. Build, lint, testes e relatório final (arquivos, migrações, variáveis, rota do TalkToMe, conflitos encontrados).

Nada é apagado antes de você confirmar na tela de limpeza.
