import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { AuthPageShell } from '@/features/auth/auth-page-shell';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

describe('AuthPageShell - 认证页外壳', () => {
  it('底部跳转链接关闭 Next.js 页面预取', () => {
    render(
      <AuthPageShell
        title="登录 DevBrain"
        description="输入邮箱和密码登录你的知识库"
        footerLink={{ text: '还没有账号？', label: '立即注册', href: '/register' }}
      >
        <form />
      </AuthPageShell>,
    );

    expect(screen.getByRole('link', { name: '立即注册' })).toHaveAttribute(
      'data-prefetch',
      'false',
    );
  });
});
