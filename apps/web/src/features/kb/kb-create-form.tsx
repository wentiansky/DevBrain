'use client';

import { useState, type FormEvent } from 'react';
import type { CreateKbDto, KbResponse } from '@devbrain/api/client';
import { apiFetch } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateKbValues {
  name: string;
  description: string;
}

function validateKb(
  values: CreateKbValues,
): Partial<Record<keyof CreateKbValues, string>> {
  const errors: Partial<Record<keyof CreateKbValues, string>> = {};
  if (!values.name.trim()) {
    errors.name = 'KB 名称不能为空';
  } else if (values.name.length > 200) {
    errors.name = 'KB 名称最多 200 个字符';
  }
  if (values.description.length > 500) {
    errors.description = 'KB 描述最多 500 个字符';
  }
  return errors;
}

export function KbCreateForm({ onCreated }: { onCreated: (kb: KbResponse) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateKbValues, string>>>({});
  const [values, setValues] = useState<CreateKbValues>({ name: '', description: '' });

  const handleChange =
    (field: keyof CreateKbValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setServerError(null);
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateKb(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setServerError(null);
    setIsSubmitting(true);
    try {
      const body: CreateKbDto = {
        name: values.name,
        description: values.description || undefined,
      };
      const kb = await apiFetch<KbResponse>('/api/kbs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(kb);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '创建失败，请稍后重试';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="kb-name"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          KB 名称
        </label>
        <Input
          id="kb-name"
          placeholder="输入知识库名称"
          value={values.name}
          onChange={handleChange('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-[0.8rem] font-medium text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="kb-desc"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          描述（可选）
        </label>
        <Input
          id="kb-desc"
          placeholder="简要描述知识库用途"
          value={values.description}
          onChange={handleChange('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-[0.8rem] font-medium text-destructive">
            {errors.description}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? '创建中...' : '创建知识库'}
      </Button>
    </form>
  );
}