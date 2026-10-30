import { BrandGuideline, ApprovedFact, AuthorizedAsset, RuleSeverity, BoundingBox, ImageSummaryStats, FindingCategory } from '@/lib/types';
import { EngineFinding, LogoPresenceResult } from './types';
import {
  auditImageTextAndTypography,
  auditImageLogoAndBrandIdentity,
  auditImageUnwantedAndSuspiciousElements,
  auditImageDatesAndDeadlines,
  auditImageAbusiveOrHarmfulLanguage,
  auditImageVisualAndDesignQuality,
  auditImageBrandAndMarketingClaims,
  auditImageCopyrightAndIpRisks,
} from './image-first-analyzer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

export function buildGeminiUrl(customUrl: string | undefined, model: string, apiKey: string): string {
  if (!customUrl) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  }
  const trimmed = customUrl.trim().replace(/\/+$/, '');
  if (trimmed.includes(':generateContent')) {
    if (trimmed.includes('key=') || !apiKey) return trimmed;
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}key=${apiKey}`;
  }
  const baseHost = trimmed.endsWith('/v1beta') ? trimmed.slice(0, -'/v1beta'.length) : trimmed;
  return `${baseHost}/v1beta/models/${model}:generateContent${apiKey ? `?key=${apiKey}` : ''}`;
}

export interface VisionAnalysisResult {
  visionRun: boolean;
  provider?: string;
  model?: string;
  reason?: string;
  extracted_ocr_text: string;
  ocrConfidence?: number | null;
  ocrWordsCount?: number;
  ocrLinesCount?: number;
  unreadableSegmentsCount?: number;
  imageSummary?: ImageSummaryStats | null;
  boundingBoxes?: Array<{ text: string; confidence: number; bbox: BoundingBox }>;
  findings: EngineFinding[];
  disclosures: string[];
  logoPresence?: LogoPresenceResult;
}

export interface VisionAnalysisParams {
  imageUrl: string;
  guidelines: BrandGuideline[];
  facts: ApprovedFact[];
  assets: AuthorizedAsset[];
  ocrReferenceText?: string;
  captionText?: string;
  timeoutMs?: number;
  skipAI?: boolean;
}

interface LocalOcrResult {
  text: string;
  confidence: number | null;
  wordsCount: number;
  linesCount: number;
  unreadableCount: number;
  boundingBoxes: Array<{ text: string; confidence: number; bbox: BoundingBox }>;
  ocrError?: string;
}

/**
 * Loads image buffer from local storage, data URL, or remote URL
 */
export async function loadImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    if (fs.existsSync(imageUrl)) {
      const buffer = fs.readFileSync(imageUrl);
      const ext = path.extname(imageUrl).toLowerCase();
      const mimeType =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'image/jpeg';
      return { buffer, mimeType };
    }

    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
      const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
      const fullPath = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'image/jpeg';
        return { buffer, mimeType };
      }
    }

    if (imageUrl.startsWith('data:image/')) {
      const parts = imageUrl.split(';base64,');
      const mimeType = parts[0].replace('data:', '');
      const buffer = Buffer.from(parts[1], 'base64');
      return { buffer, mimeType };
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // 1. Check local public upload mirrors
      try {
        const urlObj = new URL(imageUrl);
        const filename = path.basename(urlObj.pathname);
        if (filename && filename.length > 3) {
          const localCreativePath = path.join(process.cwd(), 'public', 'uploads', 'creatives', filename);
          if (fs.existsSync(localCreativePath)) {
            const buffer = fs.readFileSync(localCreativePath);
            const ext = path.extname(localCreativePath).toLowerCase();
            const mimeType =
              ext === '.png'
                ? 'image/png'
                : ext === '.webp'
                  ? 'image/webp'
                  : ext === '.svg'
                    ? 'image/svg+xml'
                    : 'image/jpeg';
            return { buffer, mimeType };
          }
          const localAssetPath = path.join(process.cwd(), 'public', 'uploads', 'assets', filename);
          if (fs.existsSync(localAssetPath)) {
            const buffer = fs.readFileSync(localAssetPath);
            const ext = path.extname(localAssetPath).toLowerCase();
            const mimeType =
              ext === '.png'
                ? 'image/png'
                : ext === '.webp'
                  ? 'image/webp'
                  : ext === '.svg'
                    ? 'image/svg+xml'
                    : 'image/jpeg';
            return { buffer, mimeType };
          }
        }
      } catch { }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          const mimeType = res.headers.get('content-type') || 'image/jpeg';
          return { buffer, mimeType };
        }
      } catch (e) {
        clearTimeout(timeout);
        console.warn('Remote image fetch failed:', e);
      }
    }
  } catch (err) {
    console.warn('Failed to load image buffer for vision analysis:', err);
  }
  return null;
}

/**
 * Robust OCR text cleanup and normalization.
 */
export function cleanAndNormalizeOcrText(rawOcr: string): string {
  if (!rawOcr) return '';
  return rawOcr
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    // Fix common OCR digit/letter confusion in percentage terms
    .replace(/\b(\d+)[Oo]\s*%/g, '$10%')
    .replace(/\b[Oo](\d+)\s*%/g, '0$1%')
    .replace(/\b([1-9]\d)[71]\s*%/g, '$1%')
    .replace(/\b([1-9]\d(?:\.\d+)?)\s*(?:\(\)|o\/o|0\/0)\b/gi, '$1%')
    .replace(/\b([1-9]\d)\s*[\n\r]+\s*(?:Yo|o\/o|0\/0|%)\b/gi, '$1%')
    .replace(/\b([1-9]\d)\s*[\n\r]+\s*(?:off|discount|sale)\b/gi, '$1% OFF')
    .replace(/\b([1-9]\d)\s+(?:Yo|o\/o|0\/0)\b/gi, '$1%')
    .replace(/\bwar[rt]?[aou][nmrui]{3,5}\b/gi, 'warranty')
    .replace(/\b(\d+)9g\b/gi, '$1g')
    .replace(/\b(\d+)9\s*(?:of\s+)?(protein|sugar|fat|fiber|carbs|carbohydrates|sodium|net\s+carbs)\b/gi, '$1g $2')
    .replace(/\b(\d+)9\s*\n+\s*["'~\-•·*]?\s*(?:[a-z]{1,3}\s+)?(protein|sugar|fiber|fat|carbs)\b/gi, '$1g\n$2')
    .replace(/^[~|^•·*]+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanLineSymbols(text: string): string {
  return text
    .replace(/^[^a-zA-Z0-9#$€£"'(]+/, '')
    .replace(/[^a-zA-Z0-9#$€£"'!)%]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function computeStandardAspectRatio(width: number, height: number): string {
  if (!width || !height) return 'Unknown';
  const ratio = width / height;
  if (Math.abs(ratio - 1.0) < 0.05) return '1:1 (Square)';
  if (Math.abs(ratio - 0.8) < 0.05) return '4:5 (Portrait Post)';
  if (Math.abs(ratio - 0.5625) < 0.06) return '9:16 (Story / Reel)';
  if (Math.abs(ratio - 1.777) < 0.06) return '16:9 (Landscape Banner)';
  if (Math.abs(ratio - 1.91) < 0.06) return '1.91:1 (Feed Landscape)';
  if (Math.abs(ratio - 0.666) < 0.06) return '2:3 (Vertical Banner)';
  return `${width}:${height}`;
}

async function extractDominantColorHex(buffer: Buffer): Promise<string> {
  try {
    const stats = await sharp(buffer).stats();
    if (stats.dominant) {
      const { r, g, b } = stats.dominant;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    const [r, g, b] = stats.channels.slice(0, 3).map((c) => Math.round(c.mean));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
  } catch {
    return '#808080';
  }
}

async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata();
    let pipeline = sharp(buffer).rotate();

    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    const maxDim = Math.max(width, height);

    if (maxDim > 1100 || maxDim < 850) {
      const targetMax = 1000;
      const scale = targetMax / maxDim;
      pipeline = pipeline.resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        fit: 'inside',
        kernel: sharp.kernel.lanczos3,
      });
    }

    return await pipeline
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
      .png()
      .toBuffer();
  } catch (err) {
    console.warn('Image preprocessing for OCR failed, using original buffer:', err);
    return buffer;
  }
}

interface TesseractBlockLine {
  text: string;
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractRecognizeResult {
  data?: {
    text?: string;
    confidence?: number;
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: TesseractBlockLine[];
      }>;
    }>;
  };
}

async function runLocalTesseractOCR(
  buffer: Buffer,
  timeoutMs: number = 15000
): Promise<LocalOcrResult> {
  const emptyResult: LocalOcrResult = {
    text: '',
    confidence: null,
    wordsCount: 0,
    linesCount: 0,
    unreadableCount: 0,
    boundingBoxes: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any = null;
  let latestOcrResult: LocalOcrResult = emptyResult;

  const ocrPromise = (async (): Promise<LocalOcrResult> => {
    try {
      const preprocessed = await preprocessImageForOcr(buffer);
      const meta = await sharp(preprocessed).metadata();
      const imgW = meta.width || 1000;
      const imgH = meta.height || 1000;

      const { createWorker, PSM } = await import('tesseract.js');

      // Writable cache directory (essential for Vercel/serverless read-only filesystem)
      const cacheDir = path.join(os.tmpdir(), 'brandguard-ocr');
      try {
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
      } catch { }

      const candidateDirs = [
        process.cwd(),
        path.join(process.cwd(), 'public'),
        path.resolve(__dirname, '..', '..', '..'),
        path.resolve(__dirname, '..', '..', '..', '..'),
      ];
      let langPath = process.cwd();
      for (const d of candidateDirs) {
        if (fs.existsSync(path.join(d, 'eng.traineddata'))) {
          langPath = d;
          break;
        }
      }
      if (!fs.existsSync(path.join(langPath, 'eng.traineddata'))) {
        langPath = 'https://tessdata.projectnaptha.com/4.0.0';
      }

      const workerOptions: Record<string, unknown> = {
        cachePath: cacheDir,
        langPath,
        gzip: false,
        errorHandler: (e: unknown) => console.warn('[Local OCR] Worker notice:', e),
      };

      worker = await createWorker('eng', 1, workerOptions);

      if (!worker) return emptyResult;

      const collectLines = (retObj: TesseractRecognizeResult | null): TesseractBlockLine[] => {
        const lines: TesseractBlockLine[] = [];
        for (const block of retObj?.data?.blocks || []) {
          for (const para of block.paragraphs || []) {
            for (const line of para.lines || []) {
              lines.push(line);
            }
          }
        }
        if (retObj?.data?.text) {
          const rawTextLines = retObj.data.text.split('\n').map((t) => t.trim()).filter((t) => t.length >= 2);
          for (const rawLine of rawTextLines) {
            if (!lines.some((l) => l.text.trim() === rawLine)) {
              lines.push({ text: rawLine, confidence: 85 });
            }
          }
        }
        return lines;
      };

      const assembleOcrResult = (
        passes: Array<{ ret: TesseractRecognizeResult | null; refW: number; refH: number }>
      ): LocalOcrResult => {
        const cleanLines: string[] = [];
        const boundingBoxes: Array<{ text: string; confidence: number; bbox: BoundingBox }> = [];
        let totalConf = 0;
        let confidentCount = 0;
        let unreadableCount = 0;

        const processLine = (l: TesseractBlockLine, refW: number, refH: number) => {
          const rawText = l.text.trim();
          if (!rawText || rawText.length < 2) return;

          if (l.confidence < 25) {
            unreadableCount++;
            return;
          }

          const cleaned = cleanLineSymbols(cleanAndNormalizeOcrText(rawText));
          if (!cleaned || cleaned.length < 2) {
            unreadableCount++;
            return;
          }

          const words = cleaned.split(/\s+/).filter((w) => /^[a-zA-Z0-9$%]{2,}$/.test(w));
          const hasMetric = /[%$€£\d]/.test(cleaned) || /\b(?:off|discount|sale|save|free|protein|gluten|natural|cold|hours|warranty)\b/i.test(cleaned);
          const hasRecognizableWord = words.some((w) => w.length >= 2 || /^\d+%?$/.test(w)) || hasMetric;
          if (l.confidence < 40 && !hasRecognizableWord) {
            unreadableCount++;
            return;
          }

          const normExisting = cleanLines.map((cl) => cl.toLowerCase().replace(/[^a-z0-9%]/g, ''));
          const normCandidate = cleaned.toLowerCase().replace(/[^a-z0-9%]/g, '');
          if (normExisting.includes(normCandidate)) {
            return;
          }

          cleanLines.push(cleaned);
          totalConf += l.confidence;
          confidentCount++;

          if (l.bbox) {
            const normBbox: BoundingBox = {
              ymin: Math.round(Math.max(0, Math.min(1000, (l.bbox.y0 / refH) * 1000))),
              xmin: Math.round(Math.max(0, Math.min(1000, (l.bbox.x0 / refW) * 1000))),
              ymax: Math.round(Math.max(0, Math.min(1000, (l.bbox.y1 / refH) * 1000))),
              xmax: Math.round(Math.max(0, Math.min(1000, (l.bbox.x1 / refW) * 1000))),
            };
            boundingBoxes.push({
              text: cleaned,
              confidence: Math.round(l.confidence * 10) / 10,
              bbox: normBbox,
            });
          }
        };

        for (const p of passes) {
          if (!p.ret) continue;
          const lines = collectLines(p.ret);
          for (const l of lines) {
            processLine(l, p.refW, p.refH);
          }
        }

        if (cleanLines.length === 0) {
          const combinedRaw = passes.map((p) => p.ret?.data?.text).filter(Boolean).join('\n');
          if (combinedRaw.trim()) {
            const fallbackText = cleanAndNormalizeOcrText(combinedRaw);
            const fallbackLines = fallbackText.split('\n').filter(Boolean);
            return {
              text: fallbackText,
              confidence: null,
              wordsCount: fallbackText.split(/\s+/).filter(Boolean).length,
              linesCount: fallbackLines.length,
              unreadableCount: 0,
              boundingBoxes,
            };
          }
        }

        const meanConfidence = confidentCount > 0 ? Math.round((totalConf / confidentCount) * 10) / 10 : null;
        const fullText = cleanAndNormalizeOcrText(cleanLines.join('\n'));
        const wordsCount = fullText.split(/\s+/).filter(Boolean).length;

        return {
          text: fullText,
          confidence: meanConfidence,
          wordsCount,
          linesCount: cleanLines.length,
          unreadableCount,
          boundingBoxes,
        };
      };

      if (typeof worker.setParameters === 'function') {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO,
        });
      }

      // Pass 1: Standard preprocessed whole-image OCR
      const ret1 = await worker.recognize(preprocessed, {}, { blocks: true, text: true });
      latestOcrResult = assembleOcrResult([{ ret: ret1, refW: imgW, refH: imgH }]);

      const pass1Text = ret1?.data?.text?.trim() || '';
      const pass1Lines = collectLines(ret1);

      // Pass 2: Secondary sparse/badge pass to reliably capture badges, promotional stickers, and isolated percentage offers
      let ret2: TesseractRecognizeResult | null = null;
      let badgeW = imgW;
      let badgeH = imgH;
      const needsBadgePass = latestOcrResult.wordsCount < 3 || latestOcrResult.text.length < 8; // Targeted inspection when primary pass has low text density

      if (needsBadgePass) {
        try {
          const metaOrig = await sharp(buffer).metadata();
          const origW = metaOrig.width || 1000;
          const origH = metaOrig.height || 1000;
          const maxOrigDim = Math.max(origW, origH);
          const scale = 1000 / maxOrigDim;
          const targetBadgeW = Math.round(origW * scale);

          const prepBadge = await sharp(buffer)
            .rotate()
            .resize({ width: targetBadgeW, fit: 'inside' })
            .grayscale()
            .threshold(170)
            .png()
            .toBuffer();

          const badgeMeta = await sharp(prepBadge).metadata();
          badgeW = badgeMeta.width || imgW;
          badgeH = badgeMeta.height || imgH;

          if (typeof worker!.setParameters === 'function') {
            await worker!.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
          }
          ret2 = await worker!.recognize(prepBadge, {}, { blocks: true, text: true });
          latestOcrResult = assembleOcrResult([
            { ret: ret1, refW: imgW, refH: imgH },
            { ret: ret2, refW: badgeW, refH: badgeH },
          ]);
        } catch (p2Err) {
          console.warn('Tesseract secondary badge pass notice:', p2Err);
        }
      }

      // Pass 3: Alternate pass on raw resized buffer if preprocessing removed too much contrast
      let ret3: TesseractRecognizeResult | null = null;
      if (latestOcrResult.wordsCount < 3 && latestOcrResult.text.length < 8) {
        try {
          const rawBufferPrep = await sharp(buffer)
            .rotate()
            .resize({ width: 1000, fit: 'inside' })
            .png()
            .toBuffer();

          if (typeof worker!.setParameters === 'function') {
            await worker!.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          }
          ret3 = await worker!.recognize(rawBufferPrep, {}, { blocks: true, text: true });
          latestOcrResult = assembleOcrResult([
            { ret: ret1, refW: imgW, refH: imgH },
            { ret: ret2, refW: badgeW, refH: badgeH },
            { ret: ret3, refW: imgW, refH: imgH },
          ]);
        } catch (p3Err) {
          console.warn('Tesseract alternate pass notice:', p3Err);
        }
      }

      await worker!.terminate();
      worker = null;

      return latestOcrResult;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[Local OCR] Tesseract processing error:', errMsg);
      if (worker) {
        try {
          await worker.terminate();
        } catch { }
      }
      if (latestOcrResult.text && latestOcrResult.text.length > 0) {
        return latestOcrResult;
      }
      return {
        ...emptyResult,
        ocrError: errMsg,
      };
    }
  })();

  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<LocalOcrResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(`[Local OCR] Tesseract reached timeout (${timeoutMs}ms); terminating worker.`);
      if (worker) {
        try {
          worker.terminate();
        } catch { }
      }
      if (latestOcrResult.text && latestOcrResult.text.length > 0) {
        console.log(`[Local OCR] Returning ${latestOcrResult.linesCount} lines captured prior to timeout.`);
        resolve(latestOcrResult);
      } else {
        resolve({
          ...emptyResult,
          ocrError: `OCR execution reached timeout (${timeoutMs}ms)`,
        });
      }
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([ocrPromise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (err: unknown) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Local OCR] Execution caught unexpected error:', errMsg);
    if (latestOcrResult.text && latestOcrResult.text.length > 0) {
      return latestOcrResult;
    }
    return {
      ...emptyResult,
      ocrError: errMsg,
    };
  }
}

/**
 * Extracts visible text elements directly from SVG vector content
 */
function extractSvgText(svgContent: string): LocalOcrResult {
  try {
    const cleaned = svgContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    const normalized = cleanAndNormalizeOcrText(cleaned);
    const words = normalized.split(/\s+/).filter(Boolean);
    return {
      text: normalized,
      confidence: 100,
      wordsCount: words.length,
      linesCount: normalized.split('\n').filter(Boolean).length,
      unreadableCount: 0,
      boundingBoxes: [],
    };
  } catch {
    return {
      text: '',
      confidence: null,
      wordsCount: 0,
      linesCount: 0,
      unreadableCount: 0,
      boundingBoxes: [],
    };
  }
}

export async function runVisionAnalysis({
  imageUrl,
  guidelines,
  facts,
  assets,
  ocrReferenceText,
  timeoutMs: _timeoutMs = 15000,
  skipAI,
}: VisionAnalysisParams): Promise<VisionAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const customApiUrl = process.env.GEMINI_API_URL || process.env.GEMINI_URL;
  const activeGuidelines = (guidelines || []).filter((g) => g.is_active);
  const activeFacts = (facts || []).filter((f) => f.is_active);
  const activeAssets = (assets || []).filter((a) => a.is_active);

  // 1. If explicit fixed OCR reference text is provided (for deterministic tests)
  if (ocrReferenceText && ocrReferenceText.trim()) {
    const refText = cleanAndNormalizeOcrText(ocrReferenceText.trim());
    const refFindings: EngineFinding[] = [];
    refFindings.push(...auditImageTextAndTypography(refText));
    const logoAudit = auditImageLogoAndBrandIdentity(null, activeAssets, refText, undefined, activeGuidelines);
    refFindings.push(...logoAudit.findings);
    refFindings.push(...(await auditImageUnwantedAndSuspiciousElements(refText)));
    refFindings.push(...auditImageDatesAndDeadlines(refText));
    refFindings.push(...auditImageBrandAndMarketingClaims(refText, activeGuidelines, activeFacts));
    refFindings.push(...auditImageAbusiveOrHarmfulLanguage(refText));
    refFindings.push(...auditImageCopyrightAndIpRisks(refText, activeAssets));

    const disclosures = ['Using verified fixed reference OCR text for deterministic claim comparison.'];
    if (!apiKey && !customApiUrl) {
      disclosures.push('Cloud AI Vision provider not configured. Creative analysis executed via deterministic rules.');
    }

    return {
      visionRun: false,
      provider: 'Deterministic Reference OCR',
      model: 'reference-ocr',
      extracted_ocr_text: refText,
      ocrConfidence: 100,
      ocrWordsCount: refText.split(/\s+/).filter(Boolean).length,
      ocrLinesCount: refText.split('\n').filter(Boolean).length,
      unreadableSegmentsCount: 0,
      imageSummary: null,
      boundingBoxes: [],
      findings: refFindings,
      disclosures,
      logoPresence: logoAudit.logoPresence,
    };
  }

  // 2. Load Image Data Buffer
  const loaded = await loadImageBuffer(imageUrl);
  if (!loaded) {
    return {
      visionRun: false,
      reason: `Could not load image data from "${imageUrl}". Check that the file exists and is accessible.`,
      extracted_ocr_text: '',
      findings: [
        {
          category: 'other_visible_issues',
          severity: 'critical',
          finding_title: 'Inaccessible Creative Graphic',
          explanation: `The uploaded creative asset at "${imageUrl}" could not be accessed or read by the server. Ensure the creative image file exists and is publicly accessible.`,
          evidence_text: imageUrl,
          confidence: 1.0,
          suggested_fix: 'Re-upload the creative image file to ensure an accessible storage URL.',
          source: 'image',
          verification_status: 'unverifiable',
          target_type: 'visual_element',
          target_scope: 'image',
          resolution_status: 'unresolved',
        },
      ],
      disclosures: ['Creative image was inaccessible for server-side inspection.'],
      logoPresence: {
        status: 'uncertain',
        detected: false,
        confidence: 0,
        details: 'Image was inaccessible for inspection.',
      },
    };
  }

  // 3. Extract Image Metadata via Sharp
  let imageSummary: ImageSummaryStats | null = null;
  try {
    const meta = await sharp(loaded.buffer).metadata();
    const dominantColor = await extractDominantColorHex(loaded.buffer);
    const w = meta.width || 0;
    const h = meta.height || 0;
    const aspect = computeStandardAspectRatio(w, h);

    imageSummary = {
      width: w,
      height: h,
      aspectRatio: aspect,
      format: (meta.format || loaded.mimeType.split('/')[1] || 'image').toUpperCase(),
      dominantColor,
      hasLegibleTypography: false,
      textLineCount: 0,
    };
  } catch (err) {
    console.warn('Sharp metadata extraction issue:', err);
  }

  let ocrResult: LocalOcrResult = {
    text: '',
    confidence: null,
    wordsCount: 0,
    linesCount: 0,
    unreadableCount: 0,
    boundingBoxes: [],
  };

  let visionRun = false;
  let visionModelUsed = loaded.mimeType === 'image/svg+xml' ? 'svg-xml-dom' : 'tesseract-wasm';
  let visionProvider = loaded.mimeType === 'image/svg+xml' ? 'SVG Vector Parser' : 'Tesseract.js OCR (Local Engine)';
  const disclosures: string[] = [];
  const geminiFindings: EngineFinding[] = [];
  let geminiExtractedOcr = '';
  let geminiLogoPresence: LogoPresenceResult | undefined;

  // 4. Cloud Multimodal Vision Analysis via Gemini when API key or custom endpoint is configured
  if (!skipAI && (apiKey || customApiUrl)) {
    let base64Data = loaded.buffer.toString('base64');
    let mimeType = loaded.mimeType;
    if (loaded.mimeType === 'image/svg+xml') {
      try {
        const pngBuf = await sharp(loaded.buffer).png().toBuffer();
        base64Data = pngBuf.toString('base64');
        mimeType = 'image/png';
      } catch {
        mimeType = 'image/png';
      }
    }
    const prompt = `You are BrandGuard AI's lead creative governance vision inspector.
