import { Coordinates, TurnDirection, TurnInstruction } from '../types';
import { calculateDistance } from '../utils';

const normalizeAngle = (a: number) => ((a % 360) + 360) % 360;

const bearing = (from: Coordinates, to: Coordinates): number => {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const dL = ((to.lng - from.lng) * Math.PI) / 180;
  return normalizeAngle(
    (Math.atan2(Math.sin(dL) * Math.cos(phi2), Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dL)) * 180) / Math.PI
  );
};

const classifyTurn = (angle: number): { direction: TurnDirection; label: string; symbol: string } => {
  const abs = Math.abs(angle);
  if (abs >= 150) return { direction: 'uturn',       label: 'Inverti la direzione', symbol: '⬇' };
  if (angle >  70) return { direction: 'right',       label: 'Svolta a destra',      symbol: '➡' };
  if (angle >  22) return { direction: 'slight-right',label: 'Tieni la destra',       symbol: '↗' };
  if (angle < -70) return { direction: 'left',        label: 'Svolta a sinistra',    symbol: '⬅' };
  if (angle < -22) return { direction: 'slight-left', label: 'Tieni la sinistra',    symbol: '↖' };
  return               { direction: 'straight',    label: 'Prosegui dritto',      symbol: '⬆' };
};

/**
 * Sample path at regular intervals to smooth micro-angle noise from A* nodes.
 */
const samplePath = (path: Coordinates[], intervalM: number): Coordinates[] => {
  if (path.length === 0) return [];
  const out: Coordinates[] = [path[0]];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    acc += calculateDistance(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
    if (acc >= intervalM || i === path.length - 1) {
      out.push(path[i]);
      acc = 0;
    }
  }
  return out;
};

/**
 * Derive turn-by-turn instructions from a raw A* path.
 * Samples every 4 m to eliminate micro-angle noise, then detects bearing
 * changes > 22°. Merges turns closer than 6 m to avoid duplicates.
 */
export const computeTurnInstructions = (path: Coordinates[]): TurnInstruction[] => {
  if (path.length < 2) return [];

  const sampled = samplePath(path, 4);
  const instructions: TurnInstruction[] = [];
  let cumDist = 0;
  let prevTurnCumDist = 0;

  // Start instruction
  instructions.push({
    step: 0, index: 0,
    lat: sampled[0].lat, lng: sampled[0].lng,
    direction: 'start',
    distanceFromPrev: 0, cumDistance: 0,
    label: 'Inizia il percorso', symbol: '▶',
  });

  for (let i = 1; i < sampled.length - 1; i++) {
    const segDist = calculateDistance(sampled[i - 1].lat, sampled[i - 1].lng, sampled[i].lat, sampled[i].lng);
    cumDist += segDist;

    const bIn  = bearing(sampled[i - 1], sampled[i]);
    const bOut = bearing(sampled[i],     sampled[i + 1]);
    let turn = bOut - bIn;
    while (turn >  180) turn -= 360;
    while (turn < -180) turn += 360;

    if (Math.abs(turn) < 22) continue;

    // Merge with the immediately preceding turn if within 6 m
    const last = instructions[instructions.length - 1];
    if (last && last.direction !== 'start' && cumDist - last.cumDistance < 6) continue;

    const { direction, label, symbol } = classifyTurn(turn);
    instructions.push({
      step: instructions.length,
      index: i,
      lat: sampled[i].lat, lng: sampled[i].lng,
      direction,
      distanceFromPrev: cumDist - prevTurnCumDist,
      cumDistance: cumDist,
      label, symbol,
    });
    prevTurnCumDist = cumDist;
  }

  // Final segment distance
  if (sampled.length >= 2) {
    const last = sampled[sampled.length - 1];
    const prev = sampled[sampled.length - 2];
    cumDist += calculateDistance(prev.lat, prev.lng, last.lat, last.lng);
  }

  // Arrival
  const dest = sampled[sampled.length - 1];
  instructions.push({
    step: instructions.length,
    index: sampled.length - 1,
    lat: dest.lat, lng: dest.lng,
    direction: 'arrive',
    distanceFromPrev: cumDist - prevTurnCumDist,
    cumDistance: cumDist,
    label: 'Sei arrivato a destinazione',
    symbol: '📍',
  });

  return instructions;
};

/**
 * Given current instructions and user position, return the next upcoming
 * instruction and the straight-line distance to it.
 * A turn is considered "passed" when the user is within 8 m of its point.
 */
export const getNextInstruction = (
  instructions: TurnInstruction[],
  userLat: number,
  userLng: number,
): { instruction: TurnInstruction; distanceToTurn: number } | null => {
  if (instructions.length === 0) return null;

  for (let i = 1; i < instructions.length; i++) {
    const instr = instructions[i];
    const d = calculateDistance(userLat, userLng, instr.lat, instr.lng);
    if (d > 8) {
      return { instruction: instr, distanceToTurn: Math.round(d) };
    }
  }

  // All instructions passed — return arrival
  const last = instructions[instructions.length - 1];
  return {
    instruction: last,
    distanceToTurn: Math.round(calculateDistance(userLat, userLng, last.lat, last.lng)),
  };
};
