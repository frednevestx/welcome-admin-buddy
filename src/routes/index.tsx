import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { PLAN_FEATURES, PLAN_LABEL, PLAN_PRICES, PLAN_PROMISE, PLAN_TAGLINE } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import rafaelPhoto from "@/assets/testimonial-rafael.jpg.asset.json";
import julianaPhoto from "@/assets/testimonial-juliana.jpg.asset.json";
import diegoPhoto from "@/assets/testimonial-diego.jpg.asset.json";
import {
  TrendingUp, TrendingDown, PiggyBank, Bell, CheckCircle2, ArrowRight, Sparkles, Star, Crown,
  Brain, BrainCircuit, Zap, Utensils, ChevronRight, PackageOpen, Percent, AlertTriangle,
  Instagram, MessageCircle, Mail, ArrowUpRight, Cpu, Receipt, Lightbulb, ArrowDown, Moon,
  Users, Coffee, IceCream, Pizza, Sandwich, Fish, ShoppingBag, Ghost, Beef, DollarSign,
  Target, Clock, BarChart3, ChefHat, Plus, Minus, HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "LUUD — IA que descobre dinheiro perdido no seu restaurante" },
      { name: "description", content: "Enquanto você trabalha, a LUUD analisa vendas, custos, fornecedores, CMV, clientes e taxas para mostrar exatamente onde aumentar seu lucro." },
      { property: "og:title", content: "LUUD — IA que descobre dinheiro perdido no seu restaurante" },
      { property: "og:description", content: "Sua IA pode encontrar dinheiro perdido no seu restaurante todos os dias. Teste grátis por 7 dias." },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    const html = document.documentElement;
    const hadLight = html.classList.contains("light");
    html.classList.remove("light");
    return () => { if (hadLight) html.classList.add("light"); };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden antialiased">
      <TopBar />
      <Hero />
      <RestaurantTypes />
      <PainFlow />
      <TheTurn />
      <TodayAI />
      <DashboardShowcase />
      <ChatWithBusiness />
      <WhileYouSlept />
      <BeforeAfter />
      <TryInvite />
      <SevenDays />
      <QuickResults />
      <SocialProof />
      <Plans />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ─────────────────── TOP BAR ─────────────────── */

function TopBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground font-medium">
          <a href="#ia" className="hover:text-foreground transition-colors">IA</a>
          <a href="#dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
          <a href="#resultados" className="hover:text-foreground transition-colors">Resultados</a>
          <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button size="sm" variant="ghost" className="hidden sm:inline-flex">Entrar</Button></Link>
          <Link to="/auth"><Button size="sm" className="shadow-[var(--shadow-glow)]">Começar grátis</Button></Link>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────── 1. HERO ─────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-95" style={{ background: "var(--gradient-hero)" }} aria-hidden />
      <div
        className="absolute inset-0 -z-20 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(oklch(1 0 0 / 0.7) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.7) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 80%)",
        }}
        aria-hidden
      />
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left animate-slide-up-fade">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary font-medium mb-6">
              <BrainCircuit className="h-3.5 w-3.5" /> IA financeira para restaurantes
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Sua IA pode encontrar <span className="text-primary">dinheiro perdido</span> no seu restaurante todos os dias.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Enquanto você trabalha, a <span className="text-foreground font-medium">LUUD</span> analisa vendas, custos, fornecedores, CMV, clientes e taxas para mostrar exatamente onde aumentar seu lucro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-6 gap-2 shadow-[var(--shadow-glow)] font-semibold">
                  Começar teste grátis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#ia">
                <Button size="lg" variant="outline" className="h-12 px-6 font-semibold">
                  Ver a IA trabalhando
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground justify-center lg:justify-start">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> 7 dias grátis</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span>
            </div>
          </div>

          <div className="relative animate-slide-up-fade" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-6 -z-10 rounded-[2rem] opacity-40 blur-3xl" style={{ background: "var(--gradient-primary)" }} />
            <AIOpportunitiesMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function AIOpportunitiesMock() {
  const findings = [
    { icon: PackageOpen, text: "Encontramos R$ 680 em economia com embalagens" },
    { icon: Users, text: "12 clientes estão há 35 dias sem comprar" },
    { icon: TrendingUp, text: "O Combo Família pode render mais R$ 1.240/mês" },
    { icon: Percent, text: "Reajuste de 4% recuperaria R$ 2.360 este mês" },
  ];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-border overflow-hidden backdrop-blur-xl"
        style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border/60">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          <span className="ml-3 text-xs text-muted-foreground font-mono">luud.app / oportunidades</span>
          <span className="ml-auto text-[10px] text-primary flex items-center gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> analisando
          </span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-primary">IA LUUD</div>
              <div className="text-[10px] text-muted-foreground">Encontrei 4 oportunidades agora</div>
            </div>
          </div>
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3 animate-slide-up-fade" style={{ animationDelay: `${300 + i * 150}ms` }}>
                <div className="h-8 w-8 rounded-lg grid place-items-center border border-primary/30 bg-primary/5 shrink-0">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground/90">{f.text}</div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-1" />
              </li>
            ))}
          </ul>
          <div className="rounded-xl p-4 border border-primary/30" style={{ background: "linear-gradient(135deg, oklch(0.82 0.16 172 / 0.12), oklch(0.2 0.03 230 / 0.6))" }}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Economia potencial este mês</div>
            <div className="font-display text-3xl font-bold text-primary mt-1">R$ 4.280</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── 2. RESTAURANTES QUE UTILIZAM ─────────────────── */

