import { NextRequest, NextResponse } from 'next/server';
import { getContentReviews, createContentReview, getDashboardMetrics } from '@/lib/db';
import { CreateReviewPayload } from '@/lib/types';
import { getServerDbConfigStatus } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const content_type = searchParams.get('content_type') || undefined;
  const search = searchParams.get('search') || undefined;

  try {
    const [reviews, metrics] = await Promise.all([
      getContentReviews({ status, content_type, search }),
      getDashboardMetrics(),
    ]);

    const dbStatus = getServerDbConfigStatus();

    return NextResponse.json({
      configured: dbStatus.isConfigured,
      reviews,
      metrics,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateReviewPayload = await req.json();

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Review title or campaign name is required.' }, { status: 400 });
    }

    const hasImage = Boolean(body.image_url && body.image_url.trim());

    if (!hasImage) {
      return NextResponse.json(
        { error: 'Please upload a marketing creative image to review. BrandGuard operates in image-only analysis mode.' },
        { status: 400 }
      );
    }

    if (!body.content_type) {
      return NextResponse.json({ error: 'Content type is required.' }, { status: 400 });
    }

    const review = await createContentReview({
      title: body.title.trim(),
      content_text: body.content_text?.trim() || `[Image Creative: ${body.image_url}]`,
      content_type: body.content_type,
      image_url: body.image_url,
      caption_text: body.caption_text?.trim() || undefined,
      aspect_ratio: body.aspect_ratio,
      image_width: body.image_width,
      image_height: body.image_height,
      save_as_draft: body.save_as_draft,
      status: body.status,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create review' },
      { status: 500 }
    );
  }
}
