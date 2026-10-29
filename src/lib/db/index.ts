import { getSupabaseServerClient, getServerDbConfigStatus } from '@/lib/supabase/server';
import {
  BrandProfile,
  BrandGuideline,
  ApprovedFact,
  AuthorizedAsset,
  ContentReview,
  ReviewFinding,
  ReviewDecision,
  CreateGuidelinePayload,
  UpdateGuidelinePayload,
  CreateFactPayload,
  UpdateFactPayload,
  CreateAssetPayload,
  UpdateAssetPayload,
  CreateReviewPayload,
  UpdateReviewVersionPayload,
  CreateDecisionPayload,
  DashboardMetrics,
  ReviewStatus,
} from '@/lib/types';
import { runComplianceReview, ComplianceReviewResult } from '@/lib/engine';
import fs from 'fs';
import path from 'path';

// -------------------------------------------------------------------
// Local File-Based Fallback Store
// -------------------------------------------------------------------
interface LocalStoreSchema {
  brand_profile?: BrandProfile | null;
  brand_guidelines: BrandGuideline[];
  approved_facts: ApprovedFact[];
  authorized_assets: AuthorizedAsset[];
  content_reviews: ContentReview[];
  review_findings: ReviewFinding[];
  review_decisions: ReviewDecision[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function getInitialStore(): LocalStoreSchema {
  return {
    brand_profile: null,
    brand_guidelines: [],
    approved_facts: [],
    authorized_assets: [],
    content_reviews: [],
    review_findings: [],
    review_decisions: [],
  };
}

function readLocalStore(): LocalStoreSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial = getInitialStore();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.authorized_assets) parsed.authorized_assets = [];
    return parsed;
  } catch {
    return getInitialStore();
  }
}

function writeLocalStore(store: LocalStoreSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local store:', err);
  }
}

// -------------------------------------------------------------------
// 0. Brand Profile (Unified Identity Governance)
// -------------------------------------------------------------------
export async function getBrandProfile(): Promise<BrandProfile | null> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('brand_profiles').select('*').limit(1).maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            brand_name: data.brand_name || '',
            brand_description: data.brand_description || '',
            brand_colors: Array.isArray(data.brand_colors) ? data.brand_colors : [],
            typography_preferences: typeof data.typography_preferences === 'string'
              ? (data.typography_preferences.startsWith('{') ? JSON.parse(data.typography_preferences) : { primary_font: data.typography_preferences })
              : (data.typography_preferences || {}),
            official_logo_url: data.official_logo_url || undefined,
            tone_of_voice: data.tone_of_voice || '',
            prohibited_phrases: Array.isArray(data.prohibited_phrases) ? data.prohibited_phrases : [],
            required_disclaimers: Array.isArray(data.required_disclaimers) ? data.required_disclaimers : [],
            additional_rules: data.additional_rules || '',
            updated_at: data.updated_at,
          };
        }
      } catch {
        // Fall back to local store
      }
    }
  }

  const store = readLocalStore();
  return store.brand_profile || null;
}

export async function saveBrandProfile(payload: Partial<BrandProfile>): Promise<BrandProfile> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();
  const store = readLocalStore();
  const existing = store.brand_profile || null;

  const updatedProfile: BrandProfile = {
    id: existing?.id || crypto.randomUUID(),
    brand_name: payload.brand_name !== undefined ? payload.brand_name.trim() : (existing?.brand_name || ''),
    brand_description: payload.brand_description !== undefined ? payload.brand_description.trim() : (existing?.brand_description || ''),
    brand_colors: payload.brand_colors !== undefined ? payload.brand_colors : (existing?.brand_colors || []),
    typography_preferences: payload.typography_preferences !== undefined ? payload.typography_preferences : (existing?.typography_preferences || {}),
    official_logo_url: payload.official_logo_url !== undefined ? payload.official_logo_url : (existing?.official_logo_url || undefined),
    tone_of_voice: payload.tone_of_voice !== undefined ? payload.tone_of_voice.trim() : (existing?.tone_of_voice || ''),
    prohibited_phrases: payload.prohibited_phrases !== undefined ? payload.prohibited_phrases : (existing?.prohibited_phrases || []),
    required_disclaimers: payload.required_disclaimers !== undefined ? payload.required_disclaimers : (existing?.required_disclaimers || []),
    additional_rules: payload.additional_rules !== undefined ? (typeof payload.additional_rules === 'string' ? payload.additional_rules.trim() : payload.additional_rules) : (existing?.additional_rules || ''),
    updated_at: now,
  };

  store.brand_profile = updatedProfile;
  writeLocalStore(store);

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data: existingRecords } = await supabase.from('brand_profiles').select('id').limit(1);
        if (existingRecords && existingRecords.length > 0) {
          await supabase.from('brand_profiles').update({
            brand_name: updatedProfile.brand_name,
            brand_description: updatedProfile.brand_description,
            brand_colors: updatedProfile.brand_colors,
            typography_preferences: JSON.stringify(updatedProfile.typography_preferences || {}),
            official_logo_url: updatedProfile.official_logo_url,
            tone_of_voice: updatedProfile.tone_of_voice,
            prohibited_phrases: updatedProfile.prohibited_phrases,
            required_disclaimers: updatedProfile.required_disclaimers,
            updated_at: now,
          }).eq('id', existingRecords[0].id);
        } else {
          await supabase.from('brand_profiles').insert({
            id: updatedProfile.id,
            brand_name: updatedProfile.brand_name,
            brand_description: updatedProfile.brand_description,
            brand_colors: updatedProfile.brand_colors,
            typography_preferences: JSON.stringify(updatedProfile.typography_preferences || {}),
            official_logo_url: updatedProfile.official_logo_url,
            tone_of_voice: updatedProfile.tone_of_voice,
            prohibited_phrases: updatedProfile.prohibited_phrases,
            required_disclaimers: updatedProfile.required_disclaimers,
            created_at: now,
            updated_at: now,
          });
        }
      } catch {
        // Continue with local store
      }
    }
  }

  return updatedProfile;
}

// -------------------------------------------------------------------
// 1. Brand Guidelines CRUD
// -------------------------------------------------------------------
export async function getBrandGuidelines(onlyActive: boolean = false): Promise<BrandGuideline[]> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      let query = supabase.from('brand_guidelines').select('*').order('created_at', { ascending: false });
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (!error && data) return data as BrandGuideline[];
    }
  }

  const store = readLocalStore();
  return store.brand_guidelines
    .filter((g) => (onlyActive ? g.is_active : true))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createBrandGuideline(payload: CreateGuidelinePayload): Promise<BrandGuideline> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('brand_guidelines')
        .insert({
          title: payload.title.trim(),
          description: payload.description.trim(),
          rule_type: payload.rule_type,
          severity: payload.severity || 'medium',
          rule_configuration: payload.rule_configuration || {},
          is_active: payload.is_active !== undefined ? payload.is_active : true,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (!error && data) return data as BrandGuideline;
    }
  }

  const store = readLocalStore();
  const existing = store.brand_guidelines.find((g) => g.title.toLowerCase() === payload.title.trim().toLowerCase());
  if (existing) {
    existing.description = payload.description.trim();
    existing.rule_type = payload.rule_type;
    existing.severity = payload.severity || 'medium';
    existing.rule_configuration = payload.rule_configuration || {};
    existing.is_active = payload.is_active !== undefined ? payload.is_active : true;
    existing.updated_at = now;
    writeLocalStore(store);
    return existing;
  }

  const newGuideline: BrandGuideline = {
    id: crypto.randomUUID(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    rule_type: payload.rule_type,
    severity: payload.severity || 'medium',
    rule_configuration: payload.rule_configuration || {},
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    created_at: now,
    updated_at: now,
  };
  store.brand_guidelines.unshift(newGuideline);
  writeLocalStore(store);
  return newGuideline;
}

