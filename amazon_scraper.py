import argparse
import asyncio
import json
import random
import re
import sys
import time
import unicodedata
from typing import Any, Dict, List

from playwright.async_api import async_playwright

PRICE_REGEX = re.compile(r"\$\s?[\d,.]+")
ASIN_REGEX = re.compile(r"^[A-Z0-9]{10}$")


def log(message: str) -> None:
    print(f"[scraper] {message}", file=sys.stderr, flush=True)


def normalize_asins(asins: List[str]) -> List[str]:
    normalized: List[str] = []
    seen = set()

    for raw in asins:
        asin = str(raw or "").strip().upper()
        if not ASIN_REGEX.match(asin):
            continue
        if asin in seen:
            continue
        seen.add(asin)
        normalized.append(asin)

    return normalized


def normalize_text(value: str) -> str:
    if not value:
        return ""

    text = value.replace("\u00a0", " ").strip()

    if any(marker in text for marker in ("\u00c3", "\u00c2", "\u00e2")):
        try:
            text = text.encode("latin1").decode("utf-8")
        except UnicodeError:
            pass

    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()

    replacements = {
        "Amazon Jap n": "Amazon Japon",
        "Amazon Jap\ufffdn": "Amazon Japon",
        "Amazon Jap\u00c3\u00b3n": "Amazon Japon",
        "Amazon M xico": "Amazon Mexico",
        "Amazon M\ufffdxico": "Amazon Mexico",
        "Amazon M\u00c3\u00a9xico": "Amazon Mexico",
        "ENV\ufffdO": "ENVIO",
        "D\ufffdA": "DIA",
    }

    for wrong, right in replacements.items():
        text = text.replace(wrong, right)

    return text


def extract_price(text: str) -> str:
    if not text:
        return "N/A"

    found = PRICE_REGEX.search(text)
    if not found:
        return "N/A"

    return found.group(0).replace(" ", "").strip()


async def is_blocked_page(page: Any) -> bool:
    title = normalize_text(await page.title())
    if "robot" in title.lower() or "captcha" in title.lower():
        return True

    selectors = [
        "form[action*='validateCaptcha']",
        "input[name='field-keywords']",
        "#captchacharacters",
        "img[src*='captcha']",
    ]

    for selector in selectors:
        if await page.query_selector(selector):
            return True

    content = normalize_text(await page.content())
    lowered = content.lower()
    return "enter the characters" in lowered or "escribe los caracteres" in lowered


async def scrape_amazon_data(page: Any, asin: str) -> Dict[str, str]:
    data = {
        "Precio Tachado": "N/A",
        "Mejor Precio": "N/A",
        "Seller": "N/A",
        "Segundo mejor precio": "N/A",
        "Seller 2": "N/A",
        "Tercer mejor precio": "N/A",
        "Seller 3": "N/A",
    }

    url_dp = f"https://www.amazon.com.mx/dp/{asin}?th=1&psc=1"
    await page.goto(url_dp, wait_until="domcontentloaded", timeout=60000)
    await asyncio.sleep(random.uniform(1.2, 2.5))

    if await is_blocked_page(page):
        raise RuntimeError("Bloqueado por Amazon (captcha/robot check).")

    strike_el = await page.query_selector(
        "span.a-price.a-text-price span.a-offscreen, #basisPrice span.a-offscreen"
    )
    if strike_el:
        data["Precio Tachado"] = normalize_text(await strike_el.inner_text())

    # Fallback base price directly from product page
    base_price_el = await page.query_selector(
        "#price_inside_buybox, #priceblock_dealprice, #priceblock_ourprice, .a-price .a-offscreen"
    )
    if base_price_el:
        base_price = extract_price(normalize_text(await base_price_el.inner_text()))
        if base_price != "N/A":
            data["Mejor Precio"] = base_price
            data["Seller"] = "Amazon Mexico"

    offer_selectors = [
        "#olpLinkWidget_feature_div a",
        "#buybox-see-all-buying-choices a",
        "a[aria-label*='ofertas']",
    ]

    opened = False
    for selector in offer_selectors:
        link = await page.query_selector(selector)
        if link:
            await link.click()
            opened = True
            break

    if opened:
        try:
            await page.wait_for_selector("#aod-pinned-offer, .aod-offer", timeout=8000)
        except Exception:
            opened = False

    if not opened:
        await page.goto(
            f"https://www.amazon.com.mx/gp/offer-listing/{asin}/",
            wait_until="domcontentloaded",
            timeout=60000,
        )
        await asyncio.sleep(2)

    if await is_blocked_page(page):
        raise RuntimeError("Bloqueado por Amazon al abrir ofertas (captcha/robot check).")

    offers_found: List[Dict[str, str]] = []
    boxes = await page.query_selector_all("#aod-pinned-offer, .aod-offer, .olpOffer, #aod-offer")

    for box in boxes:
        text_box = normalize_text(await box.inner_text())
        price = extract_price(text_box)

        seller_el = await box.query_selector(".aod-seller-name, #aod-offer-soldBy a, .olpSellerName")
        seller = normalize_text(await seller_el.inner_text()) if seller_el else "Amazon Mexico"

        if price == "N/A":
            continue

        duplicate = any(existing["p"] == price and existing["s"] == seller for existing in offers_found)
        if duplicate:
            continue

        offers_found.append({"p": price, "s": seller})

    if len(offers_found) >= 1:
        data["Mejor Precio"] = offers_found[0]["p"]
        data["Seller"] = offers_found[0]["s"]

    if len(offers_found) >= 2:
        data["Segundo mejor precio"] = offers_found[1]["p"]
        data["Seller 2"] = offers_found[1]["s"]

    if len(offers_found) >= 3:
        data["Tercer mejor precio"] = offers_found[2]["p"]
        data["Seller 3"] = offers_found[2]["s"]

    return data


