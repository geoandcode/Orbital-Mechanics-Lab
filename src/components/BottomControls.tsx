import React from 'react';
import { Play, Pause, RotateCcw, Compass, Eye } from 'lucide-react';

interface BottomControlsProps {
  isAnimating: boolean;
  onToggleAnimate: () => void;
  onResetOrbit: () => void;
  cameraPreset: 'isometric' | 'polar' | 'equatorial' | 'chase';
  onSetCameraPreset: (preset: 'isometric' | 'polar' | 'equatorial' | 'chase') => void;
}

export const BottomControls: React.FC<BottomControlsProps> = ({
  isAnimating,
  onToggleAnimate,
  onResetOrbit,
  cameraPreset,
  onSetCameraPreset,
}) => {
  return (
    <>
      {/* Interaction Hint (Bottom Left) */}
      <div className="absolute bottom-5 left-6 text-[11px] uppercase tracking-wider text-slate-400 font-semibold pointer-events-none hidden md:block z-10 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
        Drag to rotate · Scroll to zoom · Orbit scale compressed for teaching
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 z-10 p-1.5 bg-[#0d1024]/90 border border-[rgba(85,105,180,0.4)] backdrop-blur-md rounded-2xl shadow-2xl max-w-[94vw]">
        {/* Play / Pause Animation */}
        <button
          onClick={onToggleAnimate}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            isAnimating
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_12px_rgba(217,119,6,0.4)]'
              : 'bg-[#474cb8] hover:bg-[#595ee4] text-white shadow-[0_0_12px_rgba(71,76,184,0.4)]'
          }`}
        >
          {isAnimating ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isAnimating ? 'Pause' : 'Animate'}</span>
        </button>

        {/* Reset Camera & Orbit */}
        <button
          onClick={onResetOrbit}
          className="px-3 py-2 bg-[#262c55] hover:bg-[#343b6e] text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          title="Reset camera and elements to preset baseline"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        {/* Divider */}
        <div className="w-[1px] h-6 bg-slate-700/60 mx-1 hidden sm:block" />

        {/* Camera Views */}
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'isometric', label: '3D Iso' },
              { id: 'polar', label: 'Polar' },
              { id: 'equatorial', label: 'Equator' },
              { id: 'chase', label: 'Chase' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => onSetCameraPreset(item.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                cameraPreset === item.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
