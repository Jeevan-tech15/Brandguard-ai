/**
 * BrandGuard AI — Multi-Creative Generalization & Edge Case Verification Suite
 * Tests unseen creatives from diverse industries (Tech, Retail, Electronics, Apparel):
 * 1. Price contradiction (Image: $29/mo vs Caption: $49/mo)
 * 2. Product specification & battery duration contradiction (Image: 16GB RAM, 24h battery vs Caption: 32GB RAM, 40h battery)
 * 3. Evidence-required environmental/material claim ("100% Organic Cotton" without registered fact)
 * 4. Compliant multi-modal creative (100% score, 0 false findings)
 * 5. Minimal/No-text image handling (Graceful partial analysis disclosure, no crash)
 * 6. Malformed/Unsupported input rejection (400 validation, no unhandled exception)
 * 7. Re-analysis and correction verification across versions
 */

import { runComplianceReview } from '../src/lib/engine';
import { runCrossModalChecks } from '../src/lib/engine/cross-modal';
import { runFactChecks } from '../src/lib/engine/fact-checker';
import { calculateComplianceScore } from '../src/lib/engine/scoring';
import { extractImageDimensions, classifyAspectRatio } from '../src/lib/image-utils';
import { BrandGuideline, ApprovedFact } from '../src/lib/types';
import { createContentReview, reanalyzeCorrectedImage } from '../src/lib/db';

let passed = 0;
let total = 0;

