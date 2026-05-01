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
  const label = "Landing Visualization";

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
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[32px] p-8 shadow-2xl flex flex-col items-center justify-center w-full my-4 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
      
      <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between w-full border-b border-slate-800 pb-4 relative z-10">
        <div className="flex items-center">
          <svg className="w-4 h-4 mr-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          {label}
        </div>
        <span className={`text-[10px] px-3 py-1 rounded-lg font-black border ${
          riskLevel === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
          riskLevel === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
          riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
        }`}>
          {riskLevel.toUpperCase()} ASSESSMENT: {riskScore}
        </span>
      </div>

      <div className="relative w-full max-w-[500px] h-[300px] flex items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 shadow-[inset_0_0_50px_rgba(0,0,0,1)] overflow-hidden">
        {/* Dynamic Background Grid */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        {/* Landing Visualization Canvas */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
          {/* Horizon Line */}
          <line x1="0" y1="100" x2="400" y2="100" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
          
          {/* Centered Runway Perspective */}
          <g transform="translate(200, 100)">
            {/* Ground / Approach Area */}
            <path d="M -150,100 L 150,100 L 20,0 L -20,0 Z" fill="#0f172a" />
            {/* Runway Main Surface */}
            <path d="M -40,100 L 40,100 L 10,0 L -10,0 Z" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
            {/* Centerline */}
            <line x1="0" y1="100" x2="0" y2="0" stroke="#ffffff" strokeWidth="1" strokeDasharray="10 10" opacity="0.4" />
            {/* Threshold Marks */}
            <line x1="-35" y1="95" x2="35" y2="95" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
            <line x1="-30" y1="85" x2="30" y2="85" stroke="#ffffff" strokeWidth="1.5" opacity="0.4" />
          </g>

          {/* Oscillating Flight Path (Centered) */}
          <g transform="translate(0, 0)">
            <path
              d={generatePath()}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="transition-all duration-300 ease-in-out opacity-80"
              style={{ filter: `blur(${isWarning ? '1px' : '0px'})` }}
            />
            
            {/* Airplane Marker */}
            <g transform={`translate(${planeX}, ${planeY})`}>
               <circle r="4" fill={strokeColor} className={isWarning ? 'animate-ping' : ''} />
               <circle r="2" fill="#ffffff" />
               
               {/* Aircraft Shape */}
               <path 
                 d="M -8,0 L 8,0 M 0,-6 L 0,6 M -4,-2 L -4,2" 
                 stroke={strokeColor} 
                 strokeWidth="2" 
                 strokeLinecap="round" 
                 transform="rotate(0)"
                 className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
               />
            </g>
          </g>
        </svg>

        {/* HUD Markers */}
        <div className="absolute inset-0 pointer-events-none border border-cyan-500/10 rounded-2xl">
          <div className="absolute top-4 left-4 font-mono text-[9px] text-cyan-500/50">GS 3.0&deg;</div>
          <div className="absolute top-4 right-4 font-mono text-[9px] text-cyan-500/50">LOC 0.0</div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] text-slate-500 uppercase tracking-widest">Approach Path Visualizer</div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-6 w-full relative z-10">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strokeColor }}></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Path Stability: {riskLevel === 'Low' ? 'Nominal' : riskLevel === 'Medium' ? 'Unstable' : 'Critical'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telemetry Refresh: 50ms</span>
        </div>
      </div>
    </div>
  );
}

const label = "Landing Visualization";
