import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/categorias")({
  component: CategoriesPage,
});

type Category = { id: string; name: string; is_default: boolean };

function CategoriesPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const q = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["cats", restaurant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, is_default")
        .eq("restaurant_id", restaurant!.id)
        .order("name");
      return (data ?? []) as Category[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !restaurant) return;
      const { error } = await supabase
        .from("categories")
        .insert({ restaurant_id: restaurant.id, name: name.trim(), is_default: false });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["cats"] });
      toast.success("Categoria criada");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  const update = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const { error } = await supabase
        .from("categories")
        .update({ name: newName.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingName("");
      qc.invalidateQueries({ queryKey: ["cats"] });
      toast.success("Categoria atualizada");
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro ao atualizar")),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["cats"] });
      toast.success("Categoria removida");
    },
    onError: (e: any) => {
      setConfirmDelete(null);
      toast.error(translateAuthError(e, "Não foi possível remover. Talvez existam movimentações usando esta categoria."));
    },
  });

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditingName(c.name);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }
  function saveEdit(id: string) {
    if (!editingName.trim()) return;
    update.mutate({ id, newName: editingName });
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground mt-1">Organize seus gastos por categoria. Você pode renomear ou excluir as que criou.</p>
      </div>

      <Card className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.data ?? []).map((c) => {
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40 border border-border/60"
              >
                {isEditing ? (
                  <>
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-8"
                    />
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => saveEdit(c.id)}
                        disabled={update.isPending || !editingName.trim()}
                        title="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={cancelEdit} title="Cancelar">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.is_default && <Badge variant="secondary" className="text-xs">padrão</Badge>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(c)}
                        title="Renomear"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(c)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {(q.data ?? []).length === 0 && !q.isLoading && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-6">
              Nenhuma categoria ainda. Crie a primeira acima.
            </p>
          )}
        </div>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria <b>{confirmDelete?.name}</b> será removida. Movimentações antigas ficarão sem categoria, mas os valores serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) del.mutate(confirmDelete.id);
              }}
              disabled={del.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
