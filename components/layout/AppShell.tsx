'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FinanceProvider } from '@/lib/store/finance-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { DemoBanner } from '@/components/layout/DemoBanner';

interface AppShellProps {
  children: React.ReactNode;
}

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
    <FinanceProvider>
      {isStandalonePage ? (
        <div className="min-h-screen w-full bg-background text-on-surface">
          {children}
        </div>
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            <DemoBanner />
            <TopHeader />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
              {children}
            </main>
          </div>

          {/* Mobile Navigation */}
          <MobileNav />
        </div>
      )}
    </FinanceProvider>
  );
};
