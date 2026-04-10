
import { Coordinates } from '../types';
import { distToSegmentSquared, calculateDistance } from '../utils';
import { FeatureCollection, Position } from 'geojson';

const TARGET_NODE_COUNT = 150000; 
const SAFETY_BUFFER_METERS = 1.5; 
const YIELD_INTERVAL_MS = 15; // Slightly increased yield interval

interface Node {
  x: number; y: number; lat: number; lng: number;
  g: number; h: number; f: number;
  parent: Node | null;
  costMultiplier: number;
  closed: boolean;    
  visited: boolean;   
}

interface Obstacle {
  points: number[][]; 
  bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number };
}

interface RoadSegment {
  p1: { x: number, y: number };
  p2: { x: number, y: number };
  bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number };
}

const toPointPairs = (positions: Position[]): number[][] =>
  positions.map((p) => [p[0], p[1]]);

// Struttura dati veloce per la coda di priorità
class MinHeap {
  private heap: Node[] = [];
  
  push(node: Node) {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }
  
  pop(): Node | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0 && bottom) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  get length() { return this.heap.length; }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].f <= this.heap[index].f) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private sinkDown(index: number) {
    const len = this.heap.length;
    while (true) {
      let swap = -1;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < len && this.heap[left].f < this.heap[index].f) swap = left;
      if (right < len) {
        if ((swap === -1 && this.heap[right].f < this.heap[index].f) ||
            (swap !== -1 && this.heap[right].f < this.heap[swap].f)) {
          swap = right;
        }
      }
      if (swap === -1) break;
      [this.heap[index], this.heap[swap]] = [this.heap[swap], this.heap[index]];
      index = swap;
    }
  }
}

export class Pathfinder {
  private obstacles: Obstacle[] = [];
  private roadNetwork: RoadSegment[] = [];
  private perimeterWalls: RoadSegment[] = []; 

  constructor(geojson: FeatureCollection) {
    this.parseFeatures(geojson);
  }

  private parseFeatures(geojson: FeatureCollection) {
    geojson.features.forEach(f => {
      if (!f.geometry) return;
      const type = f.geometry.type;
      const isWall = f.properties?.isWall === true;
      
      const addAsObstacle = (ring: number[][]) => {
        this.obstacles.push({
          points: ring,
          bbox: this.calculateBBox(ring)
        });
      };

      const addAsRoadOrWall = (points: number[][]) => {
          for (let i = 0; i < points.length - 1; i++) {
              const segment = {
                  p1: { x: points[i][0], y: points[i][1] },
                  p2: { x: points[i+1][0], y: points[i+1][1] },
                  bbox: {
                      minLng: Math.min(points[i][0], points[i+1][0]),
                      maxLng: Math.max(points[i][0], points[i+1][0]),
                      minLat: Math.min(points[i][1], points[i+1][1]),
                      maxLat: Math.max(points[i][1], points[i+1][1])
                  }
              };

              if (isWall) {
                  this.perimeterWalls.push(segment);
              } else {
                  this.roadNetwork.push(segment);
              }
          }
      };

      if (type === 'Polygon') {
        const ring = f.geometry.coordinates[0];
        if (ring) addAsObstacle(toPointPairs(ring));
      } else if (type === 'MultiPolygon') {
        for (const polygon of f.geometry.coordinates) {
          const ring = polygon[0];
          if (ring) addAsObstacle(toPointPairs(ring));
        }
      } else if (type === 'LineString') {
        addAsRoadOrWall(toPointPairs(f.geometry.coordinates));
      }
    });
  }

  private calculateBBox(points: number[][]) {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    points.forEach(p => {
      if (p[0] < minLng) minLng = p[0];
      if (p[0] > maxLng) maxLng = p[0];
      if (p[1] < minLat) minLat = p[1];
      if (p[1] > maxLat) maxLat = p[1];
    });
    return { minLng, maxLng, minLat, maxLat };
  }

  /**
   * Returns the minimum distance in metres from (lat, lng) to any perimeter wall segment.
   * Returns Infinity if no perimeter walls are defined.
   */
  public distanceToPerimeter(lat: number, lng: number): number {
    if (this.perimeterWalls.length === 0) return Infinity;
    // 1 degree lat ≈ 111320 m; 1 degree lng ≈ cos(lat)*111320 m
    const cosLat = Math.cos((lat * Math.PI) / 180);
    let minDistSq = Infinity;
    for (const seg of this.perimeterWalls) {
      // Convert segment endpoints to metres relative to (lat, lng)
      const ax = (seg.p1.x - lng) * cosLat * 111320;
      const ay = (seg.p1.y - lat) * 111320;
      const bx = (seg.p2.x - lng) * cosLat * 111320;
      const by = (seg.p2.y - lat) * 111320;
      const px = 0; const py = 0;
      const dx = bx - ax; const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const nearX = ax + t * dx; const nearY = ay + t * dy;
      const dSq = nearX * nearX + nearY * nearY;
      if (dSq < minDistSq) minDistSq = dSq;
    }
    return Math.sqrt(minDistSq);
  }

