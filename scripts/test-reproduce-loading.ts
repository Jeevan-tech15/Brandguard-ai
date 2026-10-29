import { createContentReview } from '../src/lib/db';

async function test() {
  console.log('Testing createContentReview...');
  const start = Date.now();
  try {
    const res = await createContentReview({
      title: 'Test Review',
      content_type: 'social_media',
      content_text: 'Test caption with drinks cold for 48 hours and 80% discount',
      caption_text: 'Test caption with drinks cold for 48 hours and 80% discount',
      image_url: '/uploads/creatives/912e251e-1510-4f95-bb6c-326be2d76f36.png',
      aspect_ratio: '1:1',
      image_width: 1080,
      image_height: 1080,
      save_as_draft: false,
      status: 'in_review',
    });
    console.log('Success in', Date.now() - start, 'ms:');
    console.log('Review ID:', res.id);
    console.log('Status:', res.status);
    console.log('Score:', res.compliance_score);
    console.log('Findings count:', res.findings?.length);
  } catch (e) {
    console.error('Error after', Date.now() - start, 'ms:', e);
  }
}
test();
