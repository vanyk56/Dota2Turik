'use client';

// Design system button. Submit buttons show a spinner and lock while their form action runs.
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-accent to-accent-deep text-white shadow-accent-glow hover:from-accent-light hover:to-accent',
        secondary:
          'bg-surface text-text border border-glass-border hover:border-accent/50 hover:bg-accent-soft',
        outline:
          'border border-glass-border bg-transparent text-text hover:bg-accent-soft hover:border-accent/50',
        danger:
          'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
        success:
          'bg-success/10 text-success border border-success/30 hover:bg-success/20',
        ghost: 'text-text-muted hover:text-text hover:bg-accent-soft',
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
  ({ className, variant, size, type, children, disabled, ...props }, ref) => {
    const { pending } = useFormStatus();
    const isSubmit = type === 'submit';
    const busy = isSubmit && pending;

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        disabled={disabled || busy}
        {...props}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
