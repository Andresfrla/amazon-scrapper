import * as XLSX from "xlsx";
import type { ScrapeItem } from "@/types/scrape";

const EXCEL_COLUMNS = [
  "ASIN",
  "Precio Tachado",
  "Mejor Precio",
  "Seller",
  "Segundo mejor precio",
  "Seller 2",
  "Tercer mejor precio",
  "Seller 3",
  "Estado",
  "Error",
] as const;

type ExcelRow = {
  [key in (typeof EXCEL_COLUMNS)[number]]: string;
};

function toExcelRows(items: ScrapeItem[]): ExcelRow[] {
  return items.map((item) => ({
    ASIN: item.asin,
    "Precio Tachado": item.strikePrice ?? "N/A",
    "Mejor Precio": item.bestPrice ?? "N/A",
    Seller: item.bestSeller ?? "N/A",
    "Segundo mejor precio": item.secondBestPrice ?? "N/A",
    "Seller 2": item.secondSeller ?? "N/A",
    "Tercer mejor precio": item.thirdBestPrice ?? "N/A",
    "Seller 3": item.thirdSeller ?? "N/A",
    Estado: item.status,
    Error: item.error ?? "",
  }));
}

export function buildScrapeExcel(items: ScrapeItem[]): Uint8Array {
  const rows = toExcelRows(items);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXCEL_COLUMNS] });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "resultado_final");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
}