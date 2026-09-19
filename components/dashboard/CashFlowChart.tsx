'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';

export const CashFlowChart: React.FC = () => {
  const { cashFlowProjection, workspace } = useFinance();
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    month: string;
    value: number;
    upper?: number;
    lower?: number;
    type: 'actual' | 'forecast' | 'boundary';
  } | null>(null);

  const { points, status, forecastMethodology, currentCash, monthlyNetBurn } = cashFlowProjection;
  const isInsufficient = status === 'insufficient_data' || points.length <= 1;

  // Maximum scale for axis
  const maxVal = Math.max(
    100000,
    ...points.map((p) => Math.max(p.actual || 0, p.forecast || 0, p.upperBand || 0))
  );

  // SVG coordinate dimensions
  const svgWidth = 1000;
  const svgHeight = 240;
  const paddingX = 50;
  const paddingY = 30;
  const usableWidth = svgWidth - paddingX * 2;
  const usableHeight = svgHeight - paddingY * 2;

  const getCoordinates = (index: number, val: number) => {
    const totalPoints = Math.max(1, points.length - 1);
    const x = paddingX + (index / totalPoints) * usableWidth;
    const y = svgHeight - paddingY - (val / (maxVal || 1)) * usableHeight;
    return { x, y: Math.max(paddingY, Math.min(svgHeight - paddingY, y)) };
  };

  // Find boundary point index (where isCurrent is true or first forecast starts)
  const boundaryIdx = points.findIndex((p) => p.isCurrent);
  const actualPoints = boundaryIdx !== -1 ? points.slice(0, boundaryIdx + 1) : points.filter((p) => !p.isForecast);
  const forecastPoints = boundaryIdx !== -1 ? points.slice(boundaryIdx) : [];

  // Actuals path
  const actualCoords = actualPoints.map((p, i) => getCoordinates(i, (p.actual ?? p.forecast) || 0));
  const actualPath = actualCoords.length > 0 ? `M ${actualCoords.map((c) => `${c.x},${c.y}`).join(' L ')}` : '';

  // Forecast path (starts at boundaryIdx)
  const forecastCoords = forecastPoints.map((p, i) => getCoordinates(boundaryIdx + i, (p.forecast ?? p.actual) || 0));
  const forecastPath = forecastCoords.length > 0 ? `M ${forecastCoords.map((c) => `${c.x},${c.y}`).join(' L ')}` : '';

  // Uncertainty Cone Path (+/- 10% bounds)
  let uncertaintyConePath = '';
  if (forecastPoints.length > 1) {
    const upperCoords = forecastPoints.map((p, i) =>
      getCoordinates(boundaryIdx + i, p.upperBand ?? (p.forecast || 0))
    );
    const lowerCoords = forecastPoints.map((p, i) =>
      getCoordinates(boundaryIdx + i, p.lowerBand ?? (p.forecast || 0))
    ).reverse();

    uncertaintyConePath = `M ${upperCoords.map((c) => `${c.x},${c.y}`).join(' L ')} L ${lowerCoords
      .map((c) => `${c.x},${c.y}`)
      .join(' L ')} Z`;
  }

  return (
    <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 flex flex-col justify-between shadow-sm relative min-h-[420px]">
      {/* Header & Methodology Banner */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">
                Cash Flow Trajectory & Projection
              </h2>
              <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                Deterministic Rollup
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Cumulative historical ledger actuals &plusmn; linear net burn forecast
            </p>
          </div>

          {/* Legend */}
          {!isInsufficient && (
            <div className="flex items-center gap-3 text-xs text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-primary inline-block"></span>
                <span>Actuals</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-primary/60 inline-block"></span>
                <span>Forecast</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-primary/10 border border-primary/30 inline-block"></span>
                <span>&plusmn;10% Cone</span>
              </span>
            </div>
          )}
        </div>

        {/* Methodology Subtext */}
        <div className="flex items-center justify-between text-[11px] font-mono-data text-on-surface-variant bg-surface-container-low/50 px-3 py-1.5 rounded-lg border border-outline-variant/30 mb-4">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">analytics</span>
            <span>{forecastMethodology}</span>
          </span>
          {monthlyNetBurn > 0 && (
            <span>Burn baseline: {formatCurrency(monthlyNetBurn, workspace.currency)}/mo</span>
          )}
        </div>
      </div>

      {/* Main Chart Canvas or Empty State */}
      {isInsufficient ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center bg-surface-container/20 border border-outline-variant/30 rounded-xl my-2">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-3">
            <span className="material-symbols-outlined text-2xl">timeline</span>
          </div>
          <h3 className="text-sm font-semibold text-on-surface">
            Insufficient Historical Data for Trajectory
          </h3>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-md leading-relaxed">
            At least 1 completed historical calendar month preceding the reporting anchor is required to establish a deterministic burn baseline and extrapolate future cash runway.
          </p>
          <div className="mt-4 text-[11px] font-mono-data text-primary bg-primary/10 px-3 py-1 rounded-md border border-primary/20">
            Current balance: {formatCurrency(currentCash, workspace.currency)}
          </div>
        </div>
      ) : (
        <div className="flex-1 relative w-full h-[220px] select-none my-2">
          {/* SVG Canvas */}
          <div className="absolute inset-0">
            <svg
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            >
              {/* Horizontal Gridlines */}
              {[0.2, 0.5, 0.8].map((ratio, i) => {
                const y = paddingY + ratio * usableHeight;
                return (
                  <line
                    key={i}
                    x1={paddingX}
                    y1={y}
                    x2={svgWidth - paddingX}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-outline-variant/30"
                    strokeDasharray="4,4"
                  />
                );
              })}

              {/* Shaded Uncertainty Cone */}
              {uncertaintyConePath && (
                <path
                  d={uncertaintyConePath}
                  fill="currentColor"
                  className="text-primary/10"
                />
              )}

              {/* Actuals Line (Solid) */}
              {actualPath && (
                <path
                  d={actualPath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                  className="transition-all duration-300"
                />
              )}

              {/* Forecast Line (Dashed) */}
              {forecastPath && (
                <path
                  d={forecastPath}
                  fill="none"
                  stroke="#60a5fa"
                  strokeDasharray="6,6"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  className="transition-all duration-300"
                />
              )}

              {/* Boundary Point Marker */}
              {boundaryIdx !== -1 && actualCoords[boundaryIdx] && (
                <g>
                  {/* Vertical boundary line */}
                  <line
                    x1={actualCoords[boundaryIdx].x}
                    y1={paddingY}
                    x2={actualCoords[boundaryIdx].x}
                    y2={svgHeight - paddingY}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                    className="text-primary/50"
                  />
                  {/* Boundary node */}
                  <circle
                    cx={actualCoords[boundaryIdx].x}
                    cy={actualCoords[boundaryIdx].y}
                    r="6"
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        index: boundaryIdx,
                        month: points[boundaryIdx].month,
                        value: points[boundaryIdx].actual ?? points[boundaryIdx].forecast ?? 0,
                        type: 'boundary',
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              )}

              {/* Actuals Nodes */}
              {actualCoords.map((coord, idx) => {
                if (idx === boundaryIdx) return null; // already rendered as boundary
                const p = actualPoints[idx];
                return (
                  <circle
                    key={`act-${idx}`}
                    cx={coord.x}
                    cy={coord.y}
                    r={hoveredPoint?.index === idx ? '5.5' : '4'}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        index: idx,
                        month: p.month,
                        value: p.actual ?? 0,
                        type: 'actual',
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}

              {/* Forecast Nodes */}
              {forecastCoords.map((coord, idx) => {
                if (idx === 0) return null; // anchor boundary already rendered
                const fullIdx = boundaryIdx + idx;
                const p = points[fullIdx];
                return (
                  <circle
                    key={`fc-${fullIdx}`}
                    cx={coord.x}
                    cy={coord.y}
                    r={hoveredPoint?.index === fullIdx ? '5.5' : '4'}
                    fill="#93c5fd"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        index: fullIdx,
                        month: p.month,
                        value: p.forecast ?? 0,
                        upper: p.upperBand,
                        lower: p.lowerBand,
                        type: 'forecast',
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Hover Tooltip */}
          {hoveredPoint && (
            <div className="absolute top-2 right-4 bg-surface-container-highest/95 backdrop-blur-xs text-on-surface border border-outline-variant p-2.5 rounded-xl shadow-xl text-xs font-mono-data pointer-events-none z-20">
              <div className="flex items-center gap-2 font-bold mb-0.5">
                <span>{hoveredPoint.month}</span>
                <span className="capitalize text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                  {hoveredPoint.type === 'boundary' ? 'Reporting Anchor' : hoveredPoint.type}
                </span>
              </div>
              <div className="text-primary font-bold">
                {formatCurrency(hoveredPoint.value, workspace.currency)}
              </div>
              {hoveredPoint.upper !== undefined && hoveredPoint.lower !== undefined && (
                <div className="text-[10px] text-on-surface-variant mt-0.5">
                  Variance: {formatCurrency(hoveredPoint.lower, workspace.currency)} &ndash; {formatCurrency(hoveredPoint.upper, workspace.currency)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* X-Axis Labels */}
      {!isInsufficient && (
        <div className="flex justify-between w-full pt-2 border-t border-outline-variant/30 text-[11px] font-mono-data text-on-surface-variant overflow-x-auto">
          {points.map((p, idx) => (
            <span
              key={idx}
              className={`px-1 text-center whitespace-nowrap ${
                p.isCurrent ? 'font-bold text-primary underline underline-offset-4' : ''
              }`}
            >
              {p.month}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
