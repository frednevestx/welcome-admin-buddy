export function formatBRL(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatShortBRL(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1000) {
    return "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k";
  }
  return formatBRL(n);
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString("pt-BR");
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  const n = Number(value ?? 0);
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return date.toLocaleDateString("pt-BR");
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
