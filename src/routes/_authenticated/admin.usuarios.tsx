import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLAN_LABEL } from "@/lib/plan-features";
import type { PlanTier, SubscriptionStatus } from "@/hooks/use-plan";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { UserPlus, Link2, Save, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SupportThread } from "@/components/support-thread";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw redirect({ to: "/dashboard" });
  },
  component: AdminUsersPage,
});

interface Row {
  user_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider: string;
  full_name: string | null;
  email: string | null;
}

type Cycle = "mensal" | "semestral" | "anual";
const CYCLES: Cycle[] = ["mensal", "semestral", "anual"];
const TIERS: PlanTier[] = ["basico", "pro", "premium"];

function AdminUsersPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<PlanTier>("pro");
  const [days, setDays] = useState<number>(30);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<Row[]> => {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("user_id, plan, status, trial_ends_at, current_period_end, provider")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!subs || subs.length === 0) return [];

      const ids = subs.map((s) => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);

      return subs.map((s) => {
        const p = profiles?.find((x) => x.id === s.user_id);
        return {
          user_id: s.user_id,
          plan: s.plan as PlanTier,
          status: s.status as SubscriptionStatus,
          trial_ends_at: s.trial_ends_at,
          current_period_end: s.current_period_end,
          provider: s.provider,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
        };
      });
    },
  });

  const grantByEmail = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_grant_plan_by_email", {
        _email: email.trim(),
        _plan: plan,
        _days: days,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`Acesso liberado para ${email} • ${PLAN_LABEL[plan]} por ${days} dias`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => {
      const msg = translateAuthError(e, "Erro");
      if (msg.includes("user_not_found")) toast.error("Usuário não encontrado. Ele precisa criar conta primeiro.");
      else toast.error(msg);
    },
  });

  const extend = useMutation({
    mutationFn: async ({ user_id, d }: { user_id: string; d: number }) => {
      const { error } = await (supabase.rpc as any)("admin_extend_plan", { _user_id: user_id, _days: d });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(`Prazo estendido em ${v.d} dias`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  const revoke = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await (supabase.rpc as any)("admin_revoke_plan", { _user_id: user_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso revogado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Libere planos manualmente por e-mail e defina o prazo de acesso.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Liberar acesso por e-mail</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          O usuário deve ter criado uma conta no sistema com o mesmo e-mail antes de você liberar.
        </p>
        <div className="grid md:grid-cols-[1fr_140px_140px_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label>E-mail do usuário</Label>
            <Input
              type="email"
              placeholder="cliente@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanTier)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t}>{PLAN_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dias de acesso</Label>
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 0))}
            />
          </div>
          <Button
            onClick={() => grantByEmail.mutate()}
            disabled={!email.trim() || days <= 0 || grantByEmail.isPending}
          >
            {grantByEmail.isPending ? "Liberando..." : "Liberar"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground hover:text-foreground"
            >{d} dias</button>
          ))}
        </div>
      </Card>

      <CheckoutLinksCard />

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60">
          <h2 className="text-sm font-semibold">Usuários ativos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Usuário</th>
                <th className="text-left px-4 py-3 font-medium">Plano</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Vence em</th>
                <th className="text-right px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && rows?.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário</td></tr>
              )}
              {rows?.map((r) => {
                const end = r.status === "trialing" ? r.trial_ends_at : r.current_period_end;
                return (
                  <tr key={r.user_id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email || r.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                        {PLAN_LABEL[r.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-secondary">{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {end ? (
                        <div>
                          <div>{format(new Date(end), "dd/MM/yyyy", { locale: ptBR })}</div>
                          <div className="opacity-70">{formatDistanceToNow(new Date(end), { locale: ptBR, addSuffix: true })}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => extend.mutate({ user_id: r.user_id, d: 30 })}>
                        +30d
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => extend.mutate({ user_id: r.user_id, d: 90 })}>
                        +90d
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm("Revogar acesso deste usuário?")) revoke.mutate(r.user_id);
                      }}>
                        Revogar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CheckoutLinksCard() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["checkout-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("checkout_settings" as any).select("*") as any);
      if (error) throw error;
      return (data || []) as Array<{ plan: PlanTier; cycle: Cycle; url: string }>;
    },
  });

  const [edits, setEdits] = useState<Record<string, string>>({});
  const key = (p: PlanTier, c: Cycle) => `${p}:${c}`;

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(edits).map(([k, url]) => {
        const [plan, cycle] = k.split(":");
        return { plan, cycle, url };
      });
      if (!rows.length) return;
      const { error } = await (supabase.from("checkout_settings" as any).upsert(rows, { onConflict: "plan,cycle" }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Links de checkout salvos");
      setEdits({});
      qc.invalidateQueries({ queryKey: ["checkout-settings"] });
    },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  const getVal = (p: PlanTier, c: Cycle) => {
    const k = key(p, c);
    if (k in edits) return edits[k];
    return settings?.find((s) => s.plan === p && s.cycle === c)?.url || "";
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Links de checkout externo</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Cole o link do checkout externo (Stripe Payment Link, Hotmart, InfinitePay, PIX etc.) para cada plano e ciclo.
        Esses links aparecem nos botões "Assinar" na página inicial e em Planos.
      </p>
      <div className="space-y-4">
        {TIERS.map((t) => (
          <div key={t} className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{PLAN_LABEL[t]}</div>
            <div className="grid md:grid-cols-3 gap-2">
              {CYCLES.map((c) => (
                <div key={c} className="space-y-1">
                  <Label className="text-xs capitalize">{c}</Label>
                  <Input
                    placeholder="https://checkout..."
                    value={getVal(t, c)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [key(t, c)]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => save.mutate()} disabled={!Object.keys(edits).length || save.isPending} className="gap-2">
        <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar links"}
      </Button>
    </Card>
  );
}
