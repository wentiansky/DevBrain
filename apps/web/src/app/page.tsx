import { UserStatus } from './user-status';

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-6 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          DevBrain
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          程序员的第二大脑 — 上传文档，像聊天一样提问，带原文跳转引用。
        </p>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          API: {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}
        </span>
        <UserStatus />
      </main>
    </div>
  );
}
