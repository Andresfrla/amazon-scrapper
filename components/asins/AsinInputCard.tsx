"use client";

import { Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";

interface AsinInputCardProps {
  rawInput: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading: boolean;
  helperText?: string;
  count: number;
}

export function AsinInputCard({
  rawInput,
  onInputChange,
  onSubmit,
  onClear,
  loading,
  helperText,
  count,
}: AsinInputCardProps) {
  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            ASINs a scrapear
          </Typography>
          <TextField
            value={rawInput}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Ejemplo: B0C1234567, B0A7654321"
            multiline
            minRows={6}
            maxRows={12}
            fullWidth
            helperText={helperText ?? `ASINs detectados: ${count}`}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button variant="contained" size="large" disabled={loading || count === 0} onClick={onSubmit}>
              {loading ? "Scrapeando..." : "Iniciar scraping"}
            </Button>
            <Button variant="outlined" size="large" disabled={loading} onClick={onClear}>
              Limpiar
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}