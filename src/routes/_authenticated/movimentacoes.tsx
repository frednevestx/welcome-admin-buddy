import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, Check, ChevronDown, Download, FilterX, Pencil, Plus, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { currentMonthInSaoPaulo, previousMonthInSaoPaulo, todayInSaoPaulo, type DateRangeBR } from "@/lib/date-br";
import { formatBRL, formatDateBR } from "@/lib/format";
import { translateAuthError } from "@/lib/auth-errors";
import { archiveMovementWeb, listArchivedMovements, listMovementsWeb, restoreMovementWeb, saveMovementWeb, summarizeMovementsWeb } from "@/lib/movements/movements.functions";
import { downloadCsv, movementsToCsv } from "@/lib/movements/csv";
import { CATEGORY_COLOR_CLASS, movementOrigin, TYPE_LABEL, type Category, type MovementRow, type MovementType } from "@/lib/movements/view-model";
import { cn } from "@/lib/utils";
import { MovementForm } from "@/components/movements/movement-form";
import { CategoryManager } from "@/components/movements/category-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  component: MovementsPage,
  head: () => ({ meta: [
    { title: "Lançamentos | LUUD" },
    { name: "description", content: "Controle as entradas e saídas do seu negócio." },
    { property: "og:title", content: "Lançamentos | LUUD" },
    { property: "og:description", content: "Controle as entradas e saídas do seu negócio." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type PeriodKey = "today" | "7d" | "30d" | "month" | "previous" | "custom";
type TypeFilter = "all" | "entrada" | "saida";

function subtractDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - days));
  return date.toISOString().slice(0, 10);
}

function periodFor(key: PeriodKey): DateRangeBR {
  const today = todayInSaoPaulo();
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: subtractDays(today, 6), to: today };
  if (key === "month") return currentMonthInSaoPaulo();
  if (key === "previous") return previousMonthInSaoPaulo();
  return { from: subtractDays(today, 29), to: today };
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return debounced;
}

function MovementsPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const listFn = useServerFn(listMovementsWeb);
  const summaryFn = useServerFn(summarizeMovementsWeb);
  const archiveFn = useServerFn(archiveMovementWeb);
  const restoreFn = useServerFn(restoreMovementWeb);
  const archivedFn = useServerFn(listArchivedMovements);
  const saveFn = useServerFn(saveMovementWeb);
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [period, setPeriod] = useState<DateRangeBR>(() => periodFor("30d"));
  const [type, setType] = useState<TypeFilter>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [uncategorized, setUncategorized] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [limit, setLimit] = useState(50);
  const [newOpen, setNewOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editing, setEditing] = useState<MovementRow | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setLimit(50); }, [period.from, period.to, type, categoryIds.join(","), uncategorized, debouncedSearch]);

  const categoriesQuery = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["movement-categories", restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase.from("categories").select("id,name,movement_type,color,archived_at,is_system,is_default,movements(count)").eq("restaurant_id", restaurant.id).order("name");
      if (error) throw error;
      return (data ?? []).map((item: any) => ({ ...item, linkedCount: Number(item.movements?.[0]?.count ?? 0) })) as Category[];
    },
  });
  const categories = categoriesQuery.data ?? [];
  const filterCategories = categories.filter((category) => !category.archived_at || category.linkedCount > 0);
  const filters = useMemo(() => ({
    restaurant_id: restaurant?.id ?? "",
    from: period.from,
    to: period.to,
    type: type === "all" ? null : type,
    category_ids: categoryIds.length ? categoryIds : null,
    include_uncategorized: uncategorized,
    search: debouncedSearch || null,
  }), [restaurant?.id, period, type, categoryIds, uncategorized, debouncedSearch]);

  const movements = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["movements", filters, limit],
    queryFn: async () => await listFn({ data: { ...filters, limit, offset: 0 } }) as MovementRow[],
  });
  const summary = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["movements-summary", filters],
    queryFn: async () => await summaryFn({ data: filters }),
  });
  const archived = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["movements-archived", restaurant?.id],
    queryFn: async () => await archivedFn({ data: undefined as never }) as MovementRow[],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["movements-summary"] });
    qc.invalidateQueries({ queryKey: ["movements-archived"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const restore = useMutation({ mutationFn: (id: string) => restoreFn({ data: { id } }), onSuccess: () => { refresh(); toast.success("Lançamento restaurado"); }, onError: (error) => toast.error(translateAuthError(error, "Não foi possível restaurar.")) });
  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id, reason: "arquivado pelo painel" } }),
    onSuccess: (_result, id) => { refresh(); toast.success("Lançamento arquivado", { action: { label: "Desfazer", onClick: () => restore.mutate(id) } }); },
    onError: (error) => toast.error(translateAuthError(error, "Não foi possível arquivar.")),
  });
  const quickCategory = useMutation({
    mutationFn: async ({ row, categoryId }: { row: MovementRow; categoryId: string | null }) => saveFn({ data: { id: row.id, type: row.type, amount: Number(row.amount), movement_date: row.movement_date, category_id: categoryId, category_only: true } }),
    onMutate: async ({ row, categoryId }) => {
      await qc.cancelQueries({ queryKey: ["movements"] });
      const previous = qc.getQueriesData({ queryKey: ["movements"] });
      const category = categories.find((item) => item.id === categoryId);
      qc.setQueriesData({ queryKey: ["movements"] }, (old: MovementRow[] | undefined) => old?.map((item) => item.id === row.id ? { ...item, category_id: categoryId, category_name: category?.name ?? null, category_color: category?.color ?? null } : item));
      return { previous };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["movements-summary"] }); toast.success("Categoria atualizada"); },
    onError: (error, _variables, context) => { context?.previous.forEach(([key, data]) => qc.setQueryData(key, data)); toast.error(translateAuthError(error, "A categoria não foi alterada.")); },
  });

  const hasFilters = periodKey !== "30d" || type !== "all" || categoryIds.length > 0 || uncategorized || search.trim().length > 0;
  const clearFilters = () => { setPeriodKey("30d"); setPeriod(periodFor("30d")); setType("all"); setCategoryIds([]); setUncategorized(false); setSearch(""); };
  const selectPeriod = (key: PeriodKey) => { setPeriodKey(key); if (key !== "custom") setPeriod(periodFor(key)); };

  async function exportCsv() {
    if (!restaurant?.id) return;
    setExporting(true);
    try {
      const all: MovementRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await listFn({ data: { ...filters, limit: 1000, offset } }) as MovementRow[];
        all.push(...page);
        if (page.length < 1000) break;
      }
      downloadCsv(movementsToCsv(all.map((row) => ({ movement_date: row.movement_date, type: TYPE_LABEL[row.type], description: row.description, supplier_name: row.supplier_name, category_name: row.category_name, originLabel: movementOrigin(row), amount: Number(row.amount) }))), `lancamentos-${period.from}-a-${period.to}.csv`);
      toast.success(`${all.length} lançamento(s) exportado(s)`);
    } catch (error) { toast.error(translateAuthError(error, "Não foi possível exportar o CSV.")); }
    finally { setExporting(false); }
  }

  const rows = movements.data ?? [];
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="font-display text-2xl font-semibold">Lançamentos</h1><p className="mt-1 text-sm text-muted-foreground">Controle tudo que entra e sai do seu negócio.</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Dialog open={newOpen} onOpenChange={setNewOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo lançamento</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Novo lançamento</DialogTitle><DialogDescription>Preencha os dados da entrada ou saída.</DialogDescription></DialogHeader><MovementForm categories={categories} onDone={() => { setNewOpen(false); refresh(); }} /></DialogContent></Dialog><Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}><DialogTrigger asChild><Button variant="outline"><Settings2 className="h-4 w-4" /> Gerenciar categorias</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Gerenciar categorias</DialogTitle><DialogDescription>Crie, renomeie, defina cores ou arquive categorias.</DialogDescription></DialogHeader><CategoryManager categories={categories} /></DialogContent></Dialog><Button variant="outline" onClick={exportCsv} disabled={exporting}><Download className="h-4 w-4" /> {exporting ? "Exportando..." : "Exportar CSV"}</Button></div></header>

    <Card className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><PeriodFilter periodKey={periodKey} period={period} onKey={selectPeriod} onRange={(range) => { setPeriodKey("custom"); setPeriod(range); }} /><Select value={type} onValueChange={(value) => setType(value as TypeFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="entrada">Entradas</SelectItem><SelectItem value="saida">Saídas</SelectItem></SelectContent></Select><CategoryFilter categories={filterCategories} selected={categoryIds} uncategorized={uncategorized} onSelected={setCategoryIds} onUncategorized={setUncategorized} /><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição ou fornecedor" /></div></div>{hasFilters && <div className="flex flex-wrap items-center gap-2"><ActiveFilters periodKey={periodKey} type={type} categories={categories} selected={categoryIds} uncategorized={uncategorized} search={search} /><Button size="sm" variant="ghost" onClick={clearFilters}><FilterX className="h-4 w-4" /> Limpar filtros</Button></div>}</Card>

    <div className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Entradas" value={Number(summary.data?.entradas ?? 0)} tone="positive" /><SummaryCard label="Saídas" value={Number(summary.data?.saidas ?? 0)} tone="negative" /><SummaryCard label="Resultado" value={Number(summary.data?.resultado ?? 0)} tone={Number(summary.data?.resultado ?? 0) >= 0 ? "positive" : "negative"} /></div>

    {movements.isLoading ? <div className="space-y-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : rows.length === 0 ? <EmptyState filtered={hasFilters} onClear={clearFilters} onCreate={() => setNewOpen(true)} /> : <><MovementList rows={rows} categories={categories} onEdit={setEditing} onArchive={(row) => archive.mutate(row.id)} onCategory={(row, categoryId) => quickCategory.mutate({ row, categoryId })} pendingCategory={quickCategory.isPending} />{rows.length >= limit && <div className="flex justify-center"><Button variant="outline" onClick={() => setLimit((value) => value + 50)}>Carregar mais</Button></div>}</>}

    {(archived.data?.length ?? 0) > 0 && <Collapsible><Card className="p-4"><CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between"><span>Arquivados ({archived.data?.length})</span><ChevronDown className="h-4 w-4" /></Button></CollapsibleTrigger><CollapsibleContent className="space-y-2 pt-3">{archived.data?.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 border-t border-border py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.description || "Sem descrição"}</p><p className="text-xs text-muted-foreground">{formatDateBR(row.movement_date)} · {formatBRL(row.amount)}</p></div><Button size="sm" variant="outline" onClick={() => restore.mutate(row.id)}>Restaurar</Button></div>)}</CollapsibleContent></Card></Collapsible>}

    <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Editar lançamento</DialogTitle><DialogDescription>Atualize os dados deste lançamento.</DialogDescription></DialogHeader>{editing && <MovementForm initial={editing} categories={categories} onDone={() => { setEditing(null); refresh(); }} />}</DialogContent></Dialog>
  </div>;
}

function PeriodFilter({ periodKey, period, onKey, onRange }: { periodKey: PeriodKey; period: DateRangeBR; onKey: (key: PeriodKey) => void; onRange: (range: DateRangeBR) => void }) {
  const labels: Record<PeriodKey, string> = { today: "Hoje", "7d": "7 dias", "30d": "30 dias", month: "Este mês", previous: "Mês anterior", custom: "Personalizado" };
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-between"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{labels[periodKey]}</span><ChevronDown className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent align="start" className="w-72 space-y-3"><div className="grid grid-cols-2 gap-1">{(Object.keys(labels) as PeriodKey[]).map((key) => <Button key={key} size="sm" variant={periodKey === key ? "secondary" : "ghost"} onClick={() => onKey(key)}>{labels[key]}</Button>)}</div>{periodKey === "custom" && <div className="grid grid-cols-2 gap-2"><Input aria-label="Data inicial" type="date" value={period.from} onChange={(event) => onRange({ ...period, from: event.target.value })} /><Input aria-label="Data final" type="date" value={period.to} onChange={(event) => onRange({ ...period, to: event.target.value })} /></div>}</PopoverContent></Popover>;
}

function CategoryFilter({ categories, selected, uncategorized, onSelected, onUncategorized }: { categories: Category[]; selected: string[]; uncategorized: boolean; onSelected: (ids: string[]) => void; onUncategorized: (value: boolean) => void }) {
  const count = selected.length + (uncategorized ? 1 : 0);
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-between"><span>{count ? `${count} categoria(s)` : "Todas as categorias"}</span><ChevronDown className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="max-h-80 w-72 overflow-y-auto p-2" align="start"><label className="flex cursor-pointer items-center gap-2 rounded-sm p-2 text-sm"><Checkbox checked={uncategorized} onCheckedChange={(checked) => onUncategorized(checked === true)} />Sem categoria</label>{categories.map((category) => <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-sm p-2 text-sm"><Checkbox checked={selected.includes(category.id)} onCheckedChange={(checked) => onSelected(checked ? [...selected, category.id] : selected.filter((id) => id !== category.id))} /><span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_COLOR_CLASS[category.color])} /><span className="truncate">{category.name}{category.archived_at ? " (arquivada)" : ""}</span></label>)}</PopoverContent></Popover>;
}

