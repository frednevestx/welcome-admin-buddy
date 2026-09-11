# Payables e vencimentos reativos no WhatsApp

## Objetivo

Usar a estrutura já criada no banco, sem alterar schema, para:

- transformar compromissos futuros com **valor + vencimento** em contas a pagar, sempre com confirmação;
- manter compromissos sem valor como lembretes tipados;
- mencionar lembretes e contas vencidas somente dentro da resposta a uma mensagem recebida;
- aposentar o acionamento externo específico de lembretes, sem mudar os demais comandos do sistema.

## Estado confirmado

- `payables` já contém valor, vencimento, fornecedor opcional, status e vínculo opcional com movimento pago, mas não possui `sent_at`.
- `reminders` já contém `kind` e `sent_at`.
- O job `luud-check-reminders` existe, porém está inativo; os jobs de alertas e resumo também estão inativos no momento.
- O fluxo atual trata todo `future_commitment` como oferta de `create_reminder`, e `upcoming_bills` ainda responde que não existem vencimentos armazenados.
- Os comandos `__SYSTEM_DAILY_SUMMARY__`, `__SYSTEM_CHECK_ALERTS__`, `__SYSTEM_CHECK_REMINDERS__` e `__SYSTEM_CHECK_SUGGESTIONS__` são ramos independentes no mesmo módulo.

## Mudanças propostas

### 1. Interpretar conta a pagar sem confundir com gasto já realizado

- Manter `future_commitment` para algo que ainda vai vencer e reforçar no prompt a regra:
  - valor válido + data futura → candidato a `payables`;
  - sem valor → candidato a `reminders`;
  - fato já ocorrido → continua sendo `register_movement`;
  - intenção/possível compra sem obrigação assumida → continua sendo `decision`.
- Acrescentar à interpretação a descrição do compromisso e o tipo de lembrete (`compromisso`, `tarefa` ou `acompanhamento`) quando aplicável.
- Preservar fornecedor, valor e vencimento como entidades estruturadas; nenhum cálculo ou gravação será delegado à IA.

### 2. Confirmação explícita e gravação honesta

- Adicionar ao contexto uma oferta `create_payable` com descrição, valor, vencimento e fornecedor identificado.
- No `future_commitment`:
  - com valor e vencimento futuro, localizar o fornecedor conservadoramente e oferecer a criação da conta a pagar;
  - sem valor, oferecer o lembrete com `kind` apropriado;
  - sem vencimento, perguntar apenas a data que falta, sem gravar nada.
- No “sim”, inserir a conta ou o lembrete e reler o registro antes de afirmar que foi salvo; no “não”, limpar a oferta sem gravação.
- Usar `created_by` quando o usuário estiver disponível. Fornecedor desconhecido permanecerá nulo, com o nome preservado na descrição; não será criado automaticamente.
- Atualizar `upcoming_bills` para consultar dados reais de `payables` e `reminders`, substituindo a resposta antiga de “não guardo vencimentos”.

### 3. Vencidos anexados à resposta recebida

- Criar em `context.server.ts` uma leitura de fatos vencidos para o negócio/contato atual:
  - lembretes `pending` com `due_date <= hoje`;
  - contas a pagar `pending` com `due_date <= hoje`;
  - ordenação por atraso e relevância, com limite de itens para não dominar a resposta.
- Carregar esses fatos no início de cada execução do orquestrador e anexar, no máximo uma vez, um bloco curto ao fim da resposta principal. Nunca gerar uma resposta autônoma e nunca substituir confirmação, consulta ou erro pela cobrança.
- Garantir que os retornos antecipados do orquestrador também passem pelo mesmo finalizador, evitando que confirmações e negações pulem a checagem.
- Depois de realmente mencionar os itens:
  - em `reminders`, atualizar somente `sent_at`; o status continua `pending` até resolução real;
  - em `payables`, como não existe `sent_at`, registrar a menção em `system_events` com chave por conta, sem alterar a conta e sem migração.
- O texto será determinístico e baseado apenas nos fatos lidos do banco.

### 4. Aposentar apenas o comando externo de lembretes

