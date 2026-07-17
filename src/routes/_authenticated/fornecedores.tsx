import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { PlanGate } from "@/components/plan-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Phone, Mail } from "lucide-react";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  component: () => (
    <PlanGate min="pro" featureName="Fornecedores" description="Centralize contatos e histórico de compras dos seus fornecedores.">
      <FornecedoresPage />
    </PlanGate>
  ),
});

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  products: string | null;
  notes: string | null;
};

type SupplierStats = {
  total_amount: number;
  purchases_count: number;
  first_purchase: string | null;
  last_purchase: string | null;
  avg_price: number;
  max_price: number;
  min_price: number;
};

const emptyForm: Omit<Supplier, "id"> = { name: "", contact_name: "", phone: "", products: "", notes: "" };

function FornecedoresPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["suppliers", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, contact_name, phone, products, notes")
        .eq("restaurant_id", restaurant!.id)
        .order("name");
      return (data ?? []) as Supplier[];
    },
  });

  const stats = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["supplier-stats", restaurant?.id],
    queryFn: async () => {
      const { data: mov } = await supabase
        .from("movements")
        .select("supplier_id, amount, movement_date")
        .eq("restaurant_id", restaurant!.id)
        .eq("type", "compra")
        .not("supplier_id", "is", null);
      const map = new Map<string, SupplierStats>();
      (mov ?? []).forEach((m: any) => {
        if (!m.supplier_id) return;
        const s = map.get(m.supplier_id) ?? {
          total_amount: 0, purchases_count: 0, first_purchase: null, last_purchase: null,
          avg_price: 0, max_price: 0, min_price: Infinity,
        };
        s.total_amount += Number(m.amount);
        s.purchases_count += 1;
        s.max_price = Math.max(s.max_price, Number(m.amount));
        s.min_price = Math.min(s.min_price, Number(m.amount));
        if (!s.first_purchase || m.movement_date < s.first_purchase) s.first_purchase = m.movement_date;
        if (!s.last_purchase || m.movement_date > s.last_purchase) s.last_purchase = m.movement_date;
        map.set(m.supplier_id, s);
      });
      map.forEach((s) => {
        s.avg_price = s.purchases_count > 0 ? s.total_amount / s.purchases_count : 0;
        if (s.min_price === Infinity) s.min_price = 0;
      });
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !restaurant) return;
      if (editing) {
        const { error } = await supabase.from("suppliers").update({
          name: form.name.trim(),
          contact_name: form.contact_name || null,
          phone: form.phone || null,
          products: form.products || null,
          notes: form.notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({
          restaurant_id: restaurant.id,
          name: form.name.trim(),
          contact_name: form.contact_name || null,
          phone: form.phone || null,
          products: form.products || null,
          notes: form.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setOpen(false); setEditing(null); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editing ? "Fornecedor atualizado" : "Fornecedor criado");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor removido");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro ao remover")),
  });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((f) =>
      f.name.toLowerCase().includes(s) ||
      (f.products?.toLowerCase().includes(s)) ||
      (f.contact_name?.toLowerCase().includes(s))
    );
  }, [q.data, search]);

  function openNew() {
    setEditing(null); setForm(emptyForm); setOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contact_name: s.contact_name ?? "",
      phone: s.phone ?? "",
      products: s.products ?? "",
      notes: s.notes ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre seus fornecedores e acompanhe o histórico de compras de cada um.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo fornecedor</Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, produto ou contato" className="pl-9" />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((s) => {
          const st = stats.data?.get(s.id);
          return (
            <Card key={s.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  {s.contact_name && <div className="text-xs text-muted-foreground">{s.contact_name}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {(s.phone || s.products) && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {s.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                  {s.products && <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{s.products}</span>}
                </div>
              )}
              {st && st.purchases_count > 0 ? (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60 text-xs">
                  <Stat label="Compras" value={String(st.purchases_count)} />
                  <Stat label="Total" value={formatBRL(st.total_amount)} />
                  <Stat label="Média" value={formatBRL(st.avg_price)} />
                  <Stat label="Menor" value={formatBRL(st.min_price)} />
                  <Stat label="Maior" value={formatBRL(st.max_price)} />
                  <Stat label="Última" value={st.last_purchase ? new Date(st.last_purchase + "T00:00:00").toLocaleDateString("pt-BR") : "—"} />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground pt-3 border-t border-border/60">Nenhuma compra registrada.</div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && !q.isLoading && (
          <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">
            Nenhum fornecedor {search ? "para essa busca" : "cadastrado"}.
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Contato</Label><Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Pessoa responsável" /></div>
            <div><Label>Telefone / WhatsApp</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Produtos fornecidos</Label><Input value={form.products ?? ""} onChange={(e) => setForm({ ...form, products: e.target.value })} placeholder="Ex: Carnes, embalagens" /></div>
            <div><Label>Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}