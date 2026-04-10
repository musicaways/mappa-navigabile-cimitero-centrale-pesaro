import L from 'leaflet';
import { Feature, Geometry, Position } from 'geojson';

export const DEFAULT_CENTER: L.LatLngTuple = [43.9022, 12.9158];
export const DEFAULT_ZOOM = 17;
export const MAX_MAP_ZOOM = 19;
export const MAX_NATIVE_TILE_ZOOM = 19;

export const CEMETERY_BOUNDS = L.latLngBounds([43.85, 12.85], [43.95, 13.0]);

// Only satellite — round-robin across mt0-mt3 for parallel tile loading (4x throughput)
const SATELLITE_SUBDOMAIN = (x: number, y: number, z: number): string =>
  `https://mt${(x + y) % 4}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

export const SATELLITE_TILE_URL = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
export const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// 1x1 neutral grey tile shown when a tile fails to load
const GREY_TILE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
  'AABjkB6QAAAABJRU5ErkJggg==';

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
  container: HTMLDivElement
): { map: L.Map; tileLayer: L.TileLayer } => {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomSnap: 0.1,
    zoomDelta: 0.5,
    minZoom: 15,
    maxZoom: MAX_MAP_ZOOM,
    maxBounds: CEMETERY_BOUNDS,
    maxBoundsViscosity: 0.6,
    preferCanvas: false,
    zoomAnimation: true,
    fadeAnimation: false,
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

  // Google Satellite — subdomains mt0-mt3 for parallel requests (browser allows ~6 per host)
  const tileLayer = L.tileLayer(SATELLITE_TILE_URL, {
    subdomains: ['0', '1', '2', '3'],
    maxZoom: MAX_MAP_ZOOM,
    maxNativeZoom: MAX_NATIVE_TILE_ZOOM,
    keepBuffer: 6,
    updateWhenZooming: false,
    updateWhenIdle: true,
    errorTileUrl: GREY_TILE_DATA_URI,
  }).addTo(map);

  return { map, tileLayer };
};
