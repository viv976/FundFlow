'use client';

import React, { useState } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';

export const CashFlowChart: React.FC = () => {
  const { cashFlowProjection } = useFinance();
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    month: string;
    value: number;
    type: 'actual' | 'forecast';
  } | null>(null);

  const points = cashFlowProjection.points;
  // Maximum scale for axis (default $1.5M or computed from maximum point)
  const maxVal = Math.max(1500000, ...points.map((p) => Math.max(p.actual || 0, p.forecast || 0)));

  // Coordinate mapping for SVG (width: 1000, height: 260)
  const svgWidth = 1000;
  const svgHeight = 260;
  const paddingX = 40;
  const usableWidth = svgWidth - paddingX * 2;

  const getCoordinates = (index: number, val: number) => {
    const x = paddingX + (index / (points.length - 1)) * usableWidth;
    const y = svgHeight - (val / maxVal) * (svgHeight - 40) - 20;
    return { x, y };
  };

  // Build actual points path (index 0 to 3)
  const actualCoords = points
    .filter((p) => p.actual !== undefined)
    .map((p, i) => getCoordinates(i, p.actual!));

  const actualPath =
    actualCoords.length > 0
      ? `M ${actualCoords.map((c) => `${c.x},${c.y}`).join(' L ')}`
      : '';

  // Build forecast points path (from current month index 3 to end)
  const currentIdx = points.findIndex((p) => p.isCurrent) !== -1 ? points.findIndex((p) => p.isCurrent) : 3;
  const forecastPoints = points.slice(currentIdx);
  const forecastCoords = forecastPoints.map((p, i) =>
    getCoordinates(currentIdx + i, (p.forecast || p.actual)!)
  );

  const forecastPath =
    forecastCoords.length > 0
      ? `M ${forecastCoords.map((c) => `${c.x},${c.y}`).join(' L ')}`
      : '';

  return (
    <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col h-[400px] shadow-sm relative">
      {/* Header & Legend */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
            Cash Flow Projection
          </h2>
          <span className="text-[12px] text-on-surface-variant font-body-sm">
            Deterministic cash runway trajectory & forecast
          </span>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
            <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
            Actual
          </span>
          <span className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
            <span className="w-3 h-3 rounded-full bg-primary-fixed-dim inline-block"></span>
            Forecast
          </span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="flex-1 relative w-full border-b border-l border-outline-variant/50 pt-4 pr-2 select-none">
        {/* Y-Axis Labels */}
        <div className="absolute left-[-55px] top-0 bottom-0 flex flex-col justify-between font-mono-data text-[12px] text-on-surface-variant py-2">
          <span>$1.5M</span>
          <span>$1.0M</span>
          <span>$500K</span>
          <span>$0</span>
        </div>

        {/* Horizontal Gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between pt-4 pb-0 pointer-events-none">
          <div className="w-full border-t border-outline-variant/20 h-0"></div>
          <div className="w-full border-t border-outline-variant/20 h-0"></div>
          <div className="w-full border-t border-outline-variant/20 h-0"></div>
          <div className="w-full border-t border-outline-variant/20 h-0"></div>
        </div>

        {/* SVG Graphic */}
        <div className="absolute inset-0 flex items-end pl-2 pt-4 pb-0">
          <svg
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          >
            {/* Actual Curve */}
            {actualPath && (
              <path
                d={actualPath}
                fill="none"
                stroke="#002546"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
                className="transition-all duration-300"
              />
            )}

            {/* Forecast Curve (Dashed) */}
            {forecastPath && (
              <path
                d={forecastPath}
                fill="none"
                stroke="#a4c9fc"
                strokeDasharray="6,6"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
                className="transition-all duration-300"
              />
            )}

            {/* Actual Data Points */}
            {actualCoords.map((coord, idx) => (
              <g key={`actual-${idx}`}>
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={hoveredPoint?.index === idx ? '6' : '4.5'}
                  fill="#002546"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() =>
                    setHoveredPoint({
                      index: idx,
                      month: points[idx].month,
                      value: points[idx].actual!,
                      type: 'actual',
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            ))}

            {/* Forecast Data Points */}
            {forecastCoords.map((coord, idx) => {
              const fullIdx = currentIdx + idx;
              if (fullIdx === currentIdx) return null; // Already rendered as current
              return (
                <g key={`forecast-${fullIdx}`}>
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={hoveredPoint?.index === fullIdx ? '6' : '4.5'}
                    fill="#a4c9fc"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        index: fullIdx,
                        month: points[fullIdx].month,
                        value: points[fullIdx].forecast!,
                        type: 'forecast',
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 right-4 bg-primary text-on-primary px-3 py-1.5 rounded shadow-lg text-xs font-mono-data pointer-events-none z-20 border border-outline-variant/30 flex items-center gap-2">
            <span className="font-semibold text-secondary-fixed">
              {hoveredPoint.month}:
            </span>
            <span>{formatCurrency(hoveredPoint.value)}</span>
            <span className="capitalize text-[10px] text-on-primary-container">
              ({hoveredPoint.type})
            </span>
          </div>
        )}
      </div>

      {/* X-Axis Labels */}
      <div className="flex justify-between w-full mt-3 pl-2 font-body-sm text-body-sm text-on-surface-variant">
        {points.map((p, idx) => (
          <span
            key={idx}
            className={`${
              p.isCurrent ? 'font-semibold text-primary underline underline-offset-4' : ''
            }`}
          >
            {p.month}
          </span>
        ))}
      </div>
    </div>
  );
};
