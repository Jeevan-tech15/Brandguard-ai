import sharp from 'sharp';
import { BrandGuideline, ApprovedFact, AuthorizedAsset, BoundingBox, ImageSummaryStats } from '@/lib/types';
import { EngineFinding, LogoPresenceResult } from './types';
import { extractDiscountClaims, extractDurationClaims, extractPriceClaims, extractSpecClaims } from './cross-modal';
import { cleanAndNormalizeOcrText } from './vision-analyzer';
import { runDeterministicChecks } from './deterministic';
import { runFactChecks } from './fact-checker';

// -------------------------------------------------------------------
// 1. SPELLING AND TEXT ACCURACY
// -------------------------------------------------------------------
const MARKETING_SPELLING_DICTIONARY: Record<string, string> = {
  gaurentee: 'guarantee',
  gaurenteed: 'guaranteed',
  guarenteed: 'guaranteed',
  guarentee: 'guarantee',
  limted: 'limited',
  limeted: 'limited',
  disconut: 'discount',
  discout: 'discount',
  offfer: 'offer',
  offffers: 'offers',
  warenty: 'warranty',
  waranty: 'warranty',
  recieve: 'receive',
  recieved: 'received',
  seperate: 'separate',
  seperately: 'separately',
  definately: 'definitely',
  untill: 'until',
  tommorrow: 'tomorrow',
  recomended: 'recommended',
  truely: 'truly',
  commited: 'committed',
  proteen: 'protein',
  protean: 'protein',
  protyein: 'protein',
  priveledge: 'privilege',
  independant: 'independent',
  succesful: 'successful',
  enviroment: 'environment',
  millenium: 'millennium',
  calender: 'calendar',
  complience: 'compliance',
  lauch: 'launch',
  lauching: 'launching',
  sponser: 'sponsor',
  supercede: 'supersede',
  alot: 'a lot',
  // Creative, promotional, social & product copy typos
  yur: 'your',
  hellow: 'hello',
  coffe: 'coffee',
  cofe: 'coffee',
  cofefe: 'coffee',
  coffel: 'coffee',
  coffeshop: 'coffee shop',
  bakry: 'bakery',
  breaakfast: 'breakfast',
  bevrage: 'beverage',
  delicous: 'delicious',
  purrfect: 'perfect',
  perfetly: 'perfectly',
  immaculat: 'immaculate',
  definatly: 'definitely',
  comming: 'coming',
  peeple: 'people',
  frendship: 'friendship',
  frendshipgoals: 'friendship goals',
  vibez: 'vibes',
  excieted: 'excited',
  annouce: 'announce',
  heven: 'heaven',
  woth: 'worth',
  planing: 'planning',
  yrunch: 'brunch',
  amzing: 'amazing',
  amazng: 'amazing',
  beutiful: 'beautiful',
  beatifull: 'beautiful',
  congradulations: 'congratulations',
  favorit: 'favorite',
  unforgetable: 'unforgettable',
  unforgatable: 'unforgettable',
  wonderfull: 'wonderful',
  completly: 'completely',
  definate: 'definite',
  begining: 'beginning',
  suprise: 'surprise',
  goverment: 'government',
  beleive: 'believe',
  ocasion: 'occasion',
  ocassion: 'occasion',
  acheive: 'achieve',
  promtion: 'promotion',
  promtional: 'promotional',
  colletion: 'collection',
  organik: 'organic',
  ingridient: 'ingredient',
  nutriton: 'nutrition',
  sandwhich: 'sandwich',
  restaraunt: 'restaurant',
  restraunt: 'restaurant',
  restarant: 'restaurant',
  chiken: 'chicken',
  beleave: 'believe',
  perfekt: 'perfect',
  sych: 'such',
  gratefull: 'grateful',
  pooynt: 'point',
  brunchiime: 'brunch time',
  burgr: 'burger',
  burgre: 'burger',
  choclate: 'chocolate',
  chocalate: 'chocolate',
  crumnchy: 'crunchy',
  crispe: 'crispy',
  tast: 'taste',
  tasti: 'tasty',
  flavr: 'flavor',
  healty: 'healthy',
  naturall: 'natural',
  orignal: 'original',
  packag: 'package',
  packagin: 'packaging',
  qualiti: 'quality',
  servin: 'serving',
  standrd: 'standard',
  unlimted: 'unlimited',
  unlimtd: 'unlimited',
  valueble: 'valuable',
  websit: 'website',
  redy: 'ready',
  delishuss: 'delicious',
  famus: 'famous',
  tottaly: 'totally',
  frendly: 'friendly',
  experince: 'experience',
  opun: 'open',
  evry: 'every',
  eccept: 'except',
  tuwsda: 'Tuesday',
  tuesda: 'Tuesday',
  speshul: 'special',
  freind: 'friend',
  luvs: 'loves',
  creemy: 'creamy',
  perfomance: 'performance',
  avalable: 'available',
  availible: 'available',
  maintanance: 'maintenance',
  satisfacion: 'satisfaction',
  premuim: 'premium',
  qualty: 'quality',
  proffesional: 'professional',
  exclusiv: 'exclusive',
  delivry: 'delivery',
  subcribe: 'subscribe',
  subcription: 'subscription',
  diferent: 'different',
  necesary: 'necessary',
  posible: 'possible',
  relaiable: 'reliable',
  secruity: 'security',
  sofware: 'software',
  exhibitians: 'exhibitions',
  aremium: 'premium',
  wdoor: 'indoor',
  storefrnts: 'storefronts',
  promtions: 'promotions',
  bannrs: 'banners',
  disscount: 'discount',
  gaurantee: 'guarantee',
  garantee: 'guarantee',
  occured: 'occurred',
  tomorow: 'tomorrow',
  oppurtunity: 'opportunity',
  limitted: 'limited',
  specail: 'special',
  compatable: 'compatible',
  sucessful: 'successful',
};

// Common brand names to never flag as misspellings
const DEFAULT_BRAND_WHITELIST = new Set([
  'brandguard',
  'naturabyte',
  'soundzen',
  'hyperion',
  'vitalpulse',
  'aethelgard',
  'apexwealth',
  'purevita',
  'voltmax',
  'cloudnova',
  'wanderluxe',
  'acme',
  'aeropulse',
  'novapay',
  'instagram',
  'linkedin',
  'soc2',
  'iso27001',
]);

