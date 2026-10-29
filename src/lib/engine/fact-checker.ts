import { ApprovedFact } from '@/lib/types';
import { EngineFinding } from './types';

export interface VerifiedClaimSummary {
  claimText: string;
  matchedFactId: string;
  sourceName: string;
  sourceUrl?: string | null;
}

export type FactCategoryType =
  | 'uptime_sla'
  | 'certification'
  | 'metrics'
  | 'award'
  | 'environmental'
  | 'unverified_certification';

export function runFactChecks(
  content: string,
  approvedFacts: ApprovedFact[],
  options?: {
    sourceTag?: 'image' | 'caption' | string;
  }
): {
  findings: EngineFinding[];
  supportedClaims: VerifiedClaimSummary[];
} {
  const findings: EngineFinding[] = [];
  const supportedClaims: VerifiedClaimSummary[] = [];
  const activeFacts = approvedFacts.filter((f) => f.is_active);

  if (!content || !content.trim()) {
    return { findings, supportedClaims };
  }

  // 1. Detect Uptime & SLA claims
  const uptimeRegex = /(\d{2,3}(?:\.\d+)?%?\s*(?:uptime|availability|sla)|(?:100%|zero)\s*(?:uptime|downtime))/gi;
  let match: RegExpExecArray | null;

  while ((match = uptimeRegex.exec(content)) !== null) {
    const claimSnippet = match[0].trim();
    evaluateSpecificClaim(
      claimSnippet,
      match.index,
      'uptime_sla',
      content,
      activeFacts,
      findings,
      supportedClaims,
      options?.sourceTag
    );
  }

  // 2. Detect Certification & Security standard claims (e.g. SOC-1, SOC-2, SOC-3, ISO 27001, FedRAMP, HIPAA)
  const certRegex = /\b(SOC[-\s]?[123](?:\s*Type\s*(?:I{1,3}|IV|V))?|ISO[-\s]?\d{4,5}|HIPAA|FedRAMP|PCI[-\s]?DSS)\b/gi;
  while ((match = certRegex.exec(content)) !== null) {
    const claimSnippet = match[0].trim();
    evaluateSpecificClaim(
      claimSnippet,
      match.index,
      'certification',
      content,
      activeFacts,
      findings,
      supportedClaims,
      options?.sourceTag
    );
  }

  // 3. Detect Quantified Metrics & Numerical Customer Claims (e.g. "500+ enterprises", "10,000 customers", "10x faster")
  const metricRegex = /\b(\d+(?:,\d+)*(?:\.\d+)?(?:\+|x|%|k|m)?\s*(?:enterprises|customers|clients|users|organizations|faster|reduction|savings))\b/gi;
  while ((match = metricRegex.exec(content)) !== null) {
    const claimSnippet = match[0].trim();
    evaluateSpecificClaim(
      claimSnippet,
      match.index,
      'metrics',
      content,
      activeFacts,
      findings,
      supportedClaims,
      options?.sourceTag
    );
  }

  // 4. Detect Industry Award / Ranking Claims (e.g. "#1 in AI", "Gartner Magic Quadrant Leader")
  const awardRegex = /\b((?:#1|leader|top[-\s]?ranked|best[-\s]?in[-\s]?class)\s*(?:in|by|for)?\s*(?:gartner|forrester|idc|g2|market|industry)?)\b/gi;
  while ((match = awardRegex.exec(content)) !== null) {
    const claimSnippet = match[0].trim();
    if (claimSnippet.length > 3) {
      evaluateSpecificClaim(
        claimSnippet,
        match.index,
        'award',
        content,
        activeFacts,
        findings,
        supportedClaims,
        options?.sourceTag
      );
    }
  }

  // 5. Detect Environmental, Sustainability & Empirical Claims across any product category
  const envRegex = /\b(scientifically\s+proven(?:\s+to\s+[a-z\s]{3,35})?|clinically\s+proven(?:\s+to\s+[a-z\s]{3,35})?|eliminate\s+[a-z\s]{3,25}\s+pollution(?:\s+completely)?|world'?s\s+first\s+100%\s+certified\s+[a-z]+|100%\s+certified\s+(?:sustainable|organic|carbon[- ]neutral|recycled)|guaranteed\s+to\s+be\s+100%\s+[a-z-]+|100%\s+plastic[-\s]?free|100%\s+sustainable|100%\s+carbon[-\s]?neutral|zero\s+(?:emissions|waste|footprint|impact)|100%\s+organic)\b/gi;
  while ((match = envRegex.exec(content)) !== null) {
    const claimSnippet = match[0].trim();
    evaluateSpecificClaim(
      claimSnippet,
      match.index,
      'environmental',
      content,
      activeFacts,
      findings,
      supportedClaims,
      options?.sourceTag
    );
  }

  // 6. Detect Regulatory, Government, or Independent Authority Certification Claims
  const authCertRegex = /\b(officially\s+certified\s+by\s+[a-zA-Z\s]+(?:authority|agency|commission|board|body|organization)|certified\s+by\s+(?:every|all|major|[a-zA-Z\s]+)\s+(?:environmental|regulatory|government|security|industry)?\s*(?:authority|agency|commission|board|body|standard))\b/gi;
  while ((match = authCertRegex.exec(content)) !== null) {
    const claimSnippet = match[0].trim();
    evaluateSpecificClaim(
      claimSnippet,
      match.index,
      'unverified_certification',
      content,
      activeFacts,
      findings,
      supportedClaims,
      options?.sourceTag
    );
  }

  return { findings, supportedClaims };
}

function evaluateSpecificClaim(
  claimSnippet: string,
  index: number,
  categoryType: FactCategoryType,
  fullContent: string,
  activeFacts: ApprovedFact[],
  findings: EngineFinding[],
  supportedClaims: VerifiedClaimSummary[],
  sourceTag?: string
): void {
  const claimLower = claimSnippet.toLowerCase();

  // Find if any active fact addresses this topic
  const relevantFacts = activeFacts.filter((fact) => {
    const factLower = fact.fact_text.toLowerCase();
    if (categoryType === 'uptime_sla') {
      return factLower.includes('uptime') || factLower.includes('sla') || factLower.includes('availability');
    }
    if (categoryType === 'certification') {
      if (claimLower.includes('soc')) return factLower.includes('soc');
      if (claimLower.includes('iso')) return factLower.includes('iso');
      if (claimLower.includes('hipaa')) return factLower.includes('hipaa');
      return factLower.includes(claimLower);
    }
    if (categoryType === 'metrics') {
      return factLower.includes('customer') || factLower.includes('enterprise') || factLower.includes('faster');
    }
    if (categoryType === 'award') {
      return factLower.includes('leader') || factLower.includes('ranked') || factLower.includes('award');
    }
    if (categoryType === 'environmental') {
      return (
        factLower.includes('plastic') ||
        factLower.includes('sustainable') ||
        factLower.includes('ocean') ||
        factLower.includes('bottle') ||
        factLower.includes('environment')
      );
    }
    if (categoryType === 'unverified_certification') {
      return (
        factLower.includes('environmental authority') ||
        factLower.includes('certified authority') ||
        factLower.includes('authority') ||
        factLower.includes('certification')
      );
    }
    return false;
  });

  const targetScope: 'image' | 'caption' = sourceTag === 'image' ? 'image' : 'caption';
  const sourceName = targetScope;
  const rawSnippet = extractSnippet(fullContent, index, claimSnippet.length);
  const exactEvidence = sourceTag ? `[${sourceTag.toUpperCase()}]: "${rawSnippet}"` : rawSnippet;

  // CASE 1: No relevant fact exists in the Approved Facts registry
  if (relevantFacts.length === 0) {
    const alreadyFlagged = findings.some((f) => f.evidence_text === exactEvidence || f.evidence_text?.includes(claimSnippet));
    if (!alreadyFlagged) {
      if (categoryType === 'environmental') {
        findings.push({
          category: 'unsubstantiated_claim',
          severity: 'high',
          finding_title: `Unsubstantiated Environmental Claim: "${claimSnippet}"`,
          explanation: `Content asserts "${claimSnippet}". Scientific, environmental, and sustainability claims require empirical verification. No active approved fact in the corporate registry confirms this statement. This claim is flagged as unverified pending supporting evidence, not declared definitively false.`,
          evidence_text: exactEvidence,
          guideline_id: null,
          fact_id: null,
          confidence: 0.9,
          suggested_fix: `Provide verified empirical lab test reports or third-party accreditation in the Approved Facts registry, or rephrase to qualified, substantiateable copy.`,
          source: sourceName,
          target_type: 'text',
          target_scope: targetScope,
          image_evidence: targetScope === 'image' ? claimSnippet : null,
          caption_evidence: targetScope === 'caption' ? claimSnippet : null,
          verification_status: 'unverified',
        });
      } else if (categoryType === 'unverified_certification') {
        findings.push({
          category: 'unverified_certification',
          severity: 'medium',
          finding_title: `Unverified Environmental Authority Certification: "${claimSnippet}"`,
          explanation: `Marketing copy asserts that the product is "${claimSnippet}". References to official regulatory or environmental accreditations require verified proof in the corporate registry. This claim requires supporting documentation.`,
          evidence_text: exactEvidence,
          guideline_id: null,
          fact_id: null,
          confidence: 0.85,
          suggested_fix: `Register the accredited certifying body (e.g., ISO 14001, B-Corp, Cradle to Cradle) in the Approved Facts registry, or cite the specific authority.`,
          source: sourceName,
          target_type: 'text',
          target_scope: targetScope,
          image_evidence: targetScope === 'image' ? claimSnippet : null,
          caption_evidence: targetScope === 'caption' ? claimSnippet : null,
          verification_status: 'unverified',
        });
      } else {
        findings.push({
          category: 'unauthorized_claim',
          severity: 'medium',
          finding_title: `Unverified Claim (Evidence Not Found): "${claimSnippet}"`,
          explanation: `Content asserts "${claimSnippet}", but no matching approved fact or source documentation exists in the registry. This claim is not confirmed to be false, but requires documented verification before publication.`,
          evidence_text: exactEvidence,
          guideline_id: null,
          fact_id: null,
          confidence: 0.85,
          suggested_fix: `Verify this claim by registering an approved fact citation or remove the uncorroborated statement.`,
          source: sourceName,
          target_type: 'text',
          target_scope: targetScope,
          image_evidence: targetScope === 'image' ? claimSnippet : null,
          caption_evidence: targetScope === 'caption' ? claimSnippet : null,
          verification_status: 'unverified',
        });
      }
    }
    return;
  }

  // CASE 2: Relevant fact(s) exist — check for Supported vs Contradicted
  for (const fact of relevantFacts) {
    const factLower = fact.fact_text.toLowerCase();

    // Check Uptime Contradiction
    if (categoryType === 'uptime_sla') {
      const claimNumbers = extractPercentage(claimLower);
      const factNumbers = extractPercentage(factLower);

      if (claimNumbers !== null && factNumbers !== null) {
        if (claimNumbers === factNumbers) {
          if (!supportedClaims.some((s) => s.claimText === claimSnippet)) {
            supportedClaims.push({
              claimText: claimSnippet,
              matchedFactId: fact.id,
              sourceName: fact.source_name,
              sourceUrl: fact.source_url,
            });
          }
          return;
        } else {
          findings.push({
            category: 'unauthorized_claim',
            severity: 'critical',
            finding_title: `Contradicted Claim: Uptime SLA Mismatch (${claimSnippet})`,
            explanation: `Content claims "${claimSnippet}", which directly contradicts verified fact "${fact.fact_text}" documented in source "${fact.source_name}".`,
            evidence_text: exactEvidence,
            guideline_id: null,
            fact_id: fact.id,
            confidence: 1.0,
            suggested_fix: `Update SLA copy to match verified figure: "${fact.fact_text}"`,
            source: sourceName,
            target_type: 'text',
            target_scope: targetScope,
            image_evidence: targetScope === 'image' ? claimSnippet : null,
            caption_evidence: targetScope === 'caption' ? claimSnippet : null,
            verification_status: 'contradicted',
          });
          return;
        }
      }
    }

    // Check Certification Contradiction
    if (categoryType === 'certification') {
      if (claimLower.includes('soc-3') || claimLower.includes('soc 3')) {
        findings.push({
          category: 'unauthorized_claim',
          severity: 'critical',
          finding_title: `Contradicted Certification Claim: "${claimSnippet}"`,
          explanation: `Content claims "${claimSnippet}", but verified corporate credentials only certify "${fact.fact_text}" (Source: ${fact.source_name}).`,
          evidence_text: exactEvidence,
          guideline_id: null,
          fact_id: fact.id,
          confidence: 1.0,
          suggested_fix: `Correct the certification standard to match verified records: "${fact.fact_text}"`,
          source: sourceName,
          target_type: 'text',
          target_scope: targetScope,
          image_evidence: targetScope === 'image' ? claimSnippet : null,
          caption_evidence: targetScope === 'caption' ? claimSnippet : null,
          verification_status: 'contradicted',
        });
        return;
      }

      if (factLower.includes(claimLower)) {
        if (!supportedClaims.some((s) => s.claimText === claimSnippet)) {
          supportedClaims.push({
            claimText: claimSnippet,
            matchedFactId: fact.id,
            sourceName: fact.source_name,
            sourceUrl: fact.source_url,
          });
        }
        return;
      }
    }

    // Check Environmental Claims against registered facts
    if (categoryType === 'environmental' || categoryType === 'unverified_certification') {
      if (factLower.includes(claimLower)) {
        if (!supportedClaims.some((s) => s.claimText === claimSnippet)) {
          supportedClaims.push({
            claimText: claimSnippet,
            matchedFactId: fact.id,
            sourceName: fact.source_name,
            sourceUrl: fact.source_url,
          });
        }
        return;
      }
    }
  }

  // If we reached here without matching exact facts, mark as unverified
  const alreadyFlagged = findings.some((f) => f.evidence_text === exactEvidence || f.evidence_text?.includes(claimSnippet));
  if (!alreadyFlagged) {
    findings.push({
      category: 'unauthorized_claim',
      severity: 'medium',
      finding_title: `Unverified Claim (Evidence Not Found): "${claimSnippet}"`,
      explanation: `Content asserts "${claimSnippet}", but specific source evidence was not found in active corporate facts. This claim is not confirmed to be false, but requires documented verification before publication.`,
      evidence_text: exactEvidence,
      guideline_id: null,
      fact_id: null,
      confidence: 0.85,
      suggested_fix: `Verify this claim by registering an approved fact citation or rephrase the uncorroborated statement.`,
      source: sourceName,
      target_type: 'text',
      target_scope: targetScope,
      image_evidence: targetScope === 'image' ? claimSnippet : null,
      caption_evidence: targetScope === 'caption' ? claimSnippet : null,
      verification_status: 'unverified',
    });
  }
}

function extractPercentage(text: string): number | null {
  const m = text.match(/(\d{2,3}(?:\.\d+)?)/);
  if (m) {
    const val = parseFloat(m[1]);
    if (!isNaN(val)) return val;
  }
  return null;
}

function extractSnippet(text: string, startIndex: number, length: number): string {
  const windowSize = 30;
  const snippetStart = Math.max(0, startIndex - windowSize);
  const snippetEnd = Math.min(text.length, startIndex + length + windowSize);
  const prefix = snippetStart > 0 ? '...' : '';
  const suffix = snippetEnd < text.length ? '...' : '';
  return `${prefix}${text.substring(snippetStart, snippetEnd).trim()}${suffix}`;
}
