'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFinance } from '@/lib/store/finance-context';
import { DEMO_WORKSPACE } from '@/lib/store/demo-data';

export const DemoBanner: React.FC = () => {
  const router = useRouter();
  const { workspace } = useFinance();

  // Reliably identify demo workspace by canonical ID, never by display name
  const isDemo = workspace.id === DEMO_WORKSPACE.id;

  if (!isDemo) {
    return null;
  }

  const handleExitDemo = () => {
    router.push('/');
  };

  return (
    <aside
      aria-label="Demo Workspace Notice"
      className="w-full bg-primary text-on-primary border-b border-secondary-fixed/20 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded bg-secondary-fixed/20 border border-secondary-fixed/40 text-secondary-fixed font-mono-data font-bold text-[10px] tracking-wider uppercase shrink-0">
            DEMO WORKSPACE
          </span>
          <p className="text-on-primary-container/95 text-xs leading-tight">
            Financial data shown here is simulated for demonstration purposes. Acme Technologies and Alex Rivera are synthetic demonstration entities, not real customers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <Link
            href="/onboarding"
            className="px-3 py-1 rounded-lg bg-secondary-fixed text-on-secondary-fixed font-semibold text-[11px] hover:bg-secondary-fixed-dim transition-colors flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-[14px]">add_circle</span>
            <span>Create Real Workspace</span>
          </Link>

          <button
            onClick={handleExitDemo}
            className="px-2.5 py-1 rounded-lg border border-outline-variant/40 hover:bg-primary-container text-on-primary font-medium text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">logout</span>
            <span>Exit Demo</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
