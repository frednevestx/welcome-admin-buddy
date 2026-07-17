import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";

export function OnboardingDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão expirada");

      const { data: rest, error: restErr } = await supabase
        .from("restaurants")
        .insert({ name: name.trim(), owner_id: userData.user.id })
        .select("id")
        .single();
      if (restErr) throw restErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({ id: userData.user.id, restaurant_id: rest.id, email: userData.user.email });
      if (profErr) throw profErr;

      await supabase.rpc("seed_default_categories", { _restaurant_id: rest.id });

      toast.success("Restaurante criado!");
      onCreated();
    } catch (err: unknown) {
      toast.error(translateAuthError(err, "Erro ao criar restaurante."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bem-vindo!</DialogTitle>
          <DialogDescription>
            Antes de começar, dê um nome ao seu restaurante.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rname">Nome do restaurante</Label>
            <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pizzaria do João" autoFocus />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar restaurante"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
