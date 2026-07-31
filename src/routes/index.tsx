import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { PLAN_FEATURES, PLAN_LABEL, PLAN_PRICES, PLAN_PROMISE, PLAN_TAGLINE } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import { resetThemeOverrides } from "@/hooks/use-theme";
import rafaelPhoto from "@/assets/testimonial-rafael.jpg.asset.json";
import julianaPhoto from "@/assets/testimonial-juliana.jpg.asset.json";
import diegoPhoto from "@/assets/testimonial-diego.jpg.asset.json";
import brandPrimeBurg from "@/assets/brand-primeburg.png";
import brandBellaMassa from "@/assets/brand-bellamassa.png";
import brandAcaiPoint from "@/assets/brand-acaipoint.png";
import brandSanduba from "@/assets/brand-sanduba.png";
import brandMarmita from "@/assets/brand-marmita.png";
import brandDarkKitchen from "@/assets/brand-darkkitchen.png";
import {
  TrendingUp, TrendingDown, PiggyBank, Bell, CheckCircle2, ArrowRight, Sparkles, Star, Crown,
  BrainCircuit, Zap, ChevronRight, PackageOpen, Percent, AlertTriangle,
  Instagram, MessageCircle, Mail, Receipt, Lightbulb,
  Users, ShoppingBag, DollarSign, Target, Clock, BarChart3, ChefHat, Plus,
  LayoutDashboard, Tags, GitCompareArrows, Boxes, History, Calculator, Store, Wallet,
  FileText, Gauge, DatabaseBackup, ShieldCheck, Plug, LineChart, Timer, Search, Brain,
  Table2, PlayCircle,
} from "lucide-react";

const WHATSAPP = "https://wa.me/5562993969722?text=Ol%C3%A1%2C%20quero%20descobrir%20o%20lucro%20real%20do%20meu%20neg%C3%B3cio!%20%F0%9F%93%88";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "LUUD — Descubra o lucro real do seu negócio" },
      { name: "description", content: "Conecte suas vendas, registre seus custos e descubra quanto realmente sobra no seu bolso. IA financeira para restaurantes, delivery e food service. 7 dias grátis." },
      { property: "og:title", content: "LUUD — Descubra o lucro real do seu negócio" },
      { property: "og:description", content: "Vender muito não significa lucrar muito. A LUUD analisa vendas, custos, CMV e taxas e mostra onde aumentar sua margem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LUUD — Descubra o lucro real do seu negócio" },
      { name: "twitter:description", content: "IA financeira que mostra quanto realmente sobra em cada pedido. Teste 7 dias grátis." },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    const html = document.documentElement;
    const hadLight = html.classList.contains("light");
    html.classList.remove("light");
    resetThemeOverrides();
    return () => { if (hadLight) html.classList.add("light"); };
  }, []);


  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden antialiased scroll-smooth">
      <TopBar />
      <main>
        <Hero />
        <SocialProof />
        <Problems />
        <HowItWorks />
        <AISection />
        <Features />
        <Benefits />
        <DashboardShowcase />
        <Testimonials />
        <Plans />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ───────────────── helpers ───────────────── */

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform",
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("py-24 md:py-32 px-5", className)}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow?: string; title: ReactNode; sub?: string }) {
  return (
    <Reveal className="max-w-3xl mx-auto text-center mb-14 md:mb-20">
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-5">
          <span className="h-px w-6 bg-primary/50" /> {eyebrow}
        </span>
      )}
      <h2 className="font-display text-3xl md:text-5xl font-bold leading-[1.08] text-balance">{title}</h2>
      {sub && <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed text-pretty">{sub}</p>}
    </Reveal>
  );
}

function CTAButton({ children, className, variant = "primary" }: { children: ReactNode; className?: string; variant?: "primary" | "ghost" }) {
  return (
    <Link to="/auth" className={cn("inline-flex", className)}>
      <Button
        size="lg"
        variant={variant === "ghost" ? "outline" : "default"}
        className={cn(
          "h-12 rounded-2xl px-7 text-sm font-semibold transition-all duration-300",
          variant === "primary"
            ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] hover:-translate-y-0.5 hover:brightness-110"
            : "border-border/70 bg-card/40 backdrop-blur hover:-translate-y-0.5 hover:bg-card/70",
        )}
      >
        {children}
      </Button>
    </Link>
  );
}