  public async findPath(start: Coordinates, end: Coordinates): Promise<Coordinates[]> {
    const directDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
    const padding = Math.max(0.002, directDistance / 111320 * 0.5); 
    const minLat = Math.min(start.lat, end.lat) - padding;
    const maxLat = Math.max(start.lat, end.lat) + padding;
    const minLng = Math.min(start.lng, end.lng) - padding;
    const maxLng = Math.max(start.lng, end.lng) + padding;

    // --- PRE-OPTIMIZATION: Filter active geometry ---
    const searchMargin = 0.0005;
    const boxFilter = (item: { bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number } }) =>
        item.bbox.maxLng >= minLng - searchMargin && item.bbox.minLng <= maxLng + searchMargin &&
        item.bbox.maxLat >= minLat - searchMargin && item.bbox.minLat <= maxLat + searchMargin;

    const activeObstacles = this.obstacles.filter(boxFilter);
    const activeRoads = this.roadNetwork.filter(boxFilter);
    // Perimeter walls are used as HARD boundaries — always include ALL of them,
    // not just those inside the search bounding box. This prevents routes from
    // slipping through wall gaps that lie outside the start→end bbox.
    const activeWalls = this.perimeterWalls;

    // --- GRID PARAMETERS ---
    const latDistMeters = (maxLat - minLat) * 111320;
    const lngDistMeters = (maxLng - minLng) * (40075000 * Math.cos(start.lat * Math.PI / 180) / 360);
    const totalAreaSqM = latDistMeters * lngDistMeters;
    
    let gridSizeMeters = Math.sqrt(totalAreaSqM / TARGET_NODE_COUNT);
    gridSizeMeters = Math.max(0.5, Math.min(gridSizeMeters, 1.8)); 

    const latPerMeter = 1 / 111320;
    const lngPerMeter = 1 / (40075000 * Math.cos(start.lat * Math.PI / 180) / 360);
    const stepLat = gridSizeMeters * latPerMeter;
    const stepLng = gridSizeMeters * lngPerMeter;

    const width = Math.ceil((maxLng - minLng) / stepLng);
    const height = Math.ceil((maxLat - minLat) / stepLat);
    
    if (width * height > 2000000) {
        console.warn("Area troppo vasta, fallback linea retta.");
        return [start, end];
    }

    // --- LAZY GRID: Nodes are created only when requested ---
    const nodes: (Node | undefined)[][] = new Array(width + 1).fill(undefined).map(() => new Array(height + 1).fill(undefined));

    // Pre-calculated constants for getNode cost logic
    const roadSnapDistSq = Math.pow(2.5 * latPerMeter, 2);
    const obstacleBufferSq = Math.pow(SAFETY_BUFFER_METERS * latPerMeter, 2);
    const maxOffRoadDistSq = Math.pow(5.0 * latPerMeter, 2);
    // Increase wall buffer to 2 m — wider exclusion zone so the path cannot
    // squeeze through at grid boundaries. The cost is set to Number.MAX_SAFE_INTEGER/2
    // below, which makes wall nodes effectively impassable.
    const wallBufferSq = Math.pow(2.0 * latPerMeter, 2);

    // --- JIT NODE CREATOR ---
    const getNode = (x: number, y: number): Node => {
      if (nodes[x][y]) return nodes[x][y]!;

      const lat = minLat + y * stepLat;
      const lng = minLng + x * stepLng;
      
      // 1. Check Walls
      const distToWallSq = this.getDistToSegmentsSq(lat, lng, activeWalls);
      const isNearWall = distToWallSq < wallBufferSq;
      
      let costMultiplier = 1.0;

      if (isNearWall) {
          costMultiplier = 1e9; // Hard wall — effectively impassable
      } else {
          // 2. Check Obstacles (only if not a wall)
          const isInsideWall = this.isBlocked(lat, lng, activeObstacles);

          if (isInsideWall) {
              costMultiplier = 1e7; // Building interior
          } else {
              // 3. Check Roads & Proximity
              const distToRoadSq = this.getDistToSegmentsSq(lat, lng, activeRoads);
              const isOnRoad = distToRoadSq < roadSnapDistSq;

              if (isOnRoad) {
                   costMultiplier = 1.0; 
              } else {
                  // Check if near obstacle only if off-road and outside
                  const distToObsSq = this.getDistToNearestObstacleSq(lat, lng, activeObstacles);
                  const isTooCloseToObs = distToObsSq < obstacleBufferSq;

                  if (isTooCloseToObs) {
                      costMultiplier = 500.0;
                  } else if (distToRoadSq < maxOffRoadDistSq) {
                      costMultiplier = 5.0;
                  } else {
                      costMultiplier = 100.0;
                  }
              }
          }
      }

      const newNode: Node = {
          x, y, lat, lng,
          g: 0, h: 0, f: 0,
          parent: null,
          costMultiplier,
          closed: false,
          visited: false
      };
      
      nodes[x][y] = newNode;
      return newNode;
    };

