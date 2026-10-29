import { RuleSeverity } from '@/lib/types';
import { EngineFinding, ScoreBreakdown, ScoreDeduction } from './types';

const SEVERITY_WEIGHTS: Record<RuleSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export interface ScoringContextOptions {
  hasImageInput?: boolean;
  hasCaptionInput?: boolean;
  isPartialAnalysis?: boolean;
  imageInspectionSucceeded?: boolean;
  extractedOcrText?: string;
  checksCompleted?: Record<string, boolean>;
}

export function calculateComplianceScore(
  findings: EngineFinding[],
  context?: ScoringContextOptions
): ScoreBreakdown {
  const baseScore = 100;
  const deductions: ScoreDeduction[] = [];

  const counts: Record<RuleSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const hasImage = Boolean(context?.hasImageInput);
  const imageInspectionSucceeded = context?.imageInspectionSucceeded !== false;
  let isPartialAnalysis = Boolean(context?.isPartialAnalysis);
  let partialReason = '';

  if (!hasImage || !imageInspectionSucceeded || context?.checksCompleted?.imageAnalysis === false) {
    isPartialAnalysis = true;
    partialReason =
      'Analysis is incomplete: The creative image could not be inspected by the image analysis pipeline.';
  } else if (context?.hasImageInput && context?.extractedOcrText === '' && !context?.hasCaptionInput && findings.length === 0) {
    isPartialAnalysis = true;
    partialReason =
      'Analysis is incomplete: No typography or text copy was detected in the creative asset.';
  } else if (context?.hasImageInput && context?.hasCaptionInput && context?.extractedOcrText === '') {
    isPartialAnalysis = true;
    partialReason =
      'Analysis is incomplete: Image typography was not detected; only caption text was evaluated.';
  }

  // Deduplicate overlapping findings (same evidence snippet & same category)
  const processedKeys = new Set<string>();

  for (const finding of findings) {
    const evidenceKey = `${finding.category}:${(finding.evidence_text || finding.finding_title).toLowerCase().trim()}`;

    if (processedKeys.has(evidenceKey)) {
      continue;
    }
    processedKeys.add(evidenceKey);

    const penalty = SEVERITY_WEIGHTS[finding.severity] || 5;
    counts[finding.severity] = (counts[finding.severity] || 0) + 1;

    deductions.push({
      severity: finding.severity,
      points: penalty,
      reason: `${finding.severity.toUpperCase()} finding: ${finding.finding_title}`,
      findingTitle: finding.finding_title,
    });
  }

  const totalDeductions = deductions.reduce((acc, curr) => acc + curr.points, 0);

  let finalScore: number | null;
  if (!imageInspectionSucceeded) {
    finalScore = null;
  } else if (isPartialAnalysis && findings.length === 0 && context?.hasImageInput && context?.extractedOcrText === '' && !context?.hasCaptionInput) {
    finalScore = 0;
  } else if (isPartialAnalysis && context?.checksCompleted?.imageAnalysis === false && findings.length === 0) {
    finalScore = 0;
  } else {
    finalScore = Math.max(0, baseScore - totalDeductions);
  }

  const methodology = isPartialAnalysis
    ? `Documented compliance policy: ${partialReason} Deductions: Critical (-25), High (-15), Medium (-8), Low (-3).`
    : 'Deterministic compliance score begins at 100 baseline points. Documented deductions are assessed per distinct finding: Critical (-25), High (-15), Medium (-8), Low (-3). Findings targeting identical evidence snippets are deduplicated to ensure reproducible evaluation.';

  const disclaimer =
    'Governance compliance score calculated from creative image inspection against active brand guidelines, verified corporate facts, and visual safety standards. This metric is an automated governance aid and does not constitute a legal or regulatory warranty.';

  return {
    baseScore,
    totalDeductions,
    finalScore,
    deductionsBySeverity: counts,
    deductions,
    methodology,
    disclaimer,
    isPartialAnalysis,
  };
}
