import { NextRequest, NextResponse } from 'next/server';
import { updateFindingResolutionStatus, getContentReviewById } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await segmentData.params;
    const body = await req.json();

    const { findingId, resolution_status = 'reviewed' } = body;

    if (!findingId || typeof findingId !== 'string') {
      return NextResponse.json(
        { error: 'findingId is required' },
        { status: 400 }
      );
    }

    const review = await getContentReviewById(reviewId);
    if (!review) {
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }

    const updated = await updateFindingResolutionStatus(
      reviewId,
      findingId,
      resolution_status as 'unresolved' | 'resolved' | 'reviewed' | 'overridden'
    );

    return NextResponse.json({
      success: true,
      message: `Finding updated to ${resolution_status}`,
      review: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update finding status' },
      { status: 500 }
    );
  }
}

