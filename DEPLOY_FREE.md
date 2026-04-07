# Deploy gratis: Vercel + Render

## 1) Deploy del scraper en Render Free

Archivos usados:
- `render.yaml`
- `requirements-render.txt`
- `scraper_service/main.py`
- `amazon_scraper.py`

Pasos:
1. Sube este repo a GitHub.
2. En Render, crea un **New Web Service** desde este repo.
3. Render detecta `render.yaml` y usara:
   - build: `pip install -r requirements-render.txt && python -m playwright install chromium`
   - start: `uvicorn scraper_service.main:app --host 0.0.0.0 --port $PORT`
4. Espera deploy y copia URL final, ejemplo:
   - `https://amazon-scraper-api.onrender.com`
5. Prueba salud:
   - `GET /health`

## 2) Deploy del frontend en Vercel

1. Importa el mismo repo en Vercel.
2. En **Environment Variables** agrega:
   - `SCRAPER_API_URL=https://amazon-scraper-api.onrender.com`
3. Deploy.

## 3) Flujo final

- Navegador -> Vercel Next.js
- Next API (`/api/scrape`) -> Render (`/scrape`)
- Render corre Playwright + scraping y devuelve JSON
- Next muestra tabla y exporta Excel

## Notas

- En local, si no defines `SCRAPER_API_URL`, el backend usa fallback local con Python.
- En Vercel, define siempre `SCRAPER_API_URL` para evitar dependencia local de Python.