export async function updateBrandGuideline(
  id: string,
  payload: UpdateGuidelinePayload
): Promise<BrandGuideline> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const updates: Record<string, unknown> = { updated_at: now };
      if (payload.title !== undefined) updates.title = payload.title.trim();
      if (payload.description !== undefined) updates.description = payload.description.trim();
      if (payload.rule_type !== undefined) updates.rule_type = payload.rule_type;
      if (payload.severity !== undefined) updates.severity = payload.severity;
      if (payload.rule_configuration !== undefined) updates.rule_configuration = payload.rule_configuration;
      if (payload.is_active !== undefined) updates.is_active = payload.is_active;

      const { data, error } = await supabase
        .from('brand_guidelines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as BrandGuideline;
    }
  }

  const store = readLocalStore();
  const idx = store.brand_guidelines.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error(`Guideline with ID ${id} not found`);

  const updated: BrandGuideline = {
    ...store.brand_guidelines[idx],
    ...payload,
    updated_at: now,
  };
  store.brand_guidelines[idx] = updated;
  writeLocalStore(store);
  return updated;
}

export async function deleteBrandGuideline(id: string): Promise<void> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from('brand_guidelines').delete().eq('id', id);
    }
  }

  const store = readLocalStore();
  store.brand_guidelines = store.brand_guidelines.filter((g) => g.id !== id);
  writeLocalStore(store);
}

export async function toggleBrandGuidelineActive(id: string, is_active: boolean): Promise<BrandGuideline> {
  return updateBrandGuideline(id, { is_active });
}

// -------------------------------------------------------------------
// 2. Approved Facts CRUD
// -------------------------------------------------------------------
export async function getApprovedFacts(onlyActive: boolean = false): Promise<ApprovedFact[]> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      let query = supabase.from('approved_facts').select('*').order('created_at', { ascending: false });
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (!error && data) return data as ApprovedFact[];
    }
  }

  const store = readLocalStore();
  return store.approved_facts
    .filter((f) => (onlyActive ? f.is_active : true))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createApprovedFact(payload: CreateFactPayload): Promise<ApprovedFact> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('approved_facts')
        .insert({
          fact_text: payload.fact_text.trim(),
          source_name: payload.source_name.trim(),
          source_url: payload.source_url?.trim() || null,
          evidence_notes: payload.evidence_notes?.trim() || null,
          is_active: payload.is_active !== undefined ? payload.is_active : true,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (!error && data) return data as ApprovedFact;
    }
  }

  const store = readLocalStore();
  const existing = store.approved_facts.find((f) => f.fact_text.toLowerCase() === payload.fact_text.trim().toLowerCase());
  if (existing) {
    existing.source_name = payload.source_name.trim();
    existing.source_url = payload.source_url?.trim() || null;
    existing.evidence_notes = payload.evidence_notes?.trim() || null;
    existing.is_active = payload.is_active !== undefined ? payload.is_active : true;
    existing.updated_at = now;
    writeLocalStore(store);
    return existing;
  }

  const newFact: ApprovedFact = {
    id: crypto.randomUUID(),
    fact_text: payload.fact_text.trim(),
    source_name: payload.source_name.trim(),
    source_url: payload.source_url?.trim() || null,
    evidence_notes: payload.evidence_notes?.trim() || null,
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    created_at: now,
    updated_at: now,
  };
  store.approved_facts.unshift(newFact);
  writeLocalStore(store);
  return newFact;
}

export async function updateApprovedFact(id: string, payload: UpdateFactPayload): Promise<ApprovedFact> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const updates: Record<string, unknown> = { updated_at: now };
      if (payload.fact_text !== undefined) updates.fact_text = payload.fact_text.trim();
      if (payload.source_name !== undefined) updates.source_name = payload.source_name.trim();
      if (payload.source_url !== undefined) updates.source_url = payload.source_url?.trim() || null;
      if (payload.evidence_notes !== undefined) updates.evidence_notes = payload.evidence_notes?.trim() || null;
      if (payload.is_active !== undefined) updates.is_active = payload.is_active;

      const { data, error } = await supabase
        .from('approved_facts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as ApprovedFact;
    }
  }

  const store = readLocalStore();
  const idx = store.approved_facts.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error(`Fact with ID ${id} not found`);

  const updated: ApprovedFact = {
    ...store.approved_facts[idx],
    ...payload,
    updated_at: now,
  };
  store.approved_facts[idx] = updated;
  writeLocalStore(store);
  return updated;
}

export async function deleteApprovedFact(id: string): Promise<void> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from('approved_facts').delete().eq('id', id);
    }
  }

  const store = readLocalStore();
  store.approved_facts = store.approved_facts.filter((f) => f.id !== id);
  writeLocalStore(store);
}

export async function toggleApprovedFactActive(id: string, is_active: boolean): Promise<ApprovedFact> {
  return updateApprovedFact(id, { is_active });
}

// -------------------------------------------------------------------
// 3. Authorized Assets CRUD (Logos, Color Palettes, Badges)
// -------------------------------------------------------------------
export async function getAuthorizedAssets(onlyActive: boolean = false): Promise<AuthorizedAsset[]> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        let query = supabase.from('authorized_assets').select('*').order('created_at', { ascending: false });
        if (onlyActive) {
          query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (!error && data) return data as AuthorizedAsset[];
      } catch {
        // Table not yet migrated in Supabase, fall back to local store
      }
    }
  }

  const store = readLocalStore();
  return (store.authorized_assets || [])
    .filter((a) => (onlyActive ? a.is_active : true))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getAuthorizedAssetById(id: string): Promise<AuthorizedAsset | null> {
  const assets = await getAuthorizedAssets();
  return assets.find((a) => a.id === id) || null;
}

export async function createAuthorizedAsset(payload: CreateAssetPayload): Promise<AuthorizedAsset> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('authorized_assets')
          .insert({
            asset_name: payload.asset_name.trim(),
            asset_type: payload.asset_type,
            file_url: payload.file_url.trim(),
            asset_metadata: payload.asset_metadata || {},
            is_active: payload.is_active !== undefined ? payload.is_active : true,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        if (!error && data) return data as AuthorizedAsset;
      } catch {
        // Fall back to local store
      }
    }
  }

  const store = readLocalStore();
  if (!store.authorized_assets) store.authorized_assets = [];
  const existing = store.authorized_assets.find((a) => a.asset_name.toLowerCase() === payload.asset_name.trim().toLowerCase());
  if (existing) {
    existing.asset_type = payload.asset_type;
    existing.file_url = payload.file_url.trim();
    existing.asset_metadata = payload.asset_metadata || existing.asset_metadata;
    existing.is_active = payload.is_active !== undefined ? payload.is_active : true;
    existing.updated_at = now;
    writeLocalStore(store);
    return existing;
  }

  const newAsset: AuthorizedAsset = {
    id: crypto.randomUUID(),
    asset_name: payload.asset_name.trim(),
    asset_type: payload.asset_type,
    file_url: payload.file_url.trim(),
    asset_metadata: payload.asset_metadata || {},
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    created_at: now,
    updated_at: now,
  };
  if (!store.authorized_assets) store.authorized_assets = [];
  store.authorized_assets.unshift(newAsset);
  writeLocalStore(store);
  return newAsset;
}

