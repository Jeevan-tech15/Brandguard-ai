import { NextRequest, NextResponse } from 'next/server';
import {
  getContentReviewById,
  getBrandGuidelines,
  getApprovedFacts,
  getAuthorizedAssets,
  saveReviewEvaluation,
} from '@/lib/db';
import { runComplianceReview } from '@/lib/engine';

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const review = await getContentReviewById(id);

    if (!review) {
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }

    // Load active guidelines, approved facts, and authorized visual assets
    const [guidelines, facts, assets] = await Promise.all([
      getBrandGuidelines(true),
      getApprovedFacts(true),
      getAuthorizedAssets(true),
    ]);

    // Parse options (e.g. skipAI, ocrReferenceText)
    let body: { skipAI?: boolean; ocrReferenceText?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const result = await runComplianceReview(
      review.content_text,
      review.content_type,
      guidelines,
      facts,
      {
        skipAI: body.skipAI,
        imageUrl: review.image_url || undefined,
        captionText: review.caption_text || undefined,
        assets,
        ocrReferenceText: body.ocrReferenceText || undefined,
      }
    );

    const updatedReview = await saveReviewEvaluation(id, result);

    return NextResponse.json({
      success: true,
      review: updatedReview,
      evaluation: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Evaluation failed' },
      { status: 500 }
    );
  }
}
