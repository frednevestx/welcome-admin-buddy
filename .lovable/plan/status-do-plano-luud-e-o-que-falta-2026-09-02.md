# Status do plano LUUD e o que falta

## Já entregue
- Identidade persistente do WhatsApp (telefone normalizado, conflitos, vínculo telefone → usuário → negócio)
- Auditoria completa e arquivamento no lugar de exclusão
- Serviço central de lançamentos (criar, confirmar, corrigir, arquivar, restaurar, reset financeiro)
- Webhook unificado com evento cru rastreável e proteção contra mensagem duplicada
- Orquestrador conversacional com contexto de 30 min e uma única sugestão proativa por resposta

## Ainda pendente
1. **Acesso web por código do WhatsApp** — tela pública `/acesso`: telefone → código de 6 dígitos → sessão real criada no servidor. Código só como hash, 10 min de validade, uso único, limite de tentativas e reenvios. Depende do segredo `TALKTOME_API_KEY` para enviar a mensagem.
2. **Painel do usuário enxuto** — menu reduzido a Visão geral, Lançamentos, Conversas, Negócio e Ajuda; remoção das páginas CMV, calculadora de preço, simulador, lucro por plataforma, integrações, relatórios, comparativos, evolução, importações, alertas, metas, histórico de preços, fornecedores e assistente-ia web; nenhum texto de plano/PRO/trial/checkout.
3. **Telas web usando o serviço central** — criar, corrigir, arquivar e recuperar lançamento pelo mesmo caminho do WhatsApp, com auditoria.
4. **Painel administrativo `/admin`** — login separado por email e senha, role validada no servidor; áreas de contatos, usuários, negócios, identidades em conflito, conversas, lançamentos, auditoria, saúde do webhook e pré-visualização da limpeza (nada apagado sem confirmação).
5. **Validação final** — build, lint, testes das funções puras e relatório com arquivos, migrações e variáveis.

## Detalhes técnicos
- Novos módulos: `src/lib/auth/whatsapp-otp.server.ts` (geração/validação do código) e as rotas `src/routes/acesso.tsx`, `src/routes/admin/*`.
- A tabela `whatsapp_access_codes` já existe (acesso só pelo servidor); falta a lógica de emissão e verificação.
- Remoção de páginas: apagar os arquivos em `src/routes/_authenticated/` listados no item 2 e limpar a `app-sidebar`.

## Ordem sugerida
Painel enxuto → telas web no serviço central → painel admin → acesso por código (quando o segredo estiver disponível) → validação.
