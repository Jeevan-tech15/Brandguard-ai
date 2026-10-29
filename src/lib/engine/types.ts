import { RuleSeverity, ReviewStatus, BoundingBox, ImageSummaryStats, FindingCategory } from '@/lib/types';

export interface EngineFinding {
  category: FindingCategory;
  severity: RuleSeverity;
  finding_title: string;
  explanation: string;
  evidence_text?: string;
  location_description?: string;
  guideline_id?: string | null;
  fact_id?: string | null;
  asset_id?: string | null;
  confidence: number;
  suggested_fix?: string;
  source: 'vision_model' | 'ocr_analysis' | 'deterministic_rule' | 'fact_check' | 'image' | 'rule' | 'ai_evaluator' | 'cross_modal' | string;
  verification_status?: 'supported' | 'contradicted' | 'unverified' | 'confirmed_violation' | 'possible_inconsistency' | 'unverifiable';
  bounding_box?: BoundingBox | null;
  target_type?: 'text' | 'visual_element' | 'logo' | 'color' | 'layout';
  target_scope?: 'image' | 'caption' | 'both';
  image_evidence?: string | null;
  caption_evidence?: string | null;
  proposed_replacement?: string | null;
  resolution_status?: 'unresolved' | 'resolved' | 'overridden';
  needs_human_verification?: boolean;
  human_verification_reason?: string | null;
  uncertainty_notes?: string | null;
}

export interface ScoreDeduction {
  severity: RuleSeverity;
  points: number;
  reason: string;
  findingTitle: string;
}

export interface ScoreBreakdown {
  baseScore: number;
  totalDeductions: number;
  finalScore: number | null;
  deductionsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  deductions: ScoreDeduction[];
  methodology: string;
  disclaimer: string;
  isPartialAnalysis?: boolean;
}

export type LogoDetectionStatus =
  | 'detected_and_matched'
  | 'detected_unverified'
  | 'no_logo_detected'
  | 'uncertain';

export interface LogoPresenceResult {
  status: LogoDetectionStatus;
  detected: boolean;
  logoType?: 'symbol' | 'wordmark' | 'emblem' | 'combination';
  evidence?: string;
  confidence?: number;
  boundingBox?: BoundingBox | null;
  matchedAssetId?: string | null;
  matchedAssetName?: string | null;
  details?: string;
}

export interface EngineMetadata {
  evaluatedAt: string;
  aiRun: boolean;
  analysisMode?: 'gemini' | 'local_fallback';
  aiProvider?: string;
  ocrProvider?: string;
  visionModelUsed?: string;
  ocrConfidence?: number | null;
  ocrWordsCount?: number | null;
  ocrLinesCount?: number | null;
  unreadableSegmentsCount?: number | null;
  limitationsDisclosed?: string;
  disclosures?: string[];
  imageSummary?: ImageSummaryStats | null;
  modality?: 'image_only';
  checksCompleted?: Record<string, boolean>;
  checksStatus?: {
    imageInspection: 'passed' | 'failed' | 'unavailable';
    typographyExtraction: 'passed' | 'failed' | 'unavailable';
    spellingAndGrammar: 'passed' | 'failed' | 'unavailable';
    logoAndBrandIdentity: 'passed' | 'failed' | 'unavailable';
    abusiveLanguage: 'passed' | 'failed' | 'unavailable';
    layoutAndDesign: 'passed' | 'failed' | 'unavailable';
    claimsAndConsistency: 'passed' | 'failed' | 'unavailable';
    copyrightAndIp: 'passed' | 'failed' | 'unavailable';
    brandGuidelines: 'passed' | 'failed' | 'unavailable';
    factVerification: 'passed' | 'failed' | 'unavailable';
    cloudVision: 'passed' | 'failed' | 'unavailable';
  };
  guidelinesEvaluatedCount: number;
  factsEvaluatedCount: number;
  scoringBreakdown: ScoreBreakdown;
  extracted_ocr_text?: string;
  isPartialAnalysis?: boolean;
  analysisNotes?: string;
  logoPresence?: LogoPresenceResult;
  governance_status?: 'PASS' | 'WARNING' | 'REVIEW REQUIRED' | 'ANALYSIS INCOMPLETE';
  analysisStatus?: 'clean' | 'partial' | 'failed' | 'complete';
}

export interface ComplianceReviewResult {
  status: ReviewStatus;
  compliance_score: number | null;
  findings: EngineFinding[];
  metadata: EngineMetadata;
  extracted_ocr_text?: string;
}
