import { isoDate } from "./format";

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";

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
  { key: "custom", label: "Personalizado" },
];

export function periodFromKey(key: PeriodKey, custom?: { from: string; to: string }): Period {
  const today = new Date();
  const to = isoDate(today);
  if (key === "today") return { key, from: to, to, label: "Hoje" };
  if (key === "custom" && custom) return { key, ...custom, label: "Personalizado" };
  const days = key === "7d" ? 6 : key === "30d" ? 29 : 89;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return { key, from: isoDate(start), to, label: `Últimos ${days + 1} dias` };
}

export function previousPeriod(p: Period): Period {
  const from = new Date(p.from + "T00:00:00");
  const to = new Date(p.to + "T00:00:00");
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { key: "custom", from: isoDate(prevFrom), to: isoDate(prevTo), label: "Período anterior" };
}
