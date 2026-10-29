import React from 'react';
import { cn, getStatusBadgeVariant } from '@/lib/utils';
import { ReviewStatus } from '@/lib/types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: ReviewStatus;
  variant?: 'cyan' | 'teal' | 'slate' | 'emerald' | 'amber' | 'rose' | 'custom';
  showDot?: boolean;
}

export function Badge({
  status,
  variant = 'slate',
  showDot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  if (status) {
    const meta = getStatusBadgeVariant(status);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
          meta.className,
          className
        )}
        {...props}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dotColor)} />
        {children || meta.label}
      </span>
    );
  }

  const variantStyles = {
    cyan: 'bg-teal-50 text-teal-800 border-teal-200',
    teal: 'bg-teal-50 text-teal-800 border-teal-200',
    slate: 'bg-gray-100 text-gray-700 border-gray-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    custom: '',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'cyan' && 'bg-teal-600',
            variant === 'teal' && 'bg-teal-600',
            variant === 'emerald' && 'bg-emerald-600',
            variant === 'amber' && 'bg-amber-600',
            variant === 'rose' && 'bg-rose-600',
            variant === 'slate' && 'bg-gray-400'
          )}
        />
      )}
      {children}
    </span>
  );
}
