import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, Stethoscope, Lightbulb, Calculator, Wallet, Target, TrendingUp, Loader2 } from "lucide-react";
import { PlanGate } from "@/components/plan-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askAssistant, type AssistantMessage, type AssistantMode } from "@/lib/ai/assistant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistente-ia")({
  component: AssistentePage,
});

function AssistentePage() {
  return (
    <PlanGate
      min="premium"
      featureName="Assistente IA Financeiro"
      description="Um consultor financeiro 24h que analisa seus dados, gera diagnósticos, recomenda ações e responde suas perguntas."
    >
      <Assistente />
    </PlanGate>
  );
}

function Assistente() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl grid place-items-center bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistente IA Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Analisa vendas, gastos, CMV, metas e fornecedores em tempo real. Responde suas perguntas como um consultor.
          </p>
        </div>
      </header>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="chat" className="gap-2"><Bot className="h-4 w-4" />Chat</TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-2"><Stethoscope className="h-4 w-4" />Diagnóstico</TabsTrigger>
          <TabsTrigger value="recomendacoes" className="gap-2"><Lightbulb className="h-4 w-4" />Ações</TabsTrigger>
          <TabsTrigger value="precificacao" className="gap-2"><Calculator className="h-4 w-4" />Preços</TabsTrigger>
          <TabsTrigger value="prolabore" className="gap-2"><Wallet className="h-4 w-4" />Pró-labore</TabsTrigger>
          <TabsTrigger value="previsao_metas" className="gap-2"><Target className="h-4 w-4" />Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          <ChatPanel />
        </TabsContent>
        <TabsContent value="diagnostico" className="mt-6">
          <OneShotPanel
            mode="diagnostico"
            title="Diagnóstico automático"
            description="A IA compara o dia mais recente com a média dos últimos 7 dias e destaca as mudanças que mais impactam seu lucro."
            cta="Gerar diagnóstico"
            icon={<Stethoscope className="h-5 w-5" />}
          />
        </TabsContent>
        <TabsContent value="recomendacoes" className="mt-6">
          <OneShotPanel
            mode="recomendacoes"
            title="Recomendações inteligentes"
            description="Ações práticas para aumentar lucro ou reduzir custos, com impacto estimado em R$."
            cta="Gerar recomendações"
            icon={<Lightbulb className="h-5 w-5" />}
          />
        </TabsContent>
        <TabsContent value="precificacao" className="mt-6">
          <OneShotPanel
            mode="precificacao"
            title="Precificação inteligente"
            description="Preço recomendado, margem esperada e impacto de taxas e CMV, sempre justificado."
            cta="Analisar precificação"
            icon={<Calculator className="h-5 w-5" />}
          />
        </TabsContent>
        <TabsContent value="prolabore" className="mt-6">
          <OneShotPanel
            mode="prolabore"
            title="Sugestão de pró-labore"
            description="Quanto você pode retirar este mês sem comprometer a saúde do negócio."
            cta="Calcular pró-labore"
            icon={<Wallet className="h-5 w-5" />}
          />
        </TabsContent>
        <TabsContent value="previsao_metas" className="mt-6">
          <OneShotPanel
            mode="previsao_metas"
            title="Previsão de metas"
            description="Probabilidade de atingir a meta, quanto falta e quanto precisa vender por dia."
            cta="Prever metas"
            icon={<Target className="h-5 w-5" />}
          />
        </TabsContent>
      </Tabs>

      <InsightsCard />
    </div>
  );
}

// -------- Chat --------

const SUGGESTED = [
  "Por que meu lucro caiu?",
  "Onde estou gastando mais?",
  "O que posso melhorar essa semana?",
  "Quanto posso economizar renegociando fornecedores?",
  "Qual meu maior problema financeiro agora?",
  "Qual canal me dá mais lucro?",
];

function ChatPanel() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const ask = useServerFn(askAssistant);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: async (userText: string) => {
      const next: AssistantMessage[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      const res = await ask({ data: { messages: next, mode: "chat" } });
      setMessages([...next, { role: "assistant", content: res.content }]);
    },
    onError: (err: any) => {
      setMessages((m) => [...m, { role: "assistant", content: `Erro: ${err.message ?? "falha ao consultar a IA"}` }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || mutation.isPending) return;
    setInput("");
    mutation.mutate(t);
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-22rem)] min-h-[420px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-secondary grid place-items-center">
              <Bot className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Faça uma pergunta ao seu consultor financeiro</p>
              <p className="text-xs text-muted-foreground">A IA analisa seus dados dos últimos 90 dias em tempo real.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent border border-border/60 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-3">
            <Loader2 className="h-4 w-4 animate-spin" /> A IA está analisando seus dados...
          </div>
        )}
      </div>
      <form
        className="border-t border-border/60 p-3 flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre suas finanças..."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          className="resize-none"
        />
        <Button type="submit" size="icon" disabled={mutation.isPending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={cn("flex gap-2", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground border border-border/60",
        )}
      >
        <MarkdownLite text={content} />
      </div>
    </div>
  );
}

// Minimal markdown: **bold**, - bullets, headings ##
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.startsWith("## ")) return <div key={i} className="font-semibold text-base mt-2">{renderInline(line.slice(3))}</div>;
        if (line.startsWith("# ")) return <div key={i} className="font-semibold text-lg mt-2">{renderInline(line.slice(2))}</div>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <span key={i}>{p}</span>;
  });
}

// -------- One-shot panel (used for diagnostico/recomendacoes/etc) --------

function OneShotPanel({
  mode,
  title,
  description,
  cta,
  icon,
}: {
  mode: AssistantMode;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
}) {
  const ask = useServerFn(askAssistant);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await ask({ data: { messages: [{ role: "user", content: "Gere agora." }], mode } });
      setResult(res.content);
    },
    onError: (err: any) => setError(err.message ?? "Falha ao consultar a IA."),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3 items-start">
          <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center">{icon}</div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 text-sm">
          <MarkdownLite text={result} />
        </div>
      )}

      {!result && !mutation.isPending && !error && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          Clique em "{cta}" para gerar uma análise atualizada com base nos seus dados.
        </div>
      )}
    </Card>
  );
}

// -------- Insights auto-loaded card --------

function InsightsCard() {
  const ask = useServerFn(askAssistant);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    ask({ data: { messages: [{ role: "user", content: "Gere agora." }], mode: "insights" } })
      .then((r) => setContent(r.content))
      .catch((e: any) => setError(e.message ?? "Falha ao carregar insights."))
      .finally(() => setLoading(false));
  }, [ask]);

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Insights personalizados</h2>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            loadedRef.current = false;
            setContent(null);
            setError(null);
            setLoading(true);
            ask({ data: { messages: [{ role: "user", content: "Gere agora." }], mode: "insights" } })
              .then((r) => setContent(r.content))
              .catch((e: any) => setError(e.message ?? "Falha ao carregar insights."))
              .finally(() => setLoading(false));
          }}
          disabled={loading}
        >
          Atualizar
        </Button>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisando padrões do seu negócio...
        </div>
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {content && (
        <div className="text-sm">
          <MarkdownLite text={content} />
        </div>
      )}
    </Card>
  );
}
