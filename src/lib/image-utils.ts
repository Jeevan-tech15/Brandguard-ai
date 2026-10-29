/**
 * BrandGuard AI — Image Processing & Dimension Parsing Utilities
 * Supports binary parsing of PNG, JPEG, and WebP marketing creatives
 */

export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatioLabel: '1:1' | '4:5' | '9:16' | '16:9' | 'custom';
  aspectRatioRatio: number; // width / height
  mimeType: string;
}

/**
 * Extracts dimensions directly from image buffer headers
 */
export function extractImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  try {
    // 1. PNG Parser (must have PNG magic header 0x89, 'P', 'N', 'G')
    if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }

    // 2. JPEG Parser (must have SOI marker 0xFF, 0xD8)
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        // SOF0 (Baseline), SOF1 (Extended), SOF2 (Progressive)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }

    // 3. WebP Parser
    if (mimeType === 'image/webp' || (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')) {
      const type = buffer.toString('ascii', 12, 16);
      if (type === 'VP8 ') {
        // Lossy VP8
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      } else if (type === 'VP8L') {
        // Lossless VP8L
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + ((((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
        if (width > 0 && height > 0) return { width, height };
      } else if (type === 'VP8X') {
        // Extended VP8X
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        if (width > 0 && height > 0) return { width, height };
      }
    }

    // 4. SVG Parser
    if (mimeType === 'image/svg+xml' || buffer.toString('utf-8', 0, 100).includes('<svg')) {
      const svgText = buffer.toString('utf-8', 0, 2000);
      const widthMatch = svgText.match(/width=["'](\d+(?:\.\d+)?)["']/);
      const heightMatch = svgText.match(/height=["'](\d+(?:\.\d+)?)["']/);
      if (widthMatch && heightMatch) {
        return { width: Math.round(parseFloat(widthMatch[1])), height: Math.round(parseFloat(heightMatch[1])) };
      }
      const viewBoxMatch = svgText.match(/viewBox=["'](?:[\d.-]+\s+){2}([\d.-]+)\s+([\d.-]+)["']/);
      if (viewBoxMatch) {
        return { width: Math.round(parseFloat(viewBoxMatch[1])), height: Math.round(parseFloat(viewBoxMatch[2])) };
      }
    }
  } catch {
    // If parsing fails, return null
  }
  return null;
}

/**
 * Classifies the Instagram aspect ratio based on width and height
 */
export function classifyAspectRatio(width: number, height: number): {
  label: '1:1' | '4:5' | '9:16' | '16:9' | 'custom';
  ratio: number;
} {
  if (width <= 0 || height <= 0) {
    return { label: 'custom', ratio: 1.0 };
  }

  const ratio = width / height;

  // 1:1 Square (e.g. 1080x1080) -> ratio ~ 1.0 (allow 0.95 to 1.05)
  if (Math.abs(ratio - 1.0) <= 0.05) {
    return { label: '1:1', ratio };
  }

  // 4:5 Portrait Instagram feed (e.g. 1080x1350) -> ratio = 0.8 (allow 0.76 to 0.84)
  if (Math.abs(ratio - 0.8) <= 0.04) {
    return { label: '4:5', ratio };
  }

  // 9:16 Story / Reel (e.g. 1080x1920) -> ratio = 0.5625 (allow 0.53 to 0.60)
  if (Math.abs(ratio - 0.5625) <= 0.04) {
    return { label: '9:16', ratio };
  }

  // 16:9 Landscape (e.g. 1920x1080 or 1200x675) -> ratio = 1.777 (allow 1.70 to 1.85)
  if (Math.abs(ratio - 1.777) <= 0.08) {
    return { label: '16:9', ratio };
  }

  return { label: 'custom', ratio };
}
