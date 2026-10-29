'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ContentType } from '@/lib/types';
import {
  UploadCloud,
  FileCheck2,
  AlertCircle,
  ArrowLeft,
  Send,
  Save,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Sparkles,
  Info,
} from 'lucide-react';

const contentTypes: { value: ContentType; label: string; desc: string }[] = [
  {
    value: 'social_media',
    label: 'Social Media Post (Instagram / LinkedIn)',
    desc: '1:1 Square or 4:5 Portrait post creative with accompanying caption',
  },
  {
    value: 'ad_copy',
    label: 'Advertising Banner / Sponsored Creative',
    desc: 'Paid Meta/LinkedIn advertising banner with headline and CTA copy',
  },
  {
    value: 'email_marketing',
    label: 'Email Marketing Asset',
    desc: 'Promotional newsletter hero graphic with promotional copy',
  },
  {
    value: 'press_release',
    label: 'Press Release / Corporate Statement',
    desc: 'Formal media statement with key factual milestone claims',
  },
  {
    value: 'website_copy',
    label: 'Landing Page Graphic',
    desc: 'Product hero banner or pricing feature graphic',
  },
  {
    value: 'other',
    label: 'Other Marketing Collateral',
    desc: 'One-pagers, slides, and digital brochures',
  },
];

interface UploadedImageData {
  url: string;
  fileName: string;
  width: number;
  height: number;
  aspect_ratio: string;
  sizeBytes: number;
  mimeType: string;
}

