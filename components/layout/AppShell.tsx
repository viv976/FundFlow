'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FinanceProvider } from '@/lib/store/finance-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { MobileNav } from '@/components/layout/MobileNav';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <FinanceProvider>
      {isAuthPage ? (
        <div className="min-h-screen w-full bg-surface-container-lowest text-on-surface overflow-y-auto">
          {children}
        </div>
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
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