- Remover `__SYSTEM_CHECK_REMINDERS__` da lista de comandos aceitos e excluir seu ramo no handler.
- Remover do motor as funções antigas que convertiam lembrete pendente em `sent`, pois esse comportamento conflita com a nova semântica de `sent_at`.
- Remover definitivamente o job inativo `luud-check-reminders` por uma operação administrativa sem mudança de schema e sem editar migrações históricas.
- Manter intactos `__SYSTEM_DAILY_SUMMARY__`, `__SYSTEM_CHECK_ALERTS__` e `__SYSTEM_CHECK_SUGGESTIONS__`; eles não dependem do ramo de lembretes e continuarão com os contratos atuais.

## Arquivos que seriam tocados

- `src/lib/whatsapp/interpret.server.ts` — contrato e regras de interpretação.
- `src/lib/whatsapp/context.server.ts` — novos tipos de oferta e leitura/controle dos vencidos.
- `src/lib/whatsapp/orchestrator.server.ts` — oferta, confirmação, consultas de vencimentos e anexação reativa.
- `src/lib/proactive/commands.server.ts` — retirada exclusiva do comando externo de lembretes.
- `src/lib/proactive/engine.server.ts` — remoção das funções antigas de disparo/alteração de status de lembretes.
- Nenhuma rota, tela, migration ou tabela será criada ou alterada.

## Testes e regressões

1. **Teste 16 — decisão futura:** “Estou pensando em comprar uma máquina de 8 mil” continua como análise, não cria `movement`, `payable` nem `reminder`.
2. **Teste 17 — compromisso futuro:**
   - “Tenho que pagar João sexta” oferece lembrete e grava somente após “sim”, com `kind = compromisso`;
   - “Comprei 10 caixas por R$ 1.200, vence dia 20” oferece conta a pagar e grava somente após “sim”;
   - “não” não grava nada.
3. Compromisso sem data pergunta somente o vencimento; compromisso com data sem valor nunca vira conta a pagar.
4. Pagamento já realizado continua em `movements`, sem duplicar em `payables`.
5. Fornecedor conhecido preenche `supplier_id`; desconhecido não é criado automaticamente.
6. `upcoming_bills` lista informações reais e respeita isolamento por negócio.
7. Qualquer mensagem recebida pode anexar vencidos relevantes, inclusive confirmações, mas nunca envia mensagem sem entrada do usuário.
8. Repetição: duas mensagens seguidas não repetem os mesmos vencidos; após o intervalo definido, eles podem reaparecer enquanto continuarem pendentes.
9. Marcar menção não muda `reminders.status` nem `payables.status`.
10. Os três comandos de sistema preservados continuam aceitos e com o mesmo resultado; `__SYSTEM_CHECK_REMINDERS__` deixa de ser reconhecido.
11. Validar typecheck e executar casos reais no endpoint com dados de teste isolados e removidos ao final.

## Riscos e mitigação

- **Confundir compra passada com conta futura:** reforçar exemplos opostos no prompt e cobrir ambos em teste.
- **Prometer gravação sem persistência:** reler o registro antes da resposta de sucesso.
- **Repetir vencidos em toda conversa:** aplicar cooldown por item e gravar a menção somente quando ela foi anexada.
- **Ocultar a resposta principal:** limitar e resumir os vencidos; eles entram somente como bloco secundário.
- **Quebrar confirmações existentes:** usar um novo tipo de oferta, sem alterar `confirm_movements`, correções ou exclusões.
- **Perder lembretes ao avisar:** `sent_at` passa a significar “última menção”; o status não muda automaticamente.
- **Interferir nos outros comandos:** retirar somente o literal, os imports e o ramo de lembretes; testar os três comandos restantes separadamente.

## Decisão antes da implementação

Recomendo mencionar cada item vencido **no máximo uma vez por dia** enquanto continuar pendente. Essa é a única decisão de produto em aberto; se não houver orientação diferente, implementarei esse intervalo diário. O controle de `payables` usará `system_events`, pois a tabela não possui `sent_at` e o escopo proíbe alteração de schema.