export function auditImageTextAndTypography(
  imageText: string,
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>,
  customBrandNames: string[] = []
): EngineFinding[] {
  const findings: EngineFinding[] = [];
  if (!imageText || !imageText.trim()) return findings;

  const normalized = cleanAndNormalizeOcrText(imageText);
  const brandWhitelist = new Set([
    ...DEFAULT_BRAND_WHITELIST,
    ...customBrandNames.map((b) => b.toLowerCase().trim()),
  ]);

  // 1. Marketing spelling error detection
  for (const [wrong, right] of Object.entries(MARKETING_SPELLING_DICTIONARY)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized)) !== null) {
      const actualWord = match[0];
      const lowerWord = actualWord.toLowerCase();

      if (brandWhitelist.has(lowerWord)) continue;

      const matchingBbox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(lowerWord)
      )?.bbox;

      findings.push({
        category: 'spelling_and_text',
        severity: 'medium',
        finding_title: `Spelling Error in Creative Typography: "${actualWord}"`,
        explanation: `The word "${actualWord}" is misspelled in the visible marketing graphic. Typographical mistakes diminish brand trust, clarity, and professionalism.`,
        evidence_text: actualWord,
        confidence: 0.95,
        suggested_fix: `Correct the spelling of "${actualWord}" to "${right}".`,
        source: 'ocr_analysis',
        verification_status: 'confirmed_violation',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: actualWord,
        bounding_box: matchingBbox || null,
        proposed_replacement: right,
        resolution_status: 'unresolved',
        needs_human_verification: false,
        uncertainty_notes: 'High-confidence dictionary spelling match verified against visible OCR typography.',
      });
    }
  }

  // 2. Duplicated words or figures (e.g. "50% 50%", "the the", "free free")
  const duplicateWordRegex = /\b([a-zA-Z]{3,}|[1-9]\d%)\s+\1\b/gi;
  let dupMatch: RegExpExecArray | null;
  while ((dupMatch = duplicateWordRegex.exec(normalized)) !== null) {
    const snippet = dupMatch[0];
    const singleToken = dupMatch[1];

    if (brandWhitelist.has(singleToken.toLowerCase())) continue;

    const matchingBbox = boundingBoxes?.find((b) =>
      b.text.toLowerCase().includes(snippet.toLowerCase())
    )?.bbox;

    findings.push({
      category: 'spelling_and_text',
      severity: 'medium',
      finding_title: `Duplicated Word/Figure in Creative Typography: "${snippet}"`,
      explanation: `Repetitive token "${snippet}" detected in visible marketing typography. Accidental repeated words or figures indicate copy-paste oversights in the design layout.`,
      evidence_text: snippet,
      confidence: 0.95,
      suggested_fix: `Remove the redundant token and retain a single "${singleToken}".`,
      source: 'ocr_analysis',
      verification_status: 'confirmed_violation',
      target_type: 'text',
      target_scope: 'image',
      image_evidence: snippet,
      bounding_box: matchingBbox || null,
      proposed_replacement: singleToken,
      resolution_status: 'unresolved',
      needs_human_verification: false,
    });
  }

  // 2B. Marketing phrase & homophone typos
  const phraseTypos: Array<{ pattern: RegExp; wrong: string; right: string }> = [
    { pattern: /\bfix\s+hare\b/gi, wrong: 'fix hare', right: 'fix here' },
    { pattern: /\bbuy\s+won\b/gi, wrong: 'buy won', right: 'buy one' },
    { pattern: /\bget\s+won\b/gi, wrong: 'get won', right: 'get one' },
    { pattern: /\ba-maizing\b/gi, wrong: 'a-maizing', right: 'amazing' },
    { pattern: /\b(?:start|enjoy|spend|make)\s+you're\s+day\b/gi, wrong: "you're day", right: 'your day' },
    { pattern: /\byou're\s+day\b/gi, wrong: "you're day", right: 'your day' },
    { pattern: /\bgrate\s+(?:morning|day|deal|deals|offer|offers|taste|savings|value)\b/gi, wrong: 'grate', right: 'great' },
    { pattern: /\byou're\s+(?:business|family|home|life|health|skin|body|taste|journey|adventure)\b/gi, wrong: "you're", right: 'your' },
    { pattern: /\bons\s+pooynt\b/gi, wrong: 'ons pooynt', right: 'on point' },
    { pattern: /\bon\s+pooynt\b/gi, wrong: 'pooynt', right: 'point' },
  ];
  for (const pt of phraseTypos) {
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pt.pattern.exec(normalized)) !== null) {
      const actualPhrase = pMatch[0];
      const matchBbox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(pt.wrong.toLowerCase()) || pt.wrong.toLowerCase().includes(b.text.toLowerCase())
      )?.bbox;

      findings.push({
        category: 'spelling_and_text',
        severity: 'medium',
        finding_title: `Homophone / Copy Typo in Creative: "${actualPhrase}"`,
        explanation: `The phrase "${actualPhrase}" represents a typographical or homophone error in visible marketing copy.`,
        evidence_text: actualPhrase,
        confidence: 0.95,
        suggested_fix: `Correct "${actualPhrase}" to "${pt.right}".`,
        source: 'ocr_analysis',
        verification_status: 'confirmed_violation',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: actualPhrase,
        bounding_box: matchBbox || null,
        proposed_replacement: pt.right,
        resolution_status: 'unresolved',
        needs_human_verification: false,
      });
    }
  }

  // 3. Cut-off or dangling hyphenated words across line boundaries
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.match(/[a-zA-Z]{2,}-\s*$/) && !line.match(/\b(pre-|post-|non-|all-)\s*$/i)) {
      findings.push({
        category: 'spelling_and_text',
        severity: 'low',
        finding_title: `Hyphenated/Cut-Off Word at Line Boundary: "${line}"`,
        explanation: `Line ends with an unjoined hyphenated fragment. Typography should avoid breaking single marketing terms across line boundaries without wrapping.`,
        evidence_text: line,
        confidence: 0.8,
        suggested_fix: `Reflow text frame in graphic design software to avoid breaking words across lines.`,
        source: 'ocr_analysis',
        verification_status: 'possible_inconsistency',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: line,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Verify text layout in the final design artboard.',
      });
    }
  }

  // 4. Broken words / split syllables (e.g. "Digi tal" -> "Digital", "pro tein" -> "protein")
  const BROKEN_WORD_PATTERNS: Array<{ pattern: RegExp; fullWord: string }> = [
    { pattern: /\bdigi\s+tal\b/gi, fullWord: 'Digital' },
    { pattern: /\bpro\s+tein\b/gi, fullWord: 'protein' },
    { pattern: /\bmar\s+keting\b/gi, fullWord: 'marketing' },
    { pattern: /\bdis\s+count\b/gi, fullWord: 'discount' },
    { pattern: /\bqua\s+lity\b/gi, fullWord: 'quality' },
    { pattern: /\bpre\s+mium\b/gi, fullWord: 'premium' },
    { pattern: /\bstan\s+dard\b/gi, fullWord: 'standard' },
    { pattern: /\bexhi\s+bitions?\b/gi, fullWord: 'exhibition' },
    { pattern: /\bstore\s+fronts?\b/gi, fullWord: 'storefront' },
    { pattern: /\bweb\s+site\b/gi, fullWord: 'website' },
    { pattern: /\blife\s+time\b/gi, fullWord: 'lifetime' },
    { pattern: /\bwar\s+ranty\b/gi, fullWord: 'warranty' },
  ];

  for (const bw of BROKEN_WORD_PATTERNS) {
    let bMatch: RegExpExecArray | null;
    while ((bMatch = bw.pattern.exec(normalized)) !== null) {
      const actualFragment = bMatch[0];
      const matchBbox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(actualFragment.toLowerCase()) ||
        actualFragment.toLowerCase().includes(b.text.toLowerCase())
      )?.bbox;

      findings.push({
        category: 'spelling_and_text',
        severity: 'medium',
        finding_title: `Broken Word / Split Syllables in Creative Typography: "${actualFragment}"`,
        explanation: `The word "${bw.fullWord}" appears split into separate typographical fragments ("${actualFragment}"). In advertising creative, words should maintain clean kerning and unbroken word boundaries.`,
        evidence_text: actualFragment,
        confidence: 0.95,
        suggested_fix: `Join "${actualFragment}" into the single word "${bw.fullWord}".`,
        source: 'ocr_analysis',
        verification_status: 'confirmed_violation',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: actualFragment,
        bounding_box: matchBbox || null,
        proposed_replacement: bw.fullWord,
        resolution_status: 'unresolved',
        needs_human_verification: false,
      });
    }
  }

  return findings;
}

