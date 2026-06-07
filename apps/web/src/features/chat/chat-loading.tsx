import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function ChatLoadingState() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-8 w-16" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <Skeleton className="h-48 w-full max-w-lg rounded-lg" />
      </div>
    </div>
  );
}

interface ChatNotFoundStateProps {
  onBack: () => void;
}

export function ChatNotFoundState({ onBack }: ChatNotFoundStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm text-destructive">知识库不存在或无权访问</p>
      <Button variant="outline" className="mt-4" onClick={onBack}>
        返回首页
      </Button>
    </div>
  );
}
