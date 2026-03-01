import { useEffect, useRef, useState } from 'react';

export const useSmoothHeading = (rawHeading: number) => {
  const [smooth, setSmooth] = useState(rawHeading);
  const lastHeadingRef = useRef(rawHeading);

  useEffect(() => {
    let diff = rawHeading - lastHeadingRef.current;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    const absDiff = Math.abs(diff);
    if (absDiff < 0.35) return;

    const alpha = absDiff > 55 ? 0.88 : absDiff > 20 ? 0.68 : 0.45;
    const nextHeading = lastHeadingRef.current + diff * alpha;
    const normalized = ((nextHeading % 360) + 360) % 360;

    lastHeadingRef.current = normalized;
    setSmooth(normalized);
  }, [rawHeading]);

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
