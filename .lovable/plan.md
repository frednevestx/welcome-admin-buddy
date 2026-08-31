# Orquestrador conversacional da LUUD no WhatsApp

Objetivo: sair de "classificador de intents" para uma assistente que entende o que o usuário quer, usa o contexto recente, consulta dados reais e escolhe a próxima ação — reaproveitando tudo que já existe.

## Arquitetura atual (auditada)

- `src/routes/api/public/whatsapp/gemini.ts` (632 linhas) faz TUDO: prompt, chamada Gemini (com fallback Lovable AI), memória pendente, consultas, gravação de movimento, saudação, insight. Um único bloco `POST` com uma cascata de `if (parsed.intent === ...)`.
- Interpretação: 1 chamada de IA, JSON fixo com `intent` entre 10 valores. Não recebe histórico de mensagens — só a mensagem atual + a operação pendente.
- Memória: `conversation_state.pending` (jsonb, TTL 30 min) guarda apenas operação incompleta ou `offer: "daily_summary"`. Histórico bruto fica em `whatsapp_raw_events` (mensagem + `interpreted_json`), hoje só usado para "primeira interação do dia" e confirmação.
- Confirmação: movimento é gravado com `confirmed_by_user = false` e o "sim/não" é resolvido por `findPendingConfirmation` + `parseYesNo`.
- Analytics: `src/lib/proactive/analytics.server.ts` (`comparePeriods`, `getTopExpenses`, `getSupplierAnalysis`) — todos determinísticos, sem IA.
- Insights: `engine.server.ts` (detecção matemática + `shouldSend` com dedupe/cooldown 7 dias) e `insights.server.ts` (`pickInsightForReply`, marca `status = 'shown'`). `commands.server.ts` mantém os `__SYSTEM_*__` (crons pausados).

## Lacunas encontradas

1. **Sem contexto de conversa.** A IA nunca vê as mensagens anteriores, então "quanto já paguei pra ele?" não resolve o "ele".
2. **Fornecedor ignorado.** `movements.supplier_id` existe e `getSupplierAnalysis` depende dele, mas o fluxo do WhatsApp nunca preenche — a análise por fornecedor fica sempre vazia.
3. **Forma de pagamento ignorada.** `movements.payment_method` existe e nunca é preenchido pelo WhatsApp.
4. **Sem consulta por fornecedor específico** ("quanto gastei com João?") nem por categoria específica ("quanto gastei com energia?"). `query_summary` só soma o período todo.
5. **Sem análise gerencial.** "como está minha empresa?", "onde estou perdendo dinheiro?", "posso comprar isso?" caem em `question`/`other` e viram texto genérico da IA, sem dados.
6. **Sem distinção DADO / DECISÃO / COMPROMISSO FUTURO.** "estou pensando em comprar uma máquina de 8 mil" e "tenho que pagar João sexta" podem virar despesa gravada.
7. **Respostas engessadas.** `GREETING_REPLY` e `FALLBACK_REPLY` são strings fixas; textos de confirmação são template (`"Entendi: X de R$Y em Z. Confirma o registro? (sim/não)"`).
8. **Contas a pagar não existem no schema.** Confirmado por consulta: `movements` só tem `movement_date`; nenhuma coluna de vencimento. `reminders` tem `due_date`/`due_time`/`status`, mas é lembrete textual, não conta a pagar com valor/fornecedor.

## Nova camada proposta

Um orquestrador fino, em dois passos, sem trocar nada do que já funciona:

```text
WhatsApp
  -> resolve negócio + contato (existente)
  -> carrega contexto: pending + últimas ~6 mensagens + entidades citadas
  -> INTERPRETAÇÃO (1 chamada IA): intent enriquecida + entidades
  -> ORQUESTRADOR: decide a ação
       registrar | completar pendência | confirmar/cancelar
       consultar | analisar | decidir(simulação) | compromisso futuro
       conversa | dado inexistente
  -> executa via funções EXISTENTES (analytics/engine/movements)
  -> REDAÇÃO (1 chamada IA opcional): fatos calculados -> texto humano
  -> resposta + no máximo 1 insight
```

