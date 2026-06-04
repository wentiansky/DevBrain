import { AuthRootPage } from '@/components/auth-root-page';

export default function RootPage() {
  const t0 = Date.now();
  const result = <AuthRootPage />;
  const t1 = Date.now();
  console.log(`[SSR-TIMING] RootPage render: ${t1 - t0}ms`);
  return result;
}