import { NextRequest, NextResponse } from 'next/server';
import {
  getBrandGuidelines,
  createBrandGuideline,
  updateBrandGuideline,
  deleteBrandGuideline,
  toggleBrandGuidelineActive,
} from '@/lib/db';
import { CreateGuidelinePayload, UpdateGuidelinePayload } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get('active') === 'true';
    const guidelines = await getBrandGuidelines(onlyActive);
    return NextResponse.json({ guidelines });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch guidelines' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateGuidelinePayload = await req.json();

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Guideline title is required.' }, { status: 400 });
    }
    if (!body.description || !body.description.trim()) {
      return NextResponse.json({ error: 'Guideline description is required.' }, { status: 400 });
    }
    if (!body.rule_type) {
      return NextResponse.json({ error: 'Rule type is required.' }, { status: 400 });
    }

    const guideline = await createBrandGuideline({
      title: body.title.trim(),
      description: body.description.trim(),
      rule_type: body.rule_type,
      severity: body.severity || 'medium',
      rule_configuration: body.rule_configuration || {},
      is_active: body.is_active !== undefined ? body.is_active : true,
    });

    return NextResponse.json({ guideline }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create guideline' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: { id: string } & UpdateGuidelinePayload = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Guideline ID is required for update.' }, { status: 400 });
    }

    // Toggle active only if is_active is the only field
    if (Object.keys(body).length === 2 && body.is_active !== undefined) {
      const guideline = await toggleBrandGuidelineActive(body.id, body.is_active);
      return NextResponse.json({ guideline });
    }

    const guideline = await updateBrandGuideline(body.id, {
      title: body.title,
      description: body.description,
      rule_type: body.rule_type,
      severity: body.severity,
      rule_configuration: body.rule_configuration,
      is_active: body.is_active,
    });

    return NextResponse.json({ guideline });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update guideline' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Guideline ID is required.' }, { status: 400 });
    }

    await deleteBrandGuideline(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete guideline' },
      { status: 500 }
    );
  }
}