Regra mantida: **todo número vem do backend**; a IA só interpreta e redige.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/whatsapp/orchestrator.server.ts` | **novo** — decide a ação a partir da interpretação + contexto e devolve `{ reply, sideEffects }` |
| `src/lib/whatsapp/interpret.server.ts` | **novo** — prompt novo (com histórico e entidades) + as chamadas Google/Lovable movidas de `gemini.ts` |
| `src/lib/whatsapp/context.server.ts` | **novo** — leitura/escrita do contexto em `conversation_state` (pending + tópico + entidades) e histórico recente de `whatsapp_raw_events` |
| `src/lib/whatsapp/reply.server.ts` | **novo** — redação natural a partir de fatos (reusa o padrão de `writeMessage`), com fallback determinístico |
| `src/lib/proactive/analytics.server.ts` | **estender** — `getSupplierSpend(nome)`, `getCategorySpend(nome, período)`, `getBusinessOverview()` (fatos, não texto) |
| `src/routes/api/public/whatsapp/gemini.ts` | **encolher** — vira roteador: resolve negócio/contato, grava `whatsapp_raw_events`, chama o orquestrador, devolve `{ reply }`. Mantém `__SYSTEM_*__`, `resolveRestaurantId`, dedupe/duplicidade e o contrato de resposta atual |
| `src/lib/proactive/engine.server.ts`, `insights.server.ts`, `commands.server.ts` | **não mudam** (só passam a ser chamados pelo orquestrador) |

## Comportamentos novos

- **Fornecedor:** a interpretação extrai `supplier_name`. O backend faz match em `suppliers` por nome (case-insensitive, com tolerância a primeiro nome). Achou → usa o `supplier_id`. Não achou → grava o movimento normalmente com o nome na `description` e pergunta na confirmação se deve cadastrar como fornecedor. **Nunca cria fornecedor sem o "sim".**
- **Forma de pagamento:** se o usuário disser PIX/dinheiro/cartão/boleto/transferência, vai para `payment_method`. Se não disser, não pergunta.
- **Consultas específicas:** "quanto gastei com João?" e "quanto gastei com energia?" passam a somar por fornecedor/categoria no período pedido.
- **Análise gerencial:** "como está minha empresa?", "onde estou gastando demais?", "o que posso melhorar?" viram um pacote de fatos (resultado do período, variação vs. período anterior, top categorias, fornecedor mais caro) e a IA redige FATO → INTERPRETAÇÃO → SUGESTÃO, com no máximo uma recomendação.
- **Decisão futura:** "estou pensando em comprar uma máquina de 8 mil" → **não grava**; responde com o resultado real recente e o peso desse valor, e oferece a análise.
- **Compromisso futuro:** "tenho que pagar João sexta" → **não grava movimento**; resolve a data relativa em código e oferece criar um lembrete em `reminders` (só cria após confirmação).
- **Saudação e fallback:** deixam de ser string fixa; a IA redige com variação, mantendo a lógica de primeira interação do dia e a oferta do resumo de ontem.
- **Troca de assunto com pendência aberta:** se a mensagem nova não completa a pendência, o orquestrador responde o novo assunto e mantém a pendência viva (dentro do TTL) em vez de misturar.

## Banco de dados

**Nenhuma migração nesta etapa.** `conversation_state.pending` é jsonb — o contexto ampliado (tópico atual, entidades citadas, oferta pendente) cabe lá sem alterar schema.

Evolução recomendada, **não incluída** (precisa de autorização separada): tabela `payables` (`restaurant_id`, `supplier_id`, `description`, `amount`, `due_date`, `status`, `paid_movement_id`) para contas a pagar/receber reais. Até existir, a LUUD continua dizendo com honestidade que não tem vencimentos e oferece lembrete.

## Testes (executados contra o endpoint real, com dados de teste removidos no fim)

Formato de cada caso: mensagem → interpretação esperada → grava? → confirma? → resposta esperada → insight?

| # | Mensagem | Esperado | Grava | Insight |
|---|---|---|---|---|
| 1 | "Oi" | conversa; saudação variada | não | não |
| 2 | "Bom dia" (1ª do dia) | saudação + oferta do resumo de ontem | não | não |
| 3 | "Paguei 300 de energia." | saída, categoria Energia, hoje | sim, pendente de confirmação | não |
| 4 | "Comprei material por 850." | saída, Insumos/Material | sim, pendente | não |
| 5 | "Comprei material do João por 850." | idem + `supplier_name: João`; match ou oferta de cadastro | sim, pendente | não |
| 6 | "Paguei João ontem." | falta valor → pergunta só o valor | não | não |
| 7 | "Sim" | confirma o último movimento pendente | `confirmed_by_user = true` | não |
| 8 | "Não" | descarta (`status = superseded`) | não grava | não |
| 9 | "Quanto gastei esse mês?" | consulta período | não | pode anexar 1 |
| 10 | "Quanto gastei com João?" | consulta por fornecedor | não | pode anexar 1 |
| 11 | "Qual foi meu maior gasto?" | `getTopExpenses` | não | não |
| 12 | "Como foi esse mês comparado ao anterior?" | `comparePeriods` | não | não |
| 13 | "Como está minha empresa?" | análise gerencial com fatos reais | não | embutido na análise |
| 14 | "Onde estou gastando demais?" | top categorias + interpretação | não | embutido |
| 15 | "O que posso melhorar?" | 1 recomendação baseada em dado | não | embutido |
| 16 | "Estou pensando em comprar uma máquina de 8 mil." | decisão → análise, sem gravar | **não** | não |
| 17 | "Tenho que pagar João sexta." | compromisso futuro → oferta de lembrete | **não** grava movimento | não |
| 18 | "Quanto já paguei para ele?" | resolve "ele" = João pelo contexto | não | não |
| 19 | "Estou gastando muito com combustível." | checa dado real; se houver, fato+sugestão; se não, diz que não tem | não | não |
| 20 | Mensagem fora do contexto financeiro | resposta natural, redireciona | não | não |
| 21 | Duas mensagens completando uma operação | pendência mesclada e registrada | sim, pendente | não |
| 22 | Troca de assunto no meio da pendência | responde o novo assunto, pendência preservada | não | não |
| 23 | "Paguei 420 pro Carlos de embalagem no pix" | fornecedor + categoria + valor + `payment_method = pix` | sim, pendente | não |
| 24 | Mensagem sem valor | pergunta só o valor | não | não |
| 25 | Mensagem sem data | assume hoje, sem perguntar | sim, pendente | não |
| 26 | "ontem" / "amanhã" / "segunda" | data relativa resolvida em código | conforme o caso | não |

Para cada teste vou reportar a resposta bruta real do endpoint, não "passou".

## Riscos de regressão e mitigação

- **Regressão no registro por WhatsApp** (maior risco): a lógica de `classifyMovement` (new/update/duplicate), `confirmed_by_user` e `source_ref` é movida sem alteração de comportamento; os casos 3–8 e 21–25 cobrem isso.
- **Custo/latência de uma 2ª chamada de IA para redigir:** só acontece em análise gerencial e saudação/fallback; tudo mais segue com uma chamada. Existe fallback determinístico se a IA falhar.
- **Contrato do TalkToMe:** a resposta continua `{ "reply": "..." }` e os `__SYSTEM_*__` continuam `{ action: ... }`.
- **Fornecedor errado por match de nome:** match conservador, e criação de fornecedor só com confirmação explícita.
- **Insight repetido:** dedupe/cooldown de `engine.server.ts` intacto; segue no máximo 1 por resposta.
- **Isolamento de negócio:** todas as novas consultas continuam filtrando por `restaurant_id`. Nada de auth, integrações, importações, dashboard ou app web é tocado.
