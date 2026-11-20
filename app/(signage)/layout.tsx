import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './signage.css';

const prompt = Prompt({
  weight: ['400', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-prompt',
});

export const metadata: Metadata = {
  title: 'SCMC - Air Quality',
  icons: { icon: '/favicon.png' },
};

export default function SignageLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