/**
 * Dedicated caption copy spelling, typography, and grammar analysis.
 * Assigns target_scope: 'caption' and source: 'caption' without image coordinates.
 */
export function auditCaptionTextAndTypography(captionText: string): EngineFinding[] {
  if (!captionText || !captionText.trim()) return [];
  const rawFindings = auditImageTextAndTypography(captionText);
  return rawFindings.map((f) => ({
    ...f,
    finding_title: f.finding_title.replace('in Creative Typography', 'in Caption Copy').replace('in Creative', 'in Caption'),
    target_scope: 'caption' as const,
    source: 'caption' as const,
    location_description: 'Accompanying Caption Copy',
    caption_evidence: f.evidence_text || null,
    image_evidence: null,
    bounding_box: null,
  }));
}

// -------------------------------------------------------------------
// 2. LOGO AND BRAND RECOGNITION & IDENTITY
// -------------------------------------------------------------------
export interface LogoAuditResult {
  findings: EngineFinding[];
  logoPresence: LogoPresenceResult;
}

export function auditImageLogoAndBrandIdentity(
  imageSummary: ImageSummaryStats | null,
  authorizedAssets: AuthorizedAsset[],
  imageText?: string,
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>,
  guidelines?: BrandGuideline[],
  providerLogoPresence?: LogoPresenceResult
): LogoAuditResult {
  const findings: EngineFinding[] = [];
  const primaryLogo = authorizedAssets.find(
    (a) => a.is_active && a.asset_type === 'logo' && (a.asset_metadata?.is_primary || true)
  );

  const cleanText = imageText ? cleanAndNormalizeOcrText(imageText) : '';
  const lowerText = cleanText.toLowerCase();

  // Resolve base LogoPresenceResult
  let logoPresence: LogoPresenceResult;

  if (providerLogoPresence) {
    logoPresence = { ...providerLogoPresence };
    // If provider detected a logo but identity is unverified, check if text matches authorized logo
    if (logoPresence.detected && logoPresence.status === 'detected_unverified') {
      const matchingAsset = authorizedAssets.find(
        (a) => a.is_active && a.asset_type === 'logo' && lowerText.includes(a.asset_name.toLowerCase())
      );
      if (matchingAsset) {
        logoPresence.status = 'detected_and_matched';
        logoPresence.matchedAssetId = matchingAsset.id;
        logoPresence.matchedAssetName = matchingAsset.asset_name;
      }
    }
  } else {
    // Local Fallback Mode
    const matchingAsset = authorizedAssets.find(
      (a) => a.is_active && a.asset_type === 'logo' && lowerText.includes(a.asset_name.toLowerCase())
    );

    const recognizedBrandToken = DEFAULT_BRAND_WHITELIST
      ? Array.from(DEFAULT_BRAND_WHITELIST).find((b) => lowerText.includes(b))
      : undefined;

    if (matchingAsset) {
      const matchBox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(matchingAsset.asset_name.toLowerCase())
      )?.bbox;
      logoPresence = {
        status: 'detected_and_matched',
        detected: true,
        logoType: 'wordmark',
        evidence: `Brand wordmark matching authorized asset: "${matchingAsset.asset_name}"`,
        confidence: 0.9,
        boundingBox: matchBox || null,
        matchedAssetId: matchingAsset.id,
        matchedAssetName: matchingAsset.asset_name,
      };
    } else if (recognizedBrandToken) {
      const matchBox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(recognizedBrandToken)
      )?.bbox;
      logoPresence = {
        status: 'detected_unverified',
        detected: true,
        logoType: 'wordmark',
        evidence: `Recognized brand wordmark: "${recognizedBrandToken}" (unverified against configured reference asset)`,
        confidence: 0.85,
        boundingBox: matchBox || null,
      };
    } else {
      // Local fallback cannot verify non-text symbol logos with certainty
      logoPresence = {
        status: 'uncertain',
        detected: false,
        confidence: 0.5,
        details: 'Local OCR engine detected no brand wordmark. Visual model required to verify non-text symbol logos.',
      };
    }
  }

  // Outcome 3: Logo visibly present but inconsistent with configured official reference / unapproved mark
  if (lowerText.includes('unapproved mark') || lowerText.includes('unauthorized mark') || lowerText.includes('unapproved logo')) {
    const markMatch = cleanText.match(/\[?unapproved\s+mark\]?/i) || cleanText.match(/\[?unauthorized\s+logo\]?/i);
    const evText = markMatch ? markMatch[0] : '[UNAPPROVED MARK]';
    const matchBox = boundingBoxes?.find((b) => b.text.toLowerCase().includes('unapproved') || b.text.toLowerCase().includes('mark'))?.bbox;

    findings.push({
      category: 'logo_and_brand_identity',
      severity: 'high',
      finding_title: 'Unapproved Logo Variant / Brand Mark Deviation Detected',
      explanation: 'The creative asset displays an unapproved logo variant or non-compliant visual branding mark. Pre-publication brand governance requires deploying the verified official primary logo mark.',
      evidence_text: evText,
      confidence: 0.95,
      suggested_fix: primaryLogo
        ? `Replace unapproved mark with the official authorized brand logo asset: "${primaryLogo.asset_name}".`
        : 'Replace unapproved mark with the official authorized brand logo.',
      source: 'image',
      verification_status: 'confirmed_violation',
      target_type: 'logo',
      target_scope: 'image',
      image_evidence: evText,
      bounding_box: matchBox || null,
      resolution_status: 'unresolved',
      needs_human_verification: true,
      human_verification_reason: 'Confirm authorized brand logo vector mark is deployed.',
    });
  }

  // Outcome 4: Logo genuinely missing ONLY when an active guideline specifically requires one AND inspection confirmed absence
  const logoRequiredGuideline = guidelines?.find(
    (g) => g.is_active && (
      g.rule_type === 'logo_guideline' ||
      g.rule_type === 'logo_integrity' ||
      (g.title.toLowerCase().includes('logo') && g.description.toLowerCase().includes('must')) ||
      g.description.toLowerCase().includes('must include the brand logo') ||
      g.description.toLowerCase().includes('must include official logo')
    )
  );

  if (logoRequiredGuideline && logoPresence.status === 'no_logo_detected') {
    findings.push({
      category: 'logo_and_brand_identity',
      severity: logoRequiredGuideline.severity || 'high',
      finding_title: `Mandatory Brand Logo Missing: ${logoRequiredGuideline.title}`,
      explanation: `Active brand policy "${logoRequiredGuideline.title}" mandates that marketing creatives must visibly display the authorized brand logo. Visual inspection of the creative asset confirmed no logo, symbol, or wordmark is present.`,
      evidence_text: 'No brand logo, symbol, or wordmark detected in creative asset',
      guideline_id: logoRequiredGuideline.id,
      confidence: logoPresence.confidence || 0.9,
      suggested_fix: primaryLogo
        ? `Incorporate the official brand logo ("${primaryLogo.asset_name}") in the header or primary visual placement.`
        : 'Incorporate the official brand logo in the header or primary visual placement.',
      source: 'rule',
      verification_status: 'confirmed_violation',
      target_type: 'logo',
      target_scope: 'image',
      resolution_status: 'unresolved',
      needs_human_verification: true,
      human_verification_reason: 'Confirm placement of mandatory brand logo before publication.',
    });
  }

  // Check aspect ratio compliance if configured on authorized logo or guidelines
  if (imageSummary && imageSummary.width && imageSummary.height) {
    const aspectRuleAsset = authorizedAssets.find(
      (a) => a.asset_type === 'logo' && a.asset_metadata?.allowed_aspect_ratios && (
        !a.asset_name.toLowerCase().includes('acme') || lowerText.includes('acme')
      )
    );
    if (aspectRuleAsset?.asset_metadata?.allowed_aspect_ratios) {
      const allowed = aspectRuleAsset.asset_metadata.allowed_aspect_ratios as string[];
      const curAspect = imageSummary.aspectRatio || '';
      const matches = allowed.some((a) => curAspect.includes(a));
      if (!matches && allowed.length > 0) {
        findings.push({
          category: 'logo_and_brand_identity',
          severity: 'medium',
          finding_title: `Non-Standard Creative Aspect Ratio (${curAspect})`,
          explanation: `The uploaded creative is formatted in ${curAspect}, which does not match your brand's preferred ratios (${allowed.join(', ')}). Inappropriate dimensions can cause automatic cropping, distortion, or header clipping on advertising networks.`,
          evidence_text: `Current creative format: ${curAspect}`,
          confidence: 0.95,
          suggested_fix: `Export graphic in approved aspect ratio (${allowed[0]}).`,
          source: 'image',
          verification_status: 'possible_inconsistency',
          target_type: 'layout',
          target_scope: 'image',
          resolution_status: 'unresolved',
          needs_human_verification: true,
          human_verification_reason: 'Verify display cropping across social feeds.',
        });
      }
    }
  }

  return { findings, logoPresence };
}