function ActiveFilters({ periodKey, type, categories, selected, uncategorized, search }: { periodKey: PeriodKey; type: TypeFilter; categories: Category[]; selected: string[]; uncategorized: boolean; search: string }) {
  return <>{periodKey !== "30d" && <Badge variant="secondary">Período alterado</Badge>}{type !== "all" && <Badge variant="secondary">{type === "entrada" ? "Entradas" : "Saídas"}</Badge>}{selected.map((id) => <Badge key={id} variant="secondary">{categories.find((category) => category.id === id)?.name ?? "Categoria"}</Badge>)}{uncategorized && <Badge variant="secondary">Sem categoria</Badge>}{search.trim() && <Badge variant="secondary">Busca: {search.trim()}</Badge>}</>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "positive" | "negative" }) {
  return <Card className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className={cn("mt-2 text-2xl font-semibold tabular-nums", tone === "positive" ? "text-success" : "text-destructive")}>{formatBRL(value)}</p></Card>;
}

function MovementList({ rows, categories, onEdit, onArchive, onCategory, pendingCategory }: { rows: MovementRow[]; categories: Category[]; onEdit: (row: MovementRow) => void; onArchive: (row: MovementRow) => void; onCategory: (row: MovementRow, categoryId: string | null) => void; pendingCategory: boolean }) {
  return <Card className="overflow-hidden"><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Fornecedor/Contato</TableHead><TableHead>Categoria</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-24 text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="whitespace-nowrap text-muted-foreground">{formatDateBR(row.movement_date)}</TableCell><TableCell className="max-w-64"><div className="flex items-center gap-2"><span className="truncate">{row.description || "Sem descrição"}</span>{row.is_fixed && <Badge variant="secondary">Fixa</Badge>}</div></TableCell><TableCell>{row.supplier_name || "—"}</TableCell><TableCell><QuickCategory row={row} categories={categories} onChange={onCategory} disabled={pendingCategory} /></TableCell><TableCell><Badge variant="outline">{movementOrigin(row)}</Badge></TableCell><TableCell className={cn("text-right font-medium tabular-nums", row.type === "entrada" && "text-success", row.type === "saida" && "text-destructive")}>{amountLabel(row)}</TableCell><TableCell><div className="flex justify-end"><Button size="icon" variant="ghost" aria-label="Editar lançamento" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Arquivar lançamento" onClick={() => onArchive(row)}><Archive className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div><div className="divide-y divide-border md:hidden">{rows.map((row) => <article key={row.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{row.description || "Sem descrição"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateBR(row.movement_date)} · {movementOrigin(row)}</p></div><span className={cn("shrink-0 font-semibold tabular-nums", row.type === "entrada" && "text-success", row.type === "saida" && "text-destructive")}>{amountLabel(row)}</span></div><div className="flex items-center justify-between gap-2"><QuickCategory row={row} categories={categories} onChange={onCategory} disabled={pendingCategory} /><span className="truncate text-xs text-muted-foreground">{row.supplier_name || "Sem fornecedor"}</span></div><div className="flex justify-end"><Button size="icon" variant="ghost" aria-label="Editar lançamento" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Arquivar lançamento" onClick={() => onArchive(row)}><Archive className="h-4 w-4" /></Button></div></article>)}</div></Card>;
}

