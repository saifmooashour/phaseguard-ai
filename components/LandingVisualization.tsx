'use client';

import React, { useEffect, useState, useRef } from 'react';

interface LandingVisualizationProps {
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore?: number;
  mode?: 'dashboard' | 'pilot';
}

export default function LandingVisualization({
  riskLevel = 'Low',
  riskScore = 0,
  mode = 'pilot',
}: LandingVisualizationProps) {
  const [planeProgress, setPlaneProgress] = useState(0);
  const requestRef = useRef<number>(null);
  const label = mode === 'pilot' ? "ILS Final Approach Monitor" : "Tactical Runway Overview";

  // Animation logic using requestAnimationFrame for 60fps smoothness
  const animate = () => {
    setPlaneProgress((prev) => {
      const next = prev + 0.4;
      return next >= 100 ? 0 : next;
    });
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Determine colors and intensities based on riskLevel
  let statusColor = '#10B981'; // green
  let deviationIntensity = 0;
  
  if (riskLevel === 'Medium') {
    statusColor = '#FBBF24'; // amber
    deviationIntensity = 5;
  } else if (riskLevel === 'High') {
    statusColor = '#F97316'; // orange
    deviationIntensity = 15;
  } else if (riskLevel === 'Critical') {
    statusColor = '#EF4444'; // red
    deviationIntensity = 30;
  }

  // Smooth easing for descent: faster at start, slower as it touches down
  const easeOutQuad = (t: number) => t * (2 - t);
  const smoothedProgress = easeOutQuad(planeProgress / 100) * 100;

  // Calculate position and scale
  const baseY = mode === 'pilot' ? 50 : 100;
  const targetY = mode === 'pilot' ? 480 : 450;
  const planeY = baseY + (smoothedProgress / 100) * (targetY - baseY);
  
  // Crosswind oscillation based on risk
  const oscillation = Math.sin(planeProgress * 0.15) * deviationIntensity;
  const planeX = 200 + (mode === 'pilot' ? oscillation : oscillation * 0.5);
  
  // Slight tilt for crosswind correction
  const tilt = Math.sin(planeProgress * 0.1) * (deviationIntensity > 0 ? 5 : 1);
  
  // Scale effect: plane gets larger as it descends
  const planeScale = mode === 'pilot' 
    ? 0.8 + (smoothedProgress / 100) * 0.7
    : 0.5 + (smoothedProgress / 100) * 0.3;

  return (
    <div className={`bg-slate-950/40 backdrop-blur-2xl border border-slate-800/50 rounded-[40px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center w-full my-4 relative overflow-hidden group ${mode === 'dashboard' ? 'max-w-4xl' : ''}`}>
      {/* Dynamic atmospheric glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>
      
      {/* Header Info */}
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center justify-between w-full border-b border-slate-800/50 pb-4 relative z-10">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-cyan-500 mr-3 animate-pulse"></div>
          {label}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-600 font-mono hidden sm:inline">TELEMETRY: ACTIVE</span>
          <span className={`px-3 py-1 rounded-full border transition-colors duration-500 ${
            riskLevel === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
            riskLevel === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
            riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
          }`}>
            {riskLevel.toUpperCase()} • {riskScore}%
          </span>
        </div>
      </div>

      <div className={`relative w-full h-[400px] flex items-center justify-center bg-[#020617] rounded-3xl border border-slate-800 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] overflow-hidden ${mode === 'dashboard' ? 'h-[300px]' : ''}`}>
        {/* HUD Grid lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        {/* SVG Canvas */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="motionBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
            </filter>
            <radialGradient id="planeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={statusColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={statusColor} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="runwayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* RUNWAY VIEW */}
          <g transform={`translate(200, 580) ${mode === 'dashboard' ? 'scale(1.2)' : ''}`}>
             <path 
                d="M -20,-250 L 20,-250 L 180,0 L -180,0 Z" 
                fill="url(#runwayGrad)" 
                stroke="#334155" 
                strokeWidth="1"
             />
             <g opacity="0.6">
                {[...Array(8)].map((_, i) => {
                    const y = -250 + (i * 35);
                    const width = 2 + (i * 2);
                    return <rect key={i} x={-width/2} y={y} width={width} height="12" fill="#ffffff" />;
                })}
             </g>
          </g>

          {/* AIRCRAFT */}
          <g transform={`translate(${planeX}, ${planeY}) scale(${planeScale}) rotate(${tilt})`}>
             <circle r="40" fill="url(#planeGlow)" className={riskLevel === 'Critical' ? 'animate-pulse' : ''} />
             <g filter="url(#motionBlur)">
                <path d="M 0,25 C 2,25 6,10 6,0 L 6,-20 C 6,-25 3,-28 0,-28 C -3,-28 -6,-25 -6,-20 L -6,0 C -6,10 -2,25 0,25" fill={statusColor} />
                <path d="M -35,5 L -35,-2 C -35,-2 -15,-5 -6,-8 L 6,-8 C 15,-5 35,-2 35,-2 L 35,5 C 35,5 15,3 0,3 C -15,3 -35,5 -35,5" fill={statusColor} />
                <path d="M -12,-20 L 12,-20 L 10,-24 L -10,-24 Z" fill={statusColor} />
                <circle cx="-34" cy="-1" r="2" fill="#ef4444" className="animate-pulse" />
                <circle cx="34" cy="-1" r="2" fill="#22c55e" className="animate-pulse" />
             </g>
          </g>
        </svg>

        {/* HUD OVERLAY (Pilot Only) */}
        {mode === 'pilot' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-cyan-500/20 rounded-tl-xl"></div>
            <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-cyan-500/20 rounded-tr-xl"></div>
            <div className="absolute left-10 top-1/2 -translate-y-1/2 space-y-6">
              <div className="space-y-0.5">
                <div className="text-[8px] text-cyan-500 font-bold">ALTITUDE</div>
                <div className="text-lg font-black text-white font-mono">{Math.round(2000 - (smoothedProgress * 20))} FT</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[8px] text-cyan-500 font-bold">AIRSPEED</div>
                <div className="text-lg font-black text-white font-mono">{Math.round(140 - (deviationIntensity / 3))} KTS</div>
              </div>
            </div>
            <div className="absolute right-10 top-1/2 -translate-y-1/2 text-right space-y-6">
              <div className="space-y-0.5">
                <div className="text-[8px] text-cyan-500 font-bold">VERT SPEED</div>
                <div className="text-lg font-black text-white font-mono">-700 FPM</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[8px] text-cyan-500 font-bold">GLIDESLOPE</div>
                <div className="text-lg font-black text-green-400 font-mono">3.0°</div>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center opacity-10">
              <div className="w-full h-[1px] bg-cyan-500"></div>
              <div className="absolute w-[1px] h-full bg-cyan-500"></div>
              <div className="absolute w-8 h-8 border border-cyan-500 rounded-full"></div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Footer (Pilot Only) */}
      {mode === 'pilot' && (
        <div className="mt-6 grid grid-cols-3 gap-8 w-full relative z-10">
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Alignment</span>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${50 + (oscillation * 2)}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Stability</span>
            <span className={`text-[10px] font-bold ${riskLevel === 'Low' ? 'text-green-400' : 'text-amber-400'}`}>
              {riskLevel === 'Low' || riskLevel === 'Medium' ? 'STABLE' : 'UNSTABLE'}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Touchdown</span>
            <span className="text-[10px] font-bold text-white font-mono">
              {Math.max(0, Math.round(15 - (smoothedProgress * 0.15)))} SEC
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
