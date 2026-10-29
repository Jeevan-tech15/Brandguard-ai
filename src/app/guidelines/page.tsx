'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import {
  BrandProfile,
  BrandGuideline,
  ApprovedFact,
  AuthorizedAsset,
  AssetType,
  RuleSeverity,
} from '@/lib/types';
import { formatRuleTypeLabel, getSeverityBadge } from '@/lib/utils';
import {
  BookCheck,
  Plus,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Power,
  Sparkles,
  ExternalLink,
  Check,
  Palette,
  Upload,
  Trash2,
  Type,
  Image as ImageIcon,
  AlertCircle,
  X,
  FileCheck2,
} from 'lucide-react';

export default function GuidelinesPage() {
  const [activeTab, setActiveTab] = useState<'identity' | 'guidelines' | 'facts' | 'assets'>('identity');

  // Main collections
  const [profile, setProfile] = useState<BrandProfile>({
    brand_name: '',
    brand_description: '',
    brand_colors: [],
    typography_preferences: { primary_font: '', secondary_font: '', notes: '' },
    official_logo_url: '',
    tone_of_voice: '',
    prohibited_phrases: [],
    required_disclaimers: [],
    additional_rules: '',
  });
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
  const [facts, setFacts] = useState<ApprovedFact[]>([]);
  const [assets, setAssets] = useState<AuthorizedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile Save state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Profile dynamic field inputs
  const [newColorInput, setNewColorInput] = useState('#0F766E');
  const [newProhibitedInput, setNewProhibitedInput] = useState('');
  const [newDisclaimerInput, setNewDisclaimerInput] = useState('');
  const logoUploadInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalType, setModalType] = useState<'guideline' | 'fact' | 'asset'>('guideline');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Guideline Form
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleType, setRuleType] = useState('prohibited_claim');
  const [ruleSeverity, setRuleSeverity] = useState<RuleSeverity>('medium');
  const [ruleDescription, setRuleDescription] = useState('');
  const [allowedExamples, setAllowedExamples] = useState('');
  const [forbiddenExamples, setForbiddenExamples] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState('');

  // Fact Form
  const [factText, setFactText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');

  // Asset Form
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('logo');
  const [assetFileUrl, setAssetFileUrl] = useState('');
  const [assetHexColors, setAssetHexColors] = useState('');
  const [assetNotes, setAssetNotes] = useState('');
  const [isPrimaryAsset, setIsPrimaryAsset] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const assetFileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, guidelinesRes, factsRes, assetsRes] = await Promise.all([
        fetch('/api/brand-profile'),
        fetch('/api/guidelines'),
        fetch('/api/facts'),
        fetch('/api/assets'),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.profile) {
          setProfile({
            brand_name: data.profile.brand_name || '',
            brand_description: data.profile.brand_description || '',
            brand_colors: Array.isArray(data.profile.brand_colors) ? data.profile.brand_colors : [],
            typography_preferences: data.profile.typography_preferences || { primary_font: '', secondary_font: '', notes: '' },
            official_logo_url: data.profile.official_logo_url || '',
            tone_of_voice: data.profile.tone_of_voice || '',
            prohibited_phrases: Array.isArray(data.profile.prohibited_phrases) ? data.profile.prohibited_phrases : [],
            required_disclaimers: Array.isArray(data.profile.required_disclaimers) ? data.profile.required_disclaimers : [],
            additional_rules: data.profile.additional_rules || '',
          });
        }
      }
      if (guidelinesRes.ok) {
        const data = await guidelinesRes.json();
        setGuidelines(data.guidelines || []);
      }
      if (factsRes.ok) {
        const data = await factsRes.json();
        setFacts(data.facts || []);
      }
      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error('Failed to load brand data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function initializeBrandData() {
      try {
        const [profileRes, guidelinesRes, factsRes, assetsRes] = await Promise.all([
          fetch('/api/brand-profile'),
          fetch('/api/guidelines'),
          fetch('/api/facts'),
          fetch('/api/assets'),
        ]);

        if (ignore) return;

        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile && !ignore) {
            setProfile({
              brand_name: data.profile.brand_name || '',
              brand_description: data.profile.brand_description || '',
              brand_colors: Array.isArray(data.profile.brand_colors) ? data.profile.brand_colors : [],
              typography_preferences: data.profile.typography_preferences || { primary_font: '', secondary_font: '', notes: '' },
              official_logo_url: data.profile.official_logo_url || '',
              tone_of_voice: data.profile.tone_of_voice || '',
              prohibited_phrases: Array.isArray(data.profile.prohibited_phrases) ? data.profile.prohibited_phrases : [],
              required_disclaimers: Array.isArray(data.profile.required_disclaimers) ? data.profile.required_disclaimers : [],
              additional_rules: data.profile.additional_rules || '',
            });
          }
        }
        if (guidelinesRes.ok && !ignore) {
          const data = await guidelinesRes.json();
          setGuidelines(data.guidelines || []);
        }
        if (factsRes.ok && !ignore) {
          const data = await factsRes.json();
          setFacts(data.facts || []);
        }
        if (assetsRes.ok && !ignore) {
          const data = await assetsRes.json();
          setAssets(data.assets || []);
        }
      } catch (err) {
        console.error('Failed to initialize brand data:', err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    initializeBrandData();
    return () => {
      ignore = true;
    };
  }, []);

  // Handle Save Brand Profile
  async function handleSaveProfile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setProfileSaveError(null);
    setProfileSaveSuccess(null);

    if (!profile.brand_name.trim()) {
      setProfileSaveError('Brand name is required.');
      return;
    }

    // Validate hex colors
    const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    for (const color of profile.brand_colors) {
      if (!hexRegex.test(color.trim())) {
        setProfileSaveError(`Invalid hex color code: "${color}". Format must be #RGB or #RRGGBB.`);
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/brand-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save brand profile');
      }

      setProfileSaveSuccess('Brand profile saved successfully! These standards are now active for image analysis.');
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err: unknown) {
      setProfileSaveError(err instanceof Error ? err.message : 'Error saving profile.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Handle Logo Upload
  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true);
    setProfileSaveError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'assets');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload logo file.');

      setProfile((prev) => ({ ...prev, official_logo_url: data.url }));
    } catch (err: unknown) {
      setProfileSaveError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setIsUploadingLogo(false);
    }
  }

  // Brand Color Management
  function handleAddColor() {
    const hex = newColorInput.trim().toUpperCase();
    const hexRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/;
    if (!hexRegex.test(hex)) {
      setProfileSaveError('Please enter a valid hex color code (e.g. #0F766E).');
      return;
    }
    if (!profile.brand_colors.includes(hex)) {
      setProfile((prev) => ({ ...prev, brand_colors: [...prev.brand_colors, hex] }));
      setProfileSaveError(null);
    }
  }

  function handleRemoveColor(colorToRemove: string) {
    setProfile((prev) => ({
      ...prev,
      brand_colors: prev.brand_colors.filter((c) => c !== colorToRemove),
    }));
  }

  // Prohibited Phrases Management
  function handleAddProhibitedPhrase() {
    const text = newProhibitedInput.trim();
    if (!text) return;
    if (!profile.prohibited_phrases.includes(text)) {
      setProfile((prev) => ({
        ...prev,
        prohibited_phrases: [...prev.prohibited_phrases, text],
      }));
      setNewProhibitedInput('');
    }
  }

  function handleRemoveProhibitedPhrase(phrase: string) {
    setProfile((prev) => ({
      ...prev,
      prohibited_phrases: prev.prohibited_phrases.filter((p) => p !== phrase),
    }));
  }

  // Required Disclaimers Management
  function handleAddDisclaimer() {
    const text = newDisclaimerInput.trim();
    if (!text) return;
    if (!profile.required_disclaimers.includes(text)) {
      setProfile((prev) => ({
        ...prev,
        required_disclaimers: [...prev.required_disclaimers, text],
      }));
      setNewDisclaimerInput('');
    }
  }

  function handleRemoveDisclaimer(disc: string) {
    setProfile((prev) => ({
      ...prev,
      required_disclaimers: prev.required_disclaimers.filter((d) => d !== disc),
    }));
  }

  // Toggle Handlers
  async function handleToggleGuideline(id: string, currentActive: boolean) {
    try {
      const res = await fetch('/api/guidelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      if (res.ok) {
        setGuidelines((prev) =>
          prev.map((g) => (g.id === id ? { ...g, is_active: !currentActive } : g))
        );
      }
    } catch (err) {
      console.error('Failed to toggle guideline:', err);
    }
  }

  async function handleDeleteGuideline(id: string) {
    if (!confirm('Are you sure you want to delete this brand guideline rule?')) return;
    try {
      const res = await fetch(`/api/guidelines?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGuidelines((prev) => prev.filter((g) => g.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete guideline:', err);
    }
  }

  async function handleToggleFact(id: string, currentActive: boolean) {
    try {
      const res = await fetch('/api/facts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      if (res.ok) {
        setFacts((prev) =>
          prev.map((f) => (f.id === id ? { ...f, is_active: !currentActive } : f))
        );
      }
    } catch (err) {
      console.error('Failed to toggle fact:', err);
    }
  }

  async function handleDeleteFact(id: string) {
    if (!confirm('Are you sure you want to delete this approved factual claim?')) return;
    try {
      const res = await fetch(`/api/facts?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFacts((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete fact:', err);
    }
  }

  async function handleToggleAsset(id: string, currentActive: boolean) {
    try {
      const res = await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle', is_active: !currentActive }),
      });
      if (res.ok) {
        setAssets((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_active: !currentActive } : a))
        );
      }
    } catch (err) {
      console.error('Failed to toggle asset:', err);
    }
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm('Are you sure you want to delete this authorized asset?')) return;
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  }

  // Modal Handlers
  function handleOpenCreateGuideline() {
    setModalType('guideline');
    setModalMode('create');
    setEditingId(null);
    setRuleTitle('');
    setRuleType('prohibited_claim');
    setRuleSeverity('medium');
    setRuleDescription('');
    setAllowedExamples('');
    setForbiddenExamples('');
    setRuleKeywords('');
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditGuideline(rule: BrandGuideline) {
    setModalType('guideline');
    setModalMode('edit');
    setEditingId(rule.id);
    setRuleTitle(rule.title);
    setRuleType(rule.rule_type);
    setRuleSeverity(rule.severity);
    setRuleDescription(rule.description);
    setAllowedExamples((rule.rule_configuration?.allowed_examples || []).join('\n'));
    setForbiddenExamples((rule.rule_configuration?.forbidden_examples || []).join('\n'));
    setRuleKeywords((rule.rule_configuration?.keywords || []).join(', '));
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleOpenCreateFact() {
    setModalType('fact');
    setModalMode('create');
    setEditingId(null);
    setFactText('');
    setSourceName('');
    setSourceUrl('');
    setEvidenceNotes('');
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditFact(fact: ApprovedFact) {
    setModalType('fact');
    setModalMode('edit');
    setEditingId(fact.id);
    setFactText(fact.fact_text);
    setSourceName(fact.source_name);
    setSourceUrl(fact.source_url || '');
    setEvidenceNotes(fact.evidence_notes || '');
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleOpenCreateAsset() {
    setModalType('asset');
    setModalMode('create');
    setEditingId(null);
    setAssetName('');
    setAssetType('logo');
    setAssetFileUrl('');
    setAssetHexColors('');
    setAssetNotes('');
    setIsPrimaryAsset(false);
    setModalError(null);
    setIsModalOpen(true);
  }

  async function handleAssetFileUpload(file: File) {
    setIsUploadingAsset(true);
    setModalError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'assets');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAssetFileUrl(data.url);
      if (!assetName) {
        setAssetName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Asset upload failed');
    } finally {
      setIsUploadingAsset(false);
    }
  }

  async function handleSubmitModal(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      if (modalType === 'guideline') {
        const allowedList = allowedExamples.split('\n').map((s) => s.trim()).filter(Boolean);
        const forbiddenList = forbiddenExamples.split('\n').map((s) => s.trim()).filter(Boolean);
        const keywordsList = ruleKeywords.split(',').map((s) => s.trim()).filter(Boolean);

        const payload = {
          title: ruleTitle.trim(),
          description: ruleDescription.trim(),
          rule_type: ruleType,
          severity: ruleSeverity,
          rule_configuration: {
            allowed_examples: allowedList,
            forbidden_examples: forbiddenList,
            keywords: keywordsList,
          },
        };

        const res = await fetch('/api/guidelines', {
          method: modalMode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modalMode === 'edit' ? { id: editingId, ...payload } : payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save guideline');
        setIsModalOpen(false);
        await loadData();
      } else if (modalType === 'fact') {
        const payload = {
          fact_text: factText.trim(),
          source_name: sourceName.trim(),
          source_url: sourceUrl.trim() || null,
          evidence_notes: evidenceNotes.trim() || null,
        };

        const res = await fetch('/api/facts', {
          method: modalMode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modalMode === 'edit' ? { id: editingId, ...payload } : payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save fact');
        setIsModalOpen(false);
        await loadData();
      } else if (modalType === 'asset') {
        if (!assetName.trim()) throw new Error('Asset name is required');
        if (!assetFileUrl.trim()) throw new Error('Asset file URL or upload is required');

        const hexList = assetHexColors.split(',').map((s) => s.trim()).filter(Boolean);
        const payload = {
          asset_name: assetName.trim(),
          asset_type: assetType,
          file_url: assetFileUrl.trim(),
          asset_metadata: {
            hex_colors: hexList,
            notes: assetNotes.trim(),
            is_primary: isPrimaryAsset,
          },
        };

        const res = await fetch('/api/assets', {
          method: modalMode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modalMode === 'edit' ? { id: editingId, ...payload } : payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save asset');
        setIsModalOpen(false);
        await loadData();
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBrandEmpty =
    !profile.brand_name.trim() &&
    guidelines.length === 0 &&
    facts.length === 0 &&
    assets.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Brand Guidelines & Governance Standards"
        description="Configure your official brand identity, color palette, logo assets, prohibited terms, and custom rules. All active guidelines directly drive the image analysis pipeline."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-gray-500" />}
            >
              Refresh
            </Button>
            {activeTab === 'guidelines' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateGuideline}
                leftIcon={<Plus className="w-4 h-4 stroke-[2.2]" />}
              >
                Add Rule
              </Button>
            )}
            {activeTab === 'facts' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateFact}
                leftIcon={<Plus className="w-4 h-4 stroke-[2.2]" />}
              >
                Add Fact
              </Button>
            )}
            {activeTab === 'assets' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateAsset}
                leftIcon={<Plus className="w-4 h-4 stroke-[2.2]" />}
              >
                Add Asset
              </Button>
            )}
          </div>
        }
      />

      {/* Global Notifications */}
      {profileSaveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{profileSaveSuccess}</span>
          </div>
          <button onClick={() => setProfileSaveSuccess(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {profileSaveError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{profileSaveError}</span>
          </div>
          <button onClick={() => setProfileSaveError(null)} className="text-red-700 hover:text-red-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* First-time authentic empty state */}
      {isBrandEmpty && !isLoading && (
        <div className="p-6 rounded-2xl bg-teal-50/60 border border-teal-200 text-teal-950 space-y-3">
          <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-teal-700" />
            <span>Welcome to BrandGuard AI — Set Up Your Brand Standards</span>
          </div>
          <p className="text-xs text-teal-800 leading-relaxed max-w-3xl">
            No brand guidelines or rules are currently configured. Enter your brand name, official hex colors, typography, prohibited claims, and upload your official logo below. Once saved, every creative image you submit will be automatically evaluated against these active standards.
          </p>
        </div>
      )}

      {/* Workspace Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-2 sm:space-x-4">
          <button
            onClick={() => setActiveTab('identity')}
            className={`py-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'identity'
                ? 'border-teal-800 text-teal-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Brand Identity & Specs</span>
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`py-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'guidelines'
                ? 'border-teal-800 text-teal-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <BookCheck className="w-3.5 h-3.5" />
            <span>Brand Rules ({guidelines.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('facts')}
            className={`py-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'facts'
                ? 'border-teal-800 text-teal-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Approved Facts ({facts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`py-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'assets'
                ? 'border-teal-800 text-teal-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Authorized Assets ({assets.length})</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: Brand Identity & Specs */}
      {activeTab === 'identity' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader className="border-b border-gray-100 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900">
                <Palette className="w-4 h-4 text-teal-800" />
                Core Brand Profile & Specifications
              </CardTitle>
              <CardDescription>
                Define your brand identity, color palette, typography, and legal standards.
              </CardDescription>
            </CardHeader>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Row 1: Brand Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Brand Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Enterprise, WanderLuxe, PureVita"
                    value={profile.brand_name}
                    onChange={(e) => setProfile((prev) => ({ ...prev, brand_name: e.target.value }))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700/30"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Official brand or organization name.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tone of Voice
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Authoritative, direct, polished, professional"
                    value={profile.tone_of_voice || ''}
                    onChange={(e) => setProfile((prev) => ({ ...prev, tone_of_voice: e.target.value }))}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700/30"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Desired communication tone for marketing creatives.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Brand Description & Industry Positioning
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide an overview of your company, product categories, target audience, and market position..."
                  value={profile.brand_description || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, brand_description: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700/30"
                />
              </div>

              {/* Row 2: Official Brand Colors (Hex Validated) */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-gray-800">
                      Brand Color Palette (Hex Codes)
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Marketing images will be audited against these approved hex values.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {profile.brand_colors.map((color) => (
                    <div
                      key={color}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span>{color}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(color)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove color"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {profile.brand_colors.length === 0 && (
                    <span className="text-xs text-gray-400 italic">No brand colors configured yet.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 max-w-sm pt-1">
                  <input
                    type="color"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value.toUpperCase())}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value.toUpperCase())}
                    placeholder="#0F766E"
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-gray-900 focus:outline-none focus:border-teal-700"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddColor}>
                    Add Color
                  </Button>
                </div>
              </div>

              {/* Row 3: Typography Preferences */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <label className="block text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-teal-800" />
                  Typography Preferences
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[11px] font-medium text-gray-600 mb-1">Primary Typeface / Font</span>
                    <input
                      type="text"
                      placeholder="e.g. Inter, Helvetica Neue, SF Pro"
                      value={typeof profile.typography_preferences === 'object' && profile.typography_preferences !== null ? (profile.typography_preferences.primary_font || '') : (typeof profile.typography_preferences === 'string' ? profile.typography_preferences : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile((prev) => {
                          const currentTypo = typeof prev.typography_preferences === 'object' && prev.typography_preferences !== null ? prev.typography_preferences : {};
                          return {
                            ...prev,
                            typography_preferences: {
                              ...currentTypo,
                              primary_font: val,
                            },
                          };
                        });
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-gray-600 mb-1">Secondary / Heading Typeface</span>
                    <input
                      type="text"
                      placeholder="e.g. Playfair Display, Roboto Slab"
                      value={typeof profile.typography_preferences === 'object' && profile.typography_preferences !== null ? (profile.typography_preferences.secondary_font || '') : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile((prev) => {
                          const currentTypo = typeof prev.typography_preferences === 'object' && prev.typography_preferences !== null ? prev.typography_preferences : {};
                          return {
                            ...prev,
                            typography_preferences: {
                              ...currentTypo,
                              secondary_font: val,
                            },
                          };
                        });
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Official Logo Upload / Specification */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <label className="block text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-teal-800" />
                  Official Logo Asset
                </label>
                <p className="text-[11px] text-gray-500">
                  Upload or specify your official logo mark. The pipeline uses this reference to detect distorted, stretched, or low-resolution logos on uploaded creatives.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {profile.official_logo_url ? (
                    <div className="relative p-2 rounded-lg border border-gray-200 bg-gray-50 max-w-[200px] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.official_logo_url}
                        alt="Official Brand Logo"
                        className="max-h-16 w-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setProfile((prev) => ({ ...prev, official_logo_url: '' }))}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-white text-gray-500 shadow border border-gray-200 hover:text-red-600"
                        title="Remove logo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-400">
                      No official logo uploaded.
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      ref={logoUploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleLogoUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={isUploadingLogo}
                      onClick={() => logoUploadInputRef.current?.click()}
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                    >
                      Upload Official Logo File
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">Or URL:</span>
                      <input
                        type="text"
                        placeholder="/assets/logo-primary.svg or https://..."
                        value={profile.official_logo_url || ''}
                        onChange={(e) => setProfile((prev) => ({ ...prev, official_logo_url: e.target.value }))}
                        className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-800 font-mono w-64 focus:outline-none focus:border-teal-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 5: Prohibited Phrases */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-800">
                    Prohibited Words or Phrases
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Phrases that must NEVER appear in marketing creatives (e.g. unverified absolutes, misleading claims).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {profile.prohibited_phrases.map((phrase) => (
                    <span
                      key={phrase}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-xs text-red-900 font-medium"
                    >
                      <span>&ldquo;{phrase}&rdquo;</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProhibitedPhrase(phrase)}
                        className="text-red-400 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {profile.prohibited_phrases.length === 0 && (
                    <span className="text-xs text-gray-400 italic">No prohibited phrases added yet.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 max-w-md pt-1">
                  <input
                    type="text"
                    value={newProhibitedInput}
                    onChange={(e) => setNewProhibitedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProhibitedPhrase();
                      }
                    }}
                    placeholder="e.g. 100% unhackable, risk-free"
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddProhibitedPhrase}>
                    Add Phrase
                  </Button>
                </div>
              </div>

              {/* Row 6: Required Disclaimers */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-800">
                    Required Disclaimers & Legal Copy
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Mandatory disclosures that must accompany specific promotional or factual creatives.
                  </p>
                </div>

                <div className="space-y-1.5">
                  {profile.required_disclaimers.map((disc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 p-2 rounded bg-gray-50 border border-gray-200 text-xs text-gray-800"
                    >
                      <span className="flex-1 leading-relaxed">&ldquo;{disc}&rdquo;</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDisclaimer(disc)}
                        className="text-gray-400 hover:text-red-600 mt-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {profile.required_disclaimers.length === 0 && (
                    <span className="text-xs text-gray-400 italic block">No mandatory disclaimers configured.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newDisclaimerInput}
                    onChange={(e) => setNewDisclaimerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDisclaimer();
                      }
                    }}
                    placeholder="e.g. Terms apply. Results may vary based on deployment configuration."
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddDisclaimer}>
                    Add Disclaimer
                  </Button>
                </div>
              </div>

              {/* Row 7: Additional Custom Rules */}
              <div className="border-t border-gray-100 pt-5 space-y-2">
                <label className="block text-xs font-semibold text-gray-800">
                  Additional Custom Brand Rules
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify any additional guidelines, photography rules, aspect ratio mandates, or company policy instructions..."
                  value={typeof profile.additional_rules === 'string' ? profile.additional_rules : Array.isArray(profile.additional_rules) ? profile.additional_rules.map((r) => r.description || r.title).join('\n') : ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, additional_rules: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSavingProfile}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  Save Brand Profile
                </Button>
              </div>
            </div>
          </Card>
        </form>
      )}

      {/* TAB 2: Brand Rules */}
      {activeTab === 'guidelines' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading active rules...</p>
            </div>
          ) : guidelines.length === 0 ? (
            <EmptyState
              icon={BookCheck}
              title="No Brand Rules Defined"
              description="Create your first rule to govern prohibited claims, required disclaimers, or layout standards across marketing creatives."
              actionLabel="Add First Rule"
              onActionClick={handleOpenCreateGuideline}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guidelines.map((rule) => {
                const badge = getSeverityBadge(rule.severity);
                return (
                  <Card
                    key={rule.id}
                    className={`bg-white border transition-all shadow-xs ${
                      rule.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {formatRuleTypeLabel(rule.rule_type)}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleGuideline(rule.id, rule.is_active)}
                          className={`p-1.5 rounded transition-colors ${
                            rule.is_active
                              ? 'text-teal-800 hover:bg-teal-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditGuideline(rule)}
                          className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="Edit rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGuideline(rule.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{rule.title}</h4>
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">{rule.description}</p>

                    {rule.rule_configuration?.keywords && rule.rule_configuration.keywords.length > 0 && (
                      <div className="mb-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                          Audited Keywords:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {rule.rule_configuration.keywords.map((kw, i) => (
                            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Approved Facts & Claims */}
      {activeTab === 'facts' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading approved facts...</p>
            </div>
          ) : facts.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="No Approved Facts Registered"
              description="Register verified claims, benchmark metrics, SLA stats, or certification numbers that creatives can reference safely."
              actionLabel="Add Approved Fact"
              onActionClick={handleOpenCreateFact}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facts.map((fact) => (
                <Card
                  key={fact.id}
                  className={`bg-white border transition-all shadow-xs ${
                    fact.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Verified Benchmark Fact
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleFact(fact.id, fact.is_active)}
                        className={`p-1.5 rounded transition-colors ${
                          fact.is_active ? 'text-teal-800 hover:bg-teal-50' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={fact.is_active ? 'Deactivate fact' : 'Activate fact'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditFact(fact)}
                        className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        title="Edit fact"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFact(fact.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete fact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-gray-900 mb-2 leading-relaxed">
                    &ldquo;{fact.fact_text}&rdquo;
                  </p>

                  <div className="pt-2 border-t border-gray-100 space-y-1 text-[11px] text-gray-500">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-600">Source:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">{fact.source_name}</span>
                    </div>
                    {fact.source_url && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-600">Reference:</span>
                        <a
                          href={fact.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-700 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                        >
                          <span className="truncate">{fact.source_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Authorized Assets */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading authorized assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No Authorized Assets Uploaded"
              description="Upload primary logos, authorized trust badges, or brand palette tokens for pre-publication visual validation."
              actionLabel="Add Visual Asset"
              onActionClick={handleOpenCreateAsset}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((asset) => (
                <Card
                  key={asset.id}
                  className={`bg-white border transition-all shadow-xs ${
                    asset.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {asset.asset_type}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleAsset(asset.id, asset.is_active)}
                        className={`p-1.5 rounded transition-colors ${
                          asset.is_active ? 'text-teal-800 hover:bg-teal-50' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={asset.is_active ? 'Deactivate asset' : 'Activate asset'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="h-28 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center p-3 mb-3 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.file_url}
                      alt={asset.asset_name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <h4 className="text-xs font-semibold text-gray-900 truncate mb-1">{asset.asset_name}</h4>
                  <p className="text-[11px] text-gray-500 font-mono truncate">{asset.file_url}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'guideline'
            ? `${modalMode === 'edit' ? 'Edit' : 'Add'} Brand Rule`
            : modalType === 'fact'
            ? `${modalMode === 'edit' ? 'Edit' : 'Add'} Approved Benchmark Fact`
            : `${modalMode === 'edit' ? 'Edit' : 'Add'} Authorized Visual Asset`
        }
        description={
          modalType === 'guideline'
            ? 'Define compliance standards evaluated across creative images.'
            : modalType === 'fact'
            ? 'Register substantiated metrics and SLA claims.'
            : 'Add verified logos, color standards, or badges.'
        }
      >
        <form onSubmit={handleSubmitModal} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {modalError}
            </div>
          )}

          {modalType === 'guideline' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rule Title *</label>
                <input
                  type="text"
                  required
                  value={ruleTitle}
                  onChange={(e) => setRuleTitle(e.target.value)}
                  placeholder="e.g. Prohibited Absolute Claims"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rule Type *</label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                  >
                    <option value="prohibited_claim">Prohibited Claim / Absolute Language</option>
                    <option value="required_disclaimer">Required Disclaimer</option>
                    <option value="color_palette">Color Palette Standards</option>
                    <option value="aspect_ratio">Aspect Ratio Governance</option>
                    <option value="typography">Typography & Font Policy</option>
                    <option value="voice_and_tone">Voice & Tone Standards</option>
                    <option value="logo_guideline">Logo Integrity & Clear Space</option>
                    <option value="competitors">Competitor Mentions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Severity *</label>
                  <select
                    value={ruleSeverity}
                    onChange={(e) => setRuleSeverity(e.target.value as RuleSeverity)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                  >
                    <option value="critical">Critical (Blocks Publication)</option>
                    <option value="high">High (Action Required)</option>
                    <option value="medium">Medium (Advisory)</option>
                    <option value="low">Low (Cosmetic / Suggestion)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rule Description *</label>
                <textarea
                  rows={3}
                  required
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="Explain why this rule exists and how to comply..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keywords to Inspect (comma-separated)</label>
                <input
                  type="text"
                  value={ruleKeywords}
                  onChange={(e) => setRuleKeywords(e.target.value)}
                  placeholder="e.g. unhackable, 100% guarantee, risk-free"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>
            </>
          )}

          {modalType === 'fact' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Verified Fact Text *</label>
                <textarea
                  rows={3}
                  required
                  value={factText}
                  onChange={(e) => setFactText(e.target.value)}
                  placeholder="e.g. Acme Enterprise maintains a documented 99.9% uptime SLA."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Source Name / Authority *</label>
                <input
                  type="text"
                  required
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. 2026 Corporate SLA Benchmark Report"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reference URL (Optional)</label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>
            </>
          )}

          {modalType === 'asset' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. Primary Horizontal Logo"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Asset Type *</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700"
                >
                  <option value="logo">Official Logo Mark</option>
                  <option value="color_palette">Color Palette Token</option>
                  <option value="badge">Trust / Verification Badge</option>
                  <option value="product_image">Authorized Product Graphic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Asset File URL or Upload *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={assetFileUrl}
                    onChange={(e) => setAssetFileUrl(e.target.value)}
                    placeholder="/assets/logo.svg or https://..."
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-teal-700 font-mono"
                  />
                  <input
                    ref={assetFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAssetFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isLoading={isUploadingAsset}
                    onClick={() => assetFileInputRef.current?.click()}
                  >
                    Browse
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {modalMode === 'edit' ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
