import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import luudLogo from "@/assets/luud-logo.png.asset.json";
import {
  LayoutDashboard,
  Upload,
  ArrowRightLeft,
  Tag,
  BarChart3,
  TrendingUp,
  Bell,
  FileText,
  Settings,
  LogOut,
  Wallet,
  Target,
  CreditCard,
  Users,
  Sparkles,
  Calculator,
  PieChart,
  Package,
  History,
  Sliders,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePlan, type PlanTier } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

type Item = { title: string; url: string; icon: typeof LayoutDashboard; min?: PlanTier };

const basico: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Movimentações", url: "/movimentacoes", icon: ArrowRightLeft },
  { title: "Importações", url: "/importacoes", icon: Upload },
  { title: "Categorias", url: "/categorias", icon: Tag },
  { title: "Comparativos", url: "/comparativos", icon: BarChart3 },
  { title: "Evolução", url: "/evolucao", icon: TrendingUp },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

const pro: Item[] = [
  { title: "CMV", url: "/cmv", icon: PieChart, min: "pro" },
  { title: "Calculadora de Preço", url: "/calculadora-preco", icon: Calculator, min: "pro" },
  { title: "Lucro por Plataforma", url: "/lucro-plataforma", icon: BarChart3, min: "pro" },
  { title: "Fornecedores", url: "/fornecedores", icon: Package, min: "pro" },
  { title: "Histórico de Preços", url: "/historico-precos", icon: History, min: "pro" },
  { title: "Simulador de Lucro", url: "/simulador", icon: Sliders, min: "pro" },
  { title: "Relatórios", url: "/relatorios", icon: FileText, min: "pro" },
];

const premium: Item[] = [
  { title: "Assistente IA", url: "/assistente-ia", icon: Bot, min: "premium" },
];

const conta: Item[] = [
  { title: "Planos", url: "/planos", icon: CreditCard },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar({ restaurantName, onSignOut }: { restaurantName?: string; onSignOut: () => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { can, isAdmin } = usePlan();

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.url || pathname.startsWith(item.url + "/");
            const locked = item.min ? !can(item.min) : false;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon className={cn("h-4 w-4", locked && "opacity-60")} />
                    <span className={cn("flex-1", locked && "opacity-60")}>{item.title}</span>
                    {item.min && !collapsed && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          item.min === "premium"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {item.min === "premium" ? "IA" : "PRO"}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
  const { restaurant: r, refetch } = useRestaurant();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !r?.id) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${r.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("restaurant-avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("restaurant-avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      const { error: updErr } = await supabase.from("restaurants").update({ avatar_url: signed.signedUrl }).eq("id", r.id);
      if (updErr) throw updErr;
      toast.success("Foto atualizada!");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-9 w-9 rounded-lg overflow-hidden shrink-0 border border-border/60 bg-secondary group"
            title="Alterar foto do restaurante"
            disabled={uploading || !r?.id}
          >
            {r?.avatar_url ? (
              <img src={r.avatar_url} alt={restaurantName || "Restaurante"} className="h-full w-full object-cover" />
            ) : (
              <img src={luudLogo.url} alt="LUUD" className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" />}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{restaurantName || "LUUD"}</div>
              <div className="text-xs text-muted-foreground truncate">Descubra seu lucro</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Essencial", basico)}
        {renderGroup("Pro", pro)}
        {renderGroup("Premium (IA)", premium)}
        {renderGroup("Conta", conta)}
        {isAdmin && renderGroup("Admin", [{ title: "Usuários", url: "/admin/usuarios", icon: Users }])}
      </SidebarContent>
      <SidebarFooter className="p-2">
        {!collapsed && (
          <Button asChild variant="outline" size="sm" className="justify-start gap-2 mb-1">
            <Link to="/planos">
              <Sparkles className="h-4 w-4" />
              <span>Fazer upgrade</span>
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onSignOut} className="justify-start gap-2">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