    // --- FIND START/END NODES (Spiral Search) ---
    // Optimizes finding the nearest walkable node without scanning the whole grid
    const findNearestWalkableNode = (targetLat: number, targetLng: number): Node | null => {
        const centerX = Math.floor((targetLng - minLng) / stepLng);
        const centerY = Math.floor((targetLat - minLat) / stepLat);
        
        // Ensure bounds
        const cx = Math.max(0, Math.min(width, centerX));
        const cy = Math.max(0, Math.min(height, centerY));
        
        // Check exact match first
        const centerNode = getNode(cx, cy);
        if (centerNode.costMultiplier < 500) return centerNode;

        // Spiral search radius
        const maxRadius = Math.max(50, Math.ceil(width / 10)); 
        
        for (let r = 1; r < maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // Search only the perimeter of the current radius box
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx <= width && ny >= 0 && ny <= height) {
                        const node = getNode(nx, ny);
                        if (node.costMultiplier < 500) return node; // Found walkable!
                    }
                }
            }
        }
        return centerNode; // Fallback to blocked node if nothing else found
    };

    let startNode = findNearestWalkableNode(start.lat, start.lng);
    let endNode = findNearestWalkableNode(end.lat, end.lng);

    if (!startNode || !endNode) return [start, end];

    // --- A* ALGORITHM ---
    const openSet = new MinHeap();
    startNode.g = 0;
    startNode.h = Math.sqrt(Math.pow(startNode.x - endNode.x, 2) + Math.pow(startNode.y - endNode.y, 2));
    startNode.f = startNode.h;
    startNode.visited = true;
    openSet.push(startNode);
    
    let iterations = 0;
    let lastYieldTime = performance.now();

    while (openSet.length > 0) {
      iterations++;
      
      // Anti-freeze: Yield to main thread every few ms
      if (iterations % 200 === 0) {
          const now = performance.now();
          if (now - lastYieldTime > YIELD_INTERVAL_MS) {
              await new Promise(r => setTimeout(r, 0));
              lastYieldTime = performance.now();
          }
      }

      const current = openSet.pop();
      if (!current) break;
      
      // If we popped a node that was closed in a better path previously (rare in A* without decreaseKey, but safe)
      if (current.closed) continue; 
      
      // Check for success
      if (current === endNode) {
        const rawPath = this.reconstructPath(current, start, end);
        return this.smoothPath(rawPath, activeWalls, activeObstacles);
      }

      current.closed = true;

      // 8 Neighbors
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = current.x + dx;
          const ny = current.y + dy;

          if (nx < 0 || nx > width || ny < 0 || ny > height) continue;
          
          // JIT: Get or Create Node
          const neighbor = getNode(nx, ny);
          
          if (neighbor.closed) continue;

          // Anti-Clipping diagonal through walls
          if (dx !== 0 && dy !== 0) {
             const n1 = getNode(current.x + dx, current.y);
             const n2 = getNode(current.x, current.y + dy);
             if (n1.costMultiplier > 900 || n2.costMultiplier > 900) continue; 
          }

          const dist = (dx === 0 || dy === 0) ? 1.0 : 1.414;
          const tentativeG = current.g + (dist * neighbor.costMultiplier);

          if (!neighbor.visited || tentativeG < neighbor.g) {
            neighbor.g = tentativeG;
            // Heuristic with tie-breaker (multiplying by 1.001 favors depth slightly, fewer nodes expanded)
            neighbor.h = Math.sqrt(Math.pow(neighbor.x - endNode.x, 2) + Math.pow(neighbor.y - endNode.y, 2)) * 1.001;
            neighbor.f = neighbor.g + neighbor.h;
            neighbor.parent = current;
            neighbor.visited = true;
            openSet.push(neighbor);
          }
        }
      }
    }

    console.warn("Nessun percorso trovato, ritorno linea retta.");
    return [start, end];
  }

  // --- SMOOTHING ALGORITHM (String Pulling) ---
  private smoothPath(path: Coordinates[], walls: RoadSegment[], obstacles: Obstacle[]): Coordinates[] {
    if (path.length <= 2) return path;

    const smoothed: Coordinates[] = [path[0]];
    let inputIndex = 0;

    while (inputIndex < path.length - 1) {
        let nextIndex = inputIndex + 1;
        
        // Look ahead for the furthest visible point
        // Limiting lookahead improves performance on long paths (e.g., max 50 points ahead)
        const lookAheadLimit = Math.min(path.length, inputIndex + 50);

        for (let i = inputIndex + 2; i < lookAheadLimit; i++) {
            if (!this.isLineBlocked(path[inputIndex], path[i], walls, obstacles)) {
                nextIndex = i;
            } else {
                 // Optimization: If blocked heavily, stop checking further to save CPU? 
                 // For now, keep greedy string pulling as is, it's efficient enough on simplified paths.
            }
        }
        
        smoothed.push(path[nextIndex]);
        inputIndex = nextIndex;
    }
    
    // Ensure last point is included
    if (smoothed[smoothed.length - 1] !== path[path.length - 1]) {
        smoothed.push(path[path.length - 1]);
    }

    return smoothed;
  }

  private isLineBlocked(start: Coordinates, end: Coordinates, walls: RoadSegment[], obstacles: Obstacle[]): boolean {
    const p1 = { x: start.lng, y: start.lat };
    const p2 = { x: end.lng, y: end.lat };

    // 1. Check Intersection with Walls (Segments)
    for (const wall of walls) {
        if (this.segmentsIntersect(p1, p2, wall.p1, wall.p2)) {
            return true;
        }
    }

    // 2. Check Intersection with Obstacles
    for (const obs of obstacles) {
        // Simple AABB check
        if (Math.max(p1.x, p2.x) < obs.bbox.minLng || Math.min(p1.x, p2.x) > obs.bbox.maxLng ||
            Math.max(p1.y, p2.y) < obs.bbox.minLat || Math.min(p1.y, p2.y) > obs.bbox.maxLat) {
            continue;
        }

        // Check edges
        for (let i = 0; i < obs.points.length - 1; i++) {
            const w1 = { x: obs.points[i][0], y: obs.points[i][1] };
            const w2 = { x: obs.points[i+1][0], y: obs.points[i+1][1] };
            if (this.segmentsIntersect(p1, p2, w1, w2)) {
                return true;
            }
        }
    }

    return false;
  }

  private ccw(p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}): boolean {
    return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  }

  private segmentsIntersect(p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}, p4: {x:number, y:number}): boolean {
    return (this.ccw(p1, p3, p4) !== this.ccw(p2, p3, p4)) && (this.ccw(p1, p2, p3) !== this.ccw(p1, p2, p4));
  }

  private isBlocked(lat: number, lng: number, obstacles: Obstacle[]): boolean {
    for (const obs of obstacles) {
      if (lng < obs.bbox.minLng || lng > obs.bbox.maxLng || lat < obs.bbox.minLat || lat > obs.bbox.maxLat) continue;
      if (this.isPointInPolygon([lng, lat], obs.points)) return true;
    }
    return false;
  }

  private getDistToSegmentsSq(lat: number, lng: number, segments: RoadSegment[]): number {
    let minDistSq = Infinity;
    const p = { x: lng, y: lat };
    const range = 0.0003; 
    
    for (const seg of segments) {
       if (lng < seg.bbox.minLng - range || lng > seg.bbox.maxLng + range || lat < seg.bbox.minLat - range || lat > seg.bbox.maxLat + range) continue;
       const d2 = distToSegmentSquared(p, seg.p1, seg.p2);
       if (d2 < minDistSq) minDistSq = d2;
    }
    return minDistSq;
  }

  private getDistToNearestObstacleSq(lat: number, lng: number, obstacles: Obstacle[]): number {
    let minDistSq = Infinity;
    const p = { x: lng, y: lat };
    const range = 0.0001; 
    
    for (const obs of obstacles) {
      if (lng < obs.bbox.minLng - range || lng > obs.bbox.maxLng + range || lat < obs.bbox.minLat - range || lat > obs.bbox.maxLat + range) continue;
      
      for (let i = 0; i < obs.points.length - 1; i++) {
        const v = { x: obs.points[i][0], y: obs.points[i][1] };
        const w = { x: obs.points[i+1][0], y: obs.points[i+1][1] };
        const d2 = distToSegmentSquared(p, v, w);
        if (d2 < minDistSq) minDistSq = d2;
      }
    }
    return minDistSq;
  }

  private isPointInPolygon(point: number[], vs: number[][]) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  private reconstructPath(endNode: Node, realStart: Coordinates, realEnd: Coordinates): Coordinates[] {
    const path: Coordinates[] = [];
    let curr: Node | null = endNode;
    let i = 0;
    while (curr) {
      // Keep all nodes for smoothing resolution
      path.push({ lat: curr.lat, lng: curr.lng });
      i++;
      curr = curr.parent;
    }
    path.reverse();
    if (path.length > 0) { 
        path[0] = realStart; 
        path[path.length - 1] = realEnd; 
    }
    return path;
  }
}
