'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileCheck2,
  History,
  BookCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'New Content Review',
    href: '/reviews/new',
    icon: FileCheck2,
  },
  {
    label: 'Review History',
    href: '/reviews',
    icon: History,
  },
  {
    label: 'Guidelines, Facts & Assets',
    href: '/guidelines',
    icon: BookCheck,
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarNavContent({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isCurrentActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col pt-16 md:pt-0 transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:z-0 shrink-0',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Navigation Section */}
        <div className="flex-1 px-3 py-6 space-y-1">
          <div className="px-3 mb-2">
            <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Brand Governance
            </p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isCurrentActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-200/70'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'w-4 h-4 transition-colors',
                        active ? 'text-teal-700' : 'text-gray-400 group-hover:text-gray-600'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="pt-6 px-3 mb-2">
            <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Governance Engine
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Platform</span>
              <span className="text-gray-800 font-mono text-[11px]">Image-First</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Database</span>
              <span className="text-gray-800 font-mono text-[11px]">Audit Storage</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Vision & OCR</span>
              <span className="text-teal-700 font-medium text-[11px]">Active</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span>BrandGuard AI</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Governance Engine Online" />
        </div>
      </aside>
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense
      fallback={
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 hidden md:flex flex-col pt-0 shrink-0" />
      }
    >
      <SidebarNavContent {...props} />
    </Suspense>
  );
}
