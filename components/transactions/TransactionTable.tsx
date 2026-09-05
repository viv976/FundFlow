'use client';

import React, { useState, useMemo } from 'react';
import { Transaction } from '@/types/finance';
import { useFinance } from '@/lib/store/finance-context';
import { TransactionModal } from './TransactionModal';

export const TransactionTable: React.FC = () => {
  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    exportTransactionsCSV,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('All Time');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category));
    return ['All', ...Array.from(set)];
  }, [transactions]);

  // Filtering & Sorting
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Search filter
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          tx.description.toLowerCase().includes(q) ||
          (tx.merchant && tx.merchant.toLowerCase().includes(q)) ||
          (tx.external_reference && tx.external_reference.toLowerCase().includes(q)) ||
          tx.amount.toString().includes(q);

        // Category filter
        const matchesCategory =
          selectedCategory === 'All' || tx.category === selectedCategory;

        // Date range filter
        if (selectedDateFilter === 'Last 30 Days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return (
            matchesQuery &&
            matchesCategory &&
            new Date(tx.transaction_date) >= thirtyDaysAgo
          );
        }

        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'date') {
          comparison =
            new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
        } else if (sortField === 'amount') {
          comparison = a.amount - b.amount;
        } else if (sortField === 'description') {
          comparison = a.description.localeCompare(b.description);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [transactions, searchQuery, selectedCategory, selectedDateFilter, sortField, sortOrder]);

  const handleSort = (field: 'date' | 'amount' | 'description') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(id);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
      {/* Filter Bar */}
      <div className="p-4 border-b border-outline-variant bg-surface-bright flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative w-full max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search description, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date Picker Filter */}
          <div className="relative">
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded bg-surface-container-lowest text-on-surface font-body-sm text-sm focus:outline-none focus:border-primary"
            >
              <option value="All Time">All Time</option>
              <option value="Last 30 Days">Last 30 Days</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded bg-surface-container-lowest text-on-surface font-body-sm text-sm focus:outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggles & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-outline-variant rounded overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-surface-container text-on-surface'
                  : 'bg-surface-container-lowest text-outline hover:bg-surface-container-low'
              }`}
              title="List View"
            >
              <span className="material-symbols-outlined text-[20px]">view_list</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 transition-colors border-l border-outline-variant ${
                viewMode === 'grid'
                  ? 'bg-surface-container text-on-surface'
                  : 'bg-surface-container-lowest text-outline hover:bg-surface-container-low'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
          </div>

          <button
            onClick={exportTransactionsCSV}
            className="px-4 py-2 border border-outline text-on-surface rounded font-label-md text-xs hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Export CSV
          </button>

          <button
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-primary text-on-primary rounded font-label-md text-xs hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Transaction
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      {viewMode === 'list' ? (
        <div className="flex-1 overflow-auto table-scroll relative">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-surface-container-low border-b border-outline-variant z-10">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3 font-label-md text-xs text-on-surface-variant group cursor-pointer hover:text-on-surface select-none"
                >
                  <div className="flex items-center gap-1">
                    Date
                    <span className="material-symbols-outlined text-[14px]">
                      {sortField === 'date'
                        ? sortOrder === 'asc'
                          ? 'arrow_upward'
                          : 'arrow_downward'
                        : 'swap_vert'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('description')}
                  className="px-4 py-3 font-label-md text-xs text-on-surface-variant group cursor-pointer hover:text-on-surface w-1/3 select-none"
                >
                  <div className="flex items-center gap-1">
                    Description
                    <span className="material-symbols-outlined text-[14px]">
                      {sortField === 'description'
                        ? sortOrder === 'asc'
                          ? 'arrow_upward'
                          : 'arrow_downward'
                        : 'swap_vert'}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 font-label-md text-xs text-on-surface-variant">
                  Category
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3 font-label-md text-xs text-on-surface-variant group cursor-pointer hover:text-on-surface text-right select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    <span className="material-symbols-outlined text-[14px]">
                      {sortField === 'amount'
                        ? sortOrder === 'asc'
                          ? 'arrow_upward'
                          : 'arrow_downward'
                        : 'swap_vert'}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 font-label-md text-xs text-on-surface-variant text-center">
                  Status
                </th>
                <th className="px-4 py-3 w-[48px]"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/50 bg-surface-container-lowest font-body-sm text-sm">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-outline mb-2 block">
                      receipt
                    </span>
                    No transactions match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isIncome = tx.transaction_type === 'income';

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-surface-container-low/50 transition-colors group"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant font-mono-data text-xs">
                        {tx.transaction_date}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-on-surface">{tx.description}</div>
                        {tx.external_reference && (
                          <div className="text-[12px] text-outline mt-0.5 font-mono-data">
                            {tx.external_reference}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-surface-container-high text-on-surface-variant font-label-md text-[11px] uppercase tracking-wider font-semibold">
                          {tx.category}
                        </span>
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-mono-data text-sm whitespace-nowrap font-medium ${
                          isIncome ? 'text-secondary font-semibold' : 'text-on-surface'
                        }`}
                      >
                        {isIncome ? '+' : '-'}${Number(tx.amount).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            tx.status === 'completed'
                              ? 'bg-secondary-container/20 text-on-secondary-container'
                              : 'bg-surface-container text-outline'
                          }`}
                          title={tx.status}
                        >
                          <span className="material-symbols-outlined text-[16px] icon-fill">
                            {tx.status === 'completed' ? 'check_circle' : 'schedule'}
                          </span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center relative">
                        <button
                          onClick={() =>
                            setActiveMenuId(activeMenuId === tx.id ? null : tx.id)
                          }
                          className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            more_vert
                          </span>
                        </button>

                        {activeMenuId === tx.id && (
                          <div className="absolute right-6 top-8 w-32 bg-surface border border-outline-variant rounded-lg shadow-xl py-1 z-30 font-body-sm text-xs">
                            <button
                              onClick={() => handleEdit(tx)}
                              className="w-full text-left px-3 py-1.5 hover:bg-surface-container-low text-on-surface flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-error-container/30 text-error flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-surface-container-low border border-outline-variant rounded-lg p-4 space-y-2 relative"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-mono-data text-outline">
                  {tx.transaction_date}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-md text-[10px] uppercase">
                  {tx.category}
                </span>
              </div>
              <div className="font-semibold text-on-surface">{tx.description}</div>
              <div
                className={`font-mono-data text-lg font-bold ${
                  tx.transaction_type === 'income' ? 'text-secondary' : 'text-on-surface'
                }`}
              >
                {tx.transaction_type === 'income' ? '+' : '-'}${Number(tx.amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Add / Edit Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={async (txData) => {
          if (editingTransaction) {
            await updateTransaction(editingTransaction.id, txData);
          } else {
            await addTransaction(txData);
          }
        }}
        initialData={editingTransaction}
      />
    </div>
  );
};
