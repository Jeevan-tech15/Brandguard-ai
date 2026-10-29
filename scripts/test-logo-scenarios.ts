import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { runComplianceReview } from '../src/lib/engine';
import { runVisionAnalysis } from '../src/lib/engine/vision-analyzer';
import { auditImageLogoAndBrandIdentity } from '../src/lib/engine/image-first-analyzer';
import { BrandGuideline, AuthorizedAsset } from '../src/lib/types';

async function generateTestImages(testDir: string) {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 1. Symbol logo only without readable text (clean diamond icon mark in top-left)
  const svgSymbolOnly = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="#1e1e2e"/>
      <!-- Symbol Logo Mark: Hexagonal shield / diamond -->
      <polygon points="120,60 170,90 170,150 120,180 70,150 70,90" fill="#06b6d4" stroke="#ffffff" stroke-width="4"/>
      <circle cx="120" cy="120" r="22" fill="#ffffff"/>
      <rect x="60" y="300" width="680" height="400" rx="20" fill="#2d2d3f"/>
    </svg>
  `;
  const symbolOnlyPath = path.join(testDir, 'logo-test-1-symbol-only.png');
  fs.writeFileSync(symbolOnlyPath, await sharp(Buffer.from(svgSymbolOnly)).png().toBuffer());

  // 2. Clear brand wordmark in typography
  const svgWordmark = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="#0f172a"/>
      <text x="80" y="120" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#38bdf8">ECOSIP</text>
      <text x="80" y="260" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="#ffffff">Pure Hydration for Modern Explorers</text>
      <text x="80" y="340" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#94a3b8">Sustainable insulated drinkware crafted for life.</text>
    </svg>
  `;
  const wordmarkPath = path.join(testDir, 'logo-test-2-wordmark.png');
  fs.writeFileSync(wordmarkPath, await sharp(Buffer.from(svgWordmark)).png().toBuffer());

  // 3. Logo on a busy background (gradient + pattern + corner emblem)
  const svgBusyBg = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4f46e5" />
          <stop offset="50%" stop-color="#ec4899" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="800" height="800" fill="url(#grad)"/>
      <!-- Background pattern stripes -->
      <line x1="0" y1="100" x2="800" y2="700" stroke="rgba(255,255,255,0.15)" stroke-width="40"/>
      <line x1="0" y1="300" x2="800" y2="900" stroke="rgba(255,255,255,0.15)" stroke-width="40"/>
      <!-- Emblem Logo in top-left -->
      <circle cx="120" cy="120" r="50" fill="#ffffff" stroke="#1e1e2e" stroke-width="6"/>
      <polygon points="120,85 145,135 95,135" fill="#4f46e5"/>
      <text x="120" y="152" font-family="Arial" font-size="12" font-weight="bold" fill="#1e1e2e" text-anchor="middle">BRAND</text>
      <text x="400" y="450" font-family="Arial" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">SUMMER FESTIVAL 2026</text>
    </svg>
  `;
  const busyBgPath = path.join(testDir, 'logo-test-3-busy-bg.png');
  fs.writeFileSync(busyBgPath, await sharp(Buffer.from(svgBusyBg)).png().toBuffer());

  // 4. Image genuinely without a logo (pure copy and photography placeholder)
  const svgNoLogo = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="#18181b"/>
      <rect x="80" y="80" width="640" height="400" rx="16" fill="#27272a"/>
      <text x="400" y="300" font-family="Arial" font-size="28" fill="#a1a1aa" text-anchor="middle">Product Photography Stage</text>
      <text x="400" y="560" font-family="Arial" font-size="44" font-weight="bold" fill="#f4f4f5" text-anchor="middle">Handcrafted Ceramic Bowls</text>
      <text x="400" y="630" font-family="Arial" font-size="24" fill="#a1a1aa" text-anchor="middle">Available in minimalist stoneware finishes.</text>
    </svg>
  `;
  const noLogoPath = path.join(testDir, 'logo-test-4-no-logo.png');
  fs.writeFileSync(noLogoPath, await sharp(Buffer.from(svgNoLogo)).png().toBuffer());

  return {
    symbolOnlyPath,
    wordmarkPath,
    busyBgPath,
    noLogoPath,
  };
}

