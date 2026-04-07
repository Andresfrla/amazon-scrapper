import asyncio
import re
import random
import pandas as pd
from playwright.async_api import async_playwright

async def get_price_regex(text):
    """Extrae el formato $XX,XXX.XX de un bloque de texto."""
    if not text: return "N/A"
    found = re.search(r'\$\s?[\d,.]+', text)
    if found:
        return found.group(0).replace(" ", "").strip()
    return "N/A"

async def scrape_amazon_data(page, asin: str) -> dict:
    # Ahora incluimos el tercer vendedor en la estructura
    datos = {
        "Precio Tachado": "N/A", 
        "Mejor Precio": "N/A", "Seller": "N/A",
        "Segundo mejor precio": "N/A", "Seller 2": "N/A",
        "Tercer mejor precio": "N/A", "Seller 3": "N/A"
    }

    try:
        # 1. NAVEGAR AL PRODUCTO
        url_dp = f"https://www.amazon.com.mx/dp/{asin}?th=1&psc=1"
        await page.goto(url_dp, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(random.uniform(2, 4))

        # PRECIO TACHADO
        tachado_el = await page.query_selector("span.a-price.a-text-price span.a-offscreen, #basisPrice span.a-offscreen")
        if tachado_el:
            datos["Precio Tachado"] = (await tachado_el.inner_text()).strip()

        # 2. ABRIR PANEL DE OFERTAS
        olp_selectors = ["#olpLinkWidget_feature_div a", "#buybox-see-all-buying-choices a", "a[aria-label*='ofertas']"]
        opened = False
        for selector in olp_selectors:
            link = await page.query_selector(selector)
            if link:
                await link.click()
                opened = True
                break
        
        if opened:
            try: await page.wait_for_selector("#aod-pinned-offer, .aod-offer", timeout=8000)
            except: opened = False

        if not opened:
            await page.goto(f"https://www.amazon.com.mx/gp/offer-listing/{asin}/", wait_until="domcontentloaded")
            await asyncio.sleep(3)

        # 3. EXTRACCIÓN DE LA LISTA DE OFERTAS
        ofertas_encontradas = []
        cajas = await page.query_selector_all("#aod-pinned-offer, .aod-offer, .olpOffer, #aod-offer")
        
        for caja in cajas:
            texto_caja = await caja.inner_text()
            p = await get_price_regex(texto_caja)
            
            s_el = await caja.query_selector(".aod-seller-name, #aod-offer-soldBy a, .olpSellerName")
            s = (await s_el.inner_text()).strip() if s_el else "Amazon México"
            
            if p != "N/A":
                # Evitar duplicados exactos (mismo precio y mismo seller)
                if not any(off['p'] == p and off['s'] == s for off in ofertas_encontradas):
                    ofertas_encontradas.append({"p": p, "s": s})

        # 4. ASIGNAR HASTA 3 VENDEDORES
        if len(ofertas_encontradas) >= 1:
            datos["Mejor Precio"] = ofertas_encontradas[0]["p"]
            datos["Seller"] = ofertas_encontradas[0]["s"]
        
        if len(ofertas_encontradas) >= 2:
            datos["Segundo mejor precio"] = ofertas_encontradas[1]["p"]
            datos["Seller 2"] = ofertas_encontradas[1]["s"]
            
        if len(ofertas_encontradas) >= 3:
            datos["Tercer mejor precio"] = ofertas_encontradas[2]["p"]
            datos["Seller 3"] = ofertas_encontradas[2]["s"]

    except Exception as e:
        print(f"   Error en ASIN {asin}: {e}")

    return datos

async def main():
    try:
        df = pd.read_excel("lista_asins.xlsx")
    except:
        print("Error: No se encontró lista_asins.xlsx")
        return

    # Definimos todas las columnas necesarias
    columnas_finales = [
        "ASIN", "Precio Tachado", 
        "Mejor Precio", "Seller", 
        "Segundo mejor precio", "Seller 2", 
        "Tercer mejor precio", "Seller 3"
    ]

    for col in columnas_finales:
        if col not in df.columns: df[col] = "N/A"
        df[col] = df[col].astype(str)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900}
        )
        page = await context.new_page()

        for index, row in df.iterrows():
            asin = str(row.get("ASIN", "")).strip()
            if len(asin) != 10: continue

            print(f"[{index+1}/{len(df)}] Scrapeando: {asin}")
            res = await scrape_amazon_data(page, asin)
            
            for key, val in res.items():
                df.at[index, key] = val

            # Guardar resultados
            df[columnas_finales].to_excel("resultado_final.xlsx", index=False)
            print(f"    -> 1: {res['Mejor Precio']} | 2: {res['Segundo mejor precio']} | 3: {res['Tercer mejor precio']}")
            
            await asyncio.sleep(random.uniform(5, 8))

        await browser.close()
        print("\n¡Hecho! Se han capturado hasta 3 vendedores por producto.")

if __name__ == "__main__":
    asyncio.run(main())