import { NextRequest, NextResponse } from 'next/server';
import { initializeBrandRulesAndFacts } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const brandName = (body.brand_name || body.brandName || '').trim() || 'Acme Enterprise';

    const result = await initializeBrandRulesAndFacts(brandName);

    return NextResponse.json({
      success: true,
      message: `Successfully initialized brand governance setup for "${brandName}".`,
      ...result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initialize brand setup' },
      { status: 500 }
    );
  }
}
