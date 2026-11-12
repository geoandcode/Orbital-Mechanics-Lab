import * as THREE from 'three';
import { mesh, feature } from 'topojson-client';
import type { Topology, Objects } from 'topojson-specification';
import type { MultiLineString, FeatureCollection, GeometryCollection } from 'geojson';
import worldData from 'world-atlas/countries-110m.json';

// Helper to convert geographic (lat, lon) in degrees to 3D Cartesian on a sphere
// Matches Three.js SphereGeometry UV orientation
export function latLonToSphere(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Generates high-resolution 2D procedural Earth texture mapped with actual
 * Natural Earth shapefile boundaries and landmasses.
 */
export function createRealEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const topo = worldData as unknown as Topology<Objects>;

  // 1. Ocean Base Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGrad.addColorStop(0, '#040b1e');
  oceanGrad.addColorStop(0.2, '#071333');
  oceanGrad.addColorStop(0.5, '#0b1c47');
  oceanGrad.addColorStop(0.8, '#071333');
  oceanGrad.addColorStop(1, '#040b1e');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle bathymetry swirls
  ctx.fillStyle = 'rgba(18, 42, 92, 0.4)';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.28, canvas.height * 0.48, 380, 220, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.72, canvas.height * 0.52, 420, 240, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // 2. Lat / Long Coordinate Graticule Lines
  ctx.strokeStyle = 'rgba(56, 100, 200, 0.22)';
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
  ctx.strokeStyle = 'rgba(56, 239, 239, 0.45)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // Highlighted Prime Meridian
  ctx.strokeStyle = 'rgba(56, 239, 239, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();

  // 3. Draw Actual Landmass Polygons from Natural Earth TopoJSON
  try {
    const landFeature = feature(topo, topo.objects.land) as any;
    const geometries = landFeature.features
      ? landFeature.features.map((f: any) => f.geometry)
      : [landFeature.geometry || landFeature];

    ctx.fillStyle = '#142754'; // Land fill
    ctx.strokeStyle = '#3878dd'; // Coastline stroke
    ctx.lineWidth = 1.5;

    geometries.forEach((geom: any) => {
      if (!geom) return;
      const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];

      polys.forEach((poly: any) => {
        if (!poly || !Array.isArray(poly)) return;
        ctx.beginPath();
        poly.forEach((ring: [number, number][]) => {
          if (!Array.isArray(ring)) return;
          ring.forEach(([lon, lat], i) => {
            const x = ((lon + 180) / 360) * canvas.width;
            const y = ((90 - lat) / 180) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    });

    // 4. Country Borders from TopoJSON
    const borderMesh = mesh(topo, topo.objects.countries, (a, b) => a !== b) as MultiLineString;
    if (borderMesh && borderMesh.coordinates) {
      ctx.strokeStyle = 'rgba(75, 120, 210, 0.4)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      borderMesh.coordinates.forEach((line) => {
        line.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * canvas.width;
          const y = ((90 - lat) / 180) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      });
      ctx.stroke();
    }
  } catch (err) {
    console.error('Error drawing Natural Earth shapefile on canvas:', err);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates 3D draped vector coastline lines and country borders from Natural Earth shapefile data.
 * Positioned at radius slightly above Earth's surface to eliminate Z-fighting.
 */
export function createDrapedCoastlineMesh(radius: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'drapedBoundaries';

  const topo = worldData as unknown as Topology<Objects>;

  // 1. Coastlines LineSegments
  try {
    const coastMesh = mesh(topo, topo.objects.land) as MultiLineString;
    if (coastMesh && coastMesh.coordinates) {
      const positions: number[] = [];
      const drapedR = radius * 1.0025; // 0.25% elevation above sphere surface

      coastMesh.coordinates.forEach((ring) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const [lon1, lat1] = ring[i];
          const [lon2, lat2] = ring[i + 1];

          // Skip antimeridian wrapping jumps
          if (Math.abs(lon1 - lon2) > 180) continue;

          const p1 = latLonToSphere(lat1, lon1, drapedR);
          const p2 = latLonToSphere(lat2, lon2, drapedR);

          positions.push(p1.x, p1.y, p1.z);
          positions.push(p2.x, p2.y, p2.z);
        }
      });

      const coastGeo = new THREE.BufferGeometry();
      coastGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const coastMat = new THREE.LineBasicMaterial({
        color: 0x5cd3ff, // Glowing cyan coastline
        transparent: true,
        opacity: 0.85,
        linewidth: 1.5,
      });
      const coastLines = new THREE.LineSegments(coastGeo, coastMat);
      group.add(coastLines);
    }
  } catch (err) {
    console.error('Error creating 3D coastline mesh:', err);
  }

  // 2. International Country Borders LineSegments
  try {
    const borderMesh = mesh(topo, topo.objects.countries, (a, b) => a !== b) as MultiLineString;
    if (borderMesh && borderMesh.coordinates) {
      const borderPositions: number[] = [];
      const borderR = radius * 1.002;

      borderMesh.coordinates.forEach((line) => {
        for (let i = 0; i < line.length - 1; i++) {
          const [lon1, lat1] = line[i];
          const [lon2, lat2] = line[i + 1];

          if (Math.abs(lon1 - lon2) > 180) continue;

          const p1 = latLonToSphere(lat1, lon1, borderR);
          const p2 = latLonToSphere(lat2, lon2, borderR);

          borderPositions.push(p1.x, p1.y, p1.z);
          borderPositions.push(p2.x, p2.y, p2.z);
        }
      });

      const borderGeo = new THREE.BufferGeometry();
      borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x3d6ebd, // Subtle navy/blue political borders
        transparent: true,
        opacity: 0.45,
      });
      const borderLines = new THREE.LineSegments(borderGeo, borderMat);
      group.add(borderLines);
    }
  } catch (err) {
    console.error('Error creating 3D border mesh:', err);
  }

  return group;
}
