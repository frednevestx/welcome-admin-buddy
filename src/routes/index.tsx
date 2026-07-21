import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { PLAN_FEATURES, PLAN_LABEL, PLAN_PRICES } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-luud.jpg";
import {
  TrendingUp, TrendingDown, PiggyBank, ShoppingBag,
  BarChart3, Bell, CheckCircle2, ArrowRight, Sparkles, Star, Crown,
  Brain, Stethoscope, Calculator, Activity, BellRing, Lightbulb,
  Wallet, Target, PieChart, Eye, LayoutGrid, BrainCircuit,
  Utensils, Bike, Zap, Shield, Smartphone, Instagram, Linkedin,
  MessageCircle, Mail, Sprout, TrendingUpIcon, Coins, Award,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "LUUD — Descubra seu lucro" },
      { name: "description", content: "Conecte seu iFood, registre seus custos e descubra quanto realmente sobra em cada pedido. Inteligência financeira premium para restaurantes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <TopBar />
      <Hero />
      <SocialProof />
      <Benefits />
      <AISection />
      <Plans />
      <Differentials />
      <BigCTA />
      <FAQ />
      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#beneficios" className="hover:text-foreground transition-colors">Benefícios</a>
          <a href="#ia" className="hover:text-foreground transition-colors">IA</a>
          <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button size="sm" variant="ghost" className="hidden sm:inline-flex">Entrar</Button></Link>
          <Link to="/auth"><Button size="sm" className="shadow-[var(--shadow-glow)]">Começar grátis</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-90" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute inset-x-0 top-0 -z-10 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 pt-16 pb-16 md:pt-24 md:pb-24">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Inteligência financeira para restaurantes e delivery
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.98]">
              Descubra <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">seu lucro</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Conecte seu iFood, registre seus custos e descubra quanto realmente sobra em cada pedido.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-6 gap-2 shadow-[var(--shadow-glow)]">
                  Começar gratuitamente <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#beneficios">
                <Button size="lg" variant="outline" className="h-12 px-6">Conhecer a plataforma</Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground justify-center lg:justify-start">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Integração iFood</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span>
            </div>
          </div>

          <div className="relative animate-fade-in">
            <div className="absolute -inset-4 -z-10 rounded-3xl opacity-60 blur-3xl" style={{ background: "var(--gradient-primary)" }} />
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const tiles = [
    { label: "Faturamento", value: "R$ 84.320", delta: "+18%", icon: TrendingUp, tone: "text-primary" },
    { label: "Custos", value: "R$ 41.180", delta: "-4%", icon: TrendingDown, tone: "text-accent" },
    { label: "Lucro real", value: "R$ 43.140", delta: "+27%", icon: PiggyBank, tone: "text-primary" },
    { label: "Pedidos iFood", value: "2.618", delta: "+9%", icon: Bike, tone: "text-foreground" },
  ];
  return (
    <div className="rounded-2xl border border-border overflow-hidden backdrop-blur" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
        <span className="ml-3 text-xs text-muted-foreground">luud.app / dashboard</span>
        <span className="ml-auto text-xs text-primary flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> ao vivo</span>
      </div>
      <div className="p-4 md:p-6 grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border bg-card/60 p-3 hover:border-primary/40 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{t.label}</span>
                <t.icon className={`h-3.5 w-3.5 ${t.tone}`} />
              </div>
              <div className="mt-1.5 text-lg md:text-xl font-bold tracking-tight">{t.value}</div>
              <div className="text-[10px] text-primary mt-0.5">{t.delta} vs mês anterior</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-[1.5fr_1fr] gap-3">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">Lucro real por semana</div>
                <div className="text-[11px] text-muted-foreground">Últimos 3 meses</div>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-end gap-1.5 h-32">
              {[45, 58, 52, 72, 65, 82, 74, 91, 78, 95, 88, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md transition-all hover:opacity-100" style={{
                  height: `${h}%`,
                  background: i === 11 ? "var(--gradient-primary)" : "var(--primary)",
                  opacity: i === 11 ? 1 : 0.55,
                }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="text-sm font-semibold mb-3">Margem por plataforma</div>
            <OriginBar label="iFood" pct={68} tone="primary" />
            <OriginBar label="Loja Própria" pct={42} tone="accent" />
            <OriginBar label="99Food" pct={31} tone="primary" />
            <div className="mt-4 pt-3 border-t border-border flex items-start gap-2 text-[11px] text-muted-foreground">
              <BrainCircuit className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span><span className="text-foreground font-medium">IA:</span> reduzir custo de embalagem em 8% aumentaria sua margem em R$ 3.240/mês</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OriginBar({ label, pct, tone = "primary" }: { label: string; pct: number; tone?: "primary" | "accent" }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-[11px] mb-1"><span className="text-muted-foreground">{label}</span><span className="font-medium">{pct}%</span></div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone === "primary" ? "var(--primary)" : "var(--accent)" }} />
      </div>
    </div>
  );
}

function SocialProof() {
  // NOTE: fotos, nomes e depoimentos abaixo são placeholders — substituir por conteúdo real.
  const items = [
    { name: "Rafael Moraes", role: "Proprietário", restaurant: "Burger House", city: "São Paulo, SP", text: "A gente faturava muito e nunca sabia quanto realmente sobrava. Depois da LUUD conseguimos enxergar exatamente onde perdíamos dinheiro.", photo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces" },
    { name: "Juliana Ferreira", role: "Sócia", restaurant: "Pizzaria Bella Massa", city: "Campinas, SP", text: "Em menos de um mês identificamos produtos que davam prejuízo e aumentamos nossa margem em 22%.", photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces" },
    { name: "Diego Cardoso", role: "CEO", restaurant: "Sushi Express", city: "Curitiba, PR", text: "Finalmente entendi o que é lucro real. A LUUD mostra o que o iFood não mostra: quanto realmente entra depois de todos os custos.", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces" },
    { name: "Camila Souza", role: "Gerente", restaurant: "Açaí Point", city: "Belo Horizonte, MG", text: "A IA da LUUD sugeriu ajustes de preço que aumentaram nossa margem sem perder cliente. Coisa de outro nível.", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces" },
    { name: "Marcos Almeida", role: "Proprietário", restaurant: "Dom Frango", city: "Salvador, BA", text: "Antes eu decidia no achismo. Hoje eu decido com número. A LUUD virou o painel mais aberto do meu computador.", photo: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop&crop=faces" },
    { name: "Patrícia Lima", role: "Sócia", restaurant: "Espetinho Prime", city: "Porto Alegre, RS", text: "Simples, direto e sem termo de contador. Foi a primeira ferramenta financeira que meu marido, que é o cozinheiro, conseguiu usar sozinho.", photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=faces" },
  ];
  return (
    <section className="border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.65 0.19 255 / 0.10), transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            +900 restaurantes já descobriram o lucro real
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Histórias reais de quem <span className="text-primary">descobriu o próprio lucro</span>.
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Donos de restaurantes, pizzarias, hamburguerias e deliveries que trocaram o achismo por decisões baseadas em números.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => (
            <div
              key={t.name}
              data-placeholder="testimonial"
              className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                <img
                  src={t.photo}
                  alt={`Foto (placeholder) de ${t.name}`}
                  className="h-12 w-12 rounded-full border border-border bg-muted object-cover flex-shrink-0"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.role} • {t.restaurant}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    { icon: Coins, label: "Mais lucro" },
    { icon: Sprout, label: "Menos desperdício" },
    { icon: Wallet, label: "Controle financeiro" },
    { icon: Activity, label: "Fluxo de caixa" },
    { icon: PieChart, label: "Margem de lucro" },
    { icon: Eye, label: "Visão completa" },
    { icon: LayoutGrid, label: "Mais organização" },
    { icon: Brain, label: "Decisões inteligentes" },
  ];
  return (
    <section id="beneficios" className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Você não compra um sistema.
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Você compra tranquilidade
            </span>{" "}
            para administrar seu restaurante.
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {items.map((b) => (
            <div
              key={b.label}
              className="group rounded-2xl border border-border bg-card/40 backdrop-blur p-5 md:p-6 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="h-11 w-11 rounded-xl grid place-items-center mb-4 border border-border group-hover:border-primary/60 transition-colors" style={{ background: "var(--gradient-glass)" }}>
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold text-sm md:text-base">{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AISection() {
  const features = [
    { icon: Brain, title: "IA Financeira", desc: "Analisa automaticamente todas as movimentações do seu restaurante." },
    { icon: Stethoscope, title: "Diagnóstico Inteligente", desc: "Encontra desperdícios escondidos que consomem sua margem." },
    { icon: Calculator, title: "Precificação Inteligente", desc: "Sugere o melhor preço para manter sua margem em cada produto." },
    { icon: Activity, title: "Simulador Financeiro", desc: "Mostra quanto você pode lucrar antes mesmo de alterar preços." },
    { icon: BellRing, title: "Alertas Inteligentes", desc: "Notifica aumentos de custos assim que acontecem." },
    { icon: Lightbulb, title: "Insights Personalizados", desc: "Recomenda ações específicas para melhorar seus resultados." },
  ];
  return (
    <section id="ia" className="border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 30%, oklch(0.9 0.28 135 / 0.10), transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary mb-6">
            <BrainCircuit className="h-3.5 w-3.5" /> Exclusivo do plano Premium
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Uma <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Inteligência Artificial</span> que trabalha por você.
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">A LUUD analisa, diagnostica e recomenda ações — 24 horas por dia.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border bg-card/60 backdrop-blur p-6 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="h-12 w-12 rounded-xl grid place-items-center mb-4 border border-border group-hover:shadow-[var(--shadow-glow)] transition-all" style={{ background: "var(--gradient-glass)" }}>
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="font-semibold text-lg">{f.title}</div>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
    { tier: "basico" as const, tag: "Comece organizado", label: "Plano Básico", highlight: null as null | "popular" | "premium", icon: null as any },
    { tier: "pro" as const, tag: "Mais popular", label: "Plano PRO", highlight: "popular" as const, icon: Star },
    { tier: "premium" as const, tag: "Máximo poder + IA", label: "Plano Premium IA", highlight: "premium" as const, icon: Crown },
  ];

  const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fallback = "https://wa.me/5562993969722?text=Ol%C3%A1%2C%20Quero%20descobrir%20os%20lucros%20do%20meu%20restaurante!%20%F0%9F%93%88";


  return (
    <section id="planos" className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Escolha seu plano — <span className="text-primary">quanto mais tempo, mais desconto</span>
          </h2>
          <p className="text-muted-foreground mt-3">Selecione o ciclo e aproveite descontos progressivos.</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-border p-1 bg-card">
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
                    ? { boxShadow: "0 0 0 1px oklch(0.9 0.28 135 / 0.25), var(--shadow-card)" }
                    : premiumHl
                    ? {
                        background: "linear-gradient(180deg, oklch(0.9 0.28 135 / 0.08), oklch(0.65 0.19 255 / 0.05), var(--card))",
                        boxShadow: "0 0 0 1px oklch(0.9 0.28 135 / 0.25), 0 30px 60px -20px oklch(0.9 0.28 135 / 0.25)",
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
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-semibold px-3 py-1 shadow-sm">
                    <Crown className="h-3 w-3 fill-current" /> Premium com IA
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 text-primary" />}
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.tag}</div>
                </div>
                <div className="text-2xl font-bold mt-1">{p.label}</div>

                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{formatBRL(perMonth)}</span>
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
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0 fill-primary/10" />
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

function Differentials() {
  const items = [
    { icon: Bike, title: "Especializada em Delivery", desc: "Feita para o dia a dia de quem vive de entrega." },
    { icon: Zap, title: "Integração com iFood", desc: "Vendas e taxas importadas automaticamente." },
    { icon: Utensils, title: "Feita para restaurantes", desc: "Categorias, custos e métricas do seu setor." },
    { icon: TrendingUpIcon, title: "Sem planilhas", desc: "Chega de Excel travando na hora do movimento." },
    { icon: Shield, title: "Sem termos complicados", desc: "Nada de DRE, EBITDA. Só o que importa." },
    { icon: Activity, title: "Tudo em tempo real", desc: "Seus números atualizados enquanto você vende." },
    { icon: BrainCircuit, title: "IA Financeira", desc: "Recomendações que fazem seu lucro crescer." },
  ];
  return (
    <section className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Por que escolher a <span className="text-primary">LUUD?</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl border border-border bg-card/40 backdrop-blur p-5 hover:border-primary/40 hover:-translate-y-1 transition-all">
              <it.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-semibold">{it.title}</div>
              <p className="text-sm text-muted-foreground mt-1">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BigCTA() {
  return (
    <section className="border-t border-border">
      <div className="max-w-5xl mx-auto px-4 py-20 md:py-28">
        <div className="relative rounded-3xl border border-border overflow-hidden p-8 md:p-16 text-center" style={{ background: "var(--gradient-surface)" }}>
          <div className="absolute inset-0 -z-10 opacity-80" style={{ background: "var(--gradient-hero)" }} />
          <Award className="h-10 w-10 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            Você sabe quanto realmente <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">sobra</span> no seu restaurante?
          </h2>
          <p className="text-muted-foreground mt-5 max-w-xl mx-auto text-lg">
            Pare de administrar baseado apenas em faturamento. <span className="text-foreground font-medium">Descubra seu lucro.</span>
          </p>
          <Link to="/auth" className="mt-8 inline-block">
            <Button size="lg" className="h-12 px-8 gap-2 shadow-[var(--shadow-glow)]">
              Começar gratuitamente <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    ["Funciona para qualquer restaurante?", "Sim. Lanchonetes, pizzarias, hamburguerias, marmitarias, açaiterias e qualquer delivery."],
    ["Preciso instalar alguma coisa?", "Não. Tudo funciona direto pelo navegador, no computador ou no celular."],
    ["Posso acessar pelo celular?", "Sim. A interface é responsiva e funciona bem em telas pequenas."],
    ["Posso cancelar quando quiser?", "Sim. Sem multa, sem burocracia."],
    ["Meus dados ficam seguros?", "Sim. Tudo é armazenado com segurança na nuvem, com criptografia e backups automáticos."],
    ["A LUUD funciona com iFood?", "Sim. Você importa seus relatórios de vendas e a LUUD organiza automaticamente."],
    ["Preciso saber de finanças?", "Não. A LUUD foi feita para ser simples. A IA faz o trabalho difícil por você."],
  ];
  return (
    <section id="faq" className="border-t border-border">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-center">Perguntas frequentes</h2>
        <div className="mt-10 space-y-3">
          {qs.map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-border bg-card/40 backdrop-blur px-5 py-4 transition-all hover:border-primary/40 open:border-primary/50">
              <summary className="cursor-pointer list-none flex justify-between items-center gap-4">
                <span className="font-medium text-foreground">{q}</span>
                <span className="text-primary group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3 animate-fade-in">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card/20">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <Logo />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              Inteligência financeira para restaurantes e delivery. Descubra seu lucro.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a aria-label="Instagram" href="#" className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"><Instagram className="h-4 w-4" /></a>
              <a aria-label="LinkedIn" href="#" className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"><Linkedin className="h-4 w-4" /></a>
              <a aria-label="WhatsApp" href="https://wa.me/5562993969722?text=Ol%C3%A1%2C%20Quero%20descobrir%20os%20lucros%20do%20meu%20restaurante!%20%F0%9F%93%88" target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"><MessageCircle className="h-4 w-4" /></a>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">Plataforma</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#beneficios" className="hover:text-primary">Benefícios</a></li>
              <li><a href="#ia" className="hover:text-primary">Inteligência Artificial</a></li>
              <li><a href="#planos" className="hover:text-primary">Planos</a></li>
              <li><a href="#faq" className="hover:text-primary">FAQ</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">Contato</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> contato@luud.app</li>
              <li className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5" /> <a href="https://wa.me/5562993969722?text=Ol%C3%A1%2C%20Quero%20descobrir%20os%20lucros%20do%20meu%20restaurante!%20%F0%9F%93%88" target="_blank" rel="noreferrer" className="hover:text-primary">WhatsApp</a></li>
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

