import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminOverview,
  listIdentitiesAdmin,
  listBusinessesAdmin,
  listAuditAdmin,
  listConversationsAdmin,
  setIdentityBlocked,
  resolveIdentityConflict,
  cleanupPreview,
  cleanupExecute,
  previewBusinessMergeAdmin,
  mergeBusinessesAdmin,
} from "@/lib/admin/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPanel,
  head: () => ({
    meta: [
      { title: "Operação | LUUD Admin" },
      { name: "description", content: "Identidades do WhatsApp, negócios, conversas e auditoria da LUUD." },
      { property: "og:title", content: "Operação | LUUD Admin" },
      { property: "og:description", content: "Painel administrativo da operação LUUD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminPanel() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getAdminOverview);
  const identitiesFn = useServerFn(listIdentitiesAdmin);
  const businessesFn = useServerFn(listBusinessesAdmin);
  const auditFn = useServerFn(listAuditAdmin);
  const conversationsFn = useServerFn(listConversationsAdmin);
  const blockFn = useServerFn(setIdentityBlocked);
  const resolveFn = useServerFn(resolveIdentityConflict);
  const previewFn = useServerFn(cleanupPreview);
  const cleanupFn = useServerFn(cleanupExecute);
  const mergePreviewFn = useServerFn(previewBusinessMergeAdmin);
  const mergeFn = useServerFn(mergeBusinessesAdmin);

  const [confirmation, setConfirmation] = useState("");
  const [mergeConfirmation, setMergeConfirmation] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => overviewFn({}) });
  const identities = useQuery({ queryKey: ["admin-identities"], queryFn: () => identitiesFn({}) });
  const businesses = useQuery({ queryKey: ["admin-businesses"], queryFn: () => businessesFn({}) });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => auditFn({}) });
  const conversations = useQuery({ queryKey: ["admin-conversations"], queryFn: () => conversationsFn({}) });
  const preview = useQuery({ queryKey: ["admin-cleanup-preview"], queryFn: () => previewFn({}) });
  const mergePreview = useQuery({
    queryKey: ["admin-merge-preview", sourceId, targetId],
    queryFn: () => mergePreviewFn({ data: { sourceId, targetId } }),
    enabled: Boolean(sourceId && targetId && sourceId !== targetId),
  });

  if (overview.isError) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Acesso restrito ao administrador.</div>
    );
  }

  const o = overview.data;
  const stats = [
    { label: "Contatos WhatsApp", value: o?.identities },
    { label: "Ativados", value: o?.verified },
    { label: "Conflitos", value: o?.conflicts },
    { label: "Negócios", value: o?.businesses },
    { label: "Lançamentos ativos", value: o?.movements },
    { label: "Arquivados", value: o?.archived },
    { label: "Mensagens", value: o?.events },
    { label: "Mensagens 24h", value: o?.events24h },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Operação LUUD</h1>
        <p className="text-sm text-muted-foreground">Telefones exibidos com máscara. Toda ação fica auditada.</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{s.value ?? "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="identidades">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="identidades">Identidades</TabsTrigger>
          <TabsTrigger value="negocios">Negócios</TabsTrigger>
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="limpeza">Limpeza</TabsTrigger>
        </TabsList>

        <TabsContent value="identidades" className="space-y-2 pt-4">
          {(identities.data ?? []).map((i: any) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {i.phone_masked} {i.display_name ? `· ${i.display_name}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {i.restaurant_name} · última mensagem{" "}
                  {i.last_message_at ? new Date(i.last_message_at).toLocaleString("pt-BR") : "—"}
                  {i.conflict_note ? ` · ${i.conflict_note}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i.has_conflict ? "destructive" : "secondary"}>
                  {i.has_conflict ? "conflito" : i.status}
                </Badge>
                {i.has_conflict && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await resolveFn({ data: { id: i.id } });
                      qc.invalidateQueries({ queryKey: ["admin-identities"] });
                      toast.success("Conflito resolvido.");
                    }}
                  >
                    Resolver
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await blockFn({ data: { id: i.id, blocked: i.status !== "blocked" } });
                    qc.invalidateQueries({ queryKey: ["admin-identities"] });
                  }}
                >
                  {i.status === "blocked" ? "Desbloquear" : "Bloquear"}
                </Button>
              </div>
            </div>
          ))}
          {identities.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        </TabsContent>

        <TabsContent value="negocios" className="space-y-2 pt-4">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Mesclar negócios duplicados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Move os lançamentos e o vínculo do WhatsApp para o negócio real. A origem será arquivada e a ação não pode ser desfeita automaticamente.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origem criada pelo WhatsApp</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                    <SelectContent>
                      {(businesses.data ?? []).filter((b: any) => b.is_whatsapp_created && !b.archived_at).map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} · {b.identity_phone_masked}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destino real sem WhatsApp</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                    <SelectContent>
                      {(businesses.data ?? []).filter((b: any) => b.is_unlinked_candidate && !b.archived_at).map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} · {b.owner_email_masked}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {mergePreview.data && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-muted-foreground">
                  <p><strong className="text-foreground">{mergePreview.data.source.name}</strong> será arquivado e unido a <strong className="text-foreground">{mergePreview.data.target.name}</strong>.</p>
                  <p>{mergePreview.data.movements} lançamentos, {mergePreview.data.identities} identidade e {mergePreview.data.sessions} sessões serão movidos.</p>
                </div>
              )}
              {mergePreview.isError && <p className="text-destructive">Não foi possível preparar esta mesclagem.</p>}
              <div className="space-y-2">
                <Label htmlFor="merge-confirmation">Digite MESCLAR para confirmar</Label>
                <Input id="merge-confirmation" value={mergeConfirmation} onChange={(e) => setMergeConfirmation(e.target.value)} />
              </div>
              <Button
                variant="destructive"
                disabled={!mergePreview.data || mergeConfirmation.trim() !== "MESCLAR"}
                onClick={async () => {
                  try {
                    const result = await mergeFn({ data: { sourceId, targetId, confirmation: mergeConfirmation } });
                    setMergeResult(`${result.movements_moved} lançamentos movidos; negócio de origem arquivado.`);
                    setSourceId("");
                    setTargetId("");
                    setMergeConfirmation("");
                    await Promise.all([
                      qc.invalidateQueries({ queryKey: ["admin-businesses"] }),
                      qc.invalidateQueries({ queryKey: ["admin-identities"] }),
                      qc.invalidateQueries({ queryKey: ["admin-overview"] }),
                      qc.invalidateQueries({ queryKey: ["admin-audit"] }),
                    ]);
                    toast.success("Negócios mesclados com segurança.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Não foi possível mesclar os negócios.");
                  }
                }}
              >
                Mesclar negócios
              </Button>
              {mergeResult && <p className="text-primary">{mergeResult}</p>}
            </CardContent>
          </Card>
          {(businesses.data ?? []).map((b: any) => (
            <div key={b.id} className="rounded-md border border-border/60 px-3 py-2">
              <div className="text-sm font-medium">
                {b.name} {b.archived_at && <Badge variant="outline">arquivado</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {b.whatsapp_masked} · {b.cidade ?? "—"} · {b.movement_count} lançamentos · {b.is_whatsapp_created ? "criado pelo WhatsApp" : b.is_unlinked_candidate ? "sem WhatsApp" : "conta existente"} · criado em{" "}
                {new Date(b.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="conversas" className="space-y-2 pt-4">
          {(conversations.data ?? []).map((c: any) => (
            <div key={c.id} className="rounded-md border border-border/60 px-3 py-2">
              <div className="text-sm">{c.raw_message}</div>
              <div className="text-xs text-muted-foreground">
                {c.contact_masked} · {new Date(c.created_at).toLocaleString("pt-BR")}
                {c.classification ? ` · ${c.classification}` : ""}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-2 pt-4">
          {(audit.data ?? []).map((a: any) => (
            <div key={a.id} className="rounded-md border border-border/60 px-3 py-2">
              <div className="text-sm font-medium">
                {a.action} <span className="text-muted-foreground">· {a.entity}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString("pt-BR")} · {a.origin} · {a.actor_kind} · {a.actor_phone}
                {a.note ? ` · ${a.note}` : ""}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="limpeza" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limpeza administrativa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Arquiva negócios, perfis e lançamentos. Contatos do WhatsApp ({preview.data?.identitiesKept ?? "—"}),
                conversas ({preview.data?.eventsKept ?? "—"}) e a auditoria são preservados.
              </p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>{preview.data?.businessCount ?? "—"} negócios ativos serão arquivados</li>
                <li>{preview.data?.movements ?? "—"} lançamentos ativos serão arquivados</li>
              </ul>
              <div className="space-y-2">
                <Input
                  placeholder="Digite APAGAR TODOS OS DADOS"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
                <Button
                  variant="destructive"
                  disabled={confirmation.trim() !== "APAGAR TODOS OS DADOS"}
                  onClick={async () => {
                    try {
                      const r = await cleanupFn({ data: { confirmation } });
                      toast.success(`${r.archived} negócios arquivados.`);
                      setConfirmation("");
                      qc.invalidateQueries();
                    } catch {
                      toast.error("Não foi possível executar a limpeza.");
                    }
                  }}
                >
                  Executar limpeza
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
