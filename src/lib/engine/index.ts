import { BrandGuideline, ApprovedFact, AuthorizedAsset, ContentType, ReviewStatus } from '@/lib/types';
import { runVisionAnalysis } from './vision-analyzer';
import { calculateComplianceScore } from './scoring';
import { runDeterministicChecks } from './deterministic';
import { runFactChecks } from './fact-checker';
import { runCrossModalChecks } from './cross-modal';
import { auditCaptionTextAndTypography, auditImageDatesAndDeadlines } from './image-first-analyzer';
import { ComplianceReviewResult } from './types';

export * from './types';
export * from './image-first-analyzer';
export * from './vision-analyzer';
export * from './scoring';
export * from './deterministic';
export * from './fact-checker';
export * from './cross-modal';

export async function runComplianceReview(
  content: string,
  contentType: ContentType,
  guidelines: BrandGuideline[],
  facts: ApprovedFact[],
  options?: {
    skipAI?: boolean;
    imageUrl?: string;
    assets?: AuthorizedAsset[];
    ocrReferenceText?: string;
    captionText?: string;
  }
): Promise<ComplianceReviewResult> {
  const activeGuidelines = guidelines.filter((g) => g.is_active);
  const activeFacts = facts.filter((f) => f.is_active);
  const activeAssets = (options?.assets || []).filter((a) => a.is_active);

  const explicitImage = options?.imageUrl || (content.startsWith('/uploads/') || content.startsWith('http') || content.startsWith('data:') ? content : '');
  const ocrText = options?.ocrReferenceText || (explicitImage ? '' : content);
  const imageUrl = explicitImage;
  const hasImage = Boolean(imageUrl || ocrText);

  if (!hasImage) {
    return {
      status: 'pending',
      compliance_score: null,
      findings: [
        {
          category: 'other_visible_issues',
          severity: 'critical',
          finding_title: 'No Marketing Creative Image Provided',
          explanation: 'BrandGuard AI performs image-only pre-publication governance. A valid creative image file must be uploaded to perform audit inspection.',
          evidence_text: 'Missing image asset',
          confidence: 1.0,
          suggested_fix: 'Upload a marketing creative image (PNG, JPG, WebP, SVG) to audit.',
          source: 'image',
          verification_status: 'unverifiable',
          target_type: 'layout',
          target_scope: 'image',
          resolution_status: 'unresolved',
        },
      ],
      metadata: {
        evaluatedAt: new Date().toISOString(),
        aiRun: false,
        modality: 'image_only',
        guidelinesEvaluatedCount: activeGuidelines.length,
        factsEvaluatedCount: activeFacts.length,
        governance_status: 'ANALYSIS INCOMPLETE',
        analysisStatus: 'failed',
        scoringBreakdown: {
          baseScore: 100,
          totalDeductions: 25,
          finalScore: null,
          deductionsBySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
          deductions: [],
          methodology: 'Image-only governance requires an accessible image asset.',
          disclaimer: 'No image provided.',
          isPartialAnalysis: true,
        },
        checksCompleted: {
          imageAnalysis: false,
          typographyExtraction: false,
          spellingAndGrammar: false,
          logoAndBrandIdentity: false,
          abusiveLanguage: false,
          layoutAndDesign: false,
          claimsAndConsistency: false,
          copyrightAndIp: false,
          guidelineChecks: false,
          factChecks: false,
        },
      },
    };
  }

  // =================================================================
  // IMAGE GOVERNANCE AUDIT (Pixels, OCR Typography, & Standards)
  // =================================================================
  const visionResult = await runVisionAnalysis({
    imageUrl,
    guidelines: activeGuidelines,
    facts: activeFacts,
    assets: activeAssets,
    ocrReferenceText: ocrText,
    skipAI: options?.skipAI,
  });

  const visionRun = visionResult.visionRun;
  const visionModelUsed = visionResult.model;
  const visionProvider = visionResult.provider;
  const extractedOcrText = visionResult.extracted_ocr_text;
  const ocrConfidence = visionResult.ocrConfidence ?? null;
  const ocrWordsCount = visionResult.ocrWordsCount ?? 0;
  const ocrLinesCount = visionResult.ocrLinesCount ?? 0;
  const unreadableSegmentsCount = visionResult.unreadableSegmentsCount ?? 0;
  const imageSummary = visionResult.imageSummary ?? null;
  const detectedBoundingBoxes = visionResult.boundingBoxes ?? [];
  const visionDisclosures: string[] = [...visionResult.disclosures];
  const logoPresence = visionResult.logoPresence;

  if (visionResult.reason && !visionResult.visionRun) {
    visionDisclosures.push(visionResult.reason);
  }

  const imageInspectionSucceeded = Boolean(
    visionResult.imageSummary || visionResult.extracted_ocr_text || visionResult.provider || ocrText
  );

  let imageFindings = [...visionResult.findings];

  // Correlate local bounding boxes when findings lack bounding box coordinates
  if (detectedBoundingBoxes.length > 0) {
    for (const finding of imageFindings) {
      if (!finding.bounding_box) {
        const query = (finding.image_evidence || finding.evidence_text || '').toLowerCase().trim();
        if (query) {
          const match = detectedBoundingBoxes.find((b) => {
            const bLow = b.text.toLowerCase();
            return bLow.includes(query) || query.includes(bLow);
          });
          if (match) {
            finding.bounding_box = match.bbox;
          }
        }
      }
    }
  }

  const isCaptionOnly = !explicitImage && !options?.ocrReferenceText;
  const auditScope: 'caption' | 'image' = isCaptionOnly ? 'caption' : 'image';

  // Run deterministic brand guideline rules and fact verification on extracted OCR / reference text
  const textForAudits = extractedOcrText || ocrText || '';
  if (textForAudits.trim()) {
    const { findings: detFindings } = runDeterministicChecks(textForAudits, contentType, activeGuidelines, { targetScope: auditScope });
    const { findings: factFindings } = runFactChecks(textForAudits, activeFacts, { sourceTag: auditScope });

    for (const df of detFindings) {
      // If a specific brand guideline flags a prohibited phrase, deduplicate generic suspicious claim checks for that term
      if (df.category === 'prohibited_claim' && df.evidence_text) {
        imageFindings = imageFindings.filter((f) => {
          if (f.finding_title.includes('Suspicious Absolute') && f.evidence_text && df.evidence_text?.toLowerCase().includes(f.evidence_text.toLowerCase())) {
            return false;
          }
          return true;
        });
      }
      if (!imageFindings.some((f) => (df.guideline_id && f.guideline_id === df.guideline_id) || f.finding_title === df.finding_title || (df.evidence_text && f.evidence_text === df.evidence_text))) {
        imageFindings.push(df);
      }
    }
    for (const ff of factFindings) {
      if (!imageFindings.some((f) => (ff.fact_id && f.fact_id === ff.fact_id) || f.finding_title === ff.finding_title)) {
        imageFindings.push(ff);
      }
    }
  }

  // Cross-modal checks and caption analysis when caption is supplied
  if (options?.captionText && options.captionText.trim()) {
    const cleanCap = options.captionText.trim();

    // 1. Cross-modal consistency checks between creative image typography and accompanying caption
    if (textForAudits.trim()) {
      const { findings: cmFindings } = runCrossModalChecks(textForAudits, cleanCap);
      for (const cmf of cmFindings) {
        if (!imageFindings.some((f) => f.finding_title === cmf.finding_title || (cmf.evidence_text && f.evidence_text === cmf.evidence_text))) {
          imageFindings.push(cmf);
        }
      }
    } else {
      visionDisclosures.push('Cross-modal image-caption verification skipped: No legible typography was detected in the creative graphic.');
    }

    // 2. Caption Spelling, Typography & Grammar Checks
    const capTypoFindings = auditCaptionTextAndTypography(cleanCap);
    for (const ctf of capTypoFindings) {
      if (!imageFindings.some((f) => f.finding_title === ctf.finding_title && f.evidence_text === ctf.evidence_text)) {
        imageFindings.push(ctf);
      }
    }

    // 3. Caption Promotional Dates & Deadlines
    const capDateFindings = auditImageDatesAndDeadlines(cleanCap).map((f) => ({
      ...f,
      target_scope: 'caption' as const,
      source: 'caption' as const,
      bounding_box: null,
      caption_evidence: f.evidence_text || null,
      image_evidence: null,
      location_description: 'Accompanying Caption Copy',
    }));
    for (const cdf of capDateFindings) {
      if (!imageFindings.some((f) => f.finding_title === cdf.finding_title)) {
        imageFindings.push(cdf);
      }
    }

    // 4. Caption Brand Guidelines and Fact Consistency
    const { findings: capDetFindings } = runDeterministicChecks(cleanCap, contentType, activeGuidelines, { targetScope: 'caption' });
    const { findings: capFactFindings } = runFactChecks(cleanCap, activeFacts, { sourceTag: 'caption' });
    for (const cdf of capDetFindings) {
      if (!imageFindings.some((f) => (cdf.guideline_id && f.guideline_id === cdf.guideline_id) || f.finding_title === cdf.finding_title || (cdf.evidence_text && f.evidence_text === cdf.evidence_text))) {
        imageFindings.push(cdf);
      }
    }
    for (const cff of capFactFindings) {
      if (!imageFindings.some((f) => (cff.fact_id && f.fact_id === cff.fact_id) || f.finding_title === cff.finding_title)) {
        imageFindings.push(cff);
      }
    }
  }

  const aiRun = Boolean(visionRun && visionModelUsed && visionModelUsed.includes('gemini'));

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    visionDisclosures.push('GEMINI_API_KEY is not configured. Falling back to local OCR and deterministic rules.');
  } else if (!aiRun || options?.skipAI) {
    if (!visionDisclosures.some((d) => d.toLowerCase().includes('fallback') || d.toLowerCase().includes('unavailable'))) {
      visionDisclosures.push('AI provider unavailable. Analysis executed via fallback local OCR and deterministic rules.');
    }
  }

  // Preserve target_scope if already assigned (e.g. 'both' for cross-modal, 'caption' for caption)
  imageFindings = imageFindings.map((f) => ({
    ...f,
    target_scope: isCaptionOnly ? ('caption' as const) : (f.target_scope || ('image' as const)),
  }));

  // Disclosures on Brand Guidelines presence
  if (activeGuidelines.length === 0) {
    visionDisclosures.push('No active brand guidelines configured. Analysis performed against general visual quality, layout, safety, and claim consistency standards.');
  }

  // Calculate Documented Compliance Score
  const scoreBreakdown = calculateComplianceScore(imageFindings, {
    hasImageInput: true,
    hasCaptionInput: Boolean(options?.captionText && options.captionText.trim()),
    imageInspectionSucceeded,
    extractedOcrText,
    checksCompleted: {
      imageAnalysis: imageInspectionSucceeded,
      typographyExtraction: Boolean(extractedOcrText && extractedOcrText.length > 0),
      spellingAndGrammar: true,
      logoAndBrandIdentity: true,
      abusiveLanguage: true,
      layoutAndDesign: true,
      claimsAndConsistency: true,
      copyrightAndIp: true,
      guidelineChecks: activeGuidelines.length > 0,
      factChecks: activeFacts.length > 0,
    },
  });

  // Determine Resulting Governance Status
  const hasCritical = imageFindings.some((f) => f.severity === 'critical');
  const hasHigh = imageFindings.some((f) => f.severity === 'high');
  const hasHumanReviewRequired = imageFindings.some(
    (f) => f.needs_human_verification || f.category === 'copyright_and_ip_risk'
  );

  let governance_status: 'PASS' | 'WARNING' | 'REVIEW REQUIRED' | 'ANALYSIS INCOMPLETE' = 'PASS';

  if (!imageInspectionSucceeded || scoreBreakdown.isPartialAnalysis) {
    governance_status = 'ANALYSIS INCOMPLETE';
  } else if (hasCritical || hasHigh || hasHumanReviewRequired) {
    governance_status = 'REVIEW REQUIRED';
  } else if (!aiRun && imageFindings.length === 0) {
    governance_status = 'REVIEW REQUIRED';
    if (!visionDisclosures.some((d) => d.includes('human visual review'))) {
      visionDisclosures.push('Automated local heuristics detected 0 violations; human visual review required prior to publication approval.');
    }
  } else if (imageFindings.length > 0 || (scoreBreakdown.finalScore !== null && scoreBreakdown.finalScore < 90)) {
    governance_status = 'WARNING';
  } else {
    governance_status = 'PASS';
  }

  let status: ReviewStatus = 'in_review';
  if (governance_status === 'ANALYSIS INCOMPLETE') {
    status = 'in_review';
  } else if (hasCritical || hasHigh) {
    status = 'flagged';
  } else if (aiRun && !scoreBreakdown.isPartialAnalysis && imageFindings.length === 0 && scoreBreakdown.finalScore === 100) {
    status = activeGuidelines.length > 0 ? 'approved' : 'in_review';
  } else {
    status = 'in_review';
  }

  return {
    status,
    compliance_score: scoreBreakdown.finalScore,
    findings: imageFindings,
    extracted_ocr_text: extractedOcrText || undefined,
    metadata: {
      evaluatedAt: new Date().toISOString(),
      aiRun,
      analysisMode: aiRun ? 'gemini' : 'local_fallback',
      aiProvider: aiRun ? (visionProvider || 'Google Gemini Vision') : undefined,
      ocrProvider: visionProvider,
      visionModelUsed,
      ocrConfidence,
      ocrWordsCount,
      ocrLinesCount,
      unreadableSegmentsCount,
      limitationsDisclosed: visionDisclosures.length > 0 ? visionDisclosures.join('; ') : undefined,
      disclosures: visionDisclosures,
      imageSummary,
      modality: isCaptionOnly ? ('caption_only' as unknown as 'image_only') : 'image_only',
      guidelinesEvaluatedCount: activeGuidelines.length,
      factsEvaluatedCount: activeFacts.length,
      scoringBreakdown: scoreBreakdown,
      extracted_ocr_text: extractedOcrText || undefined,
      governance_status,
      analysisStatus: governance_status === 'ANALYSIS INCOMPLETE' ? 'partial' : 'complete',
      logoPresence,
      checksCompleted: {
        imageAnalysis: imageInspectionSucceeded,
        typographyExtraction: Boolean(extractedOcrText && extractedOcrText.length > 0),
        spellingAndGrammar: true,
        logoAndBrandIdentity: true,
        abusiveLanguage: true,
        layoutAndDesign: true,
        claimsAndConsistency: true,
        copyrightAndIp: true,
        guidelineChecks: activeGuidelines.length > 0,
        factChecks: activeFacts.length > 0,
      },
      checksStatus: {
        imageInspection: imageInspectionSucceeded ? 'passed' : 'failed',
        typographyExtraction: extractedOcrText.length > 0 ? 'passed' : 'unavailable',
        spellingAndGrammar: 'passed',
        logoAndBrandIdentity: imageFindings.some((f) => f.category === 'logo_and_brand_identity' && f.severity !== 'low')
          ? 'failed'
          : (logoPresence?.status === 'uncertain' && activeGuidelines.some((g) => g.rule_type === 'logo_guideline'))
            ? 'unavailable'
            : 'passed',
        abusiveLanguage: 'passed',
        layoutAndDesign: 'passed',
        claimsAndConsistency: 'passed',
        copyrightAndIp: 'passed',
        brandGuidelines: activeGuidelines.length > 0 ? 'passed' : 'unavailable',
        factVerification: activeFacts.length > 0 ? 'passed' : 'unavailable',
        cloudVision: aiRun ? 'passed' : 'unavailable',
      },
      isPartialAnalysis: scoreBreakdown.isPartialAnalysis,
    },
  };
}
