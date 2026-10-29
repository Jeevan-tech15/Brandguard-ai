import { NextRequest, NextResponse } from 'next/server';
import {
  getApprovedFacts,
  createApprovedFact,
  updateApprovedFact,
  deleteApprovedFact,
  toggleApprovedFactActive,
} from '@/lib/db';
import { CreateFactPayload, UpdateFactPayload } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get('active') === 'true';
    const facts = await getApprovedFacts(onlyActive);
    return NextResponse.json({ facts });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch approved facts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateFactPayload = await req.json();

    if (!body.fact_text || !body.fact_text.trim()) {
      return NextResponse.json({ error: 'Fact text is required.' }, { status: 400 });
    }
    if (!body.source_name || !body.source_name.trim()) {
      return NextResponse.json({ error: 'Source name is required.' }, { status: 400 });
    }

    const fact = await createApprovedFact({
      fact_text: body.fact_text.trim(),
      source_name: body.source_name.trim(),
      source_url: body.source_url?.trim() || undefined,
      evidence_notes: body.evidence_notes?.trim() || undefined,
      is_active: body.is_active !== undefined ? body.is_active : true,
    });

    return NextResponse.json({ fact }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create approved fact' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: { id: string } & UpdateFactPayload = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Fact ID is required for update.' }, { status: 400 });
    }

    // Toggle active only
    if (Object.keys(body).length === 2 && body.is_active !== undefined) {
      const fact = await toggleApprovedFactActive(body.id, body.is_active);
      return NextResponse.json({ fact });
    }

    const fact = await updateApprovedFact(body.id, {
      fact_text: body.fact_text,
      source_name: body.source_name,
      source_url: body.source_url,
      evidence_notes: body.evidence_notes,
      is_active: body.is_active,
    });

    return NextResponse.json({ fact });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update approved fact' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Fact ID is required.' }, { status: 400 });
    }

    await deleteApprovedFact(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete approved fact' },
      { status: 500 }
    );
  }
}
