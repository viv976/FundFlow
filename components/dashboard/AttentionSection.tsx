'use client';

import React from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { AttentionItem } from '@/types/finance';

function getSeverityBadge(severity: AttentionItem['severity']) {
  switch (severity) {
    case 'critical':
      return {
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: 'error',
        cardBorder: 'border-rose-500/40 bg-rose-500/[0.02]',
        iconColor: 'text-rose-400',
      };
    case 'warning':
      return {
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: 'warning',
        cardBorder: 'border-amber-500/40 bg-amber-500/[0.02]',
        iconColor: 'text-amber-400',
      };
    case 'info':
    default:
      return {
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        icon: 'info',
        cardBorder: 'border-blue-500/40 bg-blue-500/[0.02]',
        iconColor: 'text-blue-400',
      };
  }
}

export function AttentionSection() {
  const { attentionItems } = useFinance();

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-sm">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <span className="material-symbols-outlined text-lg">notification_important</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">
                Things Requiring Attention
              </h2>
              {attentionItems.length > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-mono-data font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {attentionItems.length} active
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">
              Deterministic risk detection evaluated against verified ledger data and configurable thresholds
            </p>
          </div>
        </div>
      </div>

      {/* Attention Items Grid or Clean Reassuring Empty State */}
      {attentionItems.length === 0 ? (
        <div className="py-6 px-4 rounded-xl bg-surface-container/20 border border-outline-variant/30 flex items-center justify-center gap-3 text-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">verified_user</span>
          </div>
          <div className="text-left">
            <span className="text-xs font-semibold text-on-surface block">
              No Immediate Attention Items
            </span>
            <span className="text-[11px] text-on-surface-variant">
              All runway safety thresholds, category spend baselines, and concentration limits are operating within nominal boundaries.
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attentionItems.map((item) => {
            const style = getSeverityBadge(item.severity);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border ${style.cardBorder} flex flex-col justify-between transition-all hover:shadow-xs`}
              >
                <div>
                  {/* Item Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[10px] font-mono-data uppercase font-bold rounded border flex items-center gap-1 ${style.badge}`}>
                      <span className="material-symbols-outlined text-[13px]">{style.icon}</span>
                      <span>{item.severity}</span>
                    </span>
                    {item.affectedCategory && (
                      <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                        {item.affectedCategory}
                      </span>
                    )}
                  </div>

                  {/* Title & Metric */}
                  <h3 className="text-sm font-bold text-on-surface tracking-tight mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs font-mono-data text-primary font-semibold mb-2">
                    {item.supportingMetric}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                    {item.detectedIssue}
                  </p>
                </div>

                {/* Suggested Action */}
                <div className="pt-3 border-t border-outline-variant/30 text-[11px] bg-surface-container/30 -mx-4 -mb-4 p-3 rounded-b-xl">
                  <div className="font-semibold text-on-surface flex items-center gap-1 mb-0.5">
                    <span className="material-symbols-outlined text-[13px] text-primary">lightbulb</span>
                    <span>Suggested Action</span>
                  </div>
                  <span className="text-on-surface-variant">{item.suggestedAction}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
