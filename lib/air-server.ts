export type AirData = {
  aqi: number | string;
  temp: number | string;
  timestamp: string;
  history?: unknown[];
  [k: string]: unknown;
};

export type AirPayload = { status: 'success'; data: AirData };

export type AirResult = { payload: AirPayload; stale: boolean };

export type AirServiceOptions = {
  fetchFn?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
  url?: string;
};

export const UPSTREAM_URL = 'https://dashboard.acair.cmu.ac.th/api/data?reslution=';

function isValidPayload(x: unknown): x is AirPayload {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as { status?: unknown; data?: unknown };
  if (p.status !== 'success') return false;
  if (typeof p.data !== 'object' || p.data === null) return false;
  return (p.data as { aqi?: unknown }).aqi !== undefined;
}

export function createAirService(opts: AirServiceOptions = {}) {
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const url = opts.url ?? UPSTREAM_URL;

  let cache: { at: number; payload: AirPayload } | null = null;
  let inflight: Promise<AirPayload | null> | null = null;

  async function fetchUpstream(): Promise<AirPayload | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) return null;
      const json: unknown = JSON.parse(await res.text());
      return isValidPayload(json) ? json : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function get(): Promise<AirResult | null> {
    if (cache && now() - cache.at < ttlMs) {
      return { payload: cache.payload, stale: false };
    }
    if (!inflight) {
      inflight = fetchUpstream().finally(() => {
        inflight = null;
      });
    }
    const fresh = await inflight;
    if (fresh) {
      cache = { at: now(), payload: fresh };
      return { payload: fresh, stale: false };
    }
    return cache ? { payload: cache.payload, stale: true } : null;
  }

  return { get };
}
