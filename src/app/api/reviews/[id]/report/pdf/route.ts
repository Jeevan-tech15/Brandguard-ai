import { NextRequest, NextResponse } from 'next/server';
import { getContentReviewById } from '@/lib/db';
import { generateReviewPdfReport } from '@/lib/reports/pdf-generator';

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

    const pdfBytes = await generateReviewPdfReport(review);
    const version = review.review_version || 1;
    const sanitizedTitle = (review.title || 'Campaign-Post')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'Campaign-Post';
    const filename = `BrandGuard_Report_${sanitizedTitle}_v${version}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(pdfBytes.length),
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    console.error('PDF report generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}
