import type { Metadata } from 'next';
import { Providers } from '@/providers';
import { WebVitals } from '@/components/web-vitals-client';
import './globals.css';

export const metadata: Metadata = {
  title: 'DevBrain',
  description: '程序员的第二大脑 — self-hostable RAG 知识库',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t0 = Date.now();
  const result = (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <WebVitals />
      </body>
    </html>
  );
  const t1 = Date.now();
  console.log(`[SSR-TIMING] RootLayout render: ${t1 - t0}ms`);
  return result;
}