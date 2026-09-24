import { formatDateBR } from "@/lib/format";

export interface MovementCsvRow {
  movement_date: string;
  type: string;
  description: string | null;
  supplier_name: string | null;
  category_name: string | null;
  originLabel: string;
  amount: number;
}

function safeCell(value: string): string {
  const protectedValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(protectedValue) ? `"${protectedValue.replace(/"/g, '""')}"` : protectedValue;
}

export function movementsToCsv(rows: MovementCsvRow[]): string {
  const header = ["Data", "Tipo", "Descrição", "Fornecedor/Contato", "Categoria", "Origem", "Valor"];
  const lines = rows.map((row) => [
    formatDateBR(row.movement_date),
    row.type,
    row.description ?? "",
    row.supplier_name ?? "",
    row.category_name ?? "Sem categoria",
    row.originLabel,
    Number(row.amount).toFixed(2).replace(".", ","),
  ].map((cell) => safeCell(String(cell))).join(";"));
  return `\uFEFF${[header.join(";"), ...lines].join("\r\n")}`;
}

export function downloadCsv(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}