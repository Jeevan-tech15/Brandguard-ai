import { getContentReviews } from '../src/lib/db';

async function main() {
  const reviews = await getContentReviews();
  const sorted = [...reviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const r of sorted.slice(0, 5)) {
    console.log('----------------------------------------------------');
    console.log('ID:', r.id);
    console.log('Created:', r.created_at);
    console.log('Title:', r.title);
    console.log('Caption:', r.caption_text);
    console.log('Image URL:', r.image_url);
    console.log('Findings count:', r.findings?.length);
    console.log('Score:', r.compliance_score);
    console.log('OCR text:\n' + r.extracted_ocr_text);
  }
}

main();
