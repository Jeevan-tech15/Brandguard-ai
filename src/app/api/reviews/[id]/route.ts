import { NextRequest, NextResponse } from 'next/server';
import { getContentReviewById, updateContentReviewVersion } from '@/lib/db';


export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const review = await getContentReviewById(id);

    if (!review) {
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database query failed' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const body = await req.json();

    const existing = await getContentReviewById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }

    const updatedReview = await updateContentReviewVersion(id, {
      title: body.title,
      content_text: body.content_text || existing.content_text,
      caption_text: body.caption_text,
      content_type: body.content_type,
      image_url: body.image_url,
      corrected_image_url: body.corrected_image_url,
      correction_metadata: body.correction_metadata,
    });

    return NextResponse.json({
      success: true,
      message: `Review version ${updatedReview.review_version} created and evaluated successfully.`,
      review: updatedReview,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update review version' },
      { status: 500 }
    );
  }
}
