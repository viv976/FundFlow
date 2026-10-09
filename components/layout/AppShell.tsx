'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFinance } from '@/lib/store/finance-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { DemoBanner } from '@/components/layout/DemoBanner';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShellLayout: React.FC<{ isStandalonePage: boolean; children: React.ReactNode }> = ({
  isStandalonePage,
  children,
}) => {
  const router = useRouter();
  const { isLoading, status, isWorkspaceReady } = useFinance();

  // Redirect unauthenticated visitors trying to access authenticated app pages
  useEffect(() => {
    if (!isStandalonePage && status === 'unauthenticated' && !isLoading) {
      router.push('/login');
    }
  }, [isStandalonePage, status, isLoading, router]);

  if (isStandalonePage) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full bg-background text-on-surface">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-on-surface">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <DemoBanner />
        <TopHeader />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-32 md:pb-8 flex flex-col">
          {isLoading || !isWorkspaceReady ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4 animate-fadeIn">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-on-surface">Loading your workspace...</p>
                <p className="text-xs text-on-surface-variant">Connecting to verified financial ledger</p>
              </div>
            </div>
          ) : status === 'no_workspace' ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4 animate-fadeIn">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">business</span>
              </div>
              <div className="text-center space-y-1.5 max-w-sm">
                <h2 className="text-lg font-bold text-on-surface">No Workspace Found</h2>
                <p className="text-xs text-on-surface-variant">
                  You do not have an active corporate workspace yet. Create a workspace to begin tracking financial metrics.
                </p>
              </div>
              <Link
                href="/onboarding"
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Create Workspace</span>
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();

  // Public/standalone routes do not render internal application navigation
  const isStandalonePage =
    pathname === '/' ||
    pathname === '/demo' ||
    pathname === '/login' ||
    pathname === '/signup';

  // Scope overflow lock strictly to application routes, enabling natural document scroll on standalone pages
  useEffect(() => {
    if (!isStandalonePage) {
      document.body.classList.add('overflow-hidden', 'h-full');
      document.documentElement.classList.add('h-full');
    } else {
      document.body.classList.remove('overflow-hidden', 'h-full');
      document.documentElement.classList.remove('h-full');
    }

    return () => {
      document.body.classList.remove('overflow-hidden', 'h-full');
      document.documentElement.classList.remove('h-full');
    };
  }, [isStandalonePage]);

  return (
    <AppShellLayout isStandalonePage={isStandalonePage}>
      {children}
    </AppShellLayout>
  );
};