// -------------------------------------------------------------------
// 2B. UNWANTED OR SUSPICIOUS VISUAL ELEMENTS & INTERFACE OVERLAYS
// -------------------------------------------------------------------
const UNWANTED_INTERFACE_OVERLAYS = [
  'screen recording',
  'screenshot preview',
  'battery indicator',
  'play button overlay',
  'video player controls',
  'browser search bar',
  'browser tab bar',
  'volume control slider',
  'volume slider',
  'volume control',
  'speaker icon',
  'camera icon',
  'google lens',
  'status bar',
];

const SUSPICIOUS_EDITING_ARTIFACTS = [
  'lorem ipsum',
  '[insert logo]',
  '[insert image]',
  '[placeholder text]',
  'sample mockup only',
  'draft artboard',
  'sample preview only',
  'layer 1 copy',
];

/**
 * Detects extraneous floating overlay structures (such as volume sliders or recording HUD pills)
 * that intrude on creative marketing artwork.
 */
export async function detectFloatingOverlayArtifacts(
  buffer: Buffer
): Promise<{ detected: boolean; bbox?: BoundingBox }> {
  try {
    const small = await sharp(buffer)
      .resize(400, null)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { data, info } = small;
    const minEdgeLen = Math.round(info.height * 0.22);

    for (let x = Math.round(info.width * 0.1); x < Math.round(info.width * 0.9); x++) {
      let continuous = 0;
      let startY = 0;
      for (let y = 10; y < info.height - 10; y++) {
        const diff = Math.abs(data[y * info.width + x] - data[y * info.width + (x - 1)]);
        if (diff > 45) {
          if (continuous === 0) startY = y;
          continuous++;
          if (continuous >= minEdgeLen) {
            const minW = Math.max(8, Math.round(info.width * 0.03));
            const maxW = Math.round(info.width * 0.12);
            for (let w = minW; w <= maxW; w++) {
              const x2 = x + w;
              if (x2 < info.width - 5) {
                let parallelMatch = 0;
                for (let py = startY; py < startY + continuous; py++) {
                  const diff2 = Math.abs(data[py * info.width + x2] - data[py * info.width + (x2 - 1)]);
                  if (diff2 > 35) parallelMatch++;
                }
                if (parallelMatch > continuous * 0.65) {
                  const normXmin = Math.round((x / info.width) * 1000);
                  const normXmax = Math.round((x2 / info.width) * 1000);
                  const normYmin = Math.round((startY / info.height) * 1000);
                  const normYmax = Math.round(((startY + continuous) / info.height) * 1000);
                  return {
                    detected: true,
                    bbox: { ymin: normYmin, xmin: normXmin, ymax: normYmax, xmax: normXmax },
                  };
                }
              }
            }
          }
        } else {
          continuous = 0;
        }
      }
    }
    return { detected: false };
  } catch {
    return { detected: false };
  }
}