export async function updateAuthorizedAsset(
  id: string,
  payload: UpdateAssetPayload
): Promise<AuthorizedAsset> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('authorized_assets')
          .update({
            ...payload,
            updated_at: now,
          })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data as AuthorizedAsset;
      } catch {
        // Fall back
      }
    }
  }

  const store = readLocalStore();
  if (!store.authorized_assets) store.authorized_assets = [];
  const idx = store.authorized_assets.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error(`Asset with ID ${id} not found`);

  const updated: AuthorizedAsset = {
    ...store.authorized_assets[idx],
    ...payload,
    updated_at: now,
  };
  store.authorized_assets[idx] = updated;
  writeLocalStore(store);
  return updated;
}

export async function deleteAuthorizedAsset(id: string): Promise<void> {
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.from('authorized_assets').delete().eq('id', id);
      } catch {
        // Fall back
      }
    }
  }

  const store = readLocalStore();
  if (store.authorized_assets) {
    store.authorized_assets = store.authorized_assets.filter((a) => a.id !== id);
    writeLocalStore(store);
  }
}

export async function toggleAuthorizedAssetActive(id: string, is_active: boolean): Promise<AuthorizedAsset> {
  return updateAuthorizedAsset(id, { is_active });
}

// -------------------------------------------------------------------
// 4. Content Reviews CRUD (Image-First & Multi-Version)
// -------------------------------------------------------------------
export async function getContentReviews(filters?: {
  status?: string;
  content_type?: string;
  search?: string;
}): Promise<ContentReview[]> {
  const store = readLocalStore();
  const localMap = new Map<string, ContentReview>(store.content_reviews.map((r) => [r.id, r]));

  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      let query = supabase
        .from('content_reviews')
        .select('*, findings:review_findings(*), decisions:review_decisions(*)')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.content_type && filters.content_type !== 'all') {
        query = query.eq('content_type', filters.content_type);
      }

      const { data, error } = await query;
      if (!error && data) {
        let list = (data as ContentReview[]).map((r) => {
          // Merge with any local extended fields (image_url, corrected_image_url) if Supabase schema lacks them
          const local = localMap.get(r.id);
          const isSameImage = Boolean(r.image_url && local?.image_url && r.image_url === local.image_url);
          const rawFindings = ((Array.isArray(r.findings) && r.findings.length > 0)
            ? r.findings
            : store.review_findings.filter((lf) => lf.review_id === r.id)
          );
          const allDecisions = [
            ...(Array.isArray(r.decisions) ? r.decisions : []),
            ...store.review_decisions.filter((d) => d.review_id === r.id),
          ];
          const hasHumanApproval = allDecisions.some(
            (d) => d.decision === 'approved' || (d as unknown as { action?: string }).action === 'approve' || (d as unknown as { decision?: string }).decision === 'approve'
          );

          let finalStatus = r.status;
          if (!hasHumanApproval && rawFindings.length > 0 && finalStatus === 'approved') {
            finalStatus = (local?.status && local.status !== 'approved') ? local.status : 'flagged';
          } else if (!hasHumanApproval && rawFindings.length === 0 && finalStatus === 'approved') {
            finalStatus = 'in_review';
          } else if (!finalStatus || finalStatus === 'in_review') {
            finalStatus = local?.status || finalStatus || 'in_review';
          }

          let finalScore = r.compliance_score;
          if (!hasHumanApproval && rawFindings.length > 0 && (finalScore === 100 || finalScore === null)) {
            finalScore = (local?.compliance_score !== null && local?.compliance_score !== undefined && local.compliance_score < 100)
              ? local.compliance_score
              : Math.max(0, 100 - rawFindings.reduce((acc, f) => acc + (f.severity === 'critical' ? 35 : f.severity === 'high' ? 20 : f.severity === 'medium' ? 10 : 5), 0));
          } else if (finalScore === null) {
            finalScore = local?.compliance_score ?? null;
          }

          return {
            ...r,
            status: finalStatus,
            compliance_score: finalScore,
            original_image_url: r.original_image_url || local?.original_image_url || r.image_url || local?.image_url || null,
            original_caption_text: r.original_caption_text || local?.original_caption_text || r.caption_text || local?.caption_text || null,
            image_url: r.image_url || local?.image_url || '',
            caption_text: r.caption_text || local?.caption_text || null,
            aspect_ratio: r.aspect_ratio || local?.aspect_ratio || null,
            extracted_ocr_text: r.extracted_ocr_text || (isSameImage ? local?.extracted_ocr_text : null) || null,
            corrected_image_url: r.corrected_image_url || local?.corrected_image_url || null,
            correction_metadata: r.correction_metadata || local?.correction_metadata || null,
            evaluation_metadata: r.evaluation_metadata || local?.evaluation_metadata || null,
          };
        });

        if (filters?.search && filters.search.trim()) {
          const s = filters.search.toLowerCase();
          list = list.filter(
            (r) => r.title.toLowerCase().includes(s) || r.content_text.toLowerCase().includes(s)
          );
        }
        return list;
      }
    }
  }

  // Fallback
  let list = store.content_reviews.map((r) => ({
    ...r,
    findings: store.review_findings.filter((f) => f.review_id === r.id),
    decisions: store.review_decisions
      .filter((d) => d.review_id === r.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }));

  if (filters?.status && filters.status !== 'all') {
    list = list.filter((r) => r.status === filters.status);
  }
  if (filters?.content_type && filters.content_type !== 'all') {
    list = list.filter((r) => r.content_type === filters.content_type);
  }
  if (filters?.search && filters.search.trim()) {
    const s = filters.search.toLowerCase();
    list = list.filter((r) => r.title.toLowerCase().includes(s) || r.content_text.toLowerCase().includes(s));
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getContentReviewById(id: string): Promise<ContentReview | null> {
  const store = readLocalStore();
  const local = store.content_reviews.find((r) => r.id === id);

  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('content_reviews')
        .select('*, findings:review_findings(*), decisions:review_decisions(*)')
        .eq('id', id)
        .single();
      if (!error && data) {
        const r = data as ContentReview;
        const isSameImage = Boolean(r.image_url && local?.image_url && r.image_url === local.image_url);

        const rawFindings = ((Array.isArray(r.findings) && r.findings.length > 0)
          ? r.findings
          : store.review_findings.filter((lf) => lf.review_id === id)
        );

        const allDecisions = [
          ...(Array.isArray(r.decisions) ? r.decisions : []),
          ...store.review_decisions.filter((d) => d.review_id === id),
        ];
        const hasHumanApproval = allDecisions.some(
          (d) => d.decision === 'approved' || (d as unknown as { action?: string }).action === 'approve' || (d as unknown as { decision?: string }).decision === 'approve'
        );

        // Honest status calculation:
        // Do not preserve a stale automated 'approved' if human has not approved and findings exist
        let finalStatus = r.status;
        if (!hasHumanApproval && rawFindings.length > 0 && finalStatus === 'approved') {
          finalStatus = (local?.status && local.status !== 'approved') ? local.status : 'flagged';
        } else if (!hasHumanApproval && rawFindings.length === 0 && finalStatus === 'approved') {
          // Automated engine should never mark 'approved' on 0 findings; it is 'in_review' awaiting reviewer signoff
          finalStatus = 'in_review';
        } else if (!finalStatus || finalStatus === 'in_review') {
          finalStatus = local?.status || finalStatus || 'in_review';
        }

        // Honest compliance score calculation:
        let finalScore = r.compliance_score;
        if (!hasHumanApproval && rawFindings.length > 0 && (finalScore === 100 || finalScore === null)) {
          finalScore = (local?.compliance_score !== null && local?.compliance_score !== undefined && local.compliance_score < 100)
            ? local.compliance_score
            : Math.max(0, 100 - rawFindings.reduce((acc, f) => acc + (f.severity === 'critical' ? 35 : f.severity === 'high' ? 20 : f.severity === 'medium' ? 10 : 5), 0));
        } else if (finalScore === null) {
          finalScore = local?.compliance_score ?? null;
        }

        return {
          ...r,
          status: finalStatus,
          compliance_score: finalScore,
          original_image_url: r.original_image_url || local?.original_image_url || r.image_url || local?.image_url || null,
          original_caption_text: r.original_caption_text || local?.original_caption_text || r.caption_text || local?.caption_text || null,
          image_url: r.image_url || local?.image_url || '',
          caption_text: r.caption_text || local?.caption_text || null,
          aspect_ratio: r.aspect_ratio || local?.aspect_ratio || null,
          extracted_ocr_text: r.extracted_ocr_text || (isSameImage ? local?.extracted_ocr_text : null) || null,
          corrected_image_url: r.corrected_image_url || local?.corrected_image_url || null,
          correction_metadata: r.correction_metadata || local?.correction_metadata || null,
          evaluation_metadata: r.evaluation_metadata || local?.evaluation_metadata || null,
          findings: rawFindings.map((f) => {
            const localFinding = store.review_findings.find(
              (lf) => lf.id === f.id || (lf.review_id === f.review_id && lf.finding_title === f.finding_title)
            );
            return {
              ...f,
              source: f.source || localFinding?.source || (f.target_scope === 'both' ? 'cross_modal' : f.target_scope === 'image' ? 'image' : 'caption'),
              bounding_box: f.bounding_box || localFinding?.bounding_box || null,
              target_type: f.target_type || localFinding?.target_type || 'text',
              target_scope: f.target_scope || localFinding?.target_scope || (f.target_type === 'visual_element' ? 'image' : 'caption'),
              caption_evidence: f.caption_evidence || localFinding?.caption_evidence || null,
              image_evidence: f.image_evidence || localFinding?.image_evidence || null,
              proposed_replacement: f.proposed_replacement || localFinding?.proposed_replacement || null,
              resolution_status: f.resolution_status || localFinding?.resolution_status || 'unresolved',
            };
          }),
          decisions: allDecisions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        };
      }
    }
  }

  if (!local) return null;

  return {
    ...local,
    findings: store.review_findings.filter((f) => f.review_id === local.id),
    decisions: store.review_decisions
      .filter((d) => d.review_id === local.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

// Helper to merge brand guidelines, facts, assets, and active brand profile rules
export async function getAugmentedActiveGuidelinesAndAssets() {
  const [baseGuidelines, facts, baseAssets, profile] = await Promise.all([
    getBrandGuidelines(true),
    getApprovedFacts(true),
    getAuthorizedAssets(true),
    getBrandProfile(),
  ]);

  const guidelines = [...baseGuidelines];
  const assets = [...baseAssets];

  if (profile) {
    if (profile.prohibited_phrases && profile.prohibited_phrases.length > 0) {
      guidelines.push({
        id: 'profile-prohibited-phrases',
        title: `Prohibited Terms for ${profile.brand_name || 'Brand'}`,
        description: 'Marketing creatives must not include unapproved or prohibited phrases.',
        rule_type: 'prohibited_claim',
        severity: 'high',
        rule_configuration: {
          keywords: profile.prohibited_phrases,
          forbidden_examples: profile.prohibited_phrases,
        },
        is_active: true,
        created_at: profile.updated_at || new Date().toISOString(),
        updated_at: profile.updated_at || new Date().toISOString(),
      });
    }

    if (profile.required_disclaimers && profile.required_disclaimers.length > 0) {
      guidelines.push({
        id: 'profile-required-disclaimers',
        title: `Mandatory Brand Disclaimers for ${profile.brand_name || 'Brand'}`,
        description: 'Marketing creatives must include official legal/regulatory copy.',
        rule_type: 'required_disclaimer',
        severity: 'medium',
        rule_configuration: {
          keywords: profile.required_disclaimers,
          allowed_examples: profile.required_disclaimers,
        },
        is_active: true,
        created_at: profile.updated_at || new Date().toISOString(),
        updated_at: profile.updated_at || new Date().toISOString(),
      });
    }

    if (profile.brand_colors && profile.brand_colors.length > 0) {
      guidelines.push({
        id: 'profile-brand-colors',
        title: `Official Color Palette for ${profile.brand_name || 'Brand'}`,
        description: `Adhere strictly to official brand palette colors: ${profile.brand_colors.join(', ')}`,
        rule_type: 'color_palette',
        severity: 'medium',
        rule_configuration: {
          allowed_examples: profile.brand_colors,
        },
        is_active: true,
        created_at: profile.updated_at || new Date().toISOString(),
        updated_at: profile.updated_at || new Date().toISOString(),
      });
    }

    const typoObj = typeof profile.typography_preferences === 'object' && profile.typography_preferences !== null
      ? (profile.typography_preferences as { primary_font?: string; secondary_font?: string })
      : typeof profile.typography_preferences === 'string'
      ? { primary_font: profile.typography_preferences, secondary_font: undefined }
      : {};

    if (typoObj?.primary_font) {
      guidelines.push({
        id: 'profile-typography',
        title: `Brand Typography for ${profile.brand_name || 'Brand'}`,
        description: `Use approved primary typeface: ${typoObj.primary_font}${typoObj.secondary_font ? ` and secondary typeface: ${typoObj.secondary_font}` : ''}`,
        rule_type: 'typography',
        severity: 'low',
        rule_configuration: {
          allowed_examples: [typoObj.primary_font, typoObj.secondary_font].filter(Boolean) as string[],
        },
        is_active: true,
        created_at: profile.updated_at || new Date().toISOString(),
        updated_at: profile.updated_at || new Date().toISOString(),
      });
    }

    if (profile.additional_rules) {
      const customRulesText = typeof profile.additional_rules === 'string'
        ? profile.additional_rules.trim()
        : Array.isArray(profile.additional_rules)
        ? profile.additional_rules.map((r) => r.description || r.title).join('; ')
        : '';

      if (customRulesText) {
        guidelines.push({
          id: 'profile-custom-rules',
          title: `Custom Governance Standard for ${profile.brand_name || 'Brand'}`,
          description: customRulesText,
          rule_type: 'voice_and_tone',
          severity: 'medium',
          rule_configuration: {},
          is_active: true,
          created_at: profile.updated_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
        });
      }
    }

    if (profile.official_logo_url && !assets.some((a) => a.asset_type === 'logo' && a.is_active)) {
      assets.unshift({
        id: 'profile-official-logo',
        asset_name: `${profile.brand_name || 'Brand'} Official Logo`,
        asset_type: 'logo',
        file_url: profile.official_logo_url,
        asset_metadata: { is_primary: true },
        is_active: true,
        created_at: profile.updated_at || new Date().toISOString(),
        updated_at: profile.updated_at || new Date().toISOString(),
      });
    }
  }

  return { guidelines, facts, assets, profile };
}

export async function createContentReview(
  payload: CreateReviewPayload,
  options?: { skipEvaluation?: boolean; ocrReferenceText?: string }
): Promise<ContentReview> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();
  let createdReviewId: string;
  const isDraft = Boolean(payload.save_as_draft || payload.status === 'draft');
  const initialStatus: ReviewStatus = isDraft ? 'draft' : 'in_review';
  const shouldSkipEvaluation = isDraft || Boolean(options?.skipEvaluation);

  const rawCopy = payload.content_text?.trim() || (payload.image_url ? `[Marketing Post Image: ${payload.image_url}]` : '');

  // Persist locally first for complete image data guarantee
  const store = readLocalStore();
  createdReviewId = crypto.randomUUID();

  const resolvedCaption = payload.caption_text || (payload.content_text && !payload.content_text.startsWith('[Marketing Post Image:') && !payload.content_text.startsWith('[Image Creative:') && !payload.content_text.startsWith('[Creative Image:') ? payload.content_text : null);

  const newReview: ContentReview = {
    id: createdReviewId,
    title: payload.title.trim(),
    content_text: rawCopy,
    content_type: payload.content_type,
    status: initialStatus,
    compliance_score: null,
    review_version: 1,
    image_url: payload.image_url || '',
    original_image_url: payload.image_url || null,
    caption_text: resolvedCaption,
    original_caption_text: resolvedCaption,
    aspect_ratio: payload.aspect_ratio || null,
    image_width: payload.image_width || null,
    image_height: payload.image_height || null,
    extracted_ocr_text: null,
    created_at: now,
    updated_at: now,
    findings: [],
    decisions: [],
  };

  store.content_reviews.unshift(newReview);
  writeLocalStore(store);

  // If Supabase is connected, attempt sync
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const fullInsert = {
        id: createdReviewId,
        title: payload.title.trim(),
        content_text: rawCopy,
        content_type: payload.content_type,
        status: initialStatus,
        compliance_score: null,
        review_version: 1,
        image_url: payload.image_url || null,
        aspect_ratio: payload.aspect_ratio || null,
        image_width: payload.image_width || null,
        image_height: payload.image_height || null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase.from('content_reviews').insert(fullInsert).select().single();

      if (error) {
        const baseInsert = {
          id: createdReviewId,
          title: payload.title.trim(),
          content_text: rawCopy,
          content_type: payload.content_type,
          status: initialStatus,
          compliance_score: null,
          review_version: 1,
          created_at: now,
          updated_at: now,
        };
        await supabase.from('content_reviews').insert(baseInsert);
      } else if (data) {
        createdReviewId = data.id;
      }
    }
  }

  // If evaluation requested, evaluate against active guidelines, facts, brand profile, and authorized visual assets
  if (!shouldSkipEvaluation) {
    const { guidelines, facts, assets } = await getAugmentedActiveGuidelinesAndAssets();

    const evalResult = await runComplianceReview(
      rawCopy,
      payload.content_type,
      guidelines,
      facts,
      {
        imageUrl: payload.image_url,
        captionText: resolvedCaption || undefined,
        assets,
        ocrReferenceText: options?.ocrReferenceText,
      }
    );

    return await saveReviewEvaluation(createdReviewId, evalResult);
  }

  const review = await getContentReviewById(createdReviewId);
  if (!review) throw new Error('Failed to retrieve created review');
  return review;
}

// -------------------------------------------------------------------
// 5. Review Evaluation Persistence (Findings & Status)
// -------------------------------------------------------------------
export async function saveReviewEvaluation(
  reviewId: string,
  result: ComplianceReviewResult
): Promise<ContentReview> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  // 1. Update Local Store
  const store = readLocalStore();
  let review = store.content_reviews.find((r) => r.id === reviewId);
  if (!review) {
    review = {
      id: reviewId,
      title: 'Marketing Review',
      content_text: '',
      content_type: 'social_media',
      status: result.status,
      compliance_score: result.compliance_score,
      review_version: 1,
      image_url: '',
      created_at: now,
      updated_at: now,
      findings: [],
      decisions: [],
    };
    store.content_reviews.unshift(review);
  }

  review.status = result.status;
  review.compliance_score = result.compliance_score;
  review.extracted_ocr_text = result.extracted_ocr_text || null;
  review.evaluation_metadata = result.metadata;
  if (result.metadata?.imageSummary) {
    review.image_width = result.metadata.imageSummary.width || review.image_width;
    review.image_height = result.metadata.imageSummary.height || review.image_height;
    if (result.metadata.imageSummary.aspectRatio) {
      review.aspect_ratio = result.metadata.imageSummary.aspectRatio;
    }
  }
  review.updated_at = now;

  // Clear existing findings for this review
  store.review_findings = store.review_findings.filter((f) => f.review_id !== reviewId);
  review.findings = [];

  // Insert new findings in local store
  for (const f of result.findings) {
    const findingRecord: ReviewFinding = {
      id: crypto.randomUUID(),
      review_id: reviewId,
      category: f.category,
      severity: f.severity,
      finding_title: f.finding_title,
      explanation: f.explanation,
      evidence_text: f.evidence_text || null,
      guideline_id: f.guideline_id || null,
      fact_id: f.fact_id || null,
      asset_id: f.asset_id || null,
      confidence: f.confidence,
      suggested_fix: f.suggested_fix || null,
      bounding_box: f.bounding_box || null,
      target_type: f.target_type || 'text',
      target_scope: f.target_scope || (f.target_type === 'visual_element' ? 'image' : 'caption'),
      caption_evidence: f.caption_evidence || null,
      image_evidence: f.image_evidence || null,
      proposed_replacement: f.proposed_replacement || null,
      resolution_status: f.resolution_status || 'unresolved',
      needs_human_verification: Boolean(f.needs_human_verification),
      human_verification_reason: f.human_verification_reason || null,
      uncertainty_notes: f.uncertainty_notes || null,
      created_at: now,
    };
    store.review_findings.push(findingRecord);
    review.findings.push(findingRecord);
  }
  writeLocalStore(store);

  // 2. Sync to Supabase if configured
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { error: fullUpdateErr } = await supabase
          .from('content_reviews')
          .update({
            status: result.status,
            compliance_score: result.compliance_score,
            extracted_ocr_text: result.extracted_ocr_text || null,
            evaluation_metadata: result.metadata,
            updated_at: now,
          })
          .eq('id', reviewId);

        if (fullUpdateErr) {
          // If remote table lacks extended columns like evaluation_metadata, update core columns
          await supabase
            .from('content_reviews')
            .update({
              status: result.status,
              compliance_score: result.compliance_score,
              updated_at: now,
            })
            .eq('id', reviewId);
        }

        await supabase.from('review_findings').delete().eq('review_id', reviewId);

        if (result.findings.length > 0) {
          const rows = result.findings.map((f) => ({
            review_id: reviewId,
            category: f.category,
            severity: f.severity,
            finding_title: f.finding_title,
            explanation: f.explanation,
            evidence_text: f.evidence_text || null,
            guideline_id: f.guideline_id || null,
            fact_id: f.fact_id || null,
            confidence: f.confidence,
            suggested_fix: f.suggested_fix || null,
            bounding_box: f.bounding_box || null,
            target_type: f.target_type || 'text',
            resolution_status: f.resolution_status || 'unresolved',
            created_at: now,
          }));

          const { error: insertErr } = await supabase.from('review_findings').insert(rows);
          if (insertErr) {
            console.warn('Initial findings insert failed, retrying with core schema columns:', insertErr.message);
            const coreRows = rows.map((r) => ({
              review_id: r.review_id,
              category: r.category,
              severity: r.severity,
              finding_title: r.finding_title,
              explanation: r.explanation,
              evidence_text: r.evidence_text,
              confidence: r.confidence,
              suggested_fix: r.suggested_fix,
              created_at: r.created_at,
            }));
            const { error: retryErr } = await supabase.from('review_findings').insert(coreRows);
            if (retryErr) {
              console.error('Failed to persist findings to Supabase:', retryErr.message);
            }
          }
        }
      } catch (err) {
        console.warn('Supabase evaluation sync error (fallback active):', err);
      }
    }
  }

  const updated = await getContentReviewById(reviewId);
  if (!updated) throw new Error('Failed to load updated review record');
  return updated;
}