function assert(cond: boolean, name: string, details?: string) {
  total++;
  if (cond) {
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    console.error(`  ✗ [FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function runGeneralCreativesSuite() {
  console.log('===============================================================');
  console.log('BRANDGUARD AI: GENERALIZED MULTI-CREATIVE AUDIT SUITE');
  console.log('===============================================================\n');

  const testGuidelines: BrandGuideline[] = [
    {
      id: 'g-gen-1',
      title: 'No Absolute Performance Guarantees',
      description: 'Prohibit absolute claims like 100% foolproof, unhackable, or zero risk.',
      rule_type: 'prohibited_claim',
      severity: 'critical',
      rule_configuration: { keywords: ['100% foolproof', 'unhackable', 'zero risk'] },
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'g-gen-2',
      title: 'Mandatory Pricing Disclaimer',
      description: 'Promotional pricing posts must include terms and taxes disclaimer.',
      rule_type: 'required_disclaimer',
      severity: 'medium',
      rule_configuration: {
        keywords: ['/mo', '$', 'discount'],
        required_phrases: ['Terms and conditions apply. Taxes extra.'],
      },
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const testFacts: ApprovedFact[] = [
    {
      id: 'f-tech-1',
      fact_text: 'NovaSaaS starter plan pricing is officially established at $29/mo billed annually.',
      source_name: 'Official Pricing Catalog 2026',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  // -----------------------------------------------------------------
  // SCENARIO 1: Tech SaaS Pricing Conflict
  // -----------------------------------------------------------------
  console.log('--- Test 1: Pricing Contradiction (Image: $29/mo vs Caption: $49/mo) ---');
  const imageOcrTech = 'NovaSaaS Cloud Starter\nOnly $29/mo\nDeploy in seconds\nTerms and conditions apply. Taxes extra.';
  const captionTech = 'Supercharge your workflow with NovaSaaS Starter plan for just $49/mo today!';

  const cmPriceResult = runCrossModalChecks(imageOcrTech, captionTech);
  const priceFinding = cmPriceResult.findings.find(
    (f) => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('price')
  );
  assert(Boolean(priceFinding), 'Detects conflicting price claims across image ($29) and caption ($49)');
  assert(priceFinding?.severity === 'critical', 'Price contradiction assigned critical severity');
  assert(priceFinding?.verification_status === 'contradicted', 'Verification status correctly marked as contradicted');
  console.log();

  // -----------------------------------------------------------------
  // SCENARIO 2: Electronics Hardware Specifications & Battery Life Conflict
  // -----------------------------------------------------------------
  console.log('--- Test 2: Hardware Spec & Battery Life Contradiction ---');
  const imageOcrHardware = 'ApexBook Pro 16\n16GB RAM | 512GB SSD\nUp to 24 hours battery life\nEngineered for builders';
  const captionHardware = 'The all-new ApexBook Pro 16 features massive 32GB RAM and unbelievable 40 hours battery life on a single charge!';

  const cmHardwareResult = runCrossModalChecks(imageOcrHardware, captionHardware);
  const batteryFinding = cmHardwareResult.findings.find(
    (f) => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('battery')
  );
  const specFinding = cmHardwareResult.findings.find(
    (f) => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('specification')
  );
  assert(Boolean(batteryFinding), 'Detects battery life discrepancy (24h in image vs 40h in caption)');
  assert(batteryFinding?.severity === 'critical', 'Battery duration mismatch assigned critical severity');
  assert(Boolean(specFinding), 'Detects hardware memory specification conflict (16GB RAM vs 32GB RAM)');
  console.log();

  // -----------------------------------------------------------------
  // SCENARIO 3: Material / Sustainability Evidence Required Claim
  // -----------------------------------------------------------------
  console.log('--- Test 3: Unsubstantiated Material Claim Needing Evidence ---');
  const apparelCopy = 'Our premium tee is guaranteed to be 100% sustainable and made from 100% organic materials.';
  const { findings: factFindings } = runFactChecks(apparelCopy, testFacts, { sourceTag: 'caption' });
  const unverifiedMaterial = factFindings.find((f) => f.category === 'unsubstantiated_claim');

  assert(Boolean(unverifiedMaterial), 'Flags "100% sustainable" as an unsubstantiated claim requiring empirical evidence');
  assert(unverifiedMaterial?.verification_status === 'unverified', 'Marked as unverified (not declared definitively false)');
  assert(
    Boolean(unverifiedMaterial?.explanation.includes('pending supporting evidence')),
    'Explicitly notes missing evidence is not proof of falsity'
  );
  console.log();

  // -----------------------------------------------------------------
  // SCENARIO 4: Clean, Fully Compliant Creative Post
  // -----------------------------------------------------------------
  console.log('--- Test 4: Clean Creative Post (Verified 100% Compliance) ---');
  const cleanImageText = 'NovaSaaS Cloud Starter\nOnly $29/mo\nDeploy in seconds\nTerms and conditions apply. Taxes extra.';
  const cleanCaption = 'Get started with NovaSaaS Cloud Starter at verified $29/mo pricing. Terms and conditions apply. Taxes extra.';

  const cleanReview = await runComplianceReview(cleanCaption, 'social_media', testGuidelines, testFacts, {
    ocrReferenceText: cleanImageText,
    captionText: cleanCaption,
  });

  assert(cleanReview.compliance_score === 100, 'Compliant post achieves 100% compliance score');
  assert(cleanReview.status === 'approved' || cleanReview.status === 'in_review', 'Compliant post status marked approved or in_review');
  assert(cleanReview.findings.length === 0, 'Zero false findings generated on compliant collateral');
  console.log();

  // -----------------------------------------------------------------
  // SCENARIO 5: Image With Little/No Text (Partial Analysis Safety)
  // -----------------------------------------------------------------
  console.log('--- Test 5: Image With No Text (Partial Analysis Safety) ---');
  const emptyImageScore = calculateComplianceScore([], {
    hasImageInput: true,
    hasCaptionInput: false,
    extractedOcrText: '',
  });

  assert(emptyImageScore.isPartialAnalysis === true, 'Correctly flags partial analysis when image contains no text and no caption');
  assert(emptyImageScore.finalScore === 0, 'Does not grant 100% compliance when required checks could not run');

  const partialCaptionScore = calculateComplianceScore([], {
    hasImageInput: true,
    hasCaptionInput: true,
    extractedOcrText: '',
  });
  assert(partialCaptionScore.isPartialAnalysis === true, 'Identifies partial analysis when image text is absent but caption exists');
  console.log();

  // -----------------------------------------------------------------
  // SCENARIO 6: Aspect Ratio and Corrupt Input Validation
  // -----------------------------------------------------------------
  console.log('--- Test 6: Image Dimensions & Corrupt Buffer Handling ---');
  const storyRatio = classifyAspectRatio(1080, 1920);
  assert(storyRatio.label === '9:16', '1080x1920 identified as Instagram Reel/Story 9:16');

  // Corrupted buffer returns null safely without throwing
  const corruptBuffer = Buffer.from('NOT_A_VALID_IMAGE_HEADER');
  const dims = extractImageDimensions(corruptBuffer, 'image/png');
  assert(dims === null, 'Corrupt image buffer safely handled, returns null without unhandled exception');
  console.log();

  // -----------------------------------------------------------------
  // SCENARIO 7: Creative Correction & Re-Analysis
  // -----------------------------------------------------------------
  console.log('--- Test 7: Correction Studio & Version Progression ---');
  const initialReview = await createContentReview({
    title: 'NovaSaaS Promo Launch v1',
    content_type: 'social_media',
    content_text: 'NovaSaaS with $49/mo pricing.',
    caption_text: 'NovaSaaS with $49/mo pricing.',
    save_as_draft: false,
    status: 'in_review',
  });

  const reanalysis = await reanalyzeCorrectedImage(initialReview.id, {
    correctedImageUrl: '/uploads/creatives/sample-compliant-post.svg',
    correctionMetadata: {
      replaced_text: '$49/mo',
      new_text: '$29/mo',
      edit_applied_to_pixels: true,
      correction_notes: 'Aligned price point to authorized $29/mo catalog figure',
    },
  });

  assert(reanalysis.review.review_version === 2, 'Increments review version to v2 upon reanalysis');
  assert(reanalysis.review.corrected_image_url !== null, 'Preserves corrected image pointer');
  assert(reanalysis.review.compliance_score !== null, 'Re-evaluated compliance score calculated for v2');
  console.log();

  console.log('===============================================================');
  console.log(`GENERALIZED SUITE RESULTS: ${passed} / ${total} PASSED (${Math.round((passed / total) * 100)}% SUCCESS)`);
  console.log('===============================================================\n');
}

runGeneralCreativesSuite().catch(console.error);
