import fs from 'fs';
import { runComplianceReview } from '../src/lib/engine';

async function runRegressionSuite() {
  const db = JSON.parse(fs.readFileSync('.data/db.json', 'utf8'));
  const guidelines = db.brand_guidelines || [];
  const facts = db.approved_facts || [];
  const assets = db.authorized_assets || [];

  const testCases: Array<{
    id: string;
    label: string;
    expectedTypos: string[];
    shouldNotBe100?: boolean;
    shouldNotBeApproved?: boolean;
    shouldBe100?: boolean;
    shouldBeApproved?: boolean;
  }> = [
    {
      id: 'd8c8f374-3e25-4c0e-a626-7faa2e542470',
      label: 'Brunch Latte Art Post (Prior False 100%)',
      expectedTypos: ['sych', 'gratefull', 'pooynt', 'brunchiime'],
      shouldNotBe100: true,
      shouldNotBeApproved: true,
    },
    {
      id: '33b5fdf6-e212-4476-9685-413d9f768aea',
      label: 'Crispy Bites Fried Chicken Post (Prior Missed Typos)',
      expectedTypos: ['chiken', 'beleave', 'perfekt', 'freind'],
      shouldNotBe100: true,
      shouldNotBeApproved: true,
    },
    {
      id: '7b395b85-aa2b-4fe1-9f62-064786f82a6c',
      label: 'Cute Lil Cafe Brunch Post (Prior False 100%)',
      expectedTypos: ['cofe', 'purrfect', 'immaculat', 'definatly', 'comming', 'peeple'],
      shouldNotBe100: true,
      shouldNotBeApproved: true,
    },
    {
      id: '2d30fc32-5f15-48ec-adbf-15080da32eb0',
      label: 'Croissant Post with Inappropriate Language',
      expectedTypos: ['cum', 'delicous', 'cofefe', 'bakry', 'breaakfast'],
      shouldNotBe100: true,
      shouldNotBeApproved: true,
    },
    {
      id: 'f933ffa2-f434-42c7-86cd-a266e993d8ac',
      label: 'Digital Work Banner Creative (Overlay, Split Word, Expired Date)',
      expectedTypos: ['Digi tal'],
      shouldNotBe100: true,
      shouldNotBeApproved: true,
    },
  ];

  console.log('================================================================');
  console.log(' BRANDGUARD AI REGRESSION TEST SUITE ');
  console.log('================================================================\n');

  let allPassed = true;

  for (const tc of testCases) {
    const r = db.content_reviews.find((x: any) => x.id === tc.id);
    if (!r) {
      console.log(`[SKIP] Review ${tc.id} not found in database`);
      continue;
    }

    console.log(`--- [TEST] ${tc.label} (${tc.id}) ---`);
    console.log(`Image: ${r.image_url}`);

    const res = await runComplianceReview(r.title, r.content_type, guidelines, facts, {
      imageUrl: r.image_url,
      captionText: r.caption_text,
      assets,
      skipAI: true,
    });

    console.log(`Score: ${res.compliance_score} | Status: ${res.status} | Governance: ${res.metadata.governance_status}`);
    console.log(`Findings count: ${res.findings.length}`);

    const foundEvidences = res.findings.map(f => (f.evidence_text || f.finding_title).toLowerCase());
    
    // Check expected issues
    const detectedExpected: string[] = [];
    const missedExpected: string[] = [];

    for (const exp of tc.expectedTypos) {
      if (foundEvidences.some(ev => ev.includes(exp.toLowerCase()))) {
        detectedExpected.push(exp);
      } else {
        missedExpected.push(exp);
      }
    }

    console.log(`Detected expected issues: [${detectedExpected.join(', ')}]`);
    if (missedExpected.length > 0) {
      console.log(`MISSED expected issues: [${missedExpected.join(', ')}]`);
    }

    // Print all findings
    res.findings.forEach(f => {
      console.log(`  - [${f.severity}] ${f.category}: "${f.finding_title}" (evidence: "${f.evidence_text}")`);
    });

    let tcPassed = true;
    if (tc.shouldNotBe100 && res.compliance_score === 100) {
      console.error(`FAIL: Got false 100% score!`);
      tcPassed = false;
    }
    if (tc.shouldNotBeApproved && res.status === 'approved') {
      console.error(`FAIL: Got false approved status!`);
      tcPassed = false;
    }
    if (tc.shouldBe100 && res.compliance_score !== 100) {
      console.error(`FAIL: Clean creative did not receive 100% score (Got: ${res.compliance_score})`);
      tcPassed = false;
    }
    if (tc.shouldBeApproved && res.status !== 'approved') {
      console.error(`FAIL: Clean creative did not receive approved status (Got: ${res.status})`);
      tcPassed = false;
    }

    if (tcPassed) {
      console.log(`RESULT: PASS ✓\n`);
    } else {
      console.log(`RESULT: FAIL ✗\n`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    process.exit(1);
  }
  console.log('ALL REGRESSION TESTS PASSED CLEANLY!');
}

runRegressionSuite().catch(err => {
  console.error('Regression suite failed:', err);
  process.exit(1);
});

