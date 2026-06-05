'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { validateRegister, type RegisterInput } from '@/lib/auth-schema';
import { authRegister } from '@/lib/api-fetch';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RegisterForm() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [values, setValues] = useState<RegisterInput>({ email: '', password: '' });

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  const handleChange =
    (field: keyof RegisterInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setServerError(null);
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateRegister(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setServerError(null);
    setIsSubmitting(true);
    try {
      await authRegister(values.email, values.password);
      toast.success('注册成功，欢迎使用 DevBrain');
      router.push('/');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '注册失败，请稍后重试';
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
            placeholder="至少 8 个字符"
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
          {isSubmitting ? '注册中...' : '注册'}
        </Button>
      </form>
    </>
  );
}