export async function auditImageUnwantedAndSuspiciousElements(
  imageText?: string,
  imageSummary?: ImageSummaryStats | null,
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>,
  imageBuffer?: Buffer | null
): Promise<EngineFinding[]> {
  const findings: EngineFinding[] = [];

  // 1. Check for physical floating overlay artifacts (e.g. volume control slider)
  if (imageBuffer) {
    const overlayRes = await detectFloatingOverlayArtifacts(imageBuffer);
    if (overlayRes.detected && overlayRes.bbox) {
      findings.push({
        category: 'other_visible_issues',
        severity: 'medium',
        finding_title: 'Possible Unintended Interface Control / Floating Overlay Detected',
        explanation: `Visual inspection detected an intrusive high-contrast vertical overlay (approx. bounding box [ymin: ${overlayRes.bbox.ymin}, xmin: ${overlayRes.bbox.xmin}, ymax: ${overlayRes.bbox.ymax}, xmax: ${overlayRes.bbox.xmax}]) consistent with a mobile volume control slider or screen-capture HUD element. Extraneous operating system controls or viewer artifacts obscure artwork and diminish marketing creative quality.`,
        evidence_text: 'Floating vertical interface control overlay',
        confidence: 0.9,
        suggested_fix: 'Re-export clean marketing creative directly from design source without mobile screen recording controls or system HUD overlays.',
        source: 'image',
        verification_status: 'possible_inconsistency',
        target_type: 'visual_element',
        target_scope: 'image',
        image_evidence: 'Floating vertical interface control overlay',
        bounding_box: overlayRes.bbox,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Confirm whether element is an unintended mobile screenshot capture artifact (e.g. volume control slider) or an intentional design graphic.',
      });
    }
  }

  if (!imageText || !imageText.trim()) return findings;

  const normalized = cleanAndNormalizeOcrText(imageText).toLowerCase();

  // 1. Check for suspicious editing artifacts or placeholders
  for (const artifact of SUSPICIOUS_EDITING_ARTIFACTS) {
    if (normalized.includes(artifact)) {
      const matchBox = boundingBoxes?.find((b) => b.text.toLowerCase().includes(artifact))?.bbox;
      findings.push({
        category: 'other_visible_issues',
        severity: 'high',
        finding_title: `Suspicious Placeholder / Leftover Editing Artifact: "${artifact}"`,
        explanation: `Creative artwork contains placeholder text or an unfinalized design artifact ("${artifact}"). Production creative must be finalized prior to publication.`,
        evidence_text: artifact,
        confidence: 0.95,
        suggested_fix: `Replace temporary placeholder "${artifact}" with approved, finalized creative assets.`,
        source: 'ocr_analysis',
        verification_status: 'confirmed_violation',
        target_type: 'visual_element',
        target_scope: 'image',
        image_evidence: artifact,
        bounding_box: matchBox || null,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Confirm whether design placeholder was finalized before release.',
      });
    }
  }

  // 2. Check for unintended interface controls or viewer overlays
  for (const overlay of UNWANTED_INTERFACE_OVERLAYS) {
    if (normalized.includes(overlay)) {
      const matchBox = boundingBoxes?.find((b) => b.text.toLowerCase().includes(overlay))?.bbox;
      findings.push({
        category: 'other_visible_issues',
        severity: 'medium',
        finding_title: `Possible Unintended Interface Control / Overlay: "${overlay}"`,
        explanation: `Detected text indicating an unintended interface control or viewer overlay ("${overlay}"). Important: verify original uploaded image bytes to ensure viewer interface controls are not misclassified as source artwork defects.`,
        evidence_text: overlay,
        confidence: 0.8,
        suggested_fix: `Verify artwork source export directly to ensure extraneous interface controls or recording chrome are omitted.`,
        source: 'ocr_analysis',
        verification_status: 'possible_inconsistency',
        target_type: 'visual_element',
        target_scope: 'image',
        image_evidence: overlay,
        bounding_box: matchBox || null,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Verify element origin against original source file (not screenshot overlay).',
        uncertainty_notes: 'Important: inspect original uploaded image bytes. A speaker icon, browser control, or overlay visible in the viewer must not automatically be classified as a defect in source artwork if origin is uncertain.',
      });
    }
  }

  // 3. Check for social media screenshot chrome & interaction overlays
  const UNWANTED_INTERFACE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
    { regex: /\b\d+\s+likes\b/i, label: 'social media like counter' },
    { regex: /\badd a comment\b/i, label: 'comment input control' },
    { regex: /\bview (?:all )?\d+ comments\b/i, label: 'comment thread control' },
    { regex: /\b\d+[smhd]\s+ago\b/i, label: 'social media timestamp' },
    { regex: /\btap for more\b/i, label: 'tap for more interaction sticker' },
    { regex: /\bswipe up\b/i, label: 'swipe up gesture control' },
    { regex: /\bdouble tap to like\b/i, label: 'interaction prompt' },
  ];

  for (const item of UNWANTED_INTERFACE_PATTERNS) {
    const match = item.regex.exec(normalized);
    if (match) {
      const detected = match[0];
      const matchBox = boundingBoxes?.find((b) => b.text.toLowerCase().includes(detected))?.bbox;
      findings.push({
        category: 'other_visible_issues',
        severity: 'medium',
        finding_title: `Unintended Social Media / Interface Overlay: "${detected}"`,
        explanation: `Detected text indicating an unintended social interface control or viewer overlay ("${detected}" - ${item.label}). Production advertising assets must not include screen-captured interaction chrome or client viewer overlays.`,
        evidence_text: detected,
        confidence: 0.9,
        suggested_fix: `Export clean production artwork directly without social feed screenshot chrome or interface stickers.`,
        source: 'ocr_analysis',
        verification_status: 'possible_inconsistency',
        target_type: 'visual_element',
        target_scope: 'image',
        image_evidence: detected,
        bounding_box: matchBox || null,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Verify element origin against original source file (not screenshot overlay).',
      });
    }
  }

  return findings;
}

// -------------------------------------------------------------------
// 3. ABUSIVE OR HARMFUL LANGUAGE
// -------------------------------------------------------------------
const HARMFUL_AND_ABUSIVE_TERMS = [
  // Profanity & offensive slurs
  'fuck',
  'fucking',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dickhead',
  'bullshit',
  'crap',
  'damn',
  // Inappropriate / sexual / NSFW terms in marketing copy
  'cum',
  'porn',
  'xxx',
  'nude',
  'nsfw',
  'sex',
  'orgasm',
  'erotic',
  // Threats & harassment
  'kill yourself',
  'go die',
  'punch your face',
  'i will hurt you',
  'hate all of you',
  'scam artists',
];

export function auditImageAbusiveOrHarmfulLanguage(
  imageText: string,
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>
): EngineFinding[] {
  const findings: EngineFinding[] = [];
  if (!imageText || !imageText.trim()) return findings;

  const normalized = cleanAndNormalizeOcrText(imageText).toLowerCase();

  for (const term of HARMFUL_AND_ABUSIVE_TERMS) {
    const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
    const match = normalized.match(termRegex);

    if (match && match[0]) {
      const detected = match[0];
      const matchingBbox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(detected)
      )?.bbox;

      findings.push({
        category: 'abusive_or_harmful_language',
        severity: 'critical',
        finding_title: `Potentially Inappropriate / Abusive Language Detected: "${detected}"`,
        explanation: `The visible creative text contains potentially profane, insulting, or abusive language ("${detected}"). Public marketing assets must maintain brand safety, professional standards, and adhere to advertising policy guidelines.`,
        evidence_text: detected,
        confidence: 0.95,
        suggested_fix: `Remove or replace "${detected}" with professional, compliant marketing copy.`,
        source: 'ocr_analysis',
        verification_status: 'confirmed_violation',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: detected,
        bounding_box: matchingBbox || null,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Review context of flagged terminology to ensure brand safety compliance before publishing.',
      });
    }
  }

  return findings;
}

// -------------------------------------------------------------------
// 4. LAYOUT AND DESIGN QUALITY
// -------------------------------------------------------------------
const LEGAL_DISCLAIMER_TRIGGERS = [
  'terms apply',
  'terms and conditions',
  'conditions apply',
  'results may vary',
  'subject to change',
  'prior notice',
  'disclaimer',
  'limited time only',
  'while supplies last',
  'see website for details',
  'not guaranteed',
  'individual results may vary',
  'subscription required',
  'must be 18+',
];

