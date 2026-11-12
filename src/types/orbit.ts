export interface KeplerianElements {
  a: number;    // Semi-major axis (km)
  e: number;    // Eccentricity (0 to < 1 for elliptical)
  i: number;    // Inclination (degrees, 0 to 180)
  raan: number; // Right Ascension of Ascending Node (degrees, 0 to 360)
  aop: number;  // Argument of Perigee (degrees, 0 to 360)
  nu: number;   // True Anomaly (degrees, 0 to 360)
}

export interface OrbitPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  elements: KeplerianElements;
  color: string;
  altStart?: number;
  altEnd?: number;
  raanStart?: number;
  raanRate?: number; // deg/day
  sensorType?: string;
  agency?: string;
}

export interface OrbitalTelemetry {
  periodHours: number;
  periodMinutes: number;
  rPerigeeAltKm: number;
  rApogeeAltKm: number;
  vPerigeeKmS: number;
  vApogeeKmS: number;
  currentAltKm: number;
  currentSpeedKmS: number;
  specificEnergyMjKg: number;
  semiMinorAxisKm: number;
  orbitClassification: string;
}
