export type ReviewStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'pending'
  | 'flagged';

export type ContentType =
  | 'social_media'
  | 'email_marketing'
  | 'ad_copy'
  | 'press_release'
  | 'blog_post'
  | 'website_copy'
  | 'other';

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ReviewDecisionType =
  | 'approved'
  | 'flagged'
  | 'rejected'
  | 'changes_requested';

export type FindingCategory =
  | 'spelling_and_text'
  | 'logo_and_brand_identity'
  | 'abusive_or_harmful_language'
  | 'layout_and_design_quality'
  | 'claims_and_consistency'
  | 'copyright_and_ip_risk'
  | 'other_visible_issues'
  | 'brand_guideline'
  | string;

export interface RuleConfiguration {
  keywords?: string[];
  allowed_examples?: string[];
  forbidden_examples?: string[];
  required_phrases?: string[];
  exact_slogan?: string;
  max_characters?: number;
  min_characters?: number;
  max_words?: number;
  apply_channel_default?: boolean;
  notes?: string;
  [key: string]: unknown;
}

// 1. brand_guidelines
export interface BrandGuideline {
  id: string;
  title: string;
  description: string;
  rule_type: string;
  severity: RuleSeverity;
  rule_configuration: RuleConfiguration;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// 2. approved_facts
export interface ApprovedFact {
  id: string;
  fact_text: string;
  source_name: string;
  source_url?: string | null;
  evidence_notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// 3. authorized_assets
export type AssetType = 'logo' | 'color_palette' | 'badge' | 'product_image' | 'typography';

export interface AuthorizedAsset {
  id: string;
  asset_name: string;
  asset_type: AssetType;
  file_url: string;
  asset_metadata: {
    hex_colors?: string[];
    allowed_aspect_ratios?: string[];
    notes?: string;
    is_primary?: boolean;
    typography_family?: string;
    [key: string]: unknown;
  };
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Unified Brand Profile Configuration
export interface BrandProfile {
  id?: string;
  brand_name: string;
  brand_description: string;
  brand_colors: string[];
  typography_preferences?: string | {
    primary_font?: string;
    secondary_font?: string;
    notes?: string;
    [key: string]: unknown;
  };
  official_logo_url?: string | null;
  official_logo_id?: string | null;
  tone_of_voice: string;
  prohibited_phrases: string[];
  required_disclaimers: string[];
  approved_facts?: Array<{
    id?: string;
    fact_text: string;
    source_name: string;
    source_url?: string | null;
    evidence_notes?: string | null;
    is_active?: boolean;
  }>;
  additional_rules?: string | Array<{
    id?: string;
    title: string;
    description: string;
    severity: RuleSeverity;
    rule_type: string;
    is_active?: boolean;
  }>;
  updated_at?: string;
}

export interface BoundingBox {
  ymin: number; // 0 to 1000 normalized percentage
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ImageSummaryStats {
  width?: number;
  height?: number;
  aspectRatio?: string;
  format?: string;
  dominantColor?: string;
  hasLegibleTypography?: boolean;
  textLineCount?: number;
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

export interface ReviewEvaluationMetadata {
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
  checksStatus?: {
    imageInspection?: 'passed' | 'failed' | 'unavailable';
    typographyExtraction?: 'passed' | 'failed' | 'unavailable';
    spellingAndGrammar?: 'passed' | 'failed' | 'unavailable';
    logoAndBrandIdentity?: 'passed' | 'failed' | 'unavailable';
    abusiveLanguage?: 'passed' | 'failed' | 'unavailable';
    layoutAndDesign?: 'passed' | 'failed' | 'unavailable';
    claimsAndConsistency?: 'passed' | 'failed' | 'unavailable';
    copyrightAndIp?: 'passed' | 'failed' | 'unavailable';
    brandGuidelines?: 'passed' | 'failed' | 'unavailable';
    [key: string]: unknown;
  };
  checksCompleted?: Record<string, boolean>;
  guidelinesEvaluatedCount?: number;
  factsEvaluatedCount?: number;
  analysisNotes?: string;
  isPartialAnalysis?: boolean;
  analysisStatus?: 'clean' | 'partial' | 'failed' | 'complete';
  governance_status?: 'PASS' | 'WARNING' | 'REVIEW REQUIRED' | 'ANALYSIS INCOMPLETE';
  scoringBreakdown?: unknown;
  logoPresence?: LogoPresenceResult;
}

// 4. content_reviews (Image-Only Governance & Multi-Version Reviews)
export interface ContentReview {
  id: string;
  title: string;
  content_text: string;
  content_type: ContentType;
  status: ReviewStatus;
  compliance_score?: number | null;
  review_version: number;
  image_url: string;
  original_image_url?: string | null;
  caption_text?: string | null;
  original_caption_text?: string | null;
  aspect_ratio?: string | null; // e.g. "1:1", "4:5", "9:16", "16:9"
  image_width?: number | null;
  image_height?: number | null;
  extracted_ocr_text?: string | null;
  corrected_image_url?: string | null;
  correction_metadata?: {
    replaced_text?: string;
    new_text?: string;
    replaced_asset_id?: string;
    edit_applied_to_pixels?: boolean;
    correction_notes?: string;
    [key: string]: unknown;
  } | null;
  evaluation_metadata?: ReviewEvaluationMetadata | null;
  created_at: string;
  updated_at?: string;
  findings?: ReviewFinding[];
  decisions?: ReviewDecision[];
}

// 5. review_findings (Evidence-backed visual findings)
export interface ReviewFinding {
  id: string;
  review_id: string;
  category: FindingCategory;
  severity: RuleSeverity;
  finding_title: string;
  explanation: string;
  evidence_text?: string | null;
  location_description?: string | null;
  guideline_id?: string | null;
  fact_id?: string | null;
  asset_id?: string | null;
  confidence: number;
  suggested_fix?: string | null;
  bounding_box?: BoundingBox | null;
  target_type?: 'text' | 'visual_element' | 'logo' | 'color' | 'layout';
  target_scope?: 'image' | 'caption' | 'both';
  image_evidence?: string | null;
  caption_evidence?: string | null;
  proposed_replacement?: string | null;
  resolution_status?: 'unresolved' | 'resolved' | 'overridden' | 'reviewed';
  source?: string | null;
  verification_status?: string | null;
  needs_human_verification?: boolean;
  human_verification_reason?: string | null;
  uncertainty_notes?: string | null;
  created_at: string;
}

// 6. review_decisions
export interface ReviewDecision {
  id: string;
  review_id: string;
  decision: ReviewDecisionType;
  reviewer_label: string;
  comments?: string | null;
  is_override?: boolean;
  override_reason?: string | null;
  created_at: string;
}

// Creation and Mutation Payloads (Image-Only)
export interface CreateReviewPayload {
  title: string;
  content_type: ContentType;
  image_url?: string;
  content_text?: string;
  caption_text?: string;
  aspect_ratio?: string;
  image_width?: number;
  image_height?: number;
  status?: ReviewStatus;
  save_as_draft?: boolean;
}

export interface UpdateReviewVersionPayload {
  title?: string;
  content_type?: ContentType;
  image_url?: string;
  original_image_url?: string;
  content_text?: string;
  caption_text?: string;
  original_caption_text?: string;
  corrected_image_url?: string;
  correction_metadata?: {
    replaced_text?: string;
    new_text?: string;
    replaced_asset_id?: string;
    edit_applied_to_pixels?: boolean;
    correction_notes?: string;
    [key: string]: unknown;
  };
}

export interface CreateAssetPayload {
  asset_name: string;
  asset_type: AssetType;
  file_url: string;
  asset_metadata?: {
    hex_colors?: string[];
    allowed_aspect_ratios?: string[];
    notes?: string;
    is_primary?: boolean;
    typography_family?: string;
    [key: string]: unknown;
  };
  is_active?: boolean;
}

export interface UpdateAssetPayload {
  asset_name?: string;
  asset_type?: AssetType;
  file_url?: string;
  asset_metadata?: {
    hex_colors?: string[];
    allowed_aspect_ratios?: string[];
    notes?: string;
    is_primary?: boolean;
    typography_family?: string;
    [key: string]: unknown;
  };
  is_active?: boolean;
}

export interface CreateDecisionPayload {
  decision: ReviewDecisionType;
  reviewer_label: string;
  comments?: string;
  is_override?: boolean;
  override_reason?: string;
}

export interface CreateGuidelinePayload {
  title: string;
  description: string;
  rule_type: string;
  severity?: RuleSeverity;
  rule_configuration?: {
    keywords?: string[];
    allowed_examples?: string[];
    forbidden_examples?: string[];
    notes?: string;
    [key: string]: unknown;
  };
  is_active?: boolean;
}

export interface UpdateGuidelinePayload {
  title?: string;
  description?: string;
  rule_type?: string;
  severity?: RuleSeverity;
  rule_configuration?: {
    keywords?: string[];
    allowed_examples?: string[];
    forbidden_examples?: string[];
    notes?: string;
    [key: string]: unknown;
  };
  is_active?: boolean;
}

export interface CreateFactPayload {
  fact_text: string;
  source_name: string;
  source_url?: string;
  evidence_notes?: string;
  is_active?: boolean;
}

export interface UpdateFactPayload {
  fact_text?: string;
  source_name?: string;
  source_url?: string;
  evidence_notes?: string;
  is_active?: boolean;
}

export interface DashboardMetrics {
  totalReviews: number;
  approvedCount: number;
  flaggedCount: number;
  pendingCount: number;
  averageComplianceScore: number | null;
  activeGuidelinesCount: number;
  totalGuidelinesCount: number;
  activeFactsCount: number;
  totalFactsCount: number;
  latestDecision?: ReviewDecision | null;
}

export interface DatabaseConnectionStatus {
  connected: boolean;
  isUsingFallback: boolean;
  message: string;
  missingVars: string[];
  latencyMs?: number;
}
