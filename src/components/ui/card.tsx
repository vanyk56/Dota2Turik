// [Phase: MVP v1] Glassmorphism Card Component (Section 12)
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function Card({ className, active, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'glass-panel rounded-lg p-5 transition-all duration-150 ease-out',
        active && 'border-accent shadow-accent-glow bg-accent-soft',
        className,
      )}
      {...props}
    />
  );
}
