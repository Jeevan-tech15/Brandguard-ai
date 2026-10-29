-- ====================================================================
-- BrandGuard AI — Image-Only Governance & Brand Profile Migration
-- Migration: 20261027000000_image_only_governance.sql
-- ====================================================================

-- 1. Ensure authorized_assets table exists
CREATE TABLE IF NOT EXISTS authorized_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'color_palette', 'badge', 'product_image', 'typography')),
  file_url TEXT NOT NULL,
  asset_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure brand_profiles table for unified identity persistence
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL,
  brand_description TEXT DEFAULT '',
  brand_colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  typography_preferences TEXT DEFAULT '',
  official_logo_url TEXT,
  official_logo_id UUID REFERENCES authorized_assets(id) ON DELETE SET NULL,
  tone_of_voice TEXT DEFAULT '',
  prohibited_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_disclaimers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Update content_reviews for Image-Only Governance
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS aspect_ratio TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS image_height INTEGER;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS extracted_ocr_text TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS corrected_image_url TEXT;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS correction_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE content_reviews ADD COLUMN IF NOT EXISTS evaluation_metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Update review_findings for visual bounding boxes and verification notes
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS bounding_box JSONB;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES authorized_assets(id) ON DELETE SET NULL;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'text';
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS location_description TEXT;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'unresolved';
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS needs_human_verification BOOLEAN DEFAULT false;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS human_verification_reason TEXT;
ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS uncertainty_notes TEXT;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE authorized_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Read / Write Policies for App Clients
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read authorized_assets') THEN
    CREATE POLICY "Allow read authorized_assets" ON authorized_assets FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write authorized_assets') THEN
    CREATE POLICY "Allow write authorized_assets" ON authorized_assets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read brand_profiles') THEN
    CREATE POLICY "Allow read brand_profiles" ON brand_profiles FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write brand_profiles') THEN
    CREATE POLICY "Allow write brand_profiles" ON brand_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
