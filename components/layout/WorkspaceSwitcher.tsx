'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFinance } from '@/lib/store/finance-context';

export const WorkspaceSwitcher: React.FC = () => {
  const router = useRouter();
  const { workspace, workspaces, switchWorkspace } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-primary-container/40 hover:bg-primary-container/70 border border-outline-variant/30 text-on-primary transition-all text-left group"
        title="Switch Business Workspace"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-secondary-fixed/20 border border-secondary-fixed/40 flex items-center justify-center text-secondary-fixed shrink-0 font-bold font-mono-data text-xs">
            {workspace.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="font-headline-md text-xs font-bold text-on-primary truncate block">
              {workspace.name}
            </span>
            <span className="text-[10px] font-mono-data text-secondary-fixed uppercase tracking-wider block">
              {workspace.currency} • Active Business
            </span>
          </div>
        </div>

        <span className={`material-symbols-outlined text-[18px] text-on-primary-container/80 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          unfold_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-150 text-on-surface">
          <div className="px-3.5 py-1.5 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider font-bold">
            Your Businesses ({workspaces.length})
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 px-1.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === workspace.id;
              return (
                <button
                  key={ws.id}
                  onClick={async () => {
                    await switchWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded bg-surface-container flex items-center justify-center font-bold text-[10px] font-mono-data">
                      {ws.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="block truncate font-medium">{ws.name}</span>
                      <span className="text-[10px] text-on-surface-variant font-mono-data">
                        {ws.currency}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-[16px]">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 mt-1 border-t border-outline-variant/50 px-1.5">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/onboarding');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Create New Business</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