function RestaurantTypes() {
  const types = [
    { icon: Beef, label: "Hamburguerias" },
    { icon: Pizza, label: "Pizzarias" },
    { icon: Fish, label: "Sushi" },
    { icon: ShoppingBag, label: "Açaí" },
    { icon: IceCream, label: "Sorveterias" },
    { icon: Sandwich, label: "Lanchonetes" },
    { icon: Utensils, label: "Marmitarias" },
    { icon: Coffee, label: "Cafeterias" },
    { icon: Ghost, label: "Dark Kitchens" },
  ];
  const names = ["Burger Prime", "Bella Massa", "Urban Burgers", "Sushi Wave", "Tempero Caseiro", "Hot Chicken", "Café Central", "Smash Club", "Pizza Nostra", "Açaí Point"];
  const loop = [...names, ...names];
  const numbers = [
    { value: 3500, suffix: "+", label: "restaurantes" },
    { value: 18, suffix: "M+", label: "pedidos analisados" },
    { value: 96, suffix: "k+", label: "recomendações da IA" },
  ];

  return (
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            <span className="h-px w-8 bg-primary/50" /> Feita para <span className="h-px w-8 bg-primary/50" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Restaurantes que <span className="text-primary">usam LUUD</span>.
          </h2>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-9 gap-2 md:gap-3 mb-10">
          {types.map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-card/40 backdrop-blur p-3 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors">
              <t.icon className="h-5 w-5 text-primary" />
              <span className="text-[11px] text-center text-foreground/80 leading-tight">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="relative mb-10">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <div className="flex gap-3 animate-ticker-x w-max">
            {loop.map((n, i) => (
              <div key={i} className="shrink-0 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm text-muted-foreground">
                {n}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {numbers.map((n) => (
            <div key={n.label} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 text-center">
              <div className="font-display text-4xl md:text-5xl font-bold text-primary tracking-tight">
                <AnimatedNumber to={n.value} />{n.suffix}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{n.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedNumber({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(Math.round(to * eased));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      });
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n.toLocaleString("pt-BR")}</span>;
}

/* ─────────────────── 3. A DOR (fluxo) ─────────────────── */

function PainFlow() {
  const steps = [
    "Você vende.",
    "O dinheiro entra.",
    "Fornecedor aumenta.",
    "iFood cobra taxa.",
    "Ingredientes aumentam.",
    "Embalagem fica mais cara.",
    "Você continua trabalhando.",
    "No fim do mês sobra menos.",
    "Você não sabe por quê.",
  ];
  return (
    <section className="border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
            <span className="h-px w-8 bg-destructive/50" /> A dor <span className="h-px w-8 bg-destructive/50" />
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Todo mês <span className="text-destructive">a mesma história</span>.
          </h2>
        </div>
        <div className="flex flex-col items-center gap-1">
          {steps.map((s, i) => (
            <div key={s} className="w-full max-w-md">
              <div className={cn(
                "rounded-xl border px-5 py-3.5 text-center text-sm md:text-base transition-all",
                i === steps.length - 1
                  ? "border-destructive/50 bg-destructive/10 text-foreground font-semibold"
                  : "border-border/60 bg-card/40 text-foreground/90"
              )}>
                {s}
              </div>
              {i < steps.length - 1 && <ArrowDown className="h-4 w-4 text-muted-foreground/60 mx-auto my-1.5" />}
            </div>
          ))}
        </div>
        <p className="text-center text-muted-foreground mt-10 text-lg max-w-xl mx-auto">
          A maioria dos restaurantes descobre isso <span className="text-foreground font-medium">tarde demais</span>.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────── 4. A VIRADA ─────────────────── */

function TheTurn() {
  const steps = [
    { icon: Receipt, title: "Você vende", desc: "Pelo iFood, salão, WhatsApp ou delivery próprio." },
    { icon: PackageOpen, title: "LUUD organiza", desc: "Todos os dados consolidados automaticamente." },
    { icon: Cpu, title: "IA analisa", desc: "Custos, margens, taxas, clientes e tendências." },
    { icon: Lightbulb, title: "Você recebe recomendações", desc: "Ações claras para aumentar seu lucro." },
  ];
  return (
    <section className="border-b border-border relative">
      <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.82 0.16 172 / 0.08), transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-widest mb-4">
            <span className="h-px w-8 bg-primary/50" /> A virada <span className="h-px w-8 bg-primary/50" />
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Enquanto você trabalha, <span className="text-primary">a IA faz isso por você</span>.
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-3 md:gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-6 h-full hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl grid place-items-center border border-primary/30" style={{ background: "var(--gradient-glass)" }}>
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-display text-3xl font-bold text-primary/20">0{i + 1}</span>
                </div>
                <div className="font-semibold text-base">{s.title}</div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <>
                  <ChevronRight className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 h-5 w-5 text-primary/50" />
                  <ArrowDown className="md:hidden mx-auto my-2 h-4 w-4 text-primary/50" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 5. HOJE A IA ENCONTROU ─────────────────── */

function TodayAI() {
  const cards = [
    { icon: TrendingUp, label: "Fornecedor", value: "Aumentou 12%", desc: "Nova cotação disponível economiza R$ 320/mês." },
    { icon: ChefHat, label: "CMV do hambúrguer", value: "Alto (38%)", desc: "Meta é 30%. Ajuste de porção pode recuperar 6 pontos." },
    { icon: DollarSign, label: "Produto abaixo do preço", value: "Combo Família", desc: "Preço 8% abaixo do sugerido. Impacto: +R$ 1.240/mês." },
    { icon: Users, label: "Clientes sumindo", value: "18 inativos", desc: "Sem comprar há mais de 30 dias. Cupom pode recuperar R$ 2.400." },
  ];
  return (
    <section id="ia" className="border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 30%, oklch(0.82 0.16 172 / 0.10), transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6 font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Análise em tempo real
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Hoje a IA <span className="text-primary">encontrou isso</span>.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5 flex gap-4 hover:border-primary/40 transition-all">
              <div className="h-11 w-11 rounded-xl grid place-items-center border border-primary/30 bg-primary/5 shrink-0">
                <c.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                <div className="font-display text-lg font-bold text-primary">{c.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-primary/40 p-6 text-center" style={{ background: "linear-gradient(135deg, oklch(0.82 0.16 172 / 0.10), oklch(0.2 0.03 230 / 0.6))" }}>
          <div className="text-sm text-muted-foreground">Somando tudo, você pode ganhar</div>
          <div className="font-display text-4xl md:text-5xl font-bold text-primary mt-1">+ R$ 4.280 este mês</div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 6. DASHBOARD ─────────────────── */

function DashboardShowcase() {
  const modules = [
    { icon: DollarSign, name: "Financeiro" },
    { icon: ChefHat, name: "CMV" },
    { icon: Users, name: "Clientes" },
    { icon: BarChart3, name: "Fluxo de Caixa" },
    { icon: PackageOpen, name: "Fornecedores" },
    { icon: Receipt, name: "Relatórios" },
    { icon: Brain, name: "IA" },
  ];
  return (
    <section id="dashboard" className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Todo seu restaurante <span className="text-primary">em um lugar só</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Módulos que conversam entre si — e com a IA.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
          {modules.map((m) => (
            <div key={m.name} className="rounded-xl border border-border bg-card/40 backdrop-blur p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:-translate-y-0.5 transition-all">
              <div className="h-10 w-10 rounded-lg grid place-items-center border border-primary/30 bg-primary/5">
                <m.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-foreground/80">{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 7. CONVERSE COM SUA EMPRESA ─────────────────── */

function ChatWithBusiness() {
  const questions = [
    "Por que meu lucro caiu?",
    "Qual fornecedor aumentou?",
    "Quanto posso retirar este mês?",
    "Qual meu prato mais lucrativo?",
    "Vale fazer promoção hoje?",
    "Posso contratar mais um funcionário?",
  ];
  return (
    <section className="border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Converse com <span className="text-primary">sua empresa</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">A IA da LUUD lê seus dados e responde como um consultor.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="border-b border-border/60 px-4 h-11 flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="text-sm font-semibold">Assistente LUUD</div>
            <span className="ml-auto text-[10px] text-primary flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> online</span>
          </div>
          <div className="p-6 space-y-3">
            {questions.map((q, i) => (
              <div key={q} className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 flex items-center gap-3 hover:border-primary/40 transition-colors animate-slide-up-fade" style={{ animationDelay: `${i * 80}ms` }}>
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground/90">{q}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 8. ENQUANTO VOCÊ DORMIA ─────────────────── */

function WhileYouSlept() {
  const events = [
    { time: "02:14", text: "Analisei 842 pedidos." },
    { time: "03:20", text: "Fornecedor aumentou preço." },
    { time: "05:48", text: "CMV passou da meta." },
    { time: "07:12", text: "Atualizei previsão do mês." },
    { time: "08:00", text: "Preparei recomendações para hoje." },
  ];
  return (
    <section className="border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-80" style={{ background: "linear-gradient(180deg, oklch(0.12 0.03 260), oklch(0.18 0.04 245))" }} />
      <div className="max-w-4xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6 font-medium">
            <Moon className="h-3.5 w-3.5" /> IA 24/7
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Enquanto você <span className="text-primary">dormia</span>...
          </h2>
        </div>
        <div className="relative pl-6 md:pl-10 space-y-4">
          <div className="absolute left-2 md:left-4 top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-primary/30 to-transparent" />
          {events.map((e, i) => (
            <div key={e.time} className="relative animate-slide-up-fade" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="absolute -left-6 md:-left-10 top-3 h-3 w-3 rounded-full bg-primary shadow-[0_0_0_4px_oklch(0.82_0.16_172_/_0.15)]" />
              <div className="rounded-xl border border-border bg-card/60 backdrop-blur px-5 py-4 flex items-center gap-4">
                <span className="font-mono text-primary text-sm font-bold">{e.time}</span>
                <span className="text-sm md:text-base text-foreground/90">{e.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 9. O QUE MUDA EM 30 DIAS ─────────────────── */

function BeforeAfter() {
  const before = ["Planilhas", "Achismo", "Preço errado", "Fornecedor caro", "Lucro desconhecido"];
  const after = ["Lucro conhecido", "CMV controlado", "Clientes monitorados", "Fornecedor analisado", "Preço inteligente", "Decisões baseadas em dados"];
  return (
    <section className="border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            O que muda em <span className="text-primary">30 dias</span>.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6">
            <div className="text-xs uppercase tracking-wider text-destructive font-semibold mb-4">Antes</div>
            <ul className="space-y-2.5">
              {before.map((x) => (
                <li key={x} className="flex items-center gap-3 text-foreground/80">
                  <Minus className="h-4 w-4 text-destructive shrink-0" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/40 p-6" style={{ background: "linear-gradient(135deg, oklch(0.82 0.16 172 / 0.08), transparent)" }}>
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-4">Depois</div>
            <ul className="space-y-2.5">
              {after.map((x) => (
                <li key={x} className="flex items-center gap-3 text-foreground/90 font-medium">
                  <Plus className="h-4 w-4 text-primary shrink-0" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 10. CONVITE PARA TESTAR ─────────────────── */

function TryInvite() {
  return (
    <section className="border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-70" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, oklch(0.82 0.16 172 / 0.10), transparent 70%)" }} />
      <div className="max-w-3xl mx-auto px-4 py-20 md:py-24 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          Descubra o que a IA <span className="text-primary">encontraria</span> no seu restaurante.
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Durante 7 dias ela analisa seus dados exatamente como faz com clientes pagantes. Sem cartão. Sem compromisso.
        </p>
        <div className="mt-8">
          <Link to="/auth">
            <Button size="lg" className="h-12 px-8 gap-2 shadow-[var(--shadow-glow)] font-semibold">
              Começar teste grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 11. PRIMEIROS 7 DIAS ─────────────────── */

function SevenDays() {
  const days = [
    { d: 1, t: "Conecte suas vendas." },
    { d: 2, t: "Organize seus custos." },
    { d: 3, t: "Descubra seu lucro real." },
    { d: 4, t: "Receba suas primeiras recomendações." },
    { d: 5, t: "Encontre desperdícios." },
    { d: 6, t: "Descubra seus produtos mais lucrativos." },
    { d: 7, t: "Tenha um plano claro para aumentar sua margem." },
  ];
  return (
    <section className="border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-4 font-medium">
            <Clock className="h-3.5 w-3.5" /> Onboarding guiado
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            O que acontece nos <span className="text-primary">primeiros 7 dias</span>.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {days.map((d) => (
            <div key={d.d} className="rounded-xl border border-border bg-card/40 backdrop-blur p-4 flex items-center gap-4 hover:border-primary/40 transition-all">
              <div className="h-12 w-12 rounded-xl grid place-items-center border border-primary/30 bg-primary/5 shrink-0">
                <div className="text-center leading-none">
                  <div className="text-[9px] text-muted-foreground uppercase">Dia</div>
                  <div className="font-display text-lg font-bold text-primary">{d.d}</div>
                </div>
              </div>
              <div className="text-sm md:text-base text-foreground/90">{d.t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 12. RESULTADOS RÁPIDOS ─────────────────── */

function QuickResults() {
  const cases = [
    { emoji: "🍔", type: "Hamburgueria", result: "+22% de lucro" },
    { emoji: "🍕", type: "Pizzaria", result: "+R$ 6.300/mês" },
    { emoji: "🍣", type: "Sushi", result: "-90% em planilhas" },
    { emoji: "🥤", type: "Açaí", result: "+18% de margem" },
  ];
  return (
    <section id="resultados" className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Resultados <span className="text-primary">reais</span>.
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cases.map((c) => (
            <div key={c.type} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 text-center hover:border-primary/40 transition-all">
              <div className="text-4xl mb-3">{c.emoji}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.type}</div>
              <div className="font-display text-xl md:text-2xl font-bold text-primary mt-1">{c.result}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const items = [
    { name: "Rafael Moraes", role: "Proprietário", restaurant: "Burger House", city: "São Paulo, SP", photo: rafaelPhoto.url, text: "Descobri que perdia R$ 4.300 por mês com embalagens. Em 30 dias virei o jogo.", metrics: [{ label: "Lucro", value: "+22%" }, { label: "Economia/mês", value: "R$ 4.3k" }] },
    { name: "Juliana Ferreira", role: "Sócia", restaurant: "Pizzaria Bella Massa", city: "Campinas, SP", photo: julianaPhoto.url, text: "Identifiquei produtos que davam prejuízo e reajustei preços com a IA sem perder cliente.", metrics: [{ label: "Margem", value: "+31%" }, { label: "Ticket médio", value: "+R$ 8" }] },
    { name: "Diego Cardoso", role: "CEO", restaurant: "Sushi Express", city: "Curitiba, PR", photo: diegoPhoto.url, text: "Finalmente entendi meu lucro real. A LUUD mostra o que o iFood não mostra.", metrics: [{ label: "Lucro", value: "+18%" }, { label: "Planilha", value: "-90%" }] },
  ];
  return (
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 flex flex-col hover:border-primary/40 hover:-translate-y-1 transition-all duration-300" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-3 mb-4">
                <img src={t.photo} alt={`${t.name} — ${t.restaurant}`} loading="lazy" width={56} height={56} className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.role} • {t.restaurant}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.city}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed flex-1">"{t.text}"</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {t.metrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div className="font-display text-lg font-bold text-primary">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 13. PLANOS ─────────────────── */

function Plans() {
  type Cycle = "mensal" | "semestral" | "anual";
  const [cycle, setCycle] = useState<Cycle>("anual");
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

  const CYCLE_LABEL: Record<Cycle, string> = { mensal: "Mensal", semestral: "Semestral", anual: "Anual" };
  const CYCLE_DISCOUNT: Record<Cycle, string | null> = { mensal: null, semestral: "-10%", anual: "-16%" };

  const plans = [
    { tier: "basico" as const, highlight: null as null | "popular" | "premium", icon: null as any },
    { tier: "pro" as const, highlight: "popular" as const, icon: Star },
    { tier: "premium" as const, highlight: "premium" as const, icon: Crown },
  ];

  const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <section id="planos" className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Escolha sua <span className="text-primary">fase de crescimento</span>.
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">Do controle básico à IA analisando 24 horas por dia.</p>
        </div>

        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-semibold">
            🟢 Comece com 7 dias grátis — sem cartão de crédito
          </span>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-border p-1 bg-card/60 backdrop-blur">
            {(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={cn(
                "px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-2",
                cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
                {CYCLE_LABEL[c]}
                {CYCLE_DISCOUNT[c] && (
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    cycle === c ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                  )}>{CYCLE_DISCOUNT[c]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {plans.map((p) => {
            const total = PLAN_PRICES[p.tier][cycle];
            const perMonth = cycle === "mensal" ? total : cycle === "semestral" ? total / 6 : total / 12;
            const mensalTotal = PLAN_PRICES[p.tier].mensal * (cycle === "semestral" ? 6 : cycle === "anual" ? 12 : 1);
            const savings = cycle === "mensal" ? 0 : mensalTotal - total;
            const featured = p.highlight === "popular";
            const premiumHl = p.highlight === "premium";
            const Icon = p.icon;
            return (
              <div key={p.tier}
                className={cn("relative rounded-2xl border p-6 bg-card/60 backdrop-blur flex flex-col transition-transform",
                  featured && "border-primary/40 md:scale-[1.02] z-10",
                  premiumHl && "border-transparent",
                  !featured && !premiumHl && "border-border/40"
                )}
                style={
                  featured ? { boxShadow: "0 0 0 1px oklch(0.82 0.16 172 / 0.3), var(--shadow-card)" }
                  : premiumHl ? { background: "linear-gradient(180deg, oklch(0.82 0.16 172 / 0.10), oklch(0.65 0.19 255 / 0.05), var(--card))", boxShadow: "0 0 0 1px oklch(0.82 0.16 172 / 0.3), 0 30px 60px -20px oklch(0.82 0.16 172 / 0.3)" }
                  : { boxShadow: "var(--shadow-card)" }
                }>
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                    <Star className="h-3 w-3 fill-current" /> Mais popular
                  </span>
                )}
                {premiumHl && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                    <Crown className="h-3 w-3 fill-current" /> IA 24/7
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 text-primary" />}
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{PLAN_TAGLINE[p.tier]}</div>
                </div>
                <div className="font-display text-2xl font-bold mt-1">{PLAN_LABEL[p.tier]}</div>
                <div className="text-sm text-primary mt-1 font-medium">{PLAN_PROMISE[p.tier]}</div>

                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold tracking-tight">{formatBRL(perMonth)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cycle === "mensal" ? "cobrança mensal" : `Total ${formatBRL(total)} • pago ${cycle === "semestral" ? "a cada 6 meses" : "1x por ano"}`}
                  </div>
                  {savings > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                      Economize {formatBRL(savings)}
                    </div>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {PLAN_FEATURES[p.tier].slice(0, 8).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/auth" className="mt-6 block">
                  <Button className={cn("w-full h-11", (featured || premiumHl) && "shadow-[var(--shadow-glow)]")} variant={featured || premiumHl ? "default" : "outline"}>
                    Começar teste grátis
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 max-w-xl mx-auto">
          {/* Reserved: checkoutMap loaded for later use */}
          <span className="hidden">{Object.keys(checkoutMap).length}</span>
          7 dias grátis em todos os planos. Sem cartão. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────── 14. FAQ ─────────────────── */

function FAQ() {
  const items = [
    { q: "Preciso cadastrar cartão de crédito?", a: "Não. O teste de 7 dias é 100% gratuito, sem cartão." },
    { q: "Posso cancelar quando quiser?", a: "Sim. Sem multa, sem burocracia. Cancele a qualquer momento pelo painel." },
    { q: "Quanto tempo leva para começar?", a: "Em menos de 5 minutos você cria a conta, escolhe o tema e faz o tour interativo dos 10 pontos principais." },
    { q: "A IA funciona desde o primeiro dia?", a: "Sim. Já no primeiro dia, com poucos dados, ela mostra o painel de oportunidades e sugere próximos passos." },
    { q: "Meus dados ficam salvos com segurança?", a: "Sim. Tudo criptografado, com isolamento por restaurante. Você é o único dono dos seus dados." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-20 md:py-24">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Perguntas frequentes</h2>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.q} className="rounded-xl border border-border bg-card/40 backdrop-blur overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-primary/[0.03] transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-medium text-foreground/90">{it.q}</span>
                {open === i ? <Minus className="h-4 w-4 text-primary shrink-0" /> : <Plus className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{it.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── 15. CTA FINAL ─────────────────── */

function FinalCTA() {
  return (
    <section className="border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-90" style={{ background: "var(--gradient-hero)" }} />
      <div className="max-w-4xl mx-auto px-4 py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6 font-medium">
          <Target className="h-3.5 w-3.5" /> Sua próxima decisão
        </div>
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
          Todo mês que passa sem <br className="hidden md:block" />
          conhecer seu lucro real, <br />
          <span className="text-primary">é uma oportunidade perdida</span>.
        </h2>
        <p className="text-muted-foreground mt-6 max-w-xl mx-auto text-lg">
          Você já trabalha duro todos os dias. Agora deixe uma IA trabalhar para aumentar o lucro do seu restaurante.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link to="/auth">
            <Button size="lg" className="h-13 px-8 gap-2 shadow-[var(--shadow-glow)] font-semibold text-base">
              Comece gratuitamente por 7 dias <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground justify-center">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem compromisso</span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── FOOTER ─────────────────── */

function Footer() {
  return (
    <footer className="bg-card/20">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <Logo />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              IA financeira para restaurantes. Encontre dinheiro perdido todos os dias.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a aria-label="Instagram" href="https://www.instagram.com/luud.app/" target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"><Instagram className="h-4 w-4" /></a>
              <a aria-label="WhatsApp" href="https://wa.me/5562993969722" target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"><MessageCircle className="h-4 w-4" /></a>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">Plataforma</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#ia" className="hover:text-primary">Inteligência Artificial</a></li>
              <li><a href="#dashboard" className="hover:text-primary">Dashboard</a></li>
              <li><a href="#resultados" className="hover:text-primary">Resultados</a></li>
              <li><a href="#planos" className="hover:text-primary">Planos</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">Contato</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> contato@luud.app</li>
              <li className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5" /> <a href="https://wa.me/5562993969722" target="_blank" rel="noreferrer" className="hover:text-primary">WhatsApp</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">Legal</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary">Política de Privacidade</a></li>
              <li><a href="#" className="hover:text-primary">Termos de Uso</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LUUD. Todos os direitos reservados.</p>
          <p className="text-xs text-muted-foreground">Encontre dinheiro perdido todos os dias.</p>
        </div>
      </div>
    </footer>
  );
}