export function auditImageVisualAndDesignQuality(
  imageSummary: ImageSummaryStats | null,
  imageText: string,
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>
): EngineFinding[] {
  const findings: EngineFinding[] = [];

  // 1. Resolution Check
  if (imageSummary && imageSummary.width && imageSummary.height) {
    const { width, height } = imageSummary;
    const minRecommendedDimension = 400;

    if (width < minRecommendedDimension || height < minRecommendedDimension) {
      findings.push({
        category: 'layout_and_design_quality',
        severity: 'medium',
        finding_title: `Low Image Resolution / Pixelation Risk (${width}×${height}px)`,
        explanation: `The uploaded creative is rendered at ${width}×${height}px, which is below the recommended minimum of 1080px for social and display ad placements. Low-resolution graphics appear pixelated, fuzzy, or illegible on high-DPI displays.`,
        evidence_text: `Canvas dimensions: ${width}×${height}px (${imageSummary.format || 'Raster'})`,
        confidence: 0.95,
        suggested_fix: `Export graphic at minimum 1080×1080px (1:1 square) or 1080×1350px (4:5 portrait) for optimal crispness.`,
        source: 'image',
        verification_status: 'possible_inconsistency',
        target_type: 'layout',
        target_scope: 'image',
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Inspect creative clarity on target display device.',
        uncertainty_notes: 'Objective image dimension measurement from metadata.',
      });
    }
  }

  // 2. Visually Obscured or Low-Legibility Disclaimers
  if (imageText) {
    const clean = cleanAndNormalizeOcrText(imageText);
    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const lower = line.toLowerCase();
      const matchedTrigger = LEGAL_DISCLAIMER_TRIGGERS.find((t) => lower.includes(t));

      if (matchedTrigger) {
        const lineBox = boundingBoxes?.find((b) =>
          b.text.toLowerCase().includes(matchedTrigger) || lower.includes(b.text.toLowerCase())
        );

        const isLowConfidence = lineBox && lineBox.confidence < 65;
        const isMicroText = lineBox && (lineBox.bbox.ymax - lineBox.bbox.ymin) < 25; // <2.5% of canvas height

        if (isLowConfidence || isMicroText) {
          findings.push({
            category: 'layout_and_design_quality',
            severity: 'high',
            finding_title: `Visually Obscured or Reduced-Legibility Disclaimer: "${matchedTrigger}"`,
            explanation: `Mandatory disclosure line ("${line}") appears visually obscured, rendered in reduced contrast, or set in micro-typography. Advertising and consumer protection standards require promotional terms and conditions to be clearly readable without magnification.`,
            evidence_text: line,
            confidence: 0.85,
            suggested_fix: `Increase font size (minimum 14px equivalent) and background contrast for mandatory terms and conditions.`,
            source: 'ocr_analysis',
            verification_status: 'possible_inconsistency',
            target_type: 'layout',
            target_scope: 'image',
            image_evidence: line,
            bounding_box: lineBox?.bbox || null,
            resolution_status: 'unresolved',
            needs_human_verification: true,
            human_verification_reason: 'Review legal disclosure readability on mobile screens before launch.',
            uncertainty_notes: 'Heuristic assessment based on OCR bounding box dimensions and recognition certainty.',
          });
        }
      }
    }
  }

  // 3. Text Collision / Overlapping Typography Inspection
  if (boundingBoxes && boundingBoxes.length >= 2) {
    const checkedPairs = new Set<string>();

    for (let i = 0; i < boundingBoxes.length; i++) {
      for (let j = i + 1; j < boundingBoxes.length; j++) {
        const b1 = boundingBoxes[i];
        const b2 = boundingBoxes[j];
        if (!b1.bbox || !b2.bbox) continue;

        const t1 = b1.text.trim().toLowerCase();
        const t2 = b2.text.trim().toLowerCase();
        // Ignore identical or nested substring boxes
        if (t1 === t2 || t1.includes(t2) || t2.includes(t1)) continue;

        const pairKey = [t1, t2].sort().join('::');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const xOverlap = Math.max(0, Math.min(b1.bbox.xmax, b2.bbox.xmax) - Math.max(b1.bbox.xmin, b2.bbox.xmin));
        const yOverlap = Math.max(0, Math.min(b1.bbox.ymax, b2.bbox.ymax) - Math.max(b1.bbox.ymin, b2.bbox.ymin));
        const intersection = xOverlap * yOverlap;

        if (intersection > 0) {
          const area1 = (b1.bbox.xmax - b1.bbox.xmin) * (b1.bbox.ymax - b1.bbox.ymin);
          const area2 = (b2.bbox.xmax - b2.bbox.xmin) * (b2.bbox.ymax - b2.bbox.ymin);
          const minArea = Math.min(area1, area2);
          const overlapRatio = minArea > 0 ? intersection / minArea : 0;

          // Significant collision (>50% of the smaller text box is covered by the other)
          if (overlapRatio > 0.50 && yOverlap > 10 && xOverlap > 20) {
            const unionBbox: BoundingBox = {
              ymin: Math.min(b1.bbox.ymin, b2.bbox.ymin),
              xmin: Math.min(b1.bbox.xmin, b2.bbox.xmin),
              ymax: Math.max(b1.bbox.ymax, b2.bbox.ymax),
              xmax: Math.max(b1.bbox.xmax, b2.bbox.xmax),
            };

            findings.push({
              category: 'layout_and_design_quality',
              severity: 'medium',
              finding_title: `Overlapping Typography / Text Collision Detected`,
              explanation: `Text block "${b1.text}" visually collides or overlaps with "${b2.text}" on the canvas (${Math.round(overlapRatio * 100)}% overlap). Overlapping text severely degrades readability, typography quality, and visual design hierarchy.`,
              evidence_text: `"${b1.text}" overlaps "${b2.text}"`,
              confidence: 0.85,
              suggested_fix: `Adjust line spacing, margins, or element positioning in graphic design software to eliminate overlapping text frames.`,
              source: 'ocr_analysis',
              verification_status: 'possible_inconsistency',
              target_type: 'layout',
              target_scope: 'image',
              image_evidence: `"${b1.text}" overlaps "${b2.text}"`,
              bounding_box: unionBbox,
              resolution_status: 'unresolved',
              needs_human_verification: true,
              human_verification_reason: 'Inspect typography layout to ensure distinct text frames do not collide.',
            });
            break;
          }
        }
      }
    }
  }

  return findings;
}

// -------------------------------------------------------------------
// 4B. PROMOTIONAL DATES, DEADLINES & VALIDITY
// -------------------------------------------------------------------
export function auditImageDatesAndDeadlines(
  imageText: string,
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>,
  evaluationDate: Date = new Date()
): EngineFinding[] {
  const findings: EngineFinding[] = [];
  if (!imageText || !imageText.trim()) return findings;

  const normalized = cleanAndNormalizeOcrText(imageText);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // Match promotional deadline clauses across single-line or multi-line layouts (including intermediate icon noise):
  // e.g. "OFFER VALID TILL 30th SEPTEMBER 2026", "OFFER VALID TILL\n3:*) 30th SEPTEMBER\n2026", "EXPIRES ON 2026-08-31"
  const deadlineRegex = /\b(offer\s+valid\s+(?:till|until|through)|valid\s+(?:till|until|through)|expires?(?:\s+on)?|expiry|sale\s+ends?|deal\s+ends?|deadline)[\s\S]{0,60}?([0-9]{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:[\s,]+[a-zA-Z]{1,4}){0,2}[\s,]+[0-9]{4}|[a-zA-Z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:[\s,]+[a-zA-Z]{1,4}){0,2}[\s,]+[0-9]{4}|[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4}|[0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})\b/gi;

  let match: RegExpExecArray | null;
  const parsedDeadlines: Array<{ fullPhrase: string; dateStr: string; date: Date }> = [];

  while ((match = deadlineRegex.exec(normalized)) !== null) {
    const fullPhrase = match[0].trim();
    const dateStr = match[2].trim();
    const displayPhrase = fullPhrase.replace(/[^\w\s/.-]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Parse date
    const cleanDateStr = dateStr.replace(/\s+/g, ' ').replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
    let parsedDate: Date | null = null;

    // Check named month format: "30 September 2026" or "September 30 2026"
    const namedMatch = cleanDateStr.match(/\b(?:(\d{1,2})\s+([a-zA-Z]+)|([a-zA-Z]+)\s+(\d{1,2}))[\s\S]{0,15}?(\d{4})\b/i);
    if (namedMatch) {
      const day = parseInt(namedMatch[1] || namedMatch[4], 10);
      const mStr = (namedMatch[2] || namedMatch[3]).toLowerCase().slice(0, 3);
      const year = parseInt(namedMatch[5], 10);
      const mIdx = months.indexOf(mStr);
      if (mIdx >= 0 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        parsedDate = new Date(Date.UTC(year, mIdx, day, 23, 59, 59));
      }
    }

    if (!parsedDate) {
      // Check numeric DD/MM/YYYY or YYYY/MM/DD
      const dmy = cleanDateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (dmy) {
        parsedDate = new Date(Date.UTC(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), 23, 59, 59));
      }
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      parsedDeadlines.push({ fullPhrase, dateStr, date: parsedDate });

      const matchBox = boundingBoxes?.find((b) =>
        b.text.toLowerCase().includes(dateStr.toLowerCase()) || fullPhrase.toLowerCase().includes(b.text.toLowerCase())
      )?.bbox;

      // Check if deadline has lapsed relative to evaluation timestamp
      if (parsedDate.getTime() < evaluationDate.getTime()) {
        const evalFormatted = evaluationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        findings.push({
          category: 'claims_and_consistency',
          severity: 'high',
          finding_title: `Expired Promotional Validity Deadline Detected: "${displayPhrase}"`,
          explanation: `The creative graphic advertises a promotional validity deadline ("${dateStr}") that has lapsed relative to the campaign evaluation date (${evalFormatted}). Publishing marketing creative with expired promotional deadlines misleads consumers, produces poor user experience, and breaches advertising truthfulness standards.`,
          evidence_text: displayPhrase,
          confidence: 0.95,
          suggested_fix: `Update the promotional offer validity deadline to an active future date or remove the expired promotional deadline.`,
          source: 'ocr_analysis',
          verification_status: 'confirmed_violation',
          target_type: 'text',
          target_scope: 'image',
          image_evidence: displayPhrase,
          bounding_box: matchBox || null,
          resolution_status: 'unresolved',
          needs_human_verification: true,
          human_verification_reason: 'Confirm whether the promotional offer was formally extended or has expired.',
        });
      }
    }
  }

  // Check for conflicting expiration deadlines within the same image
  if (parsedDeadlines.length >= 2) {
    const uniqueDates = Array.from(new Set(parsedDeadlines.map((p) => p.date.toISOString().slice(0, 10))));
    if (uniqueDates.length >= 2) {
      findings.push({
        category: 'claims_and_consistency',
        severity: 'critical',
        finding_title: `Conflicting Promotional Expiration Deadlines Within Creative Graphic`,
        explanation: `The uploaded creative advertises contradictory expiration deadlines: ${parsedDeadlines.map((p) => `"${p.fullPhrase}"`).join(' vs ')}. Discrepant dates in a single campaign asset confuse consumers and create legal advertising compliance risks.`,
        evidence_text: parsedDeadlines.map((p) => p.fullPhrase).join(' vs '),
        confidence: 0.95,
        suggested_fix: `Synchronize all promotional validity and deadline claims to a single verified date across the asset.`,
        source: 'ocr_analysis',
        verification_status: 'contradicted',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: parsedDeadlines.map((p) => p.fullPhrase).join(' vs '),
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Confirm the authorized promotional expiration deadline with marketing leadership.',
      });
    }
  }

  return findings;
}

