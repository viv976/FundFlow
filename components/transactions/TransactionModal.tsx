'use client';

import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus } from '@/types/finance';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'workspace_id'>) => Promise<void>;
  initialData?: Transaction | null;
}

const CATEGORIES = [
  'Payroll',
  'Cloud Infrastructure',
  'SaaS & Software',
  'Marketing',
  'Rent & Office',
  'Contractors',
  'Legal & Professional',
  'Travel',
  'Taxes',
  'Bank Fees',
  'Customer Revenue',
  'Other',
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [prevInitialData, setPrevInitialData] = useState<Transaction | null | undefined>(undefined);
  const [description, setDescription] = useState(initialData?.description || '');
  const [merchant, setMerchant] = useState(initialData?.merchant || '');
  const [amount, setAmount] = useState(initialData?.amount ? initialData.amount.toString() : '');
  const [category, setCategory] = useState(initialData?.category || 'Cloud Infrastructure');
  const [type, setType] = useState<TransactionType>(initialData?.transaction_type || 'expense');
  const [status, setStatus] = useState<TransactionStatus>(initialData?.status || 'completed');
  const [date, setDate] = useState(initialData?.transaction_date || new Date().toISOString().substring(0, 10));
  const [reference, setReference] = useState(initialData?.external_reference || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setDescription(initialData?.description || '');
    setMerchant(initialData?.merchant || '');
    setAmount(initialData?.amount ? initialData.amount.toString() : '');
    setCategory(initialData?.category || 'Cloud Infrastructure');
    setType(initialData?.transaction_type || 'expense');
    setStatus(initialData?.status || 'completed');
    setDate(initialData?.transaction_date || new Date().toISOString().substring(0, 10));
    setReference(initialData?.external_reference || '');
    setError('');
  }

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (!description.trim()) {
      setError('Please provide a description or memo for this transaction.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than $0.00.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        description: description.trim(),
        merchant: merchant.trim() || undefined,
        amount: parsedAmount,
        currency: 'USD',
        category,
        transaction_type: type,
        status,
        transaction_date: date,
        source: 'manual',
        external_reference: reference.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-primary/60 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all transform animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/60 bg-surface-container-low/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <span className="material-symbols-outlined text-[22px]">
                {initialData ? 'edit_note' : 'add_card'}
              </span>
            </div>
            <div>
              <h3 className="font-headline-md text-lg sm:text-xl font-bold text-on-surface tracking-tight">
                {initialData ? 'Edit Ledger Entry' : 'Record New Transaction'}
              </h3>
              <p className="text-xs text-on-surface-variant font-body-sm">
                Enter verified inflow or outflow details to update real-time burn calculations.
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-error-container/40 border border-error/30 text-error rounded-xl font-body-sm text-xs flex items-center gap-2.5">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Transaction Type Segmented Toggle */}
          <div>
            <label className="block text-xs font-label-md uppercase tracking-wider text-on-surface-variant font-bold mb-2">
              Transaction Flow Type
            </label>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  if (category === 'Revenue') setCategory('Infrastructure');
                }}
                className={`py-2.5 px-4 rounded-lg font-label-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  type === 'expense'
                    ? 'bg-error text-on-error shadow-md scale-[1.01]'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">trending_down</span>
                <span>Expense (Cash Outflow / Burn)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  setCategory('Revenue');
                }}
                className={`py-2.5 px-4 rounded-lg font-label-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  type === 'income'
                    ? 'bg-secondary text-on-secondary shadow-md scale-[1.01]'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">trending_up</span>
                <span>Income (Cash Inflow / Revenue)</span>
              </button>
            </div>
          </div>

          {/* Amount & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Amount */}
            <div>
              <label className="block text-xs font-label-md text-on-surface font-semibold mb-1.5">
                Amount (USD) <span className="text-error">*</span>
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant font-mono-data font-semibold">
                  $
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-8 pr-4 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-mono-data text-base font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-label-md text-on-surface font-semibold">
                  Transaction Date <span className="text-error">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDate(new Date().toISOString().substring(0, 10))}
                  className="text-[11px] text-primary hover:underline font-label-md font-semibold"
                >
                  Set to Today
                </button>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-body-sm text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-label-md text-on-surface font-semibold mb-1.5">
              Description / Memo <span className="text-error">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. AWS Production Cluster Compute & Storage"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-body-sm text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
            />
          </div>

          {/* Category & Merchant Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-label-md text-on-surface font-semibold mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-body-sm text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer pr-10"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </div>
              </div>
            </div>

            {/* Merchant */}
            <div>
              <label className="block text-xs font-label-md text-on-surface font-semibold mb-1.5">
                Merchant / Vendor / Counterparty
              </label>
              <input
                type="text"
                placeholder="e.g. Amazon Web Services Inc."
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-body-sm text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
              />
            </div>
          </div>

          {/* External Reference & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-label-md text-on-surface font-semibold mb-1.5">
                External Reference / Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-90412"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-mono-data text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
              />
            </div>

            <div>
              <label className="block text-xs font-label-md text-on-surface font-semibold mb-1.5">
                Reconciliation Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-body-sm text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer pr-10"
              >
                <option value="completed">Completed / Settled</option>
                <option value="pending">Pending Settlement</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </form>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 bg-surface-container-low/40 border-t border-outline-variant/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-outline-variant text-on-surface rounded-xl font-label-md text-xs font-semibold hover:bg-surface-container transition-colors shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-md text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>Saving to Ledger...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">
                  {initialData ? 'check' : 'add'}
                </span>
                <span>{initialData ? 'Update Record' : 'Record Transaction'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

