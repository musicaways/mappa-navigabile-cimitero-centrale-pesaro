
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
