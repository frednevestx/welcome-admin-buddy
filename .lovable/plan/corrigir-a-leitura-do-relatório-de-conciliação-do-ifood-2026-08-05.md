# Corrigir a leitura do relatório de conciliação do iFood

## O que está errado (confirmado na sua planilha)

O arquivo que você enviou é o **Relatório de Conciliação** do iFood: 468 linhas, mas cada linha é um *lançamento financeiro* (cobrança, retenção, subsídio, entrada financeira), não um pedido. Existem apenas **59 pedidos** no mês.

O importador atual procura colunas por nome parecido e acabou casando as colunas erradas:

- "Pedidos" não foi encontrado, então ele contou **1 pedido por linha** → 467 pedidos (o correto é 59).
- Como coluna de valor líquido ele casou `data_repasse_esperada` (uma **data**), lendo "2026-07-08" como o número **2026** em cada linha → 467 x 2026 = os **R$ 946.154,40** que apareceram na tela.
- Comissão casou com `percentual_taxa` (que é percentual, não valor), e taxas/cupons ficaram zerados.

Números corretos desse arquivo:

- Pedidos: 59
- Faturamento bruto (soma da cesta por pedido): R$ 3.329,90
- Repasse líquido (soma da coluna `valor`): R$ 1.743,93

## O que será feito

1. **Detectar o formato do arquivo** antes de interpretar: se as colunas incluírem `fato_gerador`, `tipo_lancamento`, `valor` e `pedido_associado_ifood`, usar um leitor específico de conciliação do iFood. Planilhas simples "por dia" continuam funcionando como hoje.
2. **Leitor de conciliação (novo)**, agrupando por data do pedido:
   - Pedidos = quantidade de pedidos distintos no dia (não de linhas).
   - Vendido (bruto) = valor da cesta de cada pedido distinto.
   - Comissão = lançamentos de comissão/taxa de serviço (Retenção).
   - Taxas = entregas/frete e taxas de pagamento (Cobrança de frete).
   - Cupons = promoções custeadas pela loja (Subsídio negativo); promoção custeada pelo iFood entra como crédito, não como custo da loja.
   - Cancelamentos = lançamentos de `fato_gerador = Cancelamento`.
   - A receber (líquido) = soma da coluna `valor` do dia, que é exatamente o repasse do iFood.
3. **Nunca mais ler data como valor**: se a coluna casada contiver data/texto não monetário, ela é descartada; e colunas de percentual (`percentual_taxa`) são explicitamente ignoradas para comissão.
4. **Conferência na tela**: mostrar no resumo, além de Dias/Pedidos/Total vendido, também "Total a receber", para você bater direto com o relatório do iFood antes de confirmar a importação.

## Detalhes técnicos

- Alterações concentradas em `src/routes/_authenticated/importacoes.tsx`: `parseFile` passa a rotear entre `parseIfoodConciliation` (novo) e o leitor genérico atual.
- Agrupamento por `data_criacao_pedido_associado` (fallback `data_faturamento`), pedidos via `Set` de `pedido_associado_ifood`, bruto via `valor_cesta_final` do primeiro lançamento de cada pedido.
- Classificação por `tipo_lancamento` + `descricao_lancamento` normalizados (sem acento, minúsculo), com sinais absolutos nos campos de custo.
- `toNumber` passa a rejeitar strings que se pareçam com data (`AAAA-MM-DD`, `DD/MM/AAAA`) e valores sem dígito monetário.
