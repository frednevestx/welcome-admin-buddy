import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { PLAN_FEATURES, PLAN_LABEL, PLAN_PRICES } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import rafaelPhoto from "@/assets/testimonial-rafael.jpg.asset.json";
import julianaPhoto from "@/assets/testimonial-juliana.jpg.asset.json";
import diegoPhoto from "@/assets/testimonial-diego.jpg.asset.json";
import {
  TrendingUp, TrendingDown, PiggyBank,
  BarChart3, Bell, CheckCircle2, ArrowRight, Sparkles, Star, Crown,
  Brain, BrainCircuit, Wallet, Zap, Bike, Utensils, Shield,
  ChevronRight, LineChart, PackageOpen, Percent, AlertTriangle,
  Instagram, Linkedin, MessageCircle, Mail, ArrowUpRight, Cpu,
  Receipt, Search, Lightbulb, ArrowDown,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "LUUD — IA que descobre o lucro real do seu restaurante" },
      { name: "description", content: "A LUUD é uma inteligência artificial que analisa seu restaurante todos os dias e mostra exatamente onde você está perdendo dinheiro — e quanto pode lucrar mais." },
      { property: "og:title", content: "LUUD — IA que descobre o lucro real do seu restaurante" },
      { property: "og:description", content: "IA financeira para restaurantes e delivery. Descubra quanto você realmente lucra e receba recomendações para aumentar sua margem." },
    ],
  }),
  component: Landing,
});

