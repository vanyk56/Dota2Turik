// [Phase: MVP v1] Design System Button Component (Section 12)
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-white shadow-accent-glow hover:bg-accent/90 active:scale-[0.99]',
        secondary:
          'glass-panel text-text hover:bg-white/[0.08] hover:border-white/[0.15]',
        outline:
          'border border-glass-border bg-transparent text-text hover:bg-white/[0.05]',
        danger:
          'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
        success:
          'bg-success/15 text-success border border-success/30 hover:bg-success/25',
        ghost:
          'text-text-muted hover:text-text hover:bg-white/[0.05]',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-sm',
        md: 'h-10 px-4 py-2 rounded-md',
        lg: 'h-11 px-6 text-base rounded-md',
        icon: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
