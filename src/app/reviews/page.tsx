'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContentReview } from '@/lib/types';
import { formatDate, formatContentTypeLabel } from '@/lib/utils';
import {
  History,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';

export default function ReviewHistoryPage() {
  const [reviews, setReviews] = useState<ContentReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initReviews() {
      try {
        const res = await fetch('/api/reviews');
        if (res.ok && isMounted) {
          const data = await res.json();
          setReviews(data.reviews || []);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.content_text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
    const matchesType = selectedType === 'all' || r.content_type === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Marketing Review History"
        description="Immutable audit trail of creative marketing posts evaluated for brand voice, claims verification, and visual identity standards in persistent audit storage."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadReviews}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-gray-500" />}
            >
              Refresh
            </Button>
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

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by creative title, campaign, or copy excerpt..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3.5 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-teal-700"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
          </select>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-teal-700"
          >
            <option value="all">All Content Types</option>
            <option value="social_media">Social Post (Instagram/LinkedIn)</option>
            <option value="email_marketing">Email Marketing</option>
            <option value="ad_copy">Advertising Creative</option>
            <option value="press_release">Press Release</option>
            <option value="blog_post">Blog Post</option>
            <option value="website_copy">Landing Page Graphic</option>
            <option value="other">Other Asset</option>
          </select>
        </div>
      </div>

      {/* Main Reviews Container */}
      <Card>
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Loading review history from database...</p>
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={History}
            title="No Review History Found"
            description="No marketing reviews have been submitted yet. Every creative post submitted through BrandGuard AI will be logged here with its audit trail, detected findings, and version history."
            actionLabel="Submit Content for Review"
            actionHref="/reviews/new"
            hint="Reviews are persistently stored in your audit data storage 'content_reviews' table."
          />
        ) : filteredReviews.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className="text-sm">No reviews match your search or filter criteria.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-teal-800"
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('all');
                setSelectedType('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Creative Title</th>
                  <th className="py-3 px-4 font-medium">Content Type</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Compliance</th>
                  <th className="py-3 px-4 font-medium">Findings</th>
                  <th className="py-3 px-4 font-medium">Decisions</th>
                  <th className="py-3 px-4 font-medium">Submitted</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReviews.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-gray-900">
                      <Link href={`/reviews/${r.id}`} className="hover:text-teal-800 flex items-center gap-2.5">
                        {r.image_url ? (
                          <div className="w-7 h-7 rounded border border-gray-200 overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={r.image_url}
                              alt={r.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded border border-gray-200 overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center text-gray-400">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span>{r.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 font-mono">
                          v{r.review_version || 1}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {formatContentTypeLabel(r.content_type)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={r.status} />
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 font-mono">
                      {r.compliance_score !== null && r.compliance_score !== undefined
                        ? `${r.compliance_score}%`
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {r.findings && r.findings.length > 0 ? (
                        <span className="text-rose-700 font-medium">
                          {r.findings.length} findings
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {r.decisions && r.decisions.length > 0 ? (
                        <span className="text-teal-800 font-medium">
                          {r.decisions.length} recorded
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">{formatDate(r.created_at)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/reviews/${r.id}`}>
                        <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
                          View
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
