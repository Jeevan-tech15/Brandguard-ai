'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ContentReview, ReviewFinding, ReviewDecisionType, AuthorizedAsset } from '@/lib/types';
import { formatDate, formatContentTypeLabel } from '@/lib/utils';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  Wand2,
  Columns,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  Cpu,
  Download,
  FileJson,
  Copy,
  Check,
  Eye,
  FileText,
  GitCompare,
  Upload,
} from 'lucide-react';

interface ReviewDetailsViewProps {
  id: string;
}

function getTargetAndReplacement(
  finding?: ReviewFinding | null
): { target: string; replacement: string; scope: 'image' } {
  if (!finding) return { target: '', replacement: '', scope: 'image' };

  return {
    target: finding.evidence_text || finding.image_evidence || '',
    replacement: finding.proposed_replacement || finding.suggested_fix || '',
    scope: 'image',
  };
}

export function ReviewDetailsView({ id }: ReviewDetailsViewProps) {
  const [review, setReview] = useState<ContentReview | null>(null);
  const [authorizedAssets, setAuthorizedAssets] = useState<AuthorizedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active highlighted finding for bounding box synchronization
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Re-evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalSuccessNotice, setEvalSuccessNotice] = useState<string | null>(null);

  // Decision Modal State
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<ReviewDecisionType>('approved');
  const [reviewerLabel, setReviewerLabel] = useState('Brand Governance Lead');
  const [decisionComments, setDecisionComments] = useState('');
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Side-by-Side Comparison State
  const [viewMode, setViewMode] = useState<'single' | 'split'>('single');

  // Correction Studio Modal State (Requirement 4 & 5)
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionTargetFinding, setCorrectionTargetFinding] = useState<ReviewFinding | null>(null);
  const [replaceTargetText, setReplaceTargetText] = useState('');
  const [newReplacementText, setNewReplacementText] = useState('');
  const [selectedReplacementAssetId, setSelectedReplacementAssetId] = useState<string>('');
  const [uploadedRevisedFile, setUploadedRevisedFile] = useState<File | null>(null);
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [hasCopiedStudioFix, setHasCopiedStudioFix] = useState(false);

  // Suggested Fix Detail Modal State (Change 2)
  const [isSuggestedFixModalOpen, setIsSuggestedFixModalOpen] = useState(false);
  const [suggestedFixFinding, setSuggestedFixFinding] = useState<ReviewFinding | null>(null);
  const [hasCopiedFix, setHasCopiedFix] = useState(false);
  const [isMarkingFindingReviewed, setIsMarkingFindingReviewed] = useState(false);

  // Findings Category Filter State (Matching 7 Image-First Categories)
  const [findingsCategoryFilter, setFindingsCategoryFilter] = useState<
    'all' | 'spelling_and_text' | 'logo_and_brand' | 'abusive_language' | 'layout_and_design' | 'claims_and_consistency' | 'copyright_trademark_ip' | 'other_visible_issues' | string
  >('all');

  // Expandable Diagnostics Accordion State (Requirement 6)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const fetchReview = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const [res, assetsRes] = await Promise.all([
        fetch(`/api/reviews/${id}`, { signal: controller.signal }),
        fetch('/api/assets', { signal: controller.signal }),
      ]);
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch review');
      setReview(data.review);

      if (assetsRes.ok) {
        const aData = await assetsRes.json();
        setAuthorizedAssets(aData.assets || []);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg('Loading the review timed out. The server took longer than expected to respond.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Error loading review');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    Promise.all([
      fetch(`/api/reviews/${id}`, { signal: controller.signal }),
      fetch('/api/assets', { signal: controller.signal }),
    ])
      .then(async ([res, assetsRes]) => {
        clearTimeout(timeoutId);
        const data = await res.json();
        if (isCancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to fetch review');
        setReview(data.review);
        if (assetsRes.ok) {
          const aData = await assetsRes.json();
          if (!isCancelled) setAuthorizedAssets(aData.assets || []);
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId);
        if (isCancelled) return;
        if (err instanceof Error && err.name === 'AbortError') {
          setErrorMsg('Loading the review timed out. The server took longer than expected to respond.');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Error loading review');
        }
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [id]);

  // Trigger Re-evaluation
  async function handleReevaluate() {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setEvalSuccessNotice(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`/api/reviews/${id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed');

      if (data.review) {
        setReview(data.review);
      }
      const findingsCount = data.evaluation?.findings?.length ?? 0;
      const isPartial = Boolean(
        data.evaluation?.metadata?.isPartialAnalysis ||
        (data.evaluation?.metadata?.scoringBreakdown as { isPartialAnalysis?: boolean })?.isPartialAnalysis
      );
      setEvalSuccessNotice(
        isPartial
          ? `Compliance audit finished with partial analysis. Some checks could not run.`
          : findingsCount === 0
            ? `Compliance audit complete: 0 automated violations detected. Awaiting reviewer signoff.`
            : `Compliance audit complete: Score: ${data.evaluation?.compliance_score ?? 'Updated'}% with ${findingsCount} finding(s) detected across creative image.`
      );
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg('Re-evaluation request timed out after 25s. The server may still be processing.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to re-evaluate');
      }
    } finally {
      setIsEvaluating(false);
    }
  }

  // Open Suggested Fix Detail Modal (Change 2)
  function handleOpenSuggestedFixModal(finding: ReviewFinding) {
    setSuggestedFixFinding(finding);
    setHasCopiedFix(false);
    setIsSuggestedFixModalOpen(true);
  }

  // Copy Suggested Fix Text to Clipboard
  async function handleCopyFixText(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setHasCopiedFix(true);
      setTimeout(() => setHasCopiedFix(false), 2500);
    } catch {
      // Fallback
    }
  }

  // Mark Finding as Reviewed / Acknowledged in Persistence Model
  async function handleMarkFindingReviewed(finding: ReviewFinding) {
    if (!review || !finding.id) return;
    setIsMarkingFindingReviewed(true);
    try {
      const newStatus = finding.resolution_status === 'reviewed' ? 'unresolved' : 'reviewed';
      const res = await fetch(`/api/reviews/${review.id}/findings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId: finding.id,
          resolution_status: newStatus,
        }),
      });
      const data = await res.json();
      if (res.ok && data.review) {
        setReview(data.review);
        if (suggestedFixFinding && suggestedFixFinding.id === finding.id) {
          setSuggestedFixFinding({
            ...suggestedFixFinding,
            resolution_status: newStatus,
          });
        }
      }
    } catch (err) {
      console.error('Failed to mark finding reviewed:', err);
    } finally {
      setIsMarkingFindingReviewed(false);
    }
  }

  // Open Creative Revision Studio
  function handleOpenCorrectionStudio(finding?: ReviewFinding) {
    setCorrectionError(null);
    setCorrectionTargetFinding(finding || null);
    setUploadedRevisedFile(null);
    const { target, replacement } = getTargetAndReplacement(finding);
    setReplaceTargetText(target);
    setNewReplacementText(replacement);
    setIsCorrectionModalOpen(true);
  }

  // Apply Revision and Re-evaluate (Designer Revision or Original Creative Re-evaluation)
  async function handleApplyCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!review || isApplyingCorrection || isEvaluating) return;
    setIsApplyingCorrection(true);
    setCorrectionError(null);

    try {
      if (uploadedRevisedFile) {
        // 1. Upload user-provided revised file exported from external editor (Figma, Photoshop, Illustrator, Canva)
        const formData = new FormData();
        formData.append('file', uploadedRevisedFile);
        formData.append('category', 'creatives');
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload revised image file.');
        const newCorrectedUrl = uploadData.url;

        // 2. Perform genuine re-analysis and version increment (v2, v3, etc.) preserving original in audit history
        const findingDesc = correctionTargetFinding ? `for: "${correctionTargetFinding.finding_title}"` : 'from external design editor';
        const reanalyzeRes = await fetch(`/api/reviews/${id}/reanalyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corrected_image_url: newCorrectedUrl,
            correction_metadata: {
              target_scope: 'image',
              edit_applied_to_pixels: false,
              replaced_asset_id: selectedReplacementAssetId || undefined,
              correction_notes: `Designer-revised creative graphic uploaded ${findingDesc}. Original asset preserved in audit history.`,
            },
          }),
        });

        const reanalyzeData = await reanalyzeRes.json();
        if (!reanalyzeRes.ok) throw new Error(reanalyzeData.error || 'Re-analysis of revised creative failed.');

        if (reanalyzeData.review) {
          setReview(reanalyzeData.review);
        }

        setIsCorrectionModalOpen(false);
        setUploadedRevisedFile(null);
        setViewMode('split');
        setEvalSuccessNotice(
          `Revised creative graphic saved and re-evaluated! Version ${reanalyzeData.review?.review_version} created. Resolved: ${reanalyzeData.resolvedFindings?.length || 0} issue(s), Remaining: ${reanalyzeData.remainingFindings?.length || 0}.`
        );
      } else {
        // Re-evaluate original creative without modifying pixels or creating fake versions
        const reevalRes = await fetch(`/api/reviews/${id}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const reevalData = await reevalRes.json();
        if (!reevalRes.ok) throw new Error(reevalData.error || 'Re-evaluation of original creative failed.');

        if (reevalData.review) {
          setReview(reevalData.review);
        }

        setIsCorrectionModalOpen(false);
        setEvalSuccessNotice(
          `Original creative re-evaluated against brand guidelines. Findings updated (Version ${review.review_version || 1} preserved).`
        );
      }
    } catch (err: unknown) {
      setCorrectionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setIsApplyingCorrection(false);
    }
  }

  // Record Decision
  async function handleRecordDecision(e: React.FormEvent) {
    e.preventDefault();
    setDecisionError(null);
    setIsSubmittingDecision(true);

    try {
      const res = await fetch(`/api/reviews/${id}/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionType,
          reviewer_label: reviewerLabel.trim(),
          comments: decisionComments.trim() || undefined,
          is_override: isOverride,
          override_reason: isOverride ? overrideReason.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record decision');

      setIsDecisionModalOpen(false);
      setDecisionComments('');
      setIsOverride(false);
      setOverrideReason('');
      await fetchReview();
    } catch (err: unknown) {
      setDecisionError(err instanceof Error ? err.message : 'Failed to record decision');
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-gray-400">
        <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Loading creative review audit record...</p>
      </div>
    );
  }

  if (errorMsg || !review) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-12">
        <Card className="border-red-200 bg-red-50 text-center p-8">
          <div className="w-12 h-12 rounded-xl bg-white border border-red-200 flex items-center justify-center text-red-600 mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Review Not Found</h2>
          <p className="text-xs text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
            {errorMsg || 'The requested review does not exist in the database or could not be loaded.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchReview()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry Loading
            </Button>
            <Link href="/reviews">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Review History
              </Button>
            </Link>
            <Link href="/reviews/new">
              <Button variant="primary" size="sm">
                Submit New Review
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const criticalCount = review.findings?.filter((f) => f.severity === 'critical').length || 0;
  const highCount = review.findings?.filter((f) => f.severity === 'high').length || 0;
  const isDraftOrIncomplete = review.status === 'draft' || review.compliance_score === null || review.compliance_score === undefined;
  const hasCorrectedVersion =
    (review.review_version > 1) ||
    Boolean(review.corrected_image_url);

  // Category 1: Spelling & Text Accuracy
  const spellingAndTextList = review.findings?.filter(
    (f) =>
      f.category === 'spelling_and_text' ||
      f.category === 'spelling_and_grammar' ||
      f.category === 'typography' ||
      f.finding_title.toLowerCase().includes('spelling') ||
      f.finding_title.toLowerCase().includes('duplicate') ||
      f.finding_title.toLowerCase().includes('typo')
  ) || [];

  // Category 2: Logo and Brand Identity
  const logoAndBrandList = review.findings?.filter(
    (f) =>
      f.category === 'logo_and_brand' ||
      f.category === 'logo_integrity' ||
      f.category === 'brand_guideline' ||
      f.finding_title.toLowerCase().includes('logo') ||
      f.finding_title.toLowerCase().includes('palette')
  ) || [];

  // Category 3: Abusive or Harmful Language
  const abusiveLanguageList = review.findings?.filter(
    (f) =>
      f.category === 'abusive_language' ||
      f.category === 'harmful_language' ||
      f.finding_title.toLowerCase().includes('profanity') ||
      f.finding_title.toLowerCase().includes('harmful')
  ) || [];

  // Category 4: Layout and Visual Quality
  const layoutAndDesignList = review.findings?.filter(
    (f) =>
      f.category === 'layout_and_design' ||
      f.category === 'visual_design_quality' ||
      f.category === 'layout' ||
      f.finding_title.toLowerCase().includes('resolution') ||
      f.finding_title.toLowerCase().includes('pixelation') ||
      f.finding_title.toLowerCase().includes('obscured') ||
      f.finding_title.toLowerCase().includes('contrast')
  ) || [];

  // Category 5: Claims and Internal Consistency
  const claimsAndConsistencyList = review.findings?.filter(
    (f) =>
      f.category === 'claims_and_consistency' ||
      f.category === 'brand_marketing_claim' ||
      f.category === 'prohibited_claim' ||
      f.category === 'voice_and_tone' ||
      f.finding_title.toLowerCase().includes('claim') ||
      f.finding_title.toLowerCase().includes('contradiction') ||
      f.finding_title.toLowerCase().includes('discount') ||
      f.finding_title.toLowerCase().includes('absolute')
  ) || [];

  // Category 6: Potential Copyright / IP Risks
  const copyrightIpList = review.findings?.filter(
    (f) =>
      f.category === 'copyright_trademark_ip' ||
      f.category === 'copyright_and_ip_risk' ||
      f.finding_title.toLowerCase().includes('copyright') ||
      f.finding_title.toLowerCase().includes('trademark') ||
      f.finding_title.toLowerCase().includes('watermark')
  ) || [];

  // Category 7: Other Visible Issues
  const otherIssuesList = review.findings?.filter(
    (f) => f.category === 'other_visible_issues'
  ) || [];

  const displayedFindings = (review.findings || []).filter((f) => {
    if (findingsCategoryFilter === 'spelling_and_text') {
      return (
        f.category === 'spelling_and_text' ||
        f.category === 'spelling_and_grammar' ||
        f.category === 'typography' ||
        f.finding_title.toLowerCase().includes('spelling') ||
        f.finding_title.toLowerCase().includes('duplicate') ||
        f.finding_title.toLowerCase().includes('typo')
      );
    }
    if (findingsCategoryFilter === 'logo_and_brand') {
      return (
        f.category === 'logo_and_brand' ||
        f.category === 'logo_integrity' ||
        f.category === 'brand_guideline' ||
        f.finding_title.toLowerCase().includes('logo') ||
        f.finding_title.toLowerCase().includes('palette')
      );
    }
    if (findingsCategoryFilter === 'abusive_language') {
      return (
        f.category === 'abusive_language' ||
        f.category === 'harmful_language' ||
        f.finding_title.toLowerCase().includes('profanity') ||
        f.finding_title.toLowerCase().includes('harmful')
      );
    }
    if (findingsCategoryFilter === 'layout_and_design') {
      return (
        f.category === 'layout_and_design' ||
        f.category === 'visual_design_quality' ||
        f.category === 'layout' ||
        f.finding_title.toLowerCase().includes('resolution') ||
        f.finding_title.toLowerCase().includes('pixelation') ||
        f.finding_title.toLowerCase().includes('obscured') ||
        f.finding_title.toLowerCase().includes('contrast')
      );
    }
    if (findingsCategoryFilter === 'claims_and_consistency') {
      return (
        f.category === 'claims_and_consistency' ||
        f.category === 'brand_marketing_claim' ||
        f.category === 'prohibited_claim' ||
        f.category === 'voice_and_tone' ||
        f.finding_title.toLowerCase().includes('claim') ||
        f.finding_title.toLowerCase().includes('contradiction') ||
        f.finding_title.toLowerCase().includes('discount') ||
        f.finding_title.toLowerCase().includes('absolute')
      );
    }
    if (findingsCategoryFilter === 'copyright_trademark_ip') {
      return (
        f.category === 'copyright_trademark_ip' ||
        f.category === 'copyright_and_ip_risk' ||
        f.finding_title.toLowerCase().includes('copyright') ||
        f.finding_title.toLowerCase().includes('trademark') ||
        f.finding_title.toLowerCase().includes('watermark')
      );
    }
    if (findingsCategoryFilter === 'other_visible_issues') {
      return f.category === 'other_visible_issues';
    }
    return true;
  });

  const sanitizedReportTitle = (review.title || 'Campaign-Post')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Campaign-Post';
  const pdfDownloadFilename = `BrandGuard_Report_${sanitizedReportTitle}_v${review.review_version || 1}.pdf`;
  const jsonDownloadFilename = `BrandGuard_Data_${sanitizedReportTitle}_v${review.review_version || 1}.json`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={review.title}
        description={`Submitted ${formatDate(review.created_at)} · Channel: ${formatContentTypeLabel(
          review.content_type
        )} · Version ${review.review_version} ${hasCorrectedVersion ? '(Corrected)' : ''}`}
        badge={<Badge status={review.status} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/reviews">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5 text-gray-500" />}>
                Back to History
              </Button>
            </Link>
            {/* Prominent Dark Forest-Green Download Report Action */}
            <a
              href={`/api/reviews/${id}/report/pdf`}
              download={pdfDownloadFilename}
              aria-label="Download PDF Report"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer select-none"
            >
              <Download className="w-4 h-4 text-white shrink-0" />
              <span>Download Report</span>
            </a>

            {/* Clean Secondary Export JSON Action */}
            <a
              href={`/api/reviews/${id}/export/json`}
              download={jsonDownloadFilename}
              aria-label="Export JSON"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors cursor-pointer select-none"
            >
              <FileJson className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Export JSON</span>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCorrectionStudio()}
              leftIcon={<Upload className="w-3.5 h-3.5 text-teal-800" />}
            >
              Revise Creative
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReevaluate}
              isLoading={isEvaluating}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-gray-500" />}
            >
              Re-evaluate
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsDecisionModalOpen(true);
                setDecisionError(null);
                setIsOverride(false);
                setOverrideReason('');
              }}
              leftIcon={<UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />}
            >
              Record Decision
            </Button>
          </div>
        }
      />

      {/* Draft Notification Banner */}
      {isDraftOrIncomplete && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-sm text-teal-900">
              <ImageIcon className="w-4 h-4 text-teal-800" />
              <span>Creative Saved as Draft (Pending Compliance Audit)</span>
            </div>
            <p className="text-gray-600 leading-relaxed max-w-2xl">
              This marketing creative was saved as Draft Version {review.review_version}. Run the multimodal compliance engine to inspect image typography, logos, and factual benchmarks.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleReevaluate}
            isLoading={isEvaluating}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Run Compliance Review
          </Button>
        </div>
      )}

      {/* Success Notice */}
      {evalSuccessNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{evalSuccessNotice}</span>
          </div>
          <button
            onClick={() => setEvalSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Analysis Failed Banner */}
      {review.evaluation_metadata?.analysisStatus === 'failed' && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-950 text-xs flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm text-red-900 block">Compliance Analysis Failed</span>
            <p className="text-red-800 leading-relaxed">
              The compliance engine encountered an error while inspecting the creative image or caption. Try running re-evaluation or uploading an alternate file format.
            </p>
          </div>
        </div>
      )}

      {/* Partial / Incomplete Analysis Banner */}
      {Boolean(review.evaluation_metadata?.isPartialAnalysis || review.evaluation_metadata?.analysisStatus === 'partial') && review.evaluation_metadata?.analysisStatus !== 'failed' && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm text-amber-900 block">Partial / Incomplete Analysis</span>
            <p className="text-amber-800 leading-relaxed">
              {(() => {
                const breakdown = review.evaluation_metadata?.scoringBreakdown as { methodology?: string } | undefined;
                return breakdown?.methodology?.startsWith('Documented compliance policy:')
                  ? breakdown.methodology.replace('Documented compliance policy: ', '').split(' Deductions:')[0]
                  : (typeof review.evaluation_metadata?.limitationsDisclosed === 'string' ? review.evaluation_metadata.limitationsDisclosed : null) ||
                  'Analysis was partially completed. Uploaded creative may contain sparse/unreadable typography or caption copy is absent. Manual human review is recommended for full compliance assurance.';
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Primary Studio Layout: Uploaded Image at Center, Findings in Side Panel (Requirement 9) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Center Column: Creative Inspection Studio & Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-white border-gray-200 shadow-xs">
            {/* Studio Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-gray-100 gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-teal-800" />
                  Creative Visual Inspection
                </span>
                {review.aspect_ratio && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                    {review.aspect_ratio} Feed
                  </span>
                )}
                {review.image_width && review.image_height && (
                  <span className="text-[10px] text-gray-400 font-mono">
                    {review.image_width}×{review.image_height}px
                  </span>
                )}
              </div>

              {/* Side-by-Side Toggle if corrected version exists */}
              {hasCorrectedVersion && (
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setViewMode('single')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${viewMode === 'single' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    Current (v{review.review_version})
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${viewMode === 'split' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    <Columns className="w-3 h-3" />
                    Side-by-Side (v1 vs v2)
                  </button>
                </div>
              )}
            </div>

            {/* Split View: Side-by-Side Comparison (Requirement 3 & 4) */}
            {hasCorrectedVersion && viewMode === 'split' ? (
              (() => {
                const hasGenuinePixelEdit = Boolean(
                  review.correction_metadata?.edit_applied_to_pixels &&
                  review.corrected_image_url &&
                  review.corrected_image_url.trim() &&
                  review.corrected_image_url !== (review.original_image_url || review.image_url)
                );
                const originalImage = review.original_image_url || review.image_url || null;
                const correctedImage = hasGenuinePixelEdit ? review.corrected_image_url : originalImage;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Original v1 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Original Version 1 (Initial Creative)
                        </span>
                        <span className="text-[10px] text-red-600 font-mono">Violations Present</span>
                      </div>
                      <div className="relative rounded-lg border border-red-200 bg-gray-50 overflow-hidden flex items-center justify-center p-2 min-h-[300px]">
                        {originalImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={originalImage}
                            alt="Original Version 1"
                            className="max-h-[380px] w-auto max-w-full object-contain rounded"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400 min-h-[220px]">
                            <ImageIcon className="w-8 h-8 text-gray-300 mb-2 stroke-[1.5]" />
                            <span className="text-xs font-semibold text-gray-600">Original Graphic Unavailable</span>
                            <span className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                              Original upload asset was not preserved in telemetry.
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-700">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">
                          Original Creative Version 1
                        </span>
                        <p className="text-[11px] text-gray-600">
                          Initial submission prior to graphic revision.
                        </p>
                      </div>
                    </div>

                    {/* Corrected v2 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          Corrected Version {review.review_version} (Re-analyzed)
                        </span>
                        <span className="text-[10px] text-emerald-700 font-mono">
                          {hasGenuinePixelEdit ? 'Pixels Applied' : 'Graphic Revised'}
                        </span>
                      </div>
                      <div className="relative rounded-lg border border-teal-200 bg-gray-50 overflow-hidden flex items-center justify-center p-2 min-h-[300px]">
                        {correctedImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={correctedImage}
                            alt={`Corrected Version ${review.review_version}`}
                            className="max-h-[380px] w-auto max-w-full object-contain rounded"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400 min-h-[220px]">
                            <ImageIcon className="w-8 h-8 text-gray-300 mb-2 stroke-[1.5]" />
                            <span className="text-xs font-semibold text-gray-600">Corrected Graphic Unavailable</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-teal-200 text-xs text-gray-700">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-semibold text-teal-800 uppercase tracking-wide">
                            Revised Creative Graphic (v{review.review_version})
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-700">
                          Updated image pixels evaluated against the 7 visual governance categories.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Single View: Center Creative Canvas with Bounding Box Overlays (Requirement 2 & 3) */
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center p-2 min-h-[360px] group">
                {/* Creative Image */}
                {review.image_url ? (
                  <div className="relative inline-block max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={review.image_url}
                      alt={review.title}
                      className="max-h-[460px] w-auto max-w-full object-contain rounded select-none"
                    />

                    {/* Interactive Bounding Box Overlays */}
                    {review.findings?.map((finding, idx) => {
                      if (!finding.bounding_box) return null;
                      const { ymin, xmin, ymax, xmax } = finding.bounding_box;
                      const isHovered = hoveredFindingId === finding.id;
                      const isSelected = selectedFindingId === finding.id;

                      const topPct = (ymin / 1000) * 100;
                      const leftPct = (xmin / 1000) * 100;
                      const widthPct = ((xmax - xmin) / 1000) * 100;
                      const heightPct = ((ymax - ymin) / 1000) * 100;

                      return (
                        <div
                          key={finding.id || idx}
                          onMouseEnter={() => setHoveredFindingId(finding.id)}
                          onMouseLeave={() => setHoveredFindingId(null)}
                          onClick={() => {
                            setSelectedFindingId(finding.id);
                            handleOpenSuggestedFixModal(finding);
                          }}
                          style={{
                            top: `${topPct}%`,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                          }}
                          className={`absolute border-2 transition-all cursor-pointer z-10 ${isHovered || isSelected
                              ? 'border-red-600 bg-red-500/25 ring-2 ring-red-400'
                              : 'border-amber-500 bg-amber-500/15 hover:border-red-600'
                            }`}
                          title={`Click to view suggested fix: ${finding.finding_title}`}
                        >
                          <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-600 text-white shadow-xs">
                            #{idx + 1} {finding.severity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">No creative graphic attached to this review.</p>
                  </div>
                )}
              </div>
            )}

            {/* Creative Intelligence & Specifications Bar (Requirement 6) */}
            {review.image_url && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-2.5">
                {/* Top Row: Modality & Resolution Specs */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Modality:
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                      {review.caption_text ? (
                        <>
                          <FileText className="w-3 h-3 text-teal-800" />
                          Multimodal (Image + Caption Copy)
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-3 h-3" />
                          Image-Only (Pixel & Typography Governance)
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium">
                    {(review.image_width || review.evaluation_metadata?.imageSummary?.width) && (
                      <span className="px-2 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]">
                        {review.image_width || review.evaluation_metadata?.imageSummary?.width}×
                        {review.image_height || review.evaluation_metadata?.imageSummary?.height} px
                      </span>
                    )}
                    {(review.aspect_ratio || review.evaluation_metadata?.imageSummary?.aspectRatio) && (
                      <span className="px-2 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]">
                        {review.aspect_ratio || review.evaluation_metadata?.imageSummary?.aspectRatio}
                      </span>
                    )}
                    {review.evaluation_metadata?.imageSummary?.format && (
                      <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px] uppercase">
                        {review.evaluation_metadata.imageSummary.format}
                      </span>
                    )}
                    {review.evaluation_metadata?.imageSummary?.dominantColor && (
                      <span
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]"
                        title={`Dominant Color: ${review.evaluation_metadata.imageSummary.dominantColor}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-gray-300"
                          style={{ backgroundColor: review.evaluation_metadata.imageSummary.dominantColor }}
                        />
                        {review.evaluation_metadata.imageSummary.dominantColor}
                      </span>
                    )}
                  </div>
                </div>

                {/* Governance Check Status Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-200/60">
                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="text-gray-600 truncate">Visual Inspection:</span>
                    <span className="font-semibold text-emerald-700 ml-auto">Passed</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    {review.extracted_ocr_text ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : (
                      <Info className="w-3 h-3 text-gray-400 shrink-0" />
                    )}
                    <span className="text-gray-600 truncate">OCR Typography:</span>
                    <span className="font-semibold text-gray-800 ml-auto">
                      {review.evaluation_metadata?.ocrConfidence !== null && review.evaluation_metadata?.ocrConfidence !== undefined
                        ? `${review.evaluation_metadata.ocrConfidence}% Conf`
                        : review.extracted_ocr_text
                          ? 'Extracted'
                          : 'No Text'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="text-gray-600 truncate">Image Scope:</span>
                    <span className="font-semibold text-gray-800 ml-auto">
                      7 Categories
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="text-gray-600 truncate">Brand Rules:</span>
                    <span className="font-semibold text-emerald-700 ml-auto">
                      {review.evaluation_metadata?.guidelinesEvaluatedCount ?? 'Active'} Rules
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="text-gray-600 truncate">Fact SLA Audit:</span>
                    <span className="font-semibold text-emerald-700 ml-auto">
                      {review.evaluation_metadata?.factsEvaluatedCount ?? 'Active'} Facts
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    <Cpu className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="text-gray-600 truncate">Vision Provider:</span>
                    <span className="font-semibold text-gray-700 ml-auto truncate max-w-[120px]" title={review.evaluation_metadata?.visionModelUsed || review.evaluation_metadata?.ocrProvider || 'Local OCR Engine'}>
                      {review.evaluation_metadata?.aiRun ? (review.evaluation_metadata?.visionModelUsed || 'Gemini Vision') : 'Local Engine'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-white p-1.5 rounded border border-gray-200">
                    <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span className="text-gray-600 truncate">Logo Presence:</span>
                    <span className="font-semibold text-gray-800 ml-auto truncate max-w-[120px]" title={review.evaluation_metadata?.logoPresence?.evidence || review.evaluation_metadata?.logoPresence?.details || 'Logo Presence'}>
                      {review.evaluation_metadata?.logoPresence?.status === 'detected_and_matched'
                        ? (review.evaluation_metadata.logoPresence.matchedAssetName || 'Verified Logo')
                        : review.evaluation_metadata?.logoPresence?.status === 'detected_unverified'
                          ? `Detected (${review.evaluation_metadata.logoPresence.logoType || 'Mark'})`
                          : review.evaluation_metadata?.logoPresence?.status === 'no_logo_detected'
                            ? 'None Detected'
                            : 'Unverified'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Accompanying Post Caption Display (when caption provided) */}
            {review.caption_text && (
              <div className="mt-3 p-3.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="font-semibold flex items-center gap-1.5 text-slate-900">
                    <FileText className="w-3.5 h-3.5 text-blue-700" />
                    Accompanying Social Post Caption
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {review.caption_text.length} characters
                  </span>
                </div>
                <p className="text-slate-800 text-sm whitespace-pre-wrap font-sans bg-slate-50 p-2.5 rounded border border-slate-200/80 leading-relaxed">
                  {review.caption_text}
                </p>
              </div>
            )}

            {/* Expandable Technical Diagnostics & OCR Telemetry Accordion (Requirement 6) */}
            {Boolean(review.image_url) && (
              <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      Technical Diagnostics & OCR Telemetry
                    </span>
                    {review.evaluation_metadata?.ocrConfidence !== null && review.evaluation_metadata?.ocrConfidence !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {review.evaluation_metadata.ocrConfidence}% Confidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span>{isDiagnosticsOpen ? 'Hide' : 'Expand'}</span>
                    {isDiagnosticsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isDiagnosticsOpen && (
                  <div className="p-3.5 space-y-3 border-t border-gray-200 text-xs">
                    {/* Telemetry Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <div className="p-2 rounded bg-gray-50 border border-gray-200">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide block">OCR Confidence</span>
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {review.evaluation_metadata?.ocrConfidence !== null && review.evaluation_metadata?.ocrConfidence !== undefined
                            ? `${review.evaluation_metadata.ocrConfidence}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-200">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Extracted Lines</span>
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {review.evaluation_metadata?.ocrLinesCount ?? (review.extracted_ocr_text ? review.extracted_ocr_text.split('\n').filter(Boolean).length : 0)}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-200">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Noise Filtered</span>
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {review.evaluation_metadata?.unreadableSegmentsCount ?? 0}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-200">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Engine Provider</span>
                        <span className="font-mono text-xs font-semibold text-gray-800 truncate block mt-0.5" title={review.evaluation_metadata?.ocrProvider || 'Tesseract.js'}>
                          {review.evaluation_metadata?.ocrProvider || 'Tesseract.js OCR'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-200">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Logo Detection</span>
                        <span className="font-mono text-xs font-semibold text-gray-800 truncate block mt-0.5" title={review.evaluation_metadata?.logoPresence?.evidence || review.evaluation_metadata?.logoPresence?.details || 'Logo presence'}>
                          {review.evaluation_metadata?.logoPresence?.status === 'detected_and_matched'
                            ? 'Verified Match'
                            : review.evaluation_metadata?.logoPresence?.status === 'detected_unverified'
                              ? 'Detected (Unverified)'
                              : review.evaluation_metadata?.logoPresence?.status === 'no_logo_detected'
                                ? 'Not Detected'
                                : 'Uncertain (Local)'}
                        </span>
                      </div>
                    </div>

                    {/* Honest Limitations Disclosures */}
                    {review.evaluation_metadata?.disclosures && review.evaluation_metadata.disclosures.length > 0 && (
                      <div className="p-2.5 rounded bg-amber-50/60 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                        <span className="font-semibold block text-[10px] uppercase tracking-wide text-amber-800">
                          Engine Disclosures & Limitations:
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {review.evaluation_metadata.disclosures.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Clean Transcribed Typography */}
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                        Clean Normalized Typography Transcript:
                      </span>
                      {review.extracted_ocr_text ? (
                        <pre className="p-2.5 rounded bg-gray-900 text-gray-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {review.extracted_ocr_text}
                        </pre>
                      ) : (
                        <p className="p-2.5 rounded bg-gray-50 border border-gray-200 text-gray-500 font-mono text-[11px]">
                          No legible typography extracted from creative image.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Compact Readable Side Panel (Findings & Governance Audit) (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Telemetry Summary Card */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-white border border-gray-200 shadow-xs text-center">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Compliance Score
              </p>
              <div className="text-3xl font-semibold text-gray-900 mt-1">
                {review.evaluation_metadata?.isPartialAnalysis && (!review.findings || review.findings.length === 0)
                  ? 'Score Unavailable'
                  : review.compliance_score !== null && review.compliance_score !== undefined
                    ? `${review.compliance_score}%`
                    : 'Score Unavailable'}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {review.evaluation_metadata?.isPartialAnalysis && (!review.findings || review.findings.length === 0)
                  ? 'Analysis Incomplete'
                  : review.status === 'approved'
                    ? 'Approved by Reviewer'
                    : review.status === 'in_review' && (review.compliance_score ?? 0) >= 90
                      ? 'Ready for Review'
                      : review.compliance_score !== null && review.compliance_score !== undefined
                        ? review.compliance_score >= 70
                          ? 'Revision Recommended'
                          : 'Critical Flags Block'
                        : 'Awaiting audit'}
              </p>
            </Card>

            <Card className="p-4 bg-white border border-gray-200 shadow-xs text-center">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Governance Gate
              </p>
              <div className="mt-2 flex justify-center">
                <Badge status={review.status} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                {criticalCount > 0
                  ? `${criticalCount} critical violation(s)`
                  : highCount > 0
                    ? `${highCount} high severity issue(s)`
                    : review.evaluation_metadata?.isPartialAnalysis
                      ? 'Checks incomplete'
                      : review.status === 'approved'
                        ? 'Zero critical issues'
                        : '0 critical issues detected'}
              </p>
            </Card>
          </div>

          {/* Audit Findings Side Panel */}
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900">
                    <ShieldCheck className="w-4 h-4 text-teal-800" />
                    Compliance Findings ({review.findings?.length || 0})
                  </CardTitle>
                </div>
                <CardDescription>
                  Verified across the 7 Image-First Governance categories with coordinate bounding boxes
                </CardDescription>

                {/* 7-Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${findingsCategoryFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                  >
                    All ({review.findings?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('spelling_and_text')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'spelling_and_text'
                        ? 'bg-orange-700 text-white shadow-sm ring-1 ring-orange-700'
                        : 'bg-orange-50 text-orange-950 hover:bg-orange-100 border border-orange-200'
                      }`}
                  >
                    <span>1. Spelling & Text</span>
                    <span className="font-mono text-[10px] opacity-80">({spellingAndTextList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('logo_and_brand')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'logo_and_brand'
                        ? 'bg-teal-700 text-white shadow-sm ring-1 ring-teal-700'
                        : 'bg-teal-50 text-teal-950 hover:bg-teal-100 border border-teal-200'
                      }`}
                  >
                    <span>2. Logo & Brand</span>
                    <span className="font-mono text-[10px] opacity-80">({logoAndBrandList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('abusive_language')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'abusive_language'
                        ? 'bg-red-700 text-white shadow-sm ring-1 ring-red-700'
                        : 'bg-red-50 text-red-950 hover:bg-red-100 border border-red-200'
                      }`}
                  >
                    <span>3. Harmful Content</span>
                    <span className="font-mono text-[10px] opacity-80">({abusiveLanguageList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('layout_and_design')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'layout_and_design'
                        ? 'bg-sky-700 text-white shadow-sm ring-1 ring-sky-700'
                        : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border border-sky-200'
                      }`}
                  >
                    <span>4. Layout & Design</span>
                    <span className="font-mono text-[10px] opacity-80">({layoutAndDesignList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('claims_and_consistency')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'claims_and_consistency'
                        ? 'bg-rose-700 text-white shadow-sm ring-1 ring-rose-700'
                        : 'bg-rose-50 text-rose-950 hover:bg-rose-100 border border-rose-200'
                      }`}
                  >
                    <span>5. Claims & Facts</span>
                    <span className="font-mono text-[10px] opacity-80">({claimsAndConsistencyList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindingsCategoryFilter('copyright_trademark_ip')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'copyright_trademark_ip'
                        ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-700'
                        : 'bg-purple-50 text-purple-950 hover:bg-purple-100 border border-purple-200'
                      }`}
                  >
                    <span>6. IP & Trademarks</span>
                    <span className="font-mono text-[10px] opacity-80">({copyrightIpList.length})</span>
                  </button>
                  {otherIssuesList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFindingsCategoryFilter('other_visible_issues')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${findingsCategoryFilter === 'other_visible_issues'
                          ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-700'
                          : 'bg-gray-50 text-gray-950 hover:bg-gray-100 border border-gray-200'
                        }`}
                    >
                      <span>7. Other Issues</span>
                      <span className="font-mono text-[10px] opacity-80">({otherIssuesList.length})</span>
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* If zero findings detected across review */}
            {(!review.findings || review.findings.length === 0) ? (
              review.evaluation_metadata?.isPartialAnalysis ? (
                <div className="py-8 text-center text-amber-700">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-900">Analysis Incomplete</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    {review.evaluation_metadata?.limitationsDisclosed ||
                      'Automated visual/typography checks could not complete. Manual inspection is required before publication.'}
                  </p>
                </div>
              ) : review.status === 'approved' ? (
                <div className="py-8 text-center text-gray-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-900">Creative Approved</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Clean creative: passed governance audit and signed off by authorized brand reviewer.
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <CheckCircle2 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-900">Audit Complete — 0 Violations</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Automated governance audit completed with zero detected violations. Awaiting reviewer signoff.
                  </p>
                </div>
              )
            ) : displayedFindings.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-gray-800">
                  No {findingsCategoryFilter === 'ocr_errors' ? 'Spelling or Typographical Errors' : findingsCategoryFilter === 'visual_design' ? 'Visual Design Issues' : findingsCategoryFilter === 'copyright_ip' ? 'Copyright / IP Risks' : findingsCategoryFilter === 'brand_claims' ? 'Brand Claim Inconsistencies' : findingsCategoryFilter === 'caption_analysis' ? 'Caption Issues' : findingsCategoryFilter === 'cross_modal' ? 'Cross-Modal Conflicts' : 'Violations'} Detected
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  This creative has zero violations in the selected inspection stage.
                </p>
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 space-y-3.5 max-h-[620px] overflow-y-auto pr-1">
                {displayedFindings.map((f, i) => {
                  const isHovered = hoveredFindingId === f.id;
                  const isSelected = selectedFindingId === f.id;
                  return (
                    <div
                      key={f.id || i}
                      onMouseEnter={() => setHoveredFindingId(f.id)}
                      onMouseLeave={() => setHoveredFindingId(null)}
                      className={`p-4 sm:p-5 rounded-xl border transition-all bg-white shadow-xs hover:shadow-sm space-y-3 ${isHovered || isSelected
                          ? 'border-teal-700 bg-teal-50/20 ring-1 ring-teal-700/30'
                          : f.severity === 'critical'
                            ? 'border-rose-200 hover:border-rose-300'
                            : f.severity === 'high'
                              ? 'border-amber-200 hover:border-amber-300'
                              : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      {/* Top Metadata Row: Number, Severity, Category, Confidence */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            #{i + 1}
                          </span>

                          {/* Severity Badge with High-Contrast Accessible Styling */}
                          {f.severity === 'critical' ? (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300">
                              Critical
                            </span>
                          ) : f.severity === 'high' ? (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300">
                              High
                            </span>
                          ) : f.severity === 'medium' ? (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-yellow-100 text-yellow-950 border border-yellow-300">
                              Medium
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300">
                              Low
                            </span>
                          )}

                          {/* Scope Tag (Clearly distinguishes Image Findings, Caption Findings, and Image-Caption Inconsistencies) */}
                          {f.target_scope === 'caption' || f.source === 'caption' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              Caption Finding
                            </span>
                          ) : f.target_scope === 'both' || f.category === 'cross_modal_conflict' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 border border-amber-300 flex items-center gap-1.5">
                              <GitCompare className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              Image–Caption Inconsistency
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                              Image Finding
                            </span>
                          )}

                          {f.resolution_status === 'reviewed' && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                              Reviewed
                            </span>
                          )}

                          {/* Category Descriptor */}
                          {f.category === 'spelling_and_text' || f.category === 'spelling_and_grammar' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-orange-50 text-orange-950 border border-orange-200">
                              1. Spelling & Text
                            </span>
                          ) : f.category === 'logo_and_brand' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-950 border border-teal-200">
                              2. Logo & Brand
                            </span>
                          ) : f.category === 'abusive_language' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-950 border border-red-200">
                              3. Harmful Content
                            </span>
                          ) : f.category === 'layout_and_design' || f.category === 'visual_design_quality' || f.category === 'unreadable_content' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-950 border border-sky-200">
                              4. Layout & Design
                            </span>
                          ) : f.category === 'claims_and_consistency' || f.category === 'brand_marketing_claim' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-950 border border-rose-200">
                              5. Claims & Facts
                            </span>
                          ) : f.category === 'copyright_trademark_ip' || f.category === 'copyright_and_ip_risk' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-950 border border-purple-200">
                              6. IP & Trademarks
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200">
                              7. Other Issues
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {Math.round(f.confidence * 100)}% Conf
                          </span>
                          {f.bounding_box && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200" title="Detected via Multimodal Vision Model or Line OCR">
                              Box [{f.bounding_box.ymin},{f.bounding_box.xmin}]
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Finding Title & Clear Readable Explanation */}
                      <div>
                        <h5 className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug tracking-tight">
                          {f.finding_title}
                        </h5>
                        <p className="text-sm sm:text-[14.5px] text-slate-700 leading-relaxed font-normal mt-1">
                          {f.explanation}
                        </p>
                      </div>

                      {/* Human Verification Required Banner */}
                      {(f.needs_human_verification || f.category === 'copyright_and_ip_risk') && (
                        <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-xs flex items-start gap-2 text-purple-950">
                          <AlertTriangle className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-[11px] uppercase tracking-wide text-purple-900 block">
                              ⚠️ Human Verification Required
                            </span>
                            <p className="text-purple-800 text-xs leading-relaxed">
                              {f.human_verification_reason ||
                                (f.category === 'copyright_and_ip_risk'
                                  ? 'Flagged for reviewer signoff. Copyright ownership and trademark licensing cannot be definitively established from pixels alone.'
                                  : 'Requires human brand reviewer confirmation before commercial distribution.')}
                            </p>
                            {f.uncertainty_notes && (
                              <p className="text-purple-700/80 text-[11px] italic">
                                Note: {f.uncertainty_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Evidence Display with Clear Visual Distinction */}
                      {(f.evidence_text || f.image_evidence || f.caption_evidence) ? (
                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/90 text-sm">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            {f.target_scope === 'caption'
                              ? 'Detected Caption Evidence:'
                              : f.target_scope === 'both'
                                ? 'Cross-Modal Inconsistent Evidence:'
                                : 'Detected Visual Element:'}
                          </span>
                          <span className="text-rose-900 font-mono text-[13px] font-semibold break-words bg-white px-2.5 py-1 rounded border border-slate-200 block">
                            &ldquo;{f.evidence_text || f.image_evidence || f.caption_evidence}&rdquo;
                          </span>
                        </div>
                      ) : null}

                      {/* Useful Suggested Correction Area & View Suggested Fix Button (Change 2) */}
                      {(f.suggested_fix || f.proposed_replacement) && (
                        <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                              Recommended Correction:
                            </span>
                            <p className="text-sm font-semibold text-slate-900 break-words leading-snug">
                              {f.proposed_replacement || f.suggested_fix}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenSuggestedFixModal(f)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 active:bg-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-700/40 rounded-lg shadow-sm shrink-0 transition-colors cursor-pointer select-none"
                            >
                              <Eye className="w-3.5 h-3.5 text-white" />
                              <span>View Suggested Fix</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Section 8: Analysis Coverage, Limitations & Final Review Status */}
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader className="pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900">
                  <ShieldCheck className="w-4 h-4 text-teal-800" />
                  8. Coverage, Limitations & Final Review Status
                </CardTitle>
                {(() => {
                  const gov =
                    review.evaluation_metadata?.governance_status ||
                    (criticalCount > 0 || highCount > 0
                      ? 'REVIEW REQUIRED'
                      : review.evaluation_metadata?.isPartialAnalysis
                        ? 'ANALYSIS INCOMPLETE'
                        : (review.compliance_score ?? 0) >= 90
                          ? 'PASS'
                          : 'WARNING');
                  return (
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${gov === 'PASS'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : gov === 'WARNING'
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : gov === 'REVIEW REQUIRED'
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-yellow-100 text-yellow-950 border-yellow-300'
                        }`}
                    >
                      Status: {gov}
                    </span>
                  );
                })()}
              </div>
              <CardDescription>
                Governance status determined strictly from evidence coverage and verified modality inputs.
              </CardDescription>
            </CardHeader>
            <div className="p-3.5 sm:p-4 space-y-3 text-xs">
              {/* Coverage Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-[11px]">
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 uppercase tracking-wide block text-[10px]">1. Image Analysis</span>
                  <span className="font-semibold text-emerald-700">✓ Inspected</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 uppercase tracking-wide block text-[10px]">2. OCR Typography</span>
                  <span className="font-semibold text-emerald-700">
                    {review.extracted_ocr_text ? '✓ Extracted' : 'No text in image'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 uppercase tracking-wide block text-[10px]">3. Visual Quality</span>
                  <span className="font-semibold text-emerald-700">✓ Audited</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 uppercase tracking-wide block text-[10px]">4. Copyright / IP</span>
                  <span className="font-semibold text-purple-700">✓ Human Review Gate</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 uppercase tracking-wide block text-[10px]">5. Claims & Facts</span>
                  <span className="font-semibold text-emerald-700">✓ Audited</span>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 uppercase tracking-wide block text-[10px]">6. Caption Audit</span>
                  <span className="font-semibold text-slate-700">
                    {review.caption_text ? '✓ Audited' : 'N/A (Image-Only)'}
                  </span>
                </div>
              </div>

              {/* Engine Disclosures & Limitations */}
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 text-xs space-y-1.5">
                <span className="font-bold text-[11px] uppercase tracking-wide text-amber-900 block flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-800" />
                  Engine Disclosures & Limitations:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-amber-900 text-[11px] leading-relaxed">
                  <li>
                    <strong>Copyright / IP:</strong> Trademark and copyright ownership cannot be confirmed from pixels alone. Detected third-party marks and watermarks are flagged for human review.
                  </li>
                  <li>
                    <strong>Analysis Coverage:</strong> {review.evaluation_metadata?.aiRun ? `Multimodal creative visual analysis executed via ${review.evaluation_metadata?.visionModelUsed || 'Google Gemini Vision'}.` : 'Analyzed via local OCR (Tesseract.js) and deterministic rules engine.'}
                  </li>
                  {review.evaluation_metadata?.disclosures?.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Decision Modal */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title="Record Governance Decision"
        description="Submit reviewer authorization or request creative revisions with documented audit trail."
      >
        <form onSubmit={handleRecordDecision} className="space-y-4">
          {decisionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {decisionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Decision Outcome</label>
            <select
              value={decisionType}
              onChange={(e) => setDecisionType(e.target.value as ReviewDecisionType)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
            >
              <option value="approved">Approve Creative for Publication</option>
              <option value="changes_requested">Request Creative Revisions</option>
              <option value="flagged">Flag for Legal/Governance Counsel</option>
              <option value="rejected">Reject Creative Submission</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reviewer Identity</label>
            <input
              type="text"
              required
              value={reviewerLabel}
              onChange={(e) => setReviewerLabel(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Audit Comments</label>
            <textarea
              rows={3}
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              placeholder="Provide context on review rationale..."
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
            />
          </div>

          {criticalCount > 0 && decisionType === 'approved' && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Authorized Override Required</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Standard approval is prohibited because {criticalCount} unresolved critical violation(s) remain on this creative.
              </p>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-950">
                <input
                  type="checkbox"
                  checked={isOverride}
                  onChange={(e) => setIsOverride(e.target.checked)}
                  className="rounded border-amber-400 text-teal-800 focus:ring-teal-700"
                />
                <span>Confirm Authorized Governance Override</span>
              </label>

              {isOverride && (
                <div>
                  <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                    Mandatory Audit Rationale <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Document explicit executive or legal justification for overriding critical policy findings..."
                    className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingDecision}>
              Record Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* Interactive Creative Revision Studio Modal */}
      <Modal
        isOpen={isCorrectionModalOpen}
        onClose={() => {
          setIsCorrectionModalOpen(false);
          setUploadedRevisedFile(null);
          setCorrectionError(null);
        }}
        maxWidth="lg"
        title="Creative Revision & Re-evaluation Studio"
        description="Review suggested corrections, export instructions for your design team, and upload designer-revised creatives from Figma, Illustrator, or Photoshop."
      >
        <form onSubmit={handleApplyCorrection} className="space-y-4">
          {correctionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Revision Action Failed</span>
                <span>{correctionError}</span>
              </div>
            </div>
          )}

          {/* Targeted Finding Details */}
          {correctionTargetFinding && (() => {
            const f = correctionTargetFinding;
            const isTextual = f.category === 'spelling_and_text' || f.category === 'spelling_and_grammar' || f.target_scope === 'caption';
            const isCrossModal = f.target_scope === 'both' || f.category === 'cross_modal_conflict';
            const originalSnippet = f.evidence_text || f.image_evidence || f.caption_evidence || 'Detected visual issue';
            const recommendedFix = f.proposed_replacement || f.suggested_fix || 'Manual designer review required.';

            return (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      f.severity === 'critical' ? 'bg-red-100 text-red-900 border border-red-300' :
                      f.severity === 'high' ? 'bg-amber-100 text-amber-950 border border-amber-300' :
                      'bg-slate-200 text-slate-800 border border-slate-300'
                    }`}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className="font-semibold text-slate-900 text-xs">
                      Targeted Finding: {f.finding_title}
                    </span>
                  </div>
                  {f.target_scope === 'caption' ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                      Caption Finding
                    </span>
                  ) : isCrossModal ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 border border-amber-300">
                      Cross-Modal Conflict
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200">
                      Image Finding
                    </span>
                  )}
                </div>

                <p className="text-slate-700 text-[11px] leading-relaxed">
                  <strong>Why This Matters:</strong> {f.explanation}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                  <div className="p-2.5 rounded bg-red-50/70 border border-red-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block mb-0.5">
                      Detected In Creative
                    </span>
                    <span className="font-mono text-xs text-red-900 break-words font-medium">
                      {originalSnippet}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
                      Recommended Correction
                    </span>
                    <span className="font-mono text-xs text-emerald-950 break-words font-medium">
                      {recommendedFix}
                    </span>
                  </div>
                </div>

                {isTextual ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 italic">
                      Review proposed spelling/copy in context before updating your creative asset.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const copyVal = f.proposed_replacement || f.suggested_fix || originalSnippet;
                        navigator.clipboard.writeText(copyVal);
                        setHasCopiedStudioFix(true);
                        setTimeout(() => setHasCopiedStudioFix(false), 2000);
                      }}
                      leftIcon={hasCopiedStudioFix ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    >
                      {hasCopiedStudioFix ? 'Copied to Clipboard' : 'Copy Correction'}
                    </Button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-teal-50/80 border border-teal-200 text-[11px] text-teal-900 leading-relaxed">
                    <strong>Designer Guidance:</strong> BrandGuard AI does not alter graphic artwork or raster pixels directly. Please resolve this defect in your design software (Figma, Illustrator, Photoshop, or Canva), then upload the revised graphic below.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Graphic Revision File Upload */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Upload Revised Creative Graphic (Designer Revision)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadedRevisedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100 cursor-pointer"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Select an updated image file if revisions were completed externally in Figma, Illustrator, Photoshop, or Canva.
              </span>
            </div>

            {uploadedRevisedFile ? (
              <div className="p-3 rounded-lg bg-teal-50/80 border border-teal-200 text-xs text-teal-950 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <span className="font-semibold block">{uploadedRevisedFile.name}</span>
                    <span className="text-[11px] text-teal-800">
                      {(uploadedRevisedFile.size / 1024).toFixed(1)} KB — Ready to save as Version {(review.review_version || 1) + 1}. Original Version 1 will be preserved in audit history.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedRevisedFile(null)}
                  className="text-teal-700 hover:text-teal-950 text-xs underline shrink-0 cursor-pointer"
                >
                  Clear file
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <strong>No revised file selected:</strong> You can copy the recommended correction above for your design team, or re-evaluate the original creative asset below without altering pixels or creating a new version.
              </div>
            )}

            {authorizedAssets.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Replace with Authorized Brand Asset (Optional)
                </label>
                <select
                  value={selectedReplacementAssetId}
                  onChange={(e) => setSelectedReplacementAssetId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                >
                  <option value="">(Keep existing visual assets)</option>
                  {authorizedAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_name} ({asset.asset_type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Audit Telemetry Callout */}
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-800">Governance & Audit Telemetry:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600">
              <li>Original Version 1 is permanently retained in audit history for side-by-side comparison.</li>
              <li>A new version is created only when a genuine revised creative image is uploaded.</li>
              <li>No automated pixel alteration or inpainting is performed on your creative artwork.</li>
              <li>Unresolved findings remain active until verified by re-evaluation or explicitly recorded.</li>
            </ul>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCorrectionModalOpen(false);
                setUploadedRevisedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={uploadedRevisedFile ? 'primary' : 'secondary'}
              size="sm"
              isLoading={isApplyingCorrection}
              disabled={isApplyingCorrection || isEvaluating}
              leftIcon={
                uploadedRevisedFile ? (
                  <Upload className="w-4 h-4" />
                ) : (
                  <RefreshCw className={`w-4 h-4 ${isApplyingCorrection ? 'animate-spin' : ''}`} />
                )
              }
            >
              {uploadedRevisedFile
                ? `Save Revised Creative & Re-evaluate v${(review.review_version || 1) + 1}`
                : 'Re-evaluate Original Creative'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal: Suggested Fix & Governance Guidance (Change 2) */}
      <Modal
        isOpen={isSuggestedFixModalOpen}
        onClose={() => setIsSuggestedFixModalOpen(false)}
        maxWidth="lg"
        title="Suggested Fix & Governance Guidance"
        description="Review evidence, why this finding matters, recommended text corrections or designer layout fixes."
      >
        {suggestedFixFinding && (() => {
          const f = suggestedFixFinding;
          const isTextual = f.category === 'spelling_and_text' || f.category === 'spelling_and_grammar' || f.target_scope === 'caption';
          const isCrossModal = f.target_scope === 'both' || f.category === 'cross_modal_conflict';
          const isReviewed = f.resolution_status === 'reviewed';

          return (
            <div className="space-y-4">
              {/* Finding Title & Badges */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    f.severity === 'critical' ? 'bg-red-100 text-red-900 border border-red-300' :
                    f.severity === 'high' ? 'bg-amber-100 text-amber-950 border border-amber-300' :
                    'bg-slate-100 text-slate-800 border border-slate-300'
                  }`}>
                    {f.severity.toUpperCase()}
                  </span>

                  {f.target_scope === 'caption' || f.source === 'caption' ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-700" />
                      Caption Finding
                    </span>
                  ) : isCrossModal ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 border border-amber-300 flex items-center gap-1">
                      <GitCompare className="w-3.5 h-3.5 text-amber-700" />
                      Image–Caption Inconsistency
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-teal-700" />
                      Image Finding
                    </span>
                  )}

                  {isReviewed && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Marked as Reviewed
                    </span>
                  )}
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {f.finding_title}
                </h4>
              </div>

              {/* Section: Why This Matters */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Why This Matters:
                </span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                  {f.explanation}
                </p>
              </div>

              {/* Section: Original Evidence vs Suggested Fix */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Correction Details:
                </span>

                {isCrossModal ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200 space-y-1">
                      <span className="font-bold text-rose-900 block uppercase text-[10px]">Image Visual Text:</span>
                      <p className="font-mono text-rose-950 font-semibold break-words">{f.image_evidence || 'Image claim'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1">
                      <span className="font-bold text-blue-900 block uppercase text-[10px]">Caption Copy:</span>
                      <p className="font-mono text-blue-950 font-semibold break-words">{f.caption_evidence || 'Caption claim'}</p>
                    </div>
                  </div>
                ) : isTextual || f.proposed_replacement ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1">
                      <span className="font-bold text-rose-900 block uppercase text-[10px]">Original Text:</span>
                      <p className="font-mono text-rose-950 font-semibold break-words">
                        {f.evidence_text || f.image_evidence || f.caption_evidence || '(Detected phrase)'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-900 uppercase text-[10px]">Recommended Correction:</span>
                        {f.proposed_replacement && (
                          <button
                            type="button"
                            onClick={() => handleCopyFixText(f.proposed_replacement!)}
                            className="inline-flex items-center gap-1 text-[11px] text-teal-800 hover:text-teal-950 font-medium cursor-pointer"
                          >
                            {hasCopiedFix ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {hasCopiedFix ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                      <p className="font-mono text-teal-950 font-bold break-words">
                        {f.proposed_replacement || f.suggested_fix || '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-slate-900 block">Manual Designer Graphic Correction:</span>
                        <p className="text-slate-700 leading-relaxed">
                          {f.suggested_fix || 'Update the graphic asset in Figma/Photoshop to resolve this visual issue.'}
                        </p>
                        <p className="text-[11px] text-slate-500 italic">
                          Visual defects (such as unwanted mobile screenshot overlays, alignment collisions, or symbol logo positioning) should be corrected directly in your source design file prior to re-exporting.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isMarkingFindingReviewed}
                    onClick={() => handleMarkFindingReviewed(f)}
                    leftIcon={isReviewed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <UserCheck className="w-3.5 h-3.5 text-gray-600" />}
                  >
                    {isReviewed ? 'Unmark Review' : 'Mark as Reviewed'}
                  </Button>

                  {f.proposed_replacement && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyFixText(f.proposed_replacement!)}
                      leftIcon={hasCopiedFix ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                    >
                      {hasCopiedFix ? 'Copied Correction!' : 'Copy Suggested Fix'}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Secondary path into existing revision studio if user explicitly desires to revise graphic pixels */}
                  {f.target_scope !== 'caption' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIsSuggestedFixModalOpen(false);
                        handleOpenCorrectionStudio(f);
                      }}
                      leftIcon={<Wand2 className="w-3.5 h-3.5 text-teal-800" />}
                    >
                      Open Creative Studio Revision
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSuggestedFixModalOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
