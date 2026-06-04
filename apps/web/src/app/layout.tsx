import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from '@/providers';
import { WebVitals } from '@/components/web-vitals-client';
import './globals.css';

export const metadata: Metadata = {
  title: 'DevBrain',
  description: '程序员的第二大脑 — self-hostable RAG 知识库',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script
          id="auth-prefetch"
          strategy="beforeInteractive"
        >{`window.__AUTH_PREFETCH__=fetch('/auth/refresh',{method:'POST',credentials:'include',headers:{'x-skip-refresh':'1'}}).then(function(r){return r.ok?r.json():null}).catch(function(){return null});`}</Script>
        <Providers>{children}</Providers>
        <WebVitals />
      </body>
    </html>
  );
}