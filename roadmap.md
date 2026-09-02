# Roteiro LUUD

## Concluído
- Identidade persistente do WhatsApp (`whatsapp_identities`, normalização de telefone, conflitos)
- Auditoria (`audit_log`) e arquivamento em vez de exclusão
- Serviço central de movimentações (criar, confirmar, corrigir, arquivar, restaurar)
- Webhook unificado: evento cru -> identidade -> orquestrador -> resposta, com idempotência
- Orquestrador conversacional: contexto (30 min), Fato -> Interpretação -> Sugestão, uma sugestão por resposta, sem push

## Pendente
- Tela pública `/acesso` com código de 6 dígitos pelo WhatsApp (precisa do segredo `TALKTOME_API_KEY`)
- Painel do usuário enxuto (Visão geral, Lançamentos, Conversas, Negócio, Ajuda) e remoção dos módulos legados
- Painel administrativo em `/admin` (identidades, conflitos, negócios, auditoria)
- Reuso do serviço central de movimentações nas telas web
