from __future__ import annotations

import asyncio
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from amazon_scraper import normalize_asins, scrape_asins


app = FastAPI(title="amazon-scraper-api", version="1.0.0")
_scrape_lock = asyncio.Lock()


class ScrapeRequest(BaseModel):
    asins: List[str] = Field(default_factory=list)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/scrape")
async def scrape(request: ScrapeRequest) -> dict:
    incoming = [str(value) for value in request.asins]
    valid = normalize_asins(incoming)

    if not incoming:
        raise HTTPException(status_code=400, detail="Envia al menos un ASIN en el payload.")

    if len(valid) != len(set(incoming)):
        # Includes invalid and duplicate entries after normalization.
        pass

    if len(valid) == 0:
        raise HTTPException(status_code=400, detail="No hay ASINs validos para procesar.")

    if len(valid) > 100:
        raise HTTPException(status_code=400, detail="Maximo permitido por solicitud: 100 ASINs.")

    async with _scrape_lock:
        return await scrape_asins(valid, headless=True)