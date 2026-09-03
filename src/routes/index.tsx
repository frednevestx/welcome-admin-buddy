import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import {
  MessageCircle, CheckCircle2, ArrowRight, ArrowUpRight, Check, CheckCheck, Heart,
  Users, Receipt, Wallet, Truck, ShoppingBasket, Percent, Repeat, CalendarClock,
  LineChart, LayoutDashboard, HelpCircle, Instagram, Camera, Send, Pencil,
  MessageSquareText, Sparkles, ShieldCheck, ArrowDownRight, Bell, AlertTriangle,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

const WHATSAPP_LINK = "https://wa.me/556291152495?text=Quero%20testar%20a%20IA%20financeira";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "LUUD — Organize as finanças do seu negócio pelo WhatsApp" },
      { name: "description", content: "Sem planilhas. Sem lançamentos complicados. Basta conversar: a IA da LUUD entende suas mensagens sobre recebimentos, clientes, despesas e caixa. Grátis para começar." },
      { property: "og:title", content: "LUUD — Sem planilhas. Sem lançamentos complicados. Basta conversar." },
      { property: "og:description", content: "Você cuida do seu negócio. A IA cuida dos seus números. Comece grátis pelo WhatsApp, sem mensalidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LUUD — Sem planilhas. Basta conversar." },
      { name: "twitter:description", content: "Organize recebimentos, clientes, despesas e fluxo de caixa conversando pelo WhatsApp. Grátis para começar." },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.classList.add("light");
    return () => {
      html.classList.remove("light");
      if (hadDark) html.classList.add("dark");
    };
  }, []);

  return (
    <div className="landing-warm min-h-screen bg-background text-foreground overflow-x-hidden antialiased scroll-smooth">
      <TopBar />
      <main>
        <Hero />
        <ClarityStrip />
        <TransformStrip />
        <Routine />
        <ConversationFlow />
        <ContextSection />
        <Analyses />
        <DashboardSection />
        <HowItWorks />
        <FreeSection />
        <SocialProof />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <MobileCTA />
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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-500 ease-out",
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("py-20 md:py-28 px-5", className)}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, sub, align = "center" }: { eyebrow?: string; title: ReactNode; sub?: string; align?: "center" | "left" }) {
  return (
    <Reveal className={cn("mb-12 md:mb-16 max-w-2xl", align === "center" ? "mx-auto text-center" : "")}>
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary mb-4">
          <span className="h-px w-5 bg-primary/60" /> {eyebrow}
        </span>
      )}
      <h2 className="font-display text-[1.75rem] leading-[1.15] md:text-[2.6rem] font-bold text-balance">{title}</h2>
      {sub && <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed text-pretty">{sub}</p>}
    </Reveal>
  );
}

function WhatsAppCTA({ label = "Testar grátis no WhatsApp", className, size = "lg", tone = "primary" }: {
  label?: string; className?: string; size?: "lg" | "sm"; tone?: "primary" | "outline";
}) {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex", className)}
      aria-label={`${label} — abre uma conversa no WhatsApp`}
    >
      <Button
        size={size === "lg" ? "lg" : "default"}
        variant={tone === "outline" ? "outline" : "default"}
        className={cn(
          "rounded-full font-semibold transition-all duration-200",
          size === "lg" ? "h-13 px-7 text-[0.95rem]" : "h-10 px-5 text-sm",
          tone === "primary"
            ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-105"
            : "border-border bg-transparent hover:bg-secondary",
        )}
      >
        <WhatsAppIcon className="mr-2 h-4.5 w-4.5" />
        {label}
      </Button>
    </a>
  );
}

function FreeNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Grátis para começar. Sem mensalidade. Sem plano pago para testar. O botão abre o WhatsApp.
    </p>
  );
}

function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground", className)}>
      Exemplo demonstrativo
    </span>
  );
}

/* ───────────────── HEADER ───────────────── */

const NAV = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "O que a IA entende", href: "#contexto" },
  { label: "Dúvidas", href: "#faq" },
];

function TopBar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-border bg-background/90 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-5">
        <Link to="/" aria-label="LUUD — página inicial" className="rounded-xl bg-walnut px-3 py-2">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/acesso" className="hidden sm:inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Entrar
          </Link>
          <WhatsAppCTA label="Testar grátis" size="sm" />
        </div>
      </div>
    </header>
  );
}