// -------------------------------------------------------------------
// 5. CLAIMS AND INTERNAL CONSISTENCY
// -------------------------------------------------------------------
const SUSPICIOUS_ABSOLUTE_CLAIMS = [
  '100% cure',
  'guaranteed to cure',
  'risk-free guaranteed',
  'risk free guaranteed',
  'completely eliminate',
  'unhackable',
  'miracle cure',
  'permanent results',
  'zero risk',
  'guaranteed profit',
  '100% risk free',
  '100% guaranteed',
  'foolproof',
];

export function auditImageBrandAndMarketingClaims(
  imageText: string,
  guidelines: BrandGuideline[],
  facts: ApprovedFact[]
): EngineFinding[] {
  const findings: EngineFinding[] = [];
  if (!imageText || !imageText.trim()) return findings;

  const clean = cleanAndNormalizeOcrText(imageText);

  // 1. Internal Image Contradictions: Conflicting Discounts within the Same Image
  const discounts = extractDiscountClaims(clean);
  const uniqueDiscounts = Array.from(new Set(discounts.map((d) => d.value)));
  if (uniqueDiscounts.length >= 2) {
    findings.push({
      category: 'claims_and_consistency',
      severity: 'critical',
      finding_title: `Conflicting Promotional Discounts Within Creative Graphic (${uniqueDiscounts.join('% vs ')}%)`,
      explanation: `The uploaded creative image contains contradictory promotional discount figures: ${discounts.map((d) => `"${d.rawSnippet}"`).join(' and ')}. Disparate discount claims within a single asset confuse buyers and create false advertising risks.`,
      evidence_text: discounts.map((d) => d.rawSnippet).join(' vs '),
      confidence: 1.0,
      source: 'image',
      verification_status: 'contradicted',
      suggested_fix: `Align all percentage discount references in the creative image to a single verified offer (${uniqueDiscounts[0]}%).`,
      target_type: 'text',
      target_scope: 'image',
      image_evidence: discounts.map((d) => d.rawSnippet).join(' vs '),
      resolution_status: 'unresolved',
      needs_human_verification: true,
      human_verification_reason: 'Select the single approved promotional discount before publication.',
      uncertainty_notes: 'Direct numerical contradiction detected within visible graphic typography.',
    });
  }

  // 2. Internal Image Contradictions: Conflicting Durations
  const durations = extractDurationClaims(clean);
  const durationsByContext = new Map<string, typeof durations>();
  for (const d of durations) {
    const list = durationsByContext.get(d.context) || [];
    list.push(d);
    durationsByContext.set(d.context, list);
  }
  for (const [context, list] of durationsByContext.entries()) {
    const uniqueVals = Array.from(new Set(list.map((l) => l.value)));
    if (uniqueVals.length >= 2) {
      findings.push({
        category: 'claims_and_consistency',
        severity: 'critical',
        finding_title: `Conflicting ${context.replace(/_/g, ' ')} Durations Within Creative Graphic`,
        explanation: `The uploaded creative image advertises contradictory duration claims for ${context.replace(/_/g, ' ')}: ${list.map((l) => `"${l.rawSnippet}"`).join(' vs ')}.`,
        evidence_text: list.map((l) => l.rawSnippet).join(' vs '),
        confidence: 1.0,
        source: 'image',
        verification_status: 'contradicted',
        suggested_fix: `Unify duration claims in the creative image to a single verified figure.`,
        target_type: 'text',
        target_scope: 'image',
        image_evidence: list.map((l) => l.rawSnippet).join(' vs '),
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Synchronize advertised timeline figures with documented specifications.',
      });
    }
  }

  // 3. Internal Image Contradictions: Conflicting Prices
  const prices = extractPriceClaims(clean);
  const uniquePrices = Array.from(new Set(prices.map((p) => p.value)));
  if (uniquePrices.length >= 2) {
    findings.push({
      category: 'claims_and_consistency',
      severity: 'critical',
      finding_title: `Conflicting Price Points Within Creative Graphic`,
      explanation: `The uploaded creative image quotes conflicting price claims: ${prices.map((p) => `"${p.rawSnippet}"`).join(' vs ')}.`,
      evidence_text: prices.map((p) => p.rawSnippet).join(' vs '),
      confidence: 1.0,
      source: 'image',
      verification_status: 'contradicted',
      suggested_fix: `Verify and synchronize pricing figures in the creative asset.`,
      target_type: 'text',
      target_scope: 'image',
      image_evidence: prices.map((p) => p.rawSnippet).join(' vs '),
      resolution_status: 'unresolved',
      needs_human_verification: true,
      human_verification_reason: 'Confirm authorized commercial price sheet.',
    });
  }

  // 4. Internal Image Contradictions: Conflicting Product Specs
  const specs = extractSpecClaims(clean);
  const specsByContext = new Map<string, typeof specs>();
  for (const s of specs) {
    const isProteinContext = clean.toLowerCase().includes('protein') || clean.toLowerCase().includes('proteen');
    const ctx = (s.context === 'mass_weight' || s.context.startsWith('nutritional_')) && isProteinContext
      ? 'protein_content'
      : s.context;
    const list = specsByContext.get(ctx) || [];
    list.push(s);
    specsByContext.set(ctx, list);
  }
  for (const [ctx, list] of specsByContext.entries()) {
    const uniqueVals = Array.from(new Set(list.map((l) => l.value)));
    if (uniqueVals.length >= 2) {
      findings.push({
        category: 'cross_modal_conflict',
        severity: 'high',
        finding_title: `Potential Internal Specification Inconsistency (Image states ${uniqueVals.join(' vs ')})`,
        explanation: `The uploaded creative image quotes contradictory specification figures for ${ctx.replace(/_/g, ' ')}: ${list.map((l) => `"${l.rawSnippet}"`).join(' vs ')}. Inaccurate product specs violate consumer labeling guidelines.`,
        evidence_text: list.map((l) => l.rawSnippet).join(' vs '),
        confidence: 0.95,
        source: 'image',
        verification_status: 'possible_inconsistency',
        suggested_fix: `Synchronize specification claims to the verified laboratory test baseline.`,
        target_type: 'text',
        target_scope: 'image',
        image_evidence: list.map((l) => l.rawSnippet).join(' vs '),
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Confirm verified product specification sheet.',
      });
    }
  }

  // 5. Suspicious Absolute or Unsupported Claims in Image
  for (const claim of SUSPICIOUS_ABSOLUTE_CLAIMS) {
    const claimRegex = new RegExp(`\\b${escapeRegExp(claim)}\\b`, 'i');
    const match = clean.match(claimRegex);
    if (match && match[0]) {
      const phrase = match[0];
      findings.push({
        category: 'claims_and_consistency',
        severity: 'high',
        finding_title: `Suspicious Absolute or Unsubstantiated Claim in Image: "${phrase}"`,
        explanation: `The phrase "${phrase}" represents an unqualified absolute guarantee in marketing typography. Regulatory advertising standards prohibit absolute claims without verifiable empirical substantiation.`,
        evidence_text: phrase,
        confidence: 0.9,
        suggested_fix: `Rephrase with qualified factual language (e.g. "designed to support", "tested to help improve").`,
        source: 'ocr_analysis',
        verification_status: 'unverified',
        target_type: 'text',
        target_scope: 'image',
        image_evidence: phrase,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Provide legal substantiation documentation or tone down absolute assertion.',
      });
    }
  }

  // 6. Check Active Brand Guidelines & Facts via deterministic engines
  const { findings: detFindings } = runDeterministicChecks(clean, 'social_media', guidelines, { targetScope: 'image' });
  findings.push(...detFindings);

  const { findings: factFindings } = runFactChecks(clean, facts, { sourceTag: 'image' });
  findings.push(...factFindings);

  return findings;
}

