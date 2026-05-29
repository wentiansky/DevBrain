'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateKbDto, KbResponse } from '@devbrain/api/client';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const createKbSchema = z.object({
  name: z.string().min(1, 'KB 名称不能为空').max(200, 'KB 名称最多 200 个字符'),
  description: z.string().max(500, 'KB 描述最多 500 个字符').optional().or(z.literal('')),
});

type CreateKbFormValues = z.infer<typeof createKbSchema>;

export function KbCreateForm({ onCreated }: { onCreated: (kb: KbResponse) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateKbFormValues>({
    resolver: zodResolver(createKbSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data: CreateKbFormValues) => {
    setServerError(null);
    try {
      const body: CreateKbDto = {
        name: data.name,
        description: data.description || undefined,
      };
      const kb = await apiFetch<KbResponse>('/api/kbs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(kb);
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败，请稍后重试';
      setServerError(message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>KB 名称</FormLabel>
              <FormControl>
                <Input placeholder="输入知识库名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>描述（可选）</FormLabel>
              <FormControl>
                <Input placeholder="简要描述知识库用途" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? '创建中...' : '创建知识库'}
        </Button>
      </form>
    </Form>
  );
}