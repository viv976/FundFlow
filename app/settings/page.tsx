'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export default function SettingsPage() {
  const {
    workspace,
    user,
    alertPreferences,
    updateAlertPreferences,
    resetToDemoData,
    exportTransactionsCSV,
    exportReportJSON,
    transactions,
  } = useFinance();

  const [runwayMonths, setRunwayMonths] = useState(
    alertPreferences.runway_threshold_months.toString()
  );
  const [spikePercent, setSpikePercent] = useState(
    alertPreferences.expense_spike_percentage.toString()
  );
  const [minCash, setMinCash] = useState(
    alertPreferences.cash_minimum_threshold.toString()
  );
  const [emailAlerts, setEmailAlerts] = useState(
    alertPreferences.email_notifications_enabled
  );
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAlertPreferences({
      runway_threshold_months: parseFloat(runwayMonths) || 6.0,
      expense_spike_percentage: parseFloat(spikePercent) || 40.0,
      cash_minimum_threshold: parseFloat(minCash) || 50000.0,
      email_notifications_enabled: emailAlerts,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleCopyJSON = () => {
    const json = exportReportJSON();
    navigator.clipboard.writeText(json);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReset = () => {
    if (
      confirm(
        'Are you sure you want to reset the workspace to default sample startup ledger data?'
      )
    ) {
      resetToDemoData();
      alert('Workspace reset to sample seed data successfully.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 w-full">
      {/* Header */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
            {workspace.name} Configuration
          </span>
          <span className="text-xs text-on-surface-variant font-medium">• Preferences & Controls</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
          Settings & Guardrails
        </h1>
        <p className="text-xs text-on-surface-variant mt-1">
          Configure runway thresholds, currency preferences, and corporate data backup for {workspace.name}.
        </p>
      </div>

      {/* Section 1: Workspace Profile */}
      <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-sm space-y-4 w-full">
        <h2 className="text-lg font-bold text-on-surface font-headline-md">
          Workspace Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label-md text-on-surface-variant mb-1 font-semibold">
              Organization / Workspace Name
            </label>
            <input
              type="text"
              value={workspace.name}
              disabled
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded font-body-sm text-sm text-on-surface cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label className="block text-xs font-label-md text-on-surface-variant mb-1 font-semibold">
              Base Reporting Currency
            </label>
            <input
              type="text"
              value={`${workspace.currency} (United States Dollar)`}
              disabled
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded font-body-sm text-sm text-on-surface cursor-not-allowed opacity-90"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <img
            src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=face'}
            alt={user.full_name}
            className="w-10 h-10 rounded-full object-cover border border-outline-variant"
          />
          <div>
            <span className="font-semibold text-sm block text-on-surface">
              {user.full_name} ({user.email})
            </span>
            <span className="text-xs text-on-surface-variant">
              Role: <span className="font-mono-data uppercase font-semibold">{user.role}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Alert Thresholds */}
      <form
        onSubmit={handleSavePreferences}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-5"
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-headline-md text-headline-md text-primary font-semibold">
              Risk Guardrail Thresholds
            </h2>
            <p className="text-body-sm text-on-surface-variant text-xs">
              Automated trigger rules for runway degradation and burn rate spikes
            </p>
          </div>
          {isSaved && (
            <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded text-xs font-label-md font-semibold animate-pulse">
              Preferences Saved!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-label-md text-on-surface-variant mb-1 font-semibold">
              Runway Risk Threshold (Months)
            </label>
            <input
              type="number"
              step="0.5"
              value={runwayMonths}
              onChange={(e) => setRunwayMonths(e.target.value)}
              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded font-mono-data text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            <span className="text-[11px] text-outline mt-1 block">
              Triggers critical alert when runway drops below this.
            </span>
          </div>

          <div>
            <label className="block text-xs font-label-md text-on-surface-variant mb-1 font-semibold">
              Expense Spike Threshold (%)
            </label>
            <input
              type="number"
              step="5"
              value={spikePercent}
              onChange={(e) => setSpikePercent(e.target.value)}
              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded font-mono-data text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            <span className="text-[11px] text-outline mt-1 block">
              Warns if any single category surges MoM.
            </span>
          </div>

          <div>
            <label className="block text-xs font-label-md text-on-surface-variant mb-1 font-semibold">
              Min Cash Floor ($)
            </label>
            <input
              type="number"
              step="5000"
              value={minCash}
              onChange={(e) => setMinCash(e.target.value)}
              className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded font-mono-data text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            <span className="text-[11px] text-outline mt-1 block">
              Emergency threshold for liquid operating cash.
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-outline-variant/50">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="accent-primary w-4 h-4 rounded"
            />
            <span>Enable daily digest and critical risk email notifications</span>
          </label>

          <button
            type="submit"
            className="px-5 py-2 bg-primary text-on-primary rounded-lg font-label-md text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm"
          >
            Update Guardrails
          </button>
        </div>
      </form>

      {/* Section 3: Integrations & Infrastructure */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="font-headline-md text-headline-md text-primary font-semibold">
          System Integrations
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-surface-container-low border border-outline-variant/60 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[24px]">database</span>
              <div>
                <span className="font-semibold text-xs block text-on-surface">
                  Supabase PostgreSQL & Vector
                </span>
                <span className="text-[11px] text-outline">
                  {isSupabaseConfigured ? 'Connected & Synced' : 'Offline / LocalStorage Fallback Active'}
                </span>
              </div>
            </div>
            <span
              className={`w-3 h-3 rounded-full ${
                isSupabaseConfigured ? 'bg-secondary' : 'bg-tertiary-fixed-dim'
              }`}
            ></span>
          </div>

          <div className="p-4 bg-surface-container-low border border-outline-variant/60 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[24px]">smart_toy</span>
              <div>
                <span className="font-semibold text-xs block text-on-surface">
                  Gemini Flash 2.0 AI Service
                </span>
                <span className="text-[11px] text-outline">Deterministic Math + Grounded RAG</span>
              </div>
            </div>
            <span className="w-3 h-3 rounded-full bg-secondary"></span>
          </div>
        </div>
      </section>

      {/* Section 4: Data Management & Export */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="font-headline-md text-headline-md text-primary font-semibold">
          Data Management & Backups
        </h2>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={exportTransactionsCSV}
            className="px-4 py-2 border border-outline text-on-surface rounded-lg font-label-md text-xs hover:bg-surface-container-low transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Export All Transactions ({transactions.length} Rows) CSV
          </button>

          <button
            onClick={handleCopyJSON}
            className="px-4 py-2 border border-outline text-on-surface rounded-lg font-label-md text-xs hover:bg-surface-container-low transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isCopied ? 'check' : 'code'}
            </span>
            {isCopied ? 'JSON Copied to Clipboard!' : 'Export Executive Summary JSON'}
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 border border-error/50 text-error rounded-lg font-label-md text-xs hover:bg-error-container/30 transition-colors shadow-2xs flex items-center gap-1.5 ml-auto"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Reset to Sample Seed Ledger
          </button>
        </div>
      </section>
    </div>
  );
}