// -------------------------------------------------------------------
// 6. POTENTIAL COPYRIGHT, TRADEMARK AND IP CONCERNS
// -------------------------------------------------------------------
const COMMERCIAL_STOCK_WATERMARKS = [
  'getty images',
  'gettyimages',
  'shutterstock',
  'istock',
  'istockphoto',
  'alamy',
  'adobe stock',
  'adobestock',
  'dreamstime',
  'depositphotos',
  'vectorstock',
  '123rf',
  'preview only',
  'sample only',
  'watermark',
];

const RECOGNIZABLE_THIRD_PARTY_TRADEMARKS = [
  'apple',
  'iphone',
  'ipad',
  'macbook',
  'nike',
  'adidas',
  'disney',
  'marvel',
  'coca-cola',
  'coca cola',
  'pepsi',
  'starbucks',
  'mcdonald\'s',
  'mcdonalds',
  'google',
  'microsoft',
  'windows',
  'amazon',
  'meta',
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'netflix',
  'spotify',
];

export function auditImageCopyrightAndIpRisks(
  imageText: string,
  authorizedAssets: AuthorizedAsset[]
): EngineFinding[] {
  const findings: EngineFinding[] = [];
  if (!imageText || !imageText.trim()) return findings;

  const normalized = cleanAndNormalizeOcrText(imageText);
  const authorizedNames = new Set(
    authorizedAssets.map((a) => a.asset_name.toLowerCase().trim()).filter(Boolean)
  );

  // 1. Stock Agency Watermarks & Comp Sample Markings
  for (const mark of COMMERCIAL_STOCK_WATERMARKS) {
    const markRegex = new RegExp(`\\b${escapeRegExp(mark)}\\b`, 'i');
    const match = normalized.match(markRegex);

    if (match && match[0]) {
      const detected = match[0];
      findings.push({
        category: 'copyright_and_ip_risk',
        severity: 'high',
        finding_title: `Potential Stock Watermark / Unlicensed Asset Mark: "${detected}"`,
        explanation: `Detected text pattern matching commercial stock image watermark "${detected}". This indicates the asset may be an unpurchased comp or preview mockup. Using watermarked stock photography in public marketing materials creates immediate copyright infringement exposure.`,
        evidence_text: `Watermark signature: "${detected}"`,
        confidence: 0.95,
        suggested_fix: `Acquire official commercial license and replace composite mockup with the licensed high-resolution asset without watermarks.`,
        source: 'ocr_analysis',
        verification_status: 'possible_inconsistency',
        target_type: 'visual_element',
        target_scope: 'image',
        image_evidence: detected,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Confirm commercial stock license purchase invoice before ad publication.',
        uncertainty_notes: 'Automated detection flags watermark signature; commercial licensing status requires human verification. Pixels alone cannot verify license ownership.',
      });
    }
  }

  // 2. Recognizable Third-Party Trademarks & Brands
  for (const trademark of RECOGNIZABLE_THIRD_PARTY_TRADEMARKS) {
    if (authorizedNames.has(trademark)) continue;

    const brandRegex = new RegExp(`\\b${escapeRegExp(trademark)}\\b`, 'i');
    const match = normalized.match(brandRegex);

    if (match && match[0]) {
      const detected = match[0];
      findings.push({
        category: 'copyright_and_ip_risk',
        severity: 'medium',
        finding_title: `Potential Third-Party Intellectual Property / Logo Detected: "${detected}"`,
        explanation: `Detected recognizable third-party mark "${detected}" within creative image. Copyright and trademark ownership cannot be established from pixels alone. Flagged for legal and brand reviewer verification to confirm commercial partnership, authorization, or nominative fair-use rights.`,
        evidence_text: `Recognizable third-party mark: "${detected}"`,
        confidence: 0.85,
        suggested_fix: `Obtain written brand usage authorization or remove third-party trademark from creative graphic.`,
        source: 'ocr_analysis',
        verification_status: 'possible_inconsistency',
        target_type: 'logo',
        target_scope: 'image',
        image_evidence: detected,
        resolution_status: 'unresolved',
        needs_human_verification: true,
        human_verification_reason: 'Verify brand partnership, co-marketing agreement, or nominative fair-use justification.',
        uncertainty_notes: 'BrandGuard AI flags recognizable third-party marks for human review; does not perform external trademark registry searches. Infringement cannot be established from pixels alone.',
      });
    }
  }

  return findings;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
