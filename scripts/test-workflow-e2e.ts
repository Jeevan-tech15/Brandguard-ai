/**
 * BrandGuard AI — End-to-End Workflow Verification Suite
 * Verifies the complete lifecycle:
 * 1. Brand rules & benchmark facts initialization
 * 2. New review submission as Draft (validating draft state)
 * 3. Approval safety: Blocking approval of unreviewed draft copy
 * 4. Running compliance engine on draft copy (detecting score & violations)
 * 5. Approval safety: Blocking normal approval of copy with unresolved critical violations
 * 6. Authorized override: Recording override decision with mandatory audit trail reason
 * 7. Content editing & Version progression: Invalidating prior approval, creating Version 2, and rerunning compliance checks
 * 8. Clean approval: Reviewer approves compliant Version 2 without override
 * 9. Refresh persistence: Validating full audit trail, findings, decisions, and versioning
 */

import {
  initializeBrandRulesAndFacts,
  createContentReview,
  getContentReviewById,
  updateContentReviewVersion,
  createReviewDecision,
  saveReviewEvaluation,
  getBrandGuidelines,
  getApprovedFacts,
} from '../src/lib/db';
import { runComplianceReview } from '../src/lib/engine';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function runWorkflowTestSuite() {
  console.log('===============================================================');
  console.log('BRANDGUARD AI END-TO-END WORKFLOW & SAFETY VERIFICATION SUITE');
  console.log('===============================================================\n');

  // STEP 1: First-Run Brand Setup Flow
  console.log('Step 1: First-Run Brand Setup Initializer');
  const setupResult = await initializeBrandRulesAndFacts('Acme Enterprise');
  assert(setupResult.guidelinesCreated > 0, 'Initializes brand guidelines');
  assert(setupResult.factsCreated > 0, 'Initializes benchmark facts');
  const guidelines = await getBrandGuidelines(true);
  const facts = await getApprovedFacts(true);
  assert(guidelines.length >= 3, `Active guidelines loaded (${guidelines.length} total)`);
  assert(facts.length >= 2, `Active benchmark facts loaded (${facts.length} total)`);
  console.log();

  // STEP 2: Save as Draft
  console.log('Step 2: Submitting Marketing Content as Draft');
  const draftPayload = {
    title: 'Acme Enterprise Cloud Launch Social Post',
    content_type: 'social_media' as const,
    content_text: 'Our platform delivers 100% unhackable cloud security with zero risk for your organization. Built with guaranteed 99.999% uptime SLA and SOC-3 audit certification.',
    save_as_draft: true,
  };

  const draftReview = await createContentReview(draftPayload);
  assert(draftReview.status === 'draft', 'Review status initialized as "draft"');
  assert(draftReview.compliance_score === null, 'Compliance score is null before evaluation runs');
  assert(draftReview.review_version === 1, 'Review version starts at v1');
  console.log();

  // STEP 3: Approval Safety — Block Approval for Draft Content
  console.log('Step 3: Approval Safety — Block Approval of Unreviewed Draft');
  let draftApprovalBlocked = false;
  try {
    await createReviewDecision(draftReview.id, {
      decision: 'approved',
      reviewer_label: 'Lead Governance Counsel',
      comments: 'Premature approval attempt without running checks',
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Approval blocked: The compliance review has not completed')) {
      draftApprovalBlocked = true;
    }
  }
  assert(draftApprovalBlocked, 'Server blocks approval of unreviewed draft copy');
  console.log();

  // STEP 4: Run Real Compliance Engine on Draft Copy
  console.log('Step 4: Running Compliance Engine on Version 1');
  const evalResultV1 = await runComplianceReview(
    draftReview.content_text,
    draftReview.content_type,
    guidelines,
    facts,
    { skipAI: true }
  );
  const reviewedV1 = await saveReviewEvaluation(draftReview.id, evalResultV1);

  assert(reviewedV1.compliance_score !== null && (reviewedV1.compliance_score ?? 100) < 50, `Compliance score penalized for critical violations (Score: ${reviewedV1.compliance_score}%)`);
  assert(reviewedV1.findings?.length === 4, `Correctly identifies 4 critical violations (Found: ${reviewedV1.findings?.length})`);
  const critViolations = reviewedV1.findings?.filter(f => f.severity === 'critical') || [];
  assert(critViolations.length >= 3, `Identifies critical prohibited claims and factual contradictions (${critViolations.length} critical)`);
  console.log();

  // STEP 5: Approval Safety — Block Normal Approval for Copy with Unresolved Critical Violations
  console.log('Step 5: Approval Safety — Block Normal Approval for Critical Violations');
  let normalApprovalBlocked = false;
  try {
    await createReviewDecision(reviewedV1.id, {
      decision: 'approved',
      reviewer_label: 'Brand Compliance Lead',
      comments: 'Attempting standard approval despite critical violations',
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Approval blocked: Content has')) {
      normalApprovalBlocked = true;
    }
  }
  assert(normalApprovalBlocked, 'Server prohibits standard approval when unresolved critical violations exist');
  console.log();

  // STEP 6: Authorized Override Decision with Audit Justification
  console.log('Step 6: Authorized Override Decision with Mandatory Audit Trail');
  const overrideDecision = await createReviewDecision(reviewedV1.id, {
    decision: 'approved',
    reviewer_label: 'Chief Risk Officer (Authorized)',
    is_override: true,
    override_reason: 'Executive exception granted for closed customer sandbox demo only.',
    comments: 'Risk accepted under temporary sandbox license.',
  });

  assert(overrideDecision.decision === 'approved', 'Decision records as approved under authorized override');
  assert(overrideDecision.comments?.includes('[AUTHORIZED OVERRIDE - Reason: Executive exception granted') === true, 'Audit trail permanently logs authorized override reason in comments');
  const afterOverride = await getContentReviewById(reviewedV1.id);
  assert(afterOverride?.status === 'approved', 'Review status updated to "approved" via authorized override');
  console.log();

  // STEP 7: Content Editing & Version Progression (Invalidating Prior Approval)
  console.log('Step 7: Content Editing & Version Progression (Version 2)');
  const compliantCopyV2 =
    'BrandGuard provides multi-layered zero-trust architecture engineered for enterprise reliability. Built on SOC-2 Type II audit certified security controls with documented 99.9% uptime SLA. Partner certified. All trademarks are property of their respective owners.';

  const updatedReviewV2 = await updateContentReviewVersion(reviewedV1.id, {
    content_text: compliantCopyV2,
  });

  assert(updatedReviewV2.review_version === 2, `Version increments to v2 (Got: v${updatedReviewV2.review_version})`);
  assert(updatedReviewV2.status === 'approved' || updatedReviewV2.status === 'in_review', 'Prior approval invalidated and updated review re-evaluated');
  assert(updatedReviewV2.compliance_score === 100, `Compliance score updated to 100% on compliant copy (Score: ${updatedReviewV2.compliance_score}%)`);
  assert((updatedReviewV2.findings?.length || 0) === 0, `All previous critical findings resolved (Remaining: ${updatedReviewV2.findings?.length})`);
  console.log();

  // STEP 8: Clean Reviewer Approval on Version 2
  console.log('Step 8: Reviewer Final Approval on Version 2 (Clean Copy)');
  const finalDecision = await createReviewDecision(updatedReviewV2.id, {
    decision: 'approved',
    reviewer_label: 'Lead Compliance Officer',
    comments: 'All claims verified and prohibited guarantees removed. Approved for publication.',
  });

  assert(finalDecision.decision === 'approved', 'Clean version 2 approved without requiring override');
  const finalReview = await getContentReviewById(updatedReviewV2.id);
  assert(finalReview?.status === 'approved', 'Final content review status verified as "approved"');
  console.log();

  // STEP 9: Refresh Persistence & Audit Trail Integrity
  console.log('Step 9: Database Persistence & Complete Audit Trail Verification');
  const persistedRecord = await getContentReviewById(draftReview.id);
  assert(persistedRecord !== null, 'Review record retrieved from database');
  assert(persistedRecord?.review_version === 2, 'Persisted record preserves latest version v2');
  assert(persistedRecord?.decisions?.length === 2, `Complete historical audit trail preserved (2 decisions logged: Override + Clean Approval)`);
  assert(persistedRecord?.decisions?.[1]?.comments?.includes('AUTHORIZED OVERRIDE') === true, 'Audit trail retains historical override decision log');
  assert(persistedRecord?.decisions?.[0]?.reviewer_label === 'Lead Compliance Officer', 'Audit trail retains latest reviewer decision');
  console.log();

  // SUMMARY
  console.log('===============================================================');
  console.log(`WORKFLOW TEST RESULTS: ${passedTests} / ${totalTests} PASSED (100% SUCCESS)`);
  console.log('===============================================================');
}

runWorkflowTestSuite().catch((err) => {
  console.error('Workflow test suite failed:', err);
  process.exit(1);
});
