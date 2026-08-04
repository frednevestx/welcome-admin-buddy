# Central de Integrações Automáticas — Fase 1

Objetivo desta entrega: criar toda a fundação de integrações (banco + camada de conectores + tela de Integrações + origem dos dados) e o conector iFood pronto para ligar assim que você tiver as credenciais de parceiro.

## O que você vai ver funcionando

1. **Novo item no menu: Integrações**
   Tela com cards modernos por plataforma:
   - iFood — botão "Conectar" (fluxo oficial, ativa quando as credenciais existirem)
   - 99Food — "Conectar" (mesma estrutura, ativação futura)
   - Rappi, Consumer, Saipos, Goomer, Cardápio Web, Bancos/PIX (Open Finance) — "Em breve"
   Cada card conectado mostra: status (Online/erro), última sincronização ("há 15 segundos"), pedidos sincronizados, e botão "Gerenciar" (sincronizar agora, ver histórico de sincronizações, desconectar).

2. **Origem em todo lançamento financeiro**
   Cada receita/despesa passa a ter uma etiqueta de origem:
   - **Automático** — veio da integração, somente leitura
   - **Manual** — lançado por você, editável
   - **Ajuste** — correção sua sobre um registro automático, preservando o original para auditoria
   Nas Movimentações: filtro por origem, badge visual, bloqueio de edição em registros automáticos e botão "Criar ajuste" no lugar de "Editar".

3. **Dados atuais preservados e classificados**
   Nada é perdido. Vendas vindas da planilha inteligente/importações ficam como **Importado**; lançamentos digitados ficam como **Manual**.

4. **Card de integração no Dashboard**
   Bloco resumido (não operacional): plataforma, status, última sincronização, pedidos hoje, receita hoje.

5. **Dashboard com origens separadas**
   Receitas automáticas, receitas manuais, custos automáticos, custos manuais, lucro bruto, lucro líquido, margem, ticket médio, pedidos.

6. **IA alimentada pelas sincronizações**
   O snapshot que a IA já usa passa a incluir os dados importados (taxas, comissões, cupons, cancelamentos, produtos, horários), permitindo análises como "sua taxa média subiu", "você perdeu R$ 1.850 em cancelamentos", "produto mais lucrativo: Combo Família".

## Sobre o iFood (importante)

O iFood só permite integração via credenciais de parceiro do Portal do Desenvolvedor. Como você ainda não tem, nesta entrega o conector iFood fica **completo mas inativo**: ao clicar em Conectar, a tela explica que falta a credencial e eu ativo o fluxo real (autorização oficial → token criptografado → primeira sincronização de todo o histórico → webhooks) no momento em que você me passar o acesso. Nunca pediremos usuário e senha do restaurante — apenas autorização oficial.

## Detalhes técnicos

**Banco (migração):**
- `integrations` — restaurante, provider, status, escopos, `access_token_ciphertext`, `refresh_token_ciphertext`, expiração, merchant/loja externa, última sincronização, contadores.
- `sync_logs` — integração, tipo (histórico/incremental/webhook), início/fim, registros processados, status, erro.
- `orders_imported` — pedido bruto normalizado: id externo, data/hora, itens (jsonb), bruto, comissão, taxa entrega, taxa marketing, cupons, cancelamento, repasse, forma de pagamento, payload original. Somente leitura.
- `financial_adjustments` — ajuste sobre um registro importado (motivo, delta, autor), preservando o original.
- `movements` ganha `origin` (`automatico | manual | ajuste | importado`) e `source_ref`; `sales` ganha `origin`.
- `ai_insights` e `financial_metrics` — cache de insights e métricas diárias consolidadas por origem.
- Todas com GRANT + RLS por `current_restaurant_id()`; tabelas de token só com `service_role`.

**Arquitetura de conectores** (`src/lib/integrations/`):
- `types.ts` com a interface `IntegrationProvider`: `getAuthUrl`, `exchangeCode`, `refreshToken`, `fetchHistory`, `fetchIncremental`, `handleWebhook`, `normalize`.
- `ifood/`, `99food/` e stubs registrados num `registry.ts`, para novas plataformas entrarem sem tocar no resto.
- Tokens criptografados com AES-256-GCM (chave em secret do backend), nunca expostos ao navegador.

**Backend (nunca no navegador):**
- Server functions autenticadas para listar/gerenciar integrações e disparar sincronização.
- Rota pública `src/routes/api/public/integrations/$provider/webhook.ts` para webhooks, com validação de assinatura.
- Rota pública de sincronização periódica agendada por job (cron) para plataformas sem webhook, com sincronização incremental e logs.

**Fora do escopo desta fase:** Dashboard da IA completo (resumo inteligente do dia), categorias inteligentes com aprendizado por fornecedor e Open Finance — entram na fase 2, sobre esta fundação.
