/**
 * BrandGuard AI — Multi-Industry Creative Compliance & Cross-Modal Verification Suite
 *
 * Evaluates unseen, held-out creatives across 5 major vertical industries:
 * 1. Technology / Cloud SaaS: Pricing and SLA contradictions + Prohibited absolute guarantees
 * 2. Food & Beverage: Temperature retention match + Unsubstantiated organic/nutritional claim
 * 3. Apparel & Fashion: Material percentage safeguard (100% Merino) + Return window contradiction
 * 4. Retail & Hardware: Power wattage & Warranty contradictions
 * 5. Professional Services: Turnaround/Settlement duration contradiction
 * 6. Low-Text Artistic Creative: Graceful partial analysis gate (no crash, no auto-approval)
 *
 * Tracks True Positives, True Negatives, False Positives, and False Negatives.
 */

import { runComplianceReview } from '../src/lib/engine';
import { runCrossModalChecks } from '../src/lib/engine/cross-modal';
import { getBrandGuidelines, getApprovedFacts, getAuthorizedAssets, createContentReview, getContentReviewById } from '../src/lib/db';
import { extractImageDimensions, classifyAspectRatio } from '../src/lib/image-utils';
import fs from 'fs';
import path from 'path';

let tp = 0; // True Positives
let tn = 0; // True Negatives
let fp = 0; // False Positives
let fn = 0; // False Negatives

function recordTest(isSuccess: boolean, metricType: 'TP' | 'TN' | 'FP' | 'FN', label: string, details?: string) {
  if (metricType === 'TP') {
    if (isSuccess) { tp++; console.log(`  ✓ [TP: True Positive] ${label}`); }
    else { fn++; console.error(`  ✗ [FN: Missed Violation] ${label}${details ? ` -> ${details}` : ''}`); }
  } else if (metricType === 'TN') {
    if (isSuccess) { tn++; console.log(`  ✓ [TN: True Negative] ${label}`); }
    else { fp++; console.error(`  ✗ [FP: False Alarm] ${label}${details ? ` -> ${details}` : ''}`); }
  }
}

