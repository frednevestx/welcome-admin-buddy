import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { usePeriod } from "@/hooks/use-period";
import { PeriodSelector } from "@/components/period-selector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShoppingCart, DollarSign, BarChart2, Pencil, Trash2 } from "lucide-react";
import { formatBRL, formatNumber, formatDate, isoDate } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  component: MovementsPage,
});

type MovementType = "entrada" | "saida" | "transferencia";

const TYPE_LABEL: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
};

type MovementRow = {
  id: string;
  movement_date: string;
  description: string | null;
  amount: number;
  type: MovementType;
  payment_method: string | null;
  notes: string | null;
  category_id: string | null;
  supplier_id: string | null;
  is_fixed?: boolean | null;
  source_ref?: string | null;
  categories?: { id: string; name: string; movement_type: MovementType | null } | null;
  suppliers?: { name: string } | null;
};


function MovementsPage() {
  const { restaurant } = useRestaurant();
  const { period, setPeriod } = usePeriod("30d");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MovementRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MovementRow | null>(null);
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["movements", restaurant?.id, period.from, period.to],
    queryFn: async () => {
      const rid = restaurant!.id;
      const { data } = await supabase.from("movements")
        .select("id, movement_date, description, amount, type, payment_method, notes, category_id, supplier_id, is_fixed, source_ref, categories(id, name, movement_type), suppliers(name)")
        .eq("restaurant_id", rid)
        .gte("movement_date", period.from).lte("movement_date", period.to)
        .order("movement_date", { ascending: false });
      return (data ?? []) as unknown as MovementRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação excluída");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro ao excluir")),
  });

  const rows = q.data ?? [];
  const totalCount = rows.length;
  const totalValue = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
  const avg = totalCount > 0 ? totalValue / totalCount : 0;

  const byCat = new Map<string, { name: string; count: number; total: number }>();
  for (const r of rows) {
    const name = r.categories?.name ?? "Sem categoria";
    const cur = byCat.get(name) ?? { name, count: 0, total: 0 };
    cur.count++;
    cur.total += Number(r.amount || 0);
    byCat.set(name, cur);
  }
  const byCatList = Array.from(byCat.values()).sort((a, b) => b.total - a.total);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">Movimentações</h1>
          <p className="text-sm text-muted-foreground mt-1">Compras e despesas do negócio.</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector period={period} onChange={setPeriod} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Nova</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
              <MovementForm onDone={() => { setOpen(false); invalidate(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Lançamentos" value={formatNumber(totalCount)} />
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Valor total" value={formatBRL(totalValue)} />
        <SummaryCard icon={<BarChart2 className="h-4 w-4" />} label="Média por lançamento" value={formatBRL(avg)} />

      </div>

      <Card className="p-5">
        <h2 className="text-sm font-medium mb-4">Resumo por categoria</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-right">Média</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byCatList.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma movimentação no período.</TableCell></TableRow>
            )}
            {byCatList.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(c.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(c.total / c.count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-medium mb-4">Todas as movimentações</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem lançamentos.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(r.movement_date)}</TableCell>
                <TableCell className="max-w-xs truncate">{r.description || "—"}</TableCell>
                <TableCell>{r.categories?.name || "—"}</TableCell>
                <TableCell>{r.suppliers?.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{TYPE_LABEL[r.type]}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatBRL(r.amount)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar movimentação</DialogTitle></DialogHeader>
          {editing && (
            <MovementForm
              initial={editing}
              onDone={() => { setEditing(null); invalidate(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O valor será removido dos totais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && del.mutate(confirmDelete.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="h-8 w-8 rounded-lg grid place-items-center bg-secondary text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function MovementForm({ initial, onDone }: { initial?: MovementRow; onDone: () => void }) {
  const { restaurant } = useRestaurant();
  const [type, setType] = useState<MovementType>(initial?.type ?? "saida");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? "");
  const [supplier, setSupplier] = useState(initial?.suppliers?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [date, setDate] = useState(initial?.movement_date ?? isoDate(new Date()));
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isFixed, setIsFixed] = useState(!!initial?.is_fixed);
  const [meses, setMeses] = useState(12);

  const cats = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["cats", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, movement_type")
        .eq("restaurant_id", restaurant!.id)
        .order("name");
      return (data ?? []) as { id: string; name: string; movement_type: MovementType | null }[];
    },
  });

  const filteredCats = (cats.data ?? []).filter(
    (c) => c.movement_type === type || c.movement_type === null,
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!restaurant) throw new Error("Sem negócio");
      let supplierId: string | null = null;
      if (supplier.trim()) {
        const { data: existing } = await supabase.from("suppliers")
          .select("id").eq("restaurant_id", restaurant.id).eq("name", supplier.trim()).maybeSingle();
        if (existing) supplierId = existing.id;
        else {
          const { data: created, error } = await supabase.from("suppliers")
            .insert({ restaurant_id: restaurant.id, name: supplier.trim() }).select("id").single();
          if (error) throw error;
          supplierId = created.id;
        }
      }
      const payload = {
        restaurant_id: restaurant.id,
        type,
        category_id: categoryId || null,
        supplier_id: supplierId,
        description: description || null,
        amount: Number(amount.replace(",", ".")),
        movement_date: date,
        payment_method: paymentMethod || null,
        notes: notes || null,
        is_fixed: isFixed,
      };
      if (initial) {
        const { error } = await supabase.from("movements").update(payload).eq("id", initial.id);
        if (error) throw error;
        return 0;
      }
      const { data: created, error } = await supabase
        .from("movements")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // despesa fixa: replica automaticamente nos próximos meses
      if (isFixed && meses > 1) {
        const base = new Date(`${date}T12:00:00`);
        const dia = base.getDate();
        const futuros = [];
        for (let i = 1; i < meses; i++) {
          const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
          const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(dia, ultimoDia));
          futuros.push({ ...payload, movement_date: isoDate(d), fixed_parent_id: created.id });
        }
        const { error: recErr } = await supabase.from("movements").insert(futuros);
        if (recErr) throw recErr;
        return futuros.length;
      }
      return 0;
    },
    onSuccess: (replicas) => {
      toast.success(
        initial
          ? "Movimentação atualizada!"
          : replicas
            ? `Despesa fixa criada e lançada nos próximos ${replicas} meses!`
            : "Movimentação salva!",
      );
      onDone();
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro ao salvar")),
  });


  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => { setType(v as MovementType); setCategoryId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder={`Escolha uma categoria de ${TYPE_LABEL[type]}`} /></SelectTrigger>
          <SelectContent>
            {filteredCats.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma categoria para este tipo.</div>
            )}
            {filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Fornecedor</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="(opcional)" />
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0,00" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Compra semanal de carne" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Forma de pagamento</Label>
          <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Ex: Pix, Cartão..." />
        </div>
        <div className="space-y-2">
          <Label>Observação</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={save.isPending || !amount || !date}>
        {save.isPending ? "Salvando..." : initial ? "Salvar alterações" : "Salvar movimentação"}
      </Button>
    </form>
  );
}
