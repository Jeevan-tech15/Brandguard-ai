import { runCrossModalChecks, checkInternalImageConflicts } from '../src/lib/engine/cross-modal';
import { calculateComplianceScore } from '../src/lib/engine/scoring';
import { runComplianceReview } from '../src/lib/engine';
import { getContentReviewById, saveReviewEvaluation, getBrandGuidelines, getApprovedFacts, getAuthorizedAssets } from '../src/lib/db';

let failedTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedTests++;
  }
}

async function runAcceptanceSuite() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — REGRESSION & ACCEPTANCE TEST SUITE (A to J)');
  console.log('================================================================\n');

  // ------------------------------------------------------------------
  // Test A: Image: 50% OFF; caption: 70% OFF -> flag a discount mismatch.
  // ------------------------------------------------------------------
  console.log('--- Test A: Discount mismatch (Image: 50% OFF vs Caption: 70% OFF) ---');
  const resA = runCrossModalChecks(
    'Special Deal\n50% OFF\nLimited Time Only',
    'Don\'t miss our seasonal promotion! Enjoy 70% OFF across the store.'
  );
  const mismatchA = resA.findings.find(
    (f) =>
      f.category === 'cross_modal_conflict' &&
      f.finding_title.includes('Contradictory Promotional Discount') &&
      f.evidence_text?.includes('50%') &&
      f.evidence_text?.includes('70%')
  );
  assert(Boolean(mismatchA), 'Test A: Flags 50% vs 70% discount mismatch finding');
  assert(mismatchA?.severity === 'critical', 'Test A: Discount mismatch is marked critical severity');
  assert(mismatchA?.verification_status === 'contradicted', 'Test A: Verification status marked contradicted');

  // ------------------------------------------------------------------
  // Test B: Image: 50% OFF; caption: 50% OFF -> no discount mismatch.
  // ------------------------------------------------------------------
  console.log('\n--- Test B: Matching discounts (Image: 50% OFF vs Caption: 50% OFF) ---');
  const resB = runCrossModalChecks(
    'Special Deal\n50% OFF\nLimited Time Only',
    'Get yours today with 50% OFF for a limited time!'
  );
  const mismatchB = resB.findings.find((f) => f.finding_title.toLowerCase().includes('discount'));
  assert(!mismatchB, 'Test B: 50% vs 50% does NOT flag a discount mismatch');

  // ------------------------------------------------------------------
  // Test C: Image: 20g protein and 40g protein with no distinguishing context -> flag internal inconsistency.
  // ------------------------------------------------------------------
  console.log('\n--- Test C: Internal inconsistency (Image: 20g protein vs 40g Protein without context) ---');
  const imageTextC = 'Delicious Energy Snack\n20g protein\nNow with 40g Protein boost!\nContains nuts';
  const findingsC = checkInternalImageConflicts(imageTextC);
  const conflictC = findingsC.find(
    (f) =>
      f.category === 'cross_modal_conflict' &&
      f.finding_title.includes('Potential Internal Specification Inconsistency') &&
      f.evidence_text?.includes('20g') &&
      f.evidence_text?.includes('40g')
  );
  assert(Boolean(conflictC), 'Test C: Flags internal specification inconsistency (20g vs 40g)');
  assert(conflictC?.severity === 'high', 'Test C: Internal specification inconsistency is assigned high severity');
  assert(conflictC?.verification_status === 'possible_inconsistency', 'Test C: Verification status is possible_inconsistency');

  // ------------------------------------------------------------------
  // Test D: Clearly different serving-size contexts -> do not call contradictory.
  // ------------------------------------------------------------------
  console.log('\n--- Test D: Different serving-size contexts (20g per bar vs 40g per 2 bars) ---');
  const imageTextD = 'Nutritional Facts\n20g protein per bar\n40g protein per 2 bars\nWholesome ingredients';
  const findingsD = checkInternalImageConflicts(imageTextD);
  const conflictD = findingsD.find(
    (f) => f.finding_title.includes('Potential Internal Specification Inconsistency')
  );
  assert(!conflictD, 'Test D: Distinguishing serving-size context (per bar vs per 2 bars) is NOT flagged as contradictory');

  // ------------------------------------------------------------------
  // Test E: Empty or failed OCR -> analysis incomplete, not "zero violations / 100%".
  // ------------------------------------------------------------------
  console.log('\n--- Test E: Empty / Failed OCR handling ---');
  const resE = calculateComplianceScore([], {
    hasImageInput: true,
    hasCaptionInput: false,
    extractedOcrText: '',
    checksCompleted: {
      imageAnalysis: false,
      captionAnalysis: false,
      crossModalComparison: false,
      guidelineChecks: false,
      factChecks: false,
    },
  });
  assert(resE.isPartialAnalysis === true, 'Test E: Marks review as partial analysis (isPartialAnalysis: true)');
  assert(resE.finalScore === 0, 'Test E: Does not award 100% for failed / empty OCR (finalScore is 0 / score unavailable)');

  const reviewE = await runComplianceReview('Empty OCR Test', 'social_media', [], [], {
    imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    skipAI: true,
    ocrReferenceText: '',
  });
  assert(reviewE.status === 'in_review', 'Test E: Automated review does not set status to approved on incomplete OCR');

  // ------------------------------------------------------------------
  // Test F: Missing caption -> no fabricated caption mismatch.
  // ------------------------------------------------------------------
  console.log('\n--- Test F: Missing caption handling ---');
  const resF = runCrossModalChecks('Super Deal 50% OFF today only!', '');
  assert(resF.findings.length === 0, 'Test F: Missing caption returns 0 cross-modal findings (no fabricated contradictions)');

  // ------------------------------------------------------------------
  // Test G: Clean creative with successful analysis -> 0 findings, score 100, not auto-approved.
  // ------------------------------------------------------------------
  console.log('\n--- Test G: Clean creative governance gate ---');
  const cleanImageText = 'EcoHydro Bottle\n100% BPA Free Tritan\nKeeps beverages cold for 24 hours\nErgonomic design';
  const cleanCaption = 'EcoHydro bottle keeps your drinks cold for 24 hours with certified BPA free materials.';
  const reviewG = await runComplianceReview('EcoHydro Clean Creative', 'social_media', [], [], {
    ocrReferenceText: cleanImageText,
    captionText: cleanCaption,
    skipAI: true,
  });
  assert(reviewG.findings.length === 0, 'Test G: Clean creative produces 0 violations');
  assert(reviewG.compliance_score === 100, 'Test G: Clean creative earns 100% compliance score');
  assert(
    reviewG.status === 'in_review',
    'Test G: Clean creative status is "in_review" awaiting human decision, NOT automatically "approved"'
  );

  // ------------------------------------------------------------------
  // Test H: Two different images / review versions -> no stale OCR, findings, or status leakage.
  // ------------------------------------------------------------------
  console.log('\n--- Test H: Image and version isolation ---');
  const svgImg1 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text y="20">Creative Alpha 40% OFF</text></svg>').toString('base64');
  const svgImg2 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text y="20">Creative Beta 80% OFF</text></svg>').toString('base64');

  const revH1 = await runComplianceReview('Copy 1', 'social_media', [], [], {
    imageUrl: svgImg1,
    captionText: 'Copy 1 caption 40% OFF',
    skipAI: true,
  });
  const revH2 = await runComplianceReview('Copy 2', 'social_media', [], [], {
    imageUrl: svgImg2,
    captionText: 'Copy 2 caption 80% OFF',
    skipAI: true,
  });

  const ocrH1 = revH1.extracted_ocr_text || '';
  const ocrH2 = revH2.extracted_ocr_text || '';
  assert(ocrH1.includes('Creative Alpha') && !ocrH1.includes('Creative Beta'), 'Test H: Rev 1 OCR text isolated to Image 1');
  assert(ocrH2.includes('Creative Beta') && !ocrH2.includes('Creative Alpha'), 'Test H: Rev 2 OCR text isolated to Image 2');
  assert(ocrH1 !== ocrH2, 'Test H: No cache leakage between different creatives');

  // ------------------------------------------------------------------
  // Test I: Environmental claims -> apply configured rules/evidence, not blanket assumptions.
  // ------------------------------------------------------------------
  console.log('\n--- Test I: Evidence-sensitive environmental claims ---');
  // I1: "Contains Wheat & Gluten" is a product disclosure and must not automatically be flagged as a violation
  const revI1 = await runComplianceReview('Snack Product', 'social_media', [], [], {
    ocrReferenceText: 'NaturaBite Bar\nContains Wheat & Gluten\nStore in a cool dry place',
    captionText: 'Contains Wheat & Gluten for allergy disclosure.',
    skipAI: true,
  });
  const glutenFinding = revI1.findings.find((f) => f.evidence_text?.toLowerCase().includes('gluten'));
  assert(!glutenFinding, 'Test I1: "Contains Wheat & Gluten" disclosure is NOT flagged as a violation');

  // I2: "Wrapped in 100% Non-recyclable plastic" is not automatically called false without configured rule
  const revI2 = await runComplianceReview('Snack Packaging', 'social_media', [], [], {
    ocrReferenceText: 'NaturaBite Bar\nWrapped in 100% Non-recyclable plastic',
    captionText: 'Our bars are packaged securely.',
    skipAI: true,
  });
  const plasticFinding = revI2.findings.find((f) => f.evidence_text?.toLowerCase().includes('non-recyclable'));
  assert(!plasticFinding, 'Test I2: "Wrapped in 100% Non-recyclable plastic" is not falsely flagged as contradicted without rule');

  // ------------------------------------------------------------------
  // Test J: Re-evaluation -> persisted result and UI correspond to current creative.
  // ------------------------------------------------------------------
  console.log('\n--- Test J: Real creative re-evaluation & persistence verification ---');
  const targetReviewId = '8a7ffde0-2150-4931-b37b-8cfc895b1f4f';
  const reviewBefore = await getContentReviewById(targetReviewId);

  if (reviewBefore) {
    const [guidelines, facts, assets] = await Promise.all([
      getBrandGuidelines(true),
      getApprovedFacts(true),
      getAuthorizedAssets(true),
    ]);

    const evalResult = await runComplianceReview(
      reviewBefore.content_text,
      reviewBefore.content_type,
      guidelines,
      facts,
      {
        skipAI: false,
        imageUrl: reviewBefore.image_url || undefined,
        captionText: reviewBefore.caption_text || undefined,
        assets,
      }
    );

    await saveReviewEvaluation(targetReviewId, evalResult);
    const reloaded = await getContentReviewById(targetReviewId);

    assert(Boolean(reloaded), 'Test J: Review is successfully reloaded from store');
    assert(reloaded?.status === 'flagged', 'Test J: Real creative status is "flagged" (not "approved")');
    assert(
      (reloaded?.compliance_score ?? 100) < 70,
      `Test J: Real creative compliance score is under 70% (actual: ${reloaded?.compliance_score}%)`
    );
    assert(
      (reloaded?.findings?.length ?? 0) >= 2,
      `Test J: Real creative contains detected violations (actual count: ${reloaded?.findings?.length})`
    );

    const hasInternalConflict = reloaded?.findings?.some(
      (f) =>
        f.category === 'cross_modal_conflict' &&
        (f.source === 'image' || f.target_scope === 'image') &&
        f.finding_title.includes('Potential Internal Specification Inconsistency') &&
        f.image_evidence?.includes('40g') &&
        f.image_evidence?.includes('20g')
    );
    assert(
      Boolean(hasInternalConflict),
      'Test J: Detects and persists internal specification conflict: 40g Protein vs 20g on bar'
    );

    const hasCrossModalConflict = reloaded?.findings?.some(
      (f) =>
        f.category === 'cross_modal_conflict' &&
        (f.source === 'cross_modal' || f.target_scope === 'both') &&
        f.target_scope === 'both' &&
        (f.evidence_text?.includes('50g') || f.caption_evidence?.includes('50g'))
    );
    assert(
      Boolean(hasCrossModalConflict),
      'Test J: Detects and persists cross-modal mismatch between image (20g/40g) and caption (50g protein)'
    );
  } else {
    console.log(`Skipping Test J: Review ${targetReviewId} not found in database.`);
  }

  console.log('\n================================================================');
  console.log(` ACCEPTANCE SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAcceptanceSuite().catch((err) => {
  console.error('Acceptance test uncaught failure:', err);
  process.exit(1);
});
