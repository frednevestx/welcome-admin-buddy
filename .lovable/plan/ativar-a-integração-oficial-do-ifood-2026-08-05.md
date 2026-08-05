# Ativar a integração oficial do iFood

As credenciais que você enviou são chaves privadas de parceiro. Elas não podem ficar no código — vão ser guardadas com segurança no backend, onde só o servidor consegue ler.

## O que será feito

1. Salvar as duas credenciais como segredos do backend:
   - `IFOOD_CLIENT_ID`
   - `IFOOD_CLIENT_SECRET`
   O conector iFood já lê exatamente esses dois nomes, então nenhuma alteração de código é necessária para ele passar de "aguardando credencial" para "disponível".
2. Salvar também `INTEGRATION_TOKEN_SECRET` (gerado automaticamente, valor aleatório) para criptografar os tokens de acesso do iFood no banco em vez de usar a chave de serviço como fallback.
3. Conferir na página Integrações que o card do iFood aparece pronto para conectar (sem o aviso "Aguardando credencial oficial de parceiro").
4. Testar o início da autorização: o sistema pede um código ao iFood e mostra o código de autorização + link do portal oficial. Você cola o código devolvido e a LUUD importa o histórico de pedidos.

## Importante sobre segurança

Você colou as credenciais no chat. Recomendo, depois que a conexão estiver funcionando, gerar um novo `clientSecret` no Portal do Desenvolvedor iFood e atualizar o segredo aqui — assim o valor exposto deixa de valer.

## Detalhes técnicos

- Segredos ficam disponíveis como variáveis de ambiente nas funções de servidor; `ifoodProvider.isConfigured()` passa a retornar `true`.
- `startIntegrationAuth` usa o fluxo `userCode` distribuído do iFood; `completeIntegrationAuth` troca o código pelos tokens, criptografa com AES-256-GCM e grava em `integrations`.
- Webhook já existe em `/api/public/integrations/ifood/webhook`; se o iFood fornecer um segredo de assinatura, ele será guardado como `WEBHOOK_SECRET_IFOOD` num passo seguinte.
