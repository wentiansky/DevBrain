'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function KbDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex items-start justify-between gap-4 pb-6">
        <div className="space-y-3">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-96 rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function KbDetailLoadError({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm text-destructive">无法加载知识库，可能不存在或无权访问。</p>
      <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
        返回知识库列表
      </Button>
      <Button variant="ghost" className="mt-2" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

export function KbDetailNotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">知识库不存在</p>
      <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
        返回知识库列表
      </Button>
    </div>
  );
}
