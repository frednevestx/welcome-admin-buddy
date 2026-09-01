/**
 * Correção, exclusão lógica e reinício de lançamentos pelo WhatsApp.
 *
 * Regras:
 * - nada é alterado ou apagado sem confirmação explícita do usuário;
 * - exclusão é LÓGICA (status = 'deleted'), o registro continua recuperável;
 * - toda alteração/exclusão vira histórico em `financial_adjustments`;
 * - todas as consultas são sempre filtradas pelo restaurant_id do telefone.
 */

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export interface MovementChanges {
  amount?: number | null;
  category_name?: string | null;
  movement_date?: string | null;
  movement_type?: "entrada" | "saida" | null;
}

export interface MovementRow {
  id: string;
  type: string;
  amount: number;
  movement_date: string;
  description: string | null;
  category_id: string | null;
  category_name?: string | null;
}

export function describeMovement(m: MovementRow): string {
  const kind = m.type === "entrada" ? "entrada" : "despesa";
  const what = m.category_name || m.description || "lançamento";
  return `${kind} de ${brl(Number(m.amount))} — ${what} (${m.movement_date})`;
}

/**
 * Lançamentos candidatos a uma correção/exclusão.
 * hint vazio => o mais recente do negócio.
 */
export async function findMovementCandidates(
  db: any,
  restaurantId: string,
  hint: string | null,
  limit = 5,
): Promise<MovementRow[]> {
  const select = "id, type, amount, movement_date, description, category_id, categories(name)";
  let query = db
    .from("movements_current")
    .select(select)
    .eq("restaurant_id", restaurantId)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (hint && hint.trim()) {
    const term = hint.trim();
    query = query.or(`description.ilike.%${term}%,notes.ilike.%${term}%`);
  }

  const { data } = await query.limit(hint ? limit : 1);
  let rows = (data ?? []) as any[];

  // Fallback: procura pelo nome da categoria quando a descrição não bate.
  if (hint && rows.length === 0) {
    const { data: cats } = await db
      .from("categories")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .ilike("name", `%${hint.trim()}%`);
    const ids = (cats ?? []).map((c: any) => c.id);
    if (ids.length) {
      const { data: byCat } = await db
        .from("movements_current")
        .select(select)
        .eq("restaurant_id", restaurantId)
        .in("category_id", ids)
        .order("movement_date", { ascending: false })
        .limit(limit);
      rows = (byCat ?? []) as any[];
    }
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    movement_date: r.movement_date,
    description: r.description ?? null,
    category_id: r.category_id ?? null,
    category_name: r.categories?.name ?? null,
  }));
}

export async function getMovement(db: any, restaurantId: string, id: string): Promise<MovementRow | null> {
  const { data } = await db
    .from("movements_current")
    .select("id, type, amount, movement_date, description, category_id, categories(name)")
    .eq("restaurant_id", restaurantId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    type: data.type,
    amount: Number(data.amount),
    movement_date: data.movement_date,
    description: data.description ?? null,
    category_id: data.category_id ?? null,
    category_name: (data as any).categories?.name ?? null,
  };
}

async function audit(
  db: any,
  restaurantId: string,
  input: { targetId: string; field: string | null; original: number | null; adjusted: number | null; reason: string },
) {
  await db.from("financial_adjustments").insert({
    restaurant_id: restaurantId,
    target_table: "movements",
    target_id: input.targetId,
    field: input.field,
    original_value: input.original,
    adjusted_value: input.adjusted,
    delta_amount: (input.adjusted ?? 0) - (input.original ?? 0),
    reason: input.reason,
  });
}

export function changesLabel(changes: MovementChanges): string {
  const parts: string[] = [];
  if (changes.amount != null) parts.push(`valor para ${brl(Number(changes.amount))}`);
  if (changes.category_name) parts.push(`categoria para ${changes.category_name}`);
  if (changes.movement_date) parts.push(`data para ${changes.movement_date}`);
  if (changes.movement_type) parts.push(`tipo para ${changes.movement_type === "entrada" ? "receita" : "despesa"}`);
  return parts.join(", ");
}

export async function applyMovementUpdate(
  db: any,
  restaurantId: string,
  movementId: string,
  changes: MovementChanges,
): Promise<MovementRow | null> {
  const before = await getMovement(db, restaurantId, movementId);
  if (!before) return null;

  const patch: Record<string, any> = {};
  if (changes.amount != null) patch["amount"] = changes.amount;
  if (changes.movement_date) patch["movement_date"] = changes.movement_date;
  if (changes.movement_type) patch["type"] = changes.movement_type;

  if (changes.category_name) {
    const type = changes.movement_type ?? before.type;
    const { data: existing } = await db
      .from("categories")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .ilike("name", changes.category_name)
      .limit(1)
      .maybeSingle();
    let categoryId = existing?.id ?? null;
    if (!categoryId) {
      const { data: created } = await db
        .from("categories")
        .insert({ restaurant_id: restaurantId, name: changes.category_name, movement_type: type, is_default: false })
        .select("id")
        .maybeSingle();
      categoryId = created?.id ?? null;
    }
    if (categoryId) patch["category_id"] = categoryId;
    patch["description"] = changes.category_name;
  }

  if (Object.keys(patch).length === 0) return before;

  await db.from("movements").update(patch).eq("id", movementId).eq("restaurant_id", restaurantId);

  await audit(db, restaurantId, {
    targetId: movementId,
    field: changes.amount != null ? "amount" : Object.keys(patch)[0] ?? null,
    original: before.amount,
    adjusted: changes.amount != null ? Number(changes.amount) : before.amount,
    reason: `correção via WhatsApp: ${changesLabel(changes) || "ajuste"}`,
  });

  return await getMovement(db, restaurantId, movementId);
}

/** Exclusão LÓGICA: sai dos cálculos, continua no banco. */
export async function softDeleteMovement(db: any, restaurantId: string, movementId: string): Promise<MovementRow | null> {
  const before = await getMovement(db, restaurantId, movementId);
  if (!before) return null;
  await db
    .from("movements")
    .update({ status: "deleted", notes: "excluído pelo usuário via WhatsApp" })
    .eq("id", movementId)
    .eq("restaurant_id", restaurantId);
  await audit(db, restaurantId, {
    targetId: movementId,
    field: "status",
    original: before.amount,
    adjusted: 0,
    reason: "exclusão via WhatsApp (lógica, recuperável)",
  });
  return before;
}

/** "Começar do zero": tira TODOS os lançamentos dos cálculos. Nada é apagado de fato. */
export async function resetMovements(db: any, restaurantId: string): Promise<{ count: number; total: number }> {
  const { data } = await db
    .from("movements_current")
    .select("id, amount")
    .eq("restaurant_id", restaurantId);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return { count: 0, total: 0 };

  await db
    .from("movements")
    .update({ status: "deleted", notes: "reinício solicitado pelo usuário via WhatsApp" })
    .eq("restaurant_id", restaurantId)
    .eq("status", "active");

  const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  await db.from("financial_adjustments").insert({
    restaurant_id: restaurantId,
    target_table: "movements",
    target_id: rows[0].id,
    field: "status",
    original_value: total,
    adjusted_value: 0,
    delta_amount: -total,
    reason: `reinício de dados via WhatsApp: ${rows.length} lançamento(s) removidos dos cálculos`,
  });

  return { count: rows.length, total };
}

export const RESET_CONFIRM_MESSAGE =
  "Isso removerá todos os lançamentos financeiros deste negócio dos cálculos e reiniciará o dashboard. Seu usuário e o cadastro do negócio serão mantidos. Para confirmar, digite exatamente: APAGAR TODOS OS DADOS";
