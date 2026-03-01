import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GpsData } from '../types';
import { isMobileDevice } from '../utils';
import { useSmoothHeading, useSmoothPosition } from './useSmoothedMotion';

interface UseDeviceSensorsResult {
  isMobile: boolean;
  gpsData: GpsData | null;
  gpsLoading: boolean;
  userLocation: { lat: number; lng: number; heading: number } | null;
  ensureCompassPermission: () => Promise<boolean>;
}

const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

export const useDeviceSensors = (): UseDeviceSensorsResult => {
  const isMobile = isMobileDevice();
  const [magneticHeading, setMagneticHeading] = useState(0);
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [gpsLoading, setGpsLoading] = useState(isMobile);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const lastCompassUpdateMsRef = useRef(0);
  const compassWatchdogRef = useRef<number | null>(null);
  const compassAttachedRef = useRef(false);
  const lastAcceptedHeadingRef = useRef<number | null>(null);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const now = performance.now();
    if (now - lastCompassUpdateMsRef.current < 75) {
      return;
    }

    let heading: number | null = null;
    const eventWithWebkit = event as DeviceOrientationEvent & {
      webkitCompassHeading?: number;
      webkitCompassAccuracy?: number;
    };

    if (typeof eventWithWebkit.webkitCompassHeading === 'number') {
      if (
        typeof eventWithWebkit.webkitCompassAccuracy === 'number' &&
        eventWithWebkit.webkitCompassAccuracy > 55
      ) {
        return;
      }
      heading = eventWithWebkit.webkitCompassHeading;
    } else if (event.absolute === true && event.alpha !== null) {
      heading = 360 - event.alpha;
    } else if (event.alpha !== null) {
      heading = 360 - event.alpha;
    }

    if (heading === null || Number.isNaN(heading)) {
      return;
    }

    const screenAngle = window.screen.orientation?.angle ?? 0;
    const correctedHeading = normalizeHeading(heading - screenAngle);
    const previousHeading = lastAcceptedHeadingRef.current;
    if (previousHeading !== null) {
      let diff = correctedHeading - previousHeading;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;

      const absDiff = Math.abs(diff);
      if (absDiff < 4) {
        return;
      }
      if (absDiff > 60 && now - lastCompassUpdateMsRef.current < 220) {
        return;
      }
    }

    lastCompassUpdateMsRef.current = now;
    lastAcceptedHeadingRef.current = correctedHeading;
    setMagneticHeading(correctedHeading);
  }, []);

  const detachCompassListeners = useCallback(() => {
    window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
    compassAttachedRef.current = false;
  }, [handleOrientation]);

  const attachCompassListeners = useCallback(() => {
    const win = window as Window & {
      ondeviceorientationabsolute?: unknown;
      DeviceOrientationEvent?: unknown;
    };
    if (!('DeviceOrientationEvent' in win)) {
      return false;
    }

    detachCompassListeners();

    if ('ondeviceorientationabsolute' in win) {
      window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, {
        capture: true,
        passive: true,
      });
    }
    window.addEventListener('deviceorientation', handleOrientation as EventListener, {
      capture: true,
      passive: true,
    });
    compassAttachedRef.current = true;
    lastCompassUpdateMsRef.current = performance.now();
    lastAcceptedHeadingRef.current = null;
    return true;
  }, [detachCompassListeners, handleOrientation]);

  const ensureCompassPermission = useCallback(async () => {
    if (!isMobile) return true;
    if (typeof DeviceOrientationEvent === 'undefined') return false;

    const deviceOrientationCtor = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof deviceOrientationCtor.requestPermission === 'function') {
      try {
        const permission = await deviceOrientationCtor.requestPermission();
        if (permission !== 'granted') {
          return false;
        }
      } catch (error) {
        console.error('Compass permission error:', error);
        return false;
      }
    }

    const attached = attachCompassListeners();
    setCompassEnabled(attached);
    return attached;
  }, [attachCompassListeners, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      setGpsData(null);
      setGpsLoading(false);
      return undefined;
    }

    setGpsLoading(true);

    if (!navigator.geolocation) {
      setGpsLoading(false);
      return undefined;
    }

    let isActive = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isActive) return;
        setGpsData({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setGpsLoading(false);
      },
      (error) => {
        console.warn('GPS initial fix warning:', error.message);
        if (!isActive) return;
        setGpsLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: Infinity, timeout: 5000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isActive) return;
        setGpsData({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS warning:', err.message);
        if (isActive) {
          setGpsLoading(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      isActive = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return undefined;

    const deviceOrientationCtor = (window as unknown as { DeviceOrientationEvent?: unknown })
      .DeviceOrientationEvent as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    } | undefined;

    const needsExplicitPermission = typeof deviceOrientationCtor?.requestPermission === 'function';
    if (!needsExplicitPermission) {
      const attached = attachCompassListeners();
      setCompassEnabled(attached);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && compassEnabled) {
        attachCompassListeners();
      } else if (document.visibilityState !== 'visible') {
        detachCompassListeners();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      detachCompassListeners();
    };
  }, [attachCompassListeners, compassEnabled, detachCompassListeners, isMobile]);

  useEffect(() => {
    if (!compassEnabled) {
      if (compassWatchdogRef.current !== null) {
        window.clearInterval(compassWatchdogRef.current);
        compassWatchdogRef.current = null;
      }
      return undefined;
    }

    compassWatchdogRef.current = window.setInterval(() => {
      const elapsed = performance.now() - lastCompassUpdateMsRef.current;
      if (elapsed > 4000 && document.visibilityState === 'visible') {
        attachCompassListeners();
      }
    }, 2000);

    return () => {
      if (compassWatchdogRef.current !== null) {
        window.clearInterval(compassWatchdogRef.current);
        compassWatchdogRef.current = null;
      }
    };
  }, [attachCompassListeners, compassEnabled]);

  const activeRawHeading = useMemo(() => {
    const hasReliableCompass = compassEnabled && lastAcceptedHeadingRef.current !== null;
    const canUseGpsHeading =
      !!gpsData?.speed &&
      gpsData.speed > 2.2 &&
      (gpsData.accuracy ?? Number.POSITIVE_INFINITY) < 18 &&
      gpsData?.heading !== null &&
      gpsData?.heading !== undefined &&
      !Number.isNaN(gpsData.heading);

    if (canUseGpsHeading && !hasReliableCompass) {
      return gpsData.heading;
    }
    return magneticHeading;
  }, [compassEnabled, gpsData, magneticHeading]);

  const smoothedHeading = useSmoothHeading(activeRawHeading, {
    deadband: 3.6,
    mediumThreshold: 22,
    largeThreshold: 58,
    alphaSmall: 0.05,
    alphaMedium: 0.08,
    alphaLarge: 0.12,
  });
  const smoothedPosition = useSmoothPosition(gpsData ? { lat: gpsData.lat, lng: gpsData.lng } : null);

  const userLocation = useMemo(() => {
    if (!smoothedPosition) return null;
    return {
      lat: smoothedPosition.lat,
      lng: smoothedPosition.lng,
      heading: smoothedHeading,
    };
  }, [smoothedHeading, smoothedPosition]);

  return {
    isMobile,
    gpsData,
    gpsLoading,
    userLocation,
    ensureCompassPermission,
  };
};
