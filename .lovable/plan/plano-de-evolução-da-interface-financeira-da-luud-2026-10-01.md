# Plano de evolução da interface financeira da LUUD

## Objetivo

Fazer o dono do restaurante entender, em poucos segundos, **quanto entrou, quanto saiu, qual foi o resultado, o que mudou e o que exige ação**, sem duplicar a matemática já usada no WhatsApp.

Princípios da implementação:
- banco e código calculam; a interface apenas apresenta;
- nenhuma IA calcula, soma, estima ou altera números;
- toda leitura web passa por funções autenticadas e pelo negócio da sessão;
- nenhuma alteração no fluxo do WhatsApp, orquestrador, comandos, alertas proativos ou regras de isolamento;
- português do Brasil, BRL e datas brasileiras;
- tema, tokens e componentes atuais preservados;
- nenhum link de menu aponta para uma tela inexistente.

## Diagnóstico confirmado do estado atual

- O dashboard busca todos os lançamentos do período no navegador, soma os valores localmente e usa apenas os 12 primeiros na lista. Isso deve ser substituído por resumo no banco + consulta recente limitada.
- `summarize_movements` já entrega entradas, saídas e resultado do filtro inteiro; `filter_movements` já entrega lançamentos paginados.
- `analytics.server.ts` e `engine.server.ts` já calculam comparações, despesas por categoria, fornecedores, margem e alertas, mas retornam estruturas/textos voltados ao WhatsApp e ainda carregam linhas para agregar em código.
- `goals.ts` já calcula corretamente as janelas diária, semanal e mensal, mas ainda não alimenta uma tela web.
- `ui/chart.tsx` e Recharts já estão instalados e não são utilizados.
- Hoje existem telas reais para `/dashboard`, `/movimentacoes`, `/conversas`, `/configuracoes` e `/suporte`. `/categorias` apenas redireciona para Lançamentos. As demais telas propostas ainda não existem.
- O `PlanGate` está propositalmente neutralizado e `usePlan().can()` sempre libera acesso. Portanto, a política de planos está mapeada, mas não é aplicada de fato. Isso precisa de uma decisão de produto antes de reativar bloqueios.
- `payables`, `reminders` e `goals` têm RLS ativa. O uso atual confirmado cria contas e lembretes pendentes pelo WhatsApp; não existe hoje um fluxo web consolidado para quitar/concluir.

## Arquitetura proposta

### 1. Camada de dados e cálculos

Criar uma fachada autenticada em `src/lib/dashboard/dashboard.functions.ts`:
- `getDashboardOverview({ from, to })`
- `getDashboardAttention({ from, to })`
- `getRecentMovements({ limit })`

Todas usam `requireSupabaseAuth`, obtêm o `restaurant_id` do usuário no servidor e nunca aceitam outro negócio como autoridade. O retorno será um DTO numérico e tipado, sem texto financeiro produzido por IA.

Separar cálculos reaproveitáveis dos textos do WhatsApp:
- extrair de `analytics.server.ts` funções de fatos estruturados, mantendo as funções textuais atuais como adaptadores para o WhatsApp;
- reutilizar `calculateFinancialBreakdown` para margem e resultado quando a mesma definição financeira for aplicável;
- reutilizar `currentGoalWindow` para metas;
- preservar `detectFinancialAlerts`, `shouldSend` e `recordEvent` sem alterações de comportamento.

Organização sugerida:
```text
src/lib/dashboard/
  dashboard.functions.ts      # funções autenticadas chamadas pela web
  dashboard.server.ts         # composição das consultas e DTOs
  dashboard.types.ts          # contratos numéricos da interface
src/lib/analytics/
  financial-facts.server.ts   # fatos estruturados compartilhados
src/lib/payables/
  payables.functions.ts       # leitura e futuras ações web
src/lib/goals/
  goals.functions.ts          # leitura, progresso e futuras ações web
```

### 2. Período global

Evoluir `use-period` para funcionar sobre um `PeriodProvider` montado no layout autenticado:
- estado único para todas as telas financeiras;
- persistência no navegador com chave versionada;
- padrão inicial de 30 dias;
- opções alinhadas: Hoje, 7 dias, 30 dias, Este mês, Mês anterior e Personalizado;
- período exposto no cabeçalho e consumido por Dashboard, Comparativos, Evolução e Fornecedores;
- cada tela pode declarar se usa o período global ou uma janela própria. Metas mantém sua janela diária/semanal/mensal.