Analyze this uploaded marketing creative image independently for visible defects, typography quality, brand policy violations, and compliance issues.

=== ACTIVE BRAND GUIDELINES ===
${activeGuidelines.length > 0 ? activeGuidelines.map((g) => `ID: ${g.id} | Type: ${g.rule_type} | Severity: ${g.severity} | Title: ${g.title} | Rule: ${g.description} | Keywords: ${JSON.stringify(g.rule_configuration.keywords || [])}`).join('\n') : '(No custom brand guidelines configured - evaluate against general creative quality and advertising standards)'}

=== VERIFIED CORPORATE FACTS ===
${activeFacts.length > 0 ? activeFacts.map((f) => `ID: ${f.id} | Statement: ${f.fact_text} | Source: ${f.source_name}`).join('\n') : '(No corporate facts configured)'}

=== AUTHORIZED BRAND ASSETS (Logos, Colors, Badges) ===
${activeAssets.length > 0 ? activeAssets.map((a) => `ID: ${a.id} | Name: ${a.asset_name} | Type: ${a.asset_type} | Metadata: ${JSON.stringify(a.asset_metadata || {})}`).join('\n') : '(No authorized reference logo configured)'}

=== AUDIT INSTRUCTIONS ===
1. Transcribe all text visibly rendered in the creative image into "extracted_ocr_text" accurately.
2. Inspect the creative image across these categories:
   - "spelling_and_text": Detect genuine spelling mistakes, typos, duplicated words/figures, malformed words, broken words / split syllables (e.g. "Digi tal" instead of "Digital"), or cut-off text.
   - "logo_and_brand_identity":
     * Systematically inspect the entire creative image for brand logos: symbol-only logos without readable text (e.g. abstract marks, icons, badges, monograms), stylized text wordmarks, emblems, or combination marks.
     * Recognize small logos, corner/footer/packaging logos, and unfamiliar logos.
     * Differentiate:
       (a) Logo visibly present and matches official reference from AUTHORIZED BRAND ASSETS.
       (b) Logo visibly present but identity unverified (do not claim reference mismatch unless official reference exists).
       (c) Logo visibly present but inconsistent with configured official reference (wrong color, distorted, unapproved variant).
       (d) No logo visual element detected anywhere in the creative asset.
       (e) Uncertain due to heavy occlusion, low resolution, or ambiguous graphics.
   - "abusive_or_harmful_language": Profanity, insults, slurs, harassment, threats, or inappropriate copy in visible text.
   - "layout_and_design_quality": Text clipping, text colliding or overlapping awkwardly, broken alignment, inconsistent spacing, unreadable font sizes, low contrast, blur, compression artifacts, or obscured disclaimers.
   - "other_visible_issues":
     * Systematically inspect for accidental floating interface controls, mobile screenshot HUD overlays, screen recording badges/dots, floating volume sliders or audio rockers, speaker/camera/lens badges (such as Google Lens or device HUD controls), video play buttons, and mobile screenshot chrome overlapping artwork.
     * Distinguish intentional marketing icons (phone icon next to phone number, globe next to website, checkmark on feature badge) from accidental floating UI overlays (volume pill in the middle of artwork, device search/camera icon overlapping graphics).
     * If a floating UI control or overlay is detected, return category "other_visible_issues", severity "high" (if obscuring text or core artwork) or "medium", with accurate bounding box [ymin, xmin, ymax, xmax], evidence description, and fix "Re-export creative from source file without mobile system overlays or recording interface controls."
   - "claims_and_consistency":
     * Check if any advertised promotional validity deadline has already passed (e.g. "Offer valid till [Date]" where Date is before current evaluation date in October 2026). If expired, flag under "claims_and_consistency" with severity "high".
     * Contradictory statements within the image (conflicting prices, conflicting discounts, conflicting durations or specs), suspicious absolute guarantees ("100% cure", "zero risk"), or contradictions with active brand guidelines and verified corporate facts.
   - "copyright_and_ip_risk": Commercial stock watermarks (Getty, Shutterstock, etc.) or recognizable third-party logos/characters. Explain visible evidence and recommend human review. Do not claim legal infringement from pixels alone.

