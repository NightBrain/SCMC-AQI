import type { Metadata, Viewport } from 'next';
import { Prompt } from 'next/font/google';
import '@fortawesome/fontawesome-free/css/all.min.css';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import './detail/detail.css';

const prompt = Prompt({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-prompt',
});

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata('/detail', 'รายละเอียดคุณภาพอากาศ PM2.5 AQI อุณหภูมิ | SCMC Air Quality');
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// ตั้งธีมก่อนวาดหน้า กันภาพกะพริบ (ค่าเริ่มต้น = มืด)
const THEME_INIT = `
try {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('scmc-theme') === 'light' ? 'light' : 'dark');
} catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
`;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <JsonLd path="/detail" type="WebPage" name="รายละเอียดคุณภาพอากาศ SCMC Air Quality" />
        {children}
      </body>
    </html>
  );
}
