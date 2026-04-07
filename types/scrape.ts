export type ScrapeItemStatus = "ok" | "error" | "not_found";

export interface ScrapeItem {
  asin: string;
  status: ScrapeItemStatus;
  title?: string;
  price?: string;
  rating?: string;
  reviews?: string;
  url?: string;
  strikePrice?: string;
  bestPrice?: string;
  bestSeller?: string;
  secondBestPrice?: string;
  secondSeller?: string;
  thirdBestPrice?: string;
  thirdSeller?: string;
  error?: string;
}

export interface ScrapeMeta {
  total: number;
  success: number;
  failed: number;
  notFound: number;
  durationMs: number;
}

export interface ScrapeResponse {
  meta: ScrapeMeta;
  items: ScrapeItem[];
}