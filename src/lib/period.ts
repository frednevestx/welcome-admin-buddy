import { currentMonthInSaoPaulo, previousMonthInSaoPaulo, todayInSaoPaulo } from "./date-br";

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "month" | "previous" | "custom";

export interface Period {
  key: PeriodKey;
  from: string; // yyyy-mm-dd
  to: string;   // yyyy-mm-dd (inclusive)
  label: string;
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "month", label: "Este mês" },
  { key: "previous", label: "Mês anterior" },
  { key: "custom", label: "Personalizado" },
];

function subtractDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

export function periodFromKey(key: PeriodKey, custom?: { from: string; to: string }): Period {
  const to = todayInSaoPaulo();
  if (key === "today") return { key, from: to, to, label: "Hoje" };
  if (key === "custom" && custom) return { key, ...custom, label: "Personalizado" };
  if (key === "month") return { key, ...currentMonthInSaoPaulo(), label: "Este mês" };
  if (key === "previous") return { key, ...previousMonthInSaoPaulo(), label: "Mês anterior" };
  const days = key === "7d" ? 6 : key === "30d" ? 29 : 89;
  return { key, from: subtractDays(to, days), to, label: `Últimos ${days + 1} dias` };
}

export function previousPeriod(p: Period): Period {
  const from = new Date(p.from + "T00:00:00");
  const to = new Date(p.to + "T00:00:00");
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  const asIso = (date: Date) => date.toISOString().slice(0, 10);
  return { key: "custom", from: asIso(prevFrom), to: asIso(prevTo), label: "Período anterior" };
}
