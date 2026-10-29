import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

async function checkLineConfidences() {
  const imgPath = path.join(process.cwd(), 'public', 'uploads', 'creatives', 'cf9f5512-afd3-42c0-960b-90bc036f09e7.png');
  const buffer = fs.readFileSync(imgPath);

  const prep = await sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1, m1: 0.5, m2: 2 })
    .png()
    .toBuffer();

  const worker = await createWorker('eng', 1);
  const ret = await worker.recognize(prep, {}, { blocks: true, text: true });

  for (const block of ret.data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        console.log(`[Conf: ${line.confidence}] "${line.text.trim()}"`);
      }
    }
  }

  await worker.terminate();
}

checkLineConfidences();