async function runLogoVerificationSuite() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — LOGO DETECTION SCENARIOS REGRESSION SUITE     ');
  console.log('================================================================\n');

  const testDir = path.join(process.cwd(), 'public', 'uploads', 'creatives');
  const paths = await generateTestImages(testDir);

  const mockAssets: AuthorizedAsset[] = [
    {
      id: 'asset-ecosip-logo',
      asset_name: 'EcoSip',
      asset_type: 'logo',
      file_url: '/assets/ecosip-logo.png',
      asset_metadata: { is_primary: true },
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'asset-soundzen-logo',
      asset_name: 'SoundZen',
      asset_type: 'logo',
      file_url: '/assets/soundzen-logo.png',
      asset_metadata: { is_primary: true },
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const mandatoryLogoGuideline: BrandGuideline = {
    id: 'guide-mandatory-logo',
    title: 'Mandatory Brand Logo Placement',
    description: 'All outbound marketing creatives must visibly display the authorized brand logo.',
    rule_type: 'logo_guideline',
    severity: 'high',
    rule_configuration: {},
    is_active: true,
    created_at: new Date().toISOString(),
  };

  let totalTests = 0;
  let passedTests = 0;

  function recordResult(scenarioName: string, passed: boolean, details: string) {
    totalTests++;
    if (passed) passedTests++;
    console.log(`[${passed ? 'PASS ✓' : 'FAIL ✗'}] ${scenarioName}`);
    console.log(`  Details: ${details}\n`);
  }

  // -------------------------------------------------------------------
  // Scenario 1: A clear symbol logo without readable text (Simulated Vision Mode)
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 1: Clear Symbol Logo Without Readable Text (Vision Mode) ---');
  const mockVisionSymbolOnly = {
    status: 'detected_unverified' as const,
    detected: true,
    logoType: 'symbol' as const,
    evidence: 'Hexagonal crest shield symbol in top-left region',
    confidence: 0.95,
    boundingBox: { ymin: 75, xmin: 88, ymax: 225, xmax: 213 },
  };
  const auditRes1 = auditImageLogoAndBrandIdentity(
    { width: 800, height: 800, aspectRatio: '1:1', format: 'PNG', dominantColor: '#1E1E2E', hasLegibleTypography: false, textLineCount: 0 },
    mockAssets,
    '',
    undefined,
    [mandatoryLogoGuideline],
    mockVisionSymbolOnly
  );
  const s1Passed =
    auditRes1.logoPresence.detected === true &&
    auditRes1.logoPresence.logoType === 'symbol' &&
    auditRes1.logoPresence.status === 'detected_unverified' &&
    auditRes1.findings.length === 0; // Symbol is present, so mandatory logo is NOT flagged as missing!
  recordResult(
    'Scenario 1: Symbol Logo Without Text',
    s1Passed,
    `Detected: ${auditRes1.logoPresence.detected}, Type: ${auditRes1.logoPresence.logoType}, Status: ${auditRes1.logoPresence.status}, Findings: ${auditRes1.findings.length}`
  );

  // -------------------------------------------------------------------
  // Scenario 2: Brand Wordmark (EcoSip) in Typography
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 2: Brand Wordmark (Local Fallback & Multimodal) ---');
  const review2 = await runComplianceReview(
    'EcoSip Hydration Post',
    'social_media',
    [mandatoryLogoGuideline],
    [],
    {
      imageUrl: paths.wordmarkPath,
      assets: mockAssets,
      skipAI: true,
    }
  );
  const s2Passed =
    review2.metadata.logoPresence?.detected === true &&
    review2.metadata.logoPresence?.status === 'detected_and_matched' &&
    review2.metadata.logoPresence?.matchedAssetName === 'EcoSip' &&
    review2.metadata.logoPresence?.logoType === 'wordmark';
  recordResult(
    'Scenario 2: Wordmark Matching Authorized Asset',
    s2Passed,
    `Status: ${review2.metadata.logoPresence?.status}, Matched Asset: ${review2.metadata.logoPresence?.matchedAssetName}, Type: ${review2.metadata.logoPresence?.logoType}`
  );

  // -------------------------------------------------------------------
  // Scenario 3: Logo on a Busy Background
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 3: Logo on Busy Background ---');
  const mockVisionBusyBg = {
    status: 'detected_unverified' as const,
    detected: true,
    logoType: 'emblem' as const,
    evidence: 'Circular badge emblem with triangle crest in top-left',
    confidence: 0.92,
    boundingBox: { ymin: 88, xmin: 88, ymax: 212, xmax: 212 },
  };
  const auditRes3 = auditImageLogoAndBrandIdentity(
    { width: 800, height: 800, aspectRatio: '1:1', format: 'PNG', dominantColor: '#4F46E5', hasLegibleTypography: true, textLineCount: 2 },
    mockAssets,
    'SUMMER FESTIVAL 2026\nBRAND',
    undefined,
    [mandatoryLogoGuideline],
    mockVisionBusyBg
  );
  const s3Passed =
    auditRes3.logoPresence.detected === true &&
    auditRes3.logoPresence.status === 'detected_unverified' &&
    auditRes3.findings.length === 0;
  recordResult(
    'Scenario 3: Logo on Busy Background',
    s3Passed,
    `Detected: ${auditRes3.logoPresence.detected}, Status: ${auditRes3.logoPresence.status}, Findings: ${auditRes3.findings.length}`
  );

  // -------------------------------------------------------------------
  // Scenario 4A: Image genuinely without a logo (NO mandatory guideline)
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 4A: Genuinely No Logo (Without Mandatory Guideline) ---');
  const mockVisionNoLogo = {
    status: 'no_logo_detected' as const,
    detected: false,
    confidence: 0.94,
    details: 'Visual inspection completed with sufficient evidence; no logo detected.',
  };
  const auditRes4A = auditImageLogoAndBrandIdentity(
    { width: 800, height: 800, aspectRatio: '1:1', format: 'PNG', dominantColor: '#18181B', hasLegibleTypography: true, textLineCount: 3 },
    mockAssets,
    'Handcrafted Ceramic Bowls\nAvailable in minimalist stoneware finishes.',
    undefined,
    [], // No mandatory guideline
    mockVisionNoLogo
  );
  const s4APassed =
    auditRes4A.logoPresence.status === 'no_logo_detected' &&
    auditRes4A.logoPresence.detected === false &&
    auditRes4A.findings.length === 0; // Compliant: no mandatory rule, so 0 findings!
  recordResult(
    'Scenario 4A: Genuinely No Logo (No Rule) -> 0 Deductions',
    s4APassed,
    `Status: ${auditRes4A.logoPresence.status}, Findings count: ${auditRes4A.findings.length}`
  );

  // -------------------------------------------------------------------
  // Scenario 4B: Image genuinely without a logo (WITH Mandatory Guideline)
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 4B: Genuinely No Logo (WITH Mandatory Guideline) ---');
  const auditRes4B = auditImageLogoAndBrandIdentity(
    { width: 800, height: 800, aspectRatio: '1:1', format: 'PNG', dominantColor: '#18181B', hasLegibleTypography: true, textLineCount: 3 },
    mockAssets,
    'Handcrafted Ceramic Bowls\nAvailable in minimalist stoneware finishes.',
    undefined,
    [mandatoryLogoGuideline], // Mandatory rule active!
    mockVisionNoLogo
  );
  const s4BPassed =
    auditRes4B.logoPresence.status === 'no_logo_detected' &&
    auditRes4B.findings.length === 1 &&
    auditRes4B.findings[0].category === 'logo_and_brand_identity' &&
    auditRes4B.findings[0].finding_title.includes('Mandatory Brand Logo Missing');
  recordResult(
    'Scenario 4B: Genuinely No Logo (Mandatory Rule) -> Flagged Missing Logo',
    s4BPassed,
    `Status: ${auditRes4B.logoPresence.status}, Finding: "${auditRes4B.findings[0]?.finding_title}"`
  );

  // -------------------------------------------------------------------
  // Scenario 5: Image with no readable text but a visible symbol mark
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 5: Image With No Readable Text But Visible Symbol Mark ---');
  const auditRes5 = auditImageLogoAndBrandIdentity(
    { width: 800, height: 800, aspectRatio: '1:1', format: 'PNG', dominantColor: '#1E1E2E', hasLegibleTypography: false, textLineCount: 0 },
    mockAssets,
    '', // Zero readable text!
    undefined,
    [mandatoryLogoGuideline],
    mockVisionSymbolOnly // But visible symbol logo exists!
  );
  const s5Passed =
    auditRes5.logoPresence.detected === true &&
    auditRes5.logoPresence.status === 'detected_unverified' &&
    auditRes5.findings.length === 0; // Not flagged as missing because the symbol is detected!
  recordResult(
    'Scenario 5: No Readable Text but Visible Symbol -> Logo Recognized, NOT Missing',
    s5Passed,
    `Detected: ${auditRes5.logoPresence.detected}, Status: ${auditRes5.logoPresence.status}, Findings count: ${auditRes5.findings.length}`
  );

  // -------------------------------------------------------------------
  // Scenario 6: Failed/Unavailable Vision Provider (Local Fallback)
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 6: Failed/Unavailable Vision Provider (Local Fallback) ---');
  const review6 = await runComplianceReview(
    'Product Image (Local Fallback)',
    'social_media',
    [mandatoryLogoGuideline],
    [],
    {
      imageUrl: paths.noLogoPath,
      assets: mockAssets,
      skipAI: true, // Forces local fallback!
    }
  );
  // In local fallback on image with no wordmark:
  // Must report 'uncertain' for symbol logos, and MUST NOT falsely claim "Mandatory Brand Logo Missing"!
  const hasFalseMissingLogo = review6.findings.some(f => f.finding_title.includes('Mandatory Brand Logo Missing'));
  const s6Passed =
    review6.metadata.logoPresence?.status === 'uncertain' &&
    review6.metadata.analysisMode === 'local_fallback' &&
    !hasFalseMissingLogo;
  recordResult(
    'Scenario 6: Local Fallback -> Status Uncertain, NO False Missing Logo Finding',
    s6Passed,
    `Status: ${review6.metadata.logoPresence?.status}, False missing logo flagged: ${hasFalseMissingLogo ? 'YES (bug)' : 'NO (correct)'}`
  );

  console.log('================================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} SCENARIOS PASSED (${Math.round((passedTests/totalTests)*100)}%) `);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runLogoVerificationSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
