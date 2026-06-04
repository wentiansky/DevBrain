import { Skeleton } from '@/components/ui/skeleton';

export default function ProtectedLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  );
}