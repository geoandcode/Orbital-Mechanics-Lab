import { KeplerianElements, OrbitalTelemetry, OrbitPreset } from '../types/orbit';

export const R_EARTH = 6378.137;   // km (WGS-84 mean equatorial radius)
export const MU = 398600.4418;     // km^3 / s^2 (Earth's standard gravitational parameter)
export const J2 = 1.08263e-3;      // Earth oblateness zonal harmonic coefficient
export const EARTH_ROTATION_RATE = 7.2921159e-5; // rad/s

export const PRESETS: Record<string, OrbitPreset> = {
  'SENTINEL-1': {
    id: 'SENTINEL-1',
    name: 'SENTINEL-1',
    badge: 'Sentinel-1 (ESA Frozen SSO)',
    description: 'European Radar Observatory: Sun-synchronous dawn-dusk frozen orbit at 693 km altitude with a 12-day repeat cycle, C-band SAR imaging payload.',
    agency: 'ESA / Copernicus',
    sensorType: 'C-Band Synthetic Aperture Radar (SAR)',
    elements: {
      a: 6378.137 + 695.75, // ~7073.8 km
      e: 0.000138,
      i: 98.18,
      raan: 141.78,
      aop: 89.97,
      nu: 45,
    },
    color: '#38efef',
    altStart: 695.75,
    altEnd: 695.76,
    raanStart: 141.78,
    raanRate: 0.9856, // Sun-synchronous nodal precession (~0.9856 deg/day)
  },
  'COSMO-SKYMED': {
    id: 'COSMO-SKYMED',
    name: 'COSMO-SKYMED',
    badge: 'COSMO-SkyMed (ASI Orbit Lowering)',
    description: 'Italian X-band SAR constellation: Originally operating in 622.5 km orbit, lowered in 2025 to ~574 km for constellation coordination and phased retirement.',
    agency: 'ASI (Italian Space Agency) / MoD',
    sensorType: 'X-Band Synthetic Aperture Radar (SAR)',
    elements: {
      a: 6378.137 + 622.52, // ~7000.6 km
      e: 0.000160,
      i: 97.89,
      raan: 317.82,
      aop: 89.23,
      nu: 210,
    },
    color: '#ff9d00',
    altStart: 622.52,
    altEnd: 574.15,
    raanStart: 317.82,
    raanRate: 0.9856,
  },

  'ISS': {
    id: 'ISS',
    name: 'ISS (LEO)',
    badge: 'International Space Station',
    description: 'Low Earth Orbit crewed microgravity laboratory orbiting at ~420 km altitude with 51.6° orbital inclination, completing ~15.5 revolutions per day.',
    agency: 'NASA / ESA / JAXA / CSA',
    sensorType: 'Human Habitation & External Payloads',
    elements: {
      a: 6378.137 + 420.0, // ~6798.1 km
      e: 0.0006,
      i: 51.64,
      raan: 85.0,
      aop: 120.0,
      nu: 180,
    },
    color: '#60a5fa',
  },
  'MOLNIYA': {
    id: 'MOLNIYA',
    name: 'MOLNIYA',
    badge: 'Highly Elliptical Orbit (HEO)',
    description: 'Critical inclination (63.4°) freezing perigee drift, with high eccentricity (e=0.72) providing 8-hour dwell time over high northern latitudes per 12-hour period.',
    agency: 'High-Latitude Arctic Telecommunications',
    sensorType: 'Arctic Coverage Transponders',
    elements: {
      a: 26600,
      e: 0.72,
      i: 63.4,
      raan: 70.0,
      aop: 270.0,
      nu: 300,
    },
    color: '#f43f5e',
  }
};

/**
 * Calculates complete orbital telemetry from Keplerian elements
 */
