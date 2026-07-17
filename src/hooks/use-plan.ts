import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlanTier = "basico" | "pro" | "premium";
export type SubscriptionStatus = "trialing" | "active" | "expired" | "canceled";

export interface PlanState {
  plan: PlanTier;
  effectivePlan: PlanTier;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  daysLeftInTrial: number;
  isAdmin: boolean;
  loading: boolean;
  can: (min: PlanTier) => boolean;
}

const RANK: Record<PlanTier, number> = { basico: 0, pro: 1, premium: 2 };

export function usePlan(): PlanState {
  const { data, isLoading } = useQuery({
    queryKey: ["plan-state"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const [{ data: sub }, { data: roles }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan, status, trial_ends_at")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
      ]);

      const isAdmin = !!roles?.some((r: any) => r.role === "admin");
      return { sub, isAdmin };
    },
    staleTime: 30_000,
  });

  const sub = data?.sub;
  const plan = (sub?.plan ?? "basico") as PlanTier;
  const status = (sub?.status ?? "expired") as SubscriptionStatus;
  const trialEndsAt = sub?.trial_ends_at ?? null;

  const trialActive = status === "trialing" && trialEndsAt && new Date(trialEndsAt) > new Date();
  const isAdmin = !!data?.isAdmin;
  const effectivePlan: PlanTier = isAdmin
    ? "premium"
    : trialActive
    ? "premium"
    : status === "active"
    ? plan
    : "basico";

  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    plan,
    effectivePlan,
    status,
    trialEndsAt,
    daysLeftInTrial,
    isAdmin,
    loading: isLoading,
    can: (min) => isAdmin || RANK[effectivePlan] >= RANK[min],
  };
}