// -------------------------------------------------------------------
// 6. Version Progression & Content Editing
// -------------------------------------------------------------------
export async function updateContentReviewVersion(
  reviewId: string,
  payload: UpdateReviewVersionPayload
): Promise<ContentReview> {
  const now = new Date().toISOString();

  const existing = await getContentReviewById(reviewId);
  if (!existing) {
    throw new Error(`Review with ID "${reviewId}" does not exist.`);
  }

  const updatedText = payload.content_text !== undefined ? payload.content_text.trim() : existing.content_text;
  const newVersion = (existing.review_version || 1) + 1;
  const updatedTitle = payload.title?.trim() || existing.title;
  const updatedType = payload.content_type || existing.content_type;
  const updatedImageUrl = payload.image_url || existing.image_url;
  const isCopySynced = !existing.caption_text || existing.caption_text === existing.content_text || !existing.image_url;
  const updatedCaption = payload.caption_text !== undefined
    ? payload.caption_text
    : isCopySynced && payload.content_text !== undefined
    ? payload.content_text.trim()
    : existing.caption_text;
  const originalImageUrl = payload.original_image_url || existing.original_image_url || existing.image_url || null;
  const originalCaptionText = payload.original_caption_text || existing.original_caption_text || existing.caption_text || existing.content_text || null;
  const newStatus: ReviewStatus = 'in_review';

  // 1. Update in local store
  const store = readLocalStore();
  const review = store.content_reviews.find((r) => r.id === reviewId);
  const isImageReplaced = Boolean(payload.image_url && payload.image_url !== existing.image_url);

  if (review) {
    review.title = updatedTitle;
    review.content_text = updatedText;
    review.caption_text = updatedCaption || null;
    review.content_type = updatedType;
    review.image_url = updatedImageUrl;
    review.original_image_url = originalImageUrl;
    review.original_caption_text = originalCaptionText;
    review.corrected_image_url = payload.corrected_image_url || null;
    if (payload.correction_metadata) {
      review.correction_metadata = payload.correction_metadata;
    }
    // Clear stale OCR, metadata, and previous findings when an image is replaced
    if (isImageReplaced) {
      review.extracted_ocr_text = null;
      review.evaluation_metadata = null;
      store.review_findings = store.review_findings.filter((f) => f.review_id !== reviewId);
    }
    review.review_version = newVersion;
    review.status = newStatus;
    review.compliance_score = null;
    review.updated_at = now;
    writeLocalStore(store);
  }

  // 2. Update in Supabase
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase
          .from('content_reviews')
          .update({
            title: updatedTitle,
            content_text: updatedText,
            content_type: updatedType,
            image_url: updatedImageUrl,
            review_version: newVersion,
            status: newStatus,
            compliance_score: null,
            ...(isImageReplaced ? { extracted_ocr_text: null, evaluation_metadata: null } : {}),
            updated_at: now,
          })
          .eq('id', reviewId);
      } catch (err) {
        console.warn('Supabase version update error:', err);
      }
    }
  }

  // 3. Rerun compliance evaluation against current active guidelines, facts, brand profile, and authorized visual assets
  const { guidelines, facts, assets } = await getAugmentedActiveGuidelinesAndAssets();

  const evalResult = await runComplianceReview(
    updatedText,
    updatedType,
    guidelines,
    facts,
    {
      imageUrl: updatedImageUrl || undefined,
      captionText: updatedCaption || (updatedText && !updatedText.startsWith('[Marketing Post Image:') ? updatedText : undefined),
      assets,
    }
  );

  // 4. Save new findings and final score
  return await saveReviewEvaluation(reviewId, evalResult);
}