function useCountUp(target: number, duration = 1400) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);
  return { ref, value };
}

/* ───────────────── HEADER ───────────────── */

const NAV = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Benefícios", href: "#beneficios" },
  { label: "IA Financeira", href: "#ia" },
  { label: "Recursos", href: "#recursos" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

function TopBar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 border-b transition-all duration-300 backdrop-blur-xl",
        scrolled
          ? "h-14 bg-background/80 border-border/60 shadow-[0_10px_30px_-20px_oklch(0_0_0/0.9)]"
          : "h-20 bg-background/40 border-transparent",
      )}
    >
      <div className="max-w-6xl mx-auto h-full px-5 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="relative py-1 transition-colors hover:text-foreground after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-right after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:origin-left hover:after:scale-x-100">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden sm:inline-flex">
            <Button size="sm" variant="ghost" className="rounded-xl">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground font-semibold shadow-[var(--shadow-glow)] transition-transform duration-300 hover:-translate-y-0.5">
              Começar grátis
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ───────────────── HERO ───────────────── */

function Hero() {
  return (
    <section className="relative pt-36 md:pt-44 pb-20 md:pb-28 px-5">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-hero)]" />
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-14 lg:gap-12 items-center">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> IA financeira para food service
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.03] tracking-tight text-balance">
              Descubra o{" "}
              <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">lucro real</span>{" "}
              do seu negócio.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl text-pretty">
              Conecte seu iFood, registre seus custos e descubra quanto realmente sobra no seu bolso.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["7 dias grátis", "Sem cartão", "Cancelamento quando quiser"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={260}>
            <div className="mt-9 flex flex-wrap gap-3">
              <CTAButton>Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></CTAButton>
              <a href="#dashboard" className="inline-flex">
                <Button size="lg" variant="outline" className="h-12 rounded-2xl px-7 text-sm font-semibold border-border/70 bg-card/40 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-card/70">
                  <PlayCircle className="mr-2 h-4 w-4" /> Ver demonstração
                </Button>
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <TiltDashboard />
        </Reveal>
      </div>
    </section>
  );
}

function TiltDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setT({
          y: ((e.clientX - r.left) / r.width - 0.5) * 12,
          x: -((e.clientY - r.top) / r.height - 0.5) * 10,
        });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      className="[perspective:1400px]"
    >
      <div
        style={{ transform: `rotateX(${t.x}deg) rotateY(${t.y}deg)` }}
        className="transition-transform duration-300 ease-out will-change-transform"
      >
        <DashboardMock />
      </div>
    </div>
  );
}

