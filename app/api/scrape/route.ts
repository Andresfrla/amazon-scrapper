import { NextResponse } from "next/server";
import { splitValidAndInvalid } from "@/lib/asins";
import type { ScrapeItem, ScrapeResponse } from "@/types/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ASINS = 100;
const SCRAPER_TIMEOUT_MS = 2 * 60 * 1000;
const SCRAPER_API_URL = process.env.SCRAPER_API_URL?.trim();
const IS_VERCEL = Boolean(process.env.VERCEL);

function sanitizeText(value: string): string {
  let text = value;

  const replacements: Array<[string, string]> = [
    ["ENV\uFFFDO", "ENVIO"],
    ["D\uFFFDA", "DIA"],
    ["Jap\uFFFDn", "Japon"],
    ["M\uFFFDxico", "Mexico"],
    ["M\uFFFDXICO", "MEXICO"],
    ["Ã³", "o"],
    ["Ã¡", "a"],
    ["Ã©", "e"],
    ["Ã­", "i"],
    ["Ãº", "u"],
    ["Ã±", "n"],
  ];

  for (const [wrong, right] of replacements) {
    text = text.replaceAll(wrong, right);
  }

  return text;
}

function sanitizeItem(item: ScrapeItem): ScrapeItem {
  return {
    ...item,
    asin: sanitizeText(item.asin),
    title: item.title ? sanitizeText(item.title) : item.title,
    price: item.price ? sanitizeText(item.price) : item.price,
    rating: item.rating ? sanitizeText(item.rating) : item.rating,
    reviews: item.reviews ? sanitizeText(item.reviews) : item.reviews,
    url: item.url ? sanitizeText(item.url) : item.url,
    strikePrice: item.strikePrice ? sanitizeText(item.strikePrice) : item.strikePrice,
    bestPrice: item.bestPrice ? sanitizeText(item.bestPrice) : item.bestPrice,
    bestSeller: item.bestSeller ? sanitizeText(item.bestSeller) : item.bestSeller,
    secondBestPrice: item.secondBestPrice ? sanitizeText(item.secondBestPrice) : item.secondBestPrice,
    secondSeller: item.secondSeller ? sanitizeText(item.secondSeller) : item.secondSeller,
    thirdBestPrice: item.thirdBestPrice ? sanitizeText(item.thirdBestPrice) : item.thirdBestPrice,
    thirdSeller: item.thirdSeller ? sanitizeText(item.thirdSeller) : item.thirdSeller,
    error: item.error ? sanitizeText(item.error) : item.error,
  };
}

function sanitizeResponse(response: ScrapeResponse): ScrapeResponse {
  return {
    ...response,
    items: response.items.map((item) => sanitizeItem(item)),
  };
}

async function runRemoteScraper(asins: string[], requestId: string): Promise<ScrapeResponse> {
  if (!SCRAPER_API_URL) {
    throw new Error(
      "SCRAPER_API_URL no configurado. Define esta variable en Vercel con la URL de Render.",
    );
  }

  const endpoint = `${SCRAPER_API_URL.replace(/\/$/, "")}/scrape`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    console.log(`[scrape:${requestId}] remote endpoint=${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asins }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: unknown;

    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { error: raw || `Remote status ${response.status}` };
    }

    if (!response.ok) {
      const errorObject = payload as { error?: string; detail?: string };
      const detail = errorObject.error ?? errorObject.detail ?? `Remote status ${response.status}`;
      throw new Error(`Render error: ${detail}`);
    }

    return sanitizeResponse(payload as ScrapeResponse);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Timeout llamando al scraper remoto (2 minutos).");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const requestId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  try {
    const body = (await request.json()) as { asins?: string[] };
    const incoming = Array.isArray(body.asins) ? body.asins.map((item) => String(item)) : [];
    const { valid, invalid } = splitValidAndInvalid(incoming);

    console.log(
      `[scrape:${requestId}] incoming=${incoming.length} valid=${valid.length} invalid=${invalid.length}`,
    );

    if (incoming.length === 0) {
      return NextResponse.json({ error: "Envia al menos un ASIN en el payload." }, { status: 400 });
    }

    if (invalid.length > 0) {
      return NextResponse.json({ error: `Hay ASINs invalidos. Ejemplo: ${invalid[0]}` }, { status: 400 });
    }

    if (valid.length > MAX_ASINS) {
      return NextResponse.json(
        { error: `Maximo permitido por solicitud: ${MAX_ASINS} ASINs.` },
        { status: 400 },
      );
    }

    if (IS_VERCEL && !SCRAPER_API_URL) {
      return NextResponse.json(
        {
          error:
            "Configuracion faltante en Vercel: SCRAPER_API_URL. Debe apuntar a tu servicio de Render.",
        },
        { status: 500 },
      );
    }

    const result = await runRemoteScraper(valid, requestId);
    console.log(`[scrape:${requestId}] done total=${result.meta.total} ok=${result.meta.success}`);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido ejecutando scraping.";
    console.error(`[scrape:${requestId}] error=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}