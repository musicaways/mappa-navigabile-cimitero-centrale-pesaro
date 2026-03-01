import L from 'leaflet';
import { Feature, Geometry, Position } from 'geojson';

export const DEFAULT_CENTER: L.LatLngTuple = [43.9022, 12.9158];
export const DEFAULT_ZOOM = 17;

export const CEMETERY_BOUNDS = L.latLngBounds([43.85, 12.85], [43.95, 13.0]);

export const SATELLITE_TILE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
export const STREETS_TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

export const getTileLayerUrl = (isSatelliteView: boolean): string =>
  isSatelliteView ? SATELLITE_TILE_URL : STREETS_TILE_URL;

export const toLatLngTuple = (position: Position): L.LatLngTuple => [position[1], position[0]];

export const getFeatureMarkerTarget = (feature: Feature<Geometry>): L.LatLngExpression | null => {
  if (!feature.geometry) return null;

  if (feature.geometry.type === 'Point') {
    return toLatLngTuple(feature.geometry.coordinates);
  }

  if (feature.geometry.type === 'LineString') {
    const first = feature.geometry.coordinates[0];
    return first ? toLatLngTuple(first) : null;
  }

  if (feature.geometry.type === 'Polygon') {
    const ring = feature.geometry.coordinates[0];
    if (!ring || ring.length === 0) return null;
    return L.polygon(ring.map(toLatLngTuple)).getBounds().getCenter();
  }

  return null;
};

export const createBaseMap = (
  container: HTMLDivElement,
  isSatelliteView: boolean
): { map: L.Map; tileLayer: L.TileLayer } => {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomSnap: 0.1,
    zoomDelta: 0.5,
    minZoom: 15,
    maxBounds: CEMETERY_BOUNDS,
    maxBoundsViscosity: 0.5,
    preferCanvas: false,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    doubleClickZoom: false,
  });

  map.createPane('custom-walls-pane');
  const wallsPane = map.getPane('custom-walls-pane');
  if (wallsPane) {
    wallsPane.style.zIndex = '350';
    wallsPane.classList.add('leaflet-zoom-animated');
  }

  map.createPane('custom-interactive-pane');
  const interactivePane = map.getPane('custom-interactive-pane');
  if (interactivePane) {
    interactivePane.style.zIndex = '450';
    interactivePane.classList.add('leaflet-zoom-animated');
  }

  const tileLayer = L.tileLayer(getTileLayerUrl(isSatelliteView), {
    maxZoom: 22,
    maxNativeZoom: 20,
    keepBuffer: 8,
    updateWhenIdle: false,
    updateWhenZooming: false,
    updateInterval: 120,
    crossOrigin: true,
  }).addTo(map);

  return { map, tileLayer };
};
