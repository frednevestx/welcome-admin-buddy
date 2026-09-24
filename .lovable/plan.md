# Reforma da tela de Lançamentos

## Resultado esperado
Transformar `/movimentacoes` em uma tela completa de lançamentos, em português e adaptada a celular, mantendo a identidade escura atual. A rota e o item do menu permanecem; o título passa a ser **Lançamentos**.

## Implementação

### 1. Consulta, filtros e resumo
- Consumir `filter_movements` para a lista paginada e `summarize_movements` para Entradas, Saídas e Resultado do filtro inteiro.
- Criar na própria tela o seletor de período com Hoje, 7 dias, 30 dias, Este mês, Mês anterior e Personalizado, usando o horário de São Paulo; o seletor compartilhado existente não será alterado.
- Combinar filtros de tipo, múltiplas categorias, “Sem categoria” e busca por descrição/fornecedor com espera de 300 ms.
- Exibir chips dos filtros ativos e ação “Limpar filtros”. Categorias arquivadas só aparecem no filtro quando possuem lançamentos e recebem o sufixo “(arquivada)”.
- Carregar 50 registros por vez, ordenados por data e criação mais recentes, sem recalcular totais apenas sobre a página visível.

### 2. Lista e estados
- Desktop: tabela com Data, Descrição, Fornecedor/Contato, Categoria, Origem, Valor e Ações.
- Mobile: cartões sem rolagem horizontal, preservando as mesmas informações essenciais.
- Mostrar origem como Manual, WhatsApp, Importado ou Ajuste a partir dos campos já existentes; entradas recebem “+”, saídas “−” e transferência/ajuste ficam neutros.
- Usar `dd/mm/aaaa` e moeda brasileira, com texto sempre acompanhando qualquer indicação por cor.
- Adicionar skeleton, vazio inicial com ação de novo lançamento e vazio filtrado com ação de limpar filtros.
- Manter “Arquivados” em área recolhível.

### 3. Novo lançamento, edição e edição rápida
- Reaproveitar e reorganizar `MovementForm`, preservando pagamento, observação e despesa fixa.
- Usar valor brasileiro com `parseBRL`, data inicial de São Paulo e mensagens de validação em português.
- Adicionar autocomplete de fornecedores do negócio, limitado a 120 caracteres, permitindo selecionar existente ou informar novo.
- Limpar a categoria ao trocar o tipo.
- Permitir troca imediata da categoria pelo chip da linha, mostrando somente categorias ativas compatíveis e “Sem categoria”; atualizar apenas a linha, reverter em erro e mostrar aviso discreto.

### 4. Arquivamento e categorias
- Trocar a ação visual de excluir por arquivar.
- Após arquivar, mostrar “Lançamento arquivado” com ação **Desfazer**, usando a recuperação existente sem alterar observações.
- Criar modal “Gerenciar categorias”, separado em Entradas e Saídas, para criar, renomear, escolher uma cor da paleta e arquivar.
- Não oferecer arquivamento para categorias de sistema e nunca apagar categorias fisicamente.
- Converter `/categorias` em redirecionamento compatível para `/movimentacoes`, preservando links antigos.

### 5. Exportação CSV
- Exportar todos os registros do filtro, não apenas os 50 visíveis, em páginas de 1.000.
- Gerar colunas Data; Tipo; Descrição; Fornecedor/Contato; Categoria; Origem; Valor, com `;`, BOM UTF-8, CRLF, datas e decimais brasileiros.
- Escapar aspas, separadores e quebras de linha, além de neutralizar fórmulas iniciadas por `=`, `+`, `-`, `@`, tabulação ou retorno de carro.

### 6. Metadados e organização
- Adicionar metadados próprios da rota de Lançamentos.
- Separar filtros, lista, formulário, gestão de categorias e utilitário CSV em componentes/arquivos focados quando isso reduzir a complexidade da rota.
- Não adicionar bibliotecas e não alterar Visão Geral, Admin, Conversas, Negócio, autenticação, planos, WhatsApp ou identidade visual.

## Validação
- Testar em desktop e celular: filtros combinados, chips, paginação, edição rápida, novo/editar, fornecedor, arquivar/desfazer e categorias.
- Confirmar o corte de “Hoje” e a data padrão às 22h de Brasília do dia 30.
- Validar resumo e CSV com mais de 1.000 lançamentos usando dados temporários isolados e removê-los ao final.
- Confirmar que mudar o tipo limpa a categoria, o desfazer preserva `notes` e o banco rejeita categoria de outro negócio, arquivada ou de tipo incompatível.
- Comparar a Visão Geral antes/depois para garantir que permaneceu inalterada; finalizar com checagens de tipos, integridade e build.

## Detalhes técnicos
- As leituras respeitarão o `restaurant_id` da sessão e as políticas existentes.
- A lista e o resumo usarão chaves de cache que incluem todos os filtros; mutações atualizarão a linha quando possível e invalidarão somente os conjuntos afetados.
- A tela atual lê `movements` diretamente e calcula “Valor total/Média” apenas sobre os resultados carregados; isso será substituído pelas funções do banco já disponíveis.
- A rota atual de categorias faz exclusão física; ela deixará de ter interface própria e toda gestão passará a arquivar dentro de Lançamentos.
