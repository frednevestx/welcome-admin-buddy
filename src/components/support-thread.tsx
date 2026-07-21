import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Paperclip, Send, Loader2, Bot, User as UserIcon, ShieldCheck, X, FileText, ImageIcon } from "lucide-react";
import { autoReplyTicket } from "@/lib/support.functions";

interface Attachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

interface Message {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_role: "user" | "support" | "ai";
  body: string;
  attachments: Attachment[];
  created_at: string;
}

interface Props {
  ticketId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

export function SupportThread({ ticketId, currentUserId, isAdmin = false }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoReply = useServerFn(autoReplyTicket);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["support-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Message[];
    },
    refetchInterval: 8000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function urlFor(path: string): Promise<string> {
    const { data } = await supabase.storage.from("support-attachments").createSignedUrl(path, 3600);
    return data?.signedUrl ?? "#";
  }

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text && pending.length === 0) return;
      setUploading(true);
      try {
        const uploaded: Attachment[] = [];
        for (const f of pending) {
          const ext = f.name.split(".").pop() ?? "bin";
          const path = `${currentUserId}/${ticketId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, f);
          if (upErr) throw upErr;
          uploaded.push({ path, name: f.name, type: f.type || "application/octet-stream", size: f.size });
        }
        const authorRole = isAdmin ? "support" : "user";
        const { error: insErr } = await supabase.from("support_messages" as any).insert({
          ticket_id: ticketId,
          author_id: currentUserId,
          author_role: authorRole,
          body: text || "(anexo)",
          attachments: uploaded,
        } as any);
        if (insErr) throw insErr;

        // Only trigger AI on user-authored messages
        if (!isAdmin && text) {
          autoReply({ data: { ticketId, userMessage: text } }).catch(() => undefined);
        }
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      setBody("");
      setPending([]);
      qc.invalidateQueries({ queryKey: ["support-messages", ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar"),
  });

  function addFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size < 10 * 1024 * 1024);
    if (arr.length !== list.length) toast.error("Alguns arquivos excedem 10MB e foram ignorados.");
    setPending((p) => [...p, ...arr]);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="text-sm text-muted-foreground text-center py-8">Carregando mensagens…</div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhuma mensagem ainda. Descreva sua dúvida abaixo.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} mine={m.author_id === currentUserId} urlFor={urlFor} />
        ))}
      </div>

      <div className="border-t border-border/60 p-3 space-y-2 bg-background/60">
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs">
                {f.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send.mutate();
              }
            }}
            placeholder={isAdmin ? "Responder ao cliente…" : "Escreva sua mensagem…"}
            className="min-h-[52px] resize-none"
          />
          <div className="flex flex-col gap-1">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
            <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} title="Anexar arquivos">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => send.mutate()}
              disabled={uploading || send.isPending || (!body.trim() && pending.length === 0)}
              title="Enviar (Ctrl+Enter)"
            >
              {uploading || send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, mine, urlFor }: { m: Message; mine: boolean; urlFor: (p: string) => Promise<string> }) {
  const isAI = m.author_role === "ai";
  const isSupport = m.author_role === "support";

  const align = mine ? "items-end" : "items-start";
  const bubble = mine
    ? "bg-primary text-primary-foreground"
    : isAI
    ? "bg-accent/15 text-foreground border border-accent/30"
    : isSupport
    ? "bg-secondary text-foreground border border-primary/20"
    : "bg-secondary text-foreground";

  return (
    <div className={cn("flex flex-col gap-1", align)}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
        {isAI ? <Bot className="h-3 w-3 text-accent" /> : isSupport ? <ShieldCheck className="h-3 w-3 text-primary" /> : <UserIcon className="h-3 w-3" />}
        <span>
          {isAI ? "Assistente automático" : isSupport ? "Suporte LUUD" : mine ? "Você" : "Cliente"}
          {" · "}
          {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </span>
      </div>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words", bubble)}>
        {m.body}
        {m.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.attachments.map((a) => (
              <AttachmentChip key={a.path} a={a} urlFor={urlFor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ a, urlFor }: { a: Attachment; urlFor: (p: string) => Promise<string> }) {
  const [href, setHref] = useState<string>("#");
  useEffect(() => { urlFor(a.path).then(setHref); }, [a.path, urlFor]);
  const isImg = a.type.startsWith("image/");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md bg-background/40 border border-border/40 px-2 py-1 text-[11px] hover:bg-background/70"
    >
      {isImg ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      <span className="max-w-[160px] truncate">{a.name}</span>
    </a>
  );
}
