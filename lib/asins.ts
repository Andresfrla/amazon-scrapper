const ASIN_REGEX = /^[A-Z0-9]{10}$/;

export function parseRawAsins(raw: string): string[] {
  return raw
    .split(/[\s,;|]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

export function uniqueAsins(asins: string[]): string[] {
  return Array.from(new Set(asins));
}

export function isValidAsin(asin: string): boolean {
  return ASIN_REGEX.test(asin);
}

export function splitValidAndInvalid(asins: string[]): {
  valid: string[];
  invalid: string[];
} {
  const deduped = uniqueAsins(asins);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const asin of deduped) {
    if (isValidAsin(asin)) {
      valid.push(asin);
    } else {
      invalid.push(asin);
    }
  }

  return { valid, invalid };
}