import { NextRequest, NextResponse } from 'next/server';
import { createReviewDecision } from '@/lib/db';
import { CreateDecisionPayload, ReviewDecisionType } from '@/lib/types';

export async function POST(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await segmentData.params;
    const body: CreateDecisionPayload = await req.json();

    const validDecisions: ReviewDecisionType[] = ['approved', 'flagged', 'rejected', 'changes_requested'];
    if (!validDecisions.includes(body.decision)) {
      return NextResponse.json(
        { error: `Invalid decision. Must be one of: ${validDecisions.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.reviewer_label || !body.reviewer_label.trim()) {
      return NextResponse.json({ error: 'Reviewer title/label is required.' }, { status: 400 });
    }

    const decision = await createReviewDecision(reviewId, {
      decision: body.decision,
      reviewer_label: body.reviewer_label.trim(),
      comments: body.comments?.trim() || undefined,
      is_override: Boolean(body.is_override),
      override_reason: body.override_reason?.trim() || undefined,
    });

    return NextResponse.json({ decision }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to record reviewer decision';
    const isValidationError = errorMsg.includes('Approval blocked') || errorMsg.includes('Invalid decision');
    return NextResponse.json(
      { error: errorMsg },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
