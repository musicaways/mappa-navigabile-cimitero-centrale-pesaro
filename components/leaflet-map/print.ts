import L from 'leaflet';

export type FitTarget = 'screen' | 'print';

export const getFitConfig = (target: FitTarget, attempt: number) => {
  if (target === 'print') {
    if (attempt === 1) {
      return {
        paddingTopLeft: [10, 26] as L.PointExpression,
        paddingBottomRight: [10, 10] as L.PointExpression,
        maxZoom: 20,
      };
    }
    if (attempt >= 2) {
      return {
        paddingTopLeft: [12, 30] as L.PointExpression,
        paddingBottomRight: [12, 12] as L.PointExpression,
        maxZoom: 19,
      };
    }
    return {
      paddingTopLeft: [8, 20] as L.PointExpression,
      paddingBottomRight: [8, 8] as L.PointExpression,
      maxZoom: 20,
    };
  }

  if (attempt === 1) {
    return {
      paddingTopLeft: [20, 20] as L.PointExpression,
      paddingBottomRight: [20, 20] as L.PointExpression,
      maxZoom: 19,
    };
  }
  if (attempt >= 2) {
    return {
      paddingTopLeft: [24, 24] as L.PointExpression,
      paddingBottomRight: [24, 24] as L.PointExpression,
      maxZoom: 18,
    };
  }
  return {
    paddingTopLeft: [18, 18] as L.PointExpression,
    paddingBottomRight: [18, 18] as L.PointExpression,
    maxZoom: 19,
  };
};

export const isTargetBoundsVisible = (map: L.Map, targetBounds: L.LatLngBounds): boolean => {
  if (!targetBounds.isValid()) return false;
  return map.getBounds().contains(targetBounds);
};

export const computeAdaptiveZoomBoost = (
  map: L.Map,
  targetBounds: L.LatLngBounds,
  desiredFill: number,
  maxBoost: number
): number => {
  if (!targetBounds.isValid()) return 0;

  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) return 0;

  const northWest = map.latLngToContainerPoint(targetBounds.getNorthWest());
  const southEast = map.latLngToContainerPoint(targetBounds.getSouthEast());
  const boundsWidth = Math.max(1, Math.abs(southEast.x - northWest.x));
  const boundsHeight = Math.max(1, Math.abs(southEast.y - northWest.y));

  const scaleX = (size.x * desiredFill) / boundsWidth;
  const scaleY = (size.y * desiredFill) / boundsHeight;
  const extraScale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(extraScale) || extraScale <= 1) return 0;

  return Math.max(0, Math.min(maxBoost, Math.log2(extraScale)));
};
