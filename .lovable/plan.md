# Categorias financeiras consistentes no banco e no serviço

## Objetivo

Fortalecer categorias e lançamentos sem qualquer mudança visual. O resumo e os filtros usarão `movements`, conforme a fonte atual da Visão Geral e a decisão tomada.

## Implementação

1. **Evoluir `categories` com uma migração única**
   - Adicionar `color`, `archived_at` e `is_system`, com valores padrão seguros e uma paleta fixa de aproximadamente dez cores.
   - Substituir a unicidade atual por índice único parcial por negócio, tipo e nome sem diferença entre maiúsculas/minúsculas, somente para categorias ativas.
   - Preservar os GRANTs e as políticas atuais; nenhuma tabela nova será criada.

2. **Preservar e classificar categorias existentes**
   - Não renomear, fundir ou apagar nenhuma categoria legada.
   - Preencher `movement_type` apenas quando todos os lançamentos vinculados à categoria tiverem o mesmo tipo; categorias ambíguas permanecerão sem tipo.
   - Criar uma função de seed idempotente com as categorias padrão solicitadas para entradas e saídas.
   - Reaproveitar categoria ativa de mesmo nome, ignorando maiúsculas/minúsculas, quando o tipo for nulo ou compatível; nesse caso, definir tipo e `is_default` sem duplicar.
   - Marcar somente “Outros” e “Outras entradas” como categorias de sistema.
   - Executar o seed nos negócios atuais e em cada novo negócio por trigger `AFTER INSERT`.

3. **Aplicar integridade no banco**
   - Validar apenas novos `INSERT`s e mudanças de `category_id`/`type` em `movements`.
   - Exigir que lançamento e categoria pertençam ao mesmo negócio, respeitem o tipo quando definido e impedir nova atribuição de categoria arquivada.
   - Manter lançamentos antigos válidos sem revalidação retroativa.
   - Impedir arquivamento ou exclusão direta das categorias de sistema e impedir exclusão física das demais categorias.
   - Permitir a exclusão em cascata exclusivamente quando o negócio pai estiver sendo removido; isso preserva o `ON DELETE CASCADE`. A mesclagem administrativa atual não exclui negócios nem categorias, portanto permanece compatível.

4. **Adicionar consultas SQL protegidas por RLS**
   - Criar funções `SECURITY INVOKER` para listagem filtrada e resumo financeiro.
   - Usar `movements`, a mesma fonte atual da Visão Geral, com período calculado em `America/Sao_Paulo`.
   - Aceitar filtro por tipo, múltiplas categorias, opção “sem categoria” e busca por descrição ou nome do fornecedor.
   - Calcular entradas, saídas e resultado usando apenas `entrada` e `saida`, excluindo linhas arquivadas ou substituídas.
   - Restringir execução aos papéis necessários e manter o isolamento existente por RLS e `restaurant_id`.

5. **Corrigir o serviço central de lançamentos**
   - Fazer `updateMovement` distinguir `undefined` de `null`, permitindo limpar explicitamente categoria, fornecedor, descrição, forma de pagamento e observações.
   - Conferir e ajustar todos os chamadores afetados sem tocar nas telas.
   - Fazer arquivamento e restauração alterarem somente o status; o motivo ficará apenas no histórico de auditoria.
   - Normalizar a busca de fornecedor com trim, limite de 120 caracteres e comparação sem diferença de maiúsculas/minúsculas ou acentos, reutilizando o fornecedor existente.

6. **Adicionar utilitários brasileiros isolados**
   - Criar `src/lib/date-br.ts` com hoje, início/fim do mês e mês anterior no fuso `America/Sao_Paulo`.
   - Adicionar `parseBRL()` compatível com formatos como `1.234,56` e `12,5`.
   - Não alterar os utilitários globais atuais de data/período.

7. **Validar e relatar**
   - Testar seed repetido, unicidade, categorias de sistema, cascata de negócio, isolamento entre negócios, compatibilidade de tipo, categoria arquivada, limpeza explícita com `null`, fornecedor normalizado e filtros/resumo.
   - Validar que a Visão Geral, Admin, Conversas, acesso, planos, rotinas e WhatsApp não foram alterados.
   - Executar a checagem de tipos, verificar o resultado da aplicação e consultar os dados finais.
   - Informar ao final: itens criados/alterados, arquivos envolvidos, quantidades exatas de categorias legadas preservadas, reaproveitadas e tipadas, e como RLS + trigger garantem o isolamento por negócio.

## Detalhes técnicos

- Alterações estruturais serão aplicadas somente pela migração oficial do Lovable Cloud; nada será criado no Drizzle.
- Estado confirmado antes da execução: `categories` tem RLS, 254 registros em 12 negócios, 33 categorias sem tipo e nenhuma colisão atual de nome ignorando maiúsculas/minúsculas.
- A Visão Geral consulta `movements` com `status = 'active'`; `movements_current` é atualmente uma visão dessa tabela filtrada pelo mesmo status. Pela decisão tomada, as novas funções usarão diretamente `movements`.
- O novo índice considerará também o tipo, permitindo nomes iguais em tipos diferentes e impedindo duplicatas ativas equivalentes.
