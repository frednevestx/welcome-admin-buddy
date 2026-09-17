# Custo, despesa e relatórios financeiros no WhatsApp

## Objetivo

Adicionar classificação financeira e leitura estruturada de relatórios sem substituir os fluxos atuais. Texto simples, comprovante único, correção, exclusão, auditoria, idempotência e confirmação de um lançamento continuarão usando os caminhos existentes.

## Implementação

1. **Evoluir o schema de lançamentos**
   - Criar uma migration que acrescente `expense_kind` nullable, limitada a `custo` ou `despesa`.
   - Acrescentar `ajuste` ao enum atual de `type`, sem alterar dados antigos.
   - Preservar grants, RLS, views e registros existentes; `expense_kind = NULL` será válido e significará “Não classificado”.
   - Atualizar os tipos gerados após aplicar a migration.

2. **Centralizar cálculos e formatação reutilizáveis**
   - Acrescentar em `src/lib/finance.ts` funções puras para totalizar faturamento, custos, despesas, resultado após custos, resultado operacional e margem sobre faturamento bruto.
   - Criar um utilitário compartilhado `formatDateBR(iso)` com retorno seguro para datas inválidas.
   - Aplicar a formatação somente na apresentação; consultas e gravações continuarão em ISO.

3. **Expandir a interpretação sem mudar o caminho simples**
   - Em `src/lib/whatsapp/interpret.server.ts`, adicionar `expense_kind` ao lançamento raiz e a cada item de `movements`.
   - Ensinar a diferença entre custo, despesa e não classificado, proibindo inferências inseguras.
   - Adicionar o intent `financial_report` e tipos estruturados para vendas, custos, despesas gerais, data e lucro líquido informado.
   - Manter `register_movement` para um lançamento e listas planas sem relação venda→custo.

4. **Extrair relatórios de imagens com fallback atual**
   - Em `src/lib/whatsapp/media.server.ts`, fazer uma primeira leitura JSON da imagem.
   - Aceitar como relatório somente uma estrutura válida com pelo menos duas vendas e custos associados; valores ausentes, inválidos ou ilegíveis não serão completados.
   - Quando não atender ao critério, executar a descrição atual em primeira pessoa e seguir pelo fluxo existente.
   - Manter Google Vision, contingência e gateway Lovable retornando `null` em falha total.
   - Em `src/lib/whatsapp/webhook.server.ts`, transportar o relatório estruturado ao mesmo orquestrador e preservar deduplicação, onboarding, evento cru e histórico.

5. **Preparar lançamentos pendentes e reutilizar a confirmação existente**
   - Criar `src/lib/whatsapp/financial-report.server.ts` para validar/normalizar o relatório, usar as fórmulas de `finance.ts`, criar o resumo solicitado e preparar um lançamento pendente por venda/custo/despesa via `createMovement`.
   - Cada recebimento será `entrada`; custo e despesa serão `saida` com `expense_kind`; categoria desconhecida permanecerá sem categoria e será exibida como “Não classificado”.
   - Usar chaves idempotentes por item do relatório e `confirmed_by_user: false`.
   - Salvar exatamente os IDs criados na oferta já existente `confirm_movements`; “sim” confirma e relê todos, “não” marca todos como descartados.
   - Se o lucro líquido informado divergir do resultado operacional em mais de R$ 0,01, mostrar a divergência antes da confirmação.
   - Preservar falhas parciais com mensagem honesta e nunca afirmar que um item foi salvo sem ID real.

6. **Propagar `expense_kind` pelo serviço central**
   - Em `src/lib/movements/service.server.ts`, aceitar `ajuste` e `expense_kind`, validar combinações permitidas e gravar/auditar o novo campo.
   - No fluxo `register_movement`, encaminhar a classificação sem alterar sua confirmação, deduplicação ou correções atuais.

7. **Formatar todas as datas visíveis no WhatsApp**
   - Atualizar textos em `orchestrator.server.ts` e `edits.server.ts`: confirmações, resumo de ontem, vencidos, contas a pagar, lembretes, próximos vencimentos, descrições e correções.
   - Manter datas ISO apenas em banco, comparações e payloads internos.

8. **Validar incrementalmente**
   - Após a migration: conferir enum, coluna, constraint, view e compatibilidade de inserts antigos.
   - Interpretador: testar custo, despesa, ambiguidade, lista plana e relatório estruturado.
   - Imagem: testar relatório com três vendas/custos, comprovante único e imagem ilegível.
   - Confirmação: provar que antes do “sim” todos estão não confirmados; após “sim”, todos estão confirmados e auditados; após “não”, todos ficam descartados; repetir o mesmo evento sem duplicação.
   - Datas: procurar qualquer ISO ainda interpolado em respostas do WhatsApp.
   - Executar verificação TypeScript e simulação ponta a ponta com limpeza dos dados temporários.

## Arquivos previstos

- `supabase/migrations/<timestamp>_movement_expense_kind_and_adjustment.sql`
- `src/integrations/supabase/types.ts` (regenerado)
- `src/lib/finance.ts`
- `src/lib/format.ts` ou utilitário equivalente já existente
- `src/lib/movements/service.server.ts`
- `src/lib/whatsapp/interpret.server.ts`
- `src/lib/whatsapp/media.server.ts`
- `src/lib/whatsapp/webhook.server.ts`
- `src/lib/whatsapp/financial-report.server.ts` (novo)
- `src/lib/whatsapp/orchestrator.server.ts`
- `src/lib/whatsapp/edits.server.ts`
- `roadmap.md`

## Riscos controlados

- **Enum no banco:** alteração será aditiva e aplicada antes do código que usa `ajuste`/`expense_kind`.
- **Falso relatório:** o limiar de duas vendas com custos associados impede que comprovantes e listas simples mudem de fluxo.
- **Duplicação parcial:** cada item terá chave derivada do evento e posição estável; somente IDs realmente criados entram na confirmação.
- **Confirmação sem auditoria:** a criação continua em `createMovement`; a confirmação existente será preservada e passará pelo serviço central para registrar auditoria de confirmação.
- **Dados antigos:** `NULL` será aceito e exibido como “Não classificado”, sem migração retroativa.
- **Resultado financeiro:** “resultado após custos” e “resultado operacional” ficarão separados; nenhum deles será chamado automaticamente de lucro líquido.

## Decisões adotadas

- O formato estruturado inclui `expenses` opcionais no nível do relatório para representar despesas gerais sem ligá-las artificialmente a uma venda.
- A comparação com `reported_net_profit` usa o resultado operacional quando houver despesas; sem despesas, ele coincide com o resultado após custos.
- Nenhuma decisão adicional é necessária antes da implementação.