export default function NewReviewPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [contentType, setContentType] = useState<ContentType>('social_media');
  const [uploadedImage, setUploadedImage] = useState<UploadedImageData | null>(null);

  // Status & Progress State
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string | null>(null);
  const [isDraftAction, setIsDraftAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Unmount cleanup
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Client-side helper to ensure large creatives fit seamlessly within Vercel serverless request limits
  async function prepareUploadFile(file: File): Promise<File> {
    if (file.size <= 2 * 1024 * 1024 || file.type === 'image/svg+xml' || typeof window === 'undefined') {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1600;
      let w = bitmap.width;
      let h = bitmap.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.9));
        if (blob && blob.size < file.size) {
          return new File([blob], file.name, { type: blob.type });
        }
      }
    } catch {
      // Fallback to original file if client image processing is unavailable
    }
    return file;
  }

  // File Upload Handler
  async function handleFileUpload(rawFile: File) {
    setErrorMsg(null);

    // Client-side pre-validation
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(rawFile.type)) {
      setErrorMsg(`Invalid file type "${rawFile.type}". Please upload PNG, JPG, JPEG, or WebP.`);
      return;
    }
    if (rawFile.size > 15 * 1024 * 1024) {
      setErrorMsg(`Image size (${(rawFile.size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB limit.`);
      return;
    }

    setIsUploading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const file = await prepareUploadFile(rawFile);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'creatives');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const rawText = await res.text();
      let data: { url?: string; fileName?: string; width?: number; height?: number; aspect_ratio?: string; sizeBytes?: number; mimeType?: string; error?: string } | null = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Non-JSON response
      }

      if (!res.ok) {
        if (res.status === 413 || rawText.includes('Request Entity Too Large') || rawText.includes('Payload Too Large')) {
          throw new Error('Creative file exceeds server upload limit (4.5MB). Please upload a smaller image.');
        }
        throw new Error(data?.error || rawText || `Upload failed (HTTP ${res.status}).`);
      }
      if (!data?.url) {
        throw new Error('Upload completed but did not return a valid image URL.');
      }

      setUploadedImage({
        url: data.url,
        fileName: data.fileName || rawFile.name,
        width: data.width || 1080,
        height: data.height || 1080,
        aspect_ratio: data.aspect_ratio || '1:1',
        sizeBytes: data.sizeBytes || file.size,
        mimeType: data.mimeType || file.type,
      });

      // Auto-populate title if empty
      if (!title.trim()) {
        const cleanName = rawFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(`${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)} Campaign Post`);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg('Upload timed out. Please verify your connection or try a smaller creative image.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Error uploading creative.');
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  // Preload Sample Creative for instant evaluation across multiple verticals
  function loadSampleCreative(type: 'flagged' | 'compliant' | 'cloudnova' | 'voltmax' | 'purevita' | 'aethelgard' | 'clean_lifestyle') {
    if (type === 'flagged') {
      setTitle('Acme Enterprise Cloud — Zero Downtime Social Launch');
      setContentType('social_media');
      setUploadedImage({
        url: '/uploads/creatives/sample-flagged-post.svg',
        fileName: 'acme_cloud_launch_social.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 245000,
        mimeType: 'image/png',
      });
    } else if (type === 'compliant') {
      setTitle('Acme SLA Trust & Security Benchmark Post');
      setContentType('social_media');
      setUploadedImage({
        url: '/uploads/creatives/sample-compliant-post.svg',
        fileName: 'acme_compliant_sla.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 198000,
        mimeType: 'image/png',
      });
    } else if (type === 'cloudnova') {
      setTitle('CloudNova Enterprise Cloud — Global Infrastructure Launch');
      setContentType('social_media');
      setUploadedImage({
        url: '/uploads/creatives/heldout-tech-cloudnova.png',
        fileName: 'heldout-tech-cloudnova.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 63800,
        mimeType: 'image/png',
      });
    } else if (type === 'voltmax') {
      setTitle('VoltMax Pro High-Output Power Bank Campaign');
      setContentType('ad_copy');
      setUploadedImage({
        url: '/uploads/creatives/heldout-hw-voltmax.png',
        fileName: 'heldout-hw-voltmax.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 74200,
        mimeType: 'image/png',
      });
    } else if (type === 'purevita') {
      setTitle('PureVita Organic Energy Snack Bar Campaign');
      setContentType('social_media');
      setUploadedImage({
        url: '/uploads/creatives/heldout-food-purevita.png',
        fileName: 'heldout-food-purevita.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 68100,
        mimeType: 'image/png',
      });
    } else if (type === 'aethelgard') {
      setTitle('Aethelgard Heritage Expedition Parka Launch');
      setContentType('social_media');
      setUploadedImage({
        url: '/uploads/creatives/heldout-apparel-aethelgard.png',
        fileName: 'heldout-apparel-aethelgard.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 71000,
        mimeType: 'image/png',
      });
    } else if (type === 'clean_lifestyle') {
      setTitle('Clean Brand Editorial — Visual Campaign');
      setContentType('social_media');
      setUploadedImage({
        url: '/uploads/creatives/heldout-lifestyle-notext.png',
        fileName: 'heldout-lifestyle-notext.png',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        sizeBytes: 52000,
        mimeType: 'image/png',
      });
    }
  }

  // Auto-populate preset if provided in URL query (e.g. /reviews/new?preset=aethelgard)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get('preset') as
        | 'flagged'
        | 'compliant'
        | 'cloudnova'
        | 'voltmax'
        | 'purevita'
        | 'aethelgard'
        | 'clean_lifestyle'
        | null;
      if (preset) {
        const timer = setTimeout(() => {
          loadSampleCreative(preset);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent, saveAsDraft = false) {
    e.preventDefault();
    setErrorMsg(null);

    // Prevent duplicate concurrent submissions
    if (isSubmitting || isUploading) return;

    if (!title.trim()) {
      setErrorMsg('Please specify a title or campaign name.');
      return;
    }

    if (!uploadedImage) {
      setErrorMsg('Please upload a marketing creative image to review.');
      return;
    }

    setIsDraftAction(saveAsDraft);
    setIsSubmitting(true);
    setSubmitStage(saveAsDraft ? 'Saving draft...' : 'Auditing creative image against brand guidelines & visual rules...');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content_type: contentType,
          content_text: `[Creative Image: ${uploadedImage.fileName}]`,
          image_url: uploadedImage.url,
          caption_text: caption.trim() || undefined,
          aspect_ratio: uploadedImage.aspect_ratio || null,
          image_width: uploadedImage.width || null,
          image_height: uploadedImage.height || null,
          save_as_draft: saveAsDraft,
          status: saveAsDraft ? 'draft' : 'in_review',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const rawText = await res.text();
      let data: { review?: { id: string }; error?: string } | null = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Response was not JSON (e.g. plain text 413 Request Entity Too Large or 504 Gateway Timeout)
      }

      if (!res.ok) {
        if (res.status === 413 || rawText.includes('Request Entity Too Large') || rawText.includes('Payload Too Large')) {
          throw new Error('Creative payload exceeds cloud server size limits (4.5MB). Please upload a smaller or compressed creative.');
        }
        if (res.status === 504 || rawText.includes('Gateway Timeout')) {
          throw new Error('Review analysis timed out on the cloud server. Please try submitting again with a lighter creative.');
        }
        throw new Error(data?.error || rawText || `Submission failed (HTTP ${res.status}).`);
      }

      if (!data?.review?.id) {
        throw new Error('Audit completed but no review record was returned.');
      }

      setSubmitStage('Audit complete! Opening review details...');
      router.push(`/reviews/${data.review.id}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg('The review took longer than expected (>60s). It may still be processing in the background. Please check the Review History or retry.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'An error occurred during submission.');
      }
    } finally {
      setIsSubmitting(false);
      setSubmitStage(null);
      abortControllerRef.current = null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Submit Creative for Pre-Publication Review"
        description="Upload marketing creatives, Instagram post graphics, or ad banners to verify brand guidelines, approved facts, and authorized assets."
        actions={
          <Link href="/reviews">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to History
            </Button>
          </Link>
        }
      />

      {/* Preset Testing Shortcuts */}
      <div className="p-3 rounded-lg bg-teal-50 border border-teal-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-teal-900">
          <Sparkles className="w-4 h-4 text-teal-800 shrink-0" />
          <span>
            <strong>Interactive Review Presets:</strong> Preload test creative posts to verify multimodal governance detection:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadSampleCreative('flagged')}
            className="px-2.5 py-1 rounded bg-white border border-teal-300 text-teal-900 font-medium hover:bg-teal-100 transition-colors cursor-pointer"
          >
            Load Post with Violations
          </button>
          <button
            type="button"
            onClick={() => loadSampleCreative('compliant')}
            className="px-2.5 py-1 rounded bg-teal-800 text-white font-medium hover:bg-teal-900 transition-colors cursor-pointer"
          >
            Load Compliant Post
          </button>
          <select
            id="preset-industry-dropdown"
            aria-label="Load industry test creative"
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                loadSampleCreative(val as 'cloudnova' | 'voltmax' | 'purevita' | 'aethelgard' | 'clean_lifestyle');
                e.target.value = '';
              }
            }}
            className="px-2.5 py-1 rounded bg-white border border-teal-300 text-teal-900 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-700"
          >
            <option value="">More Industry Creatives...</option>
            <option value="cloudnova">Tech: CloudNova (SLA / Uptime)</option>
            <option value="voltmax">Hardware: VoltMax Pro (Power / Spec)</option>
            <option value="purevita">Food: PureVita (Protein / Shelf Life)</option>
            <option value="aethelgard">Apparel: Aethelgard (Warranty / Returns)</option>
            <option value="clean_lifestyle">Lifestyle: Clean Compliant Post</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Submission Blocked</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dual-Pane Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Creative Dropzone & Visual Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900">
                  <ImageIcon className="w-4 h-4 text-teal-800" />
                  Marketing Creative Asset
                </CardTitle>
                <CardDescription>
                  Supports PNG, JPG, JPEG, and WebP (up to 10MB)
                </CardDescription>
              </div>
            </CardHeader>

            {uploadedImage ? (
              <div className="space-y-4">
                {/* Image Preview Container */}
                <div className="relative rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center p-2 min-h-[280px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedImage.url}
                    alt={uploadedImage.fileName}
                    className="max-h-[360px] w-auto max-w-full object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 text-gray-700 shadow-sm hover:bg-white hover:text-red-600 transition-colors"
                    title="Remove and replace creative"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Detected Image Telemetry */}
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">File Name:</span>
                    <span className="text-gray-900 font-mono truncate max-w-[180px]">
                      {uploadedImage.fileName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Dimensions:</span>
                    <span className="text-gray-900 font-mono">
                      {uploadedImage.width} × {uploadedImage.height} px
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Aspect Ratio:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      <CheckCircle2 className="w-3 h-3 text-teal-700" />
                      {uploadedImage.aspect_ratio} ({uploadedImage.aspect_ratio === '1:1' ? 'Square Feed' : uploadedImage.aspect_ratio === '4:5' ? 'Portrait Feed' : 'Standard'})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">File Size:</span>
                    <span className="text-gray-900 font-mono">
                      {(uploadedImage.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-teal-700/60 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-gray-50/50 hover:bg-teal-50/20 transition-all min-h-[300px]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-teal-800 shadow-xs mb-3">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>

                <p className="text-sm font-semibold text-gray-900">
                  {isUploading ? 'Validating and uploading creative...' : 'Upload Marketing Creative'}
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Drag and drop your post creative here, or click to browse. Supports Instagram feed 1:1, 4:5, and banners.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-gray-400">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">PNG</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">JPG</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">WebP</span>
                  <span className="text-gray-300">•</span>
                  <span>Max 10MB</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Campaign Information & Caption Copy (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900">
                  <FileCheck2 className="w-4 h-4 text-teal-800" />
                  Campaign Metadata & Post Copy
                </CardTitle>
                <CardDescription>
                  Configured rules, verified facts, and visual assets will be evaluated across this asset
                </CardDescription>
              </div>
            </CardHeader>

            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              {/* Campaign Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Campaign / Creative Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Cloud Infrastructure Launch - Instagram Feed"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700/30 transition-colors"
                />
              </div>

              {/* Content Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Content Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700/30"
                >
                  {contentTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  {contentTypes.find((t) => t.value === contentType)?.desc}
                </p>
              </div>

              {/* Accompanying Post Caption (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Accompanying Post Caption <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  {caption.length > 0 && (
                    <span className="text-[11px] text-gray-400 font-mono">
                      {caption.length} chars
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Paste accompanying Instagram caption, ad headline, or LinkedIn post copy to evaluate against brand guidelines and verify consistency with the graphic image..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700/30 transition-colors resize-y font-sans"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Optional. If provided, BrandGuard validates caption spelling, claims, and ensures promotional consistency with text detected in the creative graphic.
                </p>
              </div>

              {/* Image-First Governance Scope */}
              <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
                  <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>Image-Only Governance Pipeline</span>
                </div>
                <p className="text-xs text-teal-800 leading-relaxed">
                  BrandGuard audits the uploaded image pixels and all visible creative content directly across 7 compliance categories:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-teal-900 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Spelling & Text Accuracy</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Logo & Brand Identity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Abusive or Harmful Content</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Layout & Visual Quality</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Claims & Internal Consistency</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>IP, Copyright & Trademarks</span>
                  </div>
                </div>
                <p className="text-[11px] text-teal-700 pt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  No caption required. Findings are mapped directly to image coordinates with bounding boxes.
                </p>
              </div>

              {/* Live Processing Stage Feedback */}
              {isSubmitting && submitStage && (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 flex items-center gap-2.5 text-xs text-teal-900 animate-in fade-in">
                  <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="font-medium">{submitStage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting && isDraftAction}
                  onClick={(e) => handleSubmit(e, true)}
                  leftIcon={<Save className="w-4 h-4 text-gray-500" />}
                >
                  Save as Draft
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting && !isDraftAction}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Run Compliance Review
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
