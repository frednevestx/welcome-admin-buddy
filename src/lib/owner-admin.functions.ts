import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const bootstrapOwnerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownerEmail = "frednevestx@live.com";
    const { supabase, userId } = context as any;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw error ?? new Error("Usuário não autenticado");

    const email = data.user.email?.toLowerCase();
    const emailConfirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
    if (email !== ownerEmail || !emailConfirmed) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" },
    );
    if (roleError) throw roleError;

    const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: "premium",
        status: "active",
        current_period_end: new Date("2126-01-01T00:00:00.000Z").toISOString(),
        provider: "owner_bootstrap",
      },
      { onConflict: "user_id" },
    );
    if (subscriptionError) throw subscriptionError;

    return { ok: true };
  });