function Landing() {
  // Landing sempre com paleta premium dark, independente do tema escolhido pelo usuário logado.
  useEffect(() => {
    const html = document.documentElement;
    const hadLight = html.classList.contains("light");
    html.classList.remove("light");
    return () => {
      if (hadLight) html.classList.add("light");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden antialiased">
      <TopBar />
      <Hero />
      <CredibilityBar />
      <PainPoints />
      <HowItWorks />
      <AIShowcase />
      <Benefits />
      <LiveDemo />
      <SocialProof />
      <Plans />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ─────────────────────────────────────────── */

function TopBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground font-medium">
          <a href="#ia" className="hover:text-foreground transition-colors">IA</a>
          <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
          <a href="#beneficios" className="hover:text-foreground transition-colors">Benefícios</a>
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

/* ─── HERO ─── */

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
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left animate-slide-up-fade">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary font-medium mb-6">
              <BrainCircuit className="h-3.5 w-3.5" />
              IA financeira para restaurantes
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-[4.25rem] font-bold tracking-tight leading-[1.02]">
              Você vende muito.<br />
              <span className="bg-gradient-to-r from-primary via-primary to-primary-glow bg-clip-text text-transparent">
                Mas quanto realmente sobra?
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              A LUUD é uma <span className="text-foreground font-medium">Inteligência Artificial</span> que analisa seu restaurante todos os dias e mostra exatamente onde você está perdendo dinheiro — e quanto pode lucrar mais.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-6 gap-2 shadow-[var(--shadow-glow)] font-semibold">
                  Descobrir meu lucro <ArrowRight className="h-4 w-4" />
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
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span>
            </div>
          </div>

          {/* Live mock */}
          <div className="relative animate-slide-up-fade" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-6 -z-10 rounded-[2rem] opacity-40 blur-3xl" style={{ background: "var(--gradient-primary)" }} />
            <HeroDashboardMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroDashboardMock() {
  return (
    <div className="relative">
      {/* Dashboard glass card */}
      <div
        className="rounded-2xl border border-border overflow-hidden backdrop-blur-xl"
        style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border/60">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
          <span className="ml-3 text-xs text-muted-foreground font-mono">luud.app / dashboard</span>
          <span className="ml-auto text-[10px] text-primary flex items-center gap-1 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> ao vivo
          </span>
        </div>
        <div className="p-4 md:p-5 grid gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            <KpiTile label="Faturamento" value="R$ 84.320" delta="+18%" icon={TrendingUp} />
            <KpiTile label="Custos" value="R$ 41.180" delta="-4%" icon={TrendingDown} tone="down" />
            <KpiTile label="Lucro real" value="R$ 43.140" delta="+27%" icon={PiggyBank} highlight />
            <KpiTile label="Margem" value="34,8%" delta="+3,1p" icon={Percent} />
          </div>
          <MiniChart />
        </div>
      </div>

      {/* AI panel — overlapping bottom-right */}
      <div
        className="mt-4 lg:mt-0 lg:absolute lg:-bottom-8 lg:-right-6 lg:w-[22rem] rounded-2xl border border-primary/30 backdrop-blur-xl overflow-hidden animate-slide-up-fade"
        style={{
          background: "linear-gradient(180deg, oklch(0.82 0.16 172 / 0.12), oklch(0.2 0.03 230 / 0.95))",
          boxShadow: "0 30px 60px -20px oklch(0.82 0.16 172 / 0.4), 0 0 0 1px oklch(0.82 0.16 172 / 0.2)",
          animationDelay: "300ms",
        }}
      >
        <div className="p-4 border-b border-primary/20 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
              IA LUUD
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">análise concluída</span>
            </div>
            <div className="text-[10px] text-muted-foreground">há 2 minutos • em tempo real</div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-foreground/90 leading-relaxed">
            Seu restaurante pode aumentar o lucro em <span className="font-bold text-primary">R$ 4.280 / mês</span>.
          </div>
          <ul className="space-y-1.5 text-xs">
            {[
              "Embalagens 12% acima da média",
              'Produto "Combo Família" com margem baixa',
              "Taxa iFood consumindo 21% do faturamento",
              "Reajuste de 4% aumentaria lucro em R$ 2.950/mês",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-foreground/85">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <button className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-semibold py-2 transition-colors">
            Ver análise completa <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, delta, icon: Icon, tone = "up", highlight = false }: {
  label: string; value: string; delta: string; icon: any; tone?: "up" | "down"; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all",
      highlight
        ? "border-primary/40 bg-primary/[0.06]"
        : "border-border/60 bg-card/40 hover:border-primary/30",
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", highlight ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className={cn("mt-1 text-lg font-bold font-display tracking-tight", highlight && "text-primary")}>{value}</div>
      <div className={cn("text-[10px] font-medium", tone === "up" ? "text-primary" : "text-muted-foreground")}>
        {delta} vs mês anterior
      </div>
    </div>
  );
}

function MiniChart() {
  const bars = [45, 58, 52, 72, 65, 82, 74, 91, 78, 95, 88, 100];
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <div className="text-xs font-semibold">Lucro real por semana</div>
          <div className="text-[10px] text-muted-foreground">Últimos 3 meses</div>
        </div>
        <div className="text-[10px] text-primary flex items-center gap-1 font-medium">
          <TrendingUp className="h-3 w-3" /> +27%
        </div>
      </div>
      <div className="flex items-end gap-1 h-20">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all"
            style={{
              height: `${h}%`,
              background: i === bars.length - 1 ? "var(--gradient-primary)" : "var(--primary)",
              opacity: i === bars.length - 1 ? 1 : 0.35 + (i / bars.length) * 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── CREDIBILITY BAR ─── */

function CredibilityBar() {
  const items = [
    { value: 900, suffix: "+", label: "restaurantes" },
    { value: 2, suffix: "M+", label: "pedidos analisados" },
    { value: 12, suffix: "k+", label: "recomendações da IA / mês" },
  ];
  return (
    <section className="border-y border-border bg-card/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
          {items.map((it) => (
            <div key={it.label} className="flex items-center justify-center gap-3 text-center md:text-left">
              <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 border border-primary/30 bg-primary/5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-display text-2xl md:text-3xl font-bold tracking-tight">
                  <AnimatedNumber to={it.value} />{it.suffix}
                </div>
                <div className="text-xs text-muted-foreground">{it.label}</div>
              </div>
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
          const duration = 1200;
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

/* ─── PAIN POINTS ─── */

function PainPoints() {
  const pains = [
    "Vendo muito, mas nunca sei quanto realmente lucro.",
    "O dinheiro entra, mas desaparece rapidamente.",
    "Não sei se meus preços estão corretos.",
    "O iFood parece consumir toda a minha margem.",
    "Ainda controlo tudo em planilhas.",
    "Não sei quanto posso retirar do caixa.",
  ];
  return (
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
            <span className="h-px w-8 bg-primary/50" />
            Você se identifica?
            <span className="h-px w-8 bg-primary/50" />
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            A dor de todo dono de <span className="text-primary">restaurante</span>.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pains.map((p, i) => (
            <div
              key={p}
              className="group rounded-xl border border-border bg-card/40 backdrop-blur p-5 hover:border-primary/40 transition-all"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0 bg-destructive/10 border border-destructive/20 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                  <AlertTriangle className="h-4 w-4 text-destructive/80 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed pt-1">"{p}"</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-muted-foreground mt-12 text-lg max-w-xl mx-auto">
          A LUUD foi criada para <span className="text-foreground font-medium">responder cada uma dessas perguntas</span> — com dados, não achismo.
        </p>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─── */

function HowItWorks() {
  const steps = [
    { icon: Receipt, title: "Você vende", desc: "Pelo iFood, salão ou delivery próprio." },
    { icon: PackageOpen, title: "LUUD organiza", desc: "Todas as informações consolidadas automaticamente." },
    { icon: Cpu, title: "IA analisa", desc: "Custos, margens, taxas, desperdícios e tendências." },
    { icon: Lightbulb, title: "Você recebe recomendações", desc: "Ações claras para aumentar seu lucro." },
  ];
  return (
    <section id="como-funciona" className="border-b border-border relative">
      <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.82 0.16 172 / 0.08), transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Simples como <span className="text-primary">deveria ser</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Sem planilhas. Sem termos técnicos. Sem contador te explicando.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-3 md:gap-4 relative">
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

/* ─── AI SHOWCASE ─── */

function AIShowcase() {
  const conversations = [
    {
      user: "Por que meu lucro caiu esta semana?",
      ai: "Detectei aumento de 14% no custo das embalagens e queda de margem em 3 produtos. Um reajuste médio de R$ 2,00 nesses itens recuperaria aproximadamente R$ 3.100/mês.",
    },
    {
      user: "Posso contratar mais um funcionário?",
      ai: "Considerando seu lucro médio dos últimos 4 meses, sua empresa suporta essa contratação sem comprometer o fluxo de caixa. Margem projetada continua acima de 28%.",
    },
    {
      user: "Qual meu produto mais lucrativo?",
      ai: "O X-Tudo Bacon lidera com 62% de margem líquida. Ele responde por 18% das vendas mas gera 31% do lucro. Vale destacar no cardápio.",
    },
  ];
  return (
    <section id="ia" className="border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 30%, oklch(0.82 0.16 172 / 0.10), transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6 font-medium">
            <BrainCircuit className="h-3.5 w-3.5" /> Inteligência Artificial
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Um consultor financeiro <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">disponível 24 horas por dia</span>.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Pergunte qualquer coisa sobre seu negócio. A IA da LUUD lê seus dados e responde em segundos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conversations.map((c, i) => (
            <ChatCard key={i} user={c.user} ai={c.ai} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChatCard({ user, ai, delay }: { user: string; ai: string; delay: number }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5 flex flex-col gap-3 hover:border-primary/40 transition-all animate-slide-up-fade"
      style={{ animationDelay: `${delay}ms`, boxShadow: "var(--shadow-card)" }}
    >
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 bg-muted/60 text-sm text-foreground/90">
          {user}
        </div>
      </div>
      {/* AI bubble */}
      <div className="flex gap-2.5">
        <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0 mt-1" style={{ background: "var(--gradient-primary)" }}>
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-primary mb-1 flex items-center gap-1.5">
            IA LUUD
            <span className="flex gap-0.5">
              <span className="typing-dot h-1 w-1 rounded-full bg-primary" />
              <span className="typing-dot h-1 w-1 rounded-full bg-primary" />
              <span className="typing-dot h-1 w-1 rounded-full bg-primary" />
            </span>
          </div>
          <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-primary/10 border border-primary/20 text-sm text-foreground/90 leading-relaxed">
            {ai}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── BENEFITS ─── */

function Benefits() {
  const items = [
    { icon: PiggyBank, title: "Descubra seu lucro real", desc: "Saiba exatamente quanto sobra depois de todas as taxas, custos e impostos." },
    { icon: Search, title: "Encontre desperdícios automaticamente", desc: "A IA identifica onde sua margem está sendo perdida — antes de você perceber." },
    { icon: Brain, title: "Receba recomendações inteligentes", desc: "Pare de decidir no achismo. Ações claras baseadas nos seus números." },
    { icon: Zap, title: "Tenha controle sem planilhas", desc: "Tudo organizado em poucos minutos. Sem contador te explicando." },
  ];
  return (
    <section id="beneficios" className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Não é um sistema. <br />
            <span className="text-primary">É crescimento financeiro.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((b) => (
            <div
              key={b.title}
              className="group rounded-2xl border border-border bg-card/50 backdrop-blur p-6 md:p-7 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl grid place-items-center border border-primary/30 shrink-0 group-hover:shadow-[var(--shadow-glow)] transition-all" style={{ background: "var(--gradient-glass)" }}>
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg md:text-xl">{b.title}</div>
                  <p className="text-sm md:text-base text-muted-foreground mt-1.5 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── LIVE DEMO STRIP ─── */

function LiveDemo() {
  const alerts = [
    { icon: TrendingDown, tone: "warn", text: "IA detectou aumento no custo dos ingredientes" },
    { icon: Sparkles, tone: "primary", text: "Nova oportunidade de economia encontrada" },
    { icon: TrendingUp, tone: "primary", text: "Lucro da semana aumentou 9%" },
    { icon: Percent, tone: "primary", text: "Margem do delivery próprio subiu 4,2 pontos" },
    { icon: AlertTriangle, tone: "warn", text: "Taxa iFood em produto Combo está acima do esperado" },
    { icon: Bell, tone: "primary", text: "Meta mensal atingida com 3 dias de antecedência" },
  ];
  // Duplicate for infinite scroll
  const loop = [...alerts, ...alerts];
  return (
    <section className="border-b border-border py-14 md:py-20 overflow-hidden">
      <div className="text-center max-w-2xl mx-auto mb-8 px-4">
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          A LUUD nunca dorme.
        </h2>
        <p className="text-muted-foreground mt-2">Enquanto você toca o restaurante, a IA vigia os seus números.</p>
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        <div className="flex gap-3 animate-ticker-x w-max">
          {loop.map((a, i) => (
            <div
              key={i}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2.5 backdrop-blur flex items-center gap-2.5 text-sm",
                a.tone === "primary" ? "border-primary/30 bg-primary/5 text-foreground" : "border-warning/30 bg-warning/5 text-foreground"
              )}
            >
              <a.icon className={cn("h-4 w-4 shrink-0", a.tone === "primary" ? "text-primary" : "text-warning")} />
              <span className="whitespace-nowrap">{a.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SOCIAL PROOF ─── */

function SocialProof() {
  const items = [
    {
      name: "Rafael Moraes", role: "Proprietário", restaurant: "Burger House", city: "São Paulo, SP",
      photo: rafaelPhoto.url,
      text: "Descobri que perdia R$ 4.300 por mês com embalagens. Em 30 dias virei o jogo.",
      metrics: [{ label: "Lucro", value: "+22%" }, { label: "Economia/mês", value: "R$ 4.3k" }],
    },
    {
      name: "Juliana Ferreira", role: "Sócia", restaurant: "Pizzaria Bella Massa", city: "Campinas, SP",
      photo: julianaPhoto.url,
      text: "Identifiquei produtos que davam prejuízo e reajustei preços com a IA sem perder cliente.",
      metrics: [{ label: "Margem", value: "+31%" }, { label: "Ticket médio", value: "+R$ 8" }],
    },
    {
      name: "Diego Cardoso", role: "CEO", restaurant: "Sushi Express", city: "Curitiba, PR",
      photo: diegoPhoto.url,
      text: "Finalmente entendi meu lucro real. A LUUD mostra o que o iFood não mostra.",
      metrics: [{ label: "Lucro", value: "+18%" }, { label: "Tempo em planilha", value: "-90%" }],
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Restaurantes que <span className="text-primary">descobriram seu lucro</span>.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 flex flex-col hover:border-primary/40 hover:-translate-y-1 transition-all duration-300"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={t.photo}
                  alt={`${t.name} — ${t.restaurant}`}
                  loading="lazy"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.role} • {t.restaurant}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.city}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
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

/* ─── PLANS ─── */

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
    { tier: "basico" as const, tag: "Organize suas finanças", label: PLAN_LABEL.basico, highlight: null as null | "popular" | "premium", icon: null as any, promise: "Chegue ao controle." },
    { tier: "pro" as const, tag: "Descubra onde aumentar margem", label: PLAN_LABEL.pro, highlight: "popular" as const, icon: Star, promise: "Cresça com clareza." },
    { tier: "premium" as const, tag: "IA analisando seu negócio 24/7", label: PLAN_LABEL.premium, highlight: "premium" as const, icon: Crown, promise: "Lucre continuamente." },
  ];

  const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fallback = "https://wa.me/5562993969722?text=Ol%C3%A1%2C%20Quero%20descobrir%20os%20lucros%20do%20meu%20restaurante!%20%F0%9F%93%88";

  return (
    <section id="planos" className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Escolha o quanto sua LUUD <span className="text-primary">vai fazer por você</span>.
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">Quanto mais tempo, mais desconto.</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-border p-1 bg-card/60 backdrop-blur">
            {(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-2",
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

        <div className="grid md:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {plans.map((p) => {
            const total = PLAN_PRICES[p.tier][cycle];
            const perMonth = cycle === "mensal" ? total : cycle === "semestral" ? total / 6 : total / 12;
            const mensalTotal = PLAN_PRICES[p.tier].mensal * (cycle === "semestral" ? 6 : cycle === "anual" ? 12 : 1);
            const savings = cycle === "mensal" ? 0 : mensalTotal - total;
            const featured = p.highlight === "popular";
            const premiumHl = p.highlight === "premium";
            const url = checkoutMap[`${p.tier}:${cycle}`] || fallback;
            const Icon = p.icon;
            return (
              <div
                key={p.tier}
                className={cn(
                  "relative rounded-2xl border p-6 bg-card/60 backdrop-blur flex flex-col transition-transform",
                  featured && "border-primary/40 md:scale-[1.02] z-10",
                  premiumHl && "border-transparent",
                  !featured && !premiumHl && "border-border/40"
                )}
                style={
                  featured
                    ? { boxShadow: "0 0 0 1px oklch(0.82 0.16 172 / 0.3), var(--shadow-card)" }
                    : premiumHl
                    ? {
                        background: "linear-gradient(180deg, oklch(0.82 0.16 172 / 0.10), oklch(0.65 0.19 255 / 0.05), var(--card))",
                        boxShadow: "0 0 0 1px oklch(0.82 0.16 172 / 0.3), 0 30px 60px -20px oklch(0.82 0.16 172 / 0.3)",
                      }
                    : { boxShadow: "var(--shadow-card)" }
                }
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                    <Star className="h-3 w-3 fill-current" /> Mais popular
                  </span>
                )}
                {premiumHl && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                    <Crown className="h-3 w-3 fill-current" /> Premium com IA
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 text-primary" />}
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{p.tag}</div>
                </div>
                <div className="font-display text-2xl font-bold mt-1">{p.label}</div>
                <div className="text-sm text-primary mt-1 font-medium">{p.promise}</div>

                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold tracking-tight">{formatBRL(perMonth)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cycle === "mensal"
                      ? "cobrança mensal"
                      : `Total ${formatBRL(total)} • pago ${cycle === "semestral" ? "a cada 6 meses" : "1x por ano"}`}
                  </div>
                  {savings > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                      Economize {formatBRL(savings)}
                    </div>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {PLAN_FEATURES[p.tier].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>

                <a href={url} target="_blank" rel="noreferrer" className="mt-6 block">
                  <Button className={cn("w-full h-11", (featured || premiumHl) && "shadow-[var(--shadow-glow)]")} variant={featured || premiumHl ? "default" : "outline"}>
                    Assinar {p.label}
                  </Button>
                </a>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 max-w-xl mx-auto">
          Pagamento processado em plataforma externa. Após o pagamento, seu acesso é liberado pela administração usando o e-mail cadastrado.
          {" "}<Link to="/auth" className="text-primary underline">Crie sua conta grátis</Link> antes de assinar.
        </p>
      </div>
    </section>
  );
}

/* ─── FINAL CTA ─── */

function FinalCTA() {
  return (
    <section className="border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-90" style={{ background: "var(--gradient-hero)" }} />
      <div className="max-w-4xl mx-auto px-4 py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6 font-medium">
          <Sparkles className="h-3.5 w-3.5" /> Comece em 2 minutos
        </div>
        <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Todo mês que passa <br />
          sem saber seu lucro real, <br />
          <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">é dinheiro que você perde</span>.
        </h2>
        <p className="text-muted-foreground mt-6 max-w-xl mx-auto text-lg">
          Conhecer o lucro real é o primeiro passo para crescer com segurança.
          <br className="hidden md:block" />
          Deixe a IA da LUUD trabalhar por você.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link to="/auth">
            <Button size="lg" className="h-13 px-8 gap-2 shadow-[var(--shadow-glow)] font-semibold text-base">
              Descobrir meu lucro agora <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground justify-center">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> 7 dias grátis</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span>
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */

function Footer() {
  return (
    <footer className="bg-card/20">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <Logo />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              IA financeira para restaurantes e delivery. Descubra seu lucro real.
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
              <li><a href="#como-funciona" className="hover:text-primary">Como funciona</a></li>
              <li><a href="#beneficios" className="hover:text-primary">Benefícios</a></li>
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
          <p className="text-xs text-muted-foreground">Descubra seu lucro.</p>
        </div>
      </div>
    </footer>
  );
}
