'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFinance } from '@/lib/store/finance-context';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const { alerts } = useFinance();
  const unreadAlerts = alerts.filter((a) => a.status === 'active').length;

  const items = [
    { label: 'Dashboard', href: '/', icon: 'dashboard' },
    { label: 'Transactions', href: '/transactions', icon: 'receipt_long' },
    { label: 'Upload', href: '/upload', icon: 'cloud_upload' },
    { label: 'Ask AI', href: '/ask-ai', icon: 'smart_toy' },
    { label: 'Alerts', href: '/alerts', icon: 'notifications', badge: unreadAlerts },
    { label: 'Settings', href: '/settings', icon: 'settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1 h-16 bg-primary border-t border-primary-container">
      {items.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 transition-all flex-1 h-full relative ${
              isActive
                ? 'text-secondary-fixed-dim border-t-2 border-secondary-fixed-dim bg-primary-container/30'
                : 'text-on-primary-container hover:bg-primary-container/20'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${isActive ? 'icon-fill' : ''}`}>
              {item.icon}
            </span>
            <span className="font-label-md text-[10px] mt-0.5 tracking-tight truncate">
              {item.label}
            </span>

            {Boolean(item.badge && item.badge > 0) && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-primary"></span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};
