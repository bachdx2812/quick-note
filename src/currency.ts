// Inline currency conversion: "100000 jpy = usd", "100 usd to vnd", "5 eur in gbp".
// Uses the free, key-less open.er-api.com endpoint (CORS-enabled, ~daily refresh).

export interface CurrencyQuery {
  amount: number;
  from: string;
  to: string;
}

const QUERY_RE =
  /^\s*([\d][\d.,]*)\s*([a-zA-Z]{3})\s*(?:=|to|in|->|→)\s*([a-zA-Z]{3})\s*$/;

export function parseCurrencyQuery(text: string): CurrencyQuery | null {
  const match = QUERY_RE.exec(text);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(/,/g, ""));
  if (!isFinite(amount)) return null;
  return { amount, from: match[2].toUpperCase(), to: match[3].toUpperCase() };
}

interface RateCache {
  rates: Record<string, number>;
  ts: number;
}

const cache = new Map<string, RateCache>();
const TTL_MS = 10 * 60 * 1000;

async function ratesFor(base: string): Promise<Record<string, number> | null> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.rates;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) return null;
    cache.set(base, { rates: data.rates, ts: Date.now() });
    return data.rates;
  } catch {
    return null;
  }
}

export async function convert(q: CurrencyQuery): Promise<number | null> {
  const rates = await ratesFor(q.from);
  const rate = rates?.[q.to];
  return rate == null ? null : q.amount * rate;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n);
}
