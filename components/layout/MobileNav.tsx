'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinance } from '@/lib/store/finance-context';
import {
  PRIMARY_MOBILE_ITEMS,
  SECONDARY_MOBILE_ITEMS,
  isRouteActive,
  isSecondaryRouteActive,
} from '@/lib/navigation';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const { alerts, user, signOutUser } = useFinance();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const unreadAlerts = alerts.filter((a) => a.status === 'active').length;
  const isSecondaryActive = isSecondaryRouteActive(pathname);

  // Reset More sheet during render on pathname change (React-recommended pattern)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMoreOpen(false);
  }

  // Handle escape key to close More sheet & lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMoreOpen) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMoreOpen]);

  return (
    <>
      {/* Polished Floating Navigation Bar for Mobile / Minimized Viewports */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed z-40 left-1/2 -translate-x-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] w-[calc(100%-1.5rem)] max-w-md h-14 bg-primary/95 text-on-primary backdrop-blur-md rounded-full border border-primary-container/80 shadow-2xl shadow-primary/30 flex items-center justify-between px-1.5 py-1 select-none"
      >
        {PRIMARY_MOBILE_ITEMS.map((item) => {
          const isActive = isRouteActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative z-10 flex flex-col items-center justify-center flex-1 h-full py-0.5 rounded-full transition-colors focus:outline-none ${
                isActive ? 'text-secondary-fixed' : 'text-on-primary-container/80 hover:text-on-primary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="floating-nav-active-pill"
                  className="absolute inset-0 bg-primary-container rounded-full border border-secondary-fixed/40 shadow-inner -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`material-symbols-outlined text-[19px] leading-none ${isActive ? 'icon-fill' : ''}`}>
                {item.icon}
              </span>
              <span className="font-label-md text-[9px] font-semibold tracking-tight mt-0.5 truncate w-full text-center px-0.5">
                {item.id === 'scenarios' ? 'Scenarios' : item.id === 'ask-ai' ? 'AI Co-Pilot' : item.label}
              </span>
            </Link>
          );
        })}

        {/* 5th Destination: More Menu Trigger */}
        <button
          type="button"
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          aria-expanded={isMoreOpen}
          aria-haspopup="dialog"
          aria-label="More navigation options"
          className={`relative z-10 flex flex-col items-center justify-center flex-1 h-full py-0.5 rounded-full transition-colors focus:outline-none cursor-pointer ${
            isMoreOpen || (!isRouteActive('/dashboard', pathname) && isSecondaryActive)
              ? 'text-secondary-fixed'
              : 'text-on-primary-container/80 hover:text-on-primary'
          }`}
        >
          {(isMoreOpen || (!isRouteActive('/dashboard', pathname) && isSecondaryActive)) && (
            <motion.div
              layoutId="floating-nav-active-pill"
              className="absolute inset-0 bg-primary-container rounded-full border border-secondary-fixed/40 shadow-inner -z-10"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className="material-symbols-outlined text-[19px] leading-none">
            {isMoreOpen ? 'expand_more' : 'menu'}
          </span>
          <span className="font-label-md text-[9px] font-semibold tracking-tight mt-0.5">
            More
          </span>

          {unreadAlerts > 0 && (
            <span
              aria-label={`${unreadAlerts} unread alerts`}
              className="absolute top-1.5 right-3 w-2 h-2 bg-error rounded-full ring-2 ring-primary"
            />
          )}
        </button>
      </nav>

      {/* Accessible More Navigation Sheet (Secondary Routes) with Animated Presence */}
      <AnimatePresence>
        {isMoreOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Workspace Tools Menu"
            className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs select-none"
            onClick={() => setIsMoreOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="bg-surface-container-lowest border-t border-outline-variant/80 rounded-t-3xl shadow-2xl p-4 sm:p-5 pb-8 space-y-4 max-h-[82vh] overflow-y-auto w-full max-w-lg mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sheet Header */}
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">apps</span>
                  <h3 className="font-headline-md text-sm font-bold text-on-surface">
                    Workspace Tools & Navigation
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  aria-label="Close menu"
                  className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Secondary Navigation Items */}
              <div className="space-y-1">
                {SECONDARY_MOBILE_ITEMS.map((item) => {
                  const isActive = isRouteActive(item.href, pathname);
                  const hasAlertBadge = item.badgeKey === 'alerts' && unreadAlerts > 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-primary text-on-primary font-semibold shadow-xs'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-secondary-fixed/20 text-secondary-fixed'
                              : 'bg-surface-container text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {item.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold block truncate">
                            {item.label}
                          </span>
                          {item.description && (
                            <span
                              className={`text-[10px] sm:text-[11px] block truncate ${
                                isActive ? 'text-on-primary/80' : 'text-on-surface-variant'
                              }`}
                            >
                              {item.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {hasAlertBadge && (
                        <span className="px-2 py-0.5 rounded-full bg-error text-on-error text-[10px] font-bold font-mono-data shrink-0">
                          {unreadAlerts}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Profile & Session Footer */}
              <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-secondary-fixed/20 border border-secondary-fixed/40 flex items-center justify-center text-secondary-fixed shrink-0 font-bold font-mono-data text-xs">
                    {user.full_name ? user.full_name.substring(0, 1).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-on-surface block truncate">
                      {user.full_name}
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      {user.email}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    signOutUser();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-error/30 text-error hover:bg-error-container/20 transition-colors flex items-center gap-1 font-semibold text-[11px] shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
