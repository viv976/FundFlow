'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { AIMessage } from '@/types/finance';
import { formatCurrency, calculateWhatIfScenario } from '@/lib/finance/calculator';
import Link from 'next/link';

const QUICK_PROMPTS = [
  'How much did I spend last month?',
  'What was my revenue?',
  'What category had the highest expenses?',
  'What is EBITDA?',
  'Why did my expenses increase?',
  'What should I do to reduce expenses?',
  'What if I hire 2 engineers at $80k?',
];

function createMessageId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function AskAIPage() {
  const { workspace, transactions, kpis } = useFinance();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello! I am your **FundFlow Financial Co-Pilot** for **${workspace.name}**.\n\nI provide **100% grounded financial analysis**, verified accounting explanations, and deterministic scenario modeling based on your ${transactions.length} ledger records.\n\nAsk me about your spend, revenue, burn drivers, or simulate what-if scenarios (e.g. hiring plans, budget cuts).`,
      timestamp: 'Just now',
      citations: [
        {
          id: 'cite-cash',
          type: 'financial_snapshot',
          label: `Cash: ${formatCurrency(kpis.cashOnHand, workspace.currency)}`,
          amount: kpis.cashOnHand,
        },
        {
          id: 'cite-burn',
          type: 'financial_snapshot',
          label: `Monthly Burn: ${formatCurrency(kpis.monthlyBurn, workspace.currency)}`,
          amount: kpis.monthlyBurn,
        },
        {
          id: 'cite-runway',
          type: 'financial_snapshot',
          label: `Runway: ${kpis.runwayDisplay}`,
        },
      ],
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Interactive Scenario Simulator state
  const [scenarioHires, setScenarioHires] = useState(2);
  const [scenarioSalary, setScenarioSalary] = useState(80000);
  const [scenarioSpendChange, setScenarioSpendChange] = useState(0);

  const scenarioResult = calculateWhatIfScenario(
    kpis.cashOnHand,
    kpis.monthlyBurn,
    Math.round((scenarioHires * scenarioSalary) / 12),
    scenarioSpendChange,
    `Hiring ${scenarioHires} person(s)`
  );

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || isLoading) return;

      const userMsg: AIMessage = {
        id: createMessageId('user'),
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputMessage('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            workspaceId: workspace.id,
            transactions,
          }),
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data: AIMessage = await res.json();
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown chat error';
        console.error('Chat error:', err);
        const errorMsg: AIMessage = {
          id: createMessageId('err'),
          role: 'assistant',
          content: `I encountered an issue processing your query. Please try again. (${msg})`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputMessage, isLoading, transactions, workspace.id]
  );

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-md text-on-surface-variant uppercase tracking-wider mb-1 font-semibold">
            <span>Deterministic RAG</span>
            <span>•</span>
            <span className="text-secondary font-bold">Grounded Financial AI</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
            Financial Co-Pilot
          </h1>
        </div>

        {/* Live Context Badge */}
        <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-semibold text-on-surface">Ledger Grounded:</span>
          </div>
          <span className="font-mono-data text-primary font-bold">
            {formatCurrency(kpis.cashOnHand)} Cash
          </span>
          <span className="text-outline">•</span>
          <span className="font-mono-data text-primary font-bold">
            {kpis.runwayDisplay} Runway
          </span>
        </div>
      </div>

      {/* Main Grid: Chat Stream & Scenario Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left 2 Columns: Chat Stream */}
        <div className="lg:col-span-2 flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 chat-scroll">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl p-4 text-sm ${
                      isUser
                        ? 'bg-primary text-on-primary shadow-sm rounded-tr-none'
                        : 'bg-surface-container-low border border-outline-variant/60 text-on-surface rounded-tl-none space-y-3'
                    }`}
                  >
                    {/* Timestamp */}
                    <div
                      className={`text-[10px] font-mono-data mb-1 ${
                        isUser ? 'text-primary-fixed-dim text-right' : 'text-on-surface-variant'
                      }`}
                    >
                      {msg.timestamp}
                    </div>

                    {/* Markdown / Text Content */}
                    <div className="font-body-sm leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Scenario Impact Card (if scenario returned) */}
                    {msg.scenario && (
                      <div className="p-3 bg-surface-container-lowest border border-outline-variant rounded-lg space-y-2 text-xs">
                        <div className="flex justify-between items-center font-semibold text-primary">
                          <span>Scenario Simulation</span>
                          <span className="font-mono-data text-error">
                            +${(msg.scenario.monthlyImpact / 1000).toFixed(1)}k/mo burn
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono-data pt-1 border-t border-outline-variant/40">
                          <div>
                            <span className="text-[10px] text-on-surface-variant block">
                              Current Runway:
                            </span>
                            <span className="font-bold text-on-surface">
                              {msg.scenario.beforeRunway.toFixed(1)} months
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-on-surface-variant block">
                              Projected Runway:
                            </span>
                            <span className="font-bold text-error">
                              {msg.scenario.afterRunway.toFixed(1)} months
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Grounded Citations Chips */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-outline-variant/40">
                        <span className="text-[10px] font-label-md uppercase tracking-wider text-on-surface-variant block mb-1.5 font-semibold">
                          Verified Ledger Citations:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((cite) => (
                            <span
                              key={cite.id}
                              className="px-2 py-1 bg-surface-container-highest border border-outline-variant/60 rounded text-[11px] font-mono-data text-primary flex items-center gap-1 shadow-2xs"
                              title={cite.details || cite.label}
                            >
                              <span className="material-symbols-outlined text-[13px] text-secondary">
                                verified
                              </span>
                              {cite.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chart Link Action */}
                    {msg.chartAction && (
                      <div className="pt-1">
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1 text-xs text-primary font-label-md font-semibold hover:underline"
                        >
                          <span className="material-symbols-outlined text-[14px]">show_chart</span>
                          {msg.chartAction.label} &rarr;
                        </Link>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 justify-start items-center text-xs text-on-surface-variant font-mono-data">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    sync
                  </span>
                </div>
                <span>Grounding query with verified ledger data...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2.5 bg-surface-bright border-t border-outline-variant/50 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider shrink-0 font-semibold">
              Suggestions:
            </span>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 rounded-full text-xs text-on-surface whitespace-nowrap transition-colors shadow-2xs font-body-sm"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-4 bg-surface-container-lowest border-t border-outline-variant flex items-center gap-3"
          >
            <input
              type="text"
              placeholder="Ask financial co-pilot (e.g. What if I hire 2 engineers at $80k?)..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-surface-bright border border-outline-variant rounded-lg font-body-sm text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40 flex items-center gap-1.5"
            >
              <span>Ask</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          </form>
        </div>

        {/* Right 1 Column: Interactive What-If Scenario Sandbox */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  calculate
                </span>
                <h2 className="font-headline-md text-headline-md text-primary font-semibold">
                  What-If Sandbox
                </h2>
              </div>
              <p className="text-body-sm text-on-surface-variant text-xs">
                Real-time mathematical runway simulation
              </p>
            </div>

            {/* Slider 1: Headcount */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-label-md">
                <span className="text-on-surface-variant font-semibold">Additional Hires</span>
                <span className="font-mono-data text-primary font-bold">{scenarioHires} person(s)</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={scenarioHires}
                onChange={(e) => setScenarioHires(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Slider 2: Salary */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-label-md">
                <span className="text-on-surface-variant font-semibold">Avg Annual Salary</span>
                <span className="font-mono-data text-primary font-bold">
                  ${(scenarioSalary / 1000).toFixed(0)}k/yr
                </span>
              </div>
              <input
                type="range"
                min="40000"
                max="250000"
                step="5000"
                value={scenarioSalary}
                onChange={(e) => setScenarioSalary(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Slider 3: Discretionary Spend */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-label-md">
                <span className="text-on-surface-variant font-semibold">Monthly Spend Delta</span>
                <span className="font-mono-data text-primary font-bold">
                  {scenarioSpendChange >= 0 ? '+' : '-'}${Math.abs(scenarioSpendChange).toLocaleString()}/mo
                </span>
              </div>
              <input
                type="range"
                min="-20000"
                max="50000"
                step="1000"
                value={scenarioSpendChange}
                onChange={(e) => setScenarioSpendChange(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Simulation Results Card */}
            <div className="p-4 bg-surface-container-low border border-outline-variant rounded-lg space-y-3">
              <span className="font-label-md text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold block">
                Calculated Projection:
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-surface-container-lowest rounded border border-outline-variant/60">
                  <span className="text-[10px] text-on-surface-variant block font-label-md">
                    Baseline Runway
                  </span>
                  <span className="font-mono-data text-sm font-bold text-on-surface">
                    {scenarioResult.currentRunway.toFixed(1)} mos
                  </span>
                </div>

                <div className="p-2.5 bg-surface-container-lowest rounded border border-outline-variant/60">
                  <span className="text-[10px] text-on-surface-variant block font-label-md">
                    New Runway
                  </span>
                  <span className="font-mono-data text-sm font-bold text-error">
                    {scenarioResult.projectedRunway.toFixed(1)} mos
                  </span>
                </div>
              </div>

              <div className="text-xs font-body-sm text-on-surface-variant pt-1 border-t border-outline-variant/40 space-y-1">
                <div className="flex justify-between">
                  <span>Runway Impact:</span>
                  <span className="font-mono-data font-semibold text-error">
                    {scenarioResult.differenceMonths > 0 ? `-${scenarioResult.differenceMonths.toFixed(1)}` : '0'} mos
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>New Total Burn:</span>
                  <span className="font-mono-data font-semibold text-on-surface">
                    {formatCurrency(scenarioResult.newMonthlyBurn)}/mo
                  </span>
                </div>
              </div>
            </div>

            {/* Ask AI this scenario button */}
            <button
              onClick={() =>
                handleSendMessage(
                  `What if I hire ${scenarioHires} engineer(s) at $${scenarioSalary.toLocaleString()}/yr?`
                )
              }
              className="w-full py-2.5 border border-primary text-primary hover:bg-primary hover:text-on-primary rounded-lg font-label-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              Ask AI About This Scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
