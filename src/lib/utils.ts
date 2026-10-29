import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ReviewStatus, ContentType, RuleSeverity, ReviewDecisionType } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatContentTypeLabel(contentType: ContentType | string): string {
  const map: Record<string, string> = {
    social_media: 'Social Post (Instagram/LinkedIn)',
    email_marketing: 'Email Marketing',
    ad_copy: 'Advertising Banner/Creative',
    press_release: 'Press Release',
    blog_post: 'Blog Article',
    website_copy: 'Landing Page Graphic',
    other: 'Other Marketing Asset',
  };
  return map[contentType] || contentType;
}

export function formatRuleTypeLabel(ruleType: string): string {
  const map: Record<string, string> = {
    voice_and_tone: 'Voice & Tone',
    prohibited_claim: 'Prohibited Claim',
    required_disclaimer: 'Required Disclaimer',
    brand_safety: 'Brand Safety',
    style_grammar: 'Style & Grammar',
    product_claim: 'Product Claim',
    logo_integrity: 'Logo Integrity',
    color_palette: 'Color Palette',
    aspect_ratio: 'Aspect Ratio & Layout',
  };
  return map[ruleType] || ruleType.replace(/_/g, ' ');
}

export function getSeverityBadge(severity: RuleSeverity): {
  label: string;
  className: string;
} {
  switch (severity) {
    case 'critical':
      return {
        label: 'Critical',
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    case 'high':
      return {
        label: 'High',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'medium':
      return {
        label: 'Medium',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'low':
    default:
      return {
        label: 'Low',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
      };
  }
}

export function getStatusBadgeVariant(status: ReviewStatus): {
  label: string;
  className: string;
  dotColor: string;
} {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotColor: 'bg-emerald-600',
      };
    case 'flagged':
      return {
        label: 'Flagged',
        className: 'bg-rose-50 text-rose-800 border-rose-200',
        dotColor: 'bg-rose-600',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-red-50 text-red-800 border-red-200',
        dotColor: 'bg-red-600',
      };
    case 'changes_requested':
      return {
        label: 'Changes Requested',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
        dotColor: 'bg-amber-600',
      };
    case 'draft':
      return {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
        dotColor: 'bg-gray-400',
      };
    case 'in_review':
      return {
        label: 'Under Review',
        className: 'bg-teal-50 text-teal-800 border-teal-200',
        dotColor: 'bg-teal-600',
      };
    case 'pending':
    default:
      return {
        label: 'Pending Review',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
        dotColor: 'bg-gray-400',
      };
  }
}

export function getDecisionBadge(decision: ReviewDecisionType): {
  label: string;
  className: string;
} {
  switch (decision) {
    case 'approved':
      return {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'flagged':
      return {
        label: 'Flagged',
        className: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-red-50 text-red-800 border-red-200',
      };
    case 'changes_requested':
      return {
        label: 'Changes Requested',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      };
  }
}
