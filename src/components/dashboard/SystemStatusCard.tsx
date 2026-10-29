import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Database, Eye, BookCheck, ShieldCheck, AlertCircle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface SystemStatusCardProps {
  dbConfigured: boolean;
  guidelinesCount: number;
  factsCount: number;
}

export function SystemStatusCard({
  dbConfigured,
  guidelinesCount,
  factsCount,
}: SystemStatusCardProps) {
  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900">
            <ShieldCheck className="w-4 h-4 text-teal-800" />
            Governance Engine Infrastructure
          </CardTitle>
          <CardDescription>
            Core platform capabilities powering image review, OCR, brand rules, and persistent audit logs
          </CardDescription>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Database Node */}
        <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-700" />
              Audit Data Storage
            </span>
            {dbConfigured ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Active Local
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            {dbConfigured
              ? 'Stores reviews, brand rules, verified facts, and authorized assets.'
              : 'Local persistent store active in .data/db.json.'}
          </p>
        </div>

        {/* Brand Rules & Assets Knowledge Base */}
        <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <BookCheck className="w-3.5 h-3.5 text-teal-700" />
              Brand Knowledge
            </span>
            <Link
              href="/guidelines"
              className="text-[11px] text-teal-800 hover:text-teal-950 font-medium flex items-center gap-0.5"
            >
              Configure <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-[11px] text-gray-500">
            {guidelinesCount} brand rules · {factsCount} verified facts · Authorized visual assets registry.
          </p>
        </div>

        {/* Multimodal Vision & OCR Engine */}
        <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-teal-700" />
              Vision & OCR Engine
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
              Multimodal
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Image-first analysis extracting embedded typography, logo verification, and bounding boxes.
          </p>
        </div>
      </div>
    </Card>
  );
}
