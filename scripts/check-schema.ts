import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('Testing Supabase tables...');
  const { data: assets, error: assetErr } = await supabase.from('authorized_assets').select('*').limit(1);
  console.log('authorized_assets:', assetErr ? assetErr.message : 'EXISTS');

  const { data: rev, error: revErr } = await supabase.from('content_reviews').select('image_url, extracted_ocr_text').limit(1);
  console.log('content_reviews new cols:', revErr ? revErr.message : 'EXISTS');

  const { data: findings, error: findErr } = await supabase.from('review_findings').select('bounding_box, asset_id').limit(1);
  console.log('review_findings new cols:', findErr ? findErr.message : 'EXISTS');
}

check();
