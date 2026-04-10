import { useCallback, useEffect, useRef, useState } from 'react';
import { Coordinates } from '../types';
import { calculateDistance, findClosestSegmentIndex } from '../utils';

const DISTANCE_MILESTONES = [200, 100, 50, 20] as const;
const TURN_COOLDOWN_MS = 14_000;

function getBearing(from: Coordinates, to: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingDiff(a: number, b: number): number {
  let d = b - a;
  while (d < -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}

/**
 * Looks ahead from fromIndex on navPath and returns an upcoming turn instruction.
 * Uses weighted circular mean of segment bearings:
 *  - "near" window:  0–15 m  → current heading
 *  - "far"  window: 22–58 m  → upcoming heading
 * A turn is detected when these differ by ≥28°.
 */
function getUpcomingTurn(
  navPath: Coordinates[],
  fromIndex: number
): { text: string; distAhead: number } | null {
  let cumDist = 0;
  let nearSin = 0, nearCos = 0, nearW = 0;
  let farSin = 0, farCos = 0, farW = 0;
  let farFirstDist: number | null = null;

  for (let i = fromIndex; i < navPath.length - 1; i++) {
    const seg = calculateDistance(
      navPath[i].lat, navPath[i].lng,
      navPath[i + 1].lat, navPath[i + 1].lng
    );
    if (seg < 0.3) continue;

    const bearing = getBearing(navPath[i], navPath[i + 1]);
    const rad = (bearing * Math.PI) / 180;

    if (cumDist < 15) {
      nearSin += Math.sin(rad) * seg;
      nearCos += Math.cos(rad) * seg;
      nearW += seg;
    } else if (cumDist >= 22 && cumDist < 58) {
      if (farFirstDist === null) farFirstDist = cumDist;
      farSin += Math.sin(rad) * seg;
      farCos += Math.cos(rad) * seg;
      farW += seg;
    }

    cumDist += seg;
    if (cumDist >= 58) break;
  }

  if (nearW < 3 || farW < 3 || farFirstDist === null) return null;

  const nearBearing = ((Math.atan2(nearSin / nearW, nearCos / nearW) * 180) / Math.PI + 360) % 360;
  const farBearing = ((Math.atan2(farSin / farW, farCos / farW) * 180) / Math.PI + 360) % 360;
  const delta = bearingDiff(nearBearing, farBearing);

  if (Math.abs(delta) < 28) return null;

  const abs = Math.abs(delta);
  let text: string;
  if (abs >= 140) text = 'gira e torna indietro';
  else if (delta > 0) text = abs >= 65 ? 'svolta a destra' : 'tieni la destra';
  else text = abs >= 65 ? 'svolta a sinistra' : 'tieni la sinistra';

  return { text, distAhead: farFirstDist };
}

export interface UseVoiceGuidanceReturn {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  speak: (text: string) => void;
}

interface UseVoiceGuidanceProps {
  isNavigating: boolean;
  destinationName: string;
  distanceToDest: number;
  navPath: Coordinates[] | null;
  userLocation: { lat: number; lng: number } | null;
  pathDistance: number;
}

export function useVoiceGuidance({
  isNavigating,
  destinationName,
  distanceToDest,
  navPath,
  userLocation,
  pathDistance,
}: UseVoiceGuidanceProps): UseVoiceGuidanceReturn {
  // Auto-enabled by default on mobile; users can toggle it off via NavigationUI
  const [voiceEnabled, setVoiceEnabled] = useState(() => 'speechSynthesis' in window);

  const announcedMilestonesRef = useRef<Set<number>>(new Set());
  const startAnnouncedRef = useRef(false);
  const lastTurnAnnouncedAtRef = useRef(0);

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = 0.93;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

  // toggleVoice must be called inside a user gesture for iOS compatibility
  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        window.speechSynthesis?.cancel();
      } else {
        const utterance = new SpeechSynthesisUtterance('Guida vocale attivata.');
        utterance.lang = 'it-IT';
        utterance.rate = 0.93;
        window.speechSynthesis?.speak(utterance);
      }
      return next;
    });
  }, []);

  // Reset on navigation start / stop
  useEffect(() => {
    if (!isNavigating) {
      window.speechSynthesis?.cancel();
      announcedMilestonesRef.current.clear();
      startAnnouncedRef.current = false;
      lastTurnAnnouncedAtRef.current = 0;
      return;
    }

    if (!startAnnouncedRef.current && voiceEnabled && destinationName && pathDistance > 0) {
      startAnnouncedRef.current = true;
      const distText =
        pathDistance >= 1000
          ? `${(pathDistance / 1000).toFixed(1)} chilometri`
          : `${Math.round(pathDistance)} metri`;
      speak(`Navigazione avviata verso ${destinationName}. Percorso di circa ${distText}.`);
    }
  }, [isNavigating, voiceEnabled, destinationName, pathDistance, speak]);

  // Distance milestone announcements
  useEffect(() => {
    if (!isNavigating || !voiceEnabled || distanceToDest <= 0 || distanceToDest > 250) return;

    for (const milestone of DISTANCE_MILESTONES) {
      if (
        distanceToDest <= milestone + 6 &&
        distanceToDest > 10 &&
        !announcedMilestonesRef.current.has(milestone)
      ) {
        announcedMilestonesRef.current.add(milestone);
        speak(`${milestone} metri alla destinazione.`);
        break;
      }
    }
  }, [isNavigating, voiceEnabled, distanceToDest, speak]);

  // Turn announcements (lookahead 22–58 m)
  useEffect(() => {
    if (!isNavigating || !voiceEnabled || !navPath || !userLocation || navPath.length < 4) return;
    if (Date.now() - lastTurnAnnouncedAtRef.current < TURN_COOLDOWN_MS) return;

    const splitIndex = findClosestSegmentIndex(navPath, userLocation);
    const turn = getUpcomingTurn(navPath, splitIndex);

    if (turn) {
      lastTurnAnnouncedAtRef.current = Date.now();
      const distText =
        turn.distAhead < 20 ? 'ora' : `tra ${Math.round(turn.distAhead)} metri`;
      speak(`${distText.charAt(0).toUpperCase() + distText.slice(1)}, ${turn.text}.`);
    }
  }, [isNavigating, voiceEnabled, navPath, userLocation, speak]);

  return { voiceEnabled, toggleVoice, speak };
}
