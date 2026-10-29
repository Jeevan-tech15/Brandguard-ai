import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { runVisionAnalysis } from '../src/lib/engine/vision-analyzer';
import { runCrossModalChecks } from '../src/lib/engine/cross-modal';
import { runComplianceReview } from '../src/lib/engine';

async function main() {
  console.log('Testing SoundZen creative with 60% OFF...');

  // Create SVG with 60% OFF
  const svg = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f172a"/>
    <text x="80" y="200" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="#ffffff">SoundZen Audio</text>
    <text x="80" y="340" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#38bdf8">FLAT 60% OFF</text>
    <text x="80" y="440" font-family="Arial, sans-serif" font-size="32" fill="#94a3b8">Premium Noise Cancelling</text>
  </svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const testImagePath = path.join(process.cwd(), 'public', 'uploads', 'creatives', 'soundzen-test.png');
  fs.writeFileSync(testImagePath, pngBuffer);

  const vResult = await runVisionAnalysis({
    imageUrl: '/uploads/creatives/soundzen-test.png',
    guidelines: [],
    facts: [],
    assets: [],
  });

  console.log('Extracted OCR text:');
  console.log(vResult.extracted_ocr_text);
  console.log('Confidence:', vResult.ocrConfidence);

  const caption = 'Get the best audio with SoundZen! FLAT 50% OFF today.';
  const cmResult = runCrossModalChecks(vResult.extracted_ocr_text, caption);
  console.log('Cross-modal findings count:', cmResult.findings.length);
  for (const f of cmResult.findings) {
    console.log(`- Finding: ${f.finding_title}`);
    console.log(`  Evidence: ${f.evidence_text}`);
  }

  // Also test full compliance review
  const fullReview = await runComplianceReview(caption, 'social_media', [], [], {
    imageUrl: '/uploads/creatives/soundzen-test.png',
    captionText: caption,
  });

  console.log('Full review findings count:', fullReview.findings.length);
  for (const f of fullReview.findings) {
    console.log(`- [${f.target_scope}] ${f.finding_title}: ${f.evidence_text}`);
  }

  // Cleanup
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
  }
}

main().catch(console.error);
