import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { extractImageDimensions, classifyAspectRatio } from '@/lib/image-utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const assetCategory = (formData.get('category') as string) || 'creatives'; // 'creatives' or 'brand_assets'

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided in upload request.' },
        { status: 400 }
      );
    }

    // 1. Validate File MIME Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file format "${file.type}". BrandGuard AI supports PNG, JPG, JPEG, WebP, and SVG marketing creatives.`,
        },
        { status: 400 }
      );
    }

    // 2. Validate File Size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds the 10MB limit (File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB). Please compress or resize the creative.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract Dimensions and Aspect Ratio
    const dimensions = extractImageDimensions(buffer, file.type);
    const width = dimensions?.width || 1080;
    const height = dimensions?.height || 1080;
    const aspectRatio = classifyAspectRatio(width, height);

    let uploadBuffer = buffer;
    if (buffer.length > 2 * 1024 * 1024 && file.type !== 'image/svg+xml') {
      try {
        const sharp = (await import('sharp')).default;
        const optimized = await sharp(buffer)
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .png({ quality: 80, compressionLevel: 8 })
          .toBuffer();
        if (optimized.length < buffer.length) {
          uploadBuffer = optimized;
        }
      } catch {
        // Fallback to original buffer
      }
    }

    // 4. Generate Safe Filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeName = `${crypto.randomUUID()}.${ext}`;

    const uploadSubdir = assetCategory === 'brand_assets' ? 'assets' : 'creatives';
    let publicUrl = '';
    let uploadedToCloud = false;
    let localSaved = false;

    // 5. Cloud Storage: Upload to Supabase Storage if configured
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const bucketName = assetCategory === 'brand_assets' ? 'brand-assets' : 'brandguard-creatives';
      try {
        const uploadPromise = supabase.storage
          .from(bucketName)
          .upload(safeName, uploadBuffer, {
            contentType: file.type,
            upsert: true,
          });

        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'Supabase storage upload timeout (10s)' } }), 10000)
        );

        const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
        if (uploadResult.error) {
          console.warn(`Supabase Storage upload to bucket "${bucketName}" notice:`, uploadResult.error.message);
        } else if (uploadResult.data) {
          const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(safeName);
          if (publicData?.publicUrl) {
            publicUrl = publicData.publicUrl;
            uploadedToCloud = true;
          }
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload exception:', storageErr instanceof Error ? storageErr.message : storageErr);
      }
    }

    // 6. Local Storage: Save to local disk if running in writable environment (e.g. local dev)
    try {
      const targetDir = path.join(process.cwd(), 'public', 'uploads', uploadSubdir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const filePath = path.join(targetDir, safeName);
      fs.writeFileSync(filePath, uploadBuffer);
      localSaved = true;

      // If cloud upload was not performed or failed, use the verified local path
      if (!publicUrl) {
        publicUrl = `/uploads/${uploadSubdir}/${safeName}`;
      }
    } catch {
      // In serverless environments (like Vercel read-only filesystem), local disk write is safely bypassed
    }

    // 7. Inline Data URL Fallback: If both cloud storage and local disk are unavailable, use inline data URL
    if (!publicUrl) {
      publicUrl = `data:${file.type};base64,${uploadBuffer.toString('base64')}`;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      width,
      height,
      aspect_ratio: aspectRatio.label,
      aspect_ratio_ratio: aspectRatio.ratio,
      sizeBytes: file.size,
      mimeType: file.type,
      storage_location: uploadedToCloud
        ? 'supabase_storage'
        : localSaved
          ? 'local_persistent_storage'
          : 'inline_data_payload',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during image upload.';
    console.error('Image upload failed:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
