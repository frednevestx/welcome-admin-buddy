import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Sun, Moon, LayoutDashboard, ArrowRightLeft, Upload, Target,
  Bell, PieChart, Calculator, BarChart3, FileText, Bot, Settings, ArrowRight, ArrowLeft, CheckCircle2,
} from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";
import { useTheme, type Mode } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";

type Step = "name" | "theme" | "tutorial" | "done";

interface TutorialSlide {
  icon: typeof LayoutDashboard;
  title: string;
  badge?: "PRO" | "IA";
  description: string;
}

const TUTORIAL: TutorialSlide[] = [
  { icon: LayoutDashboard, title: "Dashboard", description: "Visão geral do faturamento, custos e lucro em tempo real. Seu ponto de partida diário." },
  { icon: ArrowRightLeft, title: "Movimentações", description: "Registre entradas e saídas manualmente para manter seu caixa 100% preciso." },
  { icon: Upload, title: "Importações", description: "Importe planilhas do iFood e outros sistemas para consolidar tudo automaticamente." },
  { icon: Target, title: "Metas", description: "Defina objetivos de faturamento e acompanhe seu progresso diariamente." },
  { icon: Bell, title: "Alertas e Evolução", description: "Receba avisos quando algo sair do padrão e visualize sua evolução ao longo do tempo." },
  { icon: PieChart, title: "CMV", badge: "PRO", description: "Custo da Mercadoria Vendida — saiba exatamente quanto cada prato realmente custa." },
  { icon: Calculator, title: "Calculadora de Preço", badge: "PRO", description: "Descubra o preço ideal de venda com base em custos, margem e concorrência." },
  { icon: BarChart3, title: "Lucro por Plataforma", badge: "PRO", description: "Compare quanto sobra em cada canal: iFood, Rappi, salão, delivery próprio." },
  { icon: FileText, title: "Relatórios", badge: "PRO", description: "Exporte relatórios detalhados para contador, sócios e planejamento." },
  { icon: Bot, title: "Assistente IA + Configurações", badge: "IA", description: "Converse com a IA sobre seu negócio e personalize sua conta em Configurações." },
];

export function OnboardingDialog({ onCreated }: { onCreated: () => void }) {
  const { restaurant, refetch } = useRestaurant();
  const { mode, setMode } = useTheme();
  const [step, setStep] = useState<Step>(restaurant ? "theme" : "name");
  const [name, setName] = useState(restaurant?.name ?? "");
  const [tutorialIdx, setTutorialIdx] = useState(0);
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

  async function finish() {
    setLoading(true);
    try {
      if (restaurant?.id) {
        await supabase.from("restaurants").update({ onboarding_completed: true }).eq("id", restaurant.id);
      }
      await refetch();
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  const slide = TUTORIAL[tutorialIdx];

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
          <Button onClick={() => setStep("tutorial")}>
            Continuar <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </>
    );
  } else if (step === "tutorial") {
    const Icon = slide.icon;
    const isLast = tutorialIdx === TUTORIAL.length - 1;
    content = (
      <>
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tour rápido</span>
            <span>·</span>
            <span>{tutorialIdx + 1} de {TUTORIAL.length}</span>
          </div>
          <DialogTitle className="flex items-center gap-2 pt-1">
            {slide.title}
            {slide.badge && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                slide.badge === "IA" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
              )}>
                {slide.badge}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="pt-1">{slide.description}</DialogDescription>
        </DialogHeader>
        <div className="py-6 flex justify-center">
          <div className="h-20 w-20 rounded-2xl grid place-items-center" style={{ background: "var(--gradient-primary, var(--primary))" }}>
            <Icon className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1 justify-center pb-3">
          {TUTORIAL.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === tutorialIdx ? "w-6 bg-primary" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTutorialIdx((i) => Math.max(0, i - 1))}
            disabled={tutorialIdx === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => void finish()} disabled={loading}>
              Pular tour
            </Button>
            {isLast ? (
              <Button size="sm" onClick={() => void finish()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Começar a usar <Settings className="h-4 w-4 ml-1" /></>)}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setTutorialIdx((i) => i + 1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
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
