/**
 * BrandGuard AI — GreenLife Cross-Modal & Claim Governance Regression Suite
 * Tests Phase 4 & Phase 5 requirements:
 * A. Cooling duration conflict detection (Image: 24 hours vs Caption: 48 hours)
 * B. Discount percentage conflict detection (Image: 50% OFF vs Caption: 80% discount)
 * C. Certification & environmental claims requiring supporting evidence (flagged unverified, not false)
 * D. Source attribution in evidence (distinguishing Image vs Caption)
 * E. Database / Supabase persistence of review, findings, and flagged status
 * F. Verification of real image OCR pipeline on uploaded GreenLife creative PNG
 * G. Compliant content achieves 100% without fabricated faults
 */

import { runComplianceReview } from '../src/lib/engine';
import { runCrossModalChecks } from '../src/lib/engine/cross-modal';
import { runFactChecks } from '../src/lib/engine/fact-checker';
import { runVisionAnalysis } from '../src/lib/engine/vision-analyzer';
import {
  createContentReview,
  getContentReviewById,
  getBrandGuidelines,
  getApprovedFacts,
  getAuthorizedAssets,
} from '../src/lib/db';
import path from 'path';
import fs from 'fs';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function runGreenLifeRegressionSuite() {
  console.log('===============================================================');
  console.log('BRANDGUARD AI: GREENLIFE PIPELINE REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  // Exact Test Case Specifications from Prompt C Phase 4
  const imageOcrReference = `
Brand: GreenLife
Sustainable Living
Pure Water. Better You.
Our eco-friendly bottles keep you hydrated and help you save the planet.
100% Certified Sustainable
FLAT 50% OFF LIMITED TIME ONLY
Keeps Drinks Cold — For up to 24 hours
BPA Free Safe for everyday use
Durable & Stylish Perfect for on-the-go
Plastic Free Lifestyle | Help Reduce Ocean Waste | Good for You Good for Earth
Shop Now
  `.trim();

  const captionText = `Introducing GreenLife — the world's first 100% certified sustainable bottle!

Keep your drinks cold for 48 hours and get an exclusive 80% discount today!

Our bottle is scientifically proven to eliminate ocean plastic pollution completely. Officially certified by every major environmental authority, it is guaranteed to be 100% plastic-free.`.trim();

  const [activeGuidelines, activeFacts, activeAssets] = await Promise.all([
    getBrandGuidelines(true),
    getApprovedFacts(true),
    getAuthorizedAssets(true),
  ]);

  // -----------------------------------------------------------------
  // STEP 1: Cross-Modal Unit Comparison Logic (Independent of OCR)
  // -----------------------------------------------------------------
  console.log('--- Step 1: Cross-Modal Consistency Engine Checks ---');
  const crossModalResult = runCrossModalChecks(imageOcrReference, captionText);
  const cmFindings = crossModalResult.findings;

  // Expected Result A: Cooling duration conflict (Image = 24h, Caption = 48h)
  const coolingFinding = cmFindings.find(
    (f) =>
      f.category === 'cross_modal_conflict' &&
      f.finding_title.toLowerCase().includes('cooling')
  );
  assert(Boolean(coolingFinding), 'A. Detects cooling-duration conflict between Image and Caption');
  assert(
    coolingFinding?.severity === 'critical',
    'A. Cooling duration contradiction assigned critical severity'
  );
  assert(
    Boolean(coolingFinding?.evidence_text?.includes('24 hours') && coolingFinding?.evidence_text?.includes('48 hours')),
    'A. Evidence cites exact conflicting cooling values (24 hours vs 48 hours)'
  );

  // Expected Result B: Discount conflict (Image = 50%, Caption = 80%)
  const discountFinding = cmFindings.find(
    (f) =>
      f.category === 'cross_modal_conflict' &&
      f.finding_title.toLowerCase().includes('discount')
  );
  assert(Boolean(discountFinding), 'B. Detects promotional discount conflict between Image and Caption');
  assert(
    discountFinding?.severity === 'critical',
    'B. Contradictory promotional discount assigned critical severity'
  );
  assert(
    Boolean(discountFinding?.evidence_text?.includes('50%') && discountFinding?.evidence_text?.includes('80%')),
    'B. Evidence cites exact conflicting discount values (50% OFF vs 80% discount)'
  );

  // Expected Result D: Return evidence showing exact conflicting values and source attribution
  assert(
    Boolean(
      coolingFinding?.evidence_text?.toLowerCase().includes('image') &&
      coolingFinding?.evidence_text?.toLowerCase().includes('caption')
    ),
    'D. Cooling evidence attributes source to Image and Caption'
  );
  assert(
    Boolean(
      discountFinding?.evidence_text?.toLowerCase().includes('image') &&
      discountFinding?.evidence_text?.toLowerCase().includes('caption')
    ),
    'D. Discount evidence attributes source to Image and Caption'
  );
  console.log();

  // -----------------------------------------------------------------
  // STEP 2: Environmental & Certification Claim Verification
  // -----------------------------------------------------------------
  console.log('--- Step 2: Environmental & Certification Claim Fact Checking ---');
  const factResult = runFactChecks(captionText, activeFacts, { sourceTag: 'caption' });
  const fFindings = factResult.findings;

  // Expected Result C: Identify certification and environmental claims requiring supporting evidence
  const envFinding = fFindings.find(
    (f) =>
      f.category === 'unsubstantiated_claim' &&
      f.evidence_text?.toLowerCase().includes('ocean plastic pollution')
  );
  assert(
    Boolean(envFinding),
    'C. Identifies scientific claim ("scientifically proven to eliminate ocean plastic pollution completely")'
  );
  assert(
    envFinding?.verification_status === 'unverified',
    'C. Environmental claim marked unverified pending empirical documentation (not declared definitively false)'
  );
  assert(
    Boolean(envFinding?.evidence_text?.startsWith('[CAPTION]:')),
    'D. Environmental claim evidence clearly attributes source to [CAPTION]'
  );

  const certFinding = fFindings.find(
    (f) =>
      f.category === 'unverified_certification' ||
      f.evidence_text?.toLowerCase().includes('environmental authority')
  );
  assert(
    Boolean(certFinding),
    'C. Identifies authority certification claim ("Officially certified by every major environmental authority")'
  );
  assert(
    certFinding?.verification_status === 'unverified',
    'C. Authority certification marked unverified requiring supporting certificates in registry'
  );
  console.log();

  // -----------------------------------------------------------------
  // STEP 3: Full End-to-End Compliance Evaluation with Fixed OCR
  // -----------------------------------------------------------------
  console.log('--- Step 3: Full Compliance Review Engine with Fixed OCR Reference ---');
  const reviewResult = await runComplianceReview(
    captionText,
    'social_media',
    activeGuidelines,
    activeFacts,
    {
      captionText,
      ocrReferenceText: imageOcrReference,
      assets: activeAssets,
    }
  );

  assert(
    reviewResult.status === 'flagged',
    `Review status correctly flagged due to critical contradictions (Got: "${reviewResult.status}")`
  );
  assert(
    reviewResult.compliance_score !== null && reviewResult.compliance_score < 60,
    `Compliance score penalized by documented severity deductions (Score: ${reviewResult.compliance_score}%)`
  );
  assert(
    reviewResult.findings.length >= 3,
    `Returns actual detected findings without dropping (Total findings: ${reviewResult.findings.length})`
  );
  assert(
    Boolean(reviewResult.extracted_ocr_text?.includes('FLAT 50% OFF')),
    'Preserves extracted OCR reference text in review result'
  );
  console.log();

  // -----------------------------------------------------------------
  // STEP 4: Database & Supabase Persistence
  // -----------------------------------------------------------------
  console.log('--- Step 4: Database Persistence & Retrieval Verification ---');
  const savedReview = await createContentReview(
    {
      title: 'GreenLife Eco Bottle Regression Test Post',
      content_type: 'social_media',
      caption_text: captionText,
      image_url: '/uploads/creatives/b64746e9-ac3d-462f-a1a6-5ff91ca18ba2.png',
      aspect_ratio: '1:1',
      image_width: 1254,
      image_height: 1254,
    },
    { ocrReferenceText: imageOcrReference }
  );

  assert(Boolean(savedReview.id), 'E. Saved review successfully created in database/Supabase');
  assert(savedReview.status === 'flagged', `E. Saved review status persisted as "flagged" (Got: "${savedReview.status}")`);
  assert(
    typeof savedReview.compliance_score === 'number' && savedReview.compliance_score < 60,
    `E. Saved review score accurately reflects deductions (Score: ${savedReview.compliance_score}%)`
  );

  // Retrieve back to ensure persistence
  const fetchedReview = await getContentReviewById(savedReview.id);
  assert(Boolean(fetchedReview), 'E. Retrieved persisted review from database');
  assert(
    (fetchedReview?.findings?.length || 0) >= 3,
    `F. Findings are preserved on retrieval and returned to review details (Found: ${fetchedReview?.findings?.length})`
  );
  console.log();

  // -----------------------------------------------------------------
  // STEP 5: Real Uploaded Image OCR & Vision Pipeline (on disk)
  // -----------------------------------------------------------------
  console.log('--- Step 5: Real Uploaded Creative Image OCR Pipeline ---');
  const greenLifeImagePath = path.join(
    process.cwd(),
    'public',
    'uploads',
    'creatives',
    'b64746e9-ac3d-462f-a1a6-5ff91ca18ba2.png'
  );
  assert(fs.existsSync(greenLifeImagePath), 'Uploaded GreenLife PNG file exists on disk');

  const visionResult = await runVisionAnalysis({
    imageUrl: '/uploads/creatives/b64746e9-ac3d-462f-a1a6-5ff91ca18ba2.png',
    captionText,
    guidelines: activeGuidelines,
    facts: activeFacts,
    assets: activeAssets,
  });

  assert(visionResult.visionRun, 'Real image vision / OCR pipeline executed successfully');
  assert(visionResult.extracted_ocr_text.length > 50, 'Extracts substantial real text from creative image');
  assert(
    !visionResult.extracted_ocr_text.startsWith('[Caption]:'),
    'Extracted OCR text is genuine image OCR and never a duplication of the caption'
  );
  assert(
    visionResult.extracted_ocr_text.toLowerCase().includes('greenlife') ||
    visionResult.extracted_ocr_text.toLowerCase().includes('water') ||
    visionResult.extracted_ocr_text.toLowerCase().includes('cold') ||
    visionResult.extracted_ocr_text.toLowerCase().includes('sustainable'),
    'Extracted OCR text accurately contains core brand terms from creative graphic'
  );
  console.log();

  // -----------------------------------------------------------------
  // STEP 6: Compliant Content Clean Verification (Zero False Positives)
  // -----------------------------------------------------------------
  console.log('--- Step 6: Compliant Benchmark Post Review (No Fabricated Faults) ---');
  const compliantCaption = 'Acme Enterprise maintains a documented 99.9% uptime SLA with SOC-2 Type II certified security frameworks. Multi-layered defense model designed to mitigate attack surfaces.';
  const compliantResult = await runComplianceReview(
    compliantCaption,
    'social_media',
    activeGuidelines,
    activeFacts,
    {
      captionText: compliantCaption,
      ocrReferenceText: 'Acme Enterprise 99.9% SLA SOC-2 Type II Certified',
      assets: activeAssets,
    }
  );

  assert(compliantResult.status === 'approved', 'Compliant content achieves approved status');
  assert(compliantResult.compliance_score === 100, `Compliant content achieves 100% score (Got: ${compliantResult.compliance_score}%)`);
  assert(compliantResult.findings.length === 0, 'Zero false-positive findings generated on verified copy');
  console.log();

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log('===============================================================');
  console.log(`GREENLIFE REGRESSION RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}% SUCCESS)`);
  console.log('===============================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runGreenLifeRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
