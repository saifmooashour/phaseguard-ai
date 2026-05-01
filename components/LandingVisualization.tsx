'use client';

import React, { useEffect, useState, useRef } from 'react';

interface LandingVisualizationProps {
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore?: number;
}

export default function LandingVisualization({
  riskLevel = 'Low',
  riskScore = 0,
}: LandingVisualizationProps) {
  const [planeProgress, setPlaneProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const requestRef = useRef<number>(null);
  const label = "ILS Final Approach Monitor";

  // Animation logic using requestAnimationFrame for 60fps smoothness
  const animate = (time: number) => {
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
  let glowColor = 'rgba(16, 185, 129, 0.4)';
  let deviationIntensity = 0;
  
  if (riskLevel === 'Medium') {
    statusColor = '#FBBF24'; // amber
    glowColor = 'rgba(251, 191, 36, 0.4)';
    deviationIntensity = 5;
  } else if (riskLevel === 'High') {
    statusColor = '#F97316'; // orange
    glowColor = 'rgba(249, 115, 22, 0.5)';
    deviationIntensity = 15;
  } else if (riskLevel === 'Critical') {
    statusColor = '#EF4444'; // red
    glowColor = 'rgba(239, 68, 68, 0.6)';
    deviationIntensity = 30;
  }

  // Smooth easing for descent: faster at start, slower as it touches down
  // t: progress (0-1), b: start, c: change, d: duration
  const easeOutQuad = (t: number) => t * (2 - t);
  const smoothedProgress = easeOutQuad(planeProgress / 100) * 100;

  // Calculate position and scale
  const baseY = 50;
  const targetY = 480;
  const planeY = baseY + (smoothedProgress / 100) * (targetY - baseY);
  
  // Crosswind oscillation based on risk
  const oscillation = Math.sin(planeProgress * 0.15) * deviationIntensity;
  const planeX = 200 + oscillation;
  
  // Slight tilt for crosswind correction (±5 deg)
  const tilt = Math.sin(planeProgress * 0.1) * (deviationIntensity > 0 ? 5 : 1);
  
  // Scale effect: plane gets larger as it descends
  const planeScale = 0.8 + (smoothedProgress / 100) * 0.7;

  return (
    <div className="bg-slate-950/40 backdrop-blur-2xl border border-slate-800/50 rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center w-full my-6 relative overflow-hidden group">
      {/* Dynamic atmospheric glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>
      
      {/* Header Info */}
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center justify-between w-full border-b border-slate-800/50 pb-5 relative z-10">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-cyan-500 mr-3 animate-pulse"></div>
          {label}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-600 font-mono">CONFIDENCE: HIGH</span>
          <span className={`px-4 py-1.5 rounded-full border transition-colors duration-500 ${
            riskLevel === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
            riskLevel === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
            riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
          }`}>
            {riskLevel.toUpperCase()} LEVEL • {riskScore}%
          </span>
        </div>
      </div>

      <div className="relative w-full max-w-[500px] h-[550px] flex items-center justify-center bg-[#020617] rounded-3xl border border-slate-800 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Radar/HUD Grid lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        {/* SVG Canvas */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="motionBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
            </filter>
            <radialGradient id="planeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={statusColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={statusColor} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="runwayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* PERSPECTIVE RUNWAY - Bottom Anchored */}
          <g transform="translate(200, 580)">
             {/* Large trapezoid for extreme perspective */}
             {/* Top width: 40px, Bottom width: 300px, Height: 200px */}
             <path 
                d="M -20,-200 L 20,-200 L 150,0 L -150,0 Z" 
                fill="url(#runwayGrad)" 
                stroke="#334155" 
                strokeWidth="1"
             />
             
             {/* Runway Markings */}
             <g opacity="0.6">
                {/* Centerline scaling with perspective */}
                {[...Array(6)].map((_, i) => {
                    const y = -200 + (i * 40);
                    const width = 2 + (i * 2);
                    return (
                        <rect key={i} x={-width/2} y={y} width={width} height="15" fill="#ffffff" />
                    );
                })}
                
                {/* Threshold Markings (Piano Keys) */}
                <g transform="translate(0, -190)">
                   {[-12, -8, -4, 0, 4, 8, 12].map((x, i) => (
                      <rect key={i} x={x-1} y="0" width="2" height="15" fill="#ffffff" />
                   ))}
                </g>
                
                {/* Touchdown Zone */}
                <rect x="-30" y="-140" width="60" height="2" fill="#ffffff" opacity="0.3" />
             </g>

             {/* Approach Lighting System (PAPI style) */}
             <g transform="translate(-60, -180)">
                <circle r="3" fill="#ef4444" />
                <circle cx="10" r="3" fill="#ef4444" />
                <circle cx="110" r="3" fill="#ffffff" />
                <circle cx="120" r="3" fill="#ffffff" />
             </g>
          </g>

          {/* Glide Path Reference Line */}
          <line x1="200" y1="0" x2="200" y2="380" stroke="#1e293b" strokeWidth="1" strokeDasharray="8 8" opacity="0.5" />

          {/* AIRCRAFT GROUP */}
          <g transform={`translate(${planeX}, ${planeY}) scale(${planeScale}) rotate(${tilt})`}>
             {/* Dynamic Glow reactive to risk */}
             <circle r="40" fill="url(#planeGlow)" className={riskLevel === 'Critical' ? 'animate-pulse' : ''} />
             
             {/* Shadow below aircraft for depth */}
             <ellipse cy="30" rx="15" ry="5" fill="black" opacity="0.3" filter="blur(8px)" />
             
             {/* Realistic Aircraft Model (Top-Down Silhouette pointing DOWN) */}
             <g filter="url(#motionBlur)">
                {/* Fuselage */}
                <path d="M 0,25 C 2,25 6,10 6,0 L 6,-20 C 6,-25 3,-28 0,-28 C -3,-28 -6,-25 -6,-20 L -6,0 C -6,10 -2,25 0,25" fill={statusColor} />
                {/* Wings */}
                <path d="M -35,5 L -35,-2 C -35,-2 -15,-5 -6,-8 L 6,-8 C 15,-5 35,-2 35,-2 L 35,5 C 35,5 15,3 0,3 C -15,3 -35,5 -35,5" fill={statusColor} />
                {/* Tail / Elevators */}
                <path d="M -12,-20 L 12,-20 L 10,-24 L -10,-24 Z" fill={statusColor} />
                {/* Tail Fin (Vertical) */}
                <rect x="-1" y="-28" width="2" height="12" fill={statusColor} opacity="0.8" />
                
                {/* Navigation Lights */}
                <circle cx="-34" cy="-1" r="2" fill="#ef4444" className="animate-pulse" />
                <circle cx="34" cy="-1" r="2" fill="#22c55e" className="animate-pulse" />
                
                {/* Nose Glow */}
                <circle cy="22" r="3" fill="#ffffff" opacity="0.8" />
             </g>
          </g>
        </svg>

        {/* HUD OVERLAY */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Viewport Corners */}
          <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-cyan-500/20 rounded-tl-xl"></div>
          <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-cyan-500/20 rounded-tr-xl"></div>
          <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-cyan-500/20 rounded-bl-xl"></div>
          <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-cyan-500/20 rounded-br-xl"></div>

          {/* Digital Readouts */}
          <div className="absolute left-10 top-1/2 -translate-y-1/2 space-y-8">
            <div className="space-y-1">
              <div className="text-[10px] text-cyan-500 font-bold tracking-tighter">ALTITUDE</div>
              <div className="text-xl font-black text-white font-mono">{Math.round(2500 - (smoothedProgress * 25))} FT</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-cyan-500 font-bold tracking-tighter">AIRSPEED</div>
              <div className="text-xl font-black text-white font-mono">{Math.round(145 - (deviationIntensity / 2))} KTS</div>
            </div>
          </div>

          <div className="absolute right-10 top-1/2 -translate-y-1/2 text-right space-y-8">
            <div className="space-y-1">
              <div className="text-[10px] text-cyan-500 font-bold tracking-tighter">VERT SPEED</div>
              <div className="text-xl font-black text-white font-mono">-750 FPM</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-cyan-500 font-bold tracking-tighter">GLIDESLOPE</div>
              <div className={`text-xl font-black font-mono ${riskLevel === 'Low' ? 'text-green-400' : 'text-amber-400'}`}>3.0°</div>
            </div>
          </div>

          {/* Center Target */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center opacity-20">
            <div className="w-full h-[1px] bg-cyan-500"></div>
            <div className="absolute w-[1px] h-full bg-cyan-500"></div>
            <div className="absolute w-8 h-8 border border-cyan-500 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="mt-8 grid grid-cols-3 gap-12 w-full relative z-10">
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Lateral Alignment</span>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-500" 
              style={{ width: `${50 + (oscillation * 2)}%` }}
            ></div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Approach Stability</span>
          <span className={`text-xs font-bold ${riskLevel === 'Low' ? 'text-green-400' : 'text-amber-400'}`}>
            {riskLevel === 'Low' ? 'STABLE' : 'UNSTABLE'}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Touchdown ET</span>
          <span className="text-xs font-bold text-white font-mono">
            {Math.max(0, Math.round(15 - (smoothedProgress * 0.15)))} SEC
          </span>
        </div>
      </div>
    </div>
  );
}
