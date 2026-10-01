<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Centralize o período financeiro no `PeriodProvider` do layout autenticado para manter filtros consistentes entre telas.
- Exponha análises financeiras web apenas por server functions autenticadas e DTOs numéricos; a UI nunca soma lançamentos brutos.
- Use as RPCs agregadas do dashboard para séries, categorias e fornecedores, evitando transferir lançamentos completos ao navegador.
