"use client";

import { Download } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { ScrapeItem } from "@/types/scrape";

type SortField =
  | "asin"
  | "status"
  | "strikePrice"
  | "bestPrice"
  | "bestSeller"
  | "secondBestPrice"
  | "secondSeller"
  | "thirdBestPrice"
  | "thirdSeller";
type SortDirection = "asc" | "desc";

interface ResultsTableCardProps {
  items: ScrapeItem[];
  onDownloadExcel: () => void;
}

function compareValues(a: string, b: string, direction: SortDirection): number {
  const base = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "asc" ? base : -base;
}

export function ResultsTableCard({ items, onDownloadExcel }: ResultsTableCardProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>("asin");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = normalized
      ? items.filter((item) => {
          const haystack = [
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
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalized);
        })
      : items;

    return [...source].sort((a, b) => {
      const valueA = String(a[sortField] ?? "");
      const valueB = String(b[sortField] ?? "");
      return compareValues(valueA, valueB, sortDirection);
    });
  }, [items, query, sortField, sortDirection]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const onRequestSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Resultado final
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                size="small"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Buscar ASIN, seller o estado"
              />
              <Button startIcon={<Download />} variant="outlined" onClick={onDownloadExcel}>
                Descargar Excel
              </Button>
            </Stack>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "asin"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("asin")}
                    >
                      ASIN
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "status"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("status")}
                    >
                      Estado
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "strikePrice"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("strikePrice")}
                    >
                      Precio tachado
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "bestPrice"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("bestPrice")}
                    >
                      Buybox
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "bestSeller"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("bestSeller")}
                    >
                      Seller buybox
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "secondBestPrice"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("secondBestPrice")}
                    >
                      2do precio
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "secondSeller"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("secondSeller")}
                    >
                      Seller 2
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "thirdBestPrice"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("thirdBestPrice")}
                    >
                      3er precio
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === "thirdSeller"}
                      direction={sortDirection}
                      onClick={() => onRequestSort("thirdSeller")}
                    >
                      Seller 3
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((item) => (
                  <TableRow key={item.asin} hover>
                    <TableCell>{item.asin}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.status}
                        color={item.status === "ok" ? "success" : item.status === "error" ? "error" : "warning"}
                      />
                    </TableCell>
                    <TableCell>{item.strikePrice ?? "N/A"}</TableCell>
                    <TableCell>{item.bestPrice ?? "N/A"}</TableCell>
                    <TableCell>{item.bestSeller ?? "N/A"}</TableCell>
                    <TableCell>{item.secondBestPrice ?? "N/A"}</TableCell>
                    <TableCell>{item.secondSeller ?? "N/A"}</TableCell>
                    <TableCell>{item.thirdBestPrice ?? "N/A"}</TableCell>
                    <TableCell>{item.thirdSeller ?? "N/A"}</TableCell>
                    <TableCell>{item.error ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No hay resultados para mostrar.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}