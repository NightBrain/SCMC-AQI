import { getSiteUrl } from '@/lib/metadata';
import { SITE_NAME, STATIC_DESCRIPTION } from '@/lib/seo';

// ข้อมูลโครงสร้าง schema.org ให้ search engine เข้าใจว่าหน้านี้คืออะไร
export default async function JsonLd({ path, type, name }: { path: string; type: 'WebSite' | 'WebPage'; name: string }) {
  const site = await getSiteUrl();
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': type,
    name,
    url: path === '/' ? site : site + path,
    inLanguage: 'th',
    description: STATIC_DESCRIPTION,
    isPartOf: type === 'WebPage' ? { '@type': 'WebSite', name: SITE_NAME, url: site } : undefined,
  }).replace(/</g, '\\u003c'); // กันปิด <script> จากค่าที่มาจาก header
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
