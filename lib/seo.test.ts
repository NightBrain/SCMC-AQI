import { describe, expect, it } from 'vitest';
import { buildDescription, resolveSiteUrl, STATIC_DESCRIPTION } from './seo';

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe('resolveSiteUrl', () => {
  it('prefers SITE_URL and strips trailing slashes', () => {
    expect(resolveSiteUrl('https://air.example.com//', h({ host: 'x:1' }))).toBe('https://air.example.com');
  });
  it('ignores a SITE_URL that is not http(s)', () => {
    expect(resolveSiteUrl('javascript:alert(1)', h({ host: 'a.b' }))).toBe('http://a.b');
    expect(resolveSiteUrl('air.example.com', h({ host: 'a.b' }))).toBe('http://a.b');
  });
  it('uses forwarded headers behind a reverse proxy', () => {
    expect(resolveSiteUrl(undefined, h({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'air.cmu.ac.th', host: 'app:3000' }))).toBe('https://air.cmu.ac.th');
  });
  it('takes the first value of a forwarded list', () => {
    expect(resolveSiteUrl(undefined, h({ 'x-forwarded-proto': 'https, http', 'x-forwarded-host': 'a.b, c.d' }))).toBe('https://a.b');
  });
  it('falls back to host, then localhost', () => {
    expect(resolveSiteUrl(undefined, h({ host: 'srv:6500' }))).toBe('http://srv:6500');
    expect(resolveSiteUrl(undefined, h({}))).toBe('http://localhost:3000');
  });
  it('rejects a host header with illegal characters', () => {
    expect(resolveSiteUrl(undefined, h({ host: 'a.b/"><script>' }))).toBe('http://localhost:3000');
  });
});

describe('buildDescription', () => {
  it('returns the static text when there is no data', () => {
    expect(buildDescription(null)).toBe(STATIC_DESCRIPTION);
  });
  it('includes AQI, level text and temperature', () => {
    const d = buildDescription({ aqi: 22, temp: 28.3 });
    expect(d).toContain('AQI 22');
    expect(d).toContain('อากาศดี');
    expect(d).toContain('28.3°C');
  });
  it('maps the level by value', () => {
    expect(buildDescription({ aqi: 160, temp: 30 })).toContain('มีผลต่อสุขภาพ');
  });
  it('rounds temperature to one decimal', () => {
    expect(buildDescription({ aqi: 22, temp: 30.11 })).toContain('30.1°C');
    expect(buildDescription({ aqi: 22, temp: '28.36' })).toContain('28.4°C');
  });
  it('omits temperature when it is not a number', () => {
    expect(buildDescription({ aqi: 22, temp: '-' })).not.toContain('°C');
  });
  it('falls back to static text when AQI is not a number', () => {
    expect(buildDescription({ aqi: '-', temp: 28 })).toBe(STATIC_DESCRIPTION);
  });
});
