/**
 * Painel administrativo — todas as funções validam a role `admin` no servidor
 * (nunca por comparação de e-mail no cliente).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { supabase, userId } = context;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Acesso restrito ao administrador.");
  return userId as string;
}

function mask(phone: string | null): string {
  if (!phone) return "—";
  if (phone.length <= 8) return phone;
  return `${phone.slice(0, 4)}${"*".repeat(phone.length - 8)}${phone.slice(-4)}`;
}

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const count = async (table: string, apply?: (q: any) => any) => {
      let q = supabaseAdmin.from(table as any).select("id", { count: "exact", head: true });
      if (apply) q = apply(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [identities, verified, conflicts, businesses, users, movements, archived, events] = await Promise.all([
      count("whatsapp_identities"),
      count("whatsapp_identities", (q: any) => q.eq("status", "verified")),
      count("whatsapp_identities", (q: any) => q.eq("has_conflict", true)),
      count("restaurants", (q: any) => q.is("archived_at", null)),
      count("profiles", (q: any) => q.is("archived_at", null)),
      count("movements", (q: any) => q.eq("status", "active")),
      count("movements", (q: any) => q.eq("status", "deleted")),
      count("whatsapp_raw_events"),
    ]);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: events24h } = await supabaseAdmin
      .from("whatsapp_raw_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    return { identities, verified, conflicts, businesses, users, movements, archived, events, events24h: events24h ?? 0 };
  });

export const listIdentitiesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("whatsapp_identities")
      .select(
        "id, phone_normalized, display_name, status, has_conflict, conflict_note, user_id, restaurant_id, first_message_at, last_message_at",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);

    const rids = Array.from(new Set((data ?? []).map((i: any) => i.restaurant_id).filter(Boolean)));
    const names = new Map<string, string>();
    if (rids.length) {
      const { data: rs } = await supabaseAdmin.from("restaurants").select("id, name").in("id", rids as string[]);
      for (const r of rs ?? []) names.set(r.id, r.name);
    }

    return (data ?? []).map((i: any) => ({
      ...i,
      phone_masked: mask(i.phone_normalized),
      restaurant_name: i.restaurant_id ? (names.get(i.restaurant_id) ?? "—") : "—",
    }));
  });

export const setIdentityBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; blocked: boolean }) => input)
  .handler(async ({ data, context }) => {
    const adminId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("@/lib/audit.server");
    await supabaseAdmin
      .from("whatsapp_identities")
      .update(
        data.blocked
          ? { status: "blocked", blocked_at: new Date().toISOString() }
          : { status: "known", blocked_at: null },
      )
      .eq("id", data.id);
    await audit(supabaseAdmin, {
      action: data.blocked ? "identity.blocked" : "identity.unblocked",
      entity: "whatsapp_identity",
      entityId: data.id,
      actorUserId: adminId,
      actorKind: "admin",
      origin: "admin",
    });
    return { ok: true };
  });

export const resolveIdentityConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const adminId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("@/lib/audit.server");
    await supabaseAdmin
      .from("whatsapp_identities")
      .update({ has_conflict: false, conflict_note: null })
      .eq("id", data.id);
    await audit(supabaseAdmin, {
      action: "identity.conflict_resolved",
      entity: "whatsapp_identity",
      entityId: data.id,
      actorUserId: adminId,
      actorKind: "admin",
      origin: "admin",
    });
    return { ok: true };
  });

export const listBusinessesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, whatsapp, cidade, created_at, archived_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((r: any) => ({ ...r, whatsapp_masked: mask(r.whatsapp) }));
  });

export const listAuditAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("audit_log")
      .select("id, created_at, action, entity, entity_id, origin, actor_kind, actor_phone, note")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((a: any) => ({ ...a, actor_phone: mask(a.actor_phone) }));
  });

export const listConversationsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("@/lib/audit.server");
    const { data } = await supabaseAdmin
      .from("whatsapp_raw_events")
      .select("id, created_at, contact_id, raw_message, classification, linked_movement_id")
      .order("created_at", { ascending: false })
      .limit(80);
    await audit(supabaseAdmin, {
      action: "admin.read_conversations",
      entity: "whatsapp_raw_events",
      actorUserId: adminId,
      actorKind: "admin",
      origin: "admin",
      note: "listagem das últimas conversas",
    });
    return (data ?? []).map((e: any) => ({ ...e, contact_masked: mask(e.contact_id) }));
  });

/** Pré-visualização da limpeza: mostra o que SERIA arquivado. Não altera nada. */
export const cleanupPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: businesses } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, created_at")
      .is("archived_at", null);
    const ids = (businesses ?? []).map((b: any) => b.id);
    const { count: movements } = await supabaseAdmin
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    const { count: identitiesKept } = await supabaseAdmin
      .from("whatsapp_identities")
      .select("id", { count: "exact", head: true });
    const { count: eventsKept } = await supabaseAdmin
      .from("whatsapp_raw_events")
      .select("id", { count: "exact", head: true });
    return {
      businesses: businesses ?? [],
      businessCount: ids.length,
      movements: movements ?? 0,
      identitiesKept: identitiesKept ?? 0,
      eventsKept: eventsKept ?? 0,
    };
  });

/** Executa a limpeza (arquivamento lógico). Exige a frase exata de confirmação. */
export const cleanupExecute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => input)
  .handler(async ({ data, context }) => {
    const adminId = await assertAdmin(context);
    if (data.confirmation.trim() !== "APAGAR TODOS OS DADOS") {
      throw new Error("Confirmação incorreta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("@/lib/audit.server");
    const now = new Date().toISOString();

    const { data: businesses } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .is("archived_at", null);
    const ids = (businesses ?? []).map((b: any) => b.id);

    await supabaseAdmin.from("movements").update({ status: "deleted" }).eq("status", "active");
    if (ids.length) {
      await supabaseAdmin.from("restaurants").update({ archived_at: now }).in("id", ids);
      await supabaseAdmin.from("profiles").update({ archived_at: now }).in("restaurant_id", ids);
      await supabaseAdmin
        .from("whatsapp_identities")
        .update({ restaurant_id: null, user_id: null, status: "known" })
        .in("restaurant_id", ids);
    }

    await audit(supabaseAdmin, {
      action: "admin.cleanup",
      entity: "restaurant",
      actorUserId: adminId,
      actorKind: "admin",
      origin: "admin",
      after: { businesses_archived: ids.length },
      note: "limpeza administrativa: contatos, conversas e auditoria preservados",
    });

    return { ok: true, archived: ids.length };
  });
