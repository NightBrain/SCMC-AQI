import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteUrl();
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${site}/sitemap.xml`,
  };
}
