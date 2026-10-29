import { runVisionAnalysis } from '../src/lib/engine/vision-analyzer';
import { calculateComplianceScore } from '../src/lib/engine/scoring';
import { getBrandProfile, saveBrandProfile } from '../src/lib/db';
import { runComplianceReview } from '../src/lib/engine';

async function main() {
  console.log('====================================================');
  console.log('VERCEL READINESS VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;
  function assert(cond: boolean, name: string, detail?: string) {
    total++;
    if (cond) {
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } else {
      console.error(`  ✗ [FAIL] ${name} ${detail ? '-> ' + detail : ''}`);
    }
  }

  // 1. Simulate Vercel Serverless Read-Only Environment
  console.log('--- 1. Testing Read-Only Serverless Persistence (VERCEL=1) ---');
  process.env.VERCEL = '1';
  
  const initialProfile = await getBrandProfile();
  assert(initialProfile !== undefined, 'getBrandProfile returns profile without throwing in serverless mode');

  // Attempting saveBrandProfile in serverless mode should update in-memory store without throwing EROFS
  let writeFailed = false;
  try {
    await saveBrandProfile({
      brand_name: 'VercelReadyBrand',
      brand_description: 'Test Brand for Vercel',
      brand_colors: ['#000000', '#ffffff'],
      tone_of_voice: 'professional',
    });
  } catch {
    writeFailed = true;
  }
  assert(!writeFailed, 'saveBrandProfile does not throw EROFS in Vercel mode');

  const updatedProfile = await getBrandProfile();
  assert(updatedProfile?.brand_name === 'VercelReadyBrand', 'Updated brand profile is readable in current execution context');

  // 2. Test Gemini 429 & Quota Handling
  console.log('\n--- 2. Testing Gemini 429 Quota & Fallback Behavior ---');
  // With invalid key or rate-limited key, vision analysis must not crash and must record quota notice
  const t0 = Date.now();
  const visionRes = await runVisionAnalysis({
    imageUrl: '/uploads/creatives/365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg',
    guidelines: [],
    facts: [],
    assets: [],
    skipAI: false, // will try Gemini, fail/429 gracefully, and use local OCR
  });
  const elapsed = Date.now() - t0;
  console.log(`  Vision analysis completed in ${elapsed}ms`);

  assert(elapsed < 20000, `Execution completes within safe bounded time (${elapsed}ms < 20000ms)`);
  assert(visionRes.extracted_ocr_text.length > 0, `OCR extracted text (${visionRes.extracted_ocr_text.length} chars) via local engine`);
  assert(visionRes.findings.length > 0, `Local engine identified real findings (${visionRes.findings.length} findings)`);

  // 3. Test Incomplete Analysis Safety (Cannot be 100% compliant)
  console.log('\n--- 3. Testing Compliance Score Safeguards for Failed/Incomplete Checks ---');
  
  // Case A: Image with 0 OCR text and no caption must NOT be 100% compliant
  const scoreEmptyOcr = calculateComplianceScore([], {
    hasImageInput: true,
    hasCaptionInput: false,
    extractedOcrText: '',
    imageInspectionSucceeded: true,
  });
  assert(scoreEmptyOcr.finalScore === 0 || scoreEmptyOcr.finalScore === null, `Zero OCR text yields score 0 or null (Got: ${scoreEmptyOcr.finalScore})`);
  assert(scoreEmptyOcr.isPartialAnalysis === true, 'isPartialAnalysis is true for zero detected typography');

  // Case B: Incomplete image inspection
  const scoreFailedInspection = calculateComplianceScore([], {
    hasImageInput: true,
    hasCaptionInput: false,
    extractedOcrText: '',
    imageInspectionSucceeded: false,
  });
  assert(scoreFailedInspection.finalScore === null, `Failed image inspection yields finalScore null (Got: ${scoreFailedInspection.finalScore})`);
  assert(scoreFailedInspection.isPartialAnalysis === true, 'isPartialAnalysis is true when image inspection fails');

  // Case C: Review with findings must never be 100%
  const reviewResult = await runComplianceReview(
    '[Creative Image: 365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg]',
    'social_media',
    [],
    [],
    {
      imageUrl: '/uploads/creatives/365a623d-bcfd-4a5d-882c-ad1a57087911.jpeg',
      skipAI: true,
    }
  );
  assert(reviewResult.compliance_score !== null && reviewResult.compliance_score < 100, `Poster with defects gets penalized score (Got: ${reviewResult.compliance_score})`);
  assert(reviewResult.status !== 'approved', `Defective creative is not approved (Got: ${reviewResult.status})`);

  console.log('\n====================================================');
  console.log(`TOTAL: ${passed} / ${total} CHECKS PASSED`);
  console.log('====================================================');
}

main().catch(console.error);
