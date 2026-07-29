import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useRestaurant } from "@/hooks/use-restaurant";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapOwnerAdmin } from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { restaurant, loading, refetch } = useRestaurant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bootstrapAdmin = useServerFn(bootstrapOwnerAdmin);
  const didBootstrapAdmin = useRef(false);

  useEffect(() => {
    if (didBootstrapAdmin.current) return;
    didBootstrapAdmin.current = true;
    bootstrapAdmin()
      .then((result) => {
        if (result.ok) queryClient.invalidateQueries({ queryKey: ["plan-state"] });
      })
      .catch(() => undefined);
  }, [bootstrapAdmin, queryClient]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar restaurantName={restaurant?.name} onSignOut={handleSignOut} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/60 flex items-center gap-3 px-4 sticky top-0 bg-background/80 backdrop-blur z-10">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground truncate">
              {restaurant?.name ?? (loading ? "Carregando..." : "Sem negócio")}
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
      {!loading && (!restaurant || !restaurant.onboarding_completed) && (
        <OnboardingDialog onCreated={() => refetch()} />
      )}
    </SidebarProvider>
  );
}
