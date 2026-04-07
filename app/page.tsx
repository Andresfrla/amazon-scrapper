"use client";

import { QueryStats } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { AsinInputCard } from "@/components/asins/AsinInputCard";
import { ResultsTableCard } from "@/components/asins/ResultsTableCard";
import { ScrapeStatusCard } from "@/components/asins/ScrapeStatusCard";
import { parseRawAsins, splitValidAndInvalid } from "@/lib/asins";
import { buildScrapeExcel } from "@/lib/excel";
import type { ScrapeItem, ScrapeResponse } from "@/types/scrape";

type UiStatus = "idle" | "loading" | "success" | "error";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0b57d0" },
    secondary: { main: "#0f766e" },
    background: { default: "#f4f8ff", paper: "#ffffff" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-geist-sans), 'Segoe UI', sans-serif",
    h4: { fontWeight: 800, letterSpacing: -0.4 },
  },
});

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

function downloadExcelFile(filename: string, bytes: Uint8Array) {
  // Normalize to an ArrayBuffer-backed view for strict BlobPart typing.
  const normalizedBytes = new Uint8Array(bytes);
  const blob = new Blob([normalizedBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildMeta(items: ScrapeItem[], durationMs: number) {
  const success = items.filter((item) => item.status === "ok").length;
  const notFound = items.filter((item) => item.status === "not_found").length;
  const failed = items.filter((item) => item.status === "error").length;

  return {
    total: items.length,
    success,
    failed,
    notFound,
    durationMs,
  };
}

async function scrapeSingleAsin(asin: string): Promise<ScrapeItem> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const apiResponse = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asins: [asin] }),
      signal: controller.signal,
    });

    const json = (await apiResponse.json()) as ScrapeResponse | { error: string };
    if (!apiResponse.ok || "error" in json) {
      const error = "error" in json ? json.error : "Error inesperado.";
      throw new Error(error);
    }

    if (!json.items[0]) {
      throw new Error("El scraper no devolvio item para el ASIN.");
    }

    return json.items[0];
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Timeout por ASIN (2 minutos)."
        : error instanceof Error
          ? error.message
          : "No fue posible scrapear este ASIN.";

    return {
      asin,
      status: "error",
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default function Home() {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<UiStatus>("idle");
  const [message, setMessage] = useState<string>("Listo para iniciar scraping.");
  const [response, setResponse] = useState<ScrapeResponse | null>(null);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const parsedAsins = useMemo(() => parseRawAsins(rawInput), [rawInput]);
  const { valid, invalid } = useMemo(() => splitValidAndInvalid(parsedAsins), [parsedAsins]);

  const helperText = invalid.length
    ? `ASINs invalidos (${invalid.length}). Ejemplo: ${invalid[0]}`
    : `ASINs validos: ${valid.length}`;

  const handleClear = () => {
    setRawInput("");
    setStatus("idle");
    setMessage("Listo para iniciar scraping.");
    setResponse(null);
    setProgressDone(0);
    setProgressTotal(0);
  };

  const handleSubmit = async () => {
    if (valid.length === 0) {
      setStatus("error");
      setMessage("Captura al menos un ASIN valido de 10 caracteres.");
      return;
    }

    if (invalid.length > 0) {
      setStatus("error");
      setMessage(`Corrige ASINs invalidos antes de continuar. Ejemplo: ${invalid[0]}`);
      return;
    }

    if (valid.length > 100) {
      setStatus("error");
      setMessage("El maximo por ejecucion es 100 ASINs.");
      return;
    }

    const startedAt = performance.now();
    const collectedItems: ScrapeItem[] = [];

    console.log("[ui] scraping:start", { totalAsins: valid.length });
    setStatus("loading");
    setMessage("Iniciando scraping...");
    setResponse(null);
    setProgressDone(0);
    setProgressTotal(valid.length);

    for (let index = 0; index < valid.length; index += 1) {
      const asin = valid[index];
      setMessage(`Scrapeando ${index + 1}/${valid.length}: ${asin}`);

      const item = await scrapeSingleAsin(asin);
      collectedItems.push(item);
      setProgressDone(index + 1);
    }

    const durationMs = Math.round(performance.now() - startedAt);
    const finalResponse: ScrapeResponse = {
      meta: buildMeta(collectedItems, durationMs),
      items: collectedItems,
    };

    console.log("[ui] scraping:done", finalResponse.meta);
    setResponse(finalResponse);
    setStatus("success");
    setMessage(`Proceso completado. Scrapeados ${collectedItems.length}/${valid.length}.`);
  };

  const handleDownloadExcel = () => {
    if (!response || response.items.length === 0) {
      return;
    }

    const bytes = buildScrapeExcel(response.items);
    const stamp = new Date().toISOString().replaceAll(":", "-");
    downloadExcelFile(`resultado_final_${stamp}.xlsx`, bytes);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", background: "radial-gradient(circle at top, #dbeafe 0%, #f4f8ff 55%)" }}>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{ backdropFilter: "blur(8px)", borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Toolbar>
            <QueryStats sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Amazon ASIN Scrapper
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Typography variant="h4">Scraping de ASINs en lote</Typography>
            <Typography color="text.secondary">
              Pega tus ASINs, corre el scraping y descarga el resultado final en Excel.
            </Typography>
          </Stack>

          <Stack spacing={2.5}>
            <AsinInputCard
              rawInput={rawInput}
              onInputChange={setRawInput}
              onSubmit={handleSubmit}
              onClear={handleClear}
              loading={status === "loading"}
              helperText={helperText}
              count={valid.length}
            />

            <ScrapeStatusCard
              status={status}
              meta={response?.meta ?? null}
              message={message}
              progressDone={progressDone}
              progressTotal={progressTotal}
            />

            <ResultsTableCard items={response?.items ?? []} onDownloadExcel={handleDownloadExcel} />
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
