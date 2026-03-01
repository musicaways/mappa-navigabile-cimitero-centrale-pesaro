import L from 'leaflet';
import {
  createNavEndMarkerHtml,
  createNavStartMarkerHtml,
  createSelectedMarkerHtml,
  getUnifiedMarkerSize,
} from './marker-theme';

export const createUserMarkerIcon = () =>
  L.divIcon({
    className: 'bg-transparent',
    html: `
      <div class="user-location-pointer relative will-change-transform">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: -20px; margin-top: -20px; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.4));">
          <path d="M12 2L4.5 20.5L12 16L19.5 20.5L12 2Z" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>`,
    iconSize: [0, 0],
  });

export const createSelectedMarkerIcon = (scale = 1) => {
  const size = getUnifiedMarkerSize(scale);
  return L.divIcon({
    className: 'nav-pin-marker',
    html: createSelectedMarkerHtml(size),
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), size],
  });
};

export const createNavStartIcon = (scale = 1) => {
  const size = getUnifiedMarkerSize(scale);
  return L.divIcon({
    className: 'nav-pin-marker',
    html: createNavStartMarkerHtml(size),
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), size],
  });
};

export const createNavEndIcon = (scale = 1) => {
  const size = getUnifiedMarkerSize(scale);
  return L.divIcon({
    className: 'nav-pin-marker',
    html: createNavEndMarkerHtml(size),
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), size],
  });
};
