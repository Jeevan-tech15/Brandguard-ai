import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'interactive';
}

export function Card({
  className,
  variant = 'default',
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-white border border-gray-200 shadow-xs',
    subtle: 'bg-gray-50/70 border border-gray-200',
    interactive:
      'bg-white border border-gray-200 hover:border-teal-700/40 hover:bg-teal-50/20 transition-all cursor-pointer shadow-xs',
  };

  return (
    <div
      className={cn('rounded-xl p-5 text-gray-900', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between pb-3.5 border-b border-gray-100 mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-gray-900 tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-gray-500 mt-0.5', className)} {...props}>
      {children}
    </p>
  );
}
