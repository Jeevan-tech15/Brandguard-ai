import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionClick?: () => void;
  className?: string;
  hint?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onActionClick,
  secondaryActionLabel,
  onSecondaryActionClick,
  className,
  hint,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl bg-gray-50/60 border border-gray-200 border-dashed',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-teal-700 shadow-xs mb-3.5">
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mt-1 mb-6 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionHref ? (
              <a href={actionHref}>
                <Button variant="primary" size="md">
                  {actionLabel}
                </Button>
              </a>
            ) : (
              <Button variant="primary" size="md" onClick={onActionClick}>
                {actionLabel}
              </Button>
            )
          )}

          {secondaryActionLabel && (
            <Button
              variant="secondary"
              size="md"
              onClick={onSecondaryActionClick}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}

      {hint && (
        <p className="text-xs text-gray-400 mt-5 border-t border-gray-200 pt-3 max-w-sm">
          {hint}
        </p>
      )}
    </div>
  );
}
