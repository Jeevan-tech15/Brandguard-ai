-- ====================================================================
-- BrandGuard AI — Complete Database Schema & RLS Security Script
-- Supabase PostgreSQL Setup & Image-First Governance Migration
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. brand_guidelines
-- ====================================================================
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- e.g., 'voice_and_tone', 'prohibited_claim', 'required_disclaimer', 'brand_safety', 'style_grammar'
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rule_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- 2. approved_facts
-- ====================================================================
CREATE TABLE IF NOT EXISTS approved_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_text TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  evidence_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- 3. authorized_assets (Logos, Color Swatches, Badges, Certification Marks)
-- ====================================================================
CREATE TABLE IF NOT EXISTS authorized_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'color_palette', 'badge', 'product_image', 'typography')),
  file_url TEXT NOT NULL,
  asset_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "hex_colors": ["#0F766E"], "allowed_aspect_ratios": ["1:1"], "is_primary": true }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- 4. content_reviews (Image-First & Multi-Version Reviews)
-- ====================================================================
CREATE TABLE IF NOT EXISTS content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_text TEXT NOT NULL,
  content_type TEXT NOT NULL, -- e.g., 'social_media', 'email_marketing', 'ad_copy', 'press_release', 'blog_post', 'website_copy', 'other'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'flagged', 'rejected', 'changes_requested', 'draft')),
  compliance_score NUMERIC(5, 2) CHECK (compliance_score >= 0 AND compliance_score <= 100),
  review_version INTEGER NOT NULL DEFAULT 1,
  -- Image-First Governance Extensions
  image_url TEXT,
  caption_text TEXT,
  aspect_ratio TEXT, -- '1:1', '4:5', '9:16', '16:9'
  image_width INTEGER,
  image_height INTEGER,
  extracted_ocr_text TEXT,
  corrected_image_url TEXT,
  correction_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema Evolution Migration for existing installations
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS caption_text TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS aspect_ratio TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS image_height INTEGER;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS extracted_ocr_text TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS corrected_image_url TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS correction_metadata JSONB DEFAULT '{}'::jsonb;

-- ====================================================================
-- 5. review_findings (Evidence-backed findings with bounding boxes)
-- ====================================================================
CREATE TABLE IF NOT EXISTS review_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES content_reviews(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  finding_title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  evidence_text TEXT,
  guideline_id UUID REFERENCES brand_guidelines(id) ON DELETE SET NULL,
  fact_id UUID REFERENCES approved_facts(id) ON DELETE SET NULL,
  confidence NUMERIC(4, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  suggested_fix TEXT,
  -- Visual Governance & Correction Extensions
  bounding_box JSONB, -- { "ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000 }
  asset_id UUID REFERENCES authorized_assets(id) ON DELETE SET NULL,
  target_type TEXT DEFAULT 'text', -- 'text', 'visual_element', 'logo', 'color', 'layout'
  resolution_status TEXT DEFAULT 'unresolved', -- 'unresolved', 'resolved', 'overridden'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema Evolution Migration for review_findings
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS bounding_box JSONB;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES authorized_assets(id) ON DELETE SET NULL;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'text';
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'unresolved';

-- ====================================================================
-- 6. review_decisions
-- ====================================================================
CREATE TABLE IF NOT EXISTS review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES content_reviews(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'flagged', 'rejected', 'changes_requested')),
  reviewer_label TEXT NOT NULL,
  comments TEXT,
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- Performance Indexes
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_is_active ON brand_guidelines(is_active);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_rule_type ON brand_guidelines(rule_type);
CREATE INDEX IF NOT EXISTS idx_approved_facts_is_active ON approved_facts(is_active);
CREATE INDEX IF NOT EXISTS idx_authorized_assets_is_active ON authorized_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_authorized_assets_type ON authorized_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);
CREATE INDEX IF NOT EXISTS idx_content_reviews_created_at ON content_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_findings_review_id ON review_findings(review_id);
CREATE INDEX IF NOT EXISTS idx_review_findings_guideline_id ON review_findings(guideline_id);
CREATE INDEX IF NOT EXISTS idx_review_findings_fact_id ON review_findings(fact_id);
CREATE INDEX IF NOT EXISTS idx_review_findings_asset_id ON review_findings(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_review_id ON review_decisions(review_id);

-- ====================================================================
-- Automated Timestamp Triggers
-- ====================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_brand_guidelines_timestamp ON brand_guidelines;
CREATE TRIGGER trg_update_brand_guidelines_timestamp
BEFORE UPDATE ON brand_guidelines
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_update_approved_facts_timestamp ON approved_facts;
CREATE TRIGGER trg_update_approved_facts_timestamp
BEFORE UPDATE ON approved_facts
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_update_authorized_assets_timestamp ON authorized_assets;
CREATE TRIGGER trg_update_authorized_assets_timestamp
BEFORE UPDATE ON authorized_assets
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_update_content_reviews_timestamp ON content_reviews;
CREATE TRIGGER trg_update_content_reviews_timestamp
BEFORE UPDATE ON content_reviews
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ====================================================================
-- Row Level Security (RLS) Configuration
-- ====================================================================
ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;

-- SELECT Policies: Allow reading by anon and authenticated users (idempotent)
DROP POLICY IF EXISTS "Allow public read brand_guidelines" ON brand_guidelines;
CREATE POLICY "Allow public read brand_guidelines"
  ON brand_guidelines FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read approved_facts" ON approved_facts;
CREATE POLICY "Allow public read approved_facts"
  ON approved_facts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read authorized_assets" ON authorized_assets;
CREATE POLICY "Allow public read authorized_assets"
  ON authorized_assets FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read content_reviews" ON content_reviews;
CREATE POLICY "Allow public read content_reviews"
  ON content_reviews FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read review_findings" ON review_findings;
CREATE POLICY "Allow public read review_findings"
  ON review_findings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read review_decisions" ON review_decisions;
CREATE POLICY "Allow public read review_decisions"
  ON review_decisions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public submission and decision policies (idempotent)
DROP POLICY IF EXISTS "Allow public submission content_reviews" ON content_reviews;
CREATE POLICY "Allow public submission content_reviews"
  ON content_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status IN ('pending', 'draft', 'in_review')
    AND length(trim(title)) > 0
  );

DROP POLICY IF EXISTS "Allow public insert review_decisions" ON review_decisions;
CREATE POLICY "Allow public insert review_decisions"
  ON review_decisions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    decision IN ('approved', 'flagged', 'rejected', 'changes_requested')
    AND length(trim(reviewer_label)) > 0
  );
