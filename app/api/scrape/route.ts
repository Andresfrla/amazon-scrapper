import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { splitValidAndInvalid } from "@/lib/asins";
import type { ScrapeItem, ScrapeResponse } from "@/types/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ASINS = 100;
const SCRAPER_TIMEOUT_MS = 2 * 60 * 1000;
const SCRAPER_API_URL = process.env.SCRAPER_API_URL?.trim();

type Command = {
  executable: string;
  args: string[];
};

function forceKillChild(child: ChildProcessWithoutNullStreams) {
  child.kill("SIGTERM");

  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
}

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
    throw new Error("SCRAPER_API_URL no configurado.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    const endpoint = `${SCRAPER_API_URL.replace(/\/$/, "")}/scrape`;
    console.log(`[scrape:${requestId}] Remote call -> ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asins }),
      signal: controller.signal,
    });

    const json = (await response.json()) as ScrapeResponse | { error: string };
    if (!response.ok || "error" in json) {
      const message = "error" in json ? json.error : "Error remoto inesperado.";
      throw new Error(message);
    }

    return sanitizeResponse(json);
  } finally {
    clearTimeout(timeout);
  }
}

function runLocalScraperCommand(command: Command, input: string, requestId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[scrape:${requestId}] Local exec ${command.executable} ${command.args.join(" ")}`);

    const child = spawn(command.executable, command.args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        forceKillChild(child);
        reject(new Error("Timeout ejecutando scraper local (2 minutos)."));
      }
    }, SCRAPER_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) {
          console.log(`[scrape:${requestId}] ${trimmed}`);
        }
      }
    });

    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr || `Python termino con codigo ${code}.`));
        return;
      }

      if (!stdout.trim()) {
        reject(new Error("El scraper local no devolvio salida JSON."));
        return;
      }

      resolve(stdout.trim());
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

async function runLocalScraper(asins: string[], requestId: string): Promise<ScrapeResponse> {
  const scriptPath = path.join(process.cwd(), "amazon_scraper.py");
  const commands: Command[] = [
    { executable: "python", args: ["-X", "utf8", scriptPath, "--stdin-json", "--headless"] },
    { executable: "py", args: ["-3", "-X", "utf8", scriptPath, "--stdin-json", "--headless"] },
  ];

  const payload = JSON.stringify({ asins });
  let lastError: unknown;

  for (const command of commands) {
    try {
      const output = await runLocalScraperCommand(command, payload, requestId);
      const parsed = JSON.parse(output) as ScrapeResponse;
      return sanitizeResponse(parsed);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[scrape:${requestId}] Local fallback failed (${command.executable}): ${message}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo ejecutar scraper local con python ni py -3.");
}

async function runScraper(asins: string[], requestId: string): Promise<ScrapeResponse> {
  if (SCRAPER_API_URL) {
    return runRemoteScraper(asins, requestId);
  }

  return runLocalScraper(asins, requestId);
}

export async function POST(request: Request) {
  const requestId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  try {
    const body = (await request.json()) as { asins?: string[] };
    const incoming = Array.isArray(body.asins) ? body.asins.map((item) => String(item)) : [];
    const { valid, invalid } = splitValidAndInvalid(incoming);

    console.log(
      `[scrape:${requestId}] Request incoming=${incoming.length} valid=${valid.length} invalid=${invalid.length}`,
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

    const result = await runScraper(valid, requestId);
    console.log(`[scrape:${requestId}] Done total=${result.meta.total} ok=${result.meta.success}`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido ejecutando scraping.";
    console.error(`[scrape:${requestId}] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}