O seletor atual será reaproveitado, mas adaptado para celular: popover no desktop e painel inferior no mobile. A seleção personalizada será empilhada em telas estreitas.

### 3. Ação global “Lançar”

Extrair o formulário já existente de Lançamentos para um `GlobalMovementDialog` no layout autenticado:
- usa o mesmo `MovementForm` e as mesmas funções de gravação/auditoria;
- botão no cabeçalho desktop;
- botão compacto ou ação central na navegação inferior mobile;
- ao concluir, invalida os caches de dashboard, resumo e lançamentos;
- nenhuma escrita direta em `movements` pela interface.

### 4. Navegação responsiva

Reorganizar o sidebar por tarefa, mantendo o modo recolhido:
- **Visão geral:** Visão geral;
- **Financeiro:** Lançamentos, Contas a pagar, Categorias, Fornecedores;
- **Análises:** Comparativos, Evolução, Metas;
- **Conta:** Negócio e Ajuda;
- **Admin:** preservado apenas para administradores.

Itens fora do escopo — Integrações, Lucro por plataforma, Alertas e Assistente IA — não terão links até suas telas existirem. Se desejado, poderão aparecer desabilitados com “Em breve”, sem navegação.

No celular, criar `MobileBottomNav` com até cinco destinos: Visão geral, Lançamentos, Lançar, Contas e Mais. “Mais” abre um painel com as demais rotas disponíveis. O sidebar mobile atual deixa de ser a navegação principal, mas continua disponível para conta, ajuda e administração.

### 5. Controle de planos

Criar uma configuração única de navegação/rotas baseada em `ROUTE_MIN_PLAN`, usada pelo sidebar e pela navegação mobile. Cada rota nova será envolvida por um controle de plano e terá metadados próprios.

Como o controle atual está neutralizado, a entrega será dividida:
1. estruturar todos os itens com `minPlan`, cadeado e estado de disponibilidade;
2. manter o comportamento gratuito atual até a decisão de produto;
3. se aprovado reativar cobrança/bloqueio, fazer `usePlan` ler o plano efetivo do servidor e adicionar guarda também no carregamento da rota — nunca apenas esconder o menu no navegador.

## Fase 1 — Dashboard, menu e cabeçalho

### Estrutura visual do dashboard

#### Faixa 1 — KPIs
Quatro `FinancialKpiCard`:
- Entradas;
- Saídas;
- Resultado;
- Margem.

Cada card mostra valor atual, variação contra o período anterior equivalente e mini-tendência acessível. Sem animações que mudem os números e sem esconder “sem base de comparação”.

#### Faixa 2 — Evolução e composição
- `CashflowEvolutionChart`: linha/área de entradas e saídas por dia, agregando por semana quando o período for longo;
- `TopExpenseCategoriesChart`: cinco maiores categorias de saída, incluindo “Sem categoria”.

Usar `ChartContainer`, tooltip e legenda existentes, cores semânticas `chart-*`, altura estável e alternativa textual para acessibilidade. No mobile os gráficos ficam empilhados e não dependem de interação por hover.

#### Faixa 3 — Precisa de atenção
`AttentionPanel` com itens priorizados, no máximo cinco visíveis:
1. contas vencidas;
2. contas a vencer no horizonte escolhido;
3. categoria com maior alta relevante;
4. quantidade/valor sem categoria;
5. progresso da meta mensal;
6. um insight já calculado pela LUUD.

Cada item possui gravidade, valor/data quando aplicável e ação clara. O botão “Perguntar no WhatsApp” apenas abre a conversa com um texto pré-preenchido; não dispara mensagem automaticamente.

#### Faixa 4 — Lançamentos recentes
`RecentMovementsCompact` reutiliza os rótulos, cores, formatação e modelo visual de Lançamentos, limitado a 8–12 itens. Link “Ver todos” leva a `/movimentacoes`.

### Estado de primeiro acesso

`FirstStepsChecklist` substitui gráficos vazios quando não há lançamentos ativos:
- WhatsApp conectado/verificado;
- primeiro lançamento existente;
- integração de delivery conectada.

Enquanto Integrações estiver fora do escopo, “Conectar iFood” será apresentado somente se houver um destino válido já disponível; caso contrário, ficará sem ação ou será ocultado conforme decisão de produto. O checklist é derivado de dados reais, sem estado paralelo.

### Origem de cada indicador

| Indicador | Fonte planejada | Observação |
|---|---|---|
| Entradas, saídas e resultado | `summarize_movements` via função autenticada | Agregação no banco; não busca lançamentos brutos |
| Margem | entradas/resultado do resumo + fórmula de `calculateFinancialBreakdown` | Exibir 0 ou “sem faturamento” quando entradas = 0, conforme decisão |
| Variações | resumo do período atual e `previousPeriod()` | Duas agregações pequenas no banco |
| Mini-tendência | mesma série diária/semanal do gráfico | Nenhuma consulta adicional |
| Evolução entradas x saídas | nova consulta agregada por data | Preferência: RPC somente leitura; alternativa temporária abaixo |
| Top 5 categorias | fatos estruturados extraídos de `getTopExpenses` | Preferência: agregação no banco por categoria |
| Categoria que mais subiu | regra de `detectFinancialAlerts`/comparação estruturada | Sem IA; limiar e base mantidos em código |
| Sem categoria | contagem e soma filtradas no servidor | Consulta agregada, sem baixar linhas |
| Contas vencidas/a vencer | `payables` e `reminders`, filtrados por negócio/status/data | `reminders` não têm valor |
| Meta mensal | `goals` ativa + `currentGoalWindow('mensal')` + resumo de entradas da janela | Sem cálculo no componente |
| Insight LUUD | `system_events` recente ou fato de maior prioridade | Só leitura; não aciona envio nem altera `sent_at` |
| Lançamentos recentes | `filter_movements` com limite 8–12 | Ordenação já centralizada |
| Checklist | identidade WhatsApp + contagem de movimentos + integração conectada | Leituras booleanas limitadas |

### Performance

Uma consulta de dashboard deve retornar dados compactos, e não os lançamentos completos:
- executar em paralelo resumo atual, resumo anterior, atenção, meta e recentes;
- cache por `restaurantId + período` com TanStack Query;
- limitar recentes e itens de atenção;
- invalidar apenas as chaves afetadas após lançamento, quitação ou edição;
- usar skeletons por faixa para evitar bloquear a página inteira;
- não usar `fetchFinanceSummary` atual no dashboard, pois ele baixa vendas e movimentos completos no navegador;
- não chamar várias funções textuais do WhatsApp separadamente, pois elas repetem leituras.

**Decisão técnica pendente:** o banco não possui hoje RPC confirmada para série por data, top categorias e ranking de fornecedores. A solução recomendada é uma migração pequena com funções `SECURITY INVOKER`, agregadas e somente leitura. Sem autorização para migração, a primeira versão pode agregar no servidor selecionando apenas campos mínimos e impondo janela máxima, mas isso é uma solução intermediária menos escalável.

## Fase 2 — Contas a pagar e Metas

### `/contas-a-pagar`

Componentes:
- `PayablesSummary`: total vencido, a vencer e pago no período;
- `PayablesFilters`: status, vencimento, fornecedor e busca;
- `PayablesList`: tabela desktop e cartões mobile;
- `PayableForm`: descrição, valor, vencimento e fornecedor;
- confirmação de quitação e estado vazio.

Reaproveitamento:
- tabelas `payables`, `reminders` e `suppliers`;
- formatação de BRL/data;
- padrão de server functions e auditoria usado em Lançamentos;
- cartões/listas responsivos já validados em `/movimentacoes`.

Regras propostas:
- vencida = `status='pending'` e `due_date < hoje`;
- a vencer = `status='pending'` e `due_date >= hoje`;
- paga = `status='paid'`;
- lembretes sem valor aparecem em uma seção “Lembretes e compromissos”, não como contas pagas;
- quitar uma conta deve, preferencialmente, criar uma saída pelo serviço central e preencher `paid_movement_id`, evitando divergência entre contas e caixa.

Isso não exige schema novo, mas a semântica exata de quitação precisa ser aprovada antes da implementação.

### `/metas`

Componentes:
- `GoalOverview` com meta ativa e progresso;
- `GoalProgressCard` para diária, semanal e mensal;
- `GoalForm` para criar/editar/ativar meta;
- histórico simples de metas inativas, se houver dados.

Dados:
- janela por `currentGoalWindow`;
- realizado por `summarize_movements` considerando entradas da janela;
- percentual, restante e ritmo calculados em função de servidor pura e tipada;
- barra via componente `Progress` existente.