export function calculateTelemetry(elements: KeplerianElements): OrbitalTelemetry {
  const { a, e, nu } = elements;
  const nuRad = (nu * Math.PI) / 180;

  // Period
  const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU);
  const periodHours = periodSec / 3600;
  const periodMinutes = periodSec / 60;

  // Perigee & Apogee radii and altitudes
  const rPerigeeKm = a * (1 - e);
  const rApogeeKm = a * (1 + e);
  const rPerigeeAltKm = Math.max(0, rPerigeeKm - R_EARTH);
  const rApogeeAltKm = Math.max(0, rApogeeKm - R_EARTH);

  // Current radius & altitude
  const currentRKm = (a * (1 - e * e)) / (1 + e * Math.cos(nuRad));
  const currentAltKm = Math.max(0, currentRKm - R_EARTH);

  // Velocities using Vis-Viva Equation: v^2 = GM * (2/r - 1/a)
  const vPerigeeKmS = Math.sqrt(MU * ((2 / rPerigeeKm) - (1 / a)));
  const vApogeeKmS = Math.sqrt(Math.max(0, MU * ((2 / rApogeeKm) - (1 / a))));
  const currentSpeedKmS = Math.sqrt(Math.max(0, MU * ((2 / currentRKm) - (1 / a))));

  // Specific Orbital Energy (epsilon = -mu / (2a)) in MJ/kg
  const specificEnergyMjKg = -MU / (2 * a);

  // Semi-minor axis b = a * sqrt(1 - e^2)
  const semiMinorAxisKm = a * Math.sqrt(Math.max(0, 1 - e * e));

  // Classification
  let orbitClassification = 'LEO (Low Earth Orbit)';
  if (rApogeeAltKm >= 35500 && rApogeeAltKm <= 36000 && e < 0.05 && elements.i < 5) {
    orbitClassification = 'GEO (Geostationary Orbit)';
  } else if (rApogeeAltKm >= 35000 && e < 0.05) {
    orbitClassification = 'GSO (Geosynchronous Orbit)';
  } else if (e >= 0.5) {
    orbitClassification = 'HEO (Highly Elliptical Orbit)';
  } else if (rPerigeeAltKm >= 2000 && rApogeeAltKm < 35786) {
    orbitClassification = 'MEO (Medium Earth Orbit)';
  } else if (elements.i >= 96 && elements.i <= 102 && rApogeeAltKm <= 1200) {
    orbitClassification = 'SSO (Sun-Synchronous Orbit)';
  }

  return {
    periodHours,
    periodMinutes,
    rPerigeeAltKm,
    rApogeeAltKm,
    vPerigeeKmS,
    vApogeeKmS,
    currentAltKm,
    currentSpeedKmS,
    specificEnergyMjKg,
    semiMinorAxisKm,
    orbitClassification,
  };
}

/**
 * Teaching compression curve: Compress distance scale so LEO, MEO, and GEO
 * can be inspected clearly alongside Earth without astronomical clipping.
 */
export function getScaledRadius(rKm: number, earthGraphicRadius: number): number {
  const alt = Math.max(10, rKm - R_EARTH);
  const scaledAlt = Math.pow(alt, 0.72) * 0.015;
  return earthGraphicRadius + Math.max(0.35, scaledAlt);
}

/**
 * Converts Keplerian orbital elements at true anomaly theta to 3D Cartesian coordinates (ECI frame).
 * In Three.js: +Y is Earth rotational North Pole, +X and +Z are equatorial plane.
 */
export function keplerianToCartesian(
  elements: KeplerianElements,
  thetaRad: number,
  earthGraphicRadius: number
): { x: number; y: number; z: number; rKm: number } {
  const { a, e, i, raan, aop } = elements;
  const incRad = (i * Math.PI) / 180;
  const raanRad = (raan * Math.PI) / 180;
  const aopRad = (aop * Math.PI) / 180;

  // Orbit radius in km
  const rKm = (a * (1 - e * e)) / (1 + e * Math.cos(thetaRad));
  const rNorm = getScaledRadius(rKm, earthGraphicRadius);

  // Perifocal coordinates (P, Q, W)
  const xOrb = rNorm * Math.cos(thetaRad);
  const yOrb = rNorm * Math.sin(thetaRad);

  // Rotate by Argument of Perigee
  const xP = xOrb * Math.cos(aopRad) - yOrb * Math.sin(aopRad);
  const yP = xOrb * Math.sin(aopRad) + yOrb * Math.cos(aopRad);

  // Rotate into ECI frame (Y is polar in Three.js, Z is out-of-plane)
  const x = xP * Math.cos(raanRad) - yP * Math.cos(incRad) * Math.sin(raanRad);
  const z = -(xP * Math.sin(raanRad) + yP * Math.cos(incRad) * Math.cos(raanRad));
  const y = yP * Math.sin(incRad);

  return { x, y, z, rKm };
}
