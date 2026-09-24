export type MovementType = "entrada" | "saida" | "transferencia" | "ajuste";

export type MovementRow = {
  id: string;
  movement_date: string;
  created_at: string;
  description: string | null;
  amount: number;
  type: MovementType;
  payment_method: string | null;
  notes: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_archived_at: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  origin: "automatico" | "manual" | "ajuste" | "importado";
  created_from_event_id: string | null;
  integration_id: string | null;
  is_fixed: boolean;
  source_ref: string | null;
};

export type Category = {
  id: string;
  name: string;
  movement_type: MovementType | null;
  color: string;
  archived_at: string | null;
  is_system: boolean;
  is_default: boolean;
  linkedCount: number;
};

export const TYPE_LABEL: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
  ajuste: "Ajuste",
};

export const CATEGORY_COLORS = [
  "#2F6B4F", "#C49A3A", "#2F7D8C", "#8A5A44", "#6B7280",
  "#B45309", "#9F3A4A", "#4F6D7A", "#647A3C", "#7C5C8E",
] as const;

export const CATEGORY_COLOR_CLASS: Record<string, string> = {
  "#2F6B4F": "bg-emerald-800",
  "#C49A3A": "bg-amber-600",
  "#2F7D8C": "bg-cyan-700",
  "#8A5A44": "bg-orange-800",
  "#6B7280": "bg-gray-500",
  "#B45309": "bg-amber-700",
  "#9F3A4A": "bg-red-800",
  "#4F6D7A": "bg-slate-600",
  "#647A3C": "bg-lime-800",
  "#7C5C8E": "bg-violet-800",
};

export function movementOrigin(row: MovementRow): string {
  if (row.origin === "ajuste") return "Ajuste";
  if (row.origin === "importado" || row.integration_id) return "Importado";
  if (row.origin === "automatico" && row.created_from_event_id) return "WhatsApp";
  if (row.origin === "manual") return "Manual";
  return "Automático";
}