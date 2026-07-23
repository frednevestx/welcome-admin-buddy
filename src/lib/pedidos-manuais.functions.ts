import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Categoria = "Venda WhatsApp" | "Venda Balcão";

function classifyHeuristic(pagamento: string | null, descricao: string | null): Categoria {
  const s = `${pagamento ?? ""} ${descricao ?? ""}`.toLowerCase();
  if (/\b(balc(a|ã)o|presencial|loja|salao|sal(a|ã)o)\b/.test(s)) return "Venda Balcão";
  if (/\b(whats|whatsapp|delivery|entrega|ifood|99|motoboy)\b/.test(s)) return "Venda WhatsApp";
  // dinheiro/pix sem contexto: assumir balcão; cartão sem contexto: whatsapp
  if (/\b(dinheiro|especie|esp(e|é)cie|pix)\b/.test(s)) return "Venda Balcão";
  if (/\b(cart(a|ã)o|credito|cr(e|é)dito|debito|d(e|é)bito)\b/.test(s)) return "Venda WhatsApp";
  return "Venda WhatsApp";
}

export const processarPedidosManuais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", userId)
      .maybeSingle();

    const restaurantId = profile?.restaurant_id;
    if (!restaurantId) throw new Error("Sem restaurante ativo");

    const { data: pending, error: pendErr } = await supabase
      .from("pedidos_manuais")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("processed_at", null)
      .not("valor", "is", null);
    if (pendErr) throw pendErr;

    const rows = (pending ?? []).filter((r: any) => Number(r.valor) > 0);
    if (rows.length === 0) return { processed: 0 };

    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, movement_type")
      .eq("restaurant_id", restaurantId)
      .eq("movement_type", "entrada");

    const catByName = new Map<string, string>();
    for (const c of cats ?? []) catByName.set(c.name, c.id);

    let processed = 0;
    for (const r of rows) {
      const categoria = classifyHeuristic(r.forma_pagamento, r.descricao);
      const catId = catByName.get(categoria) ?? null;
      const amount = Number(r.valor) || 0;
      const date = r.pedido_data ?? new Date().toISOString().slice(0, 10);
      const desc = [r.descricao, r.cliente ? `Cliente: ${r.cliente}` : null]
        .filter(Boolean)
        .join(" — ") || "Venda manual";

      const { data: mov, error: movErr } = await supabase
        .from("movements")
        .insert({
          restaurant_id: restaurantId,
          type: "entrada",
          category_id: catId,
          description: desc,
          amount,
          movement_date: date,
          payment_method: r.forma_pagamento ?? null,
          notes: r.observacao ?? null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (movErr) throw movErr;

      await supabase
        .from("pedidos_manuais")
        .update({ movement_id: mov.id, processed_at: new Date().toISOString() })
        .eq("id", r.id);

      processed += 1;
    }

    return { processed };
  });
