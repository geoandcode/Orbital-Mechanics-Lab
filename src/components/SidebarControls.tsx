import React, { useState } from 'react';
import { KeplerianElements, OrbitalTelemetry, OrbitPreset } from '../types/orbit';
import { PRESETS, R_EARTH } from '../utils/astrodynamics';
import { 
  Satellite, 
  Clock, 
  Zap, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  HelpCircle,
  Sliders,
  Calendar,
  Layers
} from 'lucide-react';

interface SidebarControlsProps {
  elements: KeplerianElements;
  onElementsChange: (elements: KeplerianElements) => void;
  telemetry: OrbitalTelemetry;
  activePresetId: string;
  onSelectPreset: (presetId: string) => void;
  epochDate: string;
  epochSliderValue: number;
  onEpochScrub: (val: number) => void;
  showEquator: boolean;
  setShowEquator: (show: boolean) => void;
  showPolarAxis: boolean;
  setShowPolarAxis: (show: boolean) => void;
  showNodeLine: boolean;
  setShowNodeLine: (show: boolean) => void;
  showPerigeeVector: boolean;
  setShowPerigeeVector: (show: boolean) => void;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  elements,
  onElementsChange,
  telemetry,
  activePresetId,
  onSelectPreset,
  epochDate,
  epochSliderValue,
  onEpochScrub,
  showEquator,
  setShowEquator,
  showPolarAxis,
  setShowPolarAxis,
  showNodeLine,
  setShowNodeLine,
  showPerigeeVector,
  setShowPerigeeVector,
}) => {
  const [showDetailedTelemetry, setShowDetailedTelemetry] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showMissionBrief, setShowMissionBrief] = useState(false);

  const activePreset = PRESETS[activePresetId] || PRESETS['SENTINEL-1'];

  const handleElementSlider = (key: keyof KeplerianElements, val: number) => {
    onElementsChange({
      ...elements,
      [key]: val,
    });
  };

  return (
    <div className="w-full lg:w-[440px] h-full bg-gradient-to-b from-[#0e122b] to-[#090b1c] border-l border-[rgba(85,105,180,0.28)] flex flex-col p-5 md:p-6 gap-4 overflow-y-auto select-none z-20 text-white scrollbar-thin">
      
      {/* 1. Constellation / Regime Presets */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Satellite className="w-3.5 h-3.5 text-cyan-400" />
            Constellation Regimes
          </span>
          <button 
            onClick={() => setShowMissionBrief(!showMissionBrief)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1"
          >
            Mission Info
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-[#131735]/80 rounded-xl border border-[rgba(85,105,180,0.28)]">
          {(['SENTINEL-1', 'COSMO-SKYMED'] as const).map((key) => {
            const isSelected = activePresetId === key;
            const preset = PRESETS[key];
            return (
              <button
                key={key}
                onClick={() => onSelectPreset(key)}
                className={`py-2.5 px-3 text-center font-bold text-xs uppercase tracking-wide rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                  isSelected
                    ? 'bg-[#5154c6] text-white border border-blue-400/50 shadow-[0_0_12px_rgba(81,84,198,0.5)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <span>{key === 'COSMO-SKYMED' ? 'COSMO-SkyMed' : 'Sentinel-1'}</span>
                <span className="text-[9px] font-normal opacity-75">
                  {key === 'COSMO-SKYMED' ? 'ASI X-Band SAR' : 'ESA C-Band SAR'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mission Brief Dropdown if active */}
      {showMissionBrief && (
        <div className="bg-[#121639] border border-cyan-500/30 rounded-xl p-3.5 text-xs text-slate-300 flex flex-col gap-2 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between font-bold text-cyan-300">
            <span>{activePreset.badge}</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/40">
              {activePreset.agency}
            </span>
          </div>
          <p className="leading-relaxed text-slate-300 text-[11px]">
            {activePreset.description}
          </p>
          {activePreset.sensorType && (
            <div className="text-[10px] text-slate-400 border-t border-slate-700/50 pt-1.5 flex items-center justify-between">
              <span>Payload Sensor:</span>
              <span className="font-mono text-cyan-200">{activePreset.sensorType}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. Mission Epoch Scrubber (Historical Sentinel-1 & COSMO-SkyMed ephemeris) */}
      <div className="bg-[#262c55]/30 border border-[rgba(85,105,180,0.3)] p-3 rounded-xl flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-cyan-400 font-bold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Mission Epoch Scrubber
          </span>
          <span className="font-mono text-xs font-bold text-white bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/60">
            {epochDate}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={epochSliderValue}
          onChange={(e) => onEpochScrub(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-cyan-400 my-1"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>May 2024</span>
          <span>{activePresetId === 'COSMO-SKYMED' ? 'Spring 2025: Orbit Lowering' : 'Nodal Precession'}</span>
          <span>Nov 2026</span>
        </div>
      </div>

      {/* 3. The 6 Keplerian Elements Sliders */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Keplerian Orbital Elements
          </span>
        </div>

        {/* Semi-major axis (a) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Semi-major axis (a)</span>
            <span className="font-mono font-bold text-white">
              {Math.round(elements.a).toLocaleString()} km
            </span>
          </div>
          <input
            type="range"
            min={6500}
            max={42164}
            step={10}
            value={elements.a}
            onChange={(e) => handleElementSlider('a', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>LEO (6,500 km)</span>
            <span>Max (42,164 km)</span>
          </div>
        </div>

        {/* Eccentricity (e) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Eccentricity (e)</span>
            <span className="font-mono font-bold text-white">
              {elements.e.toFixed(4)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.75}
            step={0.0001}
            value={elements.e}
            onChange={(e) => handleElementSlider('e', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.0000 (Circular)</span>
            <span>0.7500 (Highly Elliptical)</span>
          </div>
        </div>

        {/* Inclination (i) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Inclination (i)</span>
            <span className="font-mono font-bold text-white">
              {Math.round(elements.i)}°
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={180}
            step={0.1}
            value={elements.i}
            onChange={(e) => handleElementSlider('i', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0° (Equatorial)</span>
            <span>90° (Polar)</span>
            <span>180° (Retrograde)</span>
          </div>
        </div>

        {/* RAAN (Omega) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Right Ascension of Asc. Node (&Omega;)</span>
            <span className="font-mono font-bold text-white">
              {Math.round(elements.raan)}°
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={elements.raan}
            onChange={(e) => handleElementSlider('raan', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
        </div>

        {/* Argument of Perigee (omega) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Arg. of perigee (&omega;)</span>
            <span className="font-mono font-bold text-white">
              {Math.round(elements.aop)}°
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={elements.aop}
            onChange={(e) => handleElementSlider('aop', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
        </div>

        {/* True Anomaly (nu) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span className="text-cyan-300 font-medium">True anomaly (&nu;)</span>
            <span className="font-mono font-bold text-cyan-300">
              {Math.round(elements.nu)}°
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={elements.nu}
            onChange={(e) => handleElementSlider('nu', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#262c55] rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      {/* 4. Telemetry Metrics Cards (2x2 Grid) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Live Orbital Telemetry
          </span>
          <button
            onClick={() => setShowDetailedTelemetry(!showDetailedTelemetry)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            {showDetailedTelemetry ? 'Less' : 'More Stats'}
            {showDetailedTelemetry ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#131735] border border-[rgba(85,105,180,0.28)] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] tracking-wider text-slate-400 font-bold uppercase">
              Period
            </span>
            <span className="text-xl font-bold font-mono text-white">
              {telemetry.periodHours >= 2
                ? `${telemetry.periodHours.toFixed(2)} h`
                : `${telemetry.periodMinutes.toFixed(1)} m`}
            </span>
          </div>

          <div className="bg-[#131735] border border-[rgba(85,105,180,0.28)] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] tracking-wider text-slate-400 font-bold uppercase">
              Perigee Altitude
            </span>
            <span className="text-xl font-bold font-mono text-white">
              {Math.round(telemetry.rPerigeeAltKm).toLocaleString()} km
            </span>
          </div>

          <div className="bg-[#131735] border border-[rgba(85,105,180,0.28)] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] tracking-wider text-slate-400 font-bold uppercase">
              Apogee Altitude
            </span>
            <span className="text-xl font-bold font-mono text-white">
              {Math.round(telemetry.rApogeeAltKm).toLocaleString()} km
            </span>
          </div>

          <div className="bg-[#131735] border border-[rgba(85,105,180,0.28)] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] tracking-wider text-slate-400 font-bold uppercase">
              Speed at Perigee
            </span>
            <span className="text-xl font-bold font-mono text-cyan-300">
              {telemetry.vPerigeeKmS.toFixed(2)} km/s
            </span>
          </div>
        </div>

        {/* Detailed Expanded Telemetry */}
        {showDetailedTelemetry && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-700/40 text-xs text-slate-300 font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Current Altitude</span>
              <span className="text-white font-bold">{Math.round(telemetry.currentAltKm).toLocaleString()} km</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Current Velocity</span>
              <span className="text-cyan-300 font-bold">{telemetry.currentSpeedKmS.toFixed(2)} km/s</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Specific Energy (&epsilon;)</span>
              <span className="text-white font-bold">{telemetry.specificEnergyMjKg.toFixed(1)} MJ/kg</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Regime</span>
              <span className="text-indigo-300 font-bold text-[11px] truncate block">{telemetry.orbitClassification}</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Reference Frame Display Toggles */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Astrodynamic Reference Frames
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => setShowEquator(!showEquator)}
            className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              showEquator ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}
          >
            <span>Equator Plane</span>
            <div className={`w-2 h-2 rounded-full ${showEquator ? 'bg-indigo-400' : 'bg-slate-700'}`} />
          </button>

          <button
            onClick={() => setShowPolarAxis(!showPolarAxis)}
            className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              showPolarAxis ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}
          >
            <span>Polar Z-Axis</span>
            <div className={`w-2 h-2 rounded-full ${showPolarAxis ? 'bg-indigo-400' : 'bg-slate-700'}`} />
          </button>

          <button
            onClick={() => setShowNodeLine(!showNodeLine)}
            className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              showNodeLine ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}
          >
            <span>Line of Nodes (&Omega;)</span>
            <div className={`w-2 h-2 rounded-full ${showNodeLine ? 'bg-cyan-400' : 'bg-slate-700'}`} />
          </button>

          <button
            onClick={() => setShowPerigeeVector(!showPerigeeVector)}
            className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              showPerigeeVector ? 'bg-amber-950/60 border-amber-500/50 text-amber-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}
          >
            <span>Perigee Vector</span>
            <div className={`w-2 h-2 rounded-full ${showPerigeeVector ? 'bg-amber-400' : 'bg-slate-700'}`} />
          </button>
        </div>
      </div>

      {/* 6. Mathematical Formula Card & Explainer */}
      <div 
        onClick={() => setShowFormulaModal(true)}
        className="mt-auto bg-[#131735]/60 hover:bg-[#131735] border border-[rgba(85,105,180,0.28)] rounded-xl p-3 text-center cursor-pointer transition-colors group"
      >
        <div className="font-serif text-sm text-indigo-200 tracking-wide">
          T = 2&pi; &radic;(a&sup3; / &mu;) &nbsp;&middot;&nbsp; r = a(1 &minus; e cos E)
        </div>
        <div className="text-[10px] text-slate-500 group-hover:text-cyan-400 transition-colors mt-1">
          Click to view Keplerian & Vis-Viva mechanics formulas &rarr;
        </div>
      </div>

      {/* Formula Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0f1430] border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-cyan-300">Astrodynamic Foundations & Equations</h3>
              <button 
                onClick={() => setShowFormulaModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-1">1. Kepler's Third Law (Orbital Period):</span>
                <p className="font-serif text-cyan-200 text-sm mb-1">T = 2&pi; &radic;(a&sup3; / &mu;)</p>
                <p className="text-slate-400">Where &mu; = 398,600.44 km&sup3;/s&sup2; is Earth's standard gravitational parameter, and a is the semi-major axis in km.</p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-1">2. Orbital Radius at True Anomaly (&nu;):</span>
                <p className="font-serif text-cyan-200 text-sm mb-1">r = a(1 - e&sup2;) / (1 + e &middot; cos(&nu;))</p>
                <p className="text-slate-400">Yields perigee r_p = a(1 - e) at &nu; = 0° and apogee r_a = a(1 + e) at &nu; = 180°.</p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-1">3. Vis-Viva Equation (Instantaneous Velocity):</span>
                <p className="font-serif text-cyan-200 text-sm mb-1">v&sup2; = &mu; ( 2/r - 1/a )</p>
                <p className="text-slate-400">Governs conservation of mechanical energy; velocity peaks at perigee and reaches minimum at apogee.</p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-white block mb-1">4. Sun-Synchronous J2 Nodal Precession:</span>
                <p className="font-serif text-cyan-200 text-sm mb-1">d&Omega;/dt = - (3/2) J&sub2; (R_E / p)&sup2; n &middot; cos(i)</p>
                <p className="text-slate-400">Earth oblateness causes the orbital plane to precess eastward at ~0.9856°/day, exactly matching Earth's mean orbital motion around the Sun for constant solar illumination geometry (used by Sentinel-1 & COSMO-SkyMed).</p>
              </div>
            </div>

            <button
              onClick={() => setShowFormulaModal(false)}
              className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl text-white text-xs"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
