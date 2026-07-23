Esse pedido é grande — vou dividir em fases entregáveis para você ver evolução rápida e evitar quebrar o que já está bom. Podemos ajustar prioridades.

## Fase 1 — Landing + tema claro + Instagram (rápido)

1. **Depoimentos com "fotos" dos donos**
   - Gerar 3 avatares fake (rosto neutro, estilo fotografia) via `imagegen` e usar nos cards de prova social junto do nome, cidade, métrica e estrelas que já existem.
2. **Tema claro legível**
   - Auditar `src/styles.css`: no `.light`, aumentar contraste de `--foreground`, `--muted-foreground` e remover gradientes com texto verde-sobre-verde. Garantir que headings usam `text-foreground` puro no light e o efeito neon fica só no dark.
   - A landing pública fica sempre no visual dark premium (não segue o toggle) — o toggle passa a valer só depois do login, como você pediu.
3. **Instagram**
   - Adicionar link `https://www.instagram.com/luud.app/` no footer da landing e no rodapé do sidebar autenticado, com ícone.

## Fase 2 — Movimentações por categoria fixa

Hoje a página aceita categoria livre. Vou:
- Definir listas fixas no front:
  - Entradas: Venda WhatsApp, Venda Balcão, Outros Recebimentos
  - Saídas: Ingredientes, Embalagens, Funcionários, Aluguel, Energia, Marketing, Impostos, Taxas Bancárias, Manutenção, Outros
  - Transferências: Sangria de Caixa
- No form de "Nova movimentação": primeiro escolhe tipo (Entrada/Saída/Transferência), depois o select de categoria mostra só as opções desse tipo.
- Manter compatível com a tabela `categorias` atual (semeando automaticamente essas categorias no primeiro uso do restaurante).

## Fase 3 — Renomear "Importações" + Planilha Inteligente

- Renomear no menu/rota: **Importações → Entrada de Vendas** (ou "Registrar Vendas" — me diga se prefere outro). Mantém o import iFood/99 como abas dentro dela.
- Nova aba **"Planilha inteligente"**:
  - Grid editável (linha a linha) com colunas: Descrição do pedido, Cliente, Telefone, Quantidade, Valor, Forma de pagamento, Data, Cidade, Observação.
  - Salva automaticamente linha a linha (debounce) em uma tabela nova `pedidos_manuais`.
  - Ao salvar, uma server function chama a IA (Lovable AI) para: normalizar cliente (cria/atualiza em `clientes`), criar registro em `movimentacoes` como Venda WhatsApp/Balcão conforme forma de pagamento, atualizar dashboard.

## Fase 4 — Nova página **Clientes** (Premium)

- Migração: tabelas `clientes` (nome, telefone, cidade, canal, primeiro_pedido, ultimo_pedido) e `cliente_pedidos` (referência a movimentação/pedido + produtos). RLS por restaurante + GRANTs.
- Página com:
  - Cards: Total, Ativos, Inativos, Novos no mês, Ticket médio, Pedidos/cliente, Cliente mais fiel, Maior comprador.
  - Listas: Mais gastam, Sumiram (>30 dias), Novos.
  - Perfil do cliente ao clicar: telefone, cidade, primeiro/último pedido, total gasto, ticket médio, produtos favoritos (%), canal, quantidade de pedidos.
  - Sugestões da IA por cliente ("Envie promoção de X para João").
- Cruzamento com a Planilha Inteligente da Fase 3.
- Marcada como recurso **Premium** via `PlanGate`.

## Fase 5 — Dashboards

- **Dashboard comercial**: adicionar cards Pedidos do mês, Ticket médio, Clientes novos, Recorrentes %, Maior venda, Produto campeão, Menos vendido, Nunca vendidos, Em crescimento — puxando de movimentações + pedidos + clientes.
- **Evolução**: reorganizar em blocos (Financeiro / Comercial / Clientes) com dados vindos das novas tabelas, e destacar quais gráficos são PRO/Premium.
- Reorganização geral do sidebar em grupos: Operação (Movimentações, Vendas, Clientes), Análise (Dashboard, Evolução, Comparativos, Relatórios PRO), Inteligência (Alertas, IA Premium), Configurações.

## Fora de escopo agora

- Reformar Pró-labore, Simulador ou Calculadora de preço.
- Mudar lógica de auth ou planos.

## Como quero tocar

Se aprovar, começo pela **Fase 1** já nesta rodada (landing, tema claro, Instagram, avatares fake). As fases 2–5 envolvem migrações e IA — cada uma vira uma rodada separada com aprovação da migração antes de codar.

Me confirma:
1. Aprovado seguir por essa ordem?
2. "Importações" vira **Entrada de Vendas** ou você prefere outro nome (ex.: "Registro de Vendas", "Pedidos")?
