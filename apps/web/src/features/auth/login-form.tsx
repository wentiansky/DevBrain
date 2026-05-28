'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { loginSchema, type LoginInput } from '@/lib/auth-schema';
import { authLogin } from '@/lib/api-fetch';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AuthFormShell } from './auth-form-shell';

function toSafeNext(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.startsWith('/login') || next.startsWith('/register')) return '/';
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    disabled: !isInitialized,
  });

  useEffect(() => {
    if (user) {
      const next = toSafeNext(searchParams.get('next'));
      router.replace(next);
    }
  }, [user, searchParams, router]);

  if (user) {
    return null;
  }

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      await authLogin(data.email, data.password);
      toast.success('登录成功');
      const next = toSafeNext(searchParams.get('next'));
      router.push(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败，请稍后重试';
      setServerError(message);
    }
  };

  return (
    <AuthFormShell
      title="登录 DevBrain"
      description="输入邮箱和密码登录你的知识库"
      serverError={serverError}
      footerLink={{ text: '还没有账号？', label: '立即注册', href: '/register' }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>邮箱</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="输入密码" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '登录中...' : '登录'}
          </Button>
        </form>
      </Form>
    </AuthFormShell>
  );
}