// -------------------------------------------------------------------
// 7. Image Pixel Correction & Reanalysis Workflow
// -------------------------------------------------------------------
export async function reanalyzeCorrectedImage(
  reviewId: string,
  params: {
    correctedImageUrl?: string;
    correctionMetadata?: {
      replaced_text?: string;
      new_text?: string;
      target_scope?: 'image' | 'caption' | string;
      replaced_asset_id?: string;
      edit_applied_to_pixels?: boolean;
      correction_notes?: string;
      [key: string]: unknown;
    };
  }
): Promise<{
  review: ContentReview;
  resolvedFindings: ReviewFinding[];
  remainingFindings: ReviewFinding[];
  unverifiedFindings: ReviewFinding[];
}> {
  const existing = await getContentReviewById(reviewId);
  if (!existing) {
    throw new Error(`Review ${reviewId} not found.`);
  }

  const previousFindings = existing.findings || [];
  const meta = params.correctionMetadata;
  const isPixelEdit = Boolean(meta?.edit_applied_to_pixels && params.correctedImageUrl);
  const isCaptionEdit = meta?.target_scope === 'caption' && meta?.replaced_text && meta?.new_text !== undefined;

  let currentCaption = existing.caption_text || existing.original_caption_text || (existing.content_text && !existing.content_text.startsWith('[Marketing Post Image:') ? existing.content_text : '');

  if (isCaptionEdit) {
    if (!currentCaption || !currentCaption.includes(meta.replaced_text!)) {
      throw new Error(`Target text "${meta.replaced_text}" was not found in the caption. Caption: "${currentCaption}"`);
    }
    currentCaption = currentCaption.replace(meta.replaced_text!, meta.new_text!);
  } else if (meta?.replaced_text && meta?.new_text !== undefined && currentCaption && currentCaption.includes(meta.replaced_text)) {
    currentCaption = currentCaption.replace(meta.replaced_text, meta.new_text);
  }

  // Determine active image URL
  const newImageUrl = params.correctedImageUrl?.trim()
    ? params.correctedImageUrl.trim()
    : (existing.image_url || existing.original_image_url || '');

  // Update review to Version 2 (or N+1) with preserved original fields and genuine re-evaluation
  const updated = await updateContentReviewVersion(reviewId, {
    title: existing.title,
    content_text: currentCaption && currentCaption.trim() ? currentCaption : (existing.content_text && !existing.content_text.startsWith('[Marketing Post Image:') ? existing.content_text : `[Marketing Post Image: ${newImageUrl}]`),
    caption_text: currentCaption,
    content_type: existing.content_type,
    image_url: newImageUrl,
    corrected_image_url: params.correctedImageUrl || undefined,
    original_image_url: existing.original_image_url || existing.image_url || undefined,
    original_caption_text: existing.original_caption_text || existing.caption_text || undefined,
    correction_metadata: {
      ...(meta || {}),
      target_scope: meta?.target_scope || (isPixelEdit ? 'image' : 'caption'),
      edit_applied_to_pixels: isPixelEdit,
      correction_notes: meta?.correction_notes || (isCaptionEdit ? 'Synchronized caption copy.' : `Applied visual fix to creative pixels.`),
    },
  });

  const newFindings = updated.findings || [];

  // Identify resolved vs remaining findings by comparing old findings against current re-analysis findings
  const resolvedFindings: ReviewFinding[] = [];
  const remainingFindings: ReviewFinding[] = [];
  const unverifiedFindings: ReviewFinding[] = [];

  for (const prev of previousFindings) {
    const stillExistsInNew = newFindings.some(
      (nf) =>
        nf.category === prev.category &&
        (nf.finding_title === prev.finding_title ||
          (nf.evidence_text && prev.evidence_text && (nf.evidence_text === prev.evidence_text || nf.evidence_text.includes(prev.evidence_text) || prev.evidence_text.includes(nf.evidence_text))))
    );

    if (!stillExistsInNew) {
      resolvedFindings.push({
        ...prev,
        resolution_status: 'resolved',
      });
    } else {
      remainingFindings.push({
        ...prev,
        resolution_status: 'unresolved',
      });
    }
  }

  return {
    review: updated,
    resolvedFindings,
    remainingFindings,
    unverifiedFindings,
  };
}

// -------------------------------------------------------------------
// 8. Review Decisions (Approvals, Flags, Overrides)
// -------------------------------------------------------------------
export async function createReviewDecision(
  reviewId: string,
  payload: CreateDecisionPayload
): Promise<ReviewDecision> {
  const config = getServerDbConfigStatus();
  const now = new Date().toISOString();

  const current = await getContentReviewById(reviewId);
  if (!current) {
    throw new Error(`Review with ID "${reviewId}" does not exist.`);
  }

  if (current.status === 'draft' || current.compliance_score === null) {
    throw new Error(
      'Approval blocked: The compliance review has not completed. Cannot approve or finalize a draft review.'
    );
  }

  const hasCritical = current.findings?.some((f) => f.severity === 'critical');
  if (payload.decision === 'approved' && hasCritical && !payload.is_override) {
    throw new Error(
      'Approval blocked: Content has active critical policy violations. Use Authorized Override with a documented rationale.'
    );
  }

  if (payload.is_override && (!payload.override_reason || !payload.override_reason.trim())) {
    throw new Error('Authorized override requires an explicit, audited business reason.');
  }

  let targetStatus: ReviewStatus = 'pending';
  if (payload.decision === 'approved') {
    targetStatus = 'approved';
  } else if (payload.decision === 'rejected') {
    targetStatus = 'rejected';
  } else if (payload.decision === 'changes_requested') {
    targetStatus = 'changes_requested';
  } else {
    targetStatus = 'flagged';
  }

  let finalComments = payload.comments?.trim() || null;
  if (payload.is_override) {
    const overrideNote = `[AUTHORIZED OVERRIDE - Reason: ${payload.override_reason?.trim()} - Reviewer: ${payload.reviewer_label}]`;
    finalComments = finalComments ? `${finalComments}\n\n${overrideNote}` : overrideNote;
  }

  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data: decision, error: decisionError } = await supabase
        .from('review_decisions')
        .insert({
          review_id: reviewId,
          decision: payload.decision,
          reviewer_label: payload.reviewer_label.trim(),
          comments: finalComments,
          created_at: now,
        })
        .select()
        .single();

      if (decisionError) throw new Error(decisionError.message);

      await supabase
        .from('content_reviews')
        .update({
          status: targetStatus,
          updated_at: now,
        })
        .eq('id', reviewId);

      return decision as ReviewDecision;
    }
  }

  // Fallback
  const store = readLocalStore();
  const localReview = store.content_reviews.find((r) => r.id === reviewId);
  if (!localReview) throw new Error('Content review not found');

  const newDecision: ReviewDecision = {
    id: crypto.randomUUID(),
    review_id: reviewId,
    decision: payload.decision,
    reviewer_label: payload.reviewer_label.trim(),
    comments: finalComments,
    is_override: payload.is_override,
    override_reason: payload.override_reason,
    created_at: now,
  };

  store.review_decisions.unshift(newDecision);
  localReview.status = targetStatus;
  localReview.updated_at = now;
  writeLocalStore(store);
  return newDecision;
}

