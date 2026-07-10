"use client";

import React, { useState, useEffect } from "react";

type DataPoint = {
  label: string;
  value: number;
};

type Props = {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  type?: "line" | "bar";
  color?: string;
  height?: number;
};

export function StatsVisualization({ title, subtitle, data, type = "line", color = "#CE181E", height = 220 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || data.length === 0) {
    return (
      <div className="surface p-6 rounded-2xl bg-white border border-slate-200 shadow-sm animate-pulse" style={{ height: height + 80 }}>
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-slate-100 rounded w-1/4 mb-6"></div>
        <div className="w-full bg-slate-50 rounded-lg" style={{ height: height - 40 }}></div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 10);
  const padding = 30;
  const graphWidth = 1000;
  const graphHeight = 300;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * (graphWidth - padding * 2) + padding;
    const y = graphHeight - padding - (d.value / maxValue) * (graphHeight - padding * 2);
    return { x, y, label: d.label, value: d.value };
  });

  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${graphHeight - padding} L ${points[0].x} ${graphHeight - padding} Z`;

  return (
    <div className="surface p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      
      <div className="relative w-full flex-1" style={{ minHeight: height }}>
        <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          {/* Grid lines */}
          {[0, 1, 2, 3].map((tick) => {
            const y = padding + (tick / 3) * (graphHeight - padding * 2);
            return (
              <g key={tick}>
                <line x1={padding} y1={y} x2={graphWidth - padding} y2={y} stroke="#f1f5f9" strokeWidth="2" />
                <text x={padding - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[18px] font-medium font-mono">
                  {Math.round(maxValue - (tick / 3) * maxValue)}
                </text>
              </g>
            );
          })}

          {type === "line" && (
            <>
              {/* Area */}
              <path d={areaPath} fill={color} fillOpacity="0.1" />
              {/* Line */}
              <path d={linePath} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Data Points / Bars */}
          {points.map((p, i) => {
            return (
              <g 
                key={i} 
                onMouseEnter={() => setHoveredIdx(i)} 
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer group"
              >
                {type === "bar" && (
                  <rect
                    x={p.x - (graphWidth / data.length) * 0.3}
                    y={p.y}
                    width={(graphWidth / data.length) * 0.6}
                    height={graphHeight - padding - p.y}
                    fill={hoveredIdx === i ? color : color + "99"}
                    rx="6"
                    className="transition-all duration-300"
                  />
                )}

                {type === "line" && (
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={hoveredIdx === i ? 8 : 5} 
                    fill="white" 
                    stroke={color} 
                    strokeWidth="3" 
                    className="transition-all duration-300"
                  />
                )}

                {/* X Axis Labels */}
                <text 
                  x={p.x} 
                  y={graphHeight + 25} 
                  textAnchor="middle" 
                  className={`fill-slate-500 text-[16px] font-bold transition-all ${hoveredIdx === i ? "fill-slate-900" : ""}`}
                >
                  {p.label}
                </text>

                {/* Tooltip Hover Value */}
                {hoveredIdx === i && (
                  <g className="transition-opacity duration-200">
                    <rect x={p.x - 30} y={p.y - 45} width="60" height="30" rx="4" fill="#1e293b" />
                    <polygon points={`${p.x-5},${p.y-15} ${p.x+5},${p.y-15} ${p.x},${p.y-8}`} fill="#1e293b" />
                    <text x={p.x} y={p.y - 25} textAnchor="middle" fill="white" className="text-[14px] font-bold">{p.value}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
