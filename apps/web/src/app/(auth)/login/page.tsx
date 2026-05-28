import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}