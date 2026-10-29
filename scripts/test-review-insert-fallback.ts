import { isMissingColumnError, createContentReview } from '../src/lib/db';

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: REVIEW INSERT FALLBACK & IMAGE URL SAFETY');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    }
  }

  // --- 1. Distinguishing Missing Column Errors vs Other DB Errors ---
  console.log('--- 1. Testing isMissingColumnError() Classification ---');

  // Case A: PostgreSQL 42703 undefined_column
  assert(
    isMissingColumnError({ code: '42703', message: 'column "caption_text" of relation "content_reviews" does not exist' }) === true,
    'Classifies PostgreSQL 42703 (undefined_column) as missing column error'
  );

  // Case B: PostgREST PGRST204 schema cache column missing
  assert(
    isMissingColumnError({ code: 'PGRST204', message: "Could not find the 'caption_text' column of 'content_reviews' in the schema cache" }) === true,
    'Classifies PostgREST PGRST204 as missing column error'
  );

  // Case C: Message containing undefined column text without code
  assert(
    isMissingColumnError({ message: 'column "aspect_ratio" does not exist' }) === true,
    'Classifies message "column ... does not exist" as missing column error'
  );

  // Case D: RLS policy violation (Must NOT be treated as missing column)
  assert(
    isMissingColumnError({ code: '42501', message: 'new row violates row-level security policy for table "content_reviews"' }) === false,
    'Does NOT treat RLS policy violation (42501) as missing column error'
  );

  // Case E: Not-null constraint violation (Must NOT be treated as missing column)
  assert(
    isMissingColumnError({ code: '23502', message: 'null value in column "title" violates not-null constraint' }) === false,
    'Does NOT treat not-null constraint violation (23502) as missing column error'
  );

  // Case F: Check constraint violation (Must NOT be treated as missing column)
  assert(
    isMissingColumnError({ code: '23514', message: 'check constraint "content_reviews_status_check" violated' }) === false,
    'Does NOT treat check constraint violation as missing column error'
  );

  // Case G: Connection error / network timeout
  assert(
    isMissingColumnError({ message: 'FetchError: network timeout connecting to Supabase' }) === false,
    'Does NOT treat network timeout as missing column error'
  );

  // Case H: Null / undefined error
  assert(
    isMissingColumnError(null) === false && isMissingColumnError(undefined) === false,
    'Handles null and undefined error inputs safely'
  );

  // --- 2. Testing createContentReview Image URL Preservation ---
  console.log('\n--- 2. Testing createContentReview() Image URL Preservation ---');

  const testImageUrl = 'https://supabase.co/storage/v1/object/public/brandguard-creatives/test-creative-123.png';
  const testTitle = `Insert Fallback Test Campaign ${Date.now()}`;

  const review = await createContentReview(
    {
      title: testTitle,
      content_type: 'social_media',
      content_text: '[Creative Image: test-creative.png]',
      image_url: testImageUrl,
      caption_text: 'Test promotional caption for beverage product',
      aspect_ratio: '1:1',
      image_width: 1080,
      image_height: 1080,
      save_as_draft: true,
      status: 'draft',
    },
    { skipEvaluation: true }
  );

  assert(
    Boolean(review.id && review.id.length > 0),
    'Review record is created with valid ID',
    `ID: ${review.id}`
  );

  assert(
    review.image_url === testImageUrl,
    'Review preserves exact image_url without dropping or nullifying it',
    `Expected: "${testImageUrl}", Got: "${review.image_url}"`
  );

  assert(
    review.image_url !== null && review.image_url !== '',
    'image_url is strictly non-null and non-empty for image review'
  );

  assert(
    review.original_image_url === testImageUrl,
    'original_image_url is preserved alongside image_url',
    `Expected: "${testImageUrl}", Got: "${review.original_image_url}"`
  );

  console.log('\n====================================================');
  console.log(`TOTAL: ${passed} / ${total} CHECKS PASSED`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});

