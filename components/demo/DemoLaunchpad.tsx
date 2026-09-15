'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFinance } from '@/lib/store/finance-context';
import { DEMO_WORKSPACE } from '@/lib/store/demo-data';

export const DemoLaunchpad: React.FC = () => {
  const router = useRouter();
  const { resetToDemoData, switchWorkspace } = useFinance();
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchDemo = async () => {
    setIsLaunching(true);
    try {
      // Ensure the existing demo state is activated
      resetToDemoData();
      await switchWorkspace(DEMO_WORKSPACE.id);
    } catch (err) {
      console.warn('Demo activation warning:', err);
    } finally {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-surface via-surface-container-low to-surface flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-outline-variant/60">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-primary text-secondary-fixed flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[20px] icon-fill">
              account_balance_wallet
            </span>
          </div>
          <span className="font-headline-md text-base font-bold text-primary tracking-tight">
            FundFlow
          </span>
        </Link>

        <Link
          href="/"
          className="text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          <span>Back to FundFlow</span>
        </Link>
      </header>

      {/* Main Launchpad Card */}
      <main className="max-w-2xl mx-auto w-full my-auto py-8">
        <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-6 sm:p-10 shadow-xl space-y-6">
          {/* Header Badge & Title */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed/20 border border-secondary-fixed/40 text-secondary text-xs font-mono-data font-bold uppercase tracking-wider">
              <span>DEMO WORKSPACE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
              Launch Simulated Environment
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-lg mx-auto">
              Explore real-time runway forecasting, deterministic spend analytics, automated risk guardrails, and grounded AI queries in an isolated sandbox.
            </p>
          </div>

          {/* Mandatory Transparency & Synthetic Disclosures */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/70 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
              <span>Synthetic Sandbox Transparency</span>
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              Financial data displayed in this workspace is simulated for demonstration purposes.
            </p>
            <p className="text-on-surface-variant leading-relaxed">
              Acme Technologies and Alex Rivera are synthetic demonstration entities and are not real customers.
            </p>
          </div>

          {/* Pre-loaded Sandbox Features */}
          <div className="space-y-2.5 pt-1">
            <span className="text-[11px] font-mono-data font-semibold text-outline uppercase tracking-wider block">
              Pre-Loaded In This Demo Workspace:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/50 flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                  receipt_long
                </span>
                <span className="text-on-surface">18 realistic transactions across 3 operating months</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/50 flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                  account_balance
                </span>
                <span className="text-on-surface">$1,200,000 USD baseline starting cash allocation</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/50 flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                  warning
                </span>
                <span className="text-on-surface">3 active risk alerts (runway floor & expense spikes)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/50 flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                  smart_toy
                </span>
                <span className="text-on-surface">Grounded AI Co-Pilot & Headcount Simulator</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleLaunchDemo}
              disabled={isLaunching}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl text-xs sm:text-sm font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              {isLaunching ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  <span>Preparing Demo Workspace...</span>
                </>
              ) : (
                <>
                  <span>Launch Demo Dashboard</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    rocket_launch
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs text-on-surface-variant">
              <Link href="/" className="hover:underline flex items-center gap-1">
                <span>&larr; Back to FundFlow</span>
              </Link>

              <Link href="/signup" className="text-primary font-semibold hover:underline">
                Create Real Organization &rarr;
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Launchpad Footer */}
      <footer className="max-w-4xl mx-auto w-full pt-6 text-center text-[11px] text-outline border-t border-outline-variant/40">
        FundFlow Demo Workspace • Simulated Evaluation Environment • Not Real Financial Advice
      </footer>
    </div>
  );
};
