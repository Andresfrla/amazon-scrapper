# agents.md

## Objetivo
Construir una aplicacion web en **Next.js** (App Router) donde el usuario pueda:

1. Pegar o escribir multiples ASINs.
2. Ejecutar el scraping con un boton.
3. Ver un resultado final limpio (tabla + resumen + exportable).

La UI debe verse como producto final usando **Material UI (MUI)**.

## Stack Obligatorio
- Next.js 16+ con TypeScript.
- React 19.
- Material UI (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`).
- Backend dentro de Next.js (`app/api/...`) para orquestar scraping.
- Reutilizar `amazon_scraper.py` como motor de scraping.

## Alcance Funcional (MVP Pro)
- Formulario principal con:
  - `TextField` multiline para ASINs (uno por linea o separados por coma/espacio).
  - Validacion de formato ASIN (10 caracteres alfanumericos, mayusculas).
  - Boton `Scrapear`.
  - Boton `Limpiar`.
- Proceso de scraping:
  - Endpoint POST `/api/scrape`.
  - Normaliza, deduplica y valida ASINs.
  - Ejecuta scraping via proceso Python (seguro y con timeout).
  - Devuelve JSON estructurado por ASIN con estado (`ok`, `error`, `not_found`).
- Vista de resultados:
  - KPIs (total, exitos, fallidos, duracion).
  - Tabla MUI con paginacion, ordenamiento y busqueda local.
  - Chip de estado por fila.
  - Boton `Descargar CSV`.

## UX/UI (nivel producto)
- Layout con `AppBar`, contenido centrado y `Container` responsivo.
- Tarjetas (`Card`) para secciones: Input, Estado del proceso, Resultados.
- Estados de interfaz:
  - `idle`: listo para ejecutar.
  - `loading`: progreso visible con `LinearProgress` y deshabilitar acciones invalidas.
  - `success`: resultados.
  - `error`: mensaje claro y accion de reintento.
- Accesibilidad:
  - Labels claros.
  - Contraste correcto.
  - Navegacion por teclado.

## Estructura sugerida
- `app/page.tsx` -> pantalla principal.
- `app/api/scrape/route.ts` -> endpoint de scraping.
- `components/asins/AsinInputCard.tsx`
- `components/asins/ScrapeStatusCard.tsx`
- `components/asins/ResultsTableCard.tsx`
- `lib/asins.ts` -> parseo/validacion/dedupe.
- `lib/csv.ts` -> exportacion CSV.
- `types/scrape.ts` -> contratos TS.

## Contrato de API
### Request
`POST /api/scrape`
```json
{
  "asins": ["B000000000", "B000000001"]
}
```

### Response
```json
{
  "meta": {
    "total": 2,
    "success": 1,
    "failed": 1,
    "durationMs": 1830
  },
  "items": [
    {
      "asin": "B000000000",
      "status": "ok",
      "title": "Producto ejemplo",
      "price": "$12.99",
      "rating": "4.5",
      "reviews": "132",
      "url": "https://www.amazon.com/dp/B000000000"
    },
    {
      "asin": "B000000001",
      "status": "error",
      "error": "Timeout"
    }
  ]
}
```

## Reglas de Implementacion
- No exponer logica sensible en cliente.
- Manejar errores por ASIN sin romper todo el batch.
- Limitar lote maximo inicial a 100 ASINs por request.
- Sanitizar input y evitar inyeccion en comandos del sistema.
- Mantener tipado estricto en frontend y backend.

## Criterios de Aceptacion
- El usuario puede pegar 1..100 ASINs y ejecutar scraping.
- La app muestra progreso y luego resultados sin recargar pagina.
- Hay resumen y tabla usable en mobile/desktop.
- Se puede exportar resultados a CSV.
- Si falla algun ASIN, se reporta en su fila con mensaje de error.
- Lint y build pasan sin errores.