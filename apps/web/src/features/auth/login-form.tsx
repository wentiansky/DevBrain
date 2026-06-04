'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { validateLogin, type LoginInput } from '@/lib/auth-schema';
import { authLogin } from '@/lib/api-fetch';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

function toSafeNext(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.startsWith('/login') || next.startsWith('/register')) return '/';
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [values, setValues] = useState<LoginInput>({ email: '', password: '' });

  useEffect(() => {
    if (user) {
      const safeNext = toSafeNext(searchParams.get('next'));
      router.replace(safeNext);
    }
  }, [user, router, searchParams]);

  const handleChange =
    (field: keyof LoginInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setServerError(null);
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateLogin(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setServerError(null);
    setIsSubmitting(true);
    try {
      await authLogin(values.email, values.password);
      toast.success('登录成功');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '登录失败，请稍后重试';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            邮箱
          </label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={values.email}
            onChange={handleChange('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-[0.8rem] font-medium text-destructive">
              {errors.email}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            密码
          </label>
          <Input
            id="password"
            type="password"
            placeholder="输入密码"
            value={values.password}
            onChange={handleChange('password')}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="text-[0.8rem] font-medium text-destructive">
              {errors.password}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? '登录中...' : '登录'}
        </Button>
      </form>
    </>
  );
}