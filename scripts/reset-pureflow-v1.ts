import { runComplianceReview } from '../src/lib/engine';
import { getBrandGuidelines, getApprovedFacts, getAuthorizedAssets, saveReviewEvaluation } from '../src/lib/db';
import { ContentReview, ReviewFinding } from '../src/lib/types';
import fs from 'fs';
import path from 'path';

async function resetPureFlow() {
  const reviewId = '2e89a59f-c495-4229-9962-9cde53d60837';
  const dbPath = path.join(process.cwd(), '.data', 'db.json');
  const store = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  const review = store.content_reviews.find((r: ContentReview) => r.id === reviewId);
  if (!review) {
    console.error('PureFlow review not found!');
    process.exit(1);
  }

  const originalCaption =
    'Hydration made easy! Stay fresh and active with PureFlow. Keeps your drinks cold for 24 hours. Get yours today and enjoy 50% OFF for a limited time! #PureFlow #StayHydrated #EcoFriendly';
  const originalImage = '/uploads/creatives/2f2c91a7-5ed0-4738-85bb-76815be372bb.png';

  // Ensure clean creative image is in place
  fs.copyFileSync(
    path.join(process.cwd(), 'public', 'uploads', 'creatives', '37688f55-3192-48a7-990f-64b2b52a5f65.png'),
    path.join(process.cwd(), 'public', 'uploads', 'creatives', '2f2c91a7-5ed0-4738-85bb-76815be372bb.png')
  );

  review.title = 'PureFlow Hydration Adventure Ad Campaign Post';
  review.content_text = originalCaption;
  review.caption_text = originalCaption;
  review.original_caption_text = originalCaption;
  review.image_url = originalImage;
  review.original_image_url = originalImage;
  review.review_version = 1;
  review.status = 'in_review';
  review.compliance_score = null;
  review.corrected_image_url = null;
  review.correction_metadata = null;
  review.updated_at = new Date().toISOString();

  // Remove existing findings for this review
  store.review_findings = store.review_findings.filter((f: ReviewFinding) => f.review_id !== reviewId);
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf-8');

  // Run real compliance engine
  const [g, f, a] = await Promise.all([
    getBrandGuidelines(true),
    getApprovedFacts(true),
    getAuthorizedAssets(true),
  ]);

  const evalResult = await runComplianceReview(originalCaption, 'social_media', g, f, {
    imageUrl: originalImage,
    captionText: originalCaption,
    assets: a,
  });

  const updatedReview = await saveReviewEvaluation(reviewId, evalResult);

  // If Supabase is connected, ensure review_version and content are reset on remote table as well
  const { getSupabaseServerClient, getServerDbConfigStatus } = await import('../src/lib/supabase/server');
  if (getServerDbConfigStatus().isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from('content_reviews').update({
        review_version: 1,
        content_text: originalCaption,
        caption_text: originalCaption,
        original_caption_text: originalCaption,
        image_url: originalImage,
        original_image_url: originalImage,
        corrected_image_url: null,
        correction_metadata: null,
      }).eq('id', reviewId);
    }
  }

  console.log('PureFlow reset to Version 1 successfully!');
  console.log('Version:', updatedReview.review_version);
  console.log('Score:', updatedReview.compliance_score);
  console.log('Status:', updatedReview.status);
  console.log('Findings count:', updatedReview.findings?.length);
  updatedReview.findings?.forEach((f, i) => {
    console.log(` #${i + 1}: ${f.finding_title} | Scope: ${f.target_scope} | Target: ${f.caption_evidence} | Proposed: ${f.proposed_replacement}`);
  });
}

resetPureFlow().catch(console.error);
