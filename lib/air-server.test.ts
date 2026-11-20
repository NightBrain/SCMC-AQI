import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAirService } from './air-server';

const good = (aqi: number) => ({
  status: 'success',
  data: { aqi, temp: 28.3, timestamp: '20/11/2026 11:00:00', history: [] },
});

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

describe('createAirService', () => {
  let t = 0;
  const now = () => t;
  beforeEach(() => {
    t = 1_000_000;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('returns fresh payload and caches within ttl', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(good(22)));
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000 });
    const a = await svc.get();
    t += 299_000;
    const b = await svc.get();
    expect(a).toEqual({ payload: good(22), stale: false });
    expect(b).toEqual({ payload: good(22), stale: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('refetches after ttl expires', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(good(22)))
      .mockResolvedValueOnce(jsonResponse(good(30)));
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000 });
    await svc.get();
    t += 300_001;
    const r = await svc.get();
    expect(r?.payload.data.aqi).toBe(30);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('serves stale payload when upstream throws', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(good(22)))
      .mockRejectedValueOnce(new Error('network down'));
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000 });
    await svc.get();
    t += 400_000;
    const r = await svc.get();
    expect(r).toEqual({ payload: good(22), stale: true });
  });

  test('serves stale when upstream returns HTML or status!=="success", keeping the good cache', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(good(22)))
      .mockResolvedValueOnce(new Response('<html>502 Bad Gateway</html>', { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ status: 'error', data: null }))
      .mockResolvedValueOnce(new Response('oops', { status: 500 }));
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000 });
    await svc.get();
    for (let i = 0; i < 3; i++) {
      t += 400_000;
      const r = await svc.get();
      expect(r).toEqual({ payload: good(22), stale: true });
    }
  });

  test('returns null when upstream fails and there is no cache', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('down');
    });
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000 });
    expect(await svc.get()).toBeNull();
  });

  test('dedupes concurrent calls while refreshing', async () => {
    let resolve!: (r: Response) => void;
    const fetchFn = vi.fn(
      () => new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000 });
    const all = Promise.all([svc.get(), svc.get(), svc.get(), svc.get(), svc.get()]);
    resolve(jsonResponse(good(22)));
    const results = await all;
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.payload.data.aqi === 22)).toBe(true);
  });

  test('aborts after timeoutMs', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
        }),
    );
    const svc = createAirService({ fetchFn, now, ttlMs: 300_000, timeoutMs: 8000 });
    const p = svc.get();
    await vi.advanceTimersByTimeAsync(8001);
    expect(await p).toBeNull();
  });
});
