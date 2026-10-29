'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';

interface SystemHealthResponse {
  status: 'connected' | 'ok' | 'degraded';
  database: {
    configured: boolean;
    missingVars: string[];
  };
  llmEngine: {
    status: string;
    phase: string;
  };
}

export function StatusBanner() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        }
      } catch {
        // Silently handle offline/static build check
      } finally {
        setIsLoading(false);
      }
    }

    checkHealth();
  }, []);

  if (isLoading || !health || isDismissed) {
    return null;
  }

  // If database is not configured, show clear setup prompt
  if (!health.database?.configured) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong className="font-semibold text-amber-950">Database Setup Notice:</strong>{' '}
              Missing variables: <code className="bg-amber-100/70 px-1 py-0.5 rounded text-amber-950 font-mono text-[11px]">{health.database.missingVars.join(', ')}</code>. Using active local store.
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/guidelines"
              className="inline-flex items-center gap-1 text-teal-800 hover:text-teal-950 font-medium underline underline-offset-2"
            >
              Configure
              <ChevronRight className="w-3 h-3" />
            </Link>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-amber-700 hover:text-amber-950 p-0.5 rounded"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
