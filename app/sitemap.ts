import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteUrl();
  return [
    { url: site, changeFrequency: 'hourly', priority: 1 },
    { url: `${site}/detail`, changeFrequency: 'hourly', priority: 0.8 },
  ];
}
