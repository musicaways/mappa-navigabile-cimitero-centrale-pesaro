import { useMemo } from 'react';
import { Coordinates } from '../types';
import { calculateDistance } from '../utils';
import { useSmoothHeading } from './useSmoothedMotion';

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const calculateBearing = (from: Coordinates, to: Coordinates): number => {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const deltaLambda = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return normalizeAngle((Math.atan2(y, x) * 180) / Math.PI);
};

const getProjectedPointAndSegment = (
  navPath: Coordinates[],
  userLocation: Coordinates
): { projectedPoint: Coordinates; segmentIndex: number } | null => {
  if (navPath.length < 2) return null;

  const metersPerLatDeg = 111_320;
  const metersPerLngDeg = metersPerLatDeg * Math.cos((userLocation.lat * Math.PI) / 180);
  const toLocalMeters = (point: Coordinates) => ({
    x: (point.lng - userLocation.lng) * metersPerLngDeg,
    y: (point.lat - userLocation.lat) * metersPerLatDeg,
  });

  let closestDistanceSq = Number.POSITIVE_INFINITY;
  let result: { projectedPoint: Coordinates; segmentIndex: number } | null = null;

  for (let index = 0; index < navPath.length - 1; index += 1) {
    const start = toLocalMeters(navPath[index]);
    const end = toLocalMeters(navPath[index + 1]);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) continue;

    const t = Math.max(0, Math.min(1, (-(start.x) * dx + -(start.y) * dy) / lengthSq));
    const projectedX = start.x + dx * t;
    const projectedY = start.y + dy * t;
    const distanceSq = projectedX * projectedX + projectedY * projectedY;

    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      result = {
        projectedPoint: {
          lat: userLocation.lat + projectedY / metersPerLatDeg,
          lng: userLocation.lng + projectedX / metersPerLngDeg,
        },
        segmentIndex: index,
      };
    }
  }

  return result;
};

const getLookAheadPoint = (
  navPath: Coordinates[],
  projectedPoint: Coordinates,
  startSegmentIndex: number,
  lookAheadMeters: number
): Coordinates => {
  let remainingDistance = lookAheadMeters;
  let currentPoint = projectedPoint;

  for (let index = startSegmentIndex; index < navPath.length - 1; index += 1) {
    const segmentStart = index === startSegmentIndex ? currentPoint : navPath[index];
    const segmentEnd = navPath[index + 1];
    const segmentDistance = calculateDistance(
      segmentStart.lat,
      segmentStart.lng,
      segmentEnd.lat,
      segmentEnd.lng
    );

    if (segmentDistance >= remainingDistance && segmentDistance > 0) {
      const ratio = remainingDistance / segmentDistance;
      return {
        lat: segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * ratio,
        lng: segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * ratio,
      };
    }

    remainingDistance -= segmentDistance;
    currentPoint = segmentEnd;
  }

  return navPath[navPath.length - 1];
};

const getRouteBearing = (
  navPath: Coordinates[],
  userLocation: Coordinates,
  lookAheadMeters = 28
): number | null => {
  const projected = getProjectedPointAndSegment(navPath, userLocation);
  if (!projected) return null;

  const lookAheadPoint = getLookAheadPoint(
    navPath,
    projected.projectedPoint,
    projected.segmentIndex,
    lookAheadMeters
  );

  const distanceToLookAhead = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    lookAheadPoint.lat,
    lookAheadPoint.lng
  );

  if (distanceToLookAhead < 1.5) {
    return null;
  }

  return calculateBearing(userLocation, lookAheadPoint);
};

export const useNavigationMapRotation = (
  enabled: boolean,
  userLocation: Coordinates | null,
  navPath: Coordinates[] | null
): number => {
  const rawBearing = useMemo(() => {
    if (!enabled || !userLocation || !navPath || navPath.length < 2) {
      return 0;
    }

    const routeBearing = getRouteBearing(navPath, userLocation);
    return routeBearing ?? userLocation.heading ?? 0;
  }, [enabled, navPath, userLocation]);

  const smoothedBearing = useSmoothHeading(rawBearing, {
    deadband: 5,
    mediumThreshold: 28,
    largeThreshold: 72,
    alphaSmall: 0.04,
    alphaMedium: 0.06,
    alphaLarge: 0.1,
  });
  return enabled ? smoothedBearing : 0;
};