Não haverá projeção por IA. Caso seja exibida projeção linear, a fórmula e seus limites serão explícitos no código e testados.

## Fase 3 — Análises

### `/comparativos`
- período atual x anterior equivalente;
- entradas, saídas, resultado e margem;
- variação absoluta e percentual;
- categorias que mais subiram/caíram;
- reaproveita `previousPeriod`, `comparePeriods` e fatos estruturados extraídos de `getBusinessOverviewFacts`.

### `/evolucao`
- série temporal de entradas, saídas e resultado;
- agrupamento automático diário/semanal/mensal conforme amplitude;
- tabela acessível opcional abaixo do gráfico;
- mesma função agregada usada pelo dashboard, sem consulta duplicada.

### `/fornecedores`
- total gasto, quantidade, ticket médio e última compra;
- ranking e detalhe por fornecedor;
- reaproveita regras de `getSupplierAnalysis` e `getSupplierSpendFacts` em retorno estruturado;
- não altera cadastros vindos do WhatsApp; edições futuras continuam fora desta fase, salvo decisão contrária.

## Componentes compartilhados previstos

```text
src/components/app/
  app-header.tsx
  mobile-bottom-nav.tsx
  global-movement-dialog.tsx
  plan-aware-nav-item.tsx
src/components/dashboard/
  financial-kpi-card.tsx
  cashflow-evolution-chart.tsx
  top-expense-categories-chart.tsx
  attention-panel.tsx
  first-steps-checklist.tsx
  recent-movements-compact.tsx
src/components/finance/
  period-provider.tsx
  period-selector-responsive.tsx
  empty-financial-state.tsx
  financial-status-badge.tsx
src/components/payables/
  payable-form.tsx
  payables-list.tsx
  payables-summary.tsx
src/components/goals/
  goal-form.tsx
  goal-progress-card.tsx
```

Os componentes de rota permanecem responsáveis por composição; consultas, fórmulas e normalização ficam em `src/lib`.

## Ordem de entrega

### Entrega 0 — Contratos e decisões
1. confirmar definições financeiras e decisões de produto abaixo;
2. definir DTOs numéricos e chaves de cache;
3. decidir se as três agregações adicionais no banco estão autorizadas;
4. definir comportamento real dos planos.

### Entrega 1 — Fundação da Fase 1
1. `PeriodProvider` e seletor responsivo;
2. cabeçalho com “Lançar” global;
3. configuração única de navegação, sidebar reagrupado e navegação inferior;
4. sem adicionar rotas ainda inexistentes ao menu.

### Entrega 2 — Dashboard
1. funções autenticadas e agregações;
2. KPIs e estados de carregamento/erro;
3. gráficos;
4. atenção, meta e insight;
5. lançamentos recentes e primeiro acesso.

### Entrega 3 — Fase 2
1. Contas a pagar e compromissos;
2. fluxo seguro de quitação;
3. Metas e progresso;
4. ativar seus itens no menu somente quando cada rota estiver pronta.

### Entrega 4 — Fase 3
1. Comparativos;
2. Evolução;
3. Fornecedores;
4. ativar os itens correspondentes após validação individual.

## Riscos e mitigação

- **Definições conflitantes de “resultado/margem”:** `finance.ts` considera vendas e taxas de plataforma, enquanto o dashboard atual usa entradas e saídas de `movements`. Mitigar definindo uma fonte canônica antes da implementação e exibindo o conceito correto no rótulo.
- **`movements_current` versus `movements`:** analytics/proatividade usam a view, enquanto a tela reformada usa `movements` com status. Mitigar validando equivalência e centralizando uma fonte para a web sem alterar o WhatsApp.
- **Carga em negócios com muitos lançamentos:** evitar agregação no navegador; preferir RPCs agregadas e limitar janelas/retornos.
- **Duplicação de consultas:** compor uma resposta de dashboard e compartilhar séries entre cards e gráficos.
- **Planos apenas visuais:** ocultar menu não protege rota. Se os bloqueios voltarem, validar o plano no servidor e no acesso à rota.
- **Quitação duplicar despesas:** usar operação idempotente que cria/vincula no máximo um movimento e respeita `paid_movement_id`.
- **Reminders não equivalem a payables:** mantê-los visualmente separados e não inventar valor/status de pagamento.
- **Interferência no WhatsApp:** novas funções apenas leem ou usam serviços centrais; não alterar `sent_at`, `system_events`, ofertas pendentes ou contexto conversacional ao abrir a web.
- **Timezone:** todas as janelas de UI usam horário de São Paulo e helpers existentes; não usar `toISOString()` diretamente para “hoje”.
- **Mobile congestionado:** máximo de cinco ações na barra inferior, gráficos empilhados e alturas estáveis, sem tabelas horizontais obrigatórias.
- **Links quebrados:** rota e arquivo são criados no mesmo lote; itens só entram no menu depois da rota existir.

