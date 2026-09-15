'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export const LandingHeader: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary text-secondary-fixed flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px] icon-fill">
              account_balance_wallet
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md text-lg font-bold text-primary tracking-tight leading-none">
              FundFlow
            </span>
            <span className="text-[10px] font-mono-data text-secondary uppercase tracking-wider font-semibold">
              Financial Intelligence
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-on-surface-variant">
          <a href="#capabilities" className="hover:text-primary transition-colors">
            Capabilities
          </a>
          <a href="#how-it-works" className="hover:text-primary transition-colors">
            How It Works
          </a>
          <a href="#product-preview" className="hover:text-primary transition-colors">
            Product Preview
          </a>
          <a href="#product-status" className="hover:text-primary transition-colors">
            Product Status
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <a
            href="https://github.com/viv976/FundFlow"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            <span>View GitHub</span>
          </a>

          <Link
            href="/login"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-surface-container transition-colors"
          >
            Sign In
          </Link>

          <Link
            href="/demo"
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-sm flex items-center gap-1.5 group"
          >
            <span>Explore Demo</span>
            <span className="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-on-surface hover:bg-surface-container rounded-lg"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined text-[24px]">
            {isMobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-outline-variant bg-surface px-4 pt-2 pb-6 space-y-3">
          <nav className="flex flex-col space-y-2.5 text-sm font-medium text-on-surface-variant">
            <a
              href="#capabilities"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-container"
            >
              Capabilities
            </a>
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-container"
            >
              How It Works
            </a>
            <a
              href="#product-preview"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-container"
            >
              Product Preview
            </a>
            <a
              href="#product-status"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-container"
            >
              Product Status
            </a>
          </nav>

          <div className="pt-3 border-t border-outline-variant flex flex-col gap-2">
            <Link
              href="/demo"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold text-center shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>Explore Demo</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>

            <a
              href="https://github.com/viv976/FundFlow"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 border border-outline-variant text-on-surface rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">code</span>
              <span>View GitHub</span>
            </a>

            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2 text-primary rounded-xl text-xs font-semibold text-center"
            >
              Sign In to Your Workspace
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
