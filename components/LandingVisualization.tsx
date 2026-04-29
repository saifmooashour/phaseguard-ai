'use client';

import React, { useEffect, useState } from 'react';

interface LandingVisualizationProps {
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore?: number;
}

export default function LandingVisualization({
  riskLevel = 'Low',
  riskScore = 0,
}: LandingVisualizationProps) {
  const [planeProgress, setPlaneProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaneProgress((prev) => (prev >= 100 ? 0 : prev + 0.5));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Determine path color and deviation intensity based on riskLevel
  let strokeColor = '#10B981'; // green
  let deviationScale = 0;
  let isWarning = false;

  if (riskLevel === 'Medium') {
    strokeColor = '#FBBF24'; // yellow
    deviationScale = 5;
  } else if (riskLevel === 'High') {
    strokeColor = '#F97316'; // orange
    deviationScale = 15;
  } else if (riskLevel === 'Critical') {
    strokeColor = '#EF4444'; // red
    deviationScale = 25;
    isWarning = true;
  }

  // Generate flight path data with oscillation
  const generatePath = () => {
    const points = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * 400; // width of SVG
      const basey = 100; // middle of SVG
      // Oscillate Y based on risk level
      const oscillation = deviationScale > 0 
        ? Math.sin(i + planeProgress * 0.2) * deviationScale 
        : 0;
      points.push(`${x},${basey + oscillation}`);
    }
    return `M ${points.join(' L ')}`;
  };

  // Determine plane position along path
  const planeX = (planeProgress / 100) * 400;
  const planeY = 100 + (deviationScale > 0 ? Math.sin((planeProgress / 10) + planeProgress * 0.2) * deviationScale : 0);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center w-full my-4 relative overflow-hidden">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between w-full border-b border-slate-800 pb-2">
        <span>{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
          riskLevel === 'Critical' ? 'bg-red-500/20 text-red-400' :
          riskLevel === 'High' ? 'bg-orange-500/20 text-orange-400' :
          riskLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
        }`}>
          {riskLevel} ({riskScore})
        </span>
      </div>

      <div className="relative w-full max-w-[400px] h-[200px] flex items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800/80 shadow-inner">
        {/* Runway (Static SVG) */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
          {/* Horizon */}
          <line x1="0" y1="100" x2="400" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
          
          {/* Runway perspective */}
          <polygon points="150,200 250,200 220,100 180,100" fill="#1E293B" opacity="0.8" />
          <polygon points="195,200 205,200 202,100 198,100" fill="#FFFFFF" opacity="0.3" />
          <line x1="150" y1="200" x2="180" y2="100" stroke="#475569" strokeWidth="2" />
          <line x1="250" y1="200" x2="220" y2="100" stroke="#475569" strokeWidth="2" />
          
          {/* Threshold marks */}
          <line x1="160" y1="190" x2="240" y2="190" stroke="#FFFFFF" strokeWidth="4" />

          {/* Oscillating Flight Path */}
          <path
            d={generatePath()}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-300 ease-in-out"
          />

          {/* Airplane Icon moving along path */}
          <g transform={`translate(${planeX - 10}, ${planeY - 10})`} className="transition-all duration-75 ease-linear">
            {/* Plane SVG */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={strokeColor}
              className={`drop-shadow-[0_0_8px_${strokeColor}] ${isWarning ? 'animate-pulse' : ''}`}
            >
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </g>
        </svg>

        {isWarning && (
          <div className="absolute top-2 left-2 flex items-center bg-red-500/10 border border-red-500/30 rounded px-2 py-1 text-[8px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
            ⚠ Unstable Approach Warning
          </div>
        )}
      </div>

      <p className="text-[9px] text-slate-500 italic text-center mt-3">
        Landing Visualization (Pilot Mode Preview — Not a real flight simulation)
      </p>
    </div>
  );
}

const label = "Landing Visualization";
