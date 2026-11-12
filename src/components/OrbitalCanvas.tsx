import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { KeplerianElements } from '../types/orbit';
import { keplerianToCartesian } from '../utils/astrodynamics';
import { createRealEarthTexture, createDrapedCoastlineMesh } from '../utils/earthBoundaries';

interface OrbitalCanvasProps {
  elements: KeplerianElements;
  activePresetId: string;
  isAnimating: boolean;
  orbitColor: string;
  onNuChange: (newNu: number) => void;
  showEquator: boolean;
  showPolarAxis: boolean;
  showNodeLine: boolean;
  showPerigeeVector: boolean;
  cameraPreset: 'isometric' | 'polar' | 'equatorial' | 'chase';
  isEarthSpinning: boolean;
  animSpeedMultiplier: number;
}

const EARTH_GRAPHIC_R = 4.0;

export const OrbitalCanvas: React.FC<OrbitalCanvasProps> = ({
  elements,
  activePresetId,
  isAnimating,
  orbitColor,
  onNuChange,
  showEquator,
  showPolarAxis,
  showNodeLine,
  showPerigeeVector,
  cameraPreset,
  isEarthSpinning,
  animSpeedMultiplier,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Stable refs for values used inside animation loop
  const onNuChangeRef = useRef(onNuChange);
  onNuChangeRef.current = onNuChange;

  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const isAnimatingRef = useRef(isAnimating);
  isAnimatingRef.current = isAnimating;

  const isEarthSpinningRef = useRef(isEarthSpinning);
  isEarthSpinningRef.current = isEarthSpinning;

  const animSpeedMultiplierRef = useRef(animSpeedMultiplier);
  animSpeedMultiplierRef.current = animSpeedMultiplier;

  const orbitColorRef = useRef(orbitColor);
  orbitColorRef.current = orbitColor;

  // Internal true anomaly tracker for silky smooth 60 FPS animation
  const currentNuRef = useRef(elements.nu);

  // Synchronize internal true anomaly when externally changed (e.g. slider dragged or preset selected)
  useEffect(() => {
    // Only sync if difference is significant to avoid fighting active animation loop
    if (Math.abs(currentNuRef.current - elements.nu) > 1.0 && !isAnimatingRef.current) {
      currentNuRef.current = elements.nu;
    }
  }, [elements.nu]);

  // HUD 2D label coordinates
  const [hudLabel, setHudLabel] = useState<{ x: number; y: number; visible: boolean; text: string }>({
    x: 0,
    y: 0,
    visible: false,
    text: activePresetId,
  });

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const satMeshRef = useRef<THREE.Group | null>(null);
  const orbitLineMeshRef = useRef<THREE.LineLoop | null>(null);
  const orbitArcMeshRef = useRef<THREE.Line | null>(null);
  const equatorialRingRef = useRef<THREE.Line | null>(null);
  const polarAxisRef = useRef<THREE.Group | null>(null);
  const nodeLineRef = useRef<THREE.Line | null>(null);
  const perigeeVectorRef = useRef<THREE.Line | null>(null);
  const arcMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const satGlowMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Procedural Satellite 3D Group (chassis + solar panels + SAR radar antenna)
  const buildSatelliteMesh = () => {
    const satGroup = new THREE.Group();

    // 1. Satellite Central Bus Chassis (Gold Kapton thermal insulation finish)
    const busGeo = new THREE.BoxGeometry(0.35, 0.45, 0.35);
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xdfab32, // Gold foil
      roughness: 0.25,
      metalness: 0.85,
    });
    const busMesh = new THREE.Mesh(busGeo, busMat);
    satGroup.add(busMesh);

    // 2. Nadir-facing instrument sensor head (silver/chrome lens)
    const lensGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.15, 16);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e8,
      roughness: 0.2,
      metalness: 0.9,
    });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.rotation.x = Math.PI / 2;
    lensMesh.position.set(0, 0, 0.22);
    satGroup.add(lensMesh);

    // 3. Synthetic Aperture Radar (SAR) Antenna Planar Array
    const sarAntennaGeo = new THREE.BoxGeometry(0.12, 0.95, 0.04);
    const sarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.4,
    });
    const sarMesh = new THREE.Mesh(sarAntennaGeo, sarMat);
    sarMesh.position.set(0, 0, 0.28);
    satGroup.add(sarMesh);

    // 4. Solar Array Wings (Left and Right Photovoltaic panels)
    const solarWingGeo = new THREE.BoxGeometry(0.85, 0.3, 0.03);
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x112855,
      roughness: 0.2,
      metalness: 0.7,
    });

    const leftWing = new THREE.Mesh(solarWingGeo, solarMat);
    leftWing.position.set(-0.62, 0, 0);
    satGroup.add(leftWing);

    const rightWing = new THREE.Mesh(solarWingGeo, solarMat);
    rightWing.position.set(0.62, 0, 0);
    satGroup.add(rightWing);

    // Connecting solar booms
    const boomGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
    const boomMat = new THREE.MeshBasicMaterial({ color: 0x8899aa });
    const leftBoom = new THREE.Mesh(boomGeo, boomMat);
    leftBoom.rotation.z = Math.PI / 2;
    leftBoom.position.set(-0.24, 0, 0);
    satGroup.add(leftBoom);

    const rightBoom = new THREE.Mesh(boomGeo, boomMat);
    rightBoom.rotation.z = Math.PI / 2;
    rightBoom.position.set(0.24, 0, 0);
    satGroup.add(rightBoom);

    // 5. Outer Soft Beacon Glow Sphere
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38efef,
      transparent: true,
      opacity: 0.4,
    });
    satGlowMatRef.current = haloMat;
    const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), haloMat);
    satGroup.add(haloMesh);

    return satGroup;
  };

  // Synchronize 3D camera to requested viewpoint preset
  const applyCameraPreset = useCallback((preset: 'isometric' | 'polar' | 'equatorial' | 'chase') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const controls = controlsRef.current;

    if (preset === 'isometric') {
      cam.position.set(13, 7, 14);
      controls.target.set(0, 0, 0);
    } else if (preset === 'polar') {
      cam.position.set(0, 22, 0.01);
      controls.target.set(0, 0, 0);
    } else if (preset === 'equatorial') {
      cam.position.set(20, 0.5, 0);
      controls.target.set(0, 0, 0);
    } else if (preset === 'chase' && satMeshRef.current) {
      const p = satMeshRef.current.position;
      cam.position.set(p.x * 1.8, p.y * 1.8 + 2, p.z * 1.8 + 2);
      controls.target.copy(p);
    }
    controls.update();
  }, []);

  // Update Orbit Ellipse Geometry and Node vectors (called when Keplerian elements change)
  const updateOrbitalGeometry = useCallback(() => {
    if (!orbitLineMeshRef.current || !satMeshRef.current) return;
    const elem = elementsRef.current;

    // 1. Update Full Orbit Ellipse
    const fullPositions = orbitLineMeshRef.current.geometry.attributes.position.array as Float32Array;
    const segments = 256;
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const pt = keplerianToCartesian(elem, theta, EARTH_GRAPHIC_R);
      fullPositions[j * 3] = pt.x;
      fullPositions[j * 3 + 1] = pt.y;
      fullPositions[j * 3 + 2] = pt.z;
    }
    orbitLineMeshRef.current.geometry.attributes.position.needsUpdate = true;

    // 2. Update Ascending Node Vector (RAAN vector in equatorial plane)
    if (nodeLineRef.current) {
      const raanRad = (elem.raan * Math.PI) / 180;
      const nodeLength = EARTH_GRAPHIC_R * 2.1;
      const nodePositions = nodeLineRef.current.geometry.attributes.position.array as Float32Array;
      nodePositions[0] = 0;
      nodePositions[1] = 0;
      nodePositions[2] = 0;
      nodePositions[3] = nodeLength * Math.cos(raanRad);
      nodePositions[4] = 0;
      nodePositions[5] = -nodeLength * Math.sin(raanRad);
      nodeLineRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Update Perigee Vector (pointing towards perigee)
    if (perigeeVectorRef.current) {
      const perigeePt = keplerianToCartesian(elem, 0, EARTH_GRAPHIC_R);
      const periPositions = perigeeVectorRef.current.geometry.attributes.position.array as Float32Array;
      periPositions[0] = 0;
      periPositions[1] = 0;
      periPositions[2] = 0;
      periPositions[3] = perigeePt.x;
      periPositions[4] = perigeePt.y;
      periPositions[5] = perigeePt.z;
      perigeeVectorRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Update Colors
    if (arcMaterialRef.current) {
      arcMaterialRef.current.color.set(orbitColorRef.current);
    }
    if (satGlowMatRef.current) {
      satGlowMatRef.current.color.set(orbitColorRef.current);
    }
  }, []);

  // Update satellite position and trailing arc along trajectory at true anomaly nu
  const updateSatelliteAndArc = useCallback((nuDeg: number) => {
    if (!satMeshRef.current || !orbitArcMeshRef.current) return;
    const elem = elementsRef.current;
    const nuRad = (nuDeg * Math.PI) / 180;

    // 1. Satellite Mesh Transform & Real LVLH Flight Attitude (Zero polar gimbal flip)
    const currentPt = keplerianToCartesian(elem, nuRad, EARTH_GRAPHIC_R);
    satMeshRef.current.position.set(currentPt.x, currentPt.y, currentPt.z);

    // Calculate forward orbital velocity vector by sampling tangent at nu + delta
    const nextPt = keplerianToCartesian(elem, nuRad + 0.002, EARTH_GRAPHIC_R);
    const fwdVec = new THREE.Vector3(nextPt.x - currentPt.x, nextPt.y - currentPt.y, nextPt.z - currentPt.z).normalize();
    const nadirVec = new THREE.Vector3(-currentPt.x, -currentPt.y, -currentPt.z).normalize();
    
    // Orbital angular momentum vector (perpendicular to orbit plane)
    const normalVec = new THREE.Vector3().crossVectors(fwdVec, nadirVec).normalize();
    const trueNadir = new THREE.Vector3().crossVectors(normalVec, fwdVec).normalize();

    // Orthonormal basis: X = solar panel cross-axis, Y = velocity vector, Z = Nadir SAR antenna
    const rotMatrix = new THREE.Matrix4().makeBasis(normalVec, fwdVec, trueNadir);
    satMeshRef.current.quaternion.setFromRotationMatrix(rotMatrix);

    // 2. Active Glowing Arc (trailing behind satellite ~135 degrees)
    const arcPositions = orbitArcMeshRef.current.geometry.attributes.position.array as Float32Array;
    const arcSegments = 64;
    const arcSpan = Math.PI * 0.75;
    for (let j = 0; j < arcSegments; j++) {
      const theta = nuRad - arcSpan * (1 - j / (arcSegments - 1));
      const pt = keplerianToCartesian(elem, theta, EARTH_GRAPHIC_R);
      arcPositions[j * 3] = pt.x;
      arcPositions[j * 3 + 1] = pt.y;
      arcPositions[j * 3 + 2] = pt.z;
    }
    orbitArcMeshRef.current.geometry.attributes.position.needsUpdate = true;

    // 3. Update 2D Screen Space Tracking HUD Label
    if (cameraRef.current && mountRef.current) {
      const satVec = satMeshRef.current.position.clone();
      satVec.project(cameraRef.current);
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      const screenX = ((satVec.x + 1) / 2) * width;
      const screenY = ((-satVec.y + 1) / 2) * height;

      setHudLabel({
        x: screenX,
        y: screenY,
        visible: satVec.z < 1.0,
        text: activePresetId,
      });
    }
  }, [activePresetId]);

  // Handle camera preset changes
  useEffect(() => {
    applyCameraPreset(cameraPreset);
  }, [cameraPreset, applyCameraPreset]);

  // Synchronize when elements or colors change from outside
  useEffect(() => {
    updateOrbitalGeometry();
    updateSatelliteAndArc(elements.nu);
  }, [elements, orbitColor, updateOrbitalGeometry, updateSatelliteAndArc]);

  // Visibility toggles
  useEffect(() => {
    if (equatorialRingRef.current) equatorialRingRef.current.visible = showEquator;
    if (polarAxisRef.current) polarAxisRef.current.visible = showPolarAxis;
    if (nodeLineRef.current) nodeLineRef.current.visible = showNodeLine;
    if (perigeeVectorRef.current) perigeeVectorRef.current.visible = showPerigeeVector;
  }, [showEquator, showPolarAxis, showNodeLine, showPerigeeVector]);

  // Initialize Three.js scene ONCE on component mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Software WebGL detection guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(13, 7, 14);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5.2;
    controls.maxDistance = 65;
    controlsRef.current = controls;

    // Studio Lights
    const ambientLight = new THREE.AmbientLight(0x8294c4, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(25, 14, 18);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x4060aa, 0.9);
    fillLight.position.set(-20, -10, -15);
    scene.add(fillLight);

    // Procedural Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1400;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 240;
      starPositions[i + 1] = (Math.random() - 0.5) * 240;
      starPositions[i + 2] = (Math.random() - 0.5) * 240;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x9fb4dc,
      size: 0.65,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // =========================================================================
    // ROTATING EARTH GROUP: Globe + Draped Natural Earth Shapefile Boundaries
    // =========================================================================
    const globeGroup = new THREE.Group();
    globeGroup.name = 'rotatingEarthGroup';
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // 1. Earth textured sphere with Natural Earth shapefile land & ocean map
    const earthTexture = createRealEarthTexture();
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earthGeo = new THREE.SphereGeometry(EARTH_GRAPHIC_R, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      specular: 0x284277,
      shininess: 24,
    });
    const globeMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(globeMesh);

    // 2. Draped 3D Vector Coastlines & Country Boundaries from Natural Earth shapefiles
    const drapedBoundaries = createDrapedCoastlineMesh(EARTH_GRAPHIC_R);
    globeGroup.add(drapedBoundaries);

    // 3. Atmospheric Glow Layer
    const atmoGeo = new THREE.SphereGeometry(EARTH_GRAPHIC_R * 1.026, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4aa6ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    globeGroup.add(atmoMesh);

    // =========================================================================
    // INERTIAL REFERENCE FRAMES (Stationary in ECI frame)
    // =========================================================================
    // Polar Rotational Z-Axis
    const polarGroup = new THREE.Group();
    const zPts = [new THREE.Vector3(0, -6.8, 0), new THREE.Vector3(0, 6.8, 0)];
    const zGeo = new THREE.BufferGeometry().setFromPoints(zPts);
    const zMat = new THREE.LineDashedMaterial({
      color: 0x7e8cb8,
      dashSize: 0.28,
      gapSize: 0.2,
    });
    const zLine = new THREE.Line(zGeo, zMat);
    zLine.computeLineDistances();
    polarGroup.add(zLine);

    // "Z" Billboard Label
    const zLabelCanvas = document.createElement('canvas');
    zLabelCanvas.width = 64;
    zLabelCanvas.height = 64;
    const zCtx = zLabelCanvas.getContext('2d');
    if (zCtx) {
      zCtx.fillStyle = '#a6b5e2';
      zCtx.font = 'bold 36px monospace';
      zCtx.textAlign = 'center';
      zCtx.fillText('Z', 32, 44);
    }
    const zTex = new THREE.CanvasTexture(zLabelCanvas);
    const zSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex }));
    zSprite.position.set(0, 7.3, 0);
    zSprite.scale.set(0.9, 0.9, 1);
    polarGroup.add(zSprite);
    polarAxisRef.current = polarGroup;
    scene.add(polarGroup);

    // Equatorial Ring Reference
    const eqPts: THREE.Vector3[] = [];
    const eqR = EARTH_GRAPHIC_R * 1.6;
    for (let i = 0; i <= 128; i++) {
      const th = (i / 128) * Math.PI * 2;
      eqPts.push(new THREE.Vector3(eqR * Math.cos(th), 0, eqR * Math.sin(th)));
    }
    const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPts);
    const eqRing = new THREE.Line(
      eqGeo,
      new THREE.LineBasicMaterial({
        color: 0x3d4f82,
        transparent: true,
        opacity: 0.55,
      })
    );
    equatorialRingRef.current = eqRing;
    scene.add(eqRing);

    // Ascending Node Vector (RAAN vector from origin)
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    const nodeLine = new THREE.Line(
      nodeGeo,
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75 })
    );
    nodeLineRef.current = nodeLine;
    scene.add(nodeLine);

    // Perigee Vector
    const periGeo = new THREE.BufferGeometry();
    periGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    const periLine = new THREE.Line(
      periGeo,
      new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.75 })
    );
    perigeeVectorRef.current = periLine;
    scene.add(periLine);

    // Full Orbit Ellipse Line
    const orbGeom = new THREE.BufferGeometry();
    orbGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(256 * 3), 3));
    const orbitLine = new THREE.LineLoop(
      orbGeom,
      new THREE.LineBasicMaterial({
        color: 0x1f7c8f,
        transparent: true,
        opacity: 0.45,
      })
    );
    orbitLineMeshRef.current = orbitLine;
    scene.add(orbitLine);

    // Active Glowing Arc
    const arcGeom = new THREE.BufferGeometry();
    arcGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    const arcMat = new THREE.LineBasicMaterial({
      color: 0x38efef,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });
    arcMaterialRef.current = arcMat;
    const orbitArc = new THREE.Line(arcGeom, arcMat);
    orbitArcMeshRef.current = orbitArc;
    scene.add(orbitArc);

    // Procedural Satellite Group
    const sat = buildSatelliteMesh();
    satMeshRef.current = sat;
    scene.add(sat);

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Initial Orbital Setup
    updateOrbitalGeometry();
    updateSatelliteAndArc(currentNuRef.current);

    // =========================================================================
    // MAIN 60 FPS ANIMATION LOOP
    // =========================================================================
    let animFrameId: number;
    let lastUiSyncTime = 0;

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);

      // 1. Visibly and continuously rotate Earth around its polar axis
      if (isEarthSpinningRef.current && globeGroupRef.current) {
        // Smooth rotation rate (~0.003 rad/frame is ~10 deg/sec)
        globeGroupRef.current.rotation.y += 0.003;
      }

      // 2. High-speed, responsive satellite propagation
      if (isAnimatingRef.current) {
        // Base step is 2.2 deg/frame (yielding brisk ~2.7s period at 1x)
        const baseSpeed = 2.2;
        const deltaNu = baseSpeed * animSpeedMultiplierRef.current;
        currentNuRef.current = (currentNuRef.current + deltaNu) % 360;

        // Update 3D satellite position and arc directly on the GPU
        updateSatelliteAndArc(currentNuRef.current);

        // Throttle UI synchronization to 10Hz to prevent React state thrashing
        if (time - lastUiSyncTime > 100) {
          lastUiSyncTime = time;
          onNuChangeRef.current(Math.round(currentNuRef.current));
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // Run ONCE on mount!

  return (
    <div className="relative w-full h-full overflow-hidden select-none" ref={mountRef}>
      {/* 2D Satellite Tracking HUD Label */}
      {hudLabel.visible && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 flex items-center gap-1.5"
          style={{
            transform: `translate(${hudLabel.x + 14}px, ${hudLabel.y - 12}px)`,
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#38efef]" />
          <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-200 bg-slate-900/85 px-2.5 py-0.5 rounded border border-cyan-500/40 shadow-lg">
            {hudLabel.text}
          </span>
        </div>
      )}
    </div>
  );
};