async function runMultiIndustryMatrix() {
  console.log('================================================================');
  console.log('BRANDGUARD AI: MULTI-INDUSTRY CREATIVE COMPLIANCE BENCHMARK');
  console.log('================================================================\n');

  const [guidelines, facts, assets] = await Promise.all([
    getBrandGuidelines(true),
    getApprovedFacts(true),
    getAuthorizedAssets(true),
  ]);

  const creativesDir = path.join(process.cwd(), 'public', 'uploads', 'creatives');
  if (!fs.existsSync(creativesDir)) {
    fs.mkdirSync(creativesDir, { recursive: true });
  }

  // =================================================================
  // CATEGORY 1: TECHNOLOGY / CLOUD SAAS
  // Image: $79/mo, 99.999% SLA Uptime, 30-day free trial
  // Caption: $99/mo, 99.9% uptime, 14-day free trial, "100% unhackable cloud security"
  // =================================================================
  console.log('--- Industry 1: Technology & Cloud Infrastructure ---');
  const techImgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="#0B132B"/>
    <text x="100" y="200" fill="#48CAE4" font-size="54" font-family="sans-serif" font-weight="bold">CloudNova Enterprise Platform</text>
    <text x="100" y="320" fill="#FFFFFF" font-size="44" font-family="sans-serif">Starting at $79/mo billed annually</text>
    <text x="100" y="440" fill="#90E0EF" font-size="38" font-family="sans-serif">99.999% SLA Uptime Guarantee</text>
    <text x="100" y="560" fill="#FFFFFF" font-size="34" font-family="sans-serif">30-day free trial with full API access</text>
  </svg>`;
  const techImgPath = path.join(creativesDir, 'heldout-tech-cloudnova.svg');
  fs.writeFileSync(techImgPath, techImgContent, 'utf-8');

  const techCaption = `Scale your enterprise workloads with CloudNova! Get started for $99/mo with our 14-day free trial. Experience 99.9% uptime and 100% unhackable security architecture built for modern scale.`;

  const techReview = await runComplianceReview(
    techCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/heldout-tech-cloudnova.svg',
      captionText: techCaption,
      assets,
    }
  );

  // Check 1: Price contradiction ($79 vs $99)
  const techPriceContradiction = techReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('price'));
  recordTest(Boolean(techPriceContradiction), 'TP', 'Detects SaaS monthly subscription price contradiction ($79 vs $99)');

  // Check 2: Free trial duration contradiction (30 days vs 14 days)
  const techTrialContradiction = techReview.findings.find(f => f.category === 'cross_modal_conflict' && (f.finding_title.toLowerCase().includes('trial') || f.finding_title.toLowerCase().includes('duration')));
  recordTest(Boolean(techTrialContradiction), 'TP', 'Detects evaluation trial window contradiction (30 days vs 14 days)');

  // Check 3: Prohibited absolute claim ("100% unhackable")
  const techProhibitedClaim = techReview.findings.find(f => f.category === 'prohibited_claim' && f.evidence_text?.toLowerCase().includes('unhackable'));
  recordTest(Boolean(techProhibitedClaim), 'TP', 'Flags prohibited absolute security claim ("100% unhackable")');

  // Check 4: Governance Gate
  recordTest(techReview.status === 'flagged', 'TP', 'Assigns FLAGGED governance gate due to critical policy contradictions');
  console.log();

  // =================================================================
  // CATEGORY 2: FOOD & BEVERAGE / CONSUMER HEALTH
  // Image: Keeps Cold For up to 24 hours, 100% Cold-Pressed, $6.99
  // Caption: Keeps cold for 24 hours, $6.99, "clinically proven to reverse cellular aging completely"
  // =================================================================
  console.log('--- Industry 2: Food & Beverage (Health & Wellness) ---');
  const foodImgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <rect width="1080" height="1350" fill="#283618"/>
    <text x="80" y="220" fill="#DDA15E" font-size="52" font-family="sans-serif" font-weight="bold">PureVita Botanical Cold Brew</text>
    <text x="80" y="340" fill="#FEFAE0" font-size="38" font-family="sans-serif">Keeps cold for up to 24 hours</text>
    <text x="80" y="460" fill="#FEFAE0" font-size="36" font-family="sans-serif">100% cold-pressed organic ingredients</text>
    <text x="80" y="580" fill="#DDA15E" font-size="44" font-family="sans-serif">Only $6.99 per bottle</text>
  </svg>`;
  const foodImgPath = path.join(creativesDir, 'heldout-food-purevita.svg');
  fs.writeFileSync(foodImgPath, foodImgContent, 'utf-8');

  const foodCaption = `Fuel your vitality with PureVita Botanical Cold Brew! Keeps cold for 24 hours and priced at $6.99. Scientifically formulated and clinically proven to reverse cellular aging completely.`;

  const foodReview = await runComplianceReview(
    foodCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/heldout-food-purevita.svg',
      captionText: foodCaption,
      assets,
    }
  );

  // Check 1: Matching cooling duration should NOT trigger a contradiction (TN)
  const foodDurationConflict = foodReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('cooling'));
  recordTest(!foodDurationConflict, 'TN', 'Zero false duration contradiction on matching cooling claims (24h == 24h)');

  // Check 2: Matching price ($6.99 == $6.99) should NOT trigger a contradiction (TN)
  const foodPriceConflict = foodReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('price'));
  recordTest(!foodPriceConflict, 'TN', 'Zero false price contradiction on matching price quotes ($6.99 == $6.99)');

  // Check 3: Material percentage (100% cold-pressed) should NOT be parsed as a discount (TN)
  const foodDiscountConflict = foodReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('discount'));
  recordTest(!foodDiscountConflict, 'TN', '100% cold-pressed organic ingredients is not misclassified as promotional discount');

  // Check 4: Unverified medical/biological claim ("reverse cellular aging")
  const foodMedicalClaim = foodReview.findings.find(f => f.category === 'unsubstantiated_claim');
  recordTest(Boolean(foodMedicalClaim), 'TP', 'Flags unsubstantiated clinical/biological claim ("reverse cellular aging") requiring empirical evidence');
  console.log();

  // =================================================================
  // CATEGORY 3: APPAREL & FASHION
  // Image: 100% Merino Wool, FLAT 30% OFF, 60-day returns
  // Caption: 100% Merino Wool, FLAT 40% OFF, 30-day returns
  // =================================================================
  console.log('--- Industry 3: Apparel & Luxury Retail ---');
  const apparelImgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="#1C1917"/>
    <text x="90" y="200" fill="#E7E5E4" font-size="50" font-family="serif">Aethelgard Knitwear</text>
    <text x="90" y="320" fill="#A8A29E" font-size="36" font-family="sans-serif">Crafted from 100% Merino Wool</text>
    <text x="90" y="440" fill="#FAFAF9" font-size="46" font-family="sans-serif">FLAT 30% OFF AUTUMN SALE</text>
    <text x="90" y="560" fill="#D6D3D1" font-size="34" font-family="sans-serif">60-day return window on all orders</text>
  </svg>`;
  const apparelImgPath = path.join(creativesDir, 'heldout-apparel-aethelgard.svg');
  fs.writeFileSync(apparelImgPath, apparelImgContent, 'utf-8');

  const apparelCaption = `Discover the warmth of Aethelgard. Made from 100% Merino Wool. Enjoy FLAT 40% OFF today with our 30-day returns policy. Elevate your wardrobe with sustainable luxury.`;

  const apparelReview = await runComplianceReview(
    apparelCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/heldout-apparel-aethelgard.svg',
      captionText: apparelCaption,
      assets,
    }
  );

  // Check 1: 100% Merino Wool is recognized as material and does NOT trigger contradiction
  const apparelMaterialConflict = apparelReview.findings.find(f => f.category === 'cross_modal_conflict' && f.evidence_text?.includes('Merino'));
  recordTest(!apparelMaterialConflict, 'TN', 'Identical material statement (100% Merino Wool) generates zero false alarms');

  // Check 2: Promotional discount contradiction (30% vs 40%)
  const apparelDiscountConflict = apparelReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('discount'));
  recordTest(Boolean(apparelDiscountConflict), 'TP', 'Detects promotional fashion discount conflict (30% in image vs 40% in caption)');

  // Check 3: Return policy duration contradiction (60 days vs 30 days)
  const apparelReturnConflict = apparelReview.findings.find(f => f.category === 'cross_modal_conflict' && (f.finding_title.toLowerCase().includes('trial') || f.finding_title.toLowerCase().includes('duration') || f.finding_title.toLowerCase().includes('return')));
  recordTest(Boolean(apparelReturnConflict), 'TP', 'Detects customer return window contradiction (60 days vs 30 days)');
  console.log();

  // =================================================================
  // CATEGORY 4: HARDWARE & CONSUMER ELECTRONICS
  // Image: 100W Fast Charging, 5-year warranty, 500ml capacity
  // Caption: 45W Fast Charging, 2-year warranty, 500ml capacity
  // =================================================================
  console.log('--- Industry 4: Hardware & Consumer Electronics ---');
  const hwImgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="#0F172A"/>
    <text x="100" y="200" fill="#38BDF8" font-size="52" font-family="sans-serif" font-weight="bold">VoltMax GaN Charger Pro</text>
    <text x="100" y="320" fill="#F8FAFC" font-size="42" font-family="sans-serif">100W Fast Charging Output</text>
    <text x="100" y="440" fill="#F8FAFC" font-size="38" font-family="sans-serif">Comes with a 5-year warranty</text>
    <text x="100" y="560" fill="#94A3B8" font-size="34" font-family="sans-serif">500ml compact travel case included</text>
  </svg>`;
  const hwImgPath = path.join(creativesDir, 'heldout-hw-voltmax.svg');
  fs.writeFileSync(hwImgPath, hwImgContent, 'utf-8');

  const hwCaption = `Meet the VoltMax GaN Charger Pro! Featuring 45W fast charging output, a 2-year warranty, and a 500ml travel case. Ultra-compact power for all your devices.`;

  const hwReview = await runComplianceReview(
    hwCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/heldout-hw-voltmax.svg',
      captionText: hwCaption,
      assets,
    }
  );

  // Check 1: Electrical wattage contradiction (100W vs 45W)
  const hwPowerConflict = hwReview.findings.find(f => f.category === 'cross_modal_conflict' && (f.finding_title.toLowerCase().includes('power') || f.evidence_text?.includes('100W') || f.finding_title.toLowerCase().includes('specification')));
  recordTest(Boolean(hwPowerConflict), 'TP', 'Detects electrical power wattage contradiction (100W image vs 45W caption)');

  // Check 2: Warranty contradiction (5-year vs 2-year)
  const hwWarrantyConflict = hwReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('warranty'));
  recordTest(Boolean(hwWarrantyConflict), 'TP', 'Detects hardware warranty duration contradiction (5-year vs 2-year)');

  // Check 3: Volume capacity match (500ml == 500ml) should NOT trigger conflict (TN)
  const hwVolumeConflict = hwReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('volume'));
  recordTest(!hwVolumeConflict, 'TN', 'Zero false alarm on matching travel case volume capacity (500ml == 500ml)');
  console.log();

  // =================================================================
  // CATEGORY 5: PROFESSIONAL SERVICES & FINTECH
  // Image: 2-day settlement turnaround, $120 annual fee
  // Caption: Same-day settlement, $120 annual fee, "Zero risk investment guarantee"
  // =================================================================
  console.log('--- Industry 5: Professional Services & FinTech ---');
  const finImgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="#0A0908"/>
    <text x="90" y="200" fill="#EAE0D5" font-size="52" font-family="sans-serif">ApexWealth Merchant Services</text>
    <text x="90" y="320" fill="#C6AC8F" font-size="38" font-family="sans-serif">Fast 2-day turnaround on all payouts</text>
    <text x="90" y="440" fill="#EAE0D5" font-size="42" font-family="sans-serif">Annual membership: $120</text>
  </svg>`;
  const finImgPath = path.join(creativesDir, 'heldout-fintech-apexwealth.svg');
  fs.writeFileSync(finImgPath, finImgContent, 'utf-8');

  const finCaption = `Streamline your business finances with ApexWealth! Enjoy 5-day turnaround on merchant payouts with our $120 annual fee. Guaranteed zero risk for business owners.`;

  const finReview = await runComplianceReview(
    finCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/heldout-fintech-apexwealth.svg',
      captionText: finCaption,
      assets,
    }
  );

  // Check 1: Turnaround duration contradiction (2 days vs 5 days)
  const finTurnaroundConflict = finReview.findings.find(f => f.category === 'cross_modal_conflict' && (f.finding_title.toLowerCase().includes('turnaround') || f.finding_title.toLowerCase().includes('duration') || f.finding_title.toLowerCase().includes('shipping')));
  recordTest(Boolean(finTurnaroundConflict), 'TP', 'Detects service turnaround duration conflict (2-day vs 5-day)');

  // Check 2: Matching price ($120 == $120) should NOT trigger conflict (TN)
  const finPriceConflict = finReview.findings.find(f => f.category === 'cross_modal_conflict' && f.finding_title.toLowerCase().includes('price'));
  recordTest(!finPriceConflict, 'TN', 'Zero false alarm on matching membership fee ($120 == $120)');

  // Check 3: Prohibited "zero risk" guarantee
  const finZeroRisk = finReview.findings.find(f => f.category === 'prohibited_claim' && f.evidence_text?.toLowerCase().includes('zero risk'));
  recordTest(Boolean(finZeroRisk), 'TP', 'Flags prohibited financial guarantee ("zero risk")');
  console.log();

  // =================================================================
  // CATEGORY 6: LOW-TEXT / PHOTOGRAPHIC LIFESTYLE CREATIVE
  // Creative has zero readable typography, caption is provided
  // Must NOT crash, must NOT auto-approve, must flag partial analysis
  // =================================================================
  console.log('--- Industry 6: Photographic Creative With Minimal Typography ---');
  const emptyImgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#9333EA;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#grad)"/>
    <circle cx="540" cy="540" r="280" fill="#FFFFFF" opacity="0.2"/>
  </svg>`;
  const emptyImgPath = path.join(creativesDir, 'heldout-lifestyle-notext.svg');
  fs.writeFileSync(emptyImgPath, emptyImgContent, 'utf-8');

  const lifestyleCaption = `Experience serenity in every moment with our minimalist collection. Simple. Elegant. Effortless.`;

  const lifestyleReview = await runComplianceReview(
    lifestyleCaption,
    'social_media',
    guidelines,
    facts,
    {
      imageUrl: '/uploads/creatives/heldout-lifestyle-notext.svg',
      captionText: lifestyleCaption,
      assets,
    }
  );

  // Check 1: Partial analysis flagged because image text was absent
  recordTest(lifestyleReview.metadata.isPartialAnalysis === true, 'TP', 'Identifies partial analysis on photographic creative with no legible text');

  // Check 2: Governance gate is NOT approved when required image typography checks could not run
  recordTest(lifestyleReview.status !== 'approved', 'TP', 'Blocks automatic approval on incomplete creative analysis (Status: in_review)');

  // Check 3: Zero false positive findings generated on compliant copy
  recordTest(lifestyleReview.findings.length === 0, 'TN', 'Zero false violations generated on clean lifestyle copy');
  console.log();

  // =================================================================
  // PERSISTENCE & AUDIT TRAIL VERIFICATION VIA SUPABASE/DATABASE
  // =================================================================
  console.log('--- Database & Supabase Persistence Audit ---');
  const persistedTech = await createContentReview({
    title: 'CloudNova Enterprise Multimodal Audit',
    caption_text: techCaption,
    content_text: techCaption,
    content_type: 'social_media',
    image_url: '/uploads/creatives/heldout-tech-cloudnova.svg',
  });

  recordTest(Boolean(persistedTech.id), 'TP', `Saved review created with ID (${persistedTech.id})`);
  recordTest(persistedTech.status === 'flagged', 'TP', 'Persisted status reflects FLAGGED governance gate');
  recordTest(persistedTech.compliance_score! <= 50, 'TP', `Persisted compliance score accurately penalized (${persistedTech.compliance_score}%)`);

  const fetchedTech = await getContentReviewById(persistedTech.id);
  recordTest(Boolean(fetchedTech && (fetchedTech.findings?.length || 0) >= 3), 'TP', `Retrieved review retains all findings (Found: ${fetchedTech?.findings?.length})`);
  console.log();

  // =================================================================
  // BENCHMARK SUMMARY & METRICS
  // =================================================================
  const totalChecks = tp + tn + fp + fn;
  const accuracy = Math.round(((tp + tn) / totalChecks) * 100);
  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : 100;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 100) : 100;

  console.log('================================================================');
  console.log('MULTI-INDUSTRY BENCHMARK RESULTS');
  console.log('================================================================');
  console.log(`  True Positives (Correctly Flagged Violations):     ${tp}`);
  console.log(`  True Negatives (Correctly Passed Clean Claims):     ${tn}`);
  console.log(`  False Positives (Spurious Alarms / Noise):         ${fp}`);
  console.log(`  False Negatives (Missed Real Violations):          ${fn}`);
  console.log(`  Accuracy:                                          ${accuracy}%`);
  console.log(`  Precision:                                         ${precision}%`);
  console.log(`  Recall:                                            ${recall}%`);
  console.log('================================================================\n');

  if (fp > 0 || fn > 0) {
    process.exit(1);
  }
}

runMultiIndustryMatrix().catch((err) => {
  console.error('Fatal multi-industry benchmark error:', err);
  process.exit(1);
});
