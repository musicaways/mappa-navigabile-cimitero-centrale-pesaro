
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Coordinates, TrailData } from "./types";
import { Feature, FeatureCollection, Geometry } from "geojson";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Haversine formula to calculate distance between two points in meters
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check if device is likely mobile/tablet
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
  const isSmallViewport = window.innerWidth <= 1024;
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touchPoints = navigator.maxTouchPoints || 0;
  // Small viewport alone is sufficient (covers Chrome DevTools responsive mode)
  return isMobileUserAgent || isSmallViewport || hasCoarsePointer || touchPoints > 1;
}

// --- Bearing / Direction Helpers ---

export function getBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function bearingDiff(a: number, b: number): number {
  let d = b - a;
  while (d < -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}

// --- Path / Distance Helpers ---

/** Sum of haversine distances along a path (meters). */
export function computePathDistance(path: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += calculateDistance(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
  }
  return total;
}

/**
 * Index of the path segment [i, i+1] closest to `point`.
 * Uses the existing distToSegmentSquared helper after converting lat/lng → metres.
 */
export function findClosestSegmentIndex(
  path: Coordinates[],
  point: { lat: number; lng: number }
): number {
  if (path.length < 2) return 0;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((point.lat * Math.PI) / 180);
  const toXY = (c: { lat: number; lng: number }) => ({
    x: c.lng * mPerLng,
    y: c.lat * mPerLat,
  });
  const p = toXY(point);
  let minDSq = Infinity;
  let best = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distToSegmentSquared(p, toXY(path[i]), toXY(path[i + 1]));
    if (d < minDSq) { minDSq = d; best = i; }
  }
  return best;
}

// --- Turn-by-turn instruction generation ---

import { TurnInstruction } from './types';

/**
 * Compute a compact list of turn-by-turn instructions from a navPath.
 * Collapses micro-segments and ignores turns < 22° or closer than 12 m apart.
 */
export function computeTurnInstructions(path: Coordinates[]): TurnInstruction[] {
  if (path.length < 2) return [];

  const instructions: TurnInstruction[] = [];
  let cumDist = 0;
  let lastInstrDist = 0;
  let step = 1;

  const push = (
    index: number,
    direction: TurnInstruction['direction'],
    label: string,
    symbol: string,
    distFromPrev: number
  ) => {
    instructions.push({
      step: step++,
      index,
      lat: path[index].lat,
      lng: path[index].lng,
      direction,
      distanceFromPrev: distFromPrev,
      cumDistance: cumDist,
      label,
      symbol,
    });
  };

  push(0, 'start', 'Parti da qui', '●', 0);

  // Compute bearing of first segment (skip zero-length segments)
  let lastBearing: number | null = null;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = calculateDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    if (seg > 0.3) { lastBearing = getBearing(path[i], path[i + 1]); break; }
  }
  if (lastBearing === null) return instructions;

  for (let i = 1; i < path.length - 1; i++) {
    const seg = calculateDistance(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
    cumDist += seg;

    const nextSeg = calculateDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    if (nextSeg < 0.3) continue;

    const newBearing = getBearing(path[i], path[i + 1]);
    const delta = bearingDiff(lastBearing, newBearing);
    const abs = Math.abs(delta);

    // Only register significant turns with minimum spacing
    if (abs > 22 && cumDist - lastInstrDist > 12) {
      let direction: TurnInstruction['direction'];
      let label: string;
      let symbol: string;

      if (abs >= 145) { direction = 'uturn';        label = 'Fai inversione';      symbol = '↩'; }
      else if (delta > 0 && abs >= 60) { direction = 'right';       label = 'Svolta a destra';   symbol = '→'; }
      else if (delta > 0)              { direction = 'slight-right'; label = 'Tieni la destra';   symbol = '↗'; }
      else if (abs >= 60)              { direction = 'left';         label = 'Svolta a sinistra'; symbol = '←'; }
      else                             { direction = 'slight-left';  label = 'Tieni la sinistra'; symbol = '↖'; }

      push(i, direction, label, symbol, cumDist - lastInstrDist);
      lastInstrDist = cumDist;
    }

    lastBearing = newBearing;
  }

  // Final arrival
  const last = path.length - 1;
  const lastSeg = calculateDistance(path[last - 1].lat, path[last - 1].lng, path[last].lat, path[last].lng);
  cumDist += lastSeg;
  push(last, 'arrive', 'Destinazione raggiunta', '✓', cumDist - lastInstrDist);

  return instructions;
}

