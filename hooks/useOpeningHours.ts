import { useEffect, useState } from 'react';

export interface OpeningHoursResult {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  minutesUntilChange: number;
  statusLabel: string;
}

/**
 * Orari Cimitero Centrale di Pesaro:
 *   Estate  (Mar – Ott, ora legale):  07:30 – 19:00
 *   Inverno (Ott – Mar, ora solare):  07:30 – 17:00
 */
function getSchedule(date: Date): { open: number; close: number } {
  const month = date.getMonth() + 1; // 1-12
  return month >= 3 && month <= 10
    ? { open: 7 * 60 + 30, close: 19 * 60 }
    : { open: 7 * 60 + 30, close: 17 * 60 };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toHHMM(totalMinutes: number): string {
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

function computeStatus(now: Date): OpeningHoursResult {
  const { open, close } = getSchedule(now);
  const current = now.getHours() * 60 + now.getMinutes();
  const isOpen = current >= open && current < close;

  let minutesUntilChange: number;
  let statusLabel: string;

  if (isOpen) {
    minutesUntilChange = close - current;
    statusLabel = `Aperto · chiude alle ${toHHMM(close)}`;
  } else if (current < open) {
    minutesUntilChange = open - current;
    statusLabel = `Chiuso · apre alle ${toHHMM(open)}`;
  } else {
    // After closing — show tomorrow's opening
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmOpen = getSchedule(tomorrow).open;
    minutesUntilChange = (24 * 60 - current) + tmOpen;
    statusLabel = `Chiuso · apre domani alle ${toHHMM(tmOpen)}`;
  }

  return {
    isOpen,
    openTime: toHHMM(open),
    closeTime: toHHMM(close),
    minutesUntilChange,
    statusLabel,
  };
}

export function useOpeningHours(): OpeningHoursResult {
  const [status, setStatus] = useState<OpeningHoursResult>(() => computeStatus(new Date()));

  useEffect(() => {
    const tick = () => setStatus(computeStatus(new Date()));
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return status;
}
