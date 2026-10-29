import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthorizedAssets,
  createAuthorizedAsset,
  updateAuthorizedAsset,
  deleteAuthorizedAsset,
  toggleAuthorizedAssetActive,
} from '@/lib/db';
import { CreateAssetPayload, UpdateAssetPayload } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get('active') === 'true';
    const assets = await getAuthorizedAssets(onlyActive);
    return NextResponse.json({ assets });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch authorized assets' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateAssetPayload = await req.json();

    if (!body.asset_name || !body.asset_name.trim()) {
      return NextResponse.json({ error: 'Asset name is required.' }, { status: 400 });
    }
    if (!body.asset_type) {
      return NextResponse.json({ error: 'Asset type is required.' }, { status: 400 });
    }
    if (!body.file_url || !body.file_url.trim()) {
      return NextResponse.json({ error: 'Asset file URL or resource path is required.' }, { status: 400 });
    }

    const asset = await createAuthorizedAsset({
      asset_name: body.asset_name.trim(),
      asset_type: body.asset_type,
      file_url: body.file_url.trim(),
      asset_metadata: body.asset_metadata || {},
      is_active: body.is_active !== undefined ? body.is_active : true,
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create authorized asset' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: { id: string; action?: string; is_active?: boolean } & UpdateAssetPayload = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Asset ID is required.' }, { status: 400 });
    }

    if (body.action === 'toggle' && typeof body.is_active === 'boolean') {
      const updated = await toggleAuthorizedAssetActive(body.id, body.is_active);
      return NextResponse.json({ asset: updated });
    }

    const updated = await updateAuthorizedAsset(body.id, {
      asset_name: body.asset_name,
      asset_type: body.asset_type,
      file_url: body.file_url,
      asset_metadata: body.asset_metadata,
      is_active: body.is_active,
    });

    return NextResponse.json({ asset: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update authorized asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required.' }, { status: 400 });
    }

    await deleteAuthorizedAsset(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete authorized asset' },
      { status: 500 }
    );
  }
}
