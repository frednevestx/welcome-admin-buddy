import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { PROVIDER_CATALOG, type ProviderId } from "@/lib/integrations/types";
import {
  listIntegrations,
  startIntegrationAuth,
  completeIntegrationAuth,
  syncIntegrationNow,
  disconnectIntegration,
} from "@/lib/integrations.functions";
import { formatBRL, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Bike,
  Building2,
  CheckCircle2,
  Landmark,
  Link2,
  Lock,
  Plug,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações automáticas | LUUD" },
      {
        name: "description",
        content:
          "Conecte iFood, 99Food e outras plataformas à LUUD e tenha pedidos, taxas e repasses sincronizados automaticamente.",
      },
      { property: "og:title", content: "Integrações automáticas | LUUD" },
      {
        property: "og:description",
        content: "Sincronize automaticamente os dados financeiros das plataformas de delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

function relativeTime(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s} segundo${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} minuto${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

const CATEGORY_ICON = {
  delivery: Bike,
  pdv: Building2,
  banco: Landmark,
} as const;

const CATEGORY_LABEL = {
  delivery: "Plataformas de delivery",
  pdv: "PDV e cardápio digital",
  banco: "Bancos e PIX",
} as const;

type AuthStartResult =
  | { kind: "redirect"; url: string }
  | {
      kind: "user_code";
      userCode: string;
      verificationUrl: string;
      expiresInSeconds: number;
      authorizationCodeVerifier: string;
    }
  | { kind: "unavailable"; reason: string };

function IntegrationsPage() {
  const { restaurant } = useRestaurant();
  const qc = useQueryClient();
  const fetchList = useServerFn(listIntegrations);
  const startAuth = useServerFn(startIntegrationAuth);
  const completeAuth = useServerFn(completeIntegrationAuth);
  const syncNow = useServerFn(syncIntegrationNow);
  const disconnect = useServerFn(disconnectIntegration);

  const [manage, setManage] = useState<ProviderId | null>(null);
  const [pending, setPending] = useState<{
    provider: ProviderId;
    start: AuthStartResult;
  } | null>(null);
  const [code, setCode] = useState("");

  const q = useQuery({
    queryKey: ["integrations", restaurant?.id],
    queryFn: () => fetchList(),
    refetchInterval: 60_000,
  });

  const states = q.data?.integrations ?? [];
  const configuredMap = (q.data as any)?.configuredMap ?? {};
  const stateOf = (id: ProviderId) => states.find((s) => s.provider === id);

  const connect = useMutation({
    mutationFn: async (provider: ProviderId) => {
      const res: any = await startAuth({ data: { provider } });
      if (!res.ok) throw new Error(res.reason);
      return { provider, start: res.start as AuthStartResult };
    },
    onSuccess: (r) => {
      if (r.start.kind === "redirect") {
        window.location.href = r.start.url;
        return;
      }
      if (r.start.kind === "unavailable") {
        toast.error(r.start.reason);
        return;
      }
      setPending(r);
      setCode("");
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const finish = useMutation({
    mutationFn: async () => {
      if (!pending || pending.start.kind !== "user_code") throw new Error("Autorização inválida");
      const res: any = await completeAuth({
        data: {
          provider: pending.provider,
          code,
          verifier: pending.start.authorizationCodeVerifier,
        },
      });
      if (!res.ok) throw new Error(res.reason);
      return res;
    },
    onSuccess: (res: any) => {
      setPending(null);
      toast.success(
        `Conectado! ${formatNumber(res.processed ?? 0)} pedidos importados do histórico.`,
      );
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const sync = useMutation({
    mutationFn: async (provider: ProviderId) => {
      const res: any = await syncNow({ data: { provider } });
      if (!res.ok) throw new Error(res.reason);
      return res;
    },
    onSuccess: (res: any) => {
      toast.success(`Sincronizado. ${formatNumber(res.processed ?? 0)} pedidos atualizados.`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const drop = useMutation({
    mutationFn: async (provider: ProviderId) => {
      await disconnect({ data: { provider } });
    },
    onSuccess: () => {
      setManage(null);
      toast.success("Plataforma desconectada. O histórico importado foi preservado.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Conecte suas plataformas e a LUUD importa pedidos, taxas, comissões, cupons,
          cancelamentos e repasses automaticamente. Lançamentos manuais continuam funcionando
          normalmente.
        </p>
      </div>

      <Card className="p-4 flex items-start gap-3 border-primary/25 bg-primary/[0.04]">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">Conexão segura.</span> A LUUD nunca pede
          usuário e senha da plataforma. A autorização é feita pelo canal oficial do parceiro e o
          token fica criptografado no servidor.
        </div>
      </Card>

      {(["delivery", "pdv", "banco"] as const).map((cat) => {
        const Icon = CATEGORY_ICON[cat];
        const list = PROVIDER_CATALOG.filter((p) => p.category === cat);
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">{CATEGORY_LABEL[cat]}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => {
                const st = stateOf(p.id);
                const connected = st?.status === "connected";
                const errored = st?.status === "error" || st?.status === "expired";
                const available = p.implemented;
                const configured = !!configuredMap[p.id];
                return (
                  <Card
                    key={p.id}
                    className={cn(
                      "p-5 flex flex-col gap-4 transition-colors",
                      connected && "border-primary/40",
                      !available && "opacity-75",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{p.name}</span>
                          {!available && (
                            <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
                      </div>
                      <span
                        className={cn(
                          "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                          connected ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {connected ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : available ? (
                          <Plug className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5">
                      <Row label="Status">
                        {connected ? (
                          <span className="text-[var(--color-success,inherit)] text-emerald-500 font-medium">
                            Conectado
                          </span>
                        ) : errored ? (
                          <span className="text-destructive font-medium">Atenção</span>
                        ) : (
                          <span className="text-muted-foreground">Não conectado</span>
                        )}
                      </Row>
                      {connected && (
                        <>
                          <Row label="Última sincronização">{relativeTime(st?.lastSyncAt ?? null)}</Row>
                          <Row label="Pedidos sincronizados">
                            {formatNumber(st?.ordersSynced ?? 0)}
                          </Row>
                          {st?.merchantName && <Row label="Loja">{st.merchantName}</Row>}
                        </>
                      )}
                      {!connected && (
                        <Row label="Traz para a LUUD">
                          <span className="text-right">{p.brings.slice(0, 3).join(", ")}</span>
                        </Row>
                      )}
                      {errored && st?.lastError && (
                        <div className="flex items-start gap-1.5 text-destructive pt-1">
                          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{st.lastError}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex gap-2">
                      {connected ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setManage(p.id)}
                          >
                            Gerenciar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => sync.mutate(p.id)}
                            disabled={sync.isPending}
                            aria-label="Sincronizar agora"
                          >
                            <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!available || connect.isPending}
                          onClick={() => connect.mutate(p.id)}
                        >
                          <Link2 className="h-4 w-4" />
                          {available ? "Conectar" : "Em breve"}
                        </Button>
                      )}
                    </div>

                    {available && !configured && !connected && (
                      <p className="text-[11px] text-muted-foreground -mt-2">
                        Aguardando credencial oficial de parceiro.
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Autorize a LUUD na plataforma</DialogTitle>
            <DialogDescription>
              Use o código abaixo no portal oficial. A LUUD não recebe sua senha.
            </DialogDescription>
          </DialogHeader>
          {pending?.start.kind === "user_code" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">Código de autorização</div>
                <div className="text-2xl font-semibold tracking-[0.2em] tabular-nums">
                  {pending.start.userCode}
                </div>
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={pending.start.verificationUrl} target="_blank" rel="noreferrer">
                  Abrir portal oficial
                </a>
              </Button>
              <div className="space-y-2">
                <Label>Código devolvido pela plataforma</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Cole aqui o código de autorização"
                />
              </div>
              <Button
                className="w-full"
                disabled={!code || finish.isPending}
                onClick={() => finish.mutate()}
              >
                {finish.isPending ? "Conectando e importando histórico..." : "Concluir conexão"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!manage} onOpenChange={(v) => !v && setManage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Gerenciar {manage ? PROVIDER_CATALOG.find((p) => p.id === manage)?.name : ""}
            </DialogTitle>
            <DialogDescription>Histórico de sincronizações e conexão.</DialogDescription>
          </DialogHeader>
          {manage && <SyncLogs provider={manage} restaurantId={restaurant?.id} />}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={sync.isPending}
              onClick={() => manage && sync.mutate(manage)}
            >
              <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
              Sincronizar agora
            </Button>
            <Button
              variant="destructive"
              disabled={drop.isPending}
              onClick={() => manage && drop.mutate(manage)}
            >
              Desconectar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}

function SyncLogs({ provider, restaurantId }: { provider: ProviderId; restaurantId?: string }) {
  const q = useQuery({
    enabled: !!restaurantId,
    queryKey: ["sync-logs", restaurantId, provider],
    queryFn: async () => {
      const { data: integ } = await supabase
        .from("integrations")
        .select("id")
        .eq("restaurant_id", restaurantId!)
        .eq("provider", provider)
        .maybeSingle();
      if (!integ) return [];
      const { data } = await supabase
        .from("sync_logs")
        .select("id, kind, status, started_at, records_processed, error_message")
        .eq("integration_id", integ.id)
        .order("started_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const rows = q.data ?? [];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Registros</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
              Nenhuma sincronização registrada.
            </TableCell>
          </TableRow>
        )}
        {rows.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell className="text-muted-foreground">{relativeTime(r.started_at)}</TableCell>
            <TableCell className="capitalize">{r.kind}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(r.records_processed ?? 0)}
            </TableCell>
            <TableCell className="text-right">
              {r.status === "success" ? (
                <span className="text-emerald-500">ok</span>
              ) : r.status === "error" ? (
                <span className="text-destructive" title={r.error_message ?? ""}>erro</span>
              ) : (
                <span className="text-muted-foreground">rodando</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { formatBRL };
