"use client";

import { Alert, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { ScrapeMeta } from "@/types/scrape";

type UiStatus = "idle" | "loading" | "success" | "error";

interface ScrapeStatusCardProps {
  status: UiStatus;
  meta: ScrapeMeta | null;
  message?: string;
  progressDone?: number;
  progressTotal?: number;
}

export function ScrapeStatusCard({
  status,
  meta,
  message,
  progressDone = 0,
  progressTotal = 0,
}: ScrapeStatusCardProps) {
  const progressValue = progressTotal > 0 ? (progressDone / progressTotal) * 100 : 0;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Estado del proceso
            </Typography>
            <Chip
              size="small"
              label={status}
              color={status === "success" ? "success" : status === "error" ? "error" : "default"}
            />
          </Stack>

          {status === "loading" ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Scrapeados: {progressDone}/{progressTotal}
              </Typography>
              <LinearProgress variant="determinate" value={progressValue} />
            </Stack>
          ) : null}

          {status === "error" && message ? <Alert severity="error">{message}</Alert> : null}
          {status === "success" && message ? <Alert severity="success">{message}</Alert> : null}

          {meta ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Chip label={`Total: ${meta.total}`} variant="outlined" />
              <Chip label={`Exitos: ${meta.success}`} color="success" variant="outlined" />
              <Chip label={`Fallidos: ${meta.failed}`} color="error" variant="outlined" />
              <Chip label={`Sin oferta: ${meta.notFound}`} color="warning" variant="outlined" />
              <Chip label={`Duracion: ${(meta.durationMs / 1000).toFixed(1)}s`} variant="outlined" />
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}