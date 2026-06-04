import { AuthPageShell } from '@/features/auth/auth-page-shell';
import { RegisterForm } from '@/features/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AuthPageShell
        title="注册 DevBrain"
        description="创建你的知识库账号"
        footerLink={{ text: '已有账号？', label: '立即登录', href: '/login' }}
      >
        <RegisterForm />
      </AuthPageShell>
    </div>
  );
}