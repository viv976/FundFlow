'use client';

import React from 'react';
import Link from 'next/link';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="w-full bg-surface border-t border-outline-variant/60 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary text-secondary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px] icon-fill">
                  account_balance_wallet
                </span>
              </div>
              <span className="font-headline-md text-base font-bold text-primary tracking-tight">
                FundFlow
              </span>
            </div>
            <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed">
              Financial intelligence for early-stage teams. Deterministic runway forecasting, ledger analytics, and grounded AI insights.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-on-surface-variant">
            <a href="#capabilities" className="hover:text-primary transition-colors">
              Capabilities
            </a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#product-preview" className="hover:text-primary transition-colors">
              Preview
            </a>
            <a href="#product-status" className="hover:text-primary transition-colors">
              Status & Transparency
            </a>
            <a
              href="https://github.com/viv976/FundFlow"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
            <Link href="/demo" className="text-primary hover:underline">
              Explore Demo
            </Link>
            <Link href="/login" className="hover:text-primary transition-colors">
              Sign In
            </Link>
          </div>
        </div>

        <div className="pt-6 border-t border-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-outline">
          <p>© {new Date().getFullYear()} FundFlow. Developed for early-stage startup operators.</p>
          <p className="text-center sm:text-right">
            Not certified financial, tax, or investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
};