function QuickCategory({ row, categories, onChange, disabled }: { row: MovementRow; categories: Category[]; onChange: (row: MovementRow, categoryId: string | null) => void; disabled: boolean }) {
  const options = categories.filter((category) => !category.archived_at && (category.movement_type === row.type || category.movement_type === null));
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="max-w-44 justify-start gap-2 px-2" disabled={disabled}><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", row.category_color ? CATEGORY_COLOR_CLASS[row.category_color] : "bg-muted-foreground")} /><span className="truncate">{row.category_name || "Sem categoria"}</span><ChevronDown className="h-3 w-3 shrink-0" /></Button></PopoverTrigger><PopoverContent className="w-64 p-1" align="start"><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange(row, null)}>{!row.category_id && <Check className="h-4 w-4" />}Sem categoria</Button>{options.map((category) => <Button key={category.id} variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange(row, category.id)}>{row.category_id === category.id && <Check className="h-4 w-4" />}<span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_COLOR_CLASS[category.color])} />{category.name}</Button>)}</PopoverContent></Popover>;
}

function amountLabel(row: MovementRow): string {
  const prefix = row.type === "entrada" ? "+" : row.type === "saida" ? "−" : "";
  return `${prefix}${formatBRL(row.amount)}`;
}

function EmptyState({ filtered, onClear, onCreate }: { filtered: boolean; onClear: () => void; onCreate: () => void }) {
  return <Card className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><h2 className="font-medium">{filtered ? "Nenhum lançamento encontrado com esses filtros." : "Nenhum lançamento encontrado."}</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{filtered ? "Ajuste ou limpe os filtros para ampliar a busca." : "Crie seu primeiro lançamento para começar a acompanhar o resultado do negócio."}</p><Button className="mt-4" onClick={filtered ? onClear : onCreate}>{filtered ? <FilterX className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{filtered ? "Limpar filtros" : "Novo lançamento"}</Button></Card>;
}