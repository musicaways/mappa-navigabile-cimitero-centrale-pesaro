
import { Feature, FeatureCollection, Geometry } from 'geojson';

export interface TrailData {
  id: string;
  name: string;
  description: string;
  distance: string;
  duration: string;
  difficulty: "Facile" | "Medio" | "Difficile";
  photos: string[];
  elevation: string;
  keywords: string[];
  color?: string;
  coordinates?: { lat: number; lng: number }; // Added for weather/centering
}

export interface MyMapsData {
  geojson: FeatureCollection;
  trails: TrailData[];
  idMap: Record<string, TrailData>;
  featureMap: Record<string, Feature<Geometry>>;
}

export interface Coordinates {
  lat: number;
  lng: number;
  heading?: number; // Gradi di rotazione (0-360)
}

export interface GpsData {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

export type TurnDirection =
  | 'start'
  | 'straight'
  | 'slight-right'
  | 'right'
  | 'slight-left'
  | 'left'
  | 'uturn'
  | 'arrive';

export interface TurnInstruction {
  /** Sequential step number (1-based) */
  step: number;
  /** Index in navPath */
  index: number;
  lat: number;
  lng: number;
  direction: TurnDirection;
  /** Distance from previous instruction (metres) */
  distanceFromPrev: number;
  /** Cumulative distance from start (metres) */
  cumDistance: number;
  /** Human-readable label in Italian */
  label: string;
  /** Unicode symbol for print/voice */
  symbol: string;
}
