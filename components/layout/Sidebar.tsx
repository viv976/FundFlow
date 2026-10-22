'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFinance } from '@/lib/store/finance-context';
import { DEMO_WORKSPACE } from '@/lib/store/demo-data';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ALL_NAV_ITEMS, isRouteActive } from '@/lib/navigation';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, alerts, signOutUser, workspace, isDemo, isLoading } = useFinance();

  const isCurrentDemo = Boolean(isDemo && workspace && workspace.id === DEMO_WORKSPACE.id);
  const unreadAlertsCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <aside className="hidden md:flex flex-col w-[280px] bg-primary h-full border-r border-outline-variant/20 flex-shrink-0 z-40 relative select-none">
      {/* Brand Header */}
      <div className="px-6 pt-6 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary-fixed/20 border border-secondary-fixed/30 flex items-center justify-center text-secondary-fixed shadow-md">
          <span className="material-symbols-outlined text-[24px] icon-fill">
            account_balance_wallet
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-headline-md text-lg text-on-primary font-bold tracking-tight block">
              FundFlow
            </span>
            {isCurrentDemo && (
              <span className="px-1.5 py-0.5 rounded bg-secondary-fixed/20 border border-secondary-fixed/40 text-secondary-fixed text-[9px] font-mono-data font-bold tracking-wide uppercase">
                DEMO
              </span>
            )}
          </div>
          <span className="text-[10px] font-label-md text-secondary-fixed uppercase tracking-wider block font-bold">
            {isCurrentDemo ? 'Simulated Workspace' : 'Multi-Tenant Ledger'}
          </span>
        </div>
      </div>

      {/* Business / Workspace Switcher */}
      <div className="px-4 py-2">
        <WorkspaceSwitcher />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {ALL_NAV_ITEMS.map((item) => {
          const isActive = isRouteActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all group ${
                isActive
                  ? 'bg-primary-container text-secondary-fixed border-l-4 border-secondary-fixed font-semibold shadow-inner'
                  : 'text-on-primary-container/80 hover:bg-primary-container/40 hover:text-on-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`material-symbols-outlined text-[20px] transition-colors ${
                    isActive ? 'icon-fill text-secondary-fixed' : 'text-on-primary-container/70 group-hover:text-on-primary'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="font-label-md text-xs">{item.label}</span>
              </div>

              {item.label === 'Risk Alerts' && unreadAlertsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-error text-on-error text-[10px] font-bold font-mono-data">
                  {unreadAlertsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Log Out */}
      <div className="p-4 mt-auto border-t border-outline-variant/20 space-y-2 shrink-0">
        <div className="p-2.5 bg-primary-container rounded-xl border border-primary-fixed-variant/20 flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-secondary-fixed/20 border border-secondary-fixed/40 flex items-center justify-center text-secondary-fixed shrink-0 font-bold font-mono-data text-xs">
            {user?.full_name ? user.full_name.substring(0, 1).toUpperCase() : 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-md text-xs text-on-primary truncate font-semibold">
              {user?.full_name || (isLoading ? 'Loading...' : 'Account')}
            </span>
            <span className="font-body-sm text-[10px] text-on-primary-fixed-variant truncate">
              {user?.email || ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={signOutUser}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-on-primary-container/90 hover:bg-error-container/25 hover:text-error transition-all group cursor-pointer text-left font-medium border border-outline-variant/20"
          title="Log Out"
          aria-label="Log Out"
        >
          <span className="material-symbols-outlined text-[18px] text-on-primary-container/70 group-hover:text-error transition-colors">
            logout
          </span>
          <span className="font-label-md text-xs font-semibold">Log Out</span>
        </button>
      </div>
    </aside>
  );
};
