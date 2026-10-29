import React from 'react';
import { Card } from '@/components/ui/Card';
import { FileCheck, ShieldAlert, CheckCircle, Percent } from 'lucide-react';
import { DashboardMetrics } from '@/lib/types';

interface MetricsGridProps {
  metrics: DashboardMetrics;
  isLoading?: boolean;
}

export function MetricsGrid({ metrics, isLoading }: MetricsGridProps) {
  const cards = [
    {
      title: 'Total Reviews',
      value: isLoading ? '...' : metrics.totalReviews.toString(),
      helper: metrics.totalReviews === 0 ? 'No submissions yet' : `${metrics.pendingCount} pending review`,
      icon: FileCheck,
      iconColor: 'text-teal-700',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
    },
    {
      title: 'Approved Content',
      value: isLoading ? '...' : metrics.approvedCount.toString(),
      helper:
        metrics.totalReviews === 0
          ? '0% approval rate'
          : `${Math.round((metrics.approvedCount / metrics.totalReviews) * 100)}% approval rate`,
      icon: CheckCircle,
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'Flagged / Violations',
      value: isLoading ? '...' : metrics.flaggedCount.toString(),
      helper: metrics.flaggedCount === 0 ? 'Zero active flags' : 'Requires revision',
      icon: ShieldAlert,
      iconColor: 'text-rose-700',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
    },
    {
      title: 'Avg Compliance Score',
      value:
        isLoading
          ? '...'
          : metrics.averageComplianceScore !== null
          ? `${metrics.averageComplianceScore}%`
          : '—',
      helper:
        metrics.averageComplianceScore !== null
          ? 'Across audited content'
          : 'Requires audited reviews',
      icon: Percent,
      iconColor: 'text-teal-800',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="relative overflow-hidden bg-white border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 tracking-wide uppercase">
                  {card.title}
                </p>
                <h4 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-1">
                  {card.value}
                </h4>
                <p className="text-xs text-gray-500 mt-1">{card.helper}</p>
              </div>

              <div
                className={`w-11 h-11 rounded-xl ${card.bgColor} ${card.borderColor} border flex items-center justify-center ${card.iconColor} shrink-0`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
