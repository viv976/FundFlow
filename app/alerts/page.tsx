'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { AlertSeverity, RiskSignalType } from '@/types/finance';
import Link from 'next/link';

export default function AlertsPage() {
  const { riskAlerts, alerts, markAllAlertsRead } = useFinance();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterRule, setFilterRule] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged'>('all');


  const filteredRiskAlerts = riskAlerts.filter((a) => {
    const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchesRule = filterRule === 'all' || a.ruleId === filterRule;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSeverity && matchesRule && matchesStatus;
  });

  const criticalCount = riskAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = riskAlerts.filter((a) => a.severity === 'warning').length;
  const infoCount = riskAlerts.filter((a) => a.severity === 'info').length;

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-error-container/20 border-error/40',
          text: 'text-error',
          badge: 'bg-error text-on-error',
          icon: 'error',
        };
      case 'warning':
        return {
          bg: 'bg-tertiary-container/15 border-tertiary-fixed-dim/40',
          text: 'text-tertiary-fixed-dim',
          badge: 'bg-tertiary text-on-tertiary',
          icon: 'warning',
        };
      default:
        return {
          bg: 'bg-surface-container-low border-outline-variant',
          text: 'text-primary',
          badge: 'bg-primary text-on-primary',
          icon: 'info',
        };
    }
  };

  const formatSignalLabel = (signal: RiskSignalType) => {
    switch (signal) {
      case 'RUNWAY_BELOW_THRESHOLD':
        return 'Runway Floor';
      case 'RAPIDLY_INCREASING_BURN':
        return 'Burn Surge';
      case 'DECREASING_CASH_TRAJECTORY':
        return 'Cash Drawdown';
      case 'REVENUE_DECLINE':
        return 'Revenue Decline';
      case 'EXPENSE_CONCENTRATION':
        return 'Concentration';
      case 'UNUSUAL_EXPENSE_SPIKE':
        return 'Expense Spike';
      case 'ABNORMAL_TRANSACTION':
        return 'Abnormal Transaction';
      default:
        return signal;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-error bg-error/10 border border-error/20 px-2.5 py-0.5 rounded font-bold">
              {riskAlerts.length} Deterministic Signals
            </span>
            <span className="text-xs text-on-surface-variant font-medium">• 100% Rule-Based Auditing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Risk Intelligence & Guardrails
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Deterministic detection of burn acceleration, runway compression, cash drawdowns, and transactional anomalies.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <Link
            href="/scenarios"
            className="px-4 py-2.5 bg-secondary text-on-secondary rounded-xl text-xs font-semibold hover:bg-secondary-fixed-dim transition-all shadow-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">query_stats</span>
            <span>Scenario Planner</span>
          </Link>

          <Link
            href="/settings"
            className="px-4 py-2.5 border border-outline-variant rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Configure Guardrails</span>
          </Link>

          {alerts.length > 0 && (
            <button
              onClick={markAllAlertsRead}
              className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span>
              <span>Acknowledge All</span>
            </button>
          )}
        </div>
      </div>

      {/* Honest Architecture Disclosure: DETERMINISTIC DETECTION vs AI EXPLANATION */}
      <div className="p-4 bg-surface-container-lowest border border-outline-variant/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
          </div>
          <div>
            <div className="font-semibold text-on-surface flex items-center gap-2">
              <span>Detection Architecture:</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-mono-data text-[10px] font-bold border border-outline-variant">
                DETERMINISTIC DETECTION
              </span>
              <span className="text-on-surface-variant font-normal">vs</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-mono-data text-[10px] font-bold border border-secondary/20">
                AI EXPLANATION
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              All financial risk alerts are generated strictly via mathematical rules evaluated on verified ledger transactions. FundFlow never fabricates probabilistic AI anomaly scores. AI may subsequently be invoked to explain deterministic findings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono-data text-[11px]">
          <span className="px-2 py-0.5 rounded bg-error/10 text-error font-bold border border-error/20">
            {criticalCount} Critical
          </span>
          <span className="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary-fixed-dim font-bold border border-tertiary-fixed-dim/30">
            {warningCount} Warning
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold border border-outline-variant">
            {infoCount} Info
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5">
            {(['all', 'active', 'acknowledged'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-label-md capitalize transition-colors ${
                  filterStatus === st
                    ? 'bg-secondary text-on-secondary font-semibold shadow-2xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-outline-variant/60 hidden sm:block"></div>

          {/* Severity Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-label-md capitalize transition-colors ${
                  filterSeverity === sev
                    ? 'bg-primary text-on-primary font-semibold shadow-2xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>


        {/* Signal Rule Filter */}
        <div className="flex items-center gap-2 text-xs font-label-md text-on-surface-variant">
          <span>Signal:</span>
          <select
            value={filterRule}
            onChange={(e) => setFilterRule(e.target.value)}
            className="px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-primary"
          >
            <option value="all">All Signals (7)</option>
            <option value="RUNWAY_BELOW_THRESHOLD">Runway Floor</option>
            <option value="RAPIDLY_INCREASING_BURN">Rapidly Increasing Burn</option>
            <option value="DECREASING_CASH_TRAJECTORY">Decreasing Cash Trajectory</option>
            <option value="REVENUE_DECLINE">Revenue Decline</option>
            <option value="EXPENSE_CONCENTRATION">Expense Concentration</option>
            <option value="UNUSUAL_EXPENSE_SPIKE">Unusual Expense Spike</option>
            <option value="ABNORMAL_TRANSACTION">Abnormal Single Transaction</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {filteredRiskAlerts.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl text-secondary mb-3 block">
              verified_user
            </span>
            <h3 className="font-headline-md text-on-surface mb-1 font-semibold">
              All Guardrails Nominal
            </h3>
            <p className="text-body-sm text-on-surface-variant text-xs max-w-md mx-auto">
              Your financial metrics currently pass all 7 deterministic risk rules. Runway, burn rates, category concentrations, and transaction sizes are within safety parameters.
            </p>
          </div>
        ) : (
          filteredRiskAlerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);

            return (
              <div
                key={alert.id}
                className={`border rounded-2xl p-6 transition-all shadow-xs ${style.bg} hover:shadow-md space-y-4`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex items-center justify-center shrink-0">
                      <span className={`material-symbols-outlined ${style.text} text-[22px]`}>
                        {style.icon}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-label-md uppercase tracking-wider font-bold ${style.badge}`}
                        >
                          {alert.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-mono-data font-semibold border border-outline-variant">
                          {formatSignalLabel(alert.ruleId)}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono-data font-bold border border-primary/20">
                          {alert.detectionMechanism}
                        </span>
                        <span className="text-[11px] font-mono-data text-on-surface-variant">
                          • Period: {alert.affectedPeriod}
                        </span>
                      </div>

                      <h3 className="font-headline-md text-base font-bold text-on-surface">
                        {alert.title}
                      </h3>
                      <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                        {alert.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Top quick link */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    <Link
                      href={`/ask-ai?q=${encodeURIComponent(
                        `Explain this deterministic alert: ${alert.title}. ${alert.explanation}`
                      )}`}
                      className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl hover:bg-surface-container font-label-md text-xs transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">smart_toy</span>
                      <span>AI Explanation</span>
                    </Link>
                  </div>
                </div>

                {/* Supporting Data Card */}
                {alert.supportingData && (
                  <div className="p-3.5 bg-surface-container-lowest/80 rounded-xl border border-outline-variant/60 text-xs space-y-2">
                    <div className="flex items-center justify-between text-on-surface-variant">
                      <span className="font-mono-data uppercase text-[10px] font-bold text-on-surface">
                        Supporting Ledger Evidence
                      </span>
                      <span className="font-mono-data text-[11px] font-semibold text-primary">
                        {alert.supportingData.primaryMetric}
                      </span>
                    </div>

                    {alert.supportingData.evidenceItems && alert.supportingData.evidenceItems.length > 0 && (
                      <ul className="space-y-1 text-[11px] font-mono-data text-on-surface-variant pt-1 border-t border-outline-variant/30">
                        {alert.supportingData.evidenceItems.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Suggested Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-outline-variant/40">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-secondary text-[16px]">lightbulb</span>
                    <span className="text-on-surface font-medium">
                      Suggested Action: <span className="text-on-surface-variant font-normal">{alert.suggestedAction}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/scenarios"
                      className="px-3 py-1.5 bg-primary text-on-primary rounded-xl font-label-md text-xs hover:bg-primary-container transition-all shadow-xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">query_stats</span>
                      <span>Model in Scenarios</span>
                    </Link>

                    {alert.actionType === 'view_transactions' && (
                      <Link
                        href="/transactions"
                        className="px-3 py-1.5 border border-outline-variant text-on-surface bg-surface-container-lowest rounded-xl font-label-md text-xs hover:bg-surface-container transition-all shadow-2xs flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                        <span>Audit Ledger</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
