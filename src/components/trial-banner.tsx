import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/use-plan";
import { useState } from "react";

export function TrialBanner() {
  const { status, daysLeftInTrial, loading } = usePlan();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;
  if (status !== "trialing") {
    if (status === "expired") {
      return (
        <div className="rounded-xl border border-border/60 bg-secondary/60 px-4 py-3 flex items-center gap-3">
          <div className="flex-1 text-sm">
            Seu teste grátis terminou. Escolha um plano para continuar usando todos os recursos.
          </div>
          <Button asChild size="sm">
            <Link to="/planos">Ver planos</Link>
          </Button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/20 px-4 py-3 flex items-center gap-3" style={{ background: "color-mix(in oklch, var(--primary) 8%, transparent)" }}>
      <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Você está no Premium grátis</div>
        <div className="text-xs text-muted-foreground">
          {daysLeftInTrial > 0 ? `Faltam ${daysLeftInTrial} ${daysLeftInTrial === 1 ? "dia" : "dias"} de teste.` : "Seu teste termina hoje."}
        </div>
      </div>
      <Button asChild size="sm" variant="default">
        <Link to="/planos">Escolher plano</Link>
      </Button>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Dispensar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
