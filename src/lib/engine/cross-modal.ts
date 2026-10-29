import { EngineFinding } from './types';
import { cleanAndNormalizeOcrText } from './vision-analyzer';

export interface ExtractedMetric {
  type: 'duration' | 'percentage' | 'price' | 'warranty' | 'specification' | 'date';
  context: string;
  value: number | string;
  unit?: string;
  servingContext?: string;
  rawSnippet: string;
}

const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function normalizeNumberOrWord(val: string): string {
  const lower = val.toLowerCase().trim();
  if (WORD_TO_NUM[lower] !== undefined) {
    return String(WORD_TO_NUM[lower]);
  }
  return lower;
}

/**
 * Extracts duration claims (e.g., cooling duration, battery life, turnaround, shipping, trial period)
 * Robust to line breaks, hyphens, and OCR noise between claims.
 */
export function extractDurationClaims(text: string): ExtractedMetric[] {
  if (!text) return [];
  const norm = cleanAndNormalizeOcrText(text);
  const metrics: ExtractedMetric[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: Temperature / Cooling retention (multiline bridging up to 120 chars)
  // e.g. "Keeps Drinks Cold — For up to 48 hours", "Keep your drinks cold for 24 hours", "[ Keeps Drinks Cold\na 3 x For up to 48 hours"
  const coolingPattern = /(?:keeps?\s+(?:(?:\w+\s+){0,3})cold|cold\s+retention|cooling|hot\s+retention|keeps?\s+hot|chill(?:ed)?|ice\s+retention)[\s\S]{0,120}?(?:for\s+)?(?:up\s+to\s+)?(\d+)\s*(?:hours?|hrs?|h\b|days?)/gi;
  while ((match = coolingPattern.exec(norm)) !== null) {
    const hours = parseInt(match[1], 10);
    if (!metrics.some((m) => m.context === 'temperature_retention' && m.value === hours)) {
      metrics.push({
        type: 'duration',
        context: 'temperature_retention',
        value: hours,
        unit: 'hours',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 2: Reverse cooling (e.g. "48 hours cold", "for up to 48 hours ... cold")
  const reverseCooling = /(?:for\s+)?(?:up\s+to\s+)?(\d+)\s*(?:hours?|hrs?|h\b)[\s\S]{0,80}?(?:cold|cooling|temperature|chill|ice|hot)/gi;
  while ((match = reverseCooling.exec(norm)) !== null) {
    const hours = parseInt(match[1], 10);
    if (!metrics.some((m) => m.context === 'temperature_retention' && m.value === hours)) {
      metrics.push({
        type: 'duration',
        context: 'temperature_retention',
        value: hours,
        unit: 'hours',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 3: Battery Life & Runtime (e.g. "40 hours battery life", "battery lasts 24 hrs", "10 days runtime")
  const batteryPattern1 = /(?:battery(?:\s+life)?|runtime|playtime|operating\s+time|listening\s+time)[\s\S]{0,80}?(\d+)\s*(hours?|hrs?|h\b|days?)/gi;
  while ((match = batteryPattern1.exec(norm)) !== null) {
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().startsWith('day') ? 'days' : 'hours';
    metrics.push({
      type: 'duration',
      context: 'battery_life',
      value: val,
      unit,
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  const batteryPattern2 = /(\d+)\s*(hours?|hrs?|h\b|days?)[\s\S]{0,80}?(?:battery(?:\s+life)?|runtime|playtime|listening\s+time)/gi;
  while ((match = batteryPattern2.exec(norm)) !== null) {
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().startsWith('day') ? 'days' : 'hours';
    if (!metrics.some((m) => m.context === 'battery_life' && m.value === val)) {
      metrics.push({
        type: 'duration',
        context: 'battery_life',
        value: val,
        unit,
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 4: Delivery, Shipping & Turnaround (e.g. "2-day delivery", "delivered in 5 days", "Fast 2-day turnaround")
  const shippingPattern1 = /(?:deliver(?:y|ed)?|shipp(?:ing|ed)?|arrival|dispatch|turnaround)[\s\S]{0,80}?(\d+)\s*(hours?|hrs?|days?|business\s+days?)/gi;
  while ((match = shippingPattern1.exec(norm)) !== null) {
    metrics.push({
      type: 'duration',
      context: 'shipping_turnaround',
      value: parseInt(match[1], 10),
      unit: match[2].toLowerCase().includes('hour') ? 'hours' : 'days',
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  const shippingPattern2 = /(\d+)[-\s]*(hours?|hrs?|days?|business\s+days?)[\s\S]{0,50}?(?:deliver(?:y|ed)?|shipp(?:ing|ed)?|arrival|dispatch|turnaround|payouts?)/gi;
  while ((match = shippingPattern2.exec(norm)) !== null) {
    const val = parseInt(match[1], 10);
    if (!metrics.some((m) => m.context === 'shipping_turnaround' && m.value === val)) {
      metrics.push({
        type: 'duration',
        context: 'shipping_turnaround',
        value: val,
        unit: match[2].toLowerCase().includes('hour') ? 'hours' : 'days',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 5: Free Trial, Return Window & Evaluation Period (e.g. "14-day free trial", "60-day returns policy", "free trial for 30 days")
  const trialPattern1 = /(?:trial|money[-\s]back\s+guarantee|evaluation\s+period|returns?\s*(?:window|policy|period)?|return\s+window)[\s\S]{0,80}?(\d+)\s*(days?|weeks?|months?)/gi;
  while ((match = trialPattern1.exec(norm)) !== null) {
    metrics.push({
      type: 'duration',
      context: 'trial_period',
      value: parseInt(match[1], 10),
      unit: match[2].toLowerCase().startsWith('month') ? 'months' : 'days',
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  const trialPattern2 = /(\d+)[-\s]*(days?|weeks?|months?)[\s\S]{0,60}?(?:trial|money[-\s]back|guarantee|returns?\s*(?:window|policy|period)?)/gi;
  while ((match = trialPattern2.exec(norm)) !== null) {
    const val = parseInt(match[1], 10);
    if (!metrics.some((m) => m.context === 'trial_period' && m.value === val)) {
      metrics.push({
        type: 'duration',
        context: 'trial_period',
        value: val,
        unit: match[2].toLowerCase().startsWith('month') ? 'months' : 'days',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 6: Device / Vehicle Charging Duration (e.g. "15-minute DC charging", "charge in 45 minutes", "fast charge 30 mins")
  const chargingPattern1 = /(?:charg(?:ing|e)|supercharg(?:ing|e)|fast[-\s]*charge)[\s\S]{0,60}?(?:in\s+)?(\d+)\s*(minutes?|mins?|hours?|hrs?)/gi;
  while ((match = chargingPattern1.exec(norm)) !== null) {
    const rawVal = parseInt(match[1], 10);
    const isHours = match[2].toLowerCase().startsWith('h');
    const mins = isHours ? rawVal * 60 : rawVal;
    metrics.push({
      type: 'duration',
      context: 'charging_time',
      value: mins,
      unit: 'minutes',
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  const chargingPattern2 = /(\d+)[-\s]*(minutes?|mins?|hours?|hrs?)[\s\S]{0,60}?(?:charg(?:ing|e)|supercharg(?:ing|e))/gi;
  while ((match = chargingPattern2.exec(norm)) !== null) {
    const rawVal = parseInt(match[1], 10);
    const isHours = match[2].toLowerCase().startsWith('h');
    const mins = isHours ? rawVal * 60 : rawVal;
    if (!metrics.some((m) => m.context === 'charging_time' && m.value === mins)) {
      metrics.push({
        type: 'duration',
        context: 'charging_time',
        value: mins,
        unit: 'minutes',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return metrics;
}

/**
 * Checks whether a percentage number is directly modifying material composition or non-promotional specs
 * (e.g. "100% recycled plastic", "50% cotton", "99.9% uptime") rather than a promotional discount.
 */
function isMaterialOrSpecificationPercent(text: string, percentVal: number): boolean {
  const directPattern = new RegExp(
    `(?:recycled|recyclable|cotton|plastic|uptime|organic|sustainable|natural|pure|carbon|renewable|post-consumer|availability|wool|polyester|silk|sla|sugar|fiber|fat|carbs)\\s*[:\\s]*${percentVal}\\s*%|${percentVal}\\s*%\\s*(?:recycled|recyclable|cotton|plastic|uptime|organic|sustainable|natural|pure|carbon|renewable|post-consumer|availability|wool|polyester|silk|sla|sugar|fiber|fat|carbs)`,
    'i'
  );
  return directPattern.test(text);
}

/**
 * Extracts promotional discounts and percentage claims.
 * Robust to OCR line breaks, reverse word order, and excludes non-promotional material claims.
 */
export function extractDiscountClaims(text: string): ExtractedMetric[] {
  if (!text) return [];
  const norm = cleanAndNormalizeOcrText(text);
  const metrics: ExtractedMetric[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: Standard promotional discount (e.g. "FLAT 50% OFF", "50% OFF", "exclusive 80% discount", "save 30%")
  const p1 = /(?:flat\s+|exclusive\s+|special\s+|limited\s+time\s+|save\s+|saving\s+|get\s+an?\s+|up\s+to\s+)?(\d{1,2}(?:\.\d+)?)\s*%\s*(?:off|discount|sale|savings?)/gi;
  while ((match = p1.exec(norm)) !== null) {
    const val = parseFloat(match[1]);
    if (val > 0 && val < 100 && !isMaterialOrSpecificationPercent(norm, val)) {
      if (!metrics.some((m) => m.value === val)) {
        metrics.push({
          type: 'percentage',
          context: 'promotional_discount',
          value: val,
          unit: '%',
          rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }

  // Pattern 2: Reverse order (e.g. "save 30%" or "discount of 20%")
  const p2 = /(?:flat|exclusive|save|saving|off|discount|sale|promo|promotion|deal)(?:[^\n]{0,40}(?:\n[^\n]{0,40})?)??\s*(\d{1,2}(?:\.\d+)?)\s*%/gi;
  while ((match = p2.exec(norm)) !== null) {
    const val = parseFloat(match[1]);
    if (val >= (match[0].toLowerCase().includes('off') || match[0].toLowerCase().includes('save') ? 5 : 10) && val < 100 && !isMaterialOrSpecificationPercent(norm, val) && !metrics.some((m) => m.value === val)) {
      metrics.push({
        type: 'percentage',
        context: 'promotional_discount',
        value: val,
        unit: '%',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 3: Percentage followed by off/discount/deal within same or adjacent line
  const p3 = /(\d{1,2}(?:\.\d+)?)\s*%(?:[^\n]{0,40}(?:\n[^\n]{0,40})?)??\s*(?:off|discount|sale|savings?|deal|limited\s+time|promo)\b/gi;
  while ((match = p3.exec(norm)) !== null) {
    const val = parseFloat(match[1]);
    if (val > 0 && val < 100 && !isMaterialOrSpecificationPercent(norm, val) && !metrics.some((m) => m.value === val)) {
      metrics.push({
        type: 'percentage',
        context: 'promotional_discount',
        value: val,
        unit: '%',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 4: Standalone "FLAT X%" or "SAVE X%"
  const p4 = /\b(?:flat|save)\s+(\d{1,2}(?:\.\d+)?)\s*%/gi;
  while ((match = p4.exec(norm)) !== null) {
    const val = parseFloat(match[1]);
    if (val > 0 && val < 100 && !isMaterialOrSpecificationPercent(norm, val) && !metrics.some((m) => m.value === val)) {
      metrics.push({
        type: 'percentage',
        context: 'promotional_discount',
        value: val,
        unit: '%',
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Pattern 5: Contextual promotional discount (when text contains promotional terms, or standalone percentage badges)
  const hasPromoContext = /\b(?:off|discount|sale|savings?|save|deal|promo|promotion|limited|flat|special|shop|get|order|buy|only)\b/i.test(norm);
  if (hasPromoContext) {
    const p5 = /\b([1-9]\d(?:\.\d+)?)\s*%/gi;
    while ((match = p5.exec(norm)) !== null) {
      const val = parseFloat(match[1]);
      if (val >= 5 && val <= 95 && !isMaterialOrSpecificationPercent(norm, val)) {
        if (!metrics.some((m) => m.value === val)) {
          metrics.push({
            type: 'percentage',
            context: 'promotional_discount',
            value: val,
            unit: '%',
            rawSnippet: `${val}%`,
          });
        }
      }
    }
  }

  return metrics;
}

/**
 * Extracts pricing and currency amounts (e.g. "$49", "$99.99", "EUR 120", "₹499")
 */
export function extractPriceClaims(text: string): ExtractedMetric[] {
  if (!text) return [];
  const norm = cleanAndNormalizeOcrText(text);
  const metrics: ExtractedMetric[] = [];
  const pricePattern = /(?:\$|€|£|₹|USD\s*|EUR\s*|INR\s*|GBP\s*)(\d+(?:,\d+)*(?:\.\d{2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = pricePattern.exec(norm)) !== null) {
    const numericStr = match[1].replace(/,/g, '');
    const num = parseFloat(numericStr);
    if (!isNaN(num) && num > 0) {
      metrics.push({
        type: 'price',
        context: 'price_point',
        value: num,
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return metrics;
}

/**
 * Extracts warranty and guarantee terms (e.g. "5-year warranty", "five-year warranty", "lifetime warranty")
 * Robust to hyphenation ("5-year"), word numbers ("five"), and reverse phrasing ("warranty of 5 years").
 */
export function extractWarrantyClaims(text: string): ExtractedMetric[] {
  if (!text) return [];
  const norm = cleanAndNormalizeOcrText(text);
  const metrics: ExtractedMetric[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: e.g. "Lifetime warranty", "5-year warranty", "8-year battery warranty", "five-year warranty"
  const p1 = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|lifetime)[-\s]*(years?|yrs?|months?|days?)?\s*(?:of\s+)?(?:(?:\w+\s+){0,2})(?:warranty|guarantee|war\w+)\b/gi;
  while ((match = p1.exec(norm)) !== null) {
    const normVal = normalizeNumberOrWord(match[1]);
    metrics.push({
      type: 'warranty',
      context: 'product_warranty',
      value: normVal,
      unit: match[2]?.toLowerCase() || (normVal === 'lifetime' ? '' : 'years'),
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  // Pattern 2: Reverse phrasing e.g. "warranty of 5 years", "warranty: lifetime"
  const p2 = /\b(?:warranty|guarantee|war\w+)\s*(?:of|for|:)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|lifetime)[-\s]*(years?|yrs?|months?|days?)?\b/gi;
  while ((match = p2.exec(norm)) !== null) {
    const normVal = normalizeNumberOrWord(match[1]);
    if (!metrics.some((m) => m.value === normVal)) {
      metrics.push({
        type: 'warranty',
        context: 'product_warranty',
        value: normVal,
        unit: match[2]?.toLowerCase() || (normVal === 'lifetime' ? '' : 'years'),
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return metrics;
}

/**
 * Extracts technical product specifications (e.g. RAM, storage, volume, wattage)
 */
export function extractSpecClaims(text: string): ExtractedMetric[] {
  if (!text) return [];
  const norm = cleanAndNormalizeOcrText(text);
  const metrics: ExtractedMetric[] = [];
  let match: RegExpExecArray | null;

  // Volume/Capacity (e.g. "500ml", "750 ml", "1.5L", "32 oz")
  const volumePattern = /\b(\d+(?:\.\d+)?)\s*(ml|liters?|litres?|l\b|oz|ounces?|gallons?)\b/gi;
  while ((match = volumePattern.exec(norm)) !== null) {
    const rawUnit = match[2].toLowerCase();
    let val = parseFloat(match[1]);
    let normUnit = rawUnit;
    if (['l', 'liter', 'liters', 'litre', 'litres'].includes(rawUnit)) {
      val = Math.round(val * 1000);
      normUnit = 'ml';
    }
    metrics.push({
      type: 'specification',
      context: 'volume_capacity',
      value: val,
      unit: normUnit,
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  // Memory (RAM) vs Storage (SSD/Drive)
  const storagePattern = /\b(\d+)\s*(GB|TB|MB)\s*(RAM|SSD|Storage|Memory|Drive|ROM)?\b/gi;
  while ((match = storagePattern.exec(norm)) !== null) {
    const rawContext = match[3]?.toUpperCase();
    const isMemory = rawContext === 'RAM' || rawContext === 'MEMORY';
    metrics.push({
      type: 'specification',
      context: isMemory ? 'digital_memory' : 'digital_storage',
      value: parseInt(match[1], 10),
      unit: match[2].toUpperCase(),
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  // Electrical Power / Charging (e.g. "65W fast charging", "100W PD", "45 watts")
  const powerPattern = /\b(\d+)\s*(?:W\b|watts?)\b/gi;
  while ((match = powerPattern.exec(norm)) !== null) {
    metrics.push({
      type: 'specification',
      context: 'electrical_power',
      value: parseInt(match[1], 10),
      unit: 'W',
      rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
    });
  }

  // Range (e.g. "520 miles range", "350 miles of range", "600 km range")
  const rangePattern = /\b(\d+)\s*(miles?|mi\b|km|kilometers?)\s*(?:of\s+)?(?:range|driving\s+range)?\b/gi;
  while ((match = rangePattern.exec(norm)) !== null) {
    if (norm.toLowerCase().includes('range')) {
      const rawUnit = match[2].toLowerCase();
      const normUnit = rawUnit.startsWith('k') ? 'km' : 'miles';
      metrics.push({
        type: 'specification',
        context: 'vehicle_range',
        value: parseInt(match[1], 10),
        unit: normUnit,
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Helper to extract serving size qualification immediately around a matched metric
  const findServingContext = (index: number, matchLen: number): string | undefined => {
    // Check immediately following the match (e.g. "20g protein per bar")
    const after = norm.slice(index + matchLen, index + matchLen + 40);
    const afterMatch = after.match(/^\s*(?:per|in|for)\s+(?:a\s+|an\s+|each\s+|every\s+|one\s+|1\s+)?(serving|bar|portion|bottle|container|pack|package|100g|can|scoop|piece|2\s+bars?|two\s+bars?|[1-9]\d*\s*(?:bars?|servings?|pieces?|portions?|scoops?|g\b|grams?|ml\b|oz\b))/i);
    if (afterMatch) return afterMatch[0].toLowerCase().trim();

    // Check immediately preceding the match (e.g. "per serving: 20g protein")
    const before = norm.slice(Math.max(0, index - 35), index);
    const beforeMatch = before.match(/\b(?:per|in|for)\s+(?:a\s+|an\s+|each\s+|every\s+|one\s+|1\s+)?(serving|bar|portion|bottle|container|pack|package|100g|can|scoop|piece|2\s+bars?|two\s+bars?)\s*$/i);
    if (beforeMatch) return beforeMatch[0].toLowerCase().trim();

    return undefined;
  };

  // Mass / Weight / Nutritional Specification (e.g. "20g protein", "20g", "30 grams", "500g", "1.5 kg", "2 lbs")
  const massPattern = /\b(\d+(?:\.\d+)?)\s*(g\b|grams?|kg\b|kilograms?|lbs?|pounds?)(?:\s+(?:of\s+)?(protein|sugar|fiber|fat|carbs|carbohydrates|sodium|mass|weight))?/gi;
  while ((match = massPattern.exec(norm)) !== null) {
    const rawVal = parseFloat(match[1]);
    const rawUnit = match[2].toLowerCase();
    let nutrient = match[3] ? match[3].toLowerCase() : null;
    let normVal = rawVal;
    const normUnit = 'g';
    if (rawUnit.startsWith('k')) {
      normVal = rawVal * 1000;
    } else if (rawUnit.startsWith('lb') || rawUnit.startsWith('pound')) {
      normVal = Math.round(rawVal * 453.592);
    }
    // Check surrounding text (within 50 chars) if nutrient was omitted but creative discusses protein/nutrition
    if (!nutrient) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(norm.length, match.index + match[0].length + 50);
      const windowSnippet = norm.slice(start, end).toLowerCase();
      if (/\b(?:protein|proteen|protean)\b/.test(windowSnippet)) {
        nutrient = 'protein';
      }
    }
    const context = nutrient ? `nutritional_${nutrient}` : 'mass_weight';
    const servingContext = findServingContext(match.index, match[0].length);

    if (!metrics.some((m) => m.context === context && m.value === normVal && m.servingContext === servingContext)) {
      metrics.push({
        type: 'specification',
        context,
        value: normVal,
        unit: normUnit,
        servingContext,
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  // Reverse Nutritional phrasing (e.g. "Protein: 20g", "Protein 40g")
  const revPattern = /\b(protein|sugar|fiber|fat|carbs|carbohydrates|sodium)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(g\b|grams?)\b/gi;
  while ((match = revPattern.exec(norm)) !== null) {
    const nutrient = match[1].toLowerCase();
    const val = parseFloat(match[2]);
    const context = `nutritional_${nutrient}`;
    const servingContext = findServingContext(match.index, match[0].length);
    if (!metrics.some((m) => m.context === context && m.value === val)) {
      metrics.push({
        type: 'specification',
        context,
        value: val,
        unit: 'g',
        servingContext,
        rawSnippet: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return metrics;
}

function formatWarrantyLabel(metric: ExtractedMetric): string {
  if (metric.value === 'lifetime') return 'Lifetime warranty';
  const unit = metric.unit ? metric.unit : 'years';
  return `${metric.value}-${unit} warranty`;
}

/**
 * Cross-Modal Consistency Engine:
 * Analyzes both image OCR text and caption, comparing corresponding claims,
 * numerical values, durations, discounts, warranties, and specifications for contradictions.
 */
export function runCrossModalChecks(
  imageText: string,
  captionText: string
): { findings: EngineFinding[] } {
  const findings: EngineFinding[] = [];

  const cleanImageText = cleanAndNormalizeOcrText(imageText || '');
  const cleanCaptionText = cleanAndNormalizeOcrText(captionText || '');

  // Cross-modal checks require both modalities to be present
  if (!cleanImageText || !cleanCaptionText) {
    return { findings };
  }

  // 1. Duration & Turnaround Consistency Check
  const imageDurations = extractDurationClaims(cleanImageText);
  const captionDurations = extractDurationClaims(cleanCaptionText);

  for (const imgDur of imageDurations) {
    const matchingCap = captionDurations.find(
      (c) => c.context === imgDur.context && c.unit === imgDur.unit
    );

    if (matchingCap && matchingCap.value !== imgDur.value) {
      const isCooling = imgDur.context === 'temperature_retention';
      const title = isCooling
        ? `Conflicting Cooling Duration (Image: ${imgDur.value}h vs Caption: ${matchingCap.value}h)`
        : `Contradictory Duration Claim (${imgDur.context.replace(/_/g, ' ')}: Image states ${imgDur.value} ${imgDur.unit} vs Caption states ${matchingCap.value} ${matchingCap.unit})`;

      findings.push({
        category: 'cross_modal_conflict',
        severity: 'critical',
        finding_title: title,
        explanation: `The marketing creative image specifies ${imgDur.value} ${imgDur.unit} ("${imgDur.rawSnippet}"), whereas the accompanying caption claims ${matchingCap.value} ${matchingCap.unit} ("${matchingCap.rawSnippet}"). Cross-modal claims must be identical and corroborated by verified specifications.`,
        evidence_text: `Image specifies ${imgDur.value} ${imgDur.unit} ("${imgDur.rawSnippet}") vs Caption claims ${matchingCap.value} ${matchingCap.unit} ("${matchingCap.rawSnippet}")`,
        confidence: 1.0,
        source: 'cross_modal',
        verification_status: 'contradicted',
        suggested_fix: `Align caption to match creative image (${imgDur.value} ${imgDur.unit}), or update the creative asset to reflect substantiated claims (${matchingCap.value} ${matchingCap.unit}).`,
        target_type: 'text',
        target_scope: 'both',
        caption_evidence: `${matchingCap.value} ${matchingCap.unit}`,
        image_evidence: `${imgDur.value} ${imgDur.unit}`,
        proposed_replacement: `${imgDur.value} ${imgDur.unit}`,
        resolution_status: 'unresolved',
      });
    }
  }

  // 2. Promotional Discount Discrepancy Check
  const imageDiscounts = extractDiscountClaims(cleanImageText);
  const captionDiscounts = extractDiscountClaims(cleanCaptionText);

  if (imageDiscounts.length > 0 && captionDiscounts.length > 0) {
    for (const imgDisc of imageDiscounts) {
      for (const capDisc of captionDiscounts) {
        if (imgDisc.value !== capDisc.value) {
          const alreadyAdded = findings.some(
            (f) =>
              f.category === 'cross_modal_conflict' &&
              f.evidence_text?.includes(`${imgDisc.value}%`) &&
              f.evidence_text?.includes(`${capDisc.value}%`)
          );
          if (!alreadyAdded) {
            findings.push({
              category: 'cross_modal_conflict',
              severity: 'critical',
              finding_title: `Contradictory Promotional Discount (Image: ${imgDisc.value}% vs Caption: ${capDisc.value}%)`,
              explanation: `The promotional creative image advertises a discount of ${imgDisc.value}% ("${imgDisc.rawSnippet}"), while the post caption promises ${capDisc.value}% ("${capDisc.rawSnippet}"). Mismatched promotional pricing creates severe customer trust violations and regulatory exposure.`,
              evidence_text: `Image specifies ${imgDisc.value}% OFF ("${imgDisc.rawSnippet}") vs Caption claims ${capDisc.value}% discount ("${capDisc.rawSnippet}")`,
              confidence: 1.0,
              source: 'cross_modal',
              verification_status: 'contradicted',
              suggested_fix: `Synchronize promotional discount offers across both modalities. Update caption to ${imgDisc.value}% or revise creative graphic to ${capDisc.value}%.`,
              target_type: 'text',
              target_scope: 'both',
              caption_evidence: `${capDisc.value}%`,
              image_evidence: `${imgDisc.value}%`,
              proposed_replacement: `${imgDisc.value}%`,
              resolution_status: 'unresolved',
            });
          }
        }
      }
    }
  }

  // 3. Pricing Mismatch Check
  const imagePrices = extractPriceClaims(cleanImageText);
  const captionPrices = extractPriceClaims(cleanCaptionText);

  if (imagePrices.length > 0 && captionPrices.length > 0) {
    const imgPrice = imagePrices[0];
    const capPrice = captionPrices[0];
    if (imgPrice.value !== capPrice.value) {
      findings.push({
        category: 'cross_modal_conflict',
        severity: 'critical',
        finding_title: `Conflicting Price Claims (Image: ${imgPrice.rawSnippet} vs Caption: ${capPrice.rawSnippet})`,
        explanation: `The creative graphic advertises price ${imgPrice.rawSnippet}, whereas the accompanying post copy quotes ${capPrice.rawSnippet}. Mismatched pricing across marketing collateral is a prohibited deceptive advertising violation.`,
        evidence_text: `Image states "${imgPrice.rawSnippet}" vs Caption states "${capPrice.rawSnippet}"`,
        confidence: 1.0,
        source: 'cross_modal',
        verification_status: 'contradicted',
        suggested_fix: `Ensure price points match identically across creative and caption.`,
        target_type: 'text',
        target_scope: 'both',
        caption_evidence: capPrice.rawSnippet,
        image_evidence: imgPrice.rawSnippet,
        proposed_replacement: imgPrice.rawSnippet,
        resolution_status: 'unresolved',
      });
    }
  }

  // 4. Warranty & Guarantee Consistency
  const imageWarranties = extractWarrantyClaims(cleanImageText);
  const captionWarranties = extractWarrantyClaims(cleanCaptionText);

  if (imageWarranties.length > 0 && captionWarranties.length > 0) {
    const imgW = imageWarranties[0];
    const capW = captionWarranties[0];

    const valuesDiffer = imgW.value !== capW.value;
    const unitsDiffer = imgW.value !== 'lifetime' && capW.value !== 'lifetime' && imgW.unit && capW.unit && imgW.unit !== capW.unit;

    if (valuesDiffer || unitsDiffer) {
      const imgWLabel = formatWarrantyLabel(imgW);
      const capWLabel = formatWarrantyLabel(capW);

      findings.push({
        category: 'cross_modal_conflict',
        severity: 'critical',
        finding_title: `Contradictory Warranty Claim (Image: ${imgWLabel} vs Caption: ${capWLabel})`,
        explanation: `The marketing creative image specifies ${imgW.rawSnippet}, whereas the accompanying caption promises ${capW.rawSnippet}. Warranty terms must be consistent across visual and textual marketing materials.`,
        evidence_text: `Image specifies "${imgW.rawSnippet}" vs Caption claims "${capW.rawSnippet}"`,
        confidence: 1.0,
        source: 'cross_modal',
        verification_status: 'contradicted',
        suggested_fix: `Align warranty terms across creative image (${imgW.rawSnippet}) and caption text (${capW.rawSnippet}).`,
        target_type: 'text',
        target_scope: 'both',
        caption_evidence: capW.rawSnippet,
        image_evidence: imgW.rawSnippet,
        proposed_replacement: imgW.rawSnippet,
        resolution_status: 'unresolved',
      });
    }
  }

  // 5. Technical Specifications Consistency (e.g. Volume, Storage, Mass/Nutrient)
  const imageSpecs = extractSpecClaims(cleanImageText);
  const captionSpecs = extractSpecClaims(cleanCaptionText);

  for (const imgSpec of imageSpecs) {
    const matchingCap = captionSpecs.find(
      (c) =>
        (c.context === imgSpec.context ||
          (c.context.startsWith('nutritional_') && imgSpec.context === 'mass_weight') ||
          (imgSpec.context.startsWith('nutritional_') && c.context === 'mass_weight')) &&
        c.unit === imgSpec.unit
    );
    if (matchingCap && matchingCap.value !== imgSpec.value) {
      // If distinguishing serving contexts exist (e.g. per bar vs per 2 bars), do not call contradictory
      if (
        imgSpec.servingContext &&
        matchingCap.servingContext &&
        imgSpec.servingContext !== matchingCap.servingContext
      ) {
        continue;
      }
      const specLabel = imgSpec.context.replace(/_/g, ' ');
      findings.push({
        category: 'cross_modal_conflict',
        severity: 'critical',
        finding_title: `Conflicting Product Specification (${specLabel})`,
        explanation: `Creative image specifies ${imgSpec.value} ${imgSpec.unit} ("${imgSpec.rawSnippet}"), but caption mentions ${matchingCap.value} ${matchingCap.unit} ("${matchingCap.rawSnippet}"). Specifications must match official product records.`,
        evidence_text: `Image states "${imgSpec.rawSnippet}" vs Caption states "${matchingCap.rawSnippet}"`,
        confidence: 0.95,
        source: 'cross_modal',
        verification_status: 'contradicted',
        suggested_fix: `Align product specifications across image and post copy.`,
        target_type: 'text',
        target_scope: 'both',
        caption_evidence: matchingCap.rawSnippet,
        image_evidence: imgSpec.rawSnippet,
        proposed_replacement: `${imgSpec.value} ${imgSpec.unit}`,
        resolution_status: 'unresolved',
      });
    }
  }

  // 6. Allergen & Dietary Consistency Check (e.g. "Contains Wheat & Gluten" vs "completely gluten-free")
  const dietaryPairs: Array<{
    allergenRegex: RegExp;
    freeClaimRegex: RegExp;
    name: string;
  }> = [
    {
      allergenRegex: /\b(?:contains?\b[\s\S]{0,60}?\b)?(?:wheat|gluten)\b/i,
      freeClaimRegex: /\b(?:gluten[-\s]*free|wheat[-\s]*free|no\s+gluten|zero\s+gluten)\b/i,
      name: 'Gluten / Wheat',
    },
    {
      allergenRegex: /\bcontains?\s+(?:[a-z,\s]{0,30}?\b)?(?:dairy|milk|lactose)\b/i,
      freeClaimRegex: /\b(?:dairy[-\s]*free|lactose[-\s]*free|milk[-\s]*free)\b/i,
      name: 'Dairy / Lactose',
    },
    {
      allergenRegex: /\bcontains?\s+(?:[a-z,\s]{0,30}?\b)?(?:peanuts?|tree\s+nuts?|nuts?)\b/i,
      freeClaimRegex: /\b(?:nut[-\s]*free|peanut[-\s]*free)\b/i,
      name: 'Nuts / Allergens',
    },
    {
      allergenRegex: /\bcontains?\s+(?:[a-z,\s]{0,30}?\b)?(?:sugar)\b/i,
      freeClaimRegex: /\b(?:sugar[-\s]*free|zero\s+sugar|no\s+sugar)\b/i,
      name: 'Sugar',
    },
  ];

  for (const pair of dietaryPairs) {
    const imgHasAllergen = pair.allergenRegex.exec(cleanImageText);
    const capHasFreeClaim = pair.freeClaimRegex.exec(cleanCaptionText);
    const capHasAllergen = pair.allergenRegex.exec(cleanCaptionText);
    const imgHasFreeClaim = pair.freeClaimRegex.exec(cleanImageText);

    if ((imgHasAllergen && capHasFreeClaim) || (imgHasFreeClaim && capHasAllergen)) {
      const allergenMatch = imgHasAllergen ? imgHasAllergen[0] : capHasAllergen![0];
      const freeMatch = capHasFreeClaim ? capHasFreeClaim[0] : imgHasFreeClaim![0];
      const sourceImage = imgHasAllergen ? 'Image' : 'Caption';
      const sourceCaption = capHasFreeClaim ? 'Caption' : 'Image';

      findings.push({
        category: 'cross_modal_conflict',
        severity: 'critical',
        finding_title: `Contradictory Allergen / Dietary Claim (${pair.name})`,
        explanation: `${sourceImage} states "${allergenMatch}", but ${sourceCaption} advertises "${freeMatch}". Contradictory allergen statements present severe consumer safety and regulatory compliance risks.`,
        evidence_text: `Image "${imgHasAllergen ? allergenMatch : freeMatch}" vs Caption "${capHasFreeClaim ? freeMatch : allergenMatch}"`,
        confidence: 1.0,
        source: 'cross_modal',
        verification_status: 'contradicted',
        suggested_fix: `Align allergen disclosures and claims across creative asset and caption text. Remove "${freeMatch}" if the product contains allergens.`,
        target_type: 'text',
        target_scope: 'both',
        caption_evidence: capHasFreeClaim ? freeMatch : allergenMatch,
        image_evidence: imgHasAllergen ? allergenMatch : freeMatch,
        proposed_replacement: 'Verified Allergen Statement',
        resolution_status: 'unresolved',
      });
    }
  }

  // 7. Promotional Validity Deadline Consistency Check (e.g. image says Sept 30 vs caption says Oct 15)
  const deadlineCrossModalRegex = /\b(offer\s+valid\s+(?:till|until|through)|valid\s+(?:till|until|through)|expires?(?:\s+on)?|expiry|sale\s+ends?|deal\s+ends?|deadline)[\s\S]{0,60}?([0-9]{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:[\s,]+[a-zA-Z]{1,4}){0,2}[\s,]+[0-9]{4}|[a-zA-Z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:[\s,]+[a-zA-Z]{1,4}){0,2}[\s,]+[0-9]{4}|[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4}|[0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})\b/gi;
  const deadlineMonthsList = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const extractDeadlines = (str: string) => {
    const list: Array<{ phrase: string; dateStr: string }> = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(deadlineCrossModalRegex.source, 'gi');
    while ((m = re.exec(str)) !== null) {
      const rawDate = m[2];
      let cleanDate = rawDate.replace(/[^\w\s/.-]+/g, ' ').replace(/\s+/g, ' ').trim();
      const n1 = rawDate.match(/\b(\d{1,2}(?:st|nd|rd|th)?)\s+([a-zA-Z]{3,9})[\s\S]{0,15}?(\d{4})\b/i);
      if (n1 && deadlineMonthsList.some((mo) => n1[2].toLowerCase().startsWith(mo))) {
        cleanDate = `${n1[1]} ${n1[2]} ${n1[3]}`.trim();
      } else {
        const n2 = rawDate.match(/\b([a-zA-Z]{3,9})\s+(\d{1,2}(?:st|nd|rd|th)?)[\s\S]{0,15}?(\d{4})\b/i);
        if (n2 && deadlineMonthsList.some((mo) => n2[1].toLowerCase().startsWith(mo))) {
          cleanDate = `${n2[1]} ${n2[2]} ${n2[3]}`.trim();
        }
      }
      list.push({
        phrase: m[0].replace(/[^\w\s/.-]+/g, ' ').replace(/\s+/g, ' ').trim(),
        dateStr: cleanDate,
      });
    }
    return list;
  };

  const imgDeadlines = extractDeadlines(cleanImageText);
  const capDeadlines = extractDeadlines(cleanCaptionText);

  for (const id of imgDeadlines) {
    const conflictingCap = capDeadlines.find(
      (cd) => cd.dateStr.toLowerCase() !== id.dateStr.toLowerCase()
    );
    if (conflictingCap) {
      findings.push({
        category: 'cross_modal_conflict',
        severity: 'high',
        finding_title: `Contradictory Promotional Offer Deadline (Image: "${id.dateStr}" vs Caption: "${conflictingCap.dateStr}")`,
        explanation: `The marketing creative graphic specifies an offer validity deadline of "${id.dateStr}" ("${id.phrase}"), whereas the accompanying caption states "${conflictingCap.dateStr}" ("${conflictingCap.phrase}"). Inconsistent promotional dates confuse consumers and present advertising compliance risks.`,
        evidence_text: `Image "${id.phrase}" vs Caption "${conflictingCap.phrase}"`,
        confidence: 0.95,
        source: 'cross_modal',
        verification_status: 'contradicted',
        suggested_fix: `Align promotional offer validity deadlines between image graphic and caption copy.`,
        target_type: 'text',
        target_scope: 'both',
        image_evidence: id.phrase,
        caption_evidence: conflictingCap.phrase,
        proposed_replacement: id.dateStr,
        resolution_status: 'unresolved',
      });
    }
  }

  return { findings };
}

/**
 * Stage 1 (IMAGE-ONLY): Detects conflicting numerical claims within the creative image itself.
 */
export function checkInternalImageConflicts(imageText: string): EngineFinding[] {
  const findings: EngineFinding[] = [];
  if (!imageText || !imageText.trim()) return findings;

  const cleanText = cleanAndNormalizeOcrText(imageText);

  // 1. Conflicting discounts within the same image
  const discounts = extractDiscountClaims(cleanText);
  const uniqueDiscounts = Array.from(new Set(discounts.map((d) => d.value)));
  if (uniqueDiscounts.length >= 2) {
    findings.push({
      category: 'cross_modal_conflict',
      severity: 'critical',
      finding_title: `Conflicting Promotional Discounts Within Creative Graphic (${uniqueDiscounts.join('% vs ')}%)`,
      explanation: `The uploaded creative image contains contradictory promotional discount figures: ${discounts.map((d) => `"${d.rawSnippet}"`).join(' and ')}. Disparate discount claims within a single asset confuse buyers.`,
      evidence_text: discounts.map((d) => d.rawSnippet).join(' vs '),
      confidence: 1.0,
      source: 'image',
      verification_status: 'contradicted',
      suggested_fix: `Align all percentage discount references in the creative image to a single verified offer (${uniqueDiscounts[0]}%).`,
      target_type: 'text',
      target_scope: 'image',
      image_evidence: discounts.map((d) => d.rawSnippet).join(' vs '),
      resolution_status: 'unresolved',
    });
  }

  // 2. Conflicting durations within the same image for the same context
  const durations = extractDurationClaims(cleanText);
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
        category: 'cross_modal_conflict',
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
      });
    }
  }

  // 3. Conflicting prices within the same image
  const prices = extractPriceClaims(cleanText);
  const uniquePrices = Array.from(new Set(prices.map((p) => p.value)));
  if (uniquePrices.length >= 2) {
    findings.push({
      category: 'cross_modal_conflict',
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
    });
  }

  // 4. Conflicting product specifications or nutritional metrics within the same image
  const specs = extractSpecClaims(cleanText);
  const specsByContext = new Map<string, ExtractedMetric[]>();
  for (const s of specs) {
    const isProteinContext =
      cleanText.toLowerCase().includes('protein') || cleanText.toLowerCase().includes('proteen');
    const ctx =
      (s.context === 'mass_weight' || s.context.startsWith('nutritional_')) &&
      isProteinContext &&
      s.unit === 'g'
        ? 'nutritional_protein'
        : s.context;
    const list = specsByContext.get(ctx) || [];
    list.push(s);
    specsByContext.set(ctx, list);
  }

  for (const [context, list] of specsByContext.entries()) {
    const uniqueVals = Array.from(new Set(list.map((l) => l.value)));
    if (uniqueVals.length >= 2) {
      // Check if distinct serving contexts distinguish them
      // (e.g. "20g protein per bar" vs "40g protein per 2 bars")
      const servingContexts = list.map((l) => l.servingContext).filter(Boolean);
      const uniqueServingContexts = Array.from(new Set(servingContexts));
      const hasDistinguishingServingContext =
        uniqueServingContexts.length >= 2 &&
        uniqueServingContexts.length === uniqueVals.length;

      if (!hasDistinguishingServingContext) {
        const specLabel = context.replace(/_/g, ' ');
        findings.push({
          category: 'cross_modal_conflict',
          severity: 'high',
          finding_title: `Potential Internal Specification Inconsistency (Image states ${list.map((l) => `${l.value}${l.unit || ''}`).join(' vs ')})`,
          explanation: `The uploaded creative image advertises disparate ${specLabel} figures (${list.map((l) => `"${l.rawSnippet}"`).join(' vs ')}) without qualifying context (such as distinct serving sizes or per-package quantities). Internal promotional discrepancies mislead consumers and create regulatory non-compliance.`,
          evidence_text: list.map((l) => l.rawSnippet).join(' vs '),
          confidence: 0.95,
          source: 'image',
          verification_status: 'possible_inconsistency',
          suggested_fix: `Synchronize ${specLabel} claims across all graphic copy, or add explicit serving size context (e.g., per single bar vs per pack).`,
          target_type: 'text',
          target_scope: 'image',
          image_evidence: list.map((l) => l.rawSnippet).join(' vs '),
          resolution_status: 'unresolved',
        });
      }
    }
  }

  return findings;
}


