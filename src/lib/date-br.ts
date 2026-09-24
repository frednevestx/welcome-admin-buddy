const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export interface DateRangeBR {
  from: string;
  to: string;
}

function datePartsInSaoPaulo(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function isoDateFromParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayInSaoPaulo(now = new Date()): string {
  const { year, month, day } = datePartsInSaoPaulo(now);
  return isoDateFromParts(year, month, day);
}

export function currentMonthInSaoPaulo(now = new Date()): DateRangeBR {
  const { year, month } = datePartsInSaoPaulo(now);
  return {
    from: isoDateFromParts(year, month, 1),
    to: isoDateFromParts(year, month, lastDayOfMonth(year, month)),
  };
}

export function previousMonthInSaoPaulo(now = new Date()): DateRangeBR {
  const current = datePartsInSaoPaulo(now);
  const month = current.month === 1 ? 12 : current.month - 1;
  const year = current.month === 1 ? current.year - 1 : current.year;
  return {
    from: isoDateFromParts(year, month, 1),
    to: isoDateFromParts(year, month, lastDayOfMonth(year, month)),
  };
}

export function parseBRL(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}