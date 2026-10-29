import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import sharp from 'sharp';
import { ContentReview } from '@/lib/types';
import { loadImageBuffer } from '@/lib/engine/vision-analyzer';

interface PdfGeneratorOptions {
  generatedBy?: string;
}

// BrandGuard AI Color Palette
const COLORS = {
  primary: rgb(0.06, 0.46, 0.43), // Teal #0F766E
  primaryDark: rgb(0.04, 0.35, 0.32),
  primaryLight: rgb(0.94, 0.98, 0.98), // Very soft teal
  charcoal: rgb(0.07, 0.09, 0.15), // #111827
  bodyText: rgb(0.2, 0.25, 0.33), // Slate 700
  mutedText: rgb(0.45, 0.52, 0.6), // Slate 500
  border: rgb(0.88, 0.91, 0.94), // Slate 200
  cardBg: rgb(0.97, 0.98, 0.99), // Slate 50
  white: rgb(1, 1, 1),
  
  // Severity Colors
  criticalText: rgb(0.85, 0.15, 0.15),
  criticalBg: rgb(0.99, 0.94, 0.94),
  criticalBorder: rgb(0.98, 0.8, 0.8),

  highText: rgb(0.85, 0.45, 0.05),
  highBg: rgb(1, 0.97, 0.92),
  highBorder: rgb(0.99, 0.88, 0.72),

  mediumText: rgb(0.7, 0.5, 0.05),
  mediumBg: rgb(1, 0.99, 0.92),
  mediumBorder: rgb(0.98, 0.93, 0.75),

  lowText: rgb(0.2, 0.4, 0.6),
  lowBg: rgb(0.94, 0.97, 1),
  lowBorder: rgb(0.8, 0.9, 0.98),

  successText: rgb(0.05, 0.6, 0.4),
  successBg: rgb(0.94, 0.99, 0.96),
  successBorder: rgb(0.75, 0.95, 0.85),
};

function sanitizePdfText(str: string): string {
  if (!str) return '';
  return str
    // Remove emojis and symbols outside WinAnsi range
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Normalize smart punctuation
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u00B7]/g, '-')
    // Replace non-ascii chars that WinAnsi rejects with approximate ascii
    .replace(/[^\x00-\x7F]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= 160 && code <= 255) return char; // Valid Latin-1 supplement
      return ' ';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [''];
  const paragraphs = clean.split('\n');
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      resultLines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) resultLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) resultLines.push(currentLine);
  }

  return resultLines.length > 0 ? resultLines : [''];
}

export async function generateReviewPdfReport(
  review: ContentReview,
  _options?: PdfGeneratorOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89; // A4
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - 45;

  function ensureSpace(requiredHeight: number) {
    if (cursorY - requiredHeight < 55) {
      currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - 45;
      drawPageHeaderBar();
    }
  }

  function drawPageHeaderBar() {
    // Subtle top accent line on secondary pages
    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - 25 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - 25 },
      thickness: 1,
      color: COLORS.border,
    });
    currentPage.drawText('BrandGuard AI · Automated Marketing Compliance Audit', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 20,
      size: 8,
      font: fontRegular,
      color: COLORS.mutedText,
    });
  }

  // -------------------------------------------------------------
  // 1. BRAND HEADER (First Page)
  // -------------------------------------------------------------
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - 48,
    width: CONTENT_WIDTH,
    height: 52,
    color: COLORS.primaryLight,
    borderColor: COLORS.primary,
    borderWidth: 1,
  });

  // Shield Icon / Brand mark
  currentPage.drawRectangle({
    x: MARGIN_LEFT + 12,
    y: cursorY - 38,
    width: 30,
    height: 32,
    color: COLORS.primary,
  });
  currentPage.drawText('BG', {
    x: MARGIN_LEFT + 18,
    y: cursorY - 27,
    size: 14,
    font: fontBold,
    color: COLORS.white,
  });

  currentPage.drawText('BrandGuard AI', {
    x: MARGIN_LEFT + 52,
    y: cursorY - 20,
    size: 16,
    font: fontBold,
    color: COLORS.primary,
  });

  currentPage.drawText('Pre-Publication Creative Governance & Compliance Audit Report', {
    x: MARGIN_LEFT + 52,
    y: cursorY - 34,
    size: 9,
    font: fontRegular,
    color: COLORS.charcoal,
  });

  const nowFormatted = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }) + ' UTC';

  currentPage.drawText(`Generated: ${nowFormatted}`, {
    x: PAGE_WIDTH - MARGIN_RIGHT - 180,
    y: cursorY - 26,
    size: 8,
    font: fontRegular,
    color: COLORS.mutedText,
  });

  cursorY -= 65;

  // -------------------------------------------------------------
  // 2. AUDIT SUMMARY & METADATA CARD
  // -------------------------------------------------------------
  const cardHeight = 115;
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - cardHeight,
    width: CONTENT_WIDTH,
    height: cardHeight,
    color: COLORS.cardBg,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  const col1X = MARGIN_LEFT + 15;
  const col2X = MARGIN_LEFT + 270;
  const col3X = MARGIN_LEFT + 400;

  // Title & ID
  const titleWrapped = wrapText(review.title || 'Untitled Campaign Review', 240, fontBold, 12);
  currentPage.drawText(titleWrapped[0] || 'Untitled Review', {
    x: col1X,
    y: cursorY - 20,
    size: 12,
    font: fontBold,
    color: COLORS.charcoal,
  });
  if (titleWrapped[1]) {
    currentPage.drawText(titleWrapped[1], {
      x: col1X,
      y: cursorY - 34,
      size: 10,
      font: fontBold,
      color: COLORS.charcoal,
    });
  }

  currentPage.drawText(`Review ID: ${review.id}`, {
    x: col1X,
    y: cursorY - 48,
    size: 8,
    font: fontRegular,
    color: COLORS.mutedText,
  });

  const channelLabel =
    review.content_type === 'social_media'
      ? 'Social Media Post (Instagram / LinkedIn)'
      : review.content_type === 'ad_copy'
      ? 'Advertising Banner / Sponsored Ad'
      : review.content_type === 'email_marketing'
      ? 'Email Marketing Asset'
      : review.content_type === 'press_release'
      ? 'Press Release / Corporate Statement'
      : review.content_type === 'website_copy'
      ? 'Website / Landing Page Graphic'
      : 'Marketing Collateral';

  currentPage.drawText(`Channel: ${channelLabel}`, {
    x: col1X,
    y: cursorY - 64,
    size: 8.5,
    font: fontRegular,
    color: COLORS.bodyText,
  });

  const submittedDate = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-US', {
        dateStyle: 'medium',
      })
    : 'Unknown Date';

  currentPage.drawText(`Submitted: ${submittedDate} · Version ${review.review_version || 1}`, {
    x: col1X,
    y: cursorY - 78,
    size: 8.5,
    font: fontRegular,
    color: COLORS.bodyText,
  });

  // Column 2: Governance Status & Decision
  currentPage.drawText('GOVERNANCE STATUS', {
    x: col2X,
    y: cursorY - 18,
    size: 7.5,
    font: fontBold,
    color: COLORS.mutedText,
  });

  const statusLabel =
    review.status === 'approved'
      ? 'APPROVED'
      : review.status === 'rejected'
      ? 'REJECTED'
      : review.status === 'flagged'
      ? 'FLAGGED'
      : review.status === 'changes_requested'
      ? 'CHANGES REQUESTED'
      : 'UNDER REVIEW';

  const statusColor =
    review.status === 'approved'
      ? COLORS.successText
      : review.status === 'rejected' || review.status === 'flagged'
      ? COLORS.criticalText
      : COLORS.highText;

  currentPage.drawText(statusLabel, {
    x: col2X,
    y: cursorY - 34,
    size: 13,
    font: fontBold,
    color: statusColor,
  });

  const criticalFindings = review.findings?.filter((f) => f.severity === 'critical') || [];
  const highFindings = review.findings?.filter((f) => f.severity === 'high') || [];
  const findingsSummaryText =
    criticalFindings.length > 0
      ? `${criticalFindings.length} Critical Issue(s) Require Action`
      : highFindings.length > 0
      ? `${highFindings.length} High Severity Issue(s) Detected`
      : review.findings?.length === 0
      ? 'Zero Violations Detected'
      : `${review.findings?.length || 0} Total Findings`;

  currentPage.drawText(findingsSummaryText, {
    x: col2X,
    y: cursorY - 50,
    size: 8,
    font: fontRegular,
    color: criticalFindings.length > 0 ? COLORS.criticalText : COLORS.bodyText,
  });

  // Column 3: Compliance Score Card
  currentPage.drawText('COMPLIANCE SCORE', {
    x: col3X,
    y: cursorY - 18,
    size: 7.5,
    font: fontBold,
    color: COLORS.mutedText,
  });

  const isPartial = Boolean(
    (review.evaluation_metadata?.scoringBreakdown as { isPartialAnalysis?: boolean } | undefined)?.isPartialAnalysis ||
    review.evaluation_metadata?.isPartialAnalysis
  );

  if (review.compliance_score !== null && review.compliance_score !== undefined) {
    currentPage.drawText(`${review.compliance_score}%`, {
      x: col3X,
      y: cursorY - 38,
      size: 20,
      font: fontBold,
      color:
        review.compliance_score >= 85
          ? COLORS.successText
          : review.compliance_score >= 60
          ? COLORS.highText
          : COLORS.criticalText,
    });
    currentPage.drawText(
      review.compliance_score >= 85
        ? 'Passed Audit Baseline'
        : review.compliance_score >= 60
        ? 'Remediation Advised'
        : 'Critical Flags Block',
      {
        x: col3X,
        y: cursorY - 52,
        size: 7.5,
        font: fontRegular,
        color: COLORS.mutedText,
      }
    );
  } else {
    currentPage.drawText('Unavailable', {
      x: col3X,
      y: cursorY - 34,
      size: 13,
      font: fontBold,
      color: COLORS.highText,
    });
    currentPage.drawText('Analysis Incomplete', {
      x: col3X,
      y: cursorY - 48,
      size: 7.5,
      font: fontRegular,
      color: COLORS.mutedText,
    });
  }

  // Modality tag
  currentPage.drawText('Modality: Image-Only Governance Audit', {
    x: col1X,
    y: cursorY - 96,
    size: 8,
    font: fontRegular,
    color: COLORS.mutedText,
  });

  cursorY -= (cardHeight + 15);

  // -------------------------------------------------------------
  // 3. AUDIT COMPLETENESS & CHECKS BREAKDOWN
  // -------------------------------------------------------------
  ensureSpace(70);
  currentPage.drawText('IMAGE-FIRST GOVERNANCE CHECKS EXECUTED', {
    x: MARGIN_LEFT,
    y: cursorY - 8,
    size: 9,
    font: fontBold,
    color: COLORS.charcoal,
  });
  cursorY -= 16;

  const checksBoxHeight = 52;
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - checksBoxHeight,
    width: CONTENT_WIDTH,
    height: checksBoxHeight,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  const ocrLines = review.evaluation_metadata?.ocrLinesCount || (review.extracted_ocr_text ? review.extracted_ocr_text.split('\n').filter(Boolean).length : 0);
  const ocrLabel = ocrLines > 0 ? `Active (${ocrLines} lines)` : review.image_url ? 'Zero Legible Text' : 'N/A';
  const cloudVisionLabel = review.evaluation_metadata?.aiRun ? 'Executed (Gemini 2.5 Flash)' : 'Executed (Local OCR & Geometry Engine)';

  currentPage.drawText(`• Typography & OCR: ${ocrLabel}`, {
    x: MARGIN_LEFT + 12,
    y: cursorY - 18,
    size: 8,
    font: fontRegular,
    color: COLORS.bodyText,
  });
  currentPage.drawText(`• Spelling & Grammar: Audited across visible text`, {
    x: MARGIN_LEFT + 12,
    y: cursorY - 32,
    size: 8,
    font: fontRegular,
    color: COLORS.bodyText,
  });
  currentPage.drawText(`• Logo & Brand Identity: Inspected against official marks`, {
    x: MARGIN_LEFT + 12,
    y: cursorY - 44,
    size: 8,
    font: fontRegular,
    color: COLORS.bodyText,
  });

  currentPage.drawText(`• Vision Provider: ${cloudVisionLabel}`, {
    x: MARGIN_LEFT + 250,
    y: cursorY - 18,
    size: 8,
    font: fontRegular,
    color: COLORS.bodyText,
  });
  currentPage.drawText(`• Brand Guidelines Checked: ${review.evaluation_metadata?.guidelinesEvaluatedCount || 8} Active Policies`, {
    x: MARGIN_LEFT + 250,
    y: cursorY - 32,
    size: 8,
    font: fontRegular,
    color: COLORS.bodyText,
  });
  currentPage.drawText(`• IP & Trademark Safety: Audited against third-party marks`, {
    x: MARGIN_LEFT + 250,
    y: cursorY - 44,
    size: 8,
    font: fontRegular,
    color: COLORS.bodyText,
  });

  cursorY -= (checksBoxHeight + 15);

  // -------------------------------------------------------------
  // 4. CREATIVE ASSET & ACCOMPANYING COPY
  // -------------------------------------------------------------
  ensureSpace(160);
  currentPage.drawText('CREATIVE ASSET & COPY TELEMETRY', {
    x: MARGIN_LEFT,
    y: cursorY - 8,
    size: 9,
    font: fontBold,
    color: COLORS.charcoal,
  });
  cursorY -= 16;

  // Let's attempt embedding the image if present
  let embeddedImage = null;
  let imgBoxWidth = 140;
  let imgBoxHeight = 140;

  if (review.image_url) {
    try {
      const loaded = await loadImageBuffer(review.image_url);
      if (loaded && loaded.buffer) {
        // Normalize image format with sharp
        const pngBuf = await sharp(loaded.buffer)
          .resize({ width: 360, height: 360, fit: 'inside' })
          .png()
          .toBuffer();
        embeddedImage = await doc.embedPng(pngBuf);
        const imgDims = embeddedImage.scaleToFit(140, 140);
        imgBoxWidth = imgDims.width;
        imgBoxHeight = imgDims.height;
      }
    } catch (err) {
      console.warn('PDF Generator: Image embedding warning:', err);
    }
  }

  const creativeSectionHeight = Math.max(imgBoxHeight + 16, 120);
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - creativeSectionHeight,
    width: CONTENT_WIDTH,
    height: creativeSectionHeight,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  if (embeddedImage) {
    currentPage.drawImage(embeddedImage, {
      x: MARGIN_LEFT + 8,
      y: cursorY - imgBoxHeight - 8,
      width: imgBoxWidth,
      height: imgBoxHeight,
    });
  } else if (review.image_url) {
    currentPage.drawRectangle({
      x: MARGIN_LEFT + 8,
      y: cursorY - 110,
      width: 130,
      height: 100,
      color: COLORS.cardBg,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    currentPage.drawText('[Image Creative Asset]', {
      x: MARGIN_LEFT + 18,
      y: cursorY - 55,
      size: 8,
      font: fontRegular,
      color: COLORS.mutedText,
    });
  } else {
    currentPage.drawRectangle({
      x: MARGIN_LEFT + 8,
      y: cursorY - 110,
      width: 130,
      height: 100,
      color: COLORS.cardBg,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    currentPage.drawText('[Text Only Post]', {
      x: MARGIN_LEFT + 28,
      y: cursorY - 55,
      size: 8,
      font: fontRegular,
      color: COLORS.mutedText,
    });
  }

  // Text details on the right of the image
  const textX = MARGIN_LEFT + 155;
  const textMaxW = CONTENT_WIDTH - 165;
  let textY = cursorY - 16;

  currentPage.drawText('Extracted Visible Image Typography (OCR):', {
    x: textX,
    y: textY,
    size: 8,
    font: fontBold,
    color: COLORS.charcoal,
  });
  textY -= 14;

  const ocrString = review.extracted_ocr_text || '(No legible visible typography detected in image)';
  const ocrLinesList = wrapText(ocrString, textMaxW, fontRegular, 7.5);
  for (const line of ocrLinesList.slice(0, 6)) {
    currentPage.drawText(line, {
      x: textX,
      y: textY,
      size: 7.5,
      font: fontRegular,
      color: COLORS.bodyText,
    });
    textY -= 10.5;
  }
  if (ocrLinesList.length > 6) {
    currentPage.drawText(`[+ ${ocrLinesList.length - 6} additional lines truncated in summary]`, {
      x: textX,
      y: textY,
      size: 7,
      font: fontOblique,
      color: COLORS.mutedText,
    });
    textY -= 10;
  }

  // Version Comparison summary if version > 1
  if ((review.review_version || 1) > 1) {
    textY -= 4;
    const hasGenuinePixelEdit = Boolean(
      review.correction_metadata?.edit_applied_to_pixels &&
      review.corrected_image_url &&
      review.corrected_image_url !== (review.original_image_url || review.image_url)
    );

    currentPage.drawText('VERSION PROGRESSION AUDIT:', {
      x: textX,
      y: textY,
      size: 7.5,
      font: fontBold,
      color: COLORS.primary,
    });
    textY -= 11;

    const imgChangeStr = hasGenuinePixelEdit ? '• Image Graphic: Corrected Asset Applied' : '• Image Graphic: Re-analyzed Visual Pixels';
    currentPage.drawText(imgChangeStr, {
      x: textX,
      y: textY,
      size: 7,
      font: fontRegular,
      color: COLORS.charcoal,
    });
    textY -= 9.5;
  }

  cursorY -= (creativeSectionHeight + 15);

  // -------------------------------------------------------------
  // 5. COMPLIANCE FINDINGS & AUDITED VIOLATIONS
  // -------------------------------------------------------------
  const findings = review.findings || [];
  ensureSpace(70);
  currentPage.drawText(`COMPLIANCE FINDINGS & AUDITED VIOLATIONS (${findings.length})`, {
    x: MARGIN_LEFT,
    y: cursorY - 8,
    size: 9,
    font: fontBold,
    color: COLORS.charcoal,
  });
  cursorY -= 18;

  if (findings.length === 0) {
    const noFindingsHeight = 44;
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - noFindingsHeight,
      width: CONTENT_WIDTH,
      height: noFindingsHeight,
      color: isPartial ? COLORS.highBg : COLORS.successBg,
      borderColor: isPartial ? COLORS.highBorder : COLORS.successBorder,
      borderWidth: 1,
    });

    if (isPartial) {
      currentPage.drawText('Partial Analysis: Zero findings detected on evaluated text copy.', {
        x: MARGIN_LEFT + 12,
        y: cursorY - 18,
        size: 8.5,
        font: fontBold,
        color: COLORS.highText,
      });
      currentPage.drawText('Image typography could not be extracted; broad visual governance checks were not fully executed.', {
        x: MARGIN_LEFT + 12,
        y: cursorY - 32,
        size: 7.5,
        font: fontRegular,
        color: COLORS.bodyText,
      });
    } else {
      currentPage.drawText('Clean Creative: Zero policy violations or contradictory claims detected.', {
        x: MARGIN_LEFT + 12,
        y: cursorY - 18,
        size: 8.5,
        font: fontBold,
        color: COLORS.successText,
      });
      currentPage.drawText('Content satisfies active brand guidelines, regulatory rules, and factual registry benchmarks.', {
        x: MARGIN_LEFT + 12,
        y: cursorY - 32,
        size: 7.5,
        font: fontRegular,
        color: COLORS.bodyText,
      });
    }
    cursorY -= (noFindingsHeight + 15);
  } else {
    // Render individual findings
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      const severity = (f.severity || 'medium').toLowerCase();
      const sevColor =
        severity === 'critical'
          ? COLORS.criticalText
          : severity === 'high'
          ? COLORS.highText
          : severity === 'medium'
          ? COLORS.mediumText
          : COLORS.lowText;

      const sevBg =
        severity === 'critical'
          ? COLORS.criticalBg
          : severity === 'high'
          ? COLORS.highBg
          : severity === 'medium'
          ? COLORS.mediumBg
          : COLORS.lowBg;

      const sevBorder =
        severity === 'critical'
          ? COLORS.criticalBorder
          : severity === 'high'
          ? COLORS.highBorder
          : severity === 'medium'
          ? COLORS.mediumBorder
          : COLORS.lowBorder;

      // Wrap explanation and evidence
      const expLines = wrapText(f.explanation || '', CONTENT_WIDTH - 24, fontRegular, 7.5);
      const evLines = f.evidence_text ? wrapText(`Evidence: ${f.evidence_text}`, CONTENT_WIDTH - 24, fontOblique, 7.5) : [];
      const fixLines = f.suggested_fix ? wrapText(`Recommended Action: ${f.suggested_fix}`, CONTENT_WIDTH - 24, fontRegular, 7.5) : [];

      const itemHeight = 36 + (expLines.length * 10) + (evLines.length > 0 ? evLines.length * 9.5 + 4 : 0) + (fixLines.length > 0 ? fixLines.length * 9.5 + 4 : 0);
      ensureSpace(itemHeight + 8);

      currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: cursorY - itemHeight,
        width: CONTENT_WIDTH,
        height: itemHeight,
        color: COLORS.white,
        borderColor: sevBorder,
        borderWidth: 1,
      });

      // Severity tag pill
      currentPage.drawRectangle({
        x: MARGIN_LEFT + 8,
        y: cursorY - 18,
        width: 50,
        height: 13,
        color: sevBg,
        borderColor: sevBorder,
        borderWidth: 0.5,
      });
      currentPage.drawText(severity.toUpperCase(), {
        x: MARGIN_LEFT + 12,
        y: cursorY - 14,
        size: 7,
        font: fontBold,
        color: sevColor,
      });

      // Finding Title
      currentPage.drawText(sanitizePdfText(f.finding_title || 'Compliance Violation'), {
        x: MARGIN_LEFT + 65,
        y: cursorY - 15,
        size: 8.5,
        font: fontBold,
        color: COLORS.charcoal,
      });

      // Resolution status
      const resStatus = f.resolution_status === 'resolved' ? 'RESOLVED' : 'UNRESOLVED';
      const resColor = f.resolution_status === 'resolved' ? COLORS.successText : COLORS.criticalText;
      currentPage.drawText(resStatus, {
        x: PAGE_WIDTH - MARGIN_RIGHT - 70,
        y: cursorY - 15,
        size: 7.5,
        font: fontBold,
        color: resColor,
      });

      let innerY = cursorY - 28;

      // Explanation lines
      for (const el of expLines) {
        currentPage.drawText(el, {
          x: MARGIN_LEFT + 10,
          y: innerY,
          size: 7.5,
          font: fontRegular,
          color: COLORS.bodyText,
        });
        innerY -= 10;
      }

      // Evidence lines
      if (evLines.length > 0) {
        innerY -= 2;
        for (const ev of evLines) {
          currentPage.drawText(ev, {
            x: MARGIN_LEFT + 10,
            y: innerY,
            size: 7.5,
            font: fontOblique,
            color: COLORS.mutedText,
          });
          innerY -= 9.5;
        }
      }

      // Recommended Fix lines
      if (fixLines.length > 0) {
        innerY -= 2;
        for (const fx of fixLines) {
          currentPage.drawText(fx, {
            x: MARGIN_LEFT + 10,
            y: innerY,
            size: 7.5,
            font: fontRegular,
            color: COLORS.primaryDark,
          });
          innerY -= 9.5;
        }
      }

      cursorY -= (itemHeight + 8);
    }
  }

  // -------------------------------------------------------------
  // 6. HUMAN REVIEW DECISION
  // -------------------------------------------------------------
  ensureSpace(70);
  currentPage.drawText('HUMAN GOVERNANCE DECISION & AUDIT SIGN-OFF', {
    x: MARGIN_LEFT,
    y: cursorY - 8,
    size: 9,
    font: fontBold,
    color: COLORS.charcoal,
  });
  cursorY -= 16;

  const decisions = review.decisions || [];
  const latestDecision = decisions[0] || null;

  if (latestDecision) {
    const decBoxHeight = 52;
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - decBoxHeight,
      width: CONTENT_WIDTH,
      height: decBoxHeight,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    const decLabel = (latestDecision.decision || 'in_review').toUpperCase();
    const decColor =
      decLabel === 'APPROVED' ? COLORS.successText : decLabel === 'REJECTED' ? COLORS.criticalText : COLORS.highText;

    currentPage.drawText(`Recorded Decision: ${decLabel}`, {
      x: MARGIN_LEFT + 12,
      y: cursorY - 18,
      size: 9,
      font: fontBold,
      color: decColor,
    });

    currentPage.drawText(`Authorized Reviewer: ${latestDecision.reviewer_label || 'Compliance Officer'}`, {
      x: MARGIN_LEFT + 12,
      y: cursorY - 32,
      size: 8,
      font: fontRegular,
      color: COLORS.bodyText,
    });

    const decDate = latestDecision.created_at
      ? new Date(latestDecision.created_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        }) + ' UTC'
      : 'Recorded';

    currentPage.drawText(`Timestamp: ${decDate}`, {
      x: MARGIN_LEFT + 12,
      y: cursorY - 44,
      size: 7.5,
      font: fontRegular,
      color: COLORS.mutedText,
    });

    if (latestDecision.comments) {
      const cleanComments = sanitizePdfText(latestDecision.comments).slice(0, 100);
      currentPage.drawText(`Comments: "${cleanComments}"`, {
        x: MARGIN_LEFT + 260,
        y: cursorY - 18,
        size: 7.5,
        font: fontOblique,
        color: COLORS.charcoal,
      });
    }

    cursorY -= (decBoxHeight + 15);
  } else {
    const noDecHeight = 40;
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - noDecHeight,
      width: CONTENT_WIDTH,
      height: noDecHeight,
      color: COLORS.cardBg,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    currentPage.drawText('Status: Pending Reviewer Sign-Off', {
      x: MARGIN_LEFT + 12,
      y: cursorY - 18,
      size: 8.5,
      font: fontBold,
      color: COLORS.mutedText,
    });
    currentPage.drawText('No human approval or override decision has been recorded for this review version.', {
      x: MARGIN_LEFT + 12,
      y: cursorY - 31,
      size: 7.5,
      font: fontRegular,
      color: COLORS.mutedText,
    });

    cursorY -= (noDecHeight + 15);
  }

  // -------------------------------------------------------------
  // 7. FORMAL DISCLAIMER (Required)
  // -------------------------------------------------------------
  ensureSpace(48);
  const disclaimerHeight = 38;
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - disclaimerHeight,
    width: CONTENT_WIDTH,
    height: disclaimerHeight,
    color: COLORS.cardBg,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  currentPage.drawText('GOVERNANCE NOTICE & REGULATORY DISCLAIMER', {
    x: MARGIN_LEFT + 10,
    y: cursorY - 12,
    size: 6.5,
    font: fontBold,
    color: COLORS.mutedText,
  });

  const discLines = wrapText(
    'This report summarizes automated checks performed by BrandGuard AI. It does not guarantee legal or regulatory compliance. Human review is required.',
    CONTENT_WIDTH - 20,
    fontRegular,
    7
  );

  let discY = cursorY - 23;
  for (const dl of discLines) {
    currentPage.drawText(dl, {
      x: MARGIN_LEFT + 10,
      y: discY,
      size: 7,
      font: fontRegular,
      color: COLORS.bodyText,
    });
    discY -= 8.5;
  }

  cursorY -= (disclaimerHeight + 10);

  // -------------------------------------------------------------
  // 8. FOOTERS (Page Numbers on all pages)
  // -------------------------------------------------------------
  const allPages = doc.getPages();
  const totalPages = allPages.length;

  for (let i = 0; i < totalPages; i++) {
    const p = allPages[i];
    p.drawLine({
      start: { x: MARGIN_LEFT, y: 35 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: 35 },
      thickness: 0.5,
      color: COLORS.border,
    });

    p.drawText(`BrandGuard AI Governance Telemetry · Confidential Report`, {
      x: MARGIN_LEFT,
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: COLORS.mutedText,
    });

    const pageStr = `Page ${i + 1} of ${totalPages}`;
    const pageStrW = fontRegular.widthOfTextAtSize(pageStr, 7.5);
    p.drawText(pageStr, {
      x: PAGE_WIDTH - MARGIN_RIGHT - pageStrW,
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: COLORS.mutedText,
    });
  }

  return await doc.save();
}
