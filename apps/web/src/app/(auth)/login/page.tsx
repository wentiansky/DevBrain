import { Suspense } from 'react';
import { AuthPageShell } from '@/features/auth/auth-page-shell';
import { LoginForm } from '@/features/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';

function LoginFormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Suspense
        fallback={
          <AuthPageShell
            title="登录 DevBrain"
            description="输入邮箱和密码登录你的知识库"
            footerLink={{ text: '还没有账号？', label: '立即注册', href: '/register' }}
          >
            <LoginFormSkeleton />
          </AuthPageShell>
        }
      >
        <AuthPageShell
          title="登录 DevBrain"
          description="输入邮箱和密码登录你的知识库"
          footerLink={{ text: '还没有账号·？', label: '立即注册', href: '/register' }}
        >
          <LoginForm />
        </AuthPageShell>
      </Suspense>
    </div>
  );
}
