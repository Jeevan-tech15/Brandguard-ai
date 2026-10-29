-- Migration: 20261022000000_init_brandguard.sql
-- BrandGuard AI Core Schema & Row Level Security

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rule_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_text TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'flagged', 'rejected', 'changes_requested')),
  compliance_score NUMERIC(5, 2) CHECK (compliance_score >= 0 AND compliance_score <= 100),
  review_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES content_reviews(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'flagged', 'rejected', 'changes_requested')),
  reviewer_label TEXT NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_guidelines_is_active ON brand_guidelines(is_active);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_rule_type ON brand_guidelines(rule_type);
CREATE INDEX IF NOT EXISTS idx_approved_facts_is_active ON approved_facts(is_active);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);
CREATE INDEX IF NOT EXISTS idx_content_reviews_created_at ON content_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_findings_review_id ON review_findings(review_id);
CREATE INDEX IF NOT EXISTS idx_review_findings_guideline_id ON review_findings(guideline_id);
CREATE INDEX IF NOT EXISTS idx_review_findings_fact_id ON review_findings(fact_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_review_id ON review_decisions(review_id);

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

DROP TRIGGER IF EXISTS trg_update_content_reviews_timestamp ON content_reviews;
CREATE TRIGGER trg_update_content_reviews_timestamp
BEFORE UPDATE ON content_reviews
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Allow public submission content_reviews" ON content_reviews;
CREATE POLICY "Allow public submission content_reviews"
  ON content_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND length(trim(title)) > 0
    AND length(trim(content_text)) > 0
  );

DROP POLICY IF EXISTS "Allow public insert review_decisions" ON review_decisions;
CREATE POLICY "Allow public insert review_decisions"
  ON review_decisions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    decision IN ('approved', 'flagged', 'rejected', 'changes_requested')
    AND length(trim(reviewer_label)) > 0
  );
