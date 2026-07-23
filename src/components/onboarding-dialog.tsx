import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sun, Moon, ArrowRight, CheckCircle2, Sparkles, PlayCircle } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";
import { useTheme, type Mode } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useProductTour } from "@/hooks/use-product-tour";

type Step = "name" | "theme" | "tour";

export function OnboardingDialog({ onCreated }: { onCreated: () => void }) {
  const { restaurant, refetch } = useRestaurant();
  const { mode, setMode } = useTheme();
  const startTour = useProductTour();
  const [step, setStep] = useState<Step>(restaurant ? "theme" : "name");
  const [name, setName] = useState(restaurant?.name ?? "");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
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
      await refetch();
      toast.success("Restaurante criado!");
      setStep("theme");
    } catch (err: unknown) {
      toast.error(translateAuthError(err, "Erro ao criar restaurante."));
    } finally {
      setLoading(false);
    }
  }

  async function finishAndStartTour(runTour: boolean) {
    setLoading(true);
    try {
      if (restaurant?.id) {
        await supabase
          .from("restaurants")
          .update({ onboarding_completed: true, ...(runTour ? {} : { tour_completed: true }) } as any)
          .eq("id", restaurant.id);
      }
      await refetch();
      onCreated();
      if (runTour && restaurant?.id) {
        // Wait for dialog to unmount + sidebar to render
        setTimeout(() => startTour({ restaurantId: restaurant.id, onDone: () => refetch() }), 400);
      }
    } finally {
      setLoading(false);
    }
  }

  let content: ReactNode = null;
  if (step === "name") {
    content = (
      <>
        <DialogHeader>
          <DialogTitle>Bem-vindo à LUUD!</DialogTitle>
          <DialogDescription>Comece dando um nome ao seu restaurante.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-2">
            <Label htmlFor="rname">Nome do restaurante</Label>
            <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pizzaria do João" autoFocus />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Continuar <ArrowRight className="h-4 w-4 ml-1" /></>)}
          </Button>
        </form>
      </>
    );
  } else if (step === "theme") {
    content = (
      <>
        <DialogHeader>
          <DialogTitle>Escolha seu tema</DialogTitle>
          <DialogDescription>Você pode mudar depois em Configurações.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {(["light", "dark"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
                  active ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
                )}
              >
                <div className={cn(
                  "h-16 w-full rounded-lg grid place-items-center",
                  m === "dark" ? "bg-zinc-900" : "bg-zinc-100"
                )}>
                  {m === "dark" ? <Moon className="h-6 w-6 text-zinc-100" /> : <Sun className="h-6 w-6 text-zinc-900" />}
                </div>
                <span className="text-sm font-medium">{m === "dark" ? "Escuro" : "Claro"}</span>
                {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setStep("tour")}>
            Continuar <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </>
    );
  } else if (step === "tour") {
    content = (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Tour rápido da plataforma
          </DialogTitle>
          <DialogDescription>
            Um passo a passo interativo pelos <strong>10 recursos mais importantes</strong> da LUUD — direto no menu de verdade, apontando cada item e explicando como usar.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2 pb-1 grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Dashboard, Movimentações, Entrada de Vendas, Metas</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Recursos <strong>PRO</strong>: CMV, Preço, Lucro por plataforma</div>
          <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <strong>Premium IA</strong>, Suporte e Configurações</div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-3">
          <Button variant="ghost" onClick={() => void finishAndStartTour(false)} disabled={loading}>
            Pular tour
          </Button>
          <Button onClick={() => void finishAndStartTour(true)} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Começar tour
          </Button>
        </div>
      </>
    );
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