// -------------------------------------------------------------------
// 9. Dashboard Metrics Computation
// -------------------------------------------------------------------
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [reviews, guidelines, facts] = await Promise.all([
    getContentReviews(),
    getBrandGuidelines(),
    getApprovedFacts(),
  ]);

  const totalReviews = reviews.length;
  const approvedCount = reviews.filter((r) => r.status === 'approved').length;
  const flaggedCount = reviews.filter((r) => r.status === 'flagged' || r.status === 'rejected').length;
  const pendingCount = reviews.filter((r) => r.status === 'pending' || r.status === 'in_review').length;

  const scoredReviews = reviews.filter((r) => typeof r.compliance_score === 'number');
  const avgScore =
    scoredReviews.length > 0
      ? Math.round(
          scoredReviews.reduce((sum, r) => sum + (r.compliance_score || 0), 0) / scoredReviews.length
        )
      : null;

  const activeGuidelinesCount = guidelines.filter((g) => g.is_active).length;
  const activeFactsCount = facts.filter((f) => f.is_active).length;

  let latestDecision: ReviewDecision | null = null;
  const allDecisions = reviews.flatMap((r) => r.decisions || []);
  if (allDecisions.length > 0) {
    allDecisions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    latestDecision = allDecisions[0];
  }

  return {
    totalReviews,
    approvedCount,
    flaggedCount,
    pendingCount,
    averageComplianceScore: avgScore,
    activeGuidelinesCount,
    totalGuidelinesCount: guidelines.length,
    activeFactsCount,
    totalFactsCount: facts.length,
    latestDecision,
  };
}

