'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Plus, Database, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AppHeaderProps {
  onToggleMobileNav?: () => void;
  isMobileNavOpen?: boolean;
}

export function AppHeader({ onToggleMobileNav, isMobileNavOpen }: AppHeaderProps) {
  const [dbStatus, setDbStatus] = useState<'checking' | 'supabase' | 'local'>('checking');

  useEffect(() => {
    async function checkDb() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data.database?.configured && data.database?.reachable) {
            setDbStatus('supabase');
          } else {
            setDbStatus('local');
          }
        } else {
          setDbStatus('local');
        }
      } catch {
        setDbStatus('local');
      }
    }
    checkDb();
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Mobile Toggle + Logo */}
        <div className="flex items-center gap-3">
          {onToggleMobileNav && (
            <button
              onClick={onToggleMobileNav}
              className="md:hidden text-gray-500 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100"
              aria-label="Toggle navigation menu"
            >
              {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-teal-800 flex items-center justify-center text-white shadow-xs group-hover:bg-teal-900 transition-colors">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 tracking-tight text-base">
                  Brand<span className="text-teal-800">Guard</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-none hidden sm:block">
                Image-First Brand Governance & Creative Compliance
              </p>
            </div>
          </Link>
        </div>

        {/* Right: Environment & DB Indicator + New Review Action */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* DB Indicator Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs">
            <Database className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-500 font-medium">DB:</span>
            {dbStatus === 'checking' ? (
              <span className="text-gray-400 animate-pulse">Checking...</span>
            ) : dbStatus === 'supabase' ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium" title="Audit Data Storage connected and verified">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Data Storage Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-teal-700 font-medium" title="Audit Data Storage active">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                Data Storage
              </span>
            )}
          </div>

          {/* Quick Action Button */}
          <Link href="/reviews/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4 stroke-[2.2]" />}
            >
              <span className="hidden xs:inline">New Review</span>
              <span className="xs:hidden">Review</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
