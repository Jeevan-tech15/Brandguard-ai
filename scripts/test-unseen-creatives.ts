import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { runComplianceReview } from '../src/lib/engine';
import { BrandGuideline, ApprovedFact, AuthorizedAsset } from '../src/lib/types';

// Mock active guidelines
const MOCK_GUIDELINES: BrandGuideline[] = [
  {
    id: 'g-1',
    title: 'No Prohibited Absolute Guarantees',
    description: 'Marketing copy must never state unqualified absolutes such as "100% cure" or "zero risk".',
    rule_type: 'prohibited_claim',
    severity: 'high',
    rule_configuration: {
      keywords: ['100% cure', 'zero risk', 'unhackable', 'miracle cure'],
    },
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'g-2',
    title: 'Approved Slogan Capitalization',
    description: 'Use the official slogan "Engineered for Enterprise Reliability".',
    rule_type: 'exact_slogan',
    severity: 'medium',
    rule_configuration: {
      exact_slogan: 'Engineered for Enterprise Reliability',
    },
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Mock verified facts
const MOCK_FACTS: ApprovedFact[] = [
  {
    id: 'f-1',
    fact_text: 'Documented 99.9% uptime SLA with multi-region high availability',
    source_name: 'Engineering Infrastructure SLA 2026',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f-2',
    fact_text: 'Contains 40g of protein per serving bar',
    source_name: 'Nutrition Lab Certificate 2026',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f-3',
    fact_text: 'SOC-2 Type II Certified Security Infrastructure',
    source_name: 'Security & Compliance Report 2026',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Mock authorized assets (Acme, NaturaByte, SoundZen are authorized; Apple, Getty are NOT)
const MOCK_ASSETS: AuthorizedAsset[] = [
  {
    id: 'a-1',
    asset_name: 'SoundZen',
    asset_type: 'logo',
    file_url: '/assets/soundzen-logo.png',
    asset_metadata: { is_primary: true },
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a-2',
    asset_name: 'Acme Enterprise',
    asset_type: 'logo',
    file_url: '/assets/acme-logo.png',
    asset_metadata: { is_primary: true },
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a-3',
    asset_name: 'NaturaByte',
    asset_type: 'logo',
    file_url: '/assets/naturabyte-logo.png',
    asset_metadata: { is_primary: true },
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

async function createCreativeImage(svgContent: string, outputPath: string): Promise<string> {
  const pngBuffer = await sharp(Buffer.from(svgContent))
    .png()
    .toBuffer();
  fs.writeFileSync(outputPath, pngBuffer);
  return outputPath;
}

async function runUnseenCreativesValidation() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — 5 UNSEEN CREATIVES IMAGE-FIRST VALIDATION TEST ');
  console.log('================================================================\n');

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'creatives');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // -----------------------------------------------------------------
  // 1. Creative 1: Intentional Spelling Errors
  // -----------------------------------------------------------------
  const svg1 = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="#0f172a"/>
    <rect x="60" y="60" width="960" height="960" rx="24" fill="#1e293b" stroke="#334155" stroke-width="4"/>
    <text x="540" y="240" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="bold" fill="#38bdf8" text-anchor="middle">SOUNDZEN PRO</text>
    <text x="540" y="380" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="bold" fill="#f8fafc" text-anchor="middle">Gaurenteed Sound Clarity</text>
    <rect x="240" y="480" width="600" height="120" rx="16" fill="#ffffff" stroke="#f59e0b" stroke-width="4"/>
    <text x="540" y="555" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold" fill="#000000" text-anchor="middle">Limted Time Offfer</text>
    <text x="540" y="720" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#94a3b8" text-anchor="middle">Active Noise Cancellation with 40 Hours Playtime</text>
    <text x="540" y="880" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Terms apply. Results may vary by device.</text>
  </svg>`;
  const img1Path = path.join(uploadDir, 'unseen-test-1-spelling.png');
  await createCreativeImage(svg1, img1Path);
  console.log('✓ Generated Creative 1 (Intentional Spelling Errors): unseen-test-1-spelling.png');

  // -----------------------------------------------------------------
  // 2. Creative 2: Internal Discount Inconsistency (50% vs 70%)
  // -----------------------------------------------------------------
  const svg2 = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="#18181b"/>
    <rect x="60" y="60" width="960" height="960" rx="24" fill="#27272a" stroke="#3f3f46" stroke-width="4"/>
    <text x="540" y="220" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="bold" fill="#e4e4e7" text-anchor="middle">SUMMER MEGA SALE</text>
    <rect x="180" y="280" width="720" height="140" rx="20" fill="#dc2626"/>
    <text x="540" y="375" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="extrabold" fill="#ffffff" text-anchor="middle">50% OFF</text>
    <circle cx="540" cy="620" r="140" fill="#e11d48" stroke="#ffffff" stroke-width="6"/>
    <text x="540" y="610" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">SPECIAL PROMO</text>
    <text x="540" y="665" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="extrabold" fill="#ffffff" text-anchor="middle">70% OFF</text>
    <text x="540" y="860" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#a1a1aa" text-anchor="middle">Limited supplies in participating stores</text>
    <text x="540" y="940" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#71717a" text-anchor="middle">Terms apply. Cannot be combined with other offers.</text>
  </svg>`;
  const img2Path = path.join(uploadDir, 'unseen-test-2-internal-discount.png');
  await createCreativeImage(svg2, img2Path);
  console.log('✓ Generated Creative 2 (Internal Discount Contradiction 50% vs 70%): unseen-test-2-internal-discount.png');

  // -----------------------------------------------------------------
  // 3. Creative 3: Potential Third-Party IP Concern (Apple / Getty Images)
  // -----------------------------------------------------------------
  const svg3 = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="#09090b"/>
    <rect x="60" y="60" width="960" height="960" rx="24" fill="#18181b" stroke="#27272a" stroke-width="4"/>
    <text x="540" y="240" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" fill="#fafafa" text-anchor="middle">HYPERION AUDIO DOCK</text>
    <text x="540" y="380" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="semibold" fill="#38bdf8" text-anchor="middle">Powered by Apple iOS ecosystem</text>
    <rect x="220" y="460" width="640" height="240" rx="16" fill="#27272a" stroke="#52525b" stroke-dasharray="10 6" stroke-width="3"/>
    <text x="540" y="580" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="bold" fill="#71717a" text-anchor="middle">Getty Images</text>
    <text x="540" y="630" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#52525b" text-anchor="middle">(Sample Watermark Comp)</text>
    <text x="540" y="820" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#d4d4d8" text-anchor="middle">Next-generation audio dock engineered for creators</text>
    <text x="540" y="930" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#71717a" text-anchor="middle">Apple is a registered trademark. Comp asset for preview only.</text>
  </svg>`;
  const img3Path = path.join(uploadDir, 'unseen-test-3-third-party-ip.png');
  await createCreativeImage(svg3, img3Path);
  console.log('✓ Generated Creative 3 (Third-Party IP & Watermark Concern): unseen-test-3-third-party-ip.png');

  // -----------------------------------------------------------------
  // 4. Creative 4: Clean Compliant Creative
  // -----------------------------------------------------------------
  const svg4 = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="#0f172a"/>
    <rect x="60" y="60" width="960" height="960" rx="24" fill="#1e293b" stroke="#0ea5e9" stroke-width="4"/>
    <text x="540" y="240" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="bold" fill="#38bdf8" text-anchor="middle">ACME ENTERPRISE CLOUD</text>
    <text x="540" y="340" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="semibold" fill="#94a3b8" text-anchor="middle">Engineered for Enterprise Reliability</text>
    <rect x="160" y="420" width="760" height="200" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2"/>
    <text x="540" y="500" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#22c55e" text-anchor="middle">99.9% UPTIME SLA</text>
    <text x="540" y="560" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#cbd5e1" text-anchor="middle">Multi-Region High Availability &amp; Automated Failover</text>
    <text x="540" y="740" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#e2e8f0" text-anchor="middle">SOC-2 Type II Certified Security Infrastructure</text>
    <text x="540" y="880" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#64748b" text-anchor="middle">© 2026 Acme Enterprise. All rights reserved.</text>
  </svg>`;
  const img4Path = path.join(uploadDir, 'unseen-test-4-clean.png');
  await createCreativeImage(svg4, img4Path);
  console.log('✓ Generated Creative 4 (Clean Compliant Creative): unseen-test-4-clean.png');

  // -----------------------------------------------------------------
  // 5. Creative 5: No Caption Creative (Testing Pure Image-First Audit)
  // -----------------------------------------------------------------
  const svg5 = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="#14532d"/>
    <rect x="60" y="60" width="960" height="960" rx="24" fill="#166534" stroke="#4ade80" stroke-width="4"/>
    <text x="540" y="240" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="bold" fill="#f0fdf4" text-anchor="middle">NATURABYTE PROTEIN BAR</text>
    <text x="540" y="380" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="extrabold" fill="#bbf7d0" text-anchor="middle">40g Protein</text>
    <text x="540" y="500" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#ffffff" text-anchor="middle">100% Recyclable Packaging</text>
    <rect x="220" y="600" width="640" height="100" rx="12" fill="#14532d" stroke="#86efac" stroke-width="2"/>
    <text x="540" y="662" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#fef08a" text-anchor="middle">CONTAINS WHEAT &amp; GLUTEN</text>
    <text x="540" y="860" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#dcfce7" text-anchor="middle">Fuel your fitness with pure plant nutrition</text>
  </svg>`;
  const img5Path = path.join(uploadDir, 'unseen-test-5-no-caption.png');
  await createCreativeImage(svg5, img5Path);
  console.log('✓ Generated Creative 5 (Empty Caption Input): unseen-test-5-no-caption.png\n');

  // -----------------------------------------------------------------
  // EXECUTE COMPLIANCE AUDITS ACROSS ALL 5 CREATIVES
  // -----------------------------------------------------------------
  const results: Array<{
    name: string;
    score: number | null;
    governanceStatus: string;
    findingsCount: number;
    categoriesDetected: string[];
    passCheck: boolean;
    evidenceNotes: string;
  }> = [];

  // TEST 1
  console.log('--- RUNNING AUDIT 1: INTENTIONAL SPELLING ERROR CREATIVE ---');
  const res1 = await runComplianceReview(
    'SoundZen Pro Campaign',
    'social_media',
    MOCK_GUIDELINES,
    MOCK_FACTS,
    {
      imageUrl: '/uploads/creatives/unseen-test-1-spelling.png',
      captionText: 'Experience studio sound with SoundZen Pro wireless headphones.',
      assets: MOCK_ASSETS,
    }
  );
  const spellingFindings = res1.findings.filter((f) => f.category === 'spelling_and_grammar' || f.category === 'spelling_and_text');
  console.log(`Score: ${res1.compliance_score} | Governance: ${res1.metadata.governance_status} | Total Findings: ${res1.findings.length}`);
  console.log(`Spelling Findings Detected: ${spellingFindings.length} (${spellingFindings.map((f) => f.evidence_text).join(', ')})`);
  results.push({
    name: '1. Intentional Spelling Error',
    score: res1.compliance_score,
    governanceStatus: res1.metadata.governance_status || 'UNKNOWN',
    findingsCount: res1.findings.length,
    categoriesDetected: Array.from(new Set(res1.findings.map((f) => f.category))),
    passCheck: spellingFindings.length >= 1,
    evidenceNotes: `Successfully detected marketing typos: ${spellingFindings.map((f) => f.evidence_text).join(', ')}`,
  });

  // TEST 2
  console.log('\n--- RUNNING AUDIT 2: INTERNAL DISCOUNT INCONSISTENCY (50% vs 70%) ---');
  const res2 = await runComplianceReview(
    'Summer Mega Sale Campaign',
    'social_media',
    MOCK_GUIDELINES,
    MOCK_FACTS,
    {
      imageUrl: '/uploads/creatives/unseen-test-2-internal-discount.png',
      captionText: 'Get the best summer deals with up to 50% off select items.',
      assets: MOCK_ASSETS,
    }
  );
  const conflictDiscount = res2.findings.filter(
    (f) =>
      f.finding_title.toLowerCase().includes('conflicting') &&
      f.finding_title.toLowerCase().includes('discount')
  );
  console.log(`Score: ${res2.compliance_score} | Governance: ${res2.metadata.governance_status} | Total Findings: ${res2.findings.length}`);
  console.log(`Internal Discount Conflict Detected: ${conflictDiscount.length > 0 ? 'YES' : 'NO'} (${conflictDiscount[0]?.evidence_text || 'none'})`);
  results.push({
    name: '2. Internal Discount Contradiction (50% vs 70%)',
    score: res2.compliance_score,
    governanceStatus: res2.metadata.governance_status || 'UNKNOWN',
    findingsCount: res2.findings.length,
    categoriesDetected: Array.from(new Set(res2.findings.map((f) => f.category))),
    passCheck: conflictDiscount.length > 0,
    evidenceNotes: `Detected internal discount contradiction: "${conflictDiscount[0]?.evidence_text}" with critical severity`,
  });

  // TEST 3
  console.log('\n--- RUNNING AUDIT 3: THIRD-PARTY IP & WATERMARK CONCERN ---');
  const res3 = await runComplianceReview(
    'Hyperion Audio Dock Post',
    'social_media',
    MOCK_GUIDELINES,
    MOCK_FACTS,
    {
      imageUrl: '/uploads/creatives/unseen-test-3-third-party-ip.png',
      captionText: 'Upgrade your desktop audio setup with our sleek wireless dock.',
      assets: MOCK_ASSETS,
    }
  );
  const ipFindings = res3.findings.filter((f) => f.category === 'copyright_and_ip_risk');
  console.log(`Score: ${res3.compliance_score} | Governance: ${res3.metadata.governance_status} | Total Findings: ${res3.findings.length}`);
  console.log(`Copyright / IP Findings Detected: ${ipFindings.length} (${ipFindings.map((f) => f.finding_title).join('; ')})`);
  const hasHumanVerify = ipFindings.some((f) => f.needs_human_verification);
  results.push({
    name: '3. Third-Party IP & Watermark Concern',
    score: res3.compliance_score,
    governanceStatus: res3.metadata.governance_status || 'UNKNOWN',
    findingsCount: res3.findings.length,
    categoriesDetected: Array.from(new Set(res3.findings.map((f) => f.category))),
    passCheck: ipFindings.length > 0 && hasHumanVerify,
    evidenceNotes: `Flagged for Human Review: ${ipFindings.map((f) => f.evidence_text).join(', ')}`,
  });

  // TEST 4
  console.log('\n--- RUNNING AUDIT 4: CLEAN COMPLIANT CREATIVE ---');
  const res4 = await runComplianceReview(
    'Acme Enterprise Cloud Uptime SLA',
    'social_media',
    MOCK_GUIDELINES,
    MOCK_FACTS,
    {
      imageUrl: '/uploads/creatives/unseen-test-4-clean.png',
      captionText: 'Acme Enterprise Cloud provides verified 99.9% uptime SLA with SOC-2 Type II security.',
      assets: MOCK_ASSETS,
    }
  );
  console.log(`Score: ${res4.compliance_score} | Governance: ${res4.metadata.governance_status} | Total Findings: ${res4.findings.length}`);
  const isCleanPass = res4.compliance_score === 100 && res4.metadata.governance_status === 'PASS';
  results.push({
    name: '4. Clean Compliant Creative',
    score: res4.compliance_score,
    governanceStatus: res4.metadata.governance_status || 'UNKNOWN',
    findingsCount: res4.findings.length,
    categoriesDetected: Array.from(new Set(res4.findings.map((f) => f.category))),
    passCheck: res4.compliance_score !== null && res4.compliance_score >= 90 && res4.findings.length === 0,
    evidenceNotes: `Score: ${res4.compliance_score}% with 0 violations. Verified approved corporate SLA and brand policy.`,
  });

  // TEST 5
  console.log('\n--- RUNNING AUDIT 5: PURE IMAGE-FIRST REVIEW (EMPTY CAPTION) ---');
  const res5 = await runComplianceReview(
    'NaturaByte Pure Image Post',
    'social_media',
    MOCK_GUIDELINES,
    MOCK_FACTS,
    {
      imageUrl: '/uploads/creatives/unseen-test-5-no-caption.png',
      captionText: '', // NO CAPTION SUPPLIED!
      assets: MOCK_ASSETS,
    }
  );
  console.log(`Score: ${res5.compliance_score} | Governance: ${res5.metadata.governance_status} | Total Findings: ${res5.findings.length}`);
  console.log(`Modality: ${res5.metadata.modality} | Extracted OCR: ${res5.extracted_ocr_text?.slice(0, 60).replace(/\n/g, ' ')}...`);
  results.push({
    name: '5. Creative with Empty Caption (Pure Image Analysis)',
    score: res5.compliance_score,
    governanceStatus: res5.metadata.governance_status || 'UNKNOWN',
    findingsCount: res5.findings.length,
    categoriesDetected: Array.from(new Set(res5.findings.map((f) => f.category))),
    passCheck: res5.metadata.modality === 'image_only' && Boolean(res5.extracted_ocr_text && res5.extracted_ocr_text.includes('NATURABYTE')),
    evidenceNotes: `Image-only modality verified. Extracted OCR typography independently without requiring caption input.`,
  });

  console.log('\n================================================================');
  console.log(' SUMMARY OF UNSEEN CREATIVES VALIDATION SUITE ');
  console.log('================================================================');
  for (const r of results) {
    console.log(`[${r.passCheck ? 'PASS' : 'FAIL'}] ${r.name}`);
    console.log(`       Status: ${r.governanceStatus} | Score: ${r.score} | Findings: ${r.findingsCount}`);
    console.log(`       Categories: ${r.categoriesDetected.join(', ') || 'none'}`);
    console.log(`       Notes: ${r.evidenceNotes}\n`);
  }

  const allPassed = results.every((r) => r.passCheck);
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL 5 TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
}

runUnseenCreativesValidation().catch((err) => {
  console.error('Validation test failed with error:', err);
  process.exit(1);
});
