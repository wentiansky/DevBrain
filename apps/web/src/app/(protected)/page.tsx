'use client';

import { useAuthStore } from '@/stores/auth-store';

export default function ProtectedHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight">
        欢迎回来{user ? `，${user.email}` : ''}
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        上传你的文档，像聊天一样提问，获取带原文跳转引用的回答。
      </p>
      <div className="mt-8 rounded-lg border border-dashed p-12">
        <p className="text-sm text-muted-foreground">知识库功能即将上线</p>
      </div>
    </div>
  );
}