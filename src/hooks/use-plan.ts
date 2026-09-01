import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A LUUD é gratuita para todos: não há plano pago, mensalidade ou bloqueio.
 * Este hook continua existindo apenas para expor `isAdmin` (usado no painel
 * administrativo). `can()` sempre libera o recurso.
 */

export type PlanTier = "basico" | "pro" | "premium";

export interface PlanState {
  isAdmin: boolean;
  loading: boolean;
  can: (min?: PlanTier) => boolean;
}

export function usePlan(): PlanState {
  const { data, isLoading } = useQuery({
    queryKey: ["plan-state"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { isAdmin: false };
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      return { isAdmin: !!roles?.some((r: any) => r.role === "admin") };
    },
    staleTime: 30_000,
  });

  return {
    isAdmin: !!data?.isAdmin,
    loading: isLoading,
    can: () => true,
  };
}
