import { Link, useRouterState } from "@tanstack/react-router";
import { useRestaurant } from "@/hooks/use-restaurant";
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
import { RestaurantAvatar } from "@/components/restaurant-avatar";

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
  const { restaurant: r } = useRestaurant();

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
          <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 border border-border/60 bg-secondary grid place-items-center">
            <img src={luudLogo.url} alt="LUUD" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">LUUD</div>
              <div className="text-xs text-muted-foreground truncate">{restaurantName || "Descubra seu lucro"}</div>
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
      <SidebarFooter className="p-2 space-y-1">
        <Link
          to="/configuracoes"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center px-0"
          )}
          title="Minha conta"
        >
          <RestaurantAvatar name={r?.name || restaurantName} avatarUrl={r?.avatar_url} size={collapsed ? 28 : 34} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{r?.name || restaurantName || "Minha conta"}</div>
              <div className="text-xs text-muted-foreground truncate">Ver conta e ajustes</div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button asChild variant="outline" size="sm" className="justify-start gap-2 w-full">
            <Link to="/planos">
              <Sparkles className="h-4 w-4" />
              <span>Fazer upgrade</span>
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onSignOut} className="justify-start gap-2 w-full">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
