import { isoDate } from "./format";

export type GoalPeriod = "diaria" | "semanal" | "mensal";

export function goalPeriodLabel(p: GoalPeriod): string {
  return p === "diaria" ? "Meta diária" : p === "semanal" ? "Meta semanal" : "Meta mensal";
}

export interface GoalWindow {
  from: string; // yyyy-mm-dd
  to: string;   // yyyy-mm-dd inclusive
  totalDays: number;
  elapsedDays: number; // includes today
}

/** Retorna a janela ATUAL (dia, semana ou mês corrente) para o período da meta. */
export function currentGoalWindow(period: GoalPeriod, ref: Date = new Date()): GoalWindow {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);

  if (period === "diaria") {
    const iso = isoDate(d);
    return { from: iso, to: iso, totalDays: 1, elapsedDays: 1 };
  }

  if (period === "semanal") {
    // Semana: segunda a domingo
    const dow = (d.getDay() + 6) % 7; // 0 = segunda
    const start = new Date(d);
    start.setDate(d.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: isoDate(start),
      to: isoDate(end),
      totalDays: 7,
      elapsedDays: dow + 1,
    };
  }

  // mensal
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: isoDate(start),
    to: isoDate(end),
    totalDays: end.getDate(),
    elapsedDays: d.getDate(),
  };
}
