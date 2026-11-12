import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { KeplerianElements } from '../types/orbit';
import { keplerianToCartesian, R_EARTH } from '../utils/astrodynamics';

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
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const onNuChangeRef = useRef(onNuChange);
  onNuChangeRef.current = onNuChange;

  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const isAnimatingRef = useRef(isAnimating);
  isAnimatingRef.current = isAnimating;

  const orbitColorRef = useRef(orbitColor);
  orbitColorRef.current = orbitColor;

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
  const globeMeshRef = useRef<THREE.Mesh | null>(null);
  const satMeshRef = useRef<THREE.Group | null>(null);
  const orbitLineMeshRef = useRef<THREE.LineLoop | null>(null);
  const orbitArcMeshRef = useRef<THREE.Line | null>(null);
  const equatorialRingRef = useRef<THREE.Line | null>(null);
  const polarAxisRef = useRef<THREE.Group | null>(null);
  const nodeLineRef = useRef<THREE.Line | null>(null);
  const perigeeVectorRef = useRef<THREE.Line | null>(null);
  const arcMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const satGlowMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Procedural Earth Texture
  const createProceduralEarthTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Ocean Base Gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#060e22');
    oceanGrad.addColorStop(0.2, '#091536');
    oceanGrad.addColorStop(0.5, '#0b1a44');
    oceanGrad.addColorStop(0.8, '#091536');
    oceanGrad.addColorStop(1, '#060e22');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle ocean currents & bathymetry rings
    ctx.fillStyle = 'rgba(20, 45, 95, 0.45)';
    ctx.beginPath();
    ctx.ellipse(500, 500, 350, 180, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1500, 520, 320, 160, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lat / Long Coordinate Grid
    ctx.strokeStyle = 'rgba(65, 105, 210, 0.22)';
    ctx.lineWidth = 1.0;
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = ((90 - lat) / 180) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Highlighted Equator line
    ctx.strokeStyle = 'rgba(56, 239, 239, 0.4)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Stylized high-visibility landmasses
    ctx.fillStyle = 'rgba(25, 48, 105, 0.94)';
    ctx.strokeStyle = 'rgba(92, 168, 255, 0.9)';
    ctx.lineWidth = 2.2;

    const drawLand = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * canvas.width;
        const y = ((90 - lat) / 180) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // Africa & Madagascar
    drawLand([[-17, 35], [-5, 36], [10, 37], [30, 32], [51, 12], [42, -12], [35, -24], [28, -34], [18, -34], [12, -18], [10, 5], [-17, 15], [-17, 35]]);
    drawLand([[44, -12], [50, -15], [47, -25], [43, -24], [44, -12]]);

    // Europe & Mediterranean
    drawLand([[-9, 36], [-9, 43], [0, 49], [2, 51], [10, 55], [25, 71], [32, 69], [40, 65], [38, 45], [30, 42], [20, 38], [5, 36], [-5, 36], [-9, 36]]);
    // British Isles
    drawLand([[-6, 50], [1, 52], [0, 58], [-5, 58], [-6, 50]]);

    // Asia & India
    drawLand([[35, 40], [45, 50], [60, 60], [80, 72], [100, 75], [130, 73], [170, 66], [165, 55], [140, 35], [120, 30], [108, 12], [92, 22], [80, 8], [72, 20], [60, 25], [55, 25], [35, 40]]);
    // Japan
    drawLand([[130, 32], [140, 36], [142, 44], [139, 42], [130, 32]]);

    // North America
    drawLand([[-165, 65], [-140, 70], [-95, 72], [-75, 60], [-55, 50], [-65, 42], [-75, 25], [-82, 25], [-97, 26], [-105, 20], [-115, 30], [-124, 38], [-124, 48], [-165, 65]]);
    // Greenland
    drawLand([[-50, 60], [-20, 70], [-25, 82], [-55, 82], [-50, 60]]);

    // South America
    drawLand([[-80, 10], [-60, 10], [-35, -5], [-35, -12], [-40, -22], [-55, -54], [-68, -54], [-75, -48], [-72, -30], [-80, -2], [-80, 10]]);

    // Australia & New Zealand
    drawLand([[115, -22], [130, -14], [145, -11], [150, -18], [152, -38], [138, -36], [115, -34], [115, -22]]);
    drawLand([[168, -36], [178, -38], [172, -45], [168, -36]]);

    // Antarctica fringe
    drawLand([[-180, -78], [180, -78], [180, -88], [-180, -88], [-180, -78]]);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  // Build a realistic procedural Satellite Group (3D bus + solar panels + SAR radar antenna)
  const createProceduralSatellite = () => {
    const satGroup = new THREE.Group();

    // 1. Satellite Central Bus Chassis (Gold Kapton insulation finish)
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

    // 3. Synthetic Aperture Radar (SAR) Antenna Planar Array (Long radar boom representing Sentinel-1 / COSMO-SkyMed)
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

  // Update Orbit lines and satellite position
  const updateOrbitalGeometry = useCallback(() => {
    if (!orbitLineMeshRef.current || !orbitArcMeshRef.current || !satMeshRef.current) return;
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

    // 2. Update Active Glowing Arc (trailing behind satellite)
    const arcPositions = orbitArcMeshRef.current.geometry.attributes.position.array as Float32Array;
    const arcSegments = 64;
    const nuRad = (elem.nu * Math.PI) / 180;
    const arcSpan = Math.PI * 0.75; // 135 deg trail
    for (let j = 0; j < arcSegments; j++) {
      const theta = nuRad - arcSpan * (1 - j / (arcSegments - 1));
      const pt = keplerianToCartesian(elem, theta, EARTH_GRAPHIC_R);
      arcPositions[j * 3] = pt.x;
      arcPositions[j * 3 + 1] = pt.y;
      arcPositions[j * 3 + 2] = pt.z;
    }
    orbitArcMeshRef.current.geometry.attributes.position.needsUpdate = true;

    // 3. Update Satellite Mesh Transform & Nadir orientation
    const currentPt = keplerianToCartesian(elem, nuRad, EARTH_GRAPHIC_R);
    satMeshRef.current.position.set(currentPt.x, currentPt.y, currentPt.z);

    // Orient satellite so instrument points down towards Earth center (0,0,0)
    satMeshRef.current.lookAt(0, 0, 0);

    // 4. Update Ascending Node Vector (RAAN vector in equatorial plane)
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

    // 5. Update Perigee Vector (pointing towards perigee)
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

    // 6. Update Color
    if (arcMaterialRef.current) {
      arcMaterialRef.current.color.set(orbitColorRef.current);
    }
    if (satGlowMatRef.current) {
      satGlowMatRef.current.color.set(orbitColorRef.current);
    }

    // 7. Calculate 2D Screen Space HUD tracking coordinates
    if (cameraRef.current && mountRef.current) {
      const satVec = satMeshRef.current.position.clone();
      satVec.project(cameraRef.current);
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      const screenX = ((satVec.x + 1) / 2) * width;
      const screenY = ((-satVec.y + 1) / 2) * height;

      // Only display if satellite is in front of camera plane
      const isVisible = satVec.z < 1.0;
      setHudLabel({
        x: screenX,
        y: screenY,
        visible: isVisible,
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
  }, [elements, orbitColor, updateOrbitalGeometry]);

  // Visibility toggles
  useEffect(() => {
    if (equatorialRingRef.current) equatorialRingRef.current.visible = showEquator;
    if (polarAxisRef.current) polarAxisRef.current.visible = showPolarAxis;
    if (nodeLineRef.current) nodeLineRef.current.visible = showNodeLine;
    if (perigeeVectorRef.current) perigeeVectorRef.current.visible = showPerigeeVector;
  }, [showEquator, showPolarAxis, showNodeLine, showPerigeeVector]);

  // Initialize Three.js scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL as instructed by skill
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
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5.5;
    controls.maxDistance = 65;
    controlsRef.current = controls;

    // Ambient and Directional Lights
    const ambientLight = new THREE.AmbientLight(0x7588b8, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(25, 14, 18);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x4060aa, 0.8);
    fillLight.position.set(-20, -10, -15);
    scene.add(fillLight);

    // Procedural Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 220;
      starPositions[i + 1] = (Math.random() - 0.5) * 220;
      starPositions[i + 2] = (Math.random() - 0.5) * 220;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x9fb4dc,
      size: 0.65,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Earth Globe
    const earthTexture = createProceduralEarthTexture();
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earthGeo = new THREE.SphereGeometry(EARTH_GRAPHIC_R, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      specular: 0x243b6b,
      shininess: 22,
    });
    const globe = new THREE.Mesh(earthGeo, earthMat);
    globeMeshRef.current = globe;
    scene.add(globe);

    // Atmospheric Glow
    const atmoGeo = new THREE.SphereGeometry(EARTH_GRAPHIC_R * 1.026, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4aa6ff,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Polar Rotational Z-Axis Group
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
    const sat = createProceduralSatellite();
    satMeshRef.current = sat;
    scene.add(sat);

    // Resize Observer
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Initial Geometry Setup
    updateOrbitalGeometry();

    // Animation Render Loop
    let animFrameId: number;
    const renderLoop = () => {
      animFrameId = requestAnimationFrame(renderLoop);

      // Rotate Earth slowly on its axis
      if (globeMeshRef.current) {
        globeMeshRef.current.rotation.y += 0.0006;
      }

      // Propagate satellite motion along true anomaly when animated
      if (isAnimatingRef.current) {
        const nextNu = (elementsRef.current.nu + 0.65) % 360;
        onNuChangeRef.current(nextNu);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    renderLoop();

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
  }, [createProceduralSatellite, updateOrbitalGeometry]);

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
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38efef]" />
          <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-200 bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/30">
            {hudLabel.text}
          </span>
        </div>
      )}
    </div>
  );
};
