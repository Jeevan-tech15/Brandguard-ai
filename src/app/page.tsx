'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { SystemStatusCard } from '@/components/dashboard/SystemStatusCard';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContentReview, DashboardMetrics } from '@/lib/types';
import { formatDate, formatContentTypeLabel } from '@/lib/utils';
import { FileCheck, Plus, ArrowRight, RefreshCw, Sparkles, Image as ImageIcon } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ContentReview[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalReviews: 0,
    approvedCount: 0,
    flaggedCount: 0,
    pendingCount: 0,
    averageComplianceScore: null,
    activeGuidelinesCount: 0,
    totalGuidelinesCount: 0,
    activeFactsCount: 0,
    totalFactsCount: 0,
  });
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        setIsConfigured(data.configured ?? false);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initData() {
      try {
        const res = await fetch('/api/reviews');
        if (res.ok && isMounted) {
          const data = await res.json();
          setReviews(data.reviews || []);
          if (data.metrics) setMetrics(data.metrics);
          setIsConfigured(data.configured ?? false);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Marketing Governance Dashboard"
        description="Continuous pre-publication brand governance monitoring against approved visual assets, active guidelines, and verified facts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDashboardData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-gray-500" />}
            >
              Refresh
            </Button>
            <Link href="/guidelines">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-700" />}
              >
                Brand Setup
              </Button>
            </Link>
            <Link href="/reviews/new">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4 stroke-[2.2]" />}
              >
                New Review
              </Button>
            </Link>
          </div>
        }
      />

      {/* Metrics Telemetry Grid */}
      <MetricsGrid metrics={metrics} isLoading={isLoading} />

      {/* System Infrastructure Card */}
      <SystemStatusCard
        dbConfigured={isConfigured}
        guidelinesCount={metrics.activeGuidelinesCount}
        factsCount={metrics.activeFactsCount}
      />

      {/* Recent Reviews Panel */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900">
              <FileCheck className="w-4 h-4 text-teal-800" />
              Recent Pre-Publication Reviews
            </CardTitle>
            <CardDescription>
              Latest creative marketing posts and campaigns submitted for governance validation
            </CardDescription>
          </div>

          {reviews.length > 0 && (
            <Link
              href="/reviews"
              className="text-xs text-teal-800 hover:text-teal-950 flex items-center gap-1 font-medium"
            >
              View all reviews
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </CardHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Loading governance reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="No Content Reviews Yet"
            description="The review registry is currently empty. Upload marketing post creatives or copy to execute automated brand compliance audits."
            actionLabel="Submit Creative for Review"
            actionHref="/reviews/new"
            secondaryActionLabel="Manage Brand Guidelines"
            onSecondaryActionClick={() => {
              router.push('/guidelines');
            }}
            hint="All submissions are evaluated against your active brand guidelines, verified facts, and official visual assets."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Creative / Post Title</th>
                  <th className="py-3 px-4 font-medium">Content Type</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Compliance</th>
                  <th className="py-3 px-4 font-medium">Submitted</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.slice(0, 6).map((review) => (
                  <tr
                    key={review.id}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">
                      <Link
                        href={`/reviews/${review.id}`}
                        className="hover:text-teal-800 flex items-center gap-2.5"
                      >
                        {review.image_url ? (
                          <div className="w-7 h-7 rounded border border-gray-200 overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={review.image_url}
                              alt={review.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded border border-gray-200 overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center text-gray-400">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span>{review.title}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {formatContentTypeLabel(review.content_type)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={review.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-mono">
                      {review.compliance_score !== null && review.compliance_score !== undefined
                        ? `${review.compliance_score}%`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {formatDate(review.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/reviews/${review.id}`}>
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
