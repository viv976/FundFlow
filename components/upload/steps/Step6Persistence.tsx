'use client';

import React from 'react';

interface Step6PersistenceProps {
  totalToPersist: number;
}

export const Step6Persistence: React.FC<Step6PersistenceProps> = ({ totalToPersist }) => {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-12 border border-outline-variant/60 shadow-sm text-center space-y-6 animate-fadeIn">
      <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
        <span className="material-symbols-outlined text-3xl animate-spin">
          progress_activity
        </span>
      </div>

      <div className="space-y-2 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-on-surface font-headline-md">
          Persisting Verified Ledger Entries...
        </h2>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Executing server-side independent validation, idempotency fingerprint checks, and writing {totalToPersist} validated transactions to your multi-tenant workspace.
        </p>
      </div>

      <div className="max-w-xs mx-auto pt-2">
        <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-primary animate-pulse w-3/4 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
