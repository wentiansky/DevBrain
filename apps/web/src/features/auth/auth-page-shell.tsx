import type { ReactNode } from 'react';
import Link from 'next/link';

export interface AuthPageShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footerLink: {
    text: string;
    label: string;
    href: string;
  };
}

export function AuthPageShell({
  title,
  description,
  children,
  footerLink,
}: AuthPageShellProps) {
  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {children}

      <p className="text-center text-sm text-muted-foreground">
        {footerLink.text}
        <Link
          href={footerLink.href}
          prefetch={false}
          className="ml-1 underline underline-offset-4 hover:text-primary"
        >
          {footerLink.label}
        </Link>
      </p>
    </div>
  );
}
