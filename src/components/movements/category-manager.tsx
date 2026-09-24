import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { translateAuthError } from "@/lib/auth-errors";
import { CATEGORY_COLORS, CATEGORY_COLOR_CLASS, type Category } from "@/lib/movements/view-model";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<"entrada" | "saida">("saida");
  const [color, setColor] = useState<(typeof CATEGORY_COLORS)[number]>(CATEGORY_COLORS[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["movement-categories"] });
    await qc.invalidateQueries({ queryKey: ["movements"] });
  };
  const create = useMutation({
    mutationFn: async () => {
      if (!restaurant?.id || !name.trim()) throw new Error("Informe o nome da categoria.");
      const { error } = await supabase.from("categories").insert({ restaurant_id: restaurant.id, name: name.trim(), movement_type: type, color, is_default: false, is_system: false });
      if (error) throw error;
    },
    onSuccess: async () => { setName(""); await refresh(); toast.success("Categoria criada"); },
    onError: (error) => toast.error(translateAuthError(error, "Não foi possível criar a categoria.")),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; color?: string; archived_at?: string } }) => {
      const { error } = await supabase.from("categories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { setEditing(null); await refresh(); toast.success("Categoria atualizada"); },
    onError: (error) => toast.error(translateAuthError(error, "Não foi possível atualizar a categoria.")),
  });

  return <div className="space-y-5">
    <form className="space-y-3 rounded-md border border-border p-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nova categoria" maxLength={80} /><Select value={type} onValueChange={(value) => setType(value as "entrada" | "saida")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent></Select><Button type="submit" disabled={!name.trim() || create.isPending}><Plus className="h-4 w-4" /> Criar</Button></div>
      <div className="flex flex-wrap gap-2" aria-label="Cor da categoria">{CATEGORY_COLORS.map((item) => <Button key={item} type="button" variant="ghost" size="icon" className={cn("h-8 w-8", color === item && "ring-2 ring-primary")} onClick={() => setColor(item)} aria-label={`Escolher cor ${item}`}><span className={cn("h-4 w-4 rounded-full", CATEGORY_COLOR_CLASS[item])} /></Button>)}</div>
    </form>
    {(["entrada", "saida"] as const).map((section) => <section key={section} className="space-y-2"><h3 className="text-sm font-medium">{section === "entrada" ? "Entradas" : "Saídas"}</h3>{categories.filter((category) => category.movement_type === section && !category.archived_at).map((category) => <div key={category.id} className="flex items-center gap-2 rounded-md border border-border p-2">{editing === category.id ? <><Input className="h-8" autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} /><Button size="icon" variant="ghost" aria-label="Salvar nome" onClick={() => update.mutate({ id: category.id, patch: { name: editingName.trim() } })}><Check className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button></> : <><span className={cn("h-3 w-3 shrink-0 rounded-full", CATEGORY_COLOR_CLASS[category.color])} /><span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>{category.is_system && <Badge variant="secondary">Sistema</Badge>}<Select value={category.color} onValueChange={(value) => update.mutate({ id: category.id, patch: { color: value } })}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_COLORS.map((item) => <SelectItem key={item} value={item}><span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", CATEGORY_COLOR_CLASS[item])} />Cor</span></SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" aria-label={`Renomear ${category.name}`} onClick={() => { setEditing(category.id); setEditingName(category.name); }}><Pencil className="h-4 w-4" /></Button>{!category.is_system && <Button size="icon" variant="ghost" aria-label={`Arquivar ${category.name}`} onClick={() => update.mutate({ id: category.id, patch: { archived_at: new Date().toISOString() } })}><Archive className="h-4 w-4" /></Button>}</>}</div>)}</section>)}
  </div>;
}