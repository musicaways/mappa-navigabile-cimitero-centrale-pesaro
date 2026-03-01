const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getIconScale = (zoom: number): number => {
  return clamp(0.78 + (zoom - 15) * 0.11, 0.78, 1.28);
};

export const getUnifiedMarkerSize = (scale: number): number => {
  return Math.round(clamp(34 * scale, 24, 56));
};

const buildPinSvg = (size: number, color: string): string => `
  <svg class="gm-map-pin-svg" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M12 22C12 22 20 15.9 20 9.9C20 5.55 16.42 2 12 2C7.58 2 4 5.55 4 9.9C4 15.9 12 22 12 22Z"
      fill="${color}"
      stroke="#ffffff"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <circle cx="12" cy="10" r="5.2" fill="rgba(255,255,255,0.16)" />
  </svg>
`;

const buildPinHtml = (size: number, color: string, glyph?: string): string => {
  const glyphSize = Math.max(12, Math.round(size * 0.34));
  return `
    <div class="gm-map-pin" style="width:${size}px;height:${size}px;">
      ${buildPinSvg(size, color)}
      <div class="gm-map-pin-center" style="width:${glyphSize}px;height:${glyphSize}px;">
        ${
          glyph
            ? `<span class="gm-map-pin-glyph material-symbols-rounded" style="font-size:${glyphSize}px;">${glyph}</span>`
            : '<span class="gm-map-pin-dot"></span>'
        }
      </div>
    </div>
  `;
};

export const createGateMarkerHtml = (size: number): string => buildPinHtml(size, '#1aa8a5', 'meeting_room');

export const createPoiMarkerHtml = (size: number, color: string): string =>
  buildPinHtml(size, color || '#1a73e8');

export const createSelectedMarkerHtml = (size: number): string => buildPinHtml(size, '#f59e0b');

export const createNavStartMarkerHtml = (size: number): string => buildPinHtml(size, '#10b981', 'directions_walk');

export const createNavEndMarkerHtml = (size: number): string => buildPinHtml(size, '#ea4335', 'flag');