/** Minimum distance (metres) from `point` to any segment of `path`. */
export function distToPath(
  path: Coordinates[],
  point: { lat: number; lng: number }
): number {
  if (path.length < 2) return Infinity;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((point.lat * Math.PI) / 180);
  const toXY = (c: { lat: number; lng: number }) => ({
    x: c.lng * mPerLng,
    y: c.lat * mPerLat,
  });
  const p = toXY(point);
  let minDSq = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distToSegmentSquared(p, toXY(path[i]), toXY(path[i + 1]));
    if (d < minDSq) minDSq = d;
  }
  return Math.sqrt(minDSq);
}

// --- Geometry Helpers for Pathfinding ---

function sqr(x: number) { return x * x; }
function dist2(v: { x: number, y: number }, w: { x: number, y: number }) { return sqr(v.x - w.x) + sqr(v.y - w.y); }

// Squared distance from point p to line segment vw
export function distToSegmentSquared(p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

export function distToSegment(p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) {
  return Math.sqrt(distToSegmentSquared(p, v, w));
}

// --- HIT TESTING HELPERS ---

// Trova il trail più vicino a un punto lat/lng dato
// Questo serve perché Leaflet non rileva i click corretti se il div è ruotato col CSS
export function getNearestTrail(
    targetLat: number, 
    targetLng: number, 
    trails: TrailData[], 
    geojson: FeatureCollection<Geometry>,
    thresholdMeters: number = 25, // Increased tolerance for easier selection
    featureMap?: Record<string, Feature<Geometry>>
): string | null {
    let minDistance = Infinity;
    let nearestId: string | null = null;

    const metersPerLatDeg = 111_320;
    const metersPerLngDeg = 111_320 * Math.cos((targetLat * Math.PI) / 180);
    const toMeters = (lat: number, lng: number) => ({
        x: lng * metersPerLngDeg,
        y: lat * metersPerLatDeg,
    });
    const p = toMeters(targetLat, targetLng);

    for (const trail of trails) {
        const feature = featureMap?.[trail.id] ?? geojson.features.find((f) => String(f.id) === trail.id);
        if (!feature || !feature.geometry) continue;

        let distance = Infinity;

        // Gestione LineString
        if (feature.geometry.type === 'LineString') {
            const coords = feature.geometry.coordinates;
            for (let i = 0; i < coords.length - 1; i++) {
                const v = toMeters(coords[i][1], coords[i][0]);
                const w = toMeters(coords[i + 1][1], coords[i + 1][0]);
                const d = distToSegment(p, v, w);
                if (d < distance) distance = d;
            }
        } 
        // Gestione Point (POI, Cancelli)
        else if (feature.geometry.type === 'Point') {
            const [lng, lat] = feature.geometry.coordinates;
            const point = toMeters(lat, lng);
            distance = Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2));
        }
        // Gestione Polygon
        else if (feature.geometry.type === 'Polygon') {
             // Check distance to edges
             const coords = feature.geometry.coordinates[0];
             for (let i = 0; i < coords.length - 1; i++) {
                const v = toMeters(coords[i][1], coords[i][0]);
                const w = toMeters(coords[i + 1][1], coords[i + 1][0]);
                const d = distToSegment(p, v, w);
                if (d < distance) distance = d;
            }
        }

        if (distance < minDistance) {
            minDistance = distance;
            nearestId = trail.id;
        }
    }

    return minDistance <= thresholdMeters ? nearestId : null;
}
