import fs from 'fs';
import path from 'path';
import { runComplianceReview } from '../src/lib/engine';
import { BrandGuideline, ApprovedFact, AuthorizedAsset } from '../src/lib/types';

async function runVisualInspectionSuite() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — VISUAL INSPECTION & DEFECT COVERAGE SUITE      ');
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
  // SCENARIO 1: Digital Work Banner Creative (The User-Reported Asset)
  // Expected: Floating volume slider overlay, broken word "Digi tal", expired offer deadline
  // -------------------------------------------------------------------------
  console.log('--- SCENARIO 1: Digital Work Banner Creative (f933ffa2-f434-42c7-86cd-a266e993d8ac) ---');
  const bannerReview = db.content_reviews.find((x: any) => x.id === 'f933ffa2-f434-42c7-86cd-a266e993d8ac');
  if (bannerReview) {
    const res = await runComplianceReview(bannerReview.title, bannerReview.content_type, guidelines, facts, {
      imageUrl: bannerReview.image_url,
      captionText: bannerReview.caption_text,
      assets,
      skipAI: true, // test local fallback engine
    });

    const hasBrokenWord = res.findings.some(f => f.finding_title.includes('Digi tal') || (f.evidence_text && f.evidence_text.includes('Digi tal')));
    const hasOverlay = res.findings.some(f => f.finding_title.includes('Floating Overlay') || f.category === 'other_visible_issues');
    const hasExpiredDate = res.findings.some(f => f.finding_title.includes('Expired Promotional Validity') || (f.evidence_text && f.evidence_text.includes('SEPTEMBER 2026')));
    const not100 = res.compliance_score !== null && res.compliance_score < 100;
    const notApproved = res.status !== 'approved';

    assert(hasBrokenWord, '1A: Broken Word / Split Syllables "Digi tal" detected', `Findings: ${res.findings.filter(f => f.category === 'spelling_and_text').map(f => f.finding_title).join(', ')}`);
    assert(hasOverlay, '1B: Floating volume control slider overlay detected', `Findings: ${res.findings.filter(f => f.category === 'other_visible_issues').map(f => f.finding_title).join(', ')}`);
    assert(hasExpiredDate, '1C: Expired promotional deadline (Sept 30, 2026) detected', `Findings: ${res.findings.filter(f => f.category === 'claims_and_consistency').map(f => f.finding_title).join(', ')}`);
    assert(not100, '1D: Score is penalized (NOT false 100%)', `Score: ${res.compliance_score}`);
    assert(notApproved, '1E: Creative status is flagged/review (NOT blindly approved)', `Status: ${res.status}, Governance: ${res.metadata.governance_status}`);
  } else {
    console.warn('Banner review not found in db.json');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 2: Creative with Visible Advertising Typos
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Creative with Visible Typos (Crispy Bites) ---');
  const chickenReview = db.content_reviews.find((x: any) => x.id === '33b5fdf6-e212-4476-9685-413d9f768aea');
  if (chickenReview) {
    const res = await runComplianceReview(chickenReview.title, chickenReview.content_type, guidelines, facts, {
      imageUrl: chickenReview.image_url,
      captionText: chickenReview.caption_text,
      assets,
      skipAI: true,
    });

    const detected = res.findings.map(f => (f.evidence_text || f.finding_title).toLowerCase());
    const hasChiken = detected.some(d => d.includes('chiken'));
    const hasBeleave = detected.some(d => d.includes('beleave'));
    const hasPerfekt = detected.some(d => d.includes('perfekt'));

    assert(hasChiken && hasBeleave && hasPerfekt, '2A: Visible advertising typos detected', `Detected: [chiken: ${hasChiken}, beleave: ${hasBeleave}, perfekt: ${hasPerfekt}]`);
    assert(res.compliance_score! < 100, '2B: Compliance score penalized', `Score: ${res.compliance_score}`);
  }

  // -------------------------------------------------------------------------
  // SCENARIO 3: Creative with Typography Collision / Overlap Defects
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Typography Overlap / Collision Defects ---');
  const collisionReview = db.content_reviews.find((x: any) => x.id === 'd8c8f374-3e25-4c0e-a626-7faa2e542470');
  if (collisionReview) {
    const res = await runComplianceReview(collisionReview.title, collisionReview.content_type, guidelines, facts, {
      imageUrl: collisionReview.image_url,
      captionText: collisionReview.caption_text,
      assets,
      skipAI: true,
    });

    const hasCollision = res.findings.some(f => f.category === 'layout_and_design_quality' && f.finding_title.includes('Collision'));
    assert(hasCollision, '3A: Text collision / overlapping typography detected', `Layout findings: ${res.findings.filter(f => f.category === 'layout_and_design_quality').map(f => f.finding_title).join(', ')}`);
  }

  // -------------------------------------------------------------------------
  // SCENARIO 4: Zero Findings in Fallback Mode Never Blindly Approves
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Local Fallback Zero-Finding Governance Guard ---');
  // Pass an image that produces zero findings in fallback mode
  const cleanImageRes = await runComplianceReview('Test Clean Creative', 'social_media', guidelines, facts, {
    imageUrl: 'public/uploads/creatives/logo-test-2-wordmark.png',
    skipAI: true,
  });

  const neverApprovedWithoutVision = cleanImageRes.status !== 'approved';
  const governanceNotBlindPass = cleanImageRes.metadata.governance_status !== 'PASS';
  const disclosurePresent = cleanImageRes.metadata.disclosures?.some((d: string) => d.includes('human visual review') || d.includes('fallback') || d.includes('AI provider unavailable'));

  assert(neverApprovedWithoutVision, '4A: Status remains in_review when AI vision is unavailable', `Status: ${cleanImageRes.status}`);
  assert(governanceNotBlindPass, '4B: Governance status requires review (not automatic PASS)', `Governance: ${cleanImageRes.metadata.governance_status}`);
  assert(Boolean(disclosurePresent), '4C: Honest limitation disclosure returned', `Disclosures: ${JSON.stringify(cleanImageRes.metadata.disclosures)}`);

  // -------------------------------------------------------------------------
  // SCENARIO 5: Symbol Logo Handling
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Symbol Logo Presence Integrity ---');
  const symbolRes = await runComplianceReview('Symbol Logo Test', 'social_media', [], [], {
    imageUrl: 'public/uploads/creatives/logo-test-1-symbol.png',
    assets,
    skipAI: true,
  });

  const noFalseMissingLogo = !symbolRes.findings.some(f => f.finding_title.toLowerCase().includes('mandatory brand logo missing'));
  assert(noFalseMissingLogo, '5A: Does NOT falsely flag "Mandatory Logo Missing" in fallback mode when no mandatory rule exists', `Findings: ${symbolRes.findings.length}`);

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

runVisualInspectionSuite().catch((err) => {
  console.error('Visual inspection suite fatal error:', err);
  process.exit(1);
});

