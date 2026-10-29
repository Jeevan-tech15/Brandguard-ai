import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-200 mb-6',
        className
      )}
    >
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 sm:self-center shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