3. For every genuine issue or violation detected, return:
   - "category": "spelling_and_text" | "logo_and_brand_identity" | "abusive_or_harmful_language" | "layout_and_design_quality" | "claims_and_consistency" | "copyright_and_ip_risk" | "other_visible_issues"
   - "severity": "low" | "medium" | "high" | "critical"
   - "finding_title": short clear title
   - "explanation": evidence-backed explanation citing the specific visual defect, rule, or claim
   - "evidence_text": the exact text from the image or description of the visual element
   - "target_type": "text" | "logo" | "color" | "layout" | "visual_element"
   - "bounding_box": object with "ymin", "xmin", "ymax", "xmax" normalized from 0 to 1000 representing the region of the violation on the image. ONLY provide bounding boxes where detection is genuinely localized.
   - "suggested_fix": actionable concrete fix
   - "confidence": number between 0.0 and 1.0 based on certainty
   - "needs_human_verification": boolean
   - "human_verification_reason": string or null
   - "guideline_id": matching guideline UUID from above, or null
   - "fact_id": matching fact UUID from above, or null
   - "asset_id": matching asset UUID from above, or null

Return ONLY a valid JSON object formatted exactly as:
{
  "extracted_ocr_text": "All transcribed text here",
  "logo_detection": {
    "present": true,
    "type": "symbol",
    "description": "Short description of detected logo or mark",
    "bounding_box": { "ymin": 0, "xmin": 0, "ymax": 100, "xmax": 100 },
    "confidence": 0.95,
    "matches_authorized_asset_id": null
  },
  "findings": [ ...array of finding objects... ]
}
If no logo is detected, set logo_detection.present to false and type to "none". If presence is indeterminate, set present to "uncertain".
If there are no violations, return { "extracted_ocr_text": "...", "logo_detection": { ... }, "findings": [] }.`;

    try {
      const preferredModel = process.env.GEMINI_MODEL;
      const candidateModels = [
        preferredModel,
        'gemini-flash-lite-latest',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
      ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);
      let rawText = '';

      for (const m of candidateModels) {
        try {
          const timeoutSignal = AbortSignal.timeout(12000);
          const url = buildGeminiUrl(customApiUrl, m, apiKey || '');
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            }),
            signal: timeoutSignal,
          });

          if (response.ok) {
            const data = await response.json();
            const partText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (partText) {
              rawText = partText;
              visionModelUsed = m;
              visionProvider = 'Google Gemini Vision';
              visionRun = true;
              break;
            }
          } else {
            const errBody = await response.text().catch(() => '');
            console.warn(`[Gemini Vision] Model ${m} returned HTTP ${response.status}: ${errBody.slice(0, 120)}`);
            if (response.status === 429) {
              disclosures.push(`Gemini vision quota limit reached (HTTP 429); executed full local analysis.`);
              continue;
            }
            if (response.status === 401 || response.status === 403) {
              disclosures.push(`Gemini vision authentication failed; executed full local analysis.`);
              break;
            }
          }
        } catch (mErr: unknown) {
          const errMsg = mErr instanceof Error ? mErr.message : String(mErr);
          console.warn(`[Gemini Vision] Model ${m} note:`, errMsg);
          if (errMsg.includes('timeout') || errMsg.includes('AbortError')) {
            disclosures.push(`Gemini vision request timed out (10s limit reached); executed full local analysis.`);
            continue;
          }
        }
      }

      if (rawText) {
        let parsed: {
          extracted_ocr_text?: string;
          logo_detection?: Record<string, unknown>;
          findings?: Record<string, unknown>[];
        } = {};
        try {
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          parsed = JSON.parse(cleaned);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch { }
          }
        }

        geminiExtractedOcr = cleanAndNormalizeOcrText(parsed.extracted_ocr_text || '');
        if (geminiExtractedOcr.trim().length > 0) {
          ocrResult = {
            text: geminiExtractedOcr,
            confidence: 95,
            wordsCount: geminiExtractedOcr.split(/\s+/).filter(Boolean).length,
            linesCount: geminiExtractedOcr.split('\n').filter(Boolean).length,
            unreadableCount: 0,
            boundingBoxes: [],
          };
        }
        const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];

        // Parse structured logo detection from Gemini multimodal vision
        if (parsed.logo_detection && typeof parsed.logo_detection === 'object') {
          const ld = parsed.logo_detection as {
            present?: boolean | string;
            type?: string;
            description?: string;
            bounding_box?: { ymin?: number; xmin?: number; ymax?: number; xmax?: number };
            confidence?: number;
            matches_authorized_asset_id?: string | null;
          };

          const isPresent = ld.present === true || ld.present === 'true';
          const isNoLogo = ld.present === false || ld.present === 'false' || ld.type === 'none';
          const conf = typeof ld.confidence === 'number' ? Math.max(0, Math.min(1, ld.confidence)) : 0.85;

          let bbox: BoundingBox | null = null;
          if (
            ld.bounding_box &&
            typeof ld.bounding_box.ymin === 'number' &&
            typeof ld.bounding_box.xmin === 'number' &&
            typeof ld.bounding_box.ymax === 'number' &&
            typeof ld.bounding_box.xmax === 'number'
          ) {
            bbox = {
              ymin: Math.max(0, Math.min(1000, ld.bounding_box.ymin)),
              xmin: Math.max(0, Math.min(1000, ld.bounding_box.xmin)),
              ymax: Math.max(0, Math.min(1000, ld.bounding_box.ymax)),
              xmax: Math.max(0, Math.min(1000, ld.bounding_box.xmax)),
            };
          }

          const validTypes = ['symbol', 'wordmark', 'emblem', 'combination'];
          const logoType = validTypes.includes(ld.type || '')
            ? (ld.type as 'symbol' | 'wordmark' | 'emblem' | 'combination')
            : undefined;

          if (isPresent) {
            const matchedAsset = activeAssets.find(
              (a) => a.id === ld.matches_authorized_asset_id || (ld.description && a.asset_name.toLowerCase() === ld.description.toLowerCase())
            );
            geminiLogoPresence = {
              status: matchedAsset ? 'detected_and_matched' : 'detected_unverified',
              detected: true,
              logoType: logoType || 'symbol',
              evidence: ld.description || 'Visual logo mark identified in creative image',
              confidence: conf,
              boundingBox: bbox,
              matchedAssetId: matchedAsset ? matchedAsset.id : null,
              matchedAssetName: matchedAsset ? matchedAsset.asset_name : null,
            };
          } else if (isNoLogo && conf >= 0.6) {
            geminiLogoPresence = {
              status: 'no_logo_detected',
              detected: false,
              confidence: conf,
              details: 'Visual inspection completed with sufficient evidence; no brand logo, symbol, or wordmark detected.',
            };
          } else {
            geminiLogoPresence = {
              status: 'uncertain',
              detected: false,
              confidence: conf,
              details: 'Logo presence could not be confirmed with sufficient confidence from visual inspection.',
            };
          }
        }

        for (const f of rawFindings) {
          const sevStr = typeof f.severity === 'string' ? f.severity : '';
          const severity: RuleSeverity = ['low', 'medium', 'high', 'critical'].includes(sevStr)
            ? (sevStr as RuleSeverity)
            : 'medium';

          let bbox = null;
          const rawBbox = f.bounding_box as { ymin?: unknown; xmin?: unknown; ymax?: unknown; xmax?: unknown } | undefined;
          if (
            rawBbox &&
            typeof rawBbox.ymin === 'number' &&
            typeof rawBbox.xmin === 'number' &&
            typeof rawBbox.ymax === 'number' &&
            typeof rawBbox.xmax === 'number'
          ) {
            bbox = {
              ymin: Math.max(0, Math.min(1000, rawBbox.ymin)),
              xmin: Math.max(0, Math.min(1000, rawBbox.xmin)),
              ymax: Math.max(0, Math.min(1000, rawBbox.ymax)),
              xmax: Math.max(0, Math.min(1000, rawBbox.xmax)),
            };
          }

          const evText = typeof f.evidence_text === 'string' ? f.evidence_text : undefined;
          const rawCat = typeof f.category === 'string' ? f.category.toLowerCase().trim() : 'brand_guideline';
          let category: FindingCategory = 'other_visible_issues';
          if (rawCat === 'spelling_and_text' || rawCat === 'spelling_and_grammar' || rawCat === 'spelling' || rawCat === 'typography') {
            category = 'spelling_and_text';
          } else if (rawCat === 'logo_and_brand_identity' || rawCat === 'logo_and_brand' || rawCat === 'brand_identity' || rawCat === 'logo') {
            category = 'logo_and_brand_identity';
          } else if (rawCat === 'abusive_or_harmful_language' || rawCat === 'harmful_content' || rawCat === 'abusive_language') {
            category = 'abusive_or_harmful_language';
          } else if (rawCat === 'layout_and_design_quality' || rawCat === 'layout_and_design' || rawCat === 'layout' || rawCat === 'design') {
            category = 'layout_and_design_quality';
          } else if (rawCat === 'claims_and_consistency' || rawCat === 'claims_and_facts' || rawCat === 'claims' || rawCat === 'consistency') {
            category = 'claims_and_consistency';
          } else if (rawCat === 'copyright_and_ip_risk' || rawCat === 'copyright_and_ip' || rawCat === 'ip_risk' || rawCat === 'watermark') {
            category = 'copyright_and_ip_risk';
          } else if (rawCat === 'brand_guideline') {
            category = 'brand_guideline';
          } else {
            category = 'other_visible_issues';
          }

          geminiFindings.push({
            category,
            severity,
            finding_title: typeof f.finding_title === 'string' ? f.finding_title : 'Visual Brand Policy Violation',
            explanation: typeof f.explanation === 'string' ? f.explanation : 'Flagged by multimodal vision model.',
            evidence_text: evText,
            guideline_id: typeof f.guideline_id === 'string' ? f.guideline_id : null,
            fact_id: typeof f.fact_id === 'string' ? f.fact_id : null,
            asset_id: typeof f.asset_id === 'string' ? f.asset_id : null,
            confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.85,
            suggested_fix: typeof f.suggested_fix === 'string' ? f.suggested_fix : undefined,
            source: 'vision_model' as const,
            verification_status: 'confirmed_violation' as const,
            bounding_box: bbox,
            target_type: (typeof f.target_type === 'string' && ['text', 'logo', 'color', 'layout', 'visual_element'].includes(f.target_type))
              ? (f.target_type as 'text' | 'visual_element' | 'logo' | 'color' | 'layout')
              : 'text',
            target_scope: 'image' as const,
            image_evidence: evText,
            resolution_status: 'unresolved' as const,
            needs_human_verification: Boolean(f.needs_human_verification),
            human_verification_reason: typeof f.human_verification_reason === 'string' ? f.human_verification_reason : null,
          });
        }

        disclosures.push(`Multimodal creative visual analysis executed via Google Gemini Vision (${visionModelUsed}).`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Gemini vision API error, continuing with local engine:', errMsg);
      disclosures.push(`Cloud AI Vision provider encountered an error; analyzed via local OCR and deterministic rules.`);
    }
  }

  // 5. Local OCR Extraction & Heuristic Engine (Executed when cloud vision is unavailable or yielded no text)
  if (!ocrResult.text || ocrResult.text.trim().length === 0) {
    console.log(`[OCR Pipeline] Processing creative image: "${imageUrl}" (buffer size: ${loaded.buffer.length} bytes) via local engine`);
    if (loaded.mimeType === 'image/svg+xml') {
      ocrResult = extractSvgText(loaded.buffer.toString('utf-8'));
    } else {
      ocrResult = await runLocalTesseractOCR(loaded.buffer);
    }
    console.log(`[OCR Pipeline] Extracted ${ocrResult.linesCount} lines (${ocrResult.wordsCount} words) from "${imageUrl}"`);
  }

  // Combine OCR text: use richer transcript, preserving line breaks
  const finalExtractedText = (geminiExtractedOcr && geminiExtractedOcr.length >= ocrResult.text.length)
    ? geminiExtractedOcr
    : (ocrResult.text || geminiExtractedOcr || '');

  if (imageSummary) {
    imageSummary.hasLegibleTypography = finalExtractedText.length > 0;
    imageSummary.textLineCount = finalExtractedText.split('\n').filter(Boolean).length;
  }

  // 6. Direct Image-First Audits across all Core Categories
  const localFindings: EngineFinding[] = [];

  // A. Text & Spelling
  const typographyFindings = auditImageTextAndTypography(finalExtractedText, ocrResult.boundingBoxes);
  localFindings.push(...typographyFindings);

  // B. Logo & Brand Identity
  const logoAudit = auditImageLogoAndBrandIdentity(
    imageSummary,
    activeAssets,
    finalExtractedText,
    ocrResult.boundingBoxes,
    activeGuidelines,
    geminiLogoPresence
  );
  localFindings.push(...logoAudit.findings);
  const finalLogoPresence = logoAudit.logoPresence;

  // C. Unwanted & Suspicious Visual Elements / Placeholders
  const unwantedFindings = await auditImageUnwantedAndSuspiciousElements(
    finalExtractedText,
    imageSummary,
    ocrResult.boundingBoxes,
    loaded.buffer
  );
  localFindings.push(...unwantedFindings);

  // C2. Dates & Expiration Deadlines
  const datesFindings = auditImageDatesAndDeadlines(finalExtractedText, ocrResult.boundingBoxes);
  localFindings.push(...datesFindings);

  // D. Abusive & Harmful Language
  const abusiveFindings = auditImageAbusiveOrHarmfulLanguage(finalExtractedText, ocrResult.boundingBoxes);
  localFindings.push(...abusiveFindings);

  // E. Layout & Visual Quality
  const visualFindings = auditImageVisualAndDesignQuality(imageSummary, finalExtractedText, ocrResult.boundingBoxes);
  localFindings.push(...visualFindings);

  // F. Claims & Consistency
  const claimsFindings = auditImageBrandAndMarketingClaims(finalExtractedText, activeGuidelines, activeFacts);
  localFindings.push(...claimsFindings);

  // G. Potential Copyright & IP Risks
  const copyrightFindings = auditImageCopyrightAndIpRisks(finalExtractedText, activeAssets);
  localFindings.push(...copyrightFindings);

  // Check: Legibility & Unreadable Content Observation
  const isDegradedTypography =
    ocrResult.unreadableCount >= 5 &&
    (ocrResult.unreadableCount / Math.max(1, ocrResult.linesCount) > 0.4 ||
      (ocrResult.confidence !== null && ocrResult.confidence < 68));

  if (isDegradedTypography) {
    localFindings.push({
      category: 'layout_and_design_quality',
      severity: ocrResult.unreadableCount >= 10 ? 'high' : 'medium',
      finding_title: 'Degraded Typography / Low Contrast Segments Detected',
      explanation: `Image contains ${ocrResult.unreadableCount} text region(s) with degraded contrast, low legibility, or low recognition confidence (<40%). Typography in production marketing assets must be clearly legible and high-contrast across mobile screens.`,
      evidence_text: `Unreadable or degraded segments: ${ocrResult.unreadableCount}`,
      confidence: ocrResult.confidence ? ocrResult.confidence / 100 : 0.7,
      suggested_fix: 'Increase typography contrast against the background graphic and verify minimum 16px font size with clear lettering.',
      source: 'image',
      verification_status: 'possible_inconsistency',
      target_type: 'layout',
      target_scope: 'image',
      resolution_status: 'unresolved',
      needs_human_verification: true,
      human_verification_reason: 'Inspect typography readability against background colors on mobile screens.',
    });
  }

  // 7. Merge Gemini findings and Local findings with strict deduplication
  const mergedFindings: EngineFinding[] = [...geminiFindings];

  for (const lf of localFindings) {
    const existingIndex = mergedFindings.findIndex((gf) => {
      if (gf.category !== lf.category) return false;
      const gfEv = (gf.evidence_text || gf.finding_title || '').toLowerCase().trim();
      const lfEv = (lf.evidence_text || lf.finding_title || '').toLowerCase().trim();
      if (!gfEv || !lfEv) return gf.finding_title.toLowerCase() === lf.finding_title.toLowerCase();
      return gfEv === lfEv;
    });

    if (existingIndex >= 0) {
      // Enrich existing finding with bounding box and suggested replacement if local engine discovered them
      const existing = mergedFindings[existingIndex];
      if (!existing.bounding_box && lf.bounding_box) {
        existing.bounding_box = lf.bounding_box;
      }
      if (!existing.proposed_replacement && lf.proposed_replacement) {
        existing.proposed_replacement = lf.proposed_replacement;
      }
      if (!existing.suggested_fix && lf.suggested_fix) {
        existing.suggested_fix = lf.suggested_fix;
      }
    } else {
      mergedFindings.push(lf);
    }
  }

  if (!apiKey && !customApiUrl) {
    disclosures.push('Cloud AI Vision provider not configured. Creative analysis executed via local OCR and image governance heuristics.');
  }

  if (ocrResult.ocrError && !finalExtractedText) {
    disclosures.push(`Local OCR notice: ${ocrResult.ocrError}`);
  } else if (!finalExtractedText) {
    disclosures.push('No legible typography was detected in this creative image.');
  }

  return {
    visionRun,
    provider: visionProvider,
    model: visionModelUsed,
    extracted_ocr_text: finalExtractedText,
    ocrConfidence: ocrResult.confidence ?? (visionRun ? 95 : null),
    ocrWordsCount: finalExtractedText.split(/\s+/).filter(Boolean).length,
    ocrLinesCount: finalExtractedText.split('\n').filter(Boolean).length,
    unreadableSegmentsCount: ocrResult.unreadableCount,
    imageSummary,
    boundingBoxes: ocrResult.boundingBoxes,
    findings: mergedFindings,
    disclosures,
    logoPresence: finalLogoPresence,
  };
}
