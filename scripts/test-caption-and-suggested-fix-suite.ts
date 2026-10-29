import fs from 'fs';
import { runComplianceReview } from '../src/lib/engine';
import { getContentReviewById, updateFindingResolutionStatus } from '../src/lib/db';
import { BrandGuideline, ApprovedFact, AuthorizedAsset } from '../src/lib/types';

async function runCaptionAndSuggestedFixSuite() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — CAPTION & SUGGESTED FIX REGRESSION SUITE       ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS ✓] ${testName}`);
      if (details) console.log(`         ${details}`);
    } else {
      console.error(`[FAIL ✗] ${testName}`);
      if (details) console.error(`         ${details}`);
    }
  }

  const db = JSON.parse(fs.readFileSync('.data/db.json', 'utf8'));
  const guidelines: BrandGuideline[] = db.brand_guidelines || [];
  const facts: ApprovedFact[] = db.approved_facts || [];
  const assets: AuthorizedAsset[] = db.authorized_assets || [];

  // -------------------------------------------------------------------------
  // TEST 1: Image-Only Review with Caption Omitted
  // Empty caption must not block submission or change image-only results.
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Image-Only Review (Caption Omitted) ---');
  const imageOnlyRes = await runComplianceReview(
    'Image Only Banner Review',
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: 'public/uploads/creatives/365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg',
      captionText: undefined,
      assets,
      skipAI: true,
    }
  );

  assert(imageOnlyRes.findings.length > 0, '1A: Image findings detected without caption', `Findings count: ${imageOnlyRes.findings.length}`);
  assert(imageOnlyRes.findings.every(f => f.target_scope === 'image'), '1B: All findings assigned target_scope: "image"');
  assert(imageOnlyRes.status !== 'approved', '1C: Status correctly flagged based on image defects alone', `Status: ${imageOnlyRes.status}`);

  // -------------------------------------------------------------------------
  // TEST 2: Review with Clean Caption
  // Caption is audited, no false contradictions generated.
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Review with Clean Caption ---');
  const cleanCaption = 'Elevate your enterprise events with custom printed banners. High-quality display graphics.';
  const cleanCapRes = await runComplianceReview(
    'Clean Caption Banner Review',
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: 'public/uploads/creatives/365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg',
      captionText: cleanCaption,
      assets,
      skipAI: true,
    }
  );

  const cleanCapFindings = cleanCapRes.findings.filter(f => f.target_scope === 'caption');
  assert(cleanCapFindings.length === 0, '2A: Clean caption produces zero false caption violations', `Caption findings: ${cleanCapFindings.length}`);

  // -------------------------------------------------------------------------
  // TEST 3: Review with Caption Containing Typos
  // Must distinguish Caption Finding from Image Finding, with no image bbox.
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Review with Typo in Caption ---');
  const typoCaption = 'Get offfer disscount on chiken sandwitch untill tomorow!';
  const typoCapRes = await runComplianceReview(
    'Typo Caption Review',
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: 'public/uploads/creatives/logo-test-2-wordmark.png',
      captionText: typoCaption,
      assets,
      skipAI: true,
    }
  );

  const captionTypoFindings = typoCapRes.findings.filter(f => f.target_scope === 'caption');
  assert(captionTypoFindings.length > 0, '3A: Caption spelling/typo findings detected', `Detected: ${captionTypoFindings.map(f => f.finding_title).join(', ')}`);
  assert(captionTypoFindings.every(f => f.bounding_box === null), '3B: Caption findings do NOT have image bounding boxes');
  assert(captionTypoFindings.some(f => f.source === 'caption'), '3C: Findings correctly marked with source: "caption"');

  // -------------------------------------------------------------------------
  // TEST 4: Image–Caption Inconsistency (Discount Discrepancy)
  // Image says "10% DISCOUNT", Caption says "Get 50% discount today!"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Image–Caption Discount Contradiction ---');
  const conflictCaption = 'Special flash sale! Get 50% discount on all custom banners!';
  const conflictRes = await runComplianceReview(
    'Discount Conflict Review',
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: 'public/uploads/creatives/365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg',
      captionText: conflictCaption,
      assets,
      skipAI: true,
    }
  );

  const discountConflict = conflictRes.findings.find(f => f.category === 'cross_modal_conflict');
  assert(Boolean(discountConflict), '4A: Cross-modal discount conflict detected', `Conflict: ${discountConflict?.finding_title}`);
  assert(discountConflict?.target_scope === 'both', '4B: Conflict has target_scope: "both"');
  assert(Boolean(discountConflict?.image_evidence && discountConflict?.caption_evidence), '4C: Both image and caption evidence captured', `Image: "${discountConflict?.image_evidence}", Caption: "${discountConflict?.caption_evidence}"`);

  // -------------------------------------------------------------------------
  // TEST 5: Image–Caption Inconsistency (Promotional Deadline Contradiction)
  // Image says "OFFER VALID TILL 30th SEPTEMBER 2026", Caption says "Offer valid till 15th November 2026"
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Image–Caption Promotional Deadline Contradiction ---');
  const deadlineCaption = 'Limited time promotion! Offer valid till 15th November 2026 for all enterprise customers.';
  const deadlineConflictRes = await runComplianceReview(
    'Deadline Conflict Review',
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: 'public/uploads/creatives/365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg',
      captionText: deadlineCaption,
      assets,
      skipAI: true,
    }
  );

  const deadlineConflict = deadlineConflictRes.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('deadline'));
  assert(Boolean(deadlineConflict), '5A: Cross-modal deadline conflict detected', `Conflict: ${deadlineConflict?.finding_title}`);
  assert(deadlineConflict?.target_scope === 'both', '5B: Deadline conflict has target_scope: "both"');

  // -------------------------------------------------------------------------
  // TEST 6: Legacy Review Handling (No Caption in Database)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Legacy Review Handling (No Caption) ---');
  const legacyReview = await getContentReviewById('f933ffa2-f434-42c7-86cd-a266e993d8ac');
  assert(Boolean(legacyReview), '6A: Legacy review loads successfully from database');
  assert(Array.isArray(legacyReview?.findings), '6B: Legacy review findings array intact');

  // -------------------------------------------------------------------------
  // TEST 7: Mark Finding as Reviewed (Persistence Verification)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Mark Finding as Reviewed Persistence ---');
  if (legacyReview && legacyReview.findings && legacyReview.findings.length > 0) {
    const targetFinding = legacyReview.findings[0];
    const initialResolution = targetFinding.resolution_status || 'unresolved';

    // Toggle to 'reviewed'
    const updated = await updateFindingResolutionStatus(legacyReview.id, targetFinding.id, 'reviewed');
    const updatedFinding = updated?.findings?.find(f => f.id === targetFinding.id);
    assert(updatedFinding?.resolution_status === 'reviewed', '7A: Finding resolution_status updated to "reviewed" in local store');

    // Restore to initial resolution
    await updateFindingResolutionStatus(legacyReview.id, targetFinding.id, initialResolution as any);
    const restored = await getContentReviewById(legacyReview.id);
    const restoredFinding = restored?.findings?.find(f => f.id === targetFinding.id);
    assert(restoredFinding?.resolution_status === initialResolution, '7B: Finding restored cleanly to initial state');
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} / ${total} CHECKS PASSED (${Math.round((passed / total) * 100)}%) `);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runCaptionAndSuggestedFixSuite().catch((err) => {
  console.error('Caption suite fatal error:', err);
  process.exit(1);
});
