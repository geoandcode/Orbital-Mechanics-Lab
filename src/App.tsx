import React, { useState, useMemo, useCallback } from 'react';
import { KeplerianElements } from './types/orbit';
import { PRESETS, R_EARTH, calculateTelemetry } from './utils/astrodynamics';
import { OrbitalCanvas } from './components/OrbitalCanvas';
import { SidebarControls } from './components/SidebarControls';
import { HeaderWatermark } from './components/HeaderWatermark';
import { BottomControls } from './components/BottomControls';

export default function App() {
  const [activePresetId, setActivePresetId] = useState<string>('SENTINEL-1');
  const [elements, setElements] = useState<KeplerianElements>(() => ({
    ...PRESETS['SENTINEL-1'].elements,
  }));
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [epochSliderValue, setEpochSliderValue] = useState<number>(0);
  const [epochDate, setEpochDate] = useState<string>('2024-05-13');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<'isometric' | 'polar' | 'equatorial' | 'chase'>('isometric');

  // Earth Rotation & Animation Speed Multiplier
  const [isEarthSpinning, setIsEarthSpinning] = useState<boolean>(true);
  const [animSpeedMultiplier, setAnimSpeedMultiplier] = useState<number>(1);

  // Astrodynamic Frame Visual Layers
  const [showEquator, setShowEquator] = useState<boolean>(true);
  const [showPolarAxis, setShowPolarAxis] = useState<boolean>(true);
  const [showNodeLine, setShowNodeLine] = useState<boolean>(true);
  const [showPerigeeVector, setShowPerigeeVector] = useState<boolean>(true);

  // Active preset metadata
  const activePreset = useMemo(() => {
    return PRESETS[activePresetId] || PRESETS['SENTINEL-1'];
  }, [activePresetId]);

  // Real-time telemetry calculations
  const telemetry = useMemo(() => {
    return calculateTelemetry(elements);
  }, [elements]);

  // Select Preset Handler
  const handleSelectPreset = useCallback((presetKey: string) => {
    setActivePresetId(presetKey);
    const preset = PRESETS[presetKey];
    if (preset) {
      setElements({ ...preset.elements });
      setEpochSliderValue(0);
      setEpochDate('2024-05-13');
    }
  }, []);

  // True Anomaly Propagation Handler (from animation loop)
  const handleNuChange = useCallback((newNu: number) => {
    setElements((prev) => ({
      ...prev,
      nu: newNu,
    }));
  }, []);

  // Epoch Scrubber Handler (simulates RAAN J2 precession & COSMO-SkyMed lowering)
  const handleEpochScrub = useCallback((val: number) => {
    setEpochSliderValue(val);
    const pct = val / 100;
    const totalDays = 912; // May 13 2024 to Nov 11 2026
    const currentDays = pct * totalDays;
    
    const d = new Date('2024-05-13T00:00:00Z');
    d.setDate(d.getDate() + currentDays);
    setEpochDate(d.toISOString().substring(0, 10));

    const p = PRESETS[activePresetId];
    if (p && p.raanRate !== undefined && p.raanStart !== undefined) {
      // Calculate precessed RAAN
      const newRaan = (p.raanStart + currentDays * p.raanRate) % 360;

      // Check if COSMO-SkyMed orbit lowering in spring 2025 (day 330 to 400)
      let newA = p.elements.a;
      if (activePresetId === 'COSMO-SKYMED' && p.altStart && p.altEnd) {
        let alt = p.altStart;
        if (currentDays > 330 && currentDays < 400) {
          alt = p.altStart - ((currentDays - 330) / 70) * (p.altStart - p.altEnd);
        } else if (currentDays >= 400) {
          alt = p.altEnd;
        }
        newA = Math.round(R_EARTH + alt);
      }

      setElements((prev) => ({
        ...prev,
        raan: Math.round(newRaan),
        a: newA,
      }));
    }
  }, [activePresetId]);

  // Reset Orbit Handler
  const handleResetOrbit = useCallback(() => {
    const p = PRESETS[activePresetId];
    if (p) {
      setElements({ ...p.elements });
    }
    setEpochSliderValue(0);
    setEpochDate('2024-05-13');
    setCameraPreset('isometric');
  }, [activePresetId]);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col lg:flex-row bg-[#070814] text-white">
      {/* 3D Viewport Area */}
      <main className="relative flex-1 h-full min-h-[50vh] bg-[radial-gradient(ellipse_at_45%_50%,#151940_0%,#0a0c20_60%,#050610_100%)]">
        {/* Header Title & Watermark */}
        <HeaderWatermark
          badgeText={activePreset.badge}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Three.js Interactive Orbit Canvas */}
        <OrbitalCanvas
          elements={elements}
          activePresetId={activePresetId}
          isAnimating={isAnimating}
          orbitColor={activePreset.color}
          onNuChange={handleNuChange}
          showEquator={showEquator}
          showPolarAxis={showPolarAxis}
          showNodeLine={showNodeLine}
          showPerigeeVector={showPerigeeVector}
          cameraPreset={cameraPreset}
          isEarthSpinning={isEarthSpinning}
          animSpeedMultiplier={animSpeedMultiplier}
        />

        {/* Bottom Floating Control Bar */}
        <BottomControls
          isAnimating={isAnimating}
          onToggleAnimate={() => setIsAnimating((prev) => !prev)}
          onResetOrbit={handleResetOrbit}
          cameraPreset={cameraPreset}
          onSetCameraPreset={setCameraPreset}
          isEarthSpinning={isEarthSpinning}
          onToggleEarthSpin={() => setIsEarthSpinning((prev) => !prev)}
          animSpeedMultiplier={animSpeedMultiplier}
          onSetAnimSpeedMultiplier={setAnimSpeedMultiplier}
        />
      </main>

      {/* Right Control Sidebar */}
      {isSidebarOpen && (
        <aside className="w-full lg:w-[440px] h-[50vh] lg:h-full flex-shrink-0 animate-in slide-in-from-right duration-200">
          <SidebarControls
            elements={elements}
            onElementsChange={setElements}
            telemetry={telemetry}
            activePresetId={activePresetId}
            onSelectPreset={handleSelectPreset}
            epochDate={epochDate}
            epochSliderValue={epochSliderValue}
            onEpochScrub={handleEpochScrub}
            showEquator={showEquator}
            setShowEquator={setShowEquator}
            showPolarAxis={showPolarAxis}
            setShowPolarAxis={setShowPolarAxis}
            showNodeLine={showNodeLine}
            setShowNodeLine={setShowNodeLine}
            showPerigeeVector={showPerigeeVector}
            setShowPerigeeVector={setShowPerigeeVector}
          />
        </aside>
      )}
    </div>
  );
}
