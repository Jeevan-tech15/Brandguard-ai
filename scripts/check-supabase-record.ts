import { getContentReviewById } from '../src/lib/db';
import { getSupabaseServerClient } from '../src/lib/supabase/server';

async function main() {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    const { data, error } = await supabase.from('content_reviews').select('*').eq('id', '8a7ffde0-2150-4931-b37b-8cfc895b1f4f').single();
    console.log('Supabase record:', data, 'Error:', error);
  }
  const review = await getContentReviewById('8a7ffde0-2150-4931-b37b-8cfc895b1f4f');
  console.log('getContentReviewById:', {
    status: review?.status,
    compliance_score: review?.compliance_score,
    findingsCount: review?.findings?.length
  });
}
main().catch(console.error);
