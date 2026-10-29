import { NextRequest, NextResponse } from 'next/server';
import { getBrandProfile, saveBrandProfile } from '@/lib/db';
import { BrandProfile } from '@/lib/types';

export async function GET() {
  try {
    const profile = await getBrandProfile();
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch brand profile' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Partial<BrandProfile> = await req.json();

    if (body.brand_name !== undefined && !body.brand_name.trim()) {
      return NextResponse.json({ error: 'Brand name cannot be blank.' }, { status: 400 });
    }

    // Validate hex colors if provided
    if (body.brand_colors && Array.isArray(body.brand_colors)) {
      const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      for (const col of body.brand_colors) {
        if (!hexRegex.test(col.trim())) {
          return NextResponse.json(
            { error: `Invalid hex color code "${col}". Must be in format #RRGGBB or #RGB.` },
            { status: 400 }
          );
        }
      }
    }

    const saved = await saveBrandProfile(body);
    return NextResponse.json({ profile: saved }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save brand profile' },
      { status: 500 }
    );
  }
}
