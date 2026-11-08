// Surface card. With `href`, the whole card is a link; inner controls need `relative z-10`.
import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  href?: string;
}

export function Card({ className, active, href, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'glass-panel relative rounded-lg p-5 transition-colors duration-150',
        href && 'card-link',
        active && 'border-accent bg-accent-soft',
        className,
      )}
      {...props}
    >
      {href && (
        <Link
          href={href}
          aria-label="Открыть"
          className="absolute inset-0 z-0 rounded-lg"
        />
      )}
      {children}
    </div>
  );
}
