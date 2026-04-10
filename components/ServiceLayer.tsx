import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface ServicePoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

interface ServiceData {
  fountains: ServicePoint[];
  toilets: ServicePoint[];
  trash: ServicePoint[];
  info: ServicePoint[];
}

interface ServiceLayerProps {
  map: L.Map | null;
  visible: boolean;
}

const SERVICE_ICONS: Record<string, { emoji: string; color: string }> = {
  fountains: { emoji: '💧', color: '#2563eb' },
  toilets:   { emoji: '🚻', color: '#7c3aed' },
  trash:     { emoji: '🗑️', color: '#6b7280' },
  info:      { emoji: 'ℹ️', color: '#0891b2' },
};

const makeIcon = (emoji: string, color: string) =>
  L.divIcon({
    className: 'bg-transparent',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const ServiceLayer: React.FC<ServiceLayerProps> = ({ map, visible }) => {
  const markersRef = useRef<L.Marker[]>([]);
  const loadedRef = useRef(false);
  const dataRef = useRef<ServiceData | null>(null);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetch('/data/services.json')
      .then((r) => r.json())
      .then((d: ServiceData) => { dataRef.current = d; })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!map || !visible || !dataRef.current) return;

    const data = dataRef.current;
    const addPoints = (points: ServicePoint[], type: keyof typeof SERVICE_ICONS) => {
      const { emoji, color } = SERVICE_ICONS[type];
      const icon = makeIcon(emoji, color);
      points.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 1000, interactive: true });
        marker.bindTooltip(p.name, { direction: 'top', offset: [0, -14], className: 'leaflet-tooltip-gm' });
        if (map) marker.addTo(map);
        markersRef.current.push(marker);
      });
    };

    // Small delay to let services.json load if first render
    const timer = window.setTimeout(() => {
      if (!dataRef.current) return;
      addPoints(dataRef.current.fountains, 'fountains');
      addPoints(dataRef.current.toilets,   'toilets');
      addPoints(dataRef.current.trash,     'trash');
      addPoints(dataRef.current.info,      'info');
    }, 200);

    return () => {
      window.clearTimeout(timer);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, visible]);

  return null;
};

export default ServiceLayer;
