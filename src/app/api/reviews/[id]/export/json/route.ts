import { NextRequest, NextResponse } from 'next/server';
import { getContentReviewById } from '@/lib/db';

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    if (!id) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
    }

    const review = await getContentReviewById(id);
    if (!review) {
      return NextResponse.json({ error: `Review ${id} not found` }, { status: 404 });
    }

    const version = review.review_version || 1;
    const sanitizedTitle = (review.title || 'Data-Export')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'Data-Export';
    const filename = `BrandGuard_Data_${sanitizedTitle}_v${version}.json`;

    // Prepare safe, judge-friendly export payload without internal server secrets
    const exportPayload = {
      brandguard_export_version: '1.0',
      exported_at: new Date().toISOString(),
      disclaimer: 'This export summarizes automated checks performed by BrandGuard AI. It does not guarantee legal or regulatory compliance. Human review is required.',
      review: {
        id: review.id,
        title: review.title,
        content_type: review.content_type,
        review_version: review.review_version || 1,
        status: review.status,
        compliance_score: review.compliance_score,
        aspect_ratio: review.aspect_ratio,
        image_dimensions: review.image_width && review.image_height ? { width: review.image_width, height: review.image_height } : null,
        created_at: review.created_at,
        updated_at: review.updated_at,
      },
      content: {
        creative_image_url: review.image_url || null,
        original_creative_image_url: review.original_image_url || null,
        corrected_creative_image_url: review.corrected_image_url || null,
        extracted_ocr_text: review.extracted_ocr_text || null,
        version_progression: {
          has_corrected_version: Boolean((review.review_version || 1) > 1),
          pixel_edit_applied: Boolean(review.correction_metadata?.edit_applied_to_pixels),
        },
      },
      evaluation: {
        completeness: (review.evaluation_metadata?.scoringBreakdown as { isPartialAnalysis?: boolean } | undefined)?.isPartialAnalysis || review.evaluation_metadata?.isPartialAnalysis
          ? 'partial'
          : 'complete',
        scoring_breakdown: review.evaluation_metadata?.scoringBreakdown || null,
        checks_completed: review.evaluation_metadata?.checksCompleted || null,
        checks_status: review.evaluation_metadata?.checksStatus || null,
        disclosures: review.evaluation_metadata?.disclosures || [],
      },
      findings: (review.findings || []).map((f, idx) => ({
        index: idx + 1,
        id: f.id,
        title: f.finding_title,
        category: f.category,
        severity: f.severity,
        explanation: f.explanation,
        evidence_text: f.evidence_text || null,
        confidence: f.confidence,
        suggested_fix: f.suggested_fix || null,
        source: f.source,
        verification_status: f.verification_status,
        resolution_status: f.resolution_status || 'unresolved',
        bounding_box: f.bounding_box || null,
      })),
      decisions: (review.decisions || []).map((d) => ({
        id: d.id,
        decision: d.decision,
        reviewer_label: d.reviewer_label,
        comments: d.comments || null,
        created_at: d.created_at,
      })),
    };

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    console.error('JSON export error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to export review JSON' },
      { status: 500 }
    );
  }
}
