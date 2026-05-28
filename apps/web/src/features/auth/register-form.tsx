'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { registerSchema, type RegisterInput } from '@/lib/auth-schema';
import { authRegister } from '@/lib/api-fetch';
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

export function RegisterForm() {
  const router = useRouter();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    disabled: !isInitialized,
  });

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  if (user) {
    return null;
  }

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    try {
      await authRegister(data.email, data.password);
      toast.success('注册成功，欢迎使用 DevBrain');
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败，请稍后重试';
      setServerError(message);
    }
  };

  return (
    <AuthFormShell
      title="注册 DevBrain"
      description="创建你的知识库账号"
      serverError={serverError}
      footerLink={{ text: '已有账号？', label: '立即登录', href: '/login' }}
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
                  <Input type="password" placeholder="至少 8 个字符" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '注册中...' : '注册'}
          </Button>
        </form>
      </Form>
    </AuthFormShell>
  );
}