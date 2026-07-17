import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlan, type PlanTier } from "@/hooks/use-plan";
import { PLAN_LABEL } from "@/lib/plan-features";

export function PlanGate({
  min,
  featureName,
  description,
  children,
}: {
  min: PlanTier;
  featureName: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { can, loading } = usePlan();
  if (loading) return null;
  if (can(min)) return <>{children}</>;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Card className="p-8 text-center space-y-5 border-border/60">
        <div className="h-14 w-14 rounded-2xl grid place-items-center mx-auto" style={{ background: "var(--gradient-primary)" }}>
          {min === "premium" ? <Sparkles className="h-6 w-6 text-primary-foreground" /> : <Lock className="h-6 w-6 text-primary-foreground" />}
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-secondary text-xs font-medium">
            Disponível no plano {PLAN_LABEL[min]}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{featureName}</h2>
          {description && <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>}
        </div>
        <Button asChild size="lg">
          <Link to="/planos">Ver planos e fazer upgrade</Link>
        </Button>
      </Card>
    </div>
  );
}
