import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantInfo {
  profile: { id: string; restaurant_id: string | null; full_name: string | null; email: string | null } | null;
  restaurant: { id: string; name: string; owner_id: string } | null;
  loading: boolean;
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
      let restaurant: { id: string; name: string; owner_id: string } | null = null;
      if (profile?.restaurant_id) {
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, owner_id")
          .eq("id", profile.restaurant_id)
          .maybeSingle();
        restaurant = r;
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
