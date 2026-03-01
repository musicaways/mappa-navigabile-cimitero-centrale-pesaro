import { useEffect, useMemo, useRef, useState } from 'react';

interface SmoothHeadingOptions {
  deadband?: number;
  mediumThreshold?: number;
  largeThreshold?: number;
  alphaSmall?: number;
  alphaMedium?: number;
  alphaLarge?: number;
}

export const useSmoothHeading = (rawHeading: number, options: SmoothHeadingOptions = {}) => {
  const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
  const {
    deadband = 0.3,
    mediumThreshold = 20,
    largeThreshold = 55,
    alphaSmall = 0.12,
    alphaMedium = 0.18,
    alphaLarge = 0.28,
  } = options;
  const config = useMemo(
    () => ({
      deadband,
      mediumThreshold,
      largeThreshold,
      alphaSmall,
      alphaMedium,
      alphaLarge,
    }),
    [alphaLarge, alphaMedium, alphaSmall, deadband, largeThreshold, mediumThreshold]
  );
  const [smooth, setSmooth] = useState(normalizeAngle(rawHeading));
  const currentHeadingRef = useRef(normalizeAngle(rawHeading));
  const targetHeadingRef = useRef(normalizeAngle(rawHeading));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    targetHeadingRef.current = normalizeAngle(rawHeading);

    const step = () => {
      let diff = targetHeadingRef.current - currentHeadingRef.current;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;

      const absDiff = Math.abs(diff);
      if (absDiff < config.deadband) {
        const settled = normalizeAngle(targetHeadingRef.current);
        currentHeadingRef.current = settled;
        setSmooth(settled);
        rafRef.current = null;
        return;
      }

      const alpha =
        absDiff > config.largeThreshold
          ? config.alphaLarge
          : absDiff > config.mediumThreshold
            ? config.alphaMedium
            : config.alphaSmall;
      const nextHeading = normalizeAngle(currentHeadingRef.current + diff * alpha);
      currentHeadingRef.current = nextHeading;
      setSmooth(nextHeading);
      rafRef.current = requestAnimationFrame(step);
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [config, rawHeading]);

  return smooth;
};

export const useSmoothPosition = (target: { lat: number; lng: number } | null) => {
  const [current, setCurrent] = useState(target);
  const targetRef = useRef(target);
  const currentRef = useRef(target);
  const isFirstFix = useRef(true);
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    targetRef.current = target;

    if (target && isFirstFix.current) {
      currentRef.current = target;
      setCurrent(target);
      isFirstFix.current = false;
    }
  }, [target]);

  useEffect(() => {
    let animationFrameId = 0;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current < 22) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      if (!targetRef.current) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      if (!currentRef.current) {
        currentRef.current = targetRef.current;
        setCurrent(targetRef.current);
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const prev = currentRef.current;
      const dest = targetRef.current;
      const latDiff = dest.lat - prev.lat;
      const lngDiff = dest.lng - prev.lng;
      const manhattanDiff = Math.abs(latDiff) + Math.abs(lngDiff);

      if (Math.abs(latDiff) > 0.00015 || Math.abs(lngDiff) > 0.00015) {
        currentRef.current = dest;
        setCurrent(dest);
      } else if (Math.abs(latDiff) > 0.0000001 || Math.abs(lngDiff) > 0.0000001) {
        const alpha = manhattanDiff > 0.00004 ? 0.45 : manhattanDiff > 0.00001 ? 0.34 : 0.25;
        const nextPos = {
          lat: prev.lat + latDiff * alpha,
          lng: prev.lng + lngDiff * alpha,
        };
        currentRef.current = nextPos;
        setCurrent(nextPos);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return current;
};
