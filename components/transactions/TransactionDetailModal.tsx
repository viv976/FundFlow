'use client';

import React, { useEffect } from 'react';
import { Transaction } from '@/types/finance';
import { formatCurrency } from '@/lib/finance/calculator';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const isIncome = transaction.transaction_type === 'income';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-primary/60 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/60 bg-surface-container-low/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                isIncome
                  ? 'bg-secondary/15 text-secondary border border-secondary/30'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {isIncome ? 'arrow_downward' : 'arrow_upward'}
              </span>
            </div>
            <div>
              <h3 className="font-headline-md text-lg font-bold text-on-surface">
                Transaction Record Details
              </h3>
              <p className="text-xs text-on-surface-variant font-mono-data">
                ID: {transaction.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
            title="Close (Esc)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Amount Banner */}
          <div className="p-5 rounded-2xl bg-surface-bright border border-outline-variant/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block font-semibold">
                Normalized Amount
              </span>
              <span
                className={`text-2xl sm:text-3xl font-bold font-mono-data ${
                  isIncome ? 'text-secondary' : 'text-on-surface'
                }`}
              >
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
              </span>
            </div>
            <div className="text-right space-y-1">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isIncome
                    ? 'bg-secondary/15 text-secondary border border-secondary/30'
                    : 'bg-error-container/50 text-error border border-error/30'
                }`}
              >
                {transaction.transaction_type}
              </span>
              <span className="block text-[11px] text-on-surface-variant font-mono-data">
                {transaction.status}
              </span>
            </div>
          </div>

          {/* Core Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Date</span>
              <span className="text-sm font-semibold text-on-surface font-mono-data mt-0.5 block">
                {transaction.transaction_date}
              </span>
            </div>

            <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Category</span>
              <span className="text-sm font-semibold text-on-surface mt-0.5 block">
                {transaction.category}
              </span>
            </div>

            <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40 sm:col-span-2">
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Description</span>
              <span className="text-sm font-semibold text-on-surface mt-0.5 block">
                {transaction.description}
              </span>
            </div>

            {transaction.merchant && (
              <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
                <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Merchant / Vendor</span>
                <span className="text-sm font-semibold text-on-surface mt-0.5 block">
                  {transaction.merchant}
                </span>
              </div>
            )}

            {transaction.subcategory && (
              <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
                <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Subcategory</span>
                <span className="text-sm font-semibold text-on-surface mt-0.5 block">
                  {transaction.subcategory}
                </span>
              </div>
            )}

            <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Source</span>
              <span className="text-sm font-semibold text-on-surface font-mono-data mt-0.5 block">
                {transaction.source}
              </span>
            </div>

            <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40">
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Currency</span>
              <span className="text-sm font-semibold text-on-surface font-mono-data mt-0.5 block">
                {transaction.currency}
              </span>
            </div>

            {transaction.external_reference && (
              <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40 sm:col-span-2">
                <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">External Reference / Account</span>
                <span className="text-xs font-mono-data text-on-surface mt-0.5 block">
                  {transaction.external_reference}
                </span>
              </div>
            )}

            <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40 sm:col-span-2">
              <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Workspace Ownership</span>
              <span className="text-xs font-mono-data text-outline mt-0.5 block">
                {transaction.workspace_id}
              </span>
            </div>

            {transaction.created_at && (
              <div className="p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/40 sm:col-span-2">
                <span className="text-[10px] font-mono-data uppercase text-on-surface-variant block">Recorded Timestamp</span>
                <span className="text-xs font-mono-data text-on-surface-variant mt-0.5 block">
                  {transaction.created_at}
                </span>
              </div>
            )}
          </div>

          {/* Authentic Metadata Display (Only if present and non-empty) */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Transaction Metadata
              </span>
              <pre className="p-3 bg-surface-bright rounded-xl border border-outline-variant/60 font-mono-data text-[11px] text-on-surface overflow-x-auto">
                {JSON.stringify(transaction.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-surface-container-low/40 border-t border-outline-variant/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-surface-bright border border-outline-variant text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