// -------------------------------------------------------------------
// 10. Brand Quick-Setup Initializer Workflow
// -------------------------------------------------------------------
export async function initializeBrandRulesAndFacts(brandName: string): Promise<{
  guidelinesCreated: number;
  factsCreated: number;
  assetsCreated: number;
}> {
  const defaultRules: CreateGuidelinePayload[] = [
    {
      title: `${brandName} Professional Tone & Brand Voice`,
      description: 'Communications must be authoritative, clear, and customer-focused. Avoid excessive hyperbole or unsupported claims.',
      rule_type: 'voice_and_tone',
      severity: 'high',
      rule_configuration: {
        keywords: ['revolutionary', 'game-changing', 'miracle', 'insane results'],
        allowed_examples: ['Enterprise-grade architecture', 'Engineered for reliability'],
        forbidden_examples: ['The only solution on Earth', 'Instantly cures all problems'],
      },
      is_active: true,
    },
    {
      title: 'Prohibit Absolute Guarantees Without Disclaimers',
      description: 'Prohibit marketing statements guaranteeing 100% invulnerability, complete security, or zero defects without explicit disclaimers.',
      rule_type: 'prohibited_claim',
      severity: 'critical',
      rule_configuration: {
        keywords: ['100% secure', 'unhackable', 'foolproof', 'zero risk', '100% guarantee'],
        forbidden_examples: ['Guarantees 100% unhackable security', 'Completely eliminates all risks'],
        allowed_examples: ['Multi-layered defense model designed to mitigate attack surfaces'],
      },
      is_active: true,
    },
    {
      title: 'Mandatory Trademark Attribution & Regulatory Disclaimers',
      description: 'When referencing partner technologies, enterprise integrations, or financial projections, include mandatory disclaimers.',
      rule_type: 'required_disclaimer',
      severity: 'medium',
      rule_configuration: {
        keywords: ['partner marks', 'registered trademarks', 'results may vary'],
        allowed_examples: ['All trademarks are property of their respective owners. Past performance does not guarantee future results.'],
      },
      is_active: true,
    },
    {
      title: 'Social Post Aspect Ratio Governance',
      description: 'Marketing creatives for social media channels must be published in standard 1:1 Square (1080x1080) or 4:5 Portrait (1080x1350) format.',
      rule_type: 'aspect_ratio',
      severity: 'low',
      rule_configuration: {
        allowed_examples: ['1:1 (Square)', '4:5 (Portrait)'],
      },
      is_active: true,
    },
    {
      title: 'Brand Palette & Visual Identity Standards',
      description: 'Marketing assets must adhere to deep-teal (#0F766E), charcoal (#111827), and warm neutral backgrounds. Fluorescent/neon gradients are prohibited.',
      rule_type: 'color_palette',
      severity: 'medium',
      rule_configuration: {
        keywords: ['neon purple', 'fluorescent green', 'rainbow gradient'],
        allowed_examples: ['Deep Teal (#0F766E)', 'Charcoal (#111827)'],
      },
      is_active: true,
    },
  ];

  const defaultFacts: CreateFactPayload[] = [
    {
      fact_text: `${brandName} enterprise platform maintains a documented 99.9% uptime SLA.`,
      source_name: 'Illustrative Enterprise SLA Benchmark (Demo Spec)',
      source_url: 'https://brandguard.internal/sla',
      evidence_notes: 'Illustrative Benchmark Only — Documented baseline for demonstration purposes.',
      is_active: true,
    },
    {
      fact_text: `${brandName} data centers operate with SOC-2 Type II and ISO 27001 certified security frameworks.`,
      source_name: 'Illustrative Security Benchmark (Demo Spec)',
      source_url: 'https://brandguard.internal/compliance/soc2',
      evidence_notes: 'Illustrative Benchmark Only — Audit framework baseline for demonstration purposes.',
      is_active: true,
    },
  ];

  const defaultAssets: CreateAssetPayload[] = [
    {
      asset_name: `${brandName} Official Primary Logo`,
      asset_type: 'logo',
      file_url: '/assets/logo-primary.svg',
      asset_metadata: {
        is_primary: true,
        allowed_aspect_ratios: ['1:1', 'horizontal'],
        notes: 'Official vectorized logo mark for all pre-publication marketing collateral.',
      },
      is_active: true,
    },
    {
      asset_name: `${brandName} Official Brand Palette`,
      asset_type: 'color_palette',
      file_url: '/assets/brand-palette.json',
      asset_metadata: {
        hex_colors: ['#0F766E', '#111827', '#F8F9FA', '#0D9488', '#E5E7EB'],
        notes: 'Restrained deep-teal, charcoal, warm neutral, and subtle slate borders.',
      },
      is_active: true,
    },
    {
      asset_name: 'SOC-2 Type II Verification Badge',
      asset_type: 'badge',
      file_url: '/assets/soc2-badge.svg',
      asset_metadata: {
        notes: 'Authorized trust badge for enterprise collateral and landing page creatives.',
      },
      is_active: true,
    },
  ];

  let guidelinesCreated = 0;
  for (const rule of defaultRules) {
    await createBrandGuideline(rule);
    guidelinesCreated++;
  }

  let factsCreated = 0;
  for (const fact of defaultFacts) {
    await createApprovedFact(fact);
    factsCreated++;
  }

  let assetsCreated = 0;
  for (const asset of defaultAssets) {
    await createAuthorizedAsset(asset);
    assetsCreated++;
  }

  return { guidelinesCreated, factsCreated, assetsCreated };
}

/**
 * Updates the resolution_status of a specific finding (e.g. 'reviewed', 'overridden', 'unresolved')
 * Persists cleanly to local storage and Supabase review_findings table.
 */
export async function updateFindingResolutionStatus(
  reviewId: string,
  findingId: string,
  resolutionStatus: 'unresolved' | 'resolved' | 'reviewed' | 'overridden' = 'reviewed'
): Promise<ContentReview | null> {
  const store = readLocalStore();
  const review = store.content_reviews.find((r) => r.id === reviewId);
  if (!review) return null;

  // 1. Update in review.findings array
  if (Array.isArray(review.findings)) {
    const finding = review.findings.find(
      (f) => f.id === findingId || f.finding_title === findingId
    );
    if (finding) {
      finding.resolution_status = resolutionStatus as any;
    }
  }

  // 2. Update in store.review_findings
  if (Array.isArray(store.review_findings)) {
    const lf = store.review_findings.find(
      (f) => f.id === findingId || (f.review_id === reviewId && f.finding_title === findingId)
    );
    if (lf) {
      lf.resolution_status = resolutionStatus as any;
    }
  }

  review.updated_at = new Date().toISOString();
  writeLocalStore(store);

  // 3. Sync to Supabase if configured
  const config = getServerDbConfigStatus();
  if (config.isConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase
          .from('review_findings')
          .update({ resolution_status: resolutionStatus })
          .eq('id', findingId);
      } catch (err) {
        console.warn('Supabase finding resolution update warning:', err);
      }
    }
  }

  return review;
}