## Critérios de teste

### Fase 1
- KPIs iguais aos resultados das funções do banco para atual e anterior;
- margem correta com entradas zero, resultado negativo e valores decimais;
- dashboard não solicita a lista completa de lançamentos;
- gráfico e top categorias batem com consultas de referência;
- estado vazio aparece apenas sem lançamentos ativos;
- checklist reflete dados reais;
- seletor persiste ao navegar entre telas e após recarregar, conforme decisão;
- “Lançar” cria pelo serviço central e atualiza dashboard/Lançamentos;
- nenhum item do menu leva a 404;
- desktop, 458 px e telas intermediárias sem sobreposição/rolagem horizontal;
- tema claro/escuro, teclado, leitores de tela e redução de movimento;
- isolamento: dois usuários de negócios diferentes nunca recebem dados cruzados.

### Fase 2
- classificação exata de pendente/vencida/paga no limite da data de hoje;
- quitação não duplica movimento em clique/reenvio;
- `paid_movement_id` e status permanecem consistentes;
- lembrete sem valor nunca aparece como conta paga;
- metas diária/semanal/mensal respeitam limites e virada de período;
- progresso usa entradas da janela correta e não passa visualmente de 100%, embora o valor real possa superar a meta;
- CRUD respeita RLS e negócio da sessão.

### Fase 3
- comparação usa período anterior com igual quantidade de dias;
- série soma exatamente o resumo do mesmo filtro;
- top categorias e fornecedores empatam com consultas de referência;
- “Sem categoria” e “Sem fornecedor” têm tratamento explícito;
- janelas longas não causam resposta excessiva nem travamento do gráfico;
- todas as rotas têm metadados próprios, guarda de autenticação e controle de plano.

Em cada fase: testes unitários das fórmulas, testes das funções autenticadas, fluxo real no navegador com sessão, conferência mobile/desktop e verificação de erros de execução e build.

## Decisões de produto necessárias antes da implementação

1. **Resultado e margem:** usar apenas entradas/saídas de Lançamentos, ou o modelo de faturamento + taxas de plataformas de `finance.ts`? Recomendo Lançamentos enquanto Integrações/Lucro por plataforma estiverem fora do escopo.
2. **Planos:** manter tudo liberado como hoje e mostrar apenas indicação, ou reativar bloqueio real por Básico/Pro/Premium? Recomendo não reativar cobrança/bloqueio nesta entrega sem uma regra comercial aprovada.
3. **Agregações:** autorizar uma migração somente leitura para evolução, categorias e fornecedores? Recomendo sim para evitar baixar todos os lançamentos.
4. **Contas quitadas:** ao marcar como paga, criar automaticamente uma saída vinculada? Recomendo sim, com confirmação e idempotência.
5. **Lembretes:** exibir separados como compromissos e permitir “Concluir”, ou apenas leitura? Recomendo separados e concluíveis, sem chamá-los de pagos.
6. **Meta:** `target_amount` representa meta de entradas/faturamento? Recomendo assumir entradas registradas em `movements`.
7. **Período persistente:** lembrar apenas durante a sessão ou entre acessos no mesmo aparelho? Recomendo entre acessos, com opção padrão de 30 dias.
8. **WhatsApp:** qual número/link oficial e qual texto pré-preenchido deve ser usado em “Perguntar no WhatsApp”?
9. **Itens futuros no menu:** esconder até ficarem prontos ou mostrar “Em breve”? Recomendo esconder no mobile e mostrar “Em breve” apenas no desktop se houver valor de descoberta.
10. **Categorias:** manter como acesso ao gerenciador dentro de Lançamentos ou transformar `/categorias` em tela própria reutilizando o mesmo gerenciador? Recomendo tela própria fina, sem duplicar lógica.
