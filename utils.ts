
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TrailData } from "./types";
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
  const isSmallViewport = window.matchMedia("(max-width: 1024px)").matches;
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touchPoints = navigator.maxTouchPoints || 0;
  return isMobileUserAgent || (isSmallViewport && (hasCoarsePointer || touchPoints > 0));
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
