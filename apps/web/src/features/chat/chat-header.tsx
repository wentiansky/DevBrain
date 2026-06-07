import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
  kbName: string;
  statusSummary: string;
  onBack: () => void;
}

export function ChatHeader({ kbName, statusSummary, onBack }: ChatHeaderProps) {
  return (
    <div className="bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[800px] items-center gap-3 px-3 py-1.5 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 h-7 gap-1 px-2 text-xs"
          aria-label="返回知识库"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">返回</span>
        </Button>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-sm font-semibold">{kbName}</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {statusSummary}
          </p>
        </div>
      </div>
    </div>
  );
}
