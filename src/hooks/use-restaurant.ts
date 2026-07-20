import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Restaurant {
  id: string;
  name: string;
  owner_id: string;
  avatar_url: string | null;
  razao_social: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  whatsapp: string | null;
  email: string | null;
  accent_color: string | null;
  onboarding_completed: boolean;
}

export function useRestaurant() {
  const query = useQuery({
    queryKey: ["current-restaurant"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { profile: null, restaurant: null };
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, restaurant_id, full_name, email")
        .eq("id", userData.user.id)
        .maybeSingle();
      let restaurant: Restaurant | null = null;
      if (profile?.restaurant_id) {
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, owner_id, avatar_url, razao_social, cnpj, cidade, estado, whatsapp, email, accent_color, onboarding_completed")
          .eq("id", profile.restaurant_id)
          .maybeSingle();
        restaurant = (r as Restaurant | null) ?? null;
      }
      return { profile, restaurant };
    },
    staleTime: 30_000,
  });

  return {
    profile: query.data?.profile ?? null,
    restaurant: query.data?.restaurant ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
