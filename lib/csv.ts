import type { ScrapeItem } from "@/types/scrape";

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function buildScrapeCsv(items: ScrapeItem[]): string {
  const headers = [
    "asin",
    "status",
    "strikePrice",
    "bestPrice",
    "bestSeller",
    "secondBestPrice",
    "secondSeller",
    "thirdBestPrice",
    "thirdSeller",
    "error",
  ];

  const lines = items.map((item) =>
    [
      item.asin,
      item.status,
      item.strikePrice ?? "",
      item.bestPrice ?? "",
      item.bestSeller ?? "",
      item.secondBestPrice ?? "",
      item.secondSeller ?? "",
      item.thirdBestPrice ?? "",
      item.thirdSeller ?? "",
      item.error ?? "",
    ]
      .map((value) => escapeCsv(String(value)))
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}