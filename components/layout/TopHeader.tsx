'use client';

import React from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';

import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface TopHeaderProps {
  title?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ title }) => {
  const { user, alerts, signOutUser } = useFinance();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const activeAlerts = alerts.filter((a) => a.status === 'active');

  return (
    <header className="md:hidden flex justify-between items-center px-4 py-3 w-full bg-surface border-b border-outline-variant sticky top-0 z-30 shrink-0">
      <div className="flex-1 max-w-[200px]">
        <WorkspaceSwitcher />
      </div>

      <div className="flex items-center gap-3">
        <Link href="/alerts" className="relative p-1 text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {activeAlerts.length > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full ring-2 ring-surface"></span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-8 h-8 rounded-full bg-secondary-fixed/20 border border-secondary-fixed/40 flex items-center justify-center font-bold text-xs text-secondary-fixed"
          >
            {user.full_name.substring(0, 1).toUpperCase()}
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 p-2 text-xs text-on-surface">
              <div className="px-3 py-2 border-b border-outline-variant/60">
                <span className="font-semibold block truncate">{user.full_name}</span>
                <span className="text-[10px] text-on-surface-variant truncate block">{user.email}</span>
              </div>
              <Link
                href="/settings"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-sm">settings</span>
                <span>Settings</span>
              </Link>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  signOutUser();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-error-container/30 text-error transition-colors text-left"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
