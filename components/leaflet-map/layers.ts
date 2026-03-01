import L from 'leaflet';
import { Feature, FeatureCollection, Geometry } from 'geojson';

export const partitionFeatures = (
  features: Feature<Geometry>[]
): { wallFeatures: Feature<Geometry>[]; interactiveFeatures: Feature<Geometry>[] } => {
  const wallFeatures = features.filter((f) => Boolean(f.geometry) && f.properties?.isWall === true);
  const interactiveFeatures = features.filter((f) => Boolean(f.geometry) && !f.properties?.isWall);
  return { wallFeatures, interactiveFeatures };
};

export const buildFeatureCollection = (features: Feature<Geometry>[]): FeatureCollection<Geometry> => ({
  type: 'FeatureCollection',
  features,
});

export const getBoundsFromFeatures = (features: Feature<Geometry>[]): L.LatLngBounds | null => {
  if (features.length === 0) return null;
  const bounds = L.geoJSON(buildFeatureCollection(features)).getBounds();
  return bounds.isValid() ? bounds : null;
};
