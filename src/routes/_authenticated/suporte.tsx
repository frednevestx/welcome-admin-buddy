import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SupportThread } from "@/components/support-thread";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { LifeBuoy, Plus, MessageSquare, CheckCircle2, Clock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte")({
  ssr: false,
  component: SupportPage,
});

type Status = "awaiting_support" | "awaiting_user" | "resolved" | "closed";

interface Ticket {
  id: string;
  subject: string;
  status: Status;
  priority: string;
  created_at: string;
  last_message_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  awaiting_support: "Aguardando suporte",
  awaiting_user: "Aguardando você",
  resolved: "Resolvido",
  closed: "Fechado",
};

function SupportPage() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("id, subject, status, priority, created_at, last_message_at")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
    refetchInterval: 15000,
  });

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" /> Suporte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abra um ticket com sua dúvida. Nossa equipe responde em até <strong>12 horas</strong>. Perguntas comuns têm resposta automática imediata.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo ticket
        </Button>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4 min-h-[520px]">
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 text-sm font-semibold">Seus tickets</div>
          <div className="max-h-[560px] overflow-y-auto">
            {isLoading && <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>}
            {!isLoading && tickets.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">Nenhum ticket ainda.</div>
            )}
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/40 hover:bg-secondary/60 transition-colors",
                  selectedId === t.id && "bg-secondary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm truncate">{t.subject}</span>
                  <StatusPill status={t.status} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Atualizado {formatDistanceToNow(new Date(t.last_message_at), { locale: ptBR, addSuffix: true })}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden flex flex-col min-h-[520px]">
          {!selected && (
            <div className="flex-1 grid place-items-center text-center p-8">
              <div className="max-w-sm space-y-2">
                <MessageSquare className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                <div className="text-sm font-medium">Selecione um ticket</div>
                <p className="text-xs text-muted-foreground">
                  Ou abra um novo. Você pode anexar imagens e arquivos (até 10MB por arquivo).
                </p>
                <div className="pt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                  Perguntas simples recebem resposta automática.
                </div>
              </div>
            </div>
          )}
          {selected && user && (
            <>
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{selected.subject}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Aberto {formatDistanceToNow(new Date(selected.created_at), { locale: ptBR, addSuffix: true })}
                  </div>
                </div>
                <StatusPill status={selected.status} />
              </div>
              <SupportThread ticketId={selected.id} currentUserId={user.id} />
            </>
          )}
        </Card>
      </div>

      <NewTicketDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["support-tickets"] });
          setSelectedId(id);
        }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const tone =
    status === "resolved" || status === "closed"
      ? "bg-primary/15 text-primary"
      : status === "awaiting_user"
      ? "bg-warning/15 text-warning"
      : "bg-secondary text-muted-foreground";
  const Icon = status === "resolved" || status === "closed" ? CheckCircle2 : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", tone)}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !firstMessage.trim()) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const { data: prof } = await supabase.from("profiles").select("restaurant_id").eq("id", u.user.id).maybeSingle();
      const { data: ticket, error: tErr } = await supabase
        .from("support_tickets" as any)
        .insert({
          user_id: u.user.id,
          restaurant_id: prof?.restaurant_id ?? null,
          subject: subject.trim(),
        } as any)
        .select("id")
        .single();
      if (tErr) throw tErr;
      const ticketId = (ticket as any).id as string;
      const { error: mErr } = await supabase.from("support_messages" as any).insert({
        ticket_id: ticketId,
        author_id: u.user.id,
        author_role: "user",
        body: firstMessage.trim(),
        attachments: [],
      } as any);
      if (mErr) throw mErr;

      // Fire AI auto-reply in background
      import("@/lib/support.functions").then(({ autoReplyTicket }) => {
        (autoReplyTicket as any)({ data: { ticketId, userMessage: firstMessage.trim() } }).catch(() => undefined);
      });

      toast.success("Ticket criado! Nossa equipe responde em até 12h.");
      setSubject("");
      setFirstMessage("");
      onOpenChange(false);
      onCreated(ticketId);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar ticket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo ticket de suporte</DialogTitle>
          <DialogDescription>
            Descreva sua dúvida ou problema. Um assistente automático tenta responder imediatamente. Se precisar de humano, respondemos em até 12h.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Não consigo importar planilha do iFood"
              required
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descreva sua dúvida</Label>
            <Textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Conte com detalhes o que aconteceu…"
              rows={5}
              required
              maxLength={2000}
            />
            <p className="text-[11px] text-muted-foreground">
              Você poderá anexar imagens e arquivos na próxima tela.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !subject.trim() || !firstMessage.trim()}>
              {saving ? "Abrindo…" : "Abrir ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
