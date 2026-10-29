import path from 'path';
import fs from 'fs';
import { runComplianceReview } from '../src/lib/engine';
import { createContentReview, updateContentReviewVersion, getContentReviewById } from '../src/lib/db';
import { BrandGuideline, ApprovedFact, ContentType } from '../src/lib/types';

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('BRANDGUARD AI - THREE INDEPENDENT STAGES VERIFICATION');
  console.log('====================================================\n');

  // Shared guidelines & facts
  const guidelines: BrandGuideline[] = [
    {
      id: 'g-1',
      title: 'No Unsubstantiated Absolutes',
      description: 'Avoid absolute statements without verified data',
      rule_type: 'forbidden_words',
      severity: 'high',
      rule_configuration: {
        forbidden_examples: ['completely eliminate', 'guarantee 100% results'],
      },
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'g-2',
      title: 'Disallowed Term: Miracle',
      description: 'Do not use misleading medical or performance terms',
      rule_type: 'forbidden_words',
      severity: 'critical',
      rule_configuration: {
        forbidden_examples: ['miracle cure', 'miracle'],
      },
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const facts: ApprovedFact[] = [
    {
      id: 'f-1',
      fact_text: 'Maximum promotional discount is 50% OFF',
      source_name: 'Brand Promotion Policy 2026',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  // Helper to create test image
  const creativesDir = path.join(process.cwd(), 'public', 'uploads', 'creatives');
  if (!fs.existsSync(creativesDir)) {
    fs.mkdirSync(creativesDir, { recursive: true });
  }

  // ----------------------------------------------------
  // TEST 1: STAGE 1 (IMAGE-ONLY WITHOUT CAPTION)
  // ----------------------------------------------------
  console.log('--- TEST 1: STAGE 1 (IMAGE-ONLY WITHOUT CAPTION) ---');
  // Creative contains: "100% Guarentee" (spelling mistake) & "FLAT 70% OFF" and "FLAT 50% OFF" (internal image conflict)
  const imageOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="#1e1b4b"/>
    <text x="80" y="200" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff">NovaPay Fintech</text>
    <text x="80" y="320" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#38bdf8">FLAT 70% OFF</text>
    <text x="80" y="440" font-family="Arial, sans-serif" font-size="36" fill="#f87171">Now only FLAT 50% OFF</text>
    <text x="80" y="560" font-family="Arial, sans-serif" font-size="32" fill="#ffffff">100% Guarentee Included</text>
  </svg>`;

  const img1Path = path.join(creativesDir, 'test-image-stage1.svg');
  fs.writeFileSync(img1Path, imageOnlySvg, 'utf-8');

  const stage1Result = await runComplianceReview(
    '', // No content text
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/test-image-stage1.svg',
      captionText: '', // NO CAPTION PROVIDED
    }
  );

  console.log(`Modality: ${stage1Result.metadata.modality}`);
  console.log(`Extracted Image OCR:\n${stage1Result.extracted_ocr_text?.trim() || ''}`);
  console.log(`Findings count: ${stage1Result.findings.length}`);
  stage1Result.findings.forEach((f, i) => {
    console.log(`  #${i + 1} [scope: ${f.target_scope}] [severity: ${f.severity}] ${f.finding_title}`);
    console.log(`     Evidence: ${f.evidence_text || f.image_evidence}`);
    console.log(`     Fix: ${f.suggested_fix || f.proposed_replacement}`);
  });

  const hasOnlyImageScope = stage1Result.findings.every((f) => f.target_scope === 'image');
  console.log(`Assert all findings target_scope === 'image': ${hasOnlyImageScope ? 'PASSED' : 'FAILED'}`);
  const hasSpellingOrConflict = stage1Result.findings.some(
    (f) => f.category === 'spelling_grammar' || f.finding_title.includes('Conflicting Promotional Discount')
  );
  console.log(`Assert detected image-only issue (typo/internal conflict): ${hasSpellingOrConflict ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 2: STAGE 2 (CAPTION-ONLY WITHOUT IMAGE)
  // ----------------------------------------------------
  console.log('--- TEST 2: STAGE 2 (CAPTION-ONLY WITHOUT IMAGE) ---');
  const captionOnlyText = 'Try NovaPay! Our miracle algorithm will completely eliminate transaction fees forever. Seperate fees apply.';

  const stage2Result = await runComplianceReview(
    captionOnlyText,
    'social_media',
    guidelines,
    facts,
    {
      captionText: captionOnlyText,
      imageUrl: '', // NO IMAGE PROVIDED
    }
  );

  console.log(`Modality: ${stage2Result.metadata.modality}`);
  console.log(`Findings count: ${stage2Result.findings.length}`);
  stage2Result.findings.forEach((f, i) => {
    console.log(`  #${i + 1} [scope: ${f.target_scope}] [severity: ${f.severity}] ${f.finding_title}`);
    console.log(`     Evidence: ${f.evidence_text || f.caption_evidence}`);
    console.log(`     Fix: ${f.suggested_fix || f.proposed_replacement}`);
  });

  const hasOnlyCaptionScope = stage2Result.findings.every((f) => f.target_scope === 'caption');
  console.log(`Assert all findings target_scope === 'caption': ${hasOnlyCaptionScope ? 'PASSED' : 'FAILED'}`);
  const hasProhibitedTerm = stage2Result.findings.some((f) => f.finding_title.includes('miracle'));
  console.log(`Assert prohibited term detected in caption: ${hasProhibitedTerm ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 3: STAGE 3 (CROSS-MODAL CONFLICT COMPARISON)
  // ----------------------------------------------------
  console.log('--- TEST 3: STAGE 3 (CROSS-MODAL CONFLICT COMPARISON) ---');
  // Image says "60% OFF", caption says "50% OFF"
  const soundzenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="#0f172a"/>
    <text x="80" y="200" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="#ffffff">SoundZen Audio</text>
    <text x="80" y="340" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#22c55e">FLAT 60% OFF</text>
    <text x="80" y="460" font-family="Arial, sans-serif" font-size="32" fill="#cbd5e1">Active Noise Cancelling</text>
  </svg>`;
  const soundzenPath = path.join(creativesDir, 'test-soundzen-creative.svg');
  fs.writeFileSync(soundzenPath, soundzenSvg, 'utf-8');

  const soundzenCaption = 'Experience pure silence with SoundZen Audio headphones! Get FLAT 50% OFF on all models today.';

  const stage3Result = await runComplianceReview(
    soundzenCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/test-soundzen-creative.svg',
      captionText: soundzenCaption,
    }
  );

  console.log(`Modality: ${stage3Result.metadata.modality}`);
  console.log(`Findings count: ${stage3Result.findings.length}`);
  stage3Result.findings.forEach((f, i) => {
    console.log(`  #${i + 1} [scope: ${f.target_scope}] [cat: ${f.category}] ${f.finding_title}`);
    console.log(`     Image Evidence: "${f.image_evidence}" vs Caption Evidence: "${f.caption_evidence}"`);
  });

  const conflictFinding = stage3Result.findings.find((f) => f.category === 'cross_modal_conflict');
  const has60vs50 = conflictFinding && conflictFinding.finding_title.includes('60%') && conflictFinding.finding_title.includes('50%');
  console.log(`Assert detected 60% vs 50% cross-modal conflict: ${has60vs50 ? 'PASSED' : 'FAILED'}`);
  console.log(`Assert conflict target_scope === 'both': ${conflictFinding?.target_scope === 'both' ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 4: CLEAN CREATIVE (ZERO VIOLATIONS)
  // ----------------------------------------------------
  console.log('--- TEST 4: CLEAN CREATIVE (ZERO VIOLATIONS) ---');
  const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="#064e3b"/>
    <text x="80" y="200" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#ffffff">AeroPulse Health</text>
    <text x="80" y="340" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#a7f3d0">FLAT 50% OFF</text>
    <text x="80" y="460" font-family="Arial, sans-serif" font-size="32" fill="#ffffff">Smart Pulse Monitor</text>
  </svg>`;
  const cleanPath = path.join(creativesDir, 'test-clean-creative.svg');
  fs.writeFileSync(cleanPath, cleanSvg, 'utf-8');

  const cleanCaption = 'Track your fitness journey with AeroPulse Smart Pulse Monitor. FLAT 50% OFF available now.';

  const cleanResult = await runComplianceReview(
    cleanCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/test-clean-creative.svg',
      captionText: cleanCaption,
    }
  );

  console.log(`Clean result findings count: ${cleanResult.findings.length}`);
  console.log(`Compliance score: ${cleanResult.compliance_score}%`);
  console.log(`Status: ${cleanResult.status}`);
  console.log(`Assert 0 violations and 100% compliant: ${cleanResult.findings.length === 0 && cleanResult.compliance_score === 100 ? 'PASSED' : 'FAILED'}\n`);

  // ----------------------------------------------------
  // TEST 5: IMAGE REPLACEMENT TRIGGERS FRESH ANALYSIS WITHOUT STALE OCR
  // ----------------------------------------------------
  console.log('--- TEST 5: IMAGE REPLACEMENT & FRESH RE-EVALUATION ---');
  // Create review with SoundZen 60% image
  const initialReview = await createContentReview({
    title: 'SoundZen Audio Launch',
    content_text: soundzenCaption,
    content_type: 'social_media',
    image_url: '/uploads/creatives/test-soundzen-creative.svg',
    caption_text: soundzenCaption,
  });

  console.log(`Initial review created (ID: ${initialReview.id}, v${initialReview.review_version})`);
  console.log(`Initial findings count: ${initialReview.findings?.length || 0}`);
  console.log(`Initial OCR: ${initialReview.extracted_ocr_text?.replace(/\n/g, ' ')}`);

  // Now replace image with clean AeroPulse 50% image
  const updatedReview = await updateContentReviewVersion(initialReview.id, {
    title: 'SoundZen Audio Launch v2',
    image_url: '/uploads/creatives/test-clean-creative.svg',
    caption_text: cleanCaption,
    content_text: cleanCaption,
  });

  console.log(`Updated review after image replacement (v${updatedReview.review_version})`);
  console.log(`Updated findings count: ${updatedReview.findings?.length || 0}`);
  console.log(`Updated OCR: ${updatedReview.extracted_ocr_text?.replace(/\n/g, ' ')}`);

  const fetchedReview = await getContentReviewById(initialReview.id);
  const noStale60 = !fetchedReview?.extracted_ocr_text?.includes('60%') && Boolean(fetchedReview?.extracted_ocr_text?.includes('50%'));
  console.log(`Assert stale OCR "60%" purged and new OCR "50%" extracted: ${noStale60 ? 'PASSED' : 'FAILED'}`);
  console.log(`Assert new review has 0 cross-modal conflicts: ${fetchedReview?.findings?.length === 0 ? 'PASSED' : 'FAILED'}\n`);

  console.log('====================================================');
  console.log('ALL VERIFICATION STAGES COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
