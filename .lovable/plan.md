# Atualizar posicionamento e cores da landing LUUD

## Objetivo
Reposicionar a página pública para apresentar a LUUD como a secretária inteligente da empresa, mantendo a experiência pelo WhatsApp e a transparência dos exemplos.

## Alterações
- Atualizar somente as cores da landing para off-white, verde institucional, verde escuro e dourado pontual.
- Reescrever título, descrição e compartilhamento social com a mensagem “Sua empresa ganhou uma secretária inteligente”.
- Atualizar o topo da página para “Você fala. Ela trabalha.”, preservando o botão de WhatsApp e a conversa demonstrativa.
- Adaptar as seções existentes para mostrar ajuda diária em Financeiro, Estoque, Tarefas, Compras e Perguntas.
- Incluir exemplos visuais de texto e áudio, mantendo “Exemplo demonstrativo”.
- Ajustar o fluxo para mensagem → entendimento → organização → pergunta → atualização → resultado.
- Apresentar as áreas atendidas, perguntas de exemplo e uma seção própria sobre texto ou áudio.
- Inserir a mensagem “O empresário não precisa de mais um sistema. Precisa de ajuda.” antes da chamada final.
- Atualizar a chamada final e a frase do rodapé.
- Manter `FAQ_ITEMS` exatamente como está.

## Limites
- Alterar apenas `src/routes/index.tsx` e o escopo visual da landing em `src/styles.css`.
- Não alterar rotas autenticadas, componentes do app logado, banco de dados, WhatsApp ou lógica de servidor.
- Preservar os componentes reutilizáveis atuais e todas as etiquetas de exemplo demonstrativo.

## Validação
- Verificar a página em desktop e celular, incluindo contraste, ordem das seções e ausência de sobreposição.
- Confirmar que a página abre sem erros e que os links e botões existentes continuam funcionando.