/* ───────────────── CHAT MOCK ───────────────── */

type Bubble = { from: "user" | "ia"; text: string; note?: string };

function ChatBubble({ b }: { b: Bubble }) {
  const isUser = b.from === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.84rem] leading-snug shadow-[0_1px_1px_rgba(36,27,22,0.08)]",
          isUser
            ? "rounded-br-md bg-[#DCF7C5] text-[#1B2B20]"
            : "rounded-bl-md bg-white text-[#1B2B20]",
        )}
      >
        {!isUser && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#3FAF72]">LUUD IA</span>}
        <p className="whitespace-pre-line">{b.text}</p>
        {b.note && <p className="mt-1.5 text-[11px] italic text-[#5C6B5F]">{b.note}</p>}
        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#5C6B5F]">
          09:{isUser ? "41" : "42"}
          {isUser ? <CheckCheck className="h-3 w-3" /> : null}
        </span>
      </div>
    </div>
  );
}

function PhoneChat({ bubbles, title = "LUUD IA", className }: { bubbles: Bubble[]; title?: string; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[330px] rounded-[2.25rem] border border-border bg-walnut p-2.5 shadow-[0_30px_60px_-30px_rgba(36,27,22,0.45)]", className)}>
      <div className="overflow-hidden rounded-[1.85rem] bg-[#EDE6DC]">
        <div className="flex items-center gap-2.5 bg-[#1F3D2E] px-3.5 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3FAF72] text-xs font-bold text-white">L</span>
          <div className="min-w-0">
            <p className="truncate text-[0.8rem] font-semibold text-white">{title}</p>
            <p className="text-[10px] text-white/70">online</p>
          </div>
        </div>
        <div className="space-y-2.5 px-3 py-4">
          {bubbles.map((b, i) => <ChatBubble key={i} b={b} />)}
        </div>
        <div className="flex items-center gap-2 border-t border-black/5 bg-[#E4DBCF] px-3 py-2.5">
          <span className="flex-1 rounded-full bg-white px-3 py-2 text-[0.75rem] text-[#8A7F72]">Mensagem</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3FAF72]">
            <Send className="h-3.5 w-3.5 text-white" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── HERO ───────────────── */

const HERO_CHAT: Bubble[] = [
  { from: "user", text: "Recebi R$ 3.200 do cliente Marcos." },
  { from: "ia", text: "Receita registrada. Cliente: Marcos. Quer associar a algum serviço ou categoria?" },
  { from: "user", text: "Paguei R$ 450 de internet no Pix." },
  { from: "ia", text: "Despesa registrada em Serviços. Forma de pagamento: Pix." },
  { from: "user", text: "Quanto sobrou este mês?" },
  { from: "ia", text: "Posso calcular com base nas movimentações registradas. Você quer considerar o mês atual?" },
];

function Hero() {
  return (
    <section className="relative px-5 pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="max-w-6xl mx-auto grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-whatsapp" />
            IA financeira que funciona dentro do WhatsApp
          </span>
          <h1 className="mt-6 font-display text-[2.1rem] leading-[1.1] font-bold text-balance md:text-[3.4rem]">
            Sem planilhas. Sem lançamentos complicados. <span className="text-primary">Basta conversar.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Envie uma mensagem pelo WhatsApp sobre uma venda, recebimento, despesa ou compra. A IA entende o contexto,
            organiza as informações e ajuda você a enxergar melhor o dinheiro do seu negócio.
          </p>
          <p className="mt-4 font-display text-base font-semibold text-foreground md:text-lg">
            Você cuida do seu negócio. A IA cuida dos seus números.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3">
            <WhatsAppCTA />
            <FreeNote />
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {["Nenhum sistema novo para aprender", "Sem formulário longo para começar", "Você confirma antes de registrar", "Correção por mensagem, na hora"].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="relative">
          <PhoneChat bubbles={HERO_CHAT} />
          <DemoTag className="mt-4 mx-auto block w-fit" />
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────── CLAREZA IMEDIATA ───────────────── */

function ClarityStrip() {
  const items = [
    { icon: MessageCircle, text: "Converse pelo WhatsApp." },
    { icon: Repeat, text: "Deixe a IA organizar." },
    { icon: LineChart, text: "Veja o negócio com mais clareza." },
  ];
  return (
    <div className="on-walnut px-5 py-10 md:py-12">
      <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-3">
        {items.map((i, idx) => (
          <Reveal key={i.text} delay={idx * 80} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card">
              <i.icon className="h-4.5 w-4.5 text-primary" />
            </span>
            <p className="font-display text-[0.98rem] font-semibold text-foreground">{i.text}</p>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── ROTINA ───────────────── */

const ROUTINE = [
  { icon: Wallet, title: "Recebimentos", body: "Registre o que entrou e de qual cliente, na hora em que acontece.", result: "O dinheiro que entra deixa de depender da sua memória." },
  { icon: Users, title: "Clientes", body: "Acompanhe quem comprou, quem pagou e quem ainda precisa pagar.", result: "Você cobra no tempo certo, sem procurar em vários lugares." },
  { icon: Receipt, title: "Despesas", body: "Registre custos por mensagem, sem preencher formulários.", result: "As saídas ficam visíveis antes de virarem surpresa." },
  { icon: CalendarClock, title: "Fluxo de caixa", body: "Entenda o que entrou, o que saiu e o que está por vir.", result: "Decisões tomadas com o caixa à vista." },
];

const ROUTINE_EXTRA = [
  { icon: Truck, label: "Fornecedores" },
  { icon: ShoppingBasket, label: "Compras" },
  { icon: Percent, label: "Margem" },
  { icon: Receipt, label: "Custos operacionais" },
  { icon: Wallet, label: "Caixa disponível" },
  { icon: Repeat, label: "Recorrências" },
];

function Routine() {
  return (
    <Section id="rotina">
      <SectionTitle
        eyebrow="Feita para a rotina do seu negócio"
        title="O seu dia continua igual. Os seus números ficam organizados."
        sub="Para lojas, negócios locais e prestadores de serviço que acompanham o dinheiro todos os dias."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {ROUTINE.map((r, i) => (
          <Reveal key={r.title} delay={i * 70}>
            <article className="h-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
                <r.icon className="h-4.5 w-4.5 text-primary" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              <p className="mt-3 border-t border-border pt-3 text-sm font-medium text-foreground">{r.result}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120} className="mt-8 rounded-2xl border border-border bg-secondary/50 p-6">
        <p className="text-sm font-semibold text-foreground">Também para quem compra para revender ou produzir:</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {ROUTINE_EXTRA.map((e) => (
            <span key={e.label} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-foreground">
              <e.icon className="h-4 w-4 text-primary" /> {e.label}
            </span>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

/* ───────────────── DEMONSTRAÇÃO CONVERSACIONAL ───────────────── */

const FLOW_CHAT: Bubble[] = [
  { from: "user", text: "Comprei mercadoria do fornecedor Silva, 1.480" },
  { from: "ia", text: "Entendi uma compra de R$ 1.480,00 com o fornecedor Silva. Foi pago agora ou ficou a prazo?" },
  { from: "user", text: "a prazo, vence dia 20" },
  { from: "ia", text: "Registrado como compra a prazo, vencimento em 20. Vou considerar no seu fluxo de caixa previsto." },
  { from: "user", text: "na verdade foi 1.380" },
  { from: "ia", text: "Corrigido para R$ 1.380,00. O lançamento anterior foi substituído." },
];

const FLOW_STEPS = [
  { n: "01", title: "Você manda a mensagem", body: "Do jeito que você falaria com alguém da sua equipe. Sem formato, sem código, sem campo obrigatório." },
  { n: "02", title: "A IA interpreta a intenção", body: "Ela identifica se é entrada, saída, compra, cliente, fornecedor ou uma pergunta sobre o caixa." },
  { n: "03", title: "Pergunta quando falta informação", body: "Se algo estiver incompleto, ela pergunta antes de registrar. Nada é inventado." },
  { n: "04", title: "Você confirma ou corrige", body: "Uma mensagem basta para ajustar valor, categoria ou data. O controle continua com você." },
  { n: "05", title: "A informação aparece organizada", body: "O lançamento entra no painel, dentro do período e da categoria certos." },
];

function ConversationFlow() {
  return (
    <div className="on-walnut px-5 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <SectionTitle
          eyebrow="Demonstração"
          title="Veja como uma conversa vira organização financeira."
          sub="Confirmação, correção e informação incompleta fazem parte do fluxo — a IA é útil e transparente, não infalível."
        />
        <div className="grid items-start gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <PhoneChat bubbles={FLOW_CHAT} />
            <DemoTag className="mt-4 mx-auto block w-fit" />
          </Reveal>
          <Reveal delay={120}>
            <ol className="space-y-4">
              {FLOW_STEPS.map((s) => (
                <li key={s.n} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                  <span className="font-display text-sm font-bold text-primary">{s.n}</span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── A IA ENTENDE O CONTEXTO ───────────────── */

const CONTEXT_CASES = [
  { msg: "Vendi 240 no cartão hoje", read: "Receita, forma de pagamento cartão, data de hoje", action: "Entrada registrada no período atual." },
  { msg: "Paguei o Silva, 1.380", read: "Saída com fornecedor já conhecido pelo histórico", action: "Despesa vinculada ao fornecedor Silva." },
  { msg: "Aluguel todo dia 5, 2.100", read: "Custo recorrente mensal", action: "Recorrência criada para os próximos meses." },
  { msg: "Vou comprar uma máquina no mês que vem", read: "Intenção futura, não uma despesa realizada", action: "Acompanhado como planejamento, sem lançar gasto." },
  { msg: "Recebi da Ana mas não sei de qual serviço", read: "Informação incompleta", action: "A IA pergunta antes de registrar a categoria." },
  { msg: "Como está o caixa esta semana?", read: "Pergunta sobre fluxo de caixa", action: "Resposta calculada sobre as movimentações registradas." },
];

function ContextSection() {
  return (
    <Section id="contexto">
      <SectionTitle
        eyebrow="O que a IA entende"
        title="A IA entende o contexto, não só palavras."
        sub="Receitas, despesas, clientes, fornecedores, categorias, forma de pagamento, recorrências, intenções futuras e perguntas sobre o caixa."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {CONTEXT_CASES.map((c, i) => (
          <Reveal key={c.msg} delay={i * 60}>
            <article className="h-full rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <p className="rounded-xl rounded-bl-md bg-[#DCF7C5] px-3.5 py-2.5 text-[0.86rem] text-[#1B2B20]">“{c.msg}”</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Interpretação:</dt>
                  <dd className="text-foreground">{c.read}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Ação:</dt>
                  <dd className="font-medium text-foreground">{c.action}</dd>
                </div>
              </dl>
            </article>
          </Reveal>
        ))}
      </div>
      <Reveal delay={100} className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Pencil className="h-4 w-4 text-primary" />
        Quando a IA não tem certeza, ela pergunta. Quando você discorda, uma mensagem corrige.
        <DemoTag />
      </Reveal>
    </Section>
  );
}

/* ───────────────── ANÁLISES ───────────────── */

const ANALYSES = [
  "As despesas com fornecedores aumentaram neste mês.",
  "Suas vendas cresceram, mas a margem diminuiu.",
  "O fluxo de caixa previsto exige atenção nas próximas semanas.",
  "Você pode revisar estes custos recorrentes.",
];

function Analyses() {
  return (
    <Section className="bg-secondary/40">
      <SectionTitle
        eyebrow="Análises"
        title="Mais do que registrar: entenda o que está acontecendo."
        sub="A IA compara períodos e aponta o que mudou. A decisão continua sendo sua."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {ANALYSES.map((a, i) => (
          <Reveal key={a} delay={i * 70}>
            <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5">
              <ArrowUpRight className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
              <p className="text-[0.95rem] leading-relaxed text-foreground">{a}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120} className="mt-8 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          A LUUD apoia a sua decisão: ela mostra o que os números indicam, com a fonte do cálculo. Ela não garante lucro,
          não elimina riscos e não substitui o seu contador.
        </p>
      </Reveal>
    </Section>
  );
}

/* ───────────────── DASHBOARD ───────────────── */

const DASH_ITEMS = ["Receitas", "Despesas", "Fluxo de caixa", "Clientes", "Fornecedores", "Indicadores", "Relatórios", "Metas", "Alertas", "Histórico financeiro"];

function DashboardSection() {
  return (
    <Section id="painel">
      <SectionTitle
        eyebrow="Painel"
        title="Cada conversa vira informação organizada."
        sub="O painel é a consequência das suas mensagens — você só entra nele quando quiser ver o conjunto."
      />
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LayoutDashboard className="h-4 w-4 text-primary" /> Painel LUUD · mês atual
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Entradas", value: "R$ 18.740" },
                { label: "Saídas", value: "R$ 12.190" },
                { label: "Resultado", value: "R$ 6.550" },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-secondary/50 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className="mt-1 font-display text-lg font-bold text-foreground">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex h-32 items-end gap-2" aria-hidden="true">
              {[38, 52, 44, 66, 58, 74, 62, 82].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-md bg-primary/70" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Visualização ilustrativa da estrutura do painel.</p>
          </div>
          <DemoTag className="mt-4" />
        </Reveal>
        <Reveal delay={100}>
          <p className="text-base leading-relaxed text-muted-foreground">
            Você conversa no WhatsApp e, quando quiser, abre o painel para ver tudo reunido:
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {DASH_ITEMS.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm">
                <Check className="h-3.5 w-3.5 text-primary" /> {d}
              </span>
            ))}
          </div>
          <div className="mt-8">
            <WhatsAppCTA label="Começar pelo WhatsApp" />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ───────────────── COMO FUNCIONA ───────────────── */

function HowItWorks() {
  const steps = [
    { n: "01", title: "Clique no botão e abra o WhatsApp", body: "Sem cadastro longo, sem instalação, sem cartão." },
    { n: "02", title: "Converse com a IA sobre suas movimentações", body: "Vendas, recebimentos, despesas, compras e fornecedores." },
    { n: "03", title: "Acompanhe tudo organizado", body: "Faça perguntas sobre suas finanças quando precisar." },
  ];
  return (
    <div className="on-walnut px-5 py-20 md:py-28" id="como-funciona">
      <div className="max-w-6xl mx-auto">
        <SectionTitle eyebrow="Como funciona" title="Três passos. Nenhum sistema novo." />
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <article className="h-full rounded-2xl border border-border bg-card p-6">
                <span className="font-display text-2xl font-bold text-primary">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200} className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            Comece grátis, sem mensalidade e sem sistema complicado.
          </p>
          <WhatsAppCTA />
        </Reveal>
      </div>
    </div>
  );
}

/* ───────────────── GRATUIDADE ───────────────── */

function FreeSection() {
  return (
    <Section id="gratis">
      <Reveal className="mx-auto max-w-3xl rounded-3xl border border-primary/30 bg-card p-8 text-center shadow-[var(--shadow-card)] md:p-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Heart className="h-3.5 w-3.5 text-primary" /> Sem mensalidade
        </span>
        <h2 className="mt-5 font-display text-[1.8rem] font-bold leading-tight md:text-4xl">
          Você pode começar agora, de graça.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Não há mensalidade nem plano pago para testar. Abra o WhatsApp, envie sua primeira mensagem e descubra uma forma
          mais simples de organizar as finanças do seu negócio.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <WhatsAppCTA />
          <FreeNote />
        </div>
      </Reveal>
    </Section>
  );
}

/* ───────────────── PROVA SOCIAL (mockups) ───────────────── */

const WA_REVIEWS: { context: string; chat: Bubble[] }[] = [
  {
    context: "Loja local",
    chat: [
      { from: "user", text: "Antes eu anotava os recebimentos em vários lugares. Agora mando a mensagem na hora." },
      { from: "ia", text: "Ótimo. Suas entradas de hoje já estão somadas no período atual." },
    ],
  },
  {
    context: "Prestador de serviços",
    chat: [
      { from: "user", text: "Fechei um serviço de 1.200 e o cliente paga sexta" },
      { from: "ia", text: "Registrei como recebimento previsto para sexta. Vou considerar no seu caixa da semana." },
      { from: "user", text: "isso é bem mais fácil que planilha" },
    ],
  },
];

const IG_REVIEWS = [
  { user: "mercadinho.davila", context: "Pequeno comércio", text: "Testei mandando as despesas do dia por mensagem. Em dois minutos já estava tudo separado por categoria." },
  { user: "studio.ana.unhas", context: "Prestadora de serviço", text: "O que me pegou foi ela perguntar quando faltava informação, em vez de chutar valor." },
  { user: "casa.dos.parafusos", context: "Loja local", text: "Consigo ver quanto entrou e quanto saiu sem abrir planilha nenhuma." },
];

function SocialProof() {
  return (
    <Section className="bg-secondary/40">
      <SectionTitle
        eyebrow="Como as pessoas usam"
        title="A experiência acontece em conversas."
        sub="As telas abaixo são mockups demonstrativos criados para ilustrar o uso do produto — não são clientes, depoimentos ou avaliações reais."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {WA_REVIEWS.map((r, i) => (
          <Reveal key={r.context} delay={i * 80}>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <MessageCircle className="h-4 w-4 text-whatsapp" /> WhatsApp · {r.context}
                </span>
                <DemoTag />
              </div>
              <div className="space-y-2.5 rounded-xl bg-[#EDE6DC] p-3">
                {r.chat.map((b, j) => <ChatBubble key={j} b={b} />)}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {IG_REVIEWS.map((r, i) => (
          <Reveal key={r.user} delay={i * 80}>
            <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.user}</p>
                  <p className="text-[11px] text-muted-foreground">{r.context}</p>
                </div>
                <Instagram className="ml-auto h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-4 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-[0.86rem] leading-snug text-foreground">
                {r.text}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Direct · exemplo</span>
                <DemoTag />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── FAQ ───────────────── */

const FAQ_ITEMS = [
  { q: "Como a IA lida com uma informação incompleta?", a: "Ela não completa por conta própria. Se faltar valor, cliente, fornecedor ou categoria, a IA pergunta antes de registrar." },
  { q: "Posso corrigir ou desfazer um lançamento?", a: "Sim. Basta responder na conversa com a correção — por exemplo “na verdade foi 1.380” — e o lançamento é ajustado." },
  { q: "Como os dados são organizados?", a: "Cada mensagem confirmada vira uma movimentação com valor, data, categoria e, quando informado, cliente ou fornecedor. Isso alimenta o painel, os relatórios e as respostas sobre o caixa." },
  { q: "O que acontece quando a IA não tem certeza?", a: "Ela mostra como entendeu e pede confirmação. Você sempre tem a última palavra antes do registro." },
  { q: "O produto é realmente gratuito?", a: "Sim. Não há mensalidade nem plano pago para testar. Você começa enviando uma mensagem no WhatsApp." },
  { q: "Preciso instalar outro sistema?", a: "Não. O uso do dia a dia acontece no WhatsApp que você já usa. O painel web fica disponível quando você quiser ver o conjunto." },
  { q: "Como começo a usar pelo WhatsApp?", a: "Clique em “Testar grátis no WhatsApp”, envie a primeira mensagem e conte uma movimentação do seu negócio. A IA conduz o resto da conversa." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq">
      <SectionTitle eyebrow="Dúvidas" title="Uso, controle e gratuidade." />
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
        {FAQ_ITEMS.map((f, i) => (
          <div key={f.q}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-[0.95rem] font-medium text-foreground">{f.q}</span>
              <ArrowRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open === i && "rotate-90")} />
            </button>
            {open === i && <p className="px-5 pb-5 pl-12 text-sm leading-relaxed text-muted-foreground">{f.a}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────── CTA FINAL ───────────────── */

function FinalCTA() {
  return (
    <div className="on-walnut px-5 py-20 text-center md:py-28">
      <Reveal className="mx-auto max-w-3xl">
        <h2 className="font-display text-[1.9rem] font-bold leading-tight text-balance md:text-[3rem]">
          Você não precisa aprender mais um sistema. <span className="text-primary">Basta conversar.</span>
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
          Comece gratuitamente pelo WhatsApp e organize melhor os números do seu negócio.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <WhatsAppCTA />
          <FreeNote />
        </div>
      </Reveal>
    </div>
  );
}

/* ───────────────── CTA MOBILE FIXO ───────────────── */

function MobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden">
      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      >
        <MessageCircle className="h-4 w-4" /> Testar grátis no WhatsApp
      </a>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Grátis. Sem mensalidade. Abre o WhatsApp.</p>
    </div>
  );
}

/* ───────────────── FOOTER ───────────────── */

function Footer() {
  return (
    <footer className="border-t border-border px-5 py-12 pb-28 md:pb-12">
      <div className="max-w-6xl mx-auto flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="inline-flex rounded-xl bg-walnut px-3 py-2">
            <Logo />
          </span>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            IA financeira que organiza as finanças do seu negócio por conversas no WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
          <a href="#contexto" className="transition-colors hover:text-foreground">O que a IA entende</a>
          <a href="#faq" className="transition-colors hover:text-foreground">Dúvidas</a>
          <Link to="/auth" className="transition-colors hover:text-foreground">Entrar no painel</Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} LUUD. Conversas e telas exibidas nesta página são exemplos demonstrativos.
      </div>
    </footer>
  );
}