function DashboardMock({ compact = false }: { compact?: boolean }) {
  const lucro = useCountUp(18420);
  const receita = useCountUp(64980);
  const pedidos = useCountUp(1842);
  const bars = [42, 58, 47, 66, 61, 78, 72, 88, 81, 94, 86, 100];

  return (
    <div className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60 bg-[image:var(--gradient-glass)]">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-3 text-xs text-muted-foreground font-medium">LUUD · Dashboard financeiro</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-primary font-semibold">ao vivo</span>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <MockKpi label="Lucro líquido" value={`R$ ${lucro.value.toLocaleString("pt-BR")}`} refEl={lucro.ref} delta="+22%" positive icon={PiggyBank} />
          <MockKpi label="Receita" value={`R$ ${receita.value.toLocaleString("pt-BR")}`} refEl={receita.ref} delta="+9%" positive icon={DollarSign} />
          <MockKpi label="Pedidos" value={pedidos.value.toLocaleString("pt-BR")} refEl={pedidos.ref} delta="+14%" positive icon={ShoppingBag} />
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Margem por mês</span>
            <span className="text-[11px] text-success font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3" /> margem 28,4%</span>
          </div>
          <div className="flex items-end gap-1.5 h-24">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-[image:var(--gradient-primary)] opacity-90 animate-slide-up-fade"
                style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>

        {!compact && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-2.5">
              <span className="text-xs font-semibold text-muted-foreground">Custos do período</span>
              {[
                { l: "CMV", v: "R$ 21.340", p: 62 },
                { l: "Taxas iFood", v: "R$ 8.120", p: 34 },
                { l: "Embalagens", v: "R$ 2.410", p: 18 },
              ].map((c) => (
                <div key={c.l} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.l}</span>
                    <span className="font-semibold">{c.v}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${c.p}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
                <BrainCircuit className="h-4 w-4" /> Insight da IA
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                Seu custo com embalagens subiu <strong className="text-destructive">12%</strong> em 30 dias.
                Renegociando 8%, seu lucro sobe <strong className="text-success">R$ 2.300/mês</strong>.
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                {[0, 1, 2].map((i) => <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MockKpi({ label, value, delta, positive, icon: Icon, refEl }: any) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-3.5 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{label}</span>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="mt-1.5 text-base md:text-lg font-bold font-display tracking-tight">
        <span ref={refEl}>{value}</span>
      </div>
      <div className={cn("mt-0.5 text-[11px] font-semibold", positive ? "text-success" : "text-destructive")}>{delta}</div>
    </div>
  );
}

/* ───────────────── PROVA SOCIAL ───────────────── */

const BRANDS = [
  { src: brandPrimeBurg, name: "Prime Burg", niche: "Hamburgueria" },
  { src: brandBellaMassa, name: "Bella Massa", niche: "Pizzaria" },
  { src: brandAcaiPoint, name: "Açaí Point", niche: "Açaiteria" },
  { src: brandSanduba, name: "Sanduba Co", niche: "Lanchonete" },
  { src: brandMarmita, name: "Marmita Vovó", niche: "Marmitaria" },
  { src: brandDarkKitchen, name: "Dark Kitchen 7", niche: "Dark kitchen" },
];

function SocialProof() {
  const count = useCountUp(3500);
  return (
    <Section className="!py-16 md:!py-20 border-y border-border/50 bg-card/20">
      <Reveal className="flex flex-col md:flex-row md:items-center justify-center gap-6 md:gap-12 text-center md:text-left mb-12">
        <div>
          <div className="font-display text-3xl md:text-4xl font-bold">
            <span ref={count.ref}>+{count.value.toLocaleString("pt-BR")}</span>
          </div>
          <p className="text-sm text-muted-foreground">negócios acompanhando o lucro na LUUD</p>
        </div>
        <div className="hidden md:block h-12 w-px bg-border" />
        <div>
          <div className="flex items-center justify-center md:justify-start gap-1 text-primary">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">4,9/5 de satisfação dos donos</p>
        </div>
        <div className="hidden md:block h-12 w-px bg-border" />
        <p className="text-sm text-muted-foreground max-w-xs italic">
          “Em 3 semanas descobri R$ 4.200 que sumiam todo mês.”
        </p>
      </Reveal>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {BRANDS.map((b, i) => (
          <Reveal key={b.name} delay={i * 60}>
            <div className="group rounded-2xl border border-border/60 bg-card/50 p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]">
              <img
                src={b.src}
                alt={`Logotipo fictício ${b.name}`}
                loading="lazy"
                width={816}
                height={816}
                className="mx-auto h-16 w-16 object-contain opacity-75 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105"
              />
              <div className="mt-3 text-xs font-semibold">{b.name}</div>
              <div className="text-[11px] text-muted-foreground">{b.niche}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── PROBLEMAS ───────────────── */

const PROBLEMS = [
  { icon: Search, t: "Não sabe o lucro", d: "O extrato mostra movimento, mas ninguém sabe quanto sobrou de verdade no fim do mês." },
  { icon: Wallet, t: "Não controla despesas", d: "Fornecedor, embalagem, entregador, imposto. Tudo sai, nada é medido." },
  { icon: Percent, t: "Não entende o iFood", d: "Taxa, comissão, promoção e repasse: o valor que cai é sempre menor do que o esperado." },
  { icon: Table2, t: "Usa planilhas", d: "Fórmula quebrada, versão errada, tempo perdido e decisão tomada no escuro." },
  { icon: Users, t: "Mistura contas pessoais", d: "PIX pessoal e caixa do negócio no mesmo lugar: o resultado real desaparece." },
  { icon: AlertTriangle, t: "Preço errado", d: "Produto campeão de vendas que vende muito e dá prejuízo em cada pedido." },
];

function Problems() {
  return (
    <Section className="bg-secondary/25">
      <SectionTitle
        eyebrow="O problema"
        title={<>Seu negócio vende muito...<br /><span className="text-muted-foreground">mas sobra dinheiro?</span></>}
        sub="Vender muito não significa lucrar muito. Veja se você se identifica com alguma dessas situações."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PROBLEMS.map((p, i) => (
          <Reveal key={p.t} delay={i * 70}>
            <div className="group h-full rounded-3xl border border-border/60 bg-card/60 p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:bg-card hover:shadow-[var(--shadow-card)]">
              <div className="h-12 w-12 rounded-2xl border border-primary/25 bg-primary/10 grid place-items-center transition-transform duration-300 group-hover:scale-110">
                <p.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{p.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── COMO FUNCIONA ───────────────── */

const STEPS = [
  { icon: Plug, t: "Conecte suas vendas", d: "Importe iFood, 99Food e loja própria, ou use a planilha inteligente. A LUUD organiza tudo sozinha." },
  { icon: Receipt, t: "Cadastre despesas", d: "Fornecedores, insumos, embalagens, salários e taxas em categorias prontas para food service." },
  { icon: Brain, t: "A IA analisa tudo", d: "Cruza vendas, CMV, taxas e custos fixos procurando desperdício e oportunidade de margem." },
  { icon: PiggyBank, t: "Descubra seu lucro", d: "Você vê o lucro real por dia, canal e produto, e recebe o próximo passo para aumentá-lo." },
];

function HowItWorks() {
  return (
    <Section id="como-funciona">
      <SectionTitle eyebrow="Como funciona" title="Do caos ao lucro em 4 passos." sub="Menos de 10 minutos para configurar. Nenhum conhecimento contábil necessário." />
      <div className="relative">
        <div className="hidden lg:block absolute top-[52px] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.t} delay={i * 120}>
              <div className="group relative text-center lg:text-left">
                <div className="mx-auto lg:mx-0 h-14 w-14 rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground grid place-items-center font-display text-lg font-bold shadow-[var(--shadow-glow)] transition-transform duration-300 group-hover:-translate-y-1">
                  {i + 1}
                </div>
                <s.icon className="mt-6 h-6 w-6 text-primary mx-auto lg:mx-0" strokeWidth={1.6} />
                <h3 className="mt-3 font-display text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <Reveal delay={200} className="mt-14 text-center">
        <CTAButton>Começar 7 dias grátis <ArrowRight className="ml-2 h-4 w-4" /></CTAButton>
      </Reveal>
    </Section>
  );
}

/* ───────────────── IA FINANCEIRA ───────────────── */

const AI_MESSAGES = [
  { from: "user" as const, text: "Quanto eu realmente lucrei essa semana?" },
  { from: "ai" as const, text: "Você faturou R$ 18.940 e lucrou R$ 4.612 (24,3% de margem). Foi seu melhor sábado do trimestre." },
  { from: "ai" as const, text: "Seu custo com embalagens aumentou 12%. Se reduzir esse gasto em 8%, seu lucro sobe R$ 2.300." },
];

const AI_CARDS = [
  { icon: AlertTriangle, tone: "warn", t: "Alerta de margem", d: "Combo Família está 6% abaixo do custo alvo." },
  { icon: Lightbulb, tone: "gold", t: "Oportunidade", d: "Terças rendem 31% mais margem. Concentre promoção nesse dia." },
  { icon: TrendingDown, tone: "bad", t: "Vazamento", d: "Fornecedor de queijo subiu 9% sem aviso nos últimos 30 dias." },
  { icon: TrendingUp, tone: "good", t: "Ganho detectado", d: "Ajuste de preço no delivery gerou +R$ 1.870 no mês." },
];

function AISection() {
  return (
    <section id="ia" className="relative py-24 md:py-32 px-5 overflow-hidden bg-[oklch(0.11_0.014_55)]">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-hero)] opacity-90" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-[42rem] rounded-full bg-primary/15 blur-[120px] -z-10" />
      <div className="max-w-6xl mx-auto">
        <SectionTitle
          eyebrow="IA Financeira"
          title={<>Seu consultor financeiro <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">24 horas por dia</span>.</>}
          sub="Enquanto você cuida da cozinha, a IA da LUUD lê seus números, encontra dinheiro perdido e te diz exatamente o que fazer."
        />

        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-8 items-center">
          <Reveal>
            <div className="rounded-3xl border border-primary/20 bg-card/70 backdrop-blur-xl p-6 shadow-[var(--shadow-glow)]">
              <div className="flex items-center gap-3 pb-4 border-b border-border/60">
                <div className="h-10 w-10 rounded-2xl bg-[image:var(--gradient-primary)] grid place-items-center">
                  <BrainCircuit className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Assistente LUUD</div>
                  <div className="text-[11px] text-success flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" /> analisando seus dados
                  </div>
                </div>
              </div>
              <div className="pt-5 space-y-3">
                {AI_MESSAGES.map((m, i) => (
                  <Reveal key={i} delay={i * 180}>
                    <div className={cn("max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.from === "user"
                        ? "ml-auto bg-secondary text-secondary-foreground rounded-br-md"
                        : "bg-primary/10 border border-primary/20 rounded-bl-md")}
                    >
                      {m.text}
                    </div>
                  </Reveal>
                ))}
                <div className="flex items-center gap-1.5 pl-1">
                  {[0, 1, 2].map((i) => <span key={i} className="typing-dot h-2 w-2 rounded-full bg-primary" />)}
                </div>
              </div>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            {AI_CARDS.map((c, i) => (
              <Reveal key={c.t} delay={i * 100}>
                <div className={cn(
                  "h-full rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 animate-float-y",
                  c.tone === "good" && "border-success/30 bg-success/[0.07]",
                  c.tone === "bad" && "border-destructive/30 bg-destructive/[0.07]",
                  c.tone === "warn" && "border-warning/30 bg-warning/[0.07]",
                  c.tone === "gold" && "border-primary/30 bg-primary/[0.07]",
                )} style={{ animationDelay: `${i * 700}ms` }}>
                  <c.icon className={cn("h-5 w-5",
                    c.tone === "good" && "text-success",
                    c.tone === "bad" && "text-destructive",
                    c.tone === "warn" && "text-warning",
                    c.tone === "gold" && "text-primary")} strokeWidth={1.7} />
                  <div className="mt-3 text-sm font-semibold">{c.t}</div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── RECURSOS ───────────────── */

const FEATURES = [
  { icon: LayoutDashboard, t: "Dashboard", d: "Lucro, receita e custos do dia em uma tela." },
  { icon: Tags, t: "Categorias", d: "Estrutura pronta para entradas e saídas do food service." },
  { icon: GitCompareArrows, t: "Comparativos", d: "Mês a mês, canal a canal, sem planilha." },
  { icon: Bell, t: "Alertas", d: "Avisos automáticos quando a margem cai." },
  { icon: Boxes, t: "CMV", d: "Custo real da mercadoria vendida sempre atualizado." },
  { icon: Store, t: "Fornecedores", d: "Quem aumentou preço e quanto isso custou." },
  { icon: History, t: "Histórico de preços", d: "Linha do tempo de cada insumo comprado." },
  { icon: Calculator, t: "Preço ideal", d: "Preço mínimo por produto com a margem que você quer." },
  { icon: Percent, t: "Lucro por plataforma", d: "iFood, 99Food e loja própria lado a lado." },
  { icon: Wallet, t: "Fluxo de caixa", d: "Entradas, saídas e saldo projetado." },
  { icon: FileText, t: "Relatórios", d: "Exportação pronta para contador e sócio." },
  { icon: BrainCircuit, t: "IA Financeira", d: "Diagnóstico e recomendação automática." },
  { icon: Receipt, t: "Controle de despesas", d: "Fixas, variáveis e recorrentes organizadas." },
  { icon: Target, t: "Metas", d: "Meta de faturamento e de lucro acompanhada em tempo real." },
  { icon: Gauge, t: "Indicadores", d: "Ticket médio, margem, CMV% e ponto de equilíbrio." },
  { icon: DatabaseBackup, t: "Backup", d: "Seus dados salvos na nuvem, sempre." },
  { icon: Users, t: "Usuários", d: "Convide sócio, gerente e contador." },
  { icon: ShieldCheck, t: "Permissões", d: "Cada pessoa vê apenas o que precisa." },
  { icon: ShoppingBag, t: "Integração iFood", d: "Importe vendas e taxas em poucos cliques." },
];

function Features() {
  return (
    <Section id="recursos">
      <SectionTitle eyebrow="Todos os recursos" title="Tudo que seu financeiro precisa. Em um só lugar." sub="Da entrada de vendas ao relatório do contador, sem depender de planilha." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.t} delay={(i % 3) * 80}>
            <div className="group h-full rounded-2xl border border-border/60 bg-card/50 p-5 flex gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card">
              <div className="h-10 w-10 shrink-0 rounded-xl border border-border/70 bg-background/50 grid place-items-center transition-colors duration-300 group-hover:border-primary/40 group-hover:bg-primary/10">
                <f.icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{f.t}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── BENEFÍCIOS ───────────────── */

const BENEFITS = [
  { icon: Timer, t: "Economize horas", d: "O que você fazia em uma tarde de planilha acontece automaticamente todo dia." },
  { icon: Search, t: "Descubra desperdícios", d: "A IA aponta o custo que cresceu sem você perceber." },
  { icon: PiggyBank, t: "Entenda seu lucro", d: "Saiba exatamente quanto sobra por pedido, canal e dia da semana." },
  { icon: TrendingDown, t: "Reduza custos", d: "Compare fornecedores e negocie com número na mão." },
  { icon: LineChart, t: "Decida com dados", d: "Preço, promoção e cardápio definidos por margem, não por achismo." },
  { icon: Table2, t: "Nunca mais planilhas", d: "Uma base viva, atualizada e acessível pelo celular." },
];

function Benefits() {
  return (
    <Section id="beneficios" className="bg-secondary/25">
      <SectionTitle eyebrow="Benefícios" title="O que muda na sua rotina." sub="A diferença entre trabalhar muito e trabalhar com lucro." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BENEFITS.map((b, i) => (
          <Reveal key={b.t} delay={i * 80}>
            <div className="group h-full rounded-3xl border border-border/60 bg-card/60 p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)]">
              <div className="h-14 w-14 rounded-2xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)] transition-transform duration-300 group-hover:rotate-6">
                <b.icon className="h-6 w-6 text-primary-foreground" strokeWidth={1.6} />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold">{b.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── DASHBOARD EM DESTAQUE ───────────────── */

function DashboardShowcase() {
  return (
    <Section id="dashboard" className="relative overflow-hidden">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-[38rem] rounded-full bg-primary/10 blur-[110px] -z-10" />
      <SectionTitle eyebrow="Demonstração" title="Um painel vivo, atualizado a cada pedido." sub="Números crescendo, gráficos sendo desenhados e a IA comentando o que está acontecendo com o seu dinheiro." />
      <Reveal>
        <div className="rounded-[28px] border border-border/60 bg-card/40 p-3 md:p-5 backdrop-blur-xl shadow-[var(--shadow-card)]">
          <DashboardMock />
        </div>
      </Reveal>
      <Reveal delay={150}>
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { icon: BarChart3, t: "Comparativos", d: "Compare períodos e canais em um clique." },
            { icon: Clock, t: "Tempo real", d: "Cada venda lançada muda seu lucro na hora." },
            { icon: ChefHat, t: "Feito para cozinha", d: "Linguagem do seu dia a dia, não do contador." },
          ].map((c, i) => (
            <div key={c.t} className="rounded-2xl border border-border/60 bg-card/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40" style={{ transitionDelay: `${i * 40}ms` }}>
              <c.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
              <div className="mt-3 text-sm font-semibold">{c.t}</div>
              <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

/* ───────────────── DEPOIMENTOS ───────────────── */

const TESTIMONIALS = [
  { photo: rafaelPhoto.url, name: "Rafael Moretti", role: "Sócio-proprietário", brand: "Prime Burg", logo: brandPrimeBurg, quote: "Descobri que meu combo mais vendido dava prejuízo. Ajustei o preço e o lucro subiu 22% em dois meses." },
  { photo: julianaPhoto.url, name: "Juliana Prado", role: "Fundadora", brand: "Bella Massa", logo: brandBellaMassa, quote: "Parei com quatro planilhas. Hoje abro o celular e sei exatamente quanto sobrou ontem." },
  { photo: diegoPhoto.url, name: "Diego Ramos", role: "Gestor", brand: "Dark Kitchen 7", logo: brandDarkKitchen, quote: "A IA achou um aumento silencioso de fornecedor. Só isso já pagou o plano do ano inteiro." },
];

function Testimonials() {
  return (
    <Section className="bg-secondary/25">
      <SectionTitle eyebrow="Depoimentos" title="Donos que passaram a enxergar o próprio lucro." sub="Histórias ilustrativas de perfis reais de negócios atendidos pela LUUD." />
      <div className="grid md:grid-cols-3 gap-5">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 100}>
            <div className="h-full rounded-3xl border border-border/60 bg-card/60 p-7 flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-1 text-primary">
                {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/90 flex-1">“{t.quote}”</p>
              <div className="mt-6 pt-5 border-t border-border/60 flex items-center gap-3">
                <img src={t.photo} alt={t.name} loading="lazy" width={96} height={96} className="h-11 w-11 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.role} · {t.brand}</div>
                </div>
                <img src={t.logo} alt={`Logotipo fictício ${t.brand}`} loading="lazy" width={816} height={816} className="h-9 w-9 object-contain opacity-70" />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── PLANOS ───────────────── */

const TIERS = ["basico", "pro", "premium"] as const;

function Plans() {
  return (
    <Section id="planos">
      <SectionTitle
        eyebrow="Planos"
        title="Evolua no seu ritmo. Comece com 7 dias grátis."
        sub="Sem cartão de crédito. Você escolhe continuar só depois de ver seu lucro real."
      />
      <div className="grid md:grid-cols-3 gap-5 items-start">
        {TIERS.map((tier, i) => {
          const featured = tier === "premium";
          const features = PLAN_FEATURES[tier];
          const shown = tier === "basico" ? features.slice(0, 8) : tier === "pro" ? PLAN_FEATURES.pro.slice(-10) : PLAN_FEATURES.premium.slice(-12);
          return (
            <Reveal key={tier} delay={i * 110}>
              <div className={cn(
                "relative h-full rounded-3xl border p-7 transition-all duration-300 hover:-translate-y-1.5",
                featured
                  ? "border-primary/50 bg-card shadow-[var(--shadow-glow)] md:-mt-4 md:pb-10"
                  : "border-border/60 bg-card/50 hover:border-primary/30",
              )}>
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[image:var(--gradient-primary)] px-4 py-1 text-[11px] font-bold text-primary-foreground uppercase tracking-wider">
                    Mais vendido
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {tier === "premium" ? <Crown className="h-4 w-4 text-primary" /> : tier === "pro" ? <Zap className="h-4 w-4 text-primary" /> : <PackageOpen className="h-4 w-4 text-primary" />}
                  <span className="font-display text-lg font-semibold">{PLAN_LABEL[tier]}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-primary">{PLAN_TAGLINE[tier]}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{PLAN_PROMISE[tier]}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className="font-display text-4xl font-bold tracking-tight">
                    {PLAN_PRICES[tier].mensal.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">/mês</span>
                </div>

                <Link to="/auth" className="mt-6 block">
                  <Button className={cn("w-full h-12 rounded-2xl font-semibold transition-all duration-300 hover:-translate-y-0.5",
                    featured ? "bg-[image:var(--gradient-primary)] text-primary-foreground" : "")}
                    variant={featured ? "default" : "outline"}
                  >
                    Começar 7 dias grátis
                  </Button>
                </Link>

                <ul className="mt-7 space-y-2.5">
                  {shown.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                  {tier !== "basico" && (
                    <li className="flex items-center gap-2 text-xs text-primary font-medium pt-1">
                      <Plus className="h-3.5 w-3.5" /> tudo do plano {tier === "pro" ? "Básico" : "Pro"}
                    </li>
                  )}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/* ───────────────── FAQ ───────────────── */

const FAQS = [
  { q: "Preciso entender de contabilidade?", a: "Não. A LUUD usa a linguagem do seu dia a dia: venda, custo, taxa, lucro. Tudo já vem categorizado para food service." },
  { q: "Como funciona o teste de 7 dias?", a: "Você cria a conta, usa a plataforma completa por 7 dias e só decide continuar depois. Não pedimos cartão de crédito." },
  { q: "Consigo importar minhas vendas do iFood?", a: "Sim. Você importa o relatório do iFood, 99Food e loja própria, ou usa a planilha inteligente que a IA interpreta automaticamente." },
  { q: "A LUUD serve para qual tipo de negócio?", a: "Hamburguerias, pizzarias, lanchonetes, marmitarias, açaiterias, cafeterias, dark kitchens e qualquer operação de delivery." },
  { q: "Posso dar acesso ao meu sócio ou contador?", a: "Sim. Você convida outras pessoas e define o que cada uma pode ver dentro da plataforma." },
  { q: "Meus dados ficam seguros?", a: "Sim. Tudo é armazenado com criptografia e backup em nuvem, com acesso restrito por permissão." },
  { q: "Posso cancelar quando quiser?", a: "Pode. Sem multa, sem fidelidade e sem burocracia." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" className="bg-secondary/25">
      <SectionTitle eyebrow="FAQ" title="Perguntas frequentes." />
      <div className="max-w-3xl mx-auto space-y-3">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 50}>
            <div className={cn("rounded-2xl border bg-card/60 overflow-hidden transition-colors duration-300",
              open === i ? "border-primary/40" : "border-border/60 hover:border-border")}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center gap-4 px-6 py-5 text-left"
                aria-expanded={open === i}
              >
                <span className="flex-1 text-sm md:text-base font-medium">{f.q}</span>
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-primary transition-transform duration-300", open === i && "rotate-90")} />
              </button>
              <div className={cn("grid transition-all duration-300 ease-out", open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── CTA FINAL ───────────────── */

function FinalCTA() {
  return (
    <section className="relative py-28 md:py-40 px-5 overflow-hidden bg-[oklch(0.11_0.014_55)]">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-hero)]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-[42rem] rounded-full bg-primary/15 blur-[130px] -z-10" />
      <Reveal className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] text-balance">
          Você já vende.<br />
          Agora descubra quanto{" "}
          <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">realmente lucra</span>.
        </h2>
        <div className="mt-10">
          <CTAButton className="text-base">Começar 7 dias grátis <ArrowRight className="ml-2 h-4 w-4" /></CTAButton>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">Sem cartão · Cancelamento livre</p>
      </Reveal>
    </section>
  );
}

/* ───────────────── FOOTER ───────────────── */

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background px-5 py-14">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Descubra seu lucro. Inteligência financeira para restaurantes, delivery e food service.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a href="https://www.instagram.com/luud.app/" target="_blank" rel="noreferrer" aria-label="Instagram da LUUD"
                className="h-10 w-10 rounded-xl border border-border/60 grid place-items-center text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary">
                <Instagram className="h-4 w-4" />
              </a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" aria-label="WhatsApp da LUUD"
                className="h-10 w-10 rounded-xl border border-border/60 grid place-items-center text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-4">Navegação</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {NAV.map((n) => (
                <li key={n.href}><a href={n.href} className="transition-colors hover:text-foreground">{n.label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold mb-4">Contato</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a href={WHATSAPP} target="_blank" rel="noreferrer" className="flex items-center gap-2 transition-colors hover:text-foreground">
                  <MessageCircle className="h-4 w-4" /> (62) 99396-9722
                </a>
              </li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contato@luudpro.app</li>
              <li><Link to="/auth" className="transition-colors hover:text-foreground">Entrar na plataforma</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} LUUD. Todos os direitos reservados.</span>
          <span>Marcas e depoimentos exibidos são ilustrativos.</span>
        </div>
      </div>
    </footer>
  );
}
