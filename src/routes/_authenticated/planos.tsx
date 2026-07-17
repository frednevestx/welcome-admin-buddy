import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Star, Crown } from "lucide-react";
import { usePlan, type PlanTier } from "@/hooks/use-plan";
import { PLAN_FEATURES, PLAN_LABEL, PLAN_PRICES } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlanosPage,
});

type Cycle = "mensal" | "semestral" | "anual";

const CYCLE_LABEL: Record<Cycle, string> = {
  mensal: "Mensal",
  semestral: "Semestral",
  anual: "Anual",
};

const CYCLE_DISCOUNT: Record<Cycle, string | null> = {
  mensal: null,
  semestral: "-10%",
  anual: "-16%",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PlanosPage() {
  const [cycle, setCycle] = useState<Cycle>("anual");
  const { effectivePlan, status, daysLeftInTrial } = usePlan();
  const [checkoutMap, setCheckoutMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (supabase.from("checkout_settings" as any).select("plan, cycle, url") as any)
      .then(({ data }: any) => {
        if (!alive || !data) return;
        const m: Record<string, string> = {};
        data.forEach((r: any) => { if (r?.url) m[`${r.plan}:${r.cycle}`] = r.url; });
        setCheckoutMap(m);
      });
    return () => { alive = false; };
  }, []);

  const plans: PlanTier[] = ["basico", "pro", "premium"];
  const fallback = "https://wa.me/5562993969722?text=Ol%C3%A1%2C%20Quero%20descobrir%20os%20lucros%20do%20meu%20restaurante!%20%F0%9F%93%88";


  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          {status === "trialing"
            ? `Você está no teste grátis — faltam ${daysLeftInTrial} ${daysLeftInTrial === 1 ? "dia" : "dias"}`
            : "Escolha o plano ideal para o seu restaurante"}
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Planos e preços</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Quanto maior o ciclo, maior o desconto. Pagamento em plataforma externa — seu acesso é liberado após confirmação.
        </p>

        <div className="inline-flex rounded-full border border-border p-1 mt-4 bg-card">
          {(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-full transition-colors inline-flex items-center gap-2",
                cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {CYCLE_LABEL[c]}
              {CYCLE_DISCOUNT[c] && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  cycle === c ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                )}>{CYCLE_DISCOUNT[c]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {plans.map((p) => {
          const price = PLAN_PRICES[p][cycle];
          const monthly = cycle === "mensal" ? price : cycle === "semestral" ? price / 6 : price / 12;
          const mensalTotal = PLAN_PRICES[p].mensal * (cycle === "semestral" ? 6 : cycle === "anual" ? 12 : 1);
          const savings = cycle === "mensal" ? 0 : mensalTotal - price;
          const featured = p === "pro";
          const premiumHl = p === "premium";
          const isCurrent = effectivePlan === p;
          const url = checkoutMap[`${p}:${cycle}`] || fallback;

          return (
            <Card
              key={p}
              className={cn(
                "p-6 flex flex-col gap-5 border-border/60 relative",
                featured && "border-primary shadow-lg md:scale-[1.03]",
                premiumHl && "border-transparent",
              )}
              style={
                premiumHl
                  ? {
                      background: "linear-gradient(180deg, oklch(0.72 0.18 148 / 0.06), var(--card))",
                      boxShadow: "0 0 0 1px oklch(0.72 0.18 148 / 0.35), 0 20px 40px -20px oklch(0.72 0.18 148 / 0.35)",
                    }
                  : undefined
              }
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                  <Star className="h-3 w-3 fill-current" /> Mais popular
                </span>
              )}
              {premiumHl && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                  <Crown className="h-3 w-3 fill-current" /> Premium com IA
                </span>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-secondary border border-border text-xs font-medium">
                  Plano atual
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground">Plano</div>
                <div className="text-2xl font-semibold tracking-tight">{PLAN_LABEL[p]}</div>
              </div>

              <div>
                <div className="text-3xl font-bold tracking-tight">{formatBRL(monthly)}</div>
                <div className="text-xs text-muted-foreground">
                  por mês
                  {cycle !== "mensal" && <> · total de {formatBRL(price)} no {CYCLE_LABEL[cycle].toLowerCase()}</>}
                </div>
                {savings > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                    Economize {formatBRL(savings)}
                  </div>
                )}
              </div>

              {isCurrent ? (
                <Button size="lg" variant="outline" disabled>Seu plano atual</Button>
              ) : (
                <a href={url} target="_blank" rel="noreferrer">
                  <Button size="lg" className="w-full" variant={featured || premiumHl ? "default" : "outline"}>
                    Assinar {PLAN_LABEL[p]}
                  </Button>
                </a>
              )}

              <ul className="space-y-2 text-sm">
                {PLAN_FEATURES[p].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto">
        Após o pagamento no checkout externo, a administração libera seu acesso pelo e-mail cadastrado.
        Se precisar de ajuda, fale com o <a href="https://wa.me/5562993969722?text=Ol%C3%A1%2C%20Quero%20descobrir%20os%20lucros%20do%20meu%20restaurante!%20%F0%9F%93%88" target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">suporte</a>.
      </p>
    </div>
  );
}
