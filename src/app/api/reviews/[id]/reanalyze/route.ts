import { NextRequest, NextResponse } from 'next/server';
import { reanalyzeCorrectedImage } from '@/lib/db';

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const body = await req.json();

    const hasImage = typeof body.corrected_image_url === 'string' && body.corrected_image_url.trim().length > 0;

    if (!hasImage) {
      return NextResponse.json(
        { error: 'A corrected or replacement image is required to perform visual reanalysis.' },
        { status: 400 }
      );
    }

    const result = await reanalyzeCorrectedImage(id, {
      correctedImageUrl: body.corrected_image_url.trim(),
      correctionMetadata: {
        replaced_text: body.correction_metadata?.replaced_text,
        new_text: body.correction_metadata?.new_text,
        target_scope: 'image',
        replaced_asset_id: body.correction_metadata?.replaced_asset_id,
        edit_applied_to_pixels: body.correction_metadata?.edit_applied_to_pixels ?? false,
        correction_notes: body.correction_metadata?.correction_notes || 'Re-analyzed designer-revised creative graphic.',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Creative re-analyzed successfully. ${result.resolvedFindings.length} issue(s) resolved, ${result.remainingFindings.length} remaining.`,
      review: result.review,
      resolvedFindings: result.resolvedFindings,
      remainingFindings: result.remainingFindings,
      unverifiedFindings: result.unverifiedFindings,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reanalysis failed.' },
      { status: 500 }
    );
  }
}
