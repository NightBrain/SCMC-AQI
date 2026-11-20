import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import './signage.css';

const prompt = Prompt({
  weight: ['400', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-prompt',
});

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata('/', 'คุณภาพอากาศวันนี้ (AQI) | SCMC Air Quality');
}

export default function SignageLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <body>
        <JsonLd path="/" type="WebSite" name="SCMC Air Quality" />
        {children}
      </body>
    </html>
  );
}
