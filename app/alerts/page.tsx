'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { AlertSeverity } from '@/types/finance';
import Link from 'next/link';

export default function AlertsPage() {
  const { alerts, acknowledgeAlert, markAllAlertsRead } = useFinance();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged'>('all');

  const filteredAlerts = alerts.filter((a) => {
    const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSeverity && matchesStatus;
  });

  const activeCount = alerts.filter((a) => a.status === 'active').length;

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-error-container/30 border-error/40',
          text: 'text-error',
          badge: 'bg-error text-on-error',
          icon: 'error',
        };
      case 'warning':
        return {
          bg: 'bg-tertiary-container/20 border-tertiary-fixed-dim/40',
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-error bg-error/10 border border-error/20 px-2.5 py-0.5 rounded font-bold">
              {activeCount} Active Alerts
            </span>
            <span className="text-xs text-on-surface-variant font-medium">• Automated Guardrails</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Financial Risk Alerts
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Continuous burn anomaly detection and runway threshold guardrails
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/settings"
            className="px-4 py-2.5 border border-outline-variant rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container transition-all shadow-xs flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Configure Thresholds</span>
          </Link>

          {activeCount > 0 && (
            <button
              onClick={markAllAlertsRead}
              className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span>
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Summary Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
        {/* Status Filters */}
        <div className="flex items-center gap-2">
          {(['all', 'active', 'acknowledged'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-md capitalize transition-colors ${
                filterStatus === status
                  ? 'bg-primary text-on-primary font-semibold shadow-2xs'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Severity Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs font-label-md text-on-surface-variant">
          <span>Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-primary"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
            <option value="info">Info Only</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl text-secondary mb-3 block">
              check_circle
            </span>
            <h3 className="font-headline-md text-on-surface mb-1 font-semibold">
              All Clear! No Active Alerts
            </h3>
            <p className="text-body-sm text-on-surface-variant text-xs max-w-md mx-auto">
              Your financial metrics are within healthy operating parameters based on your configured guardrails.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            const isAck = alert.status === 'acknowledged';

            return (
              <div
                key={alert.id}
                className={`border rounded-xl p-6 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  style.bg
                } ${isAck ? 'opacity-60' : 'hover:shadow-md'}`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant/60 flex items-center justify-center shrink-0">
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
                      <h3 className="font-headline-md text-base font-semibold text-on-surface">
                        {alert.title}
                      </h3>
                      {isAck && (
                        <span className="text-[11px] font-mono-data text-outline">
                          (Acknowledged)
                        </span>
                      )}
                    </div>

                    <p className="font-body-sm text-sm text-on-surface-variant">
                      {alert.message}
                    </p>

                    <div className="text-[11px] font-mono-data text-outline pt-1 flex items-center gap-4">
                      <span>Type: {alert.alert_type}</span>
                      <span>•</span>
                      <span>Triggered: {new Date(alert.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!isAck && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 border border-outline text-on-surface rounded-lg bg-surface-container-lowest hover:bg-surface-container font-label-md text-xs transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      Acknowledge
                    </button>
                  )}

                  <Link
                    href="/ask-ai"
                    className="px-3.5 py-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary-container font-label-md text-xs transition-colors shadow-sm flex items-center gap-1"
                  >
                    <span>Analyze with AI</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
