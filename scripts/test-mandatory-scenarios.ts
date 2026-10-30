import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { runComplianceReview } from '../src/lib/engine';

// Load .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

async function runMandatoryScenarios() {
  console.log('================================================================');
  console.log('BRANDGUARD AI — 6 MANDATORY TEST SCENARIOS EXECUTION SUITE');
  console.log('================================================================\n');

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

  // Ensure test fixtures directory
  const testFixturesDir = path.join(process.cwd(), 'public', 'uploads', 'creatives');
  if (!fs.existsSync(testFixturesDir)) {
    fs.mkdirSync(testFixturesDir, { recursive: true });
  }

  // ----------------------------------------------------------------
  // SCENARIO 1: Creative with visible text & matching caption
  // ----------------------------------------------------------------
  console.log('--- SCENARIO 1: Creative with visible text & matching caption ---');
  const s1Image = '/uploads/creatives/sample-compliant-post.png';
  const s1Caption = 'Acme Enterprise Cloud Infrastructure engineered for 99.9% uptime SLA and high availability.';

  const s1Result = await runComplianceReview(
    `[Marketing Creative: ${s1Image}]`,
    'social_media',
    [],
    [],
    {
      imageUrl: s1Image,
      captionText: s1Caption,
    }
  );

  console.log(`  Scenario 1 Status: ${s1Result.status}, Score: ${s1Result.compliance_score}, Findings: ${s1Result.findings.length}`);
  console.log(`  Extracted Text Preview: "${s1Result.extracted_ocr_text?.slice(0, 80).replace(/\n/g, ' ')}..."`);
  assert(Boolean(s1Result.extracted_ocr_text && s1Result.extracted_ocr_text.length > 0), 'Scenario 1 extracts visible text from creative');
  assert(s1Result.compliance_score !== null && s1Result.compliance_score >= 70, `Scenario 1 scores high compliance for matching compliant post (Got: ${s1Result.compliance_score})`);
  assert(s1Result.metadata.analysisStatus === 'complete', `Scenario 1 analysis status is complete (Got: ${s1Result.metadata.analysisStatus})`);

  // ----------------------------------------------------------------
  // SCENARIO 2: 50% OFF image with 70% OFF caption
  // ----------------------------------------------------------------
  console.log('\n--- SCENARIO 2: 50% OFF image with 70% OFF caption (Cross-Modal Contradiction) ---');
  // Create synthetic 50% OFF creative
  const s2Svg = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1e293b"/>
    <text x="400" y="250" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">SUMMER MEGA SALE</text>
    <rect x="200" y="320" width="400" height="160" rx="20" fill="#ef4444"/>
    <text x="400" y="430" font-family="Arial, sans-serif" font-size="96" font-weight="black" fill="#ffffff" text-anchor="middle">50% OFF</text>
    <text x="400" y="560" font-family="Arial, sans-serif" font-size="36" fill="#cbd5e1" text-anchor="middle">Limited Time Offer</text>
  </svg>`;
  const s2Path = path.join(testFixturesDir, 'test-scenario2-50pct.png');
  await sharp(Buffer.from(s2Svg)).png().toFile(s2Path);

  const s2Image = '/uploads/creatives/test-scenario2-50pct.png';
  const s2Caption = 'Get ready for our biggest sale of the season! Enjoy 70% OFF storewide today only!';

  const s2Result = await runComplianceReview(
    `[Marketing Creative: ${s2Image}]`,
    'social_media',
    [],
    [],
    {
      imageUrl: s2Image,
      captionText: s2Caption,
    }
  );

  console.log(`  Scenario 2 Status: ${s2Result.status}, Score: ${s2Result.compliance_score}, Findings: ${s2Result.findings.length}`);
  const s2ContradictionFinding = s2Result.findings.find(
    (f) =>
      f.category === 'claims_and_consistency' ||
      f.finding_title.toLowerCase().includes('contradict') ||
      f.finding_title.toLowerCase().includes('discount') ||
      (f.explanation && f.explanation.includes('50%') && f.explanation.includes('70%')) ||
      (f.explanation && f.explanation.toLowerCase().includes('contradict'))
  );

  assert(Boolean(s2ContradictionFinding), 'Scenario 2 detects cross-modal percentage contradiction (50% vs 70%)');
  if (s2ContradictionFinding) {
    console.log(`  Detected Contradiction: "${s2ContradictionFinding.finding_title}" -> ${s2ContradictionFinding.explanation}`);
  }
  assert(s2Result.compliance_score !== null && s2Result.compliance_score < 100, `Scenario 2 score is penalized for contradiction (Got: ${s2Result.compliance_score})`);
  assert(s2Result.status !== 'approved', `Scenario 2 status is not approved (Got: ${s2Result.status})`);

  // ----------------------------------------------------------------
  // SCENARIO 3: 1-year warranty image with 5-year warranty caption
  // ----------------------------------------------------------------
  console.log('\n--- SCENARIO 3: 1-year warranty image with 5-year warranty caption ---');
  const s3Svg = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f172a"/>
    <text x="400" y="250" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="#ffffff" text-anchor="middle">VOLTMAX PRO DRILL</text>
    <rect x="180" y="320" width="440" height="150" rx="16" fill="#0284c7"/>
    <text x="400" y="420" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#ffffff" text-anchor="middle">1 Year Warranty</text>
    <text x="400" y="550" font-family="Arial, sans-serif" font-size="32" fill="#94a3b8" text-anchor="middle">Engineered for durability</text>
  </svg>`;
  const s3Path = path.join(testFixturesDir, 'test-scenario3-1yr-warranty.png');
  await sharp(Buffer.from(s3Svg)).png().toFile(s3Path);

  const s3Image = '/uploads/creatives/test-scenario3-1yr-warranty.png';
  const s3Caption = 'Built to last! Every VoltMax Pro drill includes our comprehensive 5 Years Warranty.';

  const s3Result = await runComplianceReview(
    `[Marketing Creative: ${s3Image}]`,
    'social_media',
    [],
    [],
    {
      imageUrl: s3Image,
      captionText: s3Caption,
    }
  );

  console.log(`  Scenario 3 Status: ${s3Result.status}, Score: ${s3Result.compliance_score}, Findings: ${s3Result.findings.length}`);
  const s3WarrantyFinding = s3Result.findings.find(
    (f) =>
      f.category === 'claims_and_consistency' ||
      f.finding_title.toLowerCase().includes('warranty') ||
      f.finding_title.toLowerCase().includes('contradict') ||
      (f.explanation && f.explanation.toLowerCase().includes('warranty')) ||
      (f.explanation && f.explanation.toLowerCase().includes('contradict'))
  );

  assert(Boolean(s3WarrantyFinding), 'Scenario 3 detects warranty duration contradiction (1-year vs 5-year)');
  if (s3WarrantyFinding) {
    console.log(`  Detected Warranty Contradiction: "${s3WarrantyFinding.finding_title}" -> ${s3WarrantyFinding.explanation}`);
  }
  assert(s3Result.compliance_score !== null && s3Result.compliance_score < 100, `Scenario 3 score is penalized for warranty discrepancy (Got: ${s3Result.compliance_score})`);

  // ----------------------------------------------------------------
  // SCENARIO 4: Creative with no readable text but visual product content
  // ----------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Creative with no readable text but visual product content ---');
  const s4Image = '/uploads/creatives/heldout-lifestyle-notext.png';
  const s4Caption = 'Our minimalist designer collection for modern living.';

  const s4Result = await runComplianceReview(
    `[Marketing Creative: ${s4Image}]`,
    'social_media',
    [],
    [],
    {
      imageUrl: s4Image,
      captionText: s4Caption,
    }
  );

  console.log(`  Scenario 4 Status: ${s4Result.status}, Score: ${s4Result.compliance_score}, Findings: ${s4Result.findings.length}`);
  console.log(`  Typography Detected: ${s4Result.metadata.imageSummary?.hasLegibleTypography}`);
  assert(
    s4Result.metadata.analysisStatus === 'partial' || s4Result.metadata.analysisStatus === 'complete',
    `Scenario 4 completes analysis successfully without crashing (Got: ${s4Result.metadata.analysisStatus})`
  );
  assert(s4Result.metadata.imageSummary !== undefined && s4Result.metadata.imageSummary !== null, 'Scenario 4 produces imageSummary metadata');
  assert(s4Result.metadata.imageSummary?.hasLegibleTypography === false, 'Scenario 4 correctly notes creative has no legible typography');

  // ----------------------------------------------------------------
  // SCENARIO 5: Gemini unavailable / quota fallback behavior
  // ----------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Gemini unavailable / quota fallback behavior ---');
  const s5Image = '/uploads/creatives/sample-flagged-post.png';
  
  // Test with skipAI: true to simulate quota exhaustion / cloud failure
  const s5Result = await runComplianceReview(
    `[Marketing Creative: ${s5Image}]`,
    'social_media',
    [],
    [],
    {
      imageUrl: s5Image,
      skipAI: true,
    }
  );

  console.log(`  Scenario 5 Status: ${s5Result.status}, Score: ${s5Result.compliance_score}, Findings: ${s5Result.findings.length}`);
  console.log(`  AI Run: ${s5Result.metadata.aiRun}`);
  assert(s5Result.metadata.analysisStatus === 'complete', `Scenario 5 completes evaluation via local engine when Gemini is skipped/unavailable (Got: ${s5Result.metadata.analysisStatus})`);
  assert(Boolean(s5Result.extracted_ocr_text && s5Result.extracted_ocr_text.length > 0), 'Scenario 5 extracts OCR text via local engine');
  assert(s5Result.findings.length > 0, `Scenario 5 identifies findings locally (${s5Result.findings.length} findings)`);

  // ----------------------------------------------------------------
  // SCENARIO 6: Inaccessible / invalid image handling
  // ----------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Inaccessible / invalid image handling ---');
  const s6Image = '/uploads/creatives/completely-non-existent-broken-image-xyz999.png';

  const s6Result = await runComplianceReview(
    `[Marketing Creative: ${s6Image}]`,
    'social_media',
    [],
    [],
    {
      imageUrl: s6Image,
    }
  );

  console.log(`  Scenario 6 Status: ${s6Result.status}, Score: ${s6Result.compliance_score}, Findings: ${s6Result.findings.length}`);
  console.log(`  Governance Status: ${s6Result.metadata.governance_status}`);
  assert(s6Result.metadata.governance_status === 'ANALYSIS INCOMPLETE', `Scenario 6 governance status is ANALYSIS INCOMPLETE (Got: ${s6Result.metadata.governance_status})`);
  assert(s6Result.compliance_score === null, 'Scenario 6 compliance score is null (cannot calculate score without accessible image)');
  assert(s6Result.findings.some((f) => f.finding_title.toLowerCase().includes('inaccessible') || f.finding_title.toLowerCase().includes('image') || f.severity === 'critical'), 'Scenario 6 outputs clear diagnostic finding for missing/inaccessible image');

  console.log('\n================================================================');
  console.log(`FINAL RESULT: ${passed} / ${total} CHECKS PASSED`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runMandatoryScenarios().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
