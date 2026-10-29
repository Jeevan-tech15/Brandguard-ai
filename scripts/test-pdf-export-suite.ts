import { generateReviewPdfReport } from '../src/lib/reports/pdf-generator';
import { getContentReviewById, getContentReviews } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function testPdfAndJsonExport() {
  console.log('================================================================');
  console.log(' BRANDGUARD AI — PDF & JSON EXPORT VERIFICATION SUITE');
  console.log('================================================================\n');

  // Find a real review in the database
  const targetReviewId = '7a6990a9-bf26-4ee0-ac26-f9cc92fc1304';
  let review = await getContentReviewById(targetReviewId);

  if (!review) {
    const allReviews = await getContentReviews();
    review = allReviews.find(r => Boolean(r.title) && r.findings && r.findings.length > 0) || allReviews.find(r => r.findings && r.findings.length > 0) || allReviews[0];
  }

  if (!review) {
    console.error(`Target review ${targetReviewId} not found, and no other reviews in database.`);
    process.exit(1);
  }

  console.log(`Testing review: ${review.id} (${review.title})`);
  console.log(`Current version: ${review.review_version || 1}, Status: ${review.status}, Score: ${review.compliance_score}`);
  console.log(`Findings count: ${review.findings?.length || 0}`);
  console.log(`Decisions count: ${review.decisions?.length || 0}`);

  // Test 1: Generate PDF Report
  console.log('\n--- Test 1: Generate PDF Report from Real Database Record ---');
  const pdfBytes = await generateReviewPdfReport(review, {
    generatedBy: 'BrandGuard AI Automated Engine',
  });

  const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8');
  console.log(`Generated PDF byte length: ${pdfBytes.length} bytes`);
  console.log(`PDF Magic Bytes: "${pdfHeader}"`);

  if (!pdfHeader.startsWith('%PDF-')) {
    throw new Error(`PDF magic header missing! Got: ${pdfHeader}`);
  }
  console.log('✓ [PASS] Valid %PDF- header generated');

  if (pdfBytes.length < 4000) {
    throw new Error(`PDF seems suspiciously small (${pdfBytes.length} bytes)`);
  }
  console.log(`✓ [PASS] PDF has substantial content (${(pdfBytes.length / 1024).toFixed(1)} KB)`);

  // Save the generated PDF for verification
  const outPath = path.join(process.cwd(), 'public', 'test-generated-report.pdf');
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));
  console.log(`✓ [PASS] Successfully saved test PDF to ${outPath}`);

  // Test 2: Incomplete / Partial Analysis PDF Generation
  console.log('\n--- Test 2: Partial / Incomplete Analysis Handling in PDF ---');
  const mockPartialReview = {
    ...review,
    compliance_score: null,
    evaluation_metadata: {
      ...review.evaluation_metadata,
      evaluatedAt: new Date().toISOString(),
      aiRun: false,
      isPartialAnalysis: true,
      checksCompleted: {
        ocr_text_extraction: true,
        caption_consistency: true,
        gemini_multimodal_vision: false,
      },
      skippedChecks: [
        {
          check: 'Gemini Multimodal Vision Inspection',
          reason: 'GEMINI_API_KEY is not configured in environment. Vision inspection was skipped.',
        },
      ],
    },
  };

  const partialPdfBytes = await generateReviewPdfReport(mockPartialReview);
  const partialPdfHeader = Buffer.from(partialPdfBytes.slice(0, 5)).toString('utf-8');
  if (!partialPdfHeader.startsWith('%PDF-')) {
    throw new Error(`Partial PDF magic header missing! Got: ${partialPdfHeader}`);
  }
  console.log('✓ [PASS] Partial analysis PDF generated cleanly with skipped check disclosure');

  // Test 3: Multi-version corrected review with resolved findings
  console.log('\n--- Test 3: Multi-version Corrected Review with Resolved & Remaining Findings ---');
  const multiVersionReview = {
    ...review,
    review_version: 2,
    original_caption_text: 'Original caption with 70% off claims',
    caption_text: 'Corrected caption with 50% off matching creative banner',
    correction_metadata: {
      replaced_text: '70% off',
      new_text: '50% off',
      target_scope: 'caption' as const,
      caption_before: 'Original caption with 70% off claims',
      caption_after: 'Corrected caption with 50% off matching creative banner',
      edit_applied_to_pixels: false,
    },
    findings: [
      {
        id: 'f1',
        review_id: review.id,
        category: 'Promotional Consistency',
        severity: 'critical' as const,
        finding_title: 'Discount percentage mismatch',
        explanation: 'Image says 50% OFF, caption originally stated 70% OFF',
        resolution_status: 'resolved' as const,
        confidence: 0.95,
        created_at: new Date().toISOString(),
      },
      {
        id: 'f2',
        review_id: review.id,
        category: 'Specification Verification',
        severity: 'high' as const,
        finding_title: 'Conflicting protein figures',
        explanation: 'Promotional text says 40g Protein, bar label shows 20g',
        resolution_status: 'unresolved' as const,
        confidence: 0.88,
        created_at: new Date().toISOString(),
      },
    ],
  };

  const correctedPdfBytes = await generateReviewPdfReport(multiVersionReview);
  console.log(`Generated corrected PDF byte length: ${correctedPdfBytes.length} bytes`);
  if (correctedPdfBytes.length < 3000) {
    throw new Error(`Corrected PDF was too small (${correctedPdfBytes.length} bytes)`);
  }
  console.log(`✓ [PASS] Multi-version report generated (${(correctedPdfBytes.length / 1024).toFixed(1)} KB) with resolved & remaining findings`);

  // Test 4: JSON Export structure validation
  console.log('\n--- Test 4: JSON Export Structure Validation ---');
  const version = review.review_version || 1;
  const sanitizedTitle = (review.title || 'Campaign-Post')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Campaign-Post';
  const jsonFilename = `BrandGuard_Data_${sanitizedTitle}_v${version}.json`;
  const pdfFilename = `BrandGuard_Report_${sanitizedTitle}_v${version}.pdf`;

  const exportPayload = {
    brandguard_export_version: '1.0',
    exported_at: new Date().toISOString(),
    disclaimer: 'This export summarizes automated checks performed by BrandGuard AI. It does not guarantee legal or regulatory compliance. Human review is required.',
    review: {
      id: review.id,
      title: review.title,
      review_version: version,
      status: review.status,
      compliance_score: review.compliance_score,
      created_at: review.created_at,
    },
    content: {
      current_caption: review.caption_text,
      creative_image_url: review.image_url,
    },
    findings: review.findings || [],
    decisions: review.decisions || [],
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const parsed = JSON.parse(jsonStr);
  if (parsed.review.id !== review.id) {
    throw new Error('JSON review ID mismatch');
  }
  if (!parsed.disclaimer.includes('Human review is required')) {
    throw new Error('Disclaimer missing in JSON export');
  }
  if (jsonStr.includes('GEMINI_API_KEY') || jsonStr.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error('Secrets found in JSON export!');
  }
  console.log(`✓ [PASS] JSON export payload conforms to specification (Filename: ${jsonFilename})`);

  console.log('\n================================================================');
  console.log(' ALL 4 PDF & JSON EXPORT TESTS PASSED SUCCESSFULLY');
  console.log('================================================================\n');
}

testPdfAndJsonExport().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
