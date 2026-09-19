'use client';

import React from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { MetricExplanation } from '@/types/finance';

interface MetricExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricKey: 'cash' | 'burn' | 'runway' | 'growth';
}

export function MetricExplainModal({
  isOpen,
  onClose,
  metricKey,
}: MetricExplainModalProps) {
  const { getMetricDetails } = useFinance();

  if (!isOpen) return null;

  const details: MetricExplanation = getMetricDetails(metricKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">calculate</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-data uppercase tracking-wider text-primary font-bold">
                Metric Arithmetic Breakdown
              </span>
              {details.burnMethodology && (
                <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                  {details.burnMethodology}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-on-surface tracking-tight">
              {details.title}
            </h3>
          </div>
        </div>

        {/* Current Value Pill */}
        <div className="bg-surface-container/40 border border-outline-variant/40 rounded-xl p-3.5 mb-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-on-surface-variant font-medium">Active Value</span>
            <div className="text-2xl font-bold font-mono-data text-on-surface mt-0.5">
              {details.currentDisplay}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-on-surface-variant font-medium">Calculation Window</span>
            <div className="text-xs font-mono-data text-on-surface font-semibold mt-0.5">
              {details.comparisonPeriod}
            </div>
          </div>
        </div>

        {/* Formula Display */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-on-surface mb-1">Mathematical Formula</div>
          <div className="p-3 bg-surface-container-low rounded-lg font-mono-data text-xs text-primary font-semibold border border-outline-variant/30">
            {details.formula}
          </div>
        </div>

        {/* Step-by-Step Arithmetic */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-on-surface mb-2">Step-by-Step Ledger Rollup</div>
          <div className="space-y-2 border border-outline-variant/40 rounded-xl p-3 bg-surface-container-low/30">
            {details.formulaSteps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${
                  step.operation === '='
                    ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                    : 'text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  {step.operation && step.operation !== '=' && (
                    <span className="w-5 h-5 rounded bg-surface-container-high text-on-surface-variant font-mono-data flex items-center justify-center text-[11px] font-bold">
                      {step.operation}
                    </span>
                  )}
                  {step.operation === '=' && (
                    <span className="w-5 h-5 rounded bg-primary text-on-primary font-mono-data flex items-center justify-center text-[11px] font-bold">
                      =
                    </span>
                  )}
                  <span>{step.label}</span>
                </div>
                <span className="font-mono-data font-semibold">{step.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transparent Methodology Notes */}
        <div className="bg-surface-container/20 rounded-xl p-3.5 border border-outline-variant/30 text-xs text-on-surface-variant space-y-1.5">
          <div className="font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">verified</span>
            <span>Deterministic Guarantee</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {details.methodology}
          </p>
        </div>

        {/* Footer Close */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
