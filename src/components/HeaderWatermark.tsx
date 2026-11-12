import React from 'react';
import { Orbit, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface HeaderWatermarkProps {
  badgeText: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const HeaderWatermark: React.FC<HeaderWatermarkProps> = ({
  badgeText,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  return (
    <div className="absolute top-5 left-5 right-5 flex items-center justify-between pointer-events-none z-10">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-slate-950/70 border border-slate-700/40 backdrop-blur-sm px-3.5 py-2 rounded-xl pointer-events-auto shadow-lg">
        <div className="flex items-center gap-2">
          <Orbit className="w-5 h-5 text-cyan-400 animate-spin-slow" />
          <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-white/90">
            Stefan Ackermann's Orbital Mechanics Lab
          </span>
        </div>
        <span className="text-[11px] font-semibold bg-cyan-500/15 border border-cyan-400 text-cyan-300 px-2.5 py-0.5 rounded-full w-fit">
          {badgeText}
        </span>
      </div>

      {/* Toggle Sidebar Button for Viewer Mode */}
      <button
        onClick={onToggleSidebar}
        className="pointer-events-auto bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition-all"
        title={isSidebarOpen ? "Collapse sidebar (Viewer Mode)" : "Expand sidebar"}
      >
        {isSidebarOpen ? (
          <>
            <PanelRightClose className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Viewer Mode</span>
          </>
        ) : (
          <>
            <PanelRightOpen className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Show Controls</span>
          </>
        )}
      </button>
    </div>
  );
};
