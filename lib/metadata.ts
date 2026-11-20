import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getAirSnapshot } from './air-service';
import { buildDescription, resolveSiteUrl, SITE_NAME } from './seo';

export async function getSiteUrl(): Promise<string> {
  return resolveSiteUrl(process.env.SITE_URL, await headers());
}

// metadata ของแต่ละหน้า (title, description พร้อมค่า AQI ล่าสุด, canonical, Open Graph, Twitter)
export async function buildPageMetadata(path: string, title: string): Promise<Metadata> {
  const site = await getSiteUrl();
  const description = buildDescription(await getAirSnapshot());
  const url = path === '/' ? site : site + path;
  return {
    metadataBase: new URL(site),
    title,
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    icons: { icon: '/favicon.png' },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'th_TH', title, description, url },
    twitter: { card: 'summary', title, description },
  };
}
