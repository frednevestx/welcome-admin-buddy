import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { saveMovementWeb } from "@/lib/movements/movements.functions";
import { parseBRL, todayInSaoPaulo } from "@/lib/date-br";
import { translateAuthError } from "@/lib/auth-errors";
import { type Category, type MovementRow, type MovementType, TYPE_LABEL } from "@/lib/movements/view-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function MovementForm({ initial, categories, onDone }: { initial?: MovementRow; categories: Category[]; onDone: () => void }) {
  const { restaurant } = useRestaurant();
  const [type, setType] = useState<MovementType>(initial?.type ?? "saida");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "none");
  const [supplier, setSupplier] = useState(initial?.supplier_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? Number(initial.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const [date, setDate] = useState(initial?.movement_date ?? todayInSaoPaulo());
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isFixed, setIsFixed] = useState(!!initial?.is_fixed);
  const [months, setMonths] = useState(12);
  const saveFn = useServerFn(saveMovementWeb);

  const suppliers = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["movement-suppliers", restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase.from("suppliers").select("id,name").eq("restaurant_id", restaurant.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const compatibleCategories = categories.filter((category) => !category.archived_at && (category.movement_type === type || category.movement_type === null));
  const save = useMutation({
    mutationFn: async () => {
      if (!restaurant) throw new Error("Nenhum negócio vinculado à sua conta.");
      const parsedAmount = parseBRL(amount);
      if (!parsedAmount || parsedAmount <= 0) throw new Error("Informe um valor maior que zero.");
      if (!date) throw new Error("Informe a data do lançamento.");
      if (supplier.trim().length > 120) throw new Error("O fornecedor deve ter no máximo 120 caracteres.");
      const base = {
        type,
        amount: parsedAmount,
        movement_date: date,
        description: description.trim() || null,
        category_id: categoryId === "none" ? null : categoryId,
        supplier_name: supplier.trim() || null,
        payment_method: paymentMethod.trim() || null,
        notes: notes.trim() || null,
        is_fixed: isFixed && type === "saida",
      };
      if (initial) {
        await saveFn({ data: { ...base, id: initial.id } });
        return 0;
      }
      const parent = await saveFn({ data: base });
      if (!isFixed || type !== "saida" || months <= 1) return 0;
      const [yearText, monthText, dayText] = date.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      for (let index = 1; index < months; index += 1) {
        const target = new Date(Date.UTC(year, month - 1 + index, 1));
        const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
        const recurringDate = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
        await saveFn({ data: { ...base, movement_date: recurringDate, fixed_parent_id: parent.id } });
      }
      return months - 1;
    },
    onSuccess: (replicas) => {
      toast.success(initial ? "Lançamento atualizado" : replicas ? `Lançamento criado por ${replicas + 1} meses` : "Lançamento criado");
      onDone();
    },
    onError: (error) => toast.error(translateAuthError(error, "Não foi possível salvar o lançamento.")),
  });

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label>Tipo</Label><Select value={type} onValueChange={(value) => { setType(value as MovementType); setCategoryId("none"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["entrada", "saida", "transferencia", ...(initial?.type === "ajuste" ? ["ajuste" as const] : [])] as MovementType[]).map((value) => <SelectItem key={value} value={value}>{TYPE_LABEL[value]}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Data</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      </div>
      <div className="space-y-2"><Label>Categoria</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger><SelectContent><SelectItem value="none">Sem categoria</SelectItem>{compatibleCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label>Fornecedor/Contato</Label><Input list="movement-suppliers" maxLength={120} value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Digite ou selecione" /><datalist id="movement-suppliers">{(suppliers.data ?? []).map((item) => <option key={item.id} value={item.name} />)}</datalist></div>
        <div className="space-y-2"><Label>Valor (R$)</Label><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="0,00" /></div>
      </div>
      <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: compra de mercadorias" /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label>Forma de pagamento</Label><Input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="Pix, cartão..." /></div>
        <div className="space-y-2"><Label>Observação</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
      </div>
      {type === "saida" && <div className="space-y-3 rounded-md border border-border p-3"><div className="flex items-center justify-between gap-3"><div><Label>Despesa fixa</Label><p className="text-xs text-muted-foreground">Repetir automaticamente nos próximos meses.</p></div><Switch checked={isFixed} onCheckedChange={setIsFixed} /></div>{isFixed && !initial && <Select value={String(months)} onValueChange={(value) => setMonths(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[3, 6, 12, 24].map((value) => <SelectItem key={value} value={String(value)}>{value} meses</SelectItem>)}</SelectContent></Select>}</div>}
      <Button className="w-full" type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : initial ? "Salvar alterações" : "Salvar lançamento"}</Button>
    </form>
  );
}