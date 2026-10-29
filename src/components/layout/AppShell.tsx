'use client';

import React, { useState } from 'react';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { StatusBanner } from '@/components/ui/StatusBanner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#111827]">
      {/* Dynamic Status / DB notification banner */}
      <StatusBanner />

      {/* Top Application Header */}
      <AppHeader
        onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        isMobileNavOpen={isMobileNavOpen}
      />

      {/* Main Workspace with Fixed/Responsive Sidebar */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