async def scrape_asins(asins: List[str], headless: bool = True) -> Dict[str, Any]:
    start = time.perf_counter()
    items: List[Dict[str, Any]] = []
    total = len(asins)

    log(f"Inicio scraping. total_asins={total} headless={headless}")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="es-MX",
            timezone_id="America/Mexico_City",
            extra_http_headers={
                "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
            },
        )
        page = await context.new_page()

        for index, asin in enumerate(asins, start=1):
            log(f"[{index}/{total}] ASIN={asin} estado=iniciando")
            try:
                result = await scrape_amazon_data(page, asin)
                best_price = result.get("Mejor Precio", "N/A")
                status = "ok" if best_price != "N/A" else "not_found"

                items.append(
                    {
                        "asin": asin,
                        "status": status,
                        "strikePrice": result.get("Precio Tachado"),
                        "bestPrice": result.get("Mejor Precio"),
                        "bestSeller": result.get("Seller"),
                        "secondBestPrice": result.get("Segundo mejor precio"),
                        "secondSeller": result.get("Seller 2"),
                        "thirdBestPrice": result.get("Tercer mejor precio"),
                        "thirdSeller": result.get("Seller 3"),
                    }
                )

                log(
                    f"[{index}/{total}] ASIN={asin} estado={status} "
                    f"seller1={result.get('Seller', 'N/A')}"
                )
            except Exception as error:  # noqa: BLE001
                error_text = normalize_text(str(error))
                items.append(
                    {
                        "asin": asin,
                        "status": "error",
                        "error": error_text,
                    }
                )
                log(f"[{index}/{total}] ASIN={asin} estado=error detalle={error_text}")

            await asyncio.sleep(random.uniform(1.5, 3.0))

        await browser.close()

    duration_ms = int((time.perf_counter() - start) * 1000)
    success = sum(item["status"] == "ok" for item in items)
    not_found = sum(item["status"] == "not_found" for item in items)
    failed = sum(item["status"] == "error" for item in items)

    log(
        "Fin scraping "
        f"total={len(items)} ok={success} not_found={not_found} error={failed} duration_ms={duration_ms}"
    )

    return {
        "meta": {
            "total": len(items),
            "success": success,
            "failed": failed,
            "notFound": not_found,
            "durationMs": duration_ms,
        },
        "items": items,
    }


def parse_stdin_payload() -> List[str]:
    raw = sys.stdin.read().strip()
    if not raw:
        return []

    payload = json.loads(raw)
    candidate_asins = payload.get("asins", [])
    if not isinstance(candidate_asins, list):
        return []

    return [str(value) for value in candidate_asins]


async def run_json_mode(headless: bool) -> None:
    asins = normalize_asins(parse_stdin_payload())
    log(f"Payload recibido. asins_validos={len(asins)}")
    response = await scrape_asins(asins, headless=headless)
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdin-json", action="store_true")
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    if args.stdin_json:
        asyncio.run(run_json_mode(headless=args.headless))
    else:
        print(
            "Este script ahora se consume desde Next.js en modo JSON. "
            "Usa: python amazon_scraper.py --stdin-json --headless"
        )