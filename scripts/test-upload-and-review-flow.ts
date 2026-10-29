import fs from 'fs';
import path from 'path';
import { createContentReview, getContentReviewById } from '../src/lib/db';

async function main() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — IMAGE UPLOAD & REVIEW PERSISTENCE VERIFICATION');
  console.log('================================================================\n');

  // 1. Prepare real supported image
  const sampleImagePath = path.join(process.cwd(), 'public', 'uploads', 'creatives', 'sample-compliant-post.png');
  if (!fs.existsSync(sampleImagePath)) {
    throw new Error('Sample image not found: ' + sampleImagePath);
  }
  const fileBuffer = fs.readFileSync(sampleImagePath);

  // 2. Test /api/upload via direct route invocation or fetch against local dev server
  console.log('--- Step 1: Testing /api/upload with real marketing image ---');
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  const form = new FormData();
  form.append('file', blob, 'sample-compliant-post.png');
  form.append('category', 'creatives');

  const uploadRes = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: form,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Upload failed HTTP ${uploadRes.status}: ${errText}`);
  }

  const uploadData = await uploadRes.json();
  console.log('Upload response:');
  console.log('  success:', uploadData.success);
  console.log('  storage_location:', uploadData.storage_location);
  console.log('  url:', uploadData.url.startsWith('data:') ? uploadData.url.slice(0, 50) + '... (data URL)' : uploadData.url);
  console.log('  width:', uploadData.width, 'height:', uploadData.height);
  console.log('  aspect_ratio:', uploadData.aspect_ratio);

  if (!uploadData.url) {
    throw new Error('Upload succeeded but returned no URL');
  }
  console.log('✓ [PASS] Step 1: Image uploaded successfully\n');

  // 3. Test submitting a review with the uploaded image
  console.log('--- Step 2: Creating Review with Uploaded Image ---');
  const review = await createContentReview({
    title: 'Vercel Deploy Verification Creative Campaign',
    content_type: 'social_media',
    content_text: 'Acme Enterprise verified uptime SLA with SOC-2 compliance.',
    caption_text: 'Acme Enterprise verified uptime SLA with SOC-2 compliance.',
    image_url: uploadData.url,
    aspect_ratio: uploadData.aspect_ratio,
    image_width: uploadData.width,
    image_height: uploadData.height,
  });

  console.log('Review created:');
  console.log('  id:', review.id);
  console.log('  status:', review.status);
  console.log('  compliance_score:', review.compliance_score);
  console.log('  image_url:', review.image_url?.startsWith('data:') ? review.image_url.slice(0, 50) + '...' : review.image_url);
  console.log('  findings count:', review.findings?.length || 0);

  // 4. Verify review is persisted and retrievable
  console.log('\n--- Step 3: Verifying Review Persistence & Accessibility ---');
  const fetched = await getContentReviewById(review.id);
  if (!fetched) {
    throw new Error('Review could not be retrieved by ID!');
  }
  if (!fetched.image_url) {
    throw new Error('Retrieved review is missing image_url!');
  }
  console.log('✓ [PASS] Step 3: Review confirmed persisted with image and retrievable by ID');

  console.log('\n================================================================');
  console.log(' ALL UPLOAD & PERSISTENCE TESTS PASSED');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
