# Roteiro LUUD

## Concluído
- Identidade persistente do WhatsApp (`whatsapp_identities`, normalização de telefone, conflitos)
- Auditoria (`audit_log`) e arquivamento em vez de exclusão
- Serviço central de movimentações (criar, confirmar, corrigir, arquivar, restaurar)
- Webhook unificado: evento cru -> identidade -> orquestrador -> resposta, com idempotência
- Orquestrador conversacional com uma sugestão por resposta, sem push
- Acesso web por código de 6 dígitos em `/acesso` (hash, expiração 10 min, uso único, limites)
- Painel enxuto: Visão geral, Lançamentos, Conversas, Negócio, Ajuda (páginas legadas removidas)
- Painel administrativo em `/admin` (identidades, negócios, conversas, auditoria, limpeza com confirmação)
- Funções web dos lançamentos passando pelo serviço central (`movements.functions.ts`)

## Pendente
- Configurar o segredo `TALKTOME_API_KEY` para o envio real do código em `/acesso`
- Migrar a tela `/movimentacoes` para usar `saveMovementWeb`/`archiveMovementWeb` e listar arquivados
