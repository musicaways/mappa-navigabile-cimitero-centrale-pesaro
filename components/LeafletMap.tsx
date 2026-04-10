
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Feature, Geometry } from 'geojson';
import { MyMapsData, Coordinates } from '../types';
import { isMobileDevice, getNearestTrail, findClosestSegmentIndex } from '../utils';
import {
  createBaseMap,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAX_MAP_ZOOM,
  getFeatureMarkerTarget,
  toLatLngTuple,
} from './leaflet-map/map-core';
import { buildFeatureCollection, getBoundsFromFeatures, partitionFeatures } from './leaflet-map/layers';
import {
  createNavEndIcon,
  createNavStartIcon,
  createSelectedMarkerIcon,
  createUserMarkerIcon,
} from './leaflet-map/navigation';
import {
  createGateMarkerHtml,
  createPoiMarkerHtml,
  getUnifiedMarkerSize,
  getIconScale,
} from './leaflet-map/marker-theme';
import {
  computeAdaptiveZoomBoost,
  getFitConfig,
  isTargetBoundsVisible,
} from './leaflet-map/print';

interface LeafletMapProps {
  data: MyMapsData | null;
  selectedTrailId: string | null;
  onSelectTrail: (id: string, shouldZoom?: boolean) => void;
  onClearSelection?: () => void;
  userLocation: Coordinates | null;
  destination: Coordinates | null;
  navPath: Coordinates[] | null;
  navActive: boolean;
  showAllFeatures?: boolean;
  followUser?: boolean;
  mapRotation?: number; 
  onManualDrag?: () => void;
  zoomTrigger?: number;
  pathZoomTrigger?: number; 
  preparePrintLayoutTrigger?: number;
  preparePrintTrigger?: number;
  restorePrintViewTrigger?: number;
  onPrintLayoutReady?: () => void;
  onPrintPrepared?: () => void;
  printMode?: boolean;
  printStopMarkers?: Array<{ lat: number; lng: number; step: number }>;
  liveStopMarkers?: Array<{ lat: number; lng: number; step: number }>;
  /** Queued multi-stop destinations shown on the main map before route calculation */
  queuePreviewMarkers?: Array<{ lat: number; lng: number; step: number }>;
  resetViewTrigger?: number;
  showServices?: boolean;
}

interface MapViewSnapshot {
  center: L.LatLngTuple;
  zoom: number;
}

const LeafletMap: React.FC<LeafletMapProps> = ({ 
  data, 
  selectedTrailId, 
  onSelectTrail,
  onClearSelection,
  userLocation,
  destination,
  navPath,
  navActive,
  showAllFeatures = true,
  followUser = false,
  mapRotation = 0, 
  onManualDrag,
  zoomTrigger = 0,
  pathZoomTrigger = 0,
  preparePrintLayoutTrigger = 0,
  preparePrintTrigger = 0,
  restorePrintViewTrigger = 0,
  onPrintLayoutReady,
  onPrintPrepared,
  printMode = false,
  printStopMarkers = [],
  liveStopMarkers = [],
  queuePreviewMarkers = [],
  resetViewTrigger = 0,
  showServices = false,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null); 
  
  // Layers
  const wallsGlowLayerRef = useRef<L.GeoJSON | null>(null);
  const wallsOutlineLayerRef = useRef<L.GeoJSON | null>(null);
  const wallsInnerLayerRef = useRef<L.GeoJSON | null>(null);
  const interactiveLayerRef = useRef<L.GeoJSON | null>(null);
  
  // Markers
  const userMarkerRef = useRef<L.Marker | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null); 
  
  // Navigation elements
  const routeLineRef = useRef<L.Polyline | null>(null);      // remaining (blue dashed)
  const routeGlowRef = useRef<L.Polyline | null>(null);      // full-path glow (white)
  const routeCompletedRef = useRef<L.Polyline | null>(null); // completed portion (grey)
  const navStartMarkerRef = useRef<L.Marker | null>(null);
  const navEndMarkerRef = useRef<L.Marker | null>(null);
  
  const [layersReady, setLayersReady] = useState(false);
  const [isLowZoom, setIsLowZoom] = useState(false); // State for CSS class
  const [iconScale, setIconScale] = useState(1);

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<{x: number, y: number} | null>(null);
  const lastMousePosRef = useRef<{x: number, y: number} | null>(null);
  const activeTouchIdRef = useRef<number | null>(null);
  const pendingPanDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const panRafRef = useRef<number | null>(null);
  const dragResetTimerRef = useRef<number | null>(null);
  const lastAutoPanRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const lastSelectionRef = useRef<{ id: string; at: number } | null>(null);
  const routeBoundsRef = useRef<L.LatLngBounds | null>(null);
  const cemeteryBoundsRef = useRef<L.LatLngBounds | null>(null);
  const navPathRef = useRef<Coordinates[] | null>(null);
  const prePrintSnapshotRef = useRef<MapViewSnapshot | null>(null);
  const userPrintViewRef = useRef<MapViewSnapshot | null>(null);
  const forceAutoPrintFitRef = useRef(false);
  const isPrintLayoutStableRef = useRef(false);
  const printFitAttemptRef = useRef(0);
  const isApplyingPrintFitRef = useRef(false);
  const userInteractionPendingRef = useRef(false);
  const printViewLockedByUserRef = useRef(false);
  const printFitClearTimerRef = useRef<number | null>(null);
  const handledPathZoomTriggerRef = useRef(0);
  const layoutReadyRafRef = useRef<number | null>(null);
  const layoutReadyTimeoutRef = useRef<number | null>(null);
  const followViewPrimedRef = useRef(false);

  const isMobile = isMobileDevice();
  const displayRotation = isMobile ? -mapRotation : mapRotation;
  const effectiveDisplayRotation = printMode ? 0 : displayRotation;
  const getFeatureById = useCallback(
    (id: string) => data?.featureMap?.[id] ?? data?.geojson.features.find((feature) => String(feature.id) === id),
    [data]
  );
  const buildFocusedBounds = useCallback((): L.LatLngBounds | null => {
    let routeBounds = routeBoundsRef.current;
    if ((!routeBounds || !routeBounds.isValid()) && navPathRef.current && navPathRef.current.length >= 2) {
      routeBounds = L.latLngBounds(navPathRef.current.map((p) => [p.lat, p.lng] as L.LatLngTuple));
      routeBoundsRef.current = routeBounds;
    }

    const cemeteryBounds = cemeteryBoundsRef.current;
    let combinedBounds: L.LatLngBounds | null = null;

    if (cemeteryBounds && cemeteryBounds.isValid()) {
      combinedBounds = L.latLngBounds(cemeteryBounds.getSouthWest(), cemeteryBounds.getNorthEast());
    }

    if (routeBounds && routeBounds.isValid()) {
      combinedBounds = combinedBounds
        ? combinedBounds.extend(routeBounds)
        : L.latLngBounds(routeBounds.getSouthWest(), routeBounds.getNorthEast());
    }

    const startLatLng = navStartMarkerRef.current?.getLatLng() ?? null;
    if (startLatLng) {
      combinedBounds = combinedBounds
        ? combinedBounds.extend(startLatLng)
        : L.latLngBounds(startLatLng, startLatLng);
    }

    const endLatLng = navEndMarkerRef.current?.getLatLng() ?? null;
    if (endLatLng) {
      combinedBounds = combinedBounds
        ? combinedBounds.extend(endLatLng)
        : L.latLngBounds(endLatLng, endLatLng);
    }

    return combinedBounds && combinedBounds.isValid() ? combinedBounds : null;
  }, []);

  const fitFocusedBounds = useCallback((target: 'screen' | 'print', attempt = 0, options?: L.FitBoundsOptions): { applied: boolean; bounds: L.LatLngBounds | null } => {
    const map = mapRef.current;
    if (!map) return { applied: false, bounds: null };

    const bounds = buildFocusedBounds();
    if (!bounds) return { applied: false, bounds: null };

    const config = getFitConfig(target, attempt);

    map.invalidateSize({ animate: false });
    map.fitBounds(bounds, {
      paddingTopLeft: config.paddingTopLeft,
      paddingBottomRight: config.paddingBottomRight,
      maxZoom: config.maxZoom,
      animate: false,
      ...options,
    });
    return { applied: true, bounds };
  }, [buildFocusedBounds]);

  const runFocusedFit = useCallback((target: 'screen' | 'print', options?: L.FitBoundsOptions): boolean => {
    const map = mapRef.current;
    if (!map) return false;

    if (printFitClearTimerRef.current !== null) {
      window.clearTimeout(printFitClearTimerRef.current);
      printFitClearTimerRef.current = null;
    }

    isApplyingPrintFitRef.current = true;
    let fitApplied = false;
    let lastBounds: L.LatLngBounds | null = null;

    const maxAttempts = target === 'print' ? 3 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      printFitAttemptRef.current = attempt + 1;
      const fitResult = fitFocusedBounds(target, attempt, options);
      if (!fitResult.applied || !fitResult.bounds) {
        break;
      }
      fitApplied = true;
      lastBounds = fitResult.bounds;
      if (isTargetBoundsVisible(map, fitResult.bounds)) {
        break;
      }
      map.invalidateSize({ animate: false });
    }

    if (fitApplied && lastBounds) {
      const zoomBoost =
        target === 'print'
          ? computeAdaptiveZoomBoost(map, lastBounds, 0.99, 1.45)
          : 0;

      if (zoomBoost > 0.01) {
        const boostedZoom = Math.min(map.getMaxZoom(), map.getZoom() + zoomBoost);
        map.setZoom(boostedZoom, { animate: false });
      }
    }

    let cleared = false;

    const clearProgrammaticFlag = () => {
      if (cleared) return;
      cleared = true;
      isApplyingPrintFitRef.current = false;
      if (printFitClearTimerRef.current !== null) {
        window.clearTimeout(printFitClearTimerRef.current);
        printFitClearTimerRef.current = null;
      }
    };

    if (fitApplied) {
      map.once('moveend', clearProgrammaticFlag);
      printFitClearTimerRef.current = window.setTimeout(clearProgrammaticFlag, target === 'print' ? 560 : 420);
      return true;
    }

    clearProgrammaticFlag();
    return false;
  }, [fitFocusedBounds]);

  const runPrintFit = useCallback((options?: L.FitBoundsOptions): boolean => {
    return runFocusedFit('print', options);
  }, [runFocusedFit]);

  useEffect(() => {
    return () => {
      if (printFitClearTimerRef.current !== null) {
        window.clearTimeout(printFitClearTimerRef.current);
        printFitClearTimerRef.current = null;
      }
      if (layoutReadyTimeoutRef.current !== null) {
        window.clearTimeout(layoutReadyTimeoutRef.current);
        layoutReadyTimeoutRef.current = null;
      }
      if (layoutReadyRafRef.current !== null) {
        cancelAnimationFrame(layoutReadyRafRef.current);
        layoutReadyRafRef.current = null;
      }
      isApplyingPrintFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    navPathRef.current = navPath;
    if (navPath && navPath.length >= 2) {
      routeBoundsRef.current = L.latLngBounds(navPath.map((p) => [p.lat, p.lng] as L.LatLngTuple));
    } else {
      routeBoundsRef.current = null;
    }
    userPrintViewRef.current = null;
    printViewLockedByUserRef.current = false;
    forceAutoPrintFitRef.current = false;
    userInteractionPendingRef.current = false;
  }, [navPath]);

  // 1. MAP INITIALIZATION & PANES
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const { map, tileLayer } = createBaseMap(containerRef.current);
    tileLayerRef.current = tileLayer;

    // Retry failed tiles with exponential backoff (max 2 attempts)
    const handleTileError = (e: L.TileErrorEvent) => {
      const img = e.tile as HTMLImageElement & { _retryCount?: number };
      const retries = img._retryCount ?? 0;
      if (retries < 2) {
        img._retryCount = retries + 1;
        const delay = retries === 0 ? 1000 : 3000;
        setTimeout(() => {
          const src = img.getAttribute('src') || '';
          if (src && !src.startsWith('data:')) {
            const sep = src.includes('?') ? '&' : '?';
            img.src = `${src}${sep}_r=${retries + 1}`;
          }
        }, delay);
      }
    };
    tileLayer.on('tileerror', handleTileError);

    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      setIsLowZoom(zoom < 17);
      setIconScale(getIconScale(zoom));
    };
    map.on('zoomend', handleZoomEnd);
    handleZoomEnd();

    mapRef.current = map;
    return () => {
      tileLayer.off('tileerror', handleTileError);
      map.off('zoomend', handleZoomEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (preparePrintLayoutTrigger === 0) return;
    const map = mapRef.current;
    const wrapper = wrapperRef.current;
    const container = containerRef.current;

    if (!map || !wrapper || !container || !printMode) {
      onPrintLayoutReady?.();
      return;
    }

    isPrintLayoutStableRef.current = false;

    if (layoutReadyTimeoutRef.current !== null) {
      window.clearTimeout(layoutReadyTimeoutRef.current);
      layoutReadyTimeoutRef.current = null;
    }
    if (layoutReadyRafRef.current !== null) {
      cancelAnimationFrame(layoutReadyRafRef.current);
      layoutReadyRafRef.current = null;
    }

    let completed = false;
    let lastResizeAt = performance.now();
    const markResize = () => {
      lastResizeAt = performance.now();
    };

    const finalizeLayout = () => {
      if (completed) return;
      completed = true;
      if (layoutReadyTimeoutRef.current !== null) {
        window.clearTimeout(layoutReadyTimeoutRef.current);
        layoutReadyTimeoutRef.current = null;
      }
      if (layoutReadyRafRef.current !== null) {
        cancelAnimationFrame(layoutReadyRafRef.current);
        layoutReadyRafRef.current = null;
      }
      resizeObserver?.disconnect();
      map.invalidateSize({ animate: false });
      isPrintLayoutStableRef.current = true;
      onPrintLayoutReady?.();
    };

    const checkLayoutStability = () => {
      if (completed) return;
      const rect = wrapper.getBoundingClientRect();
      const elapsed = performance.now() - lastResizeAt;
      if (rect.width > 0 && rect.height > 0 && elapsed >= 120) {
        finalizeLayout();
        return;
      }
      layoutReadyRafRef.current = requestAnimationFrame(checkLayoutStability);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => markResize());
      resizeObserver.observe(wrapper);
      resizeObserver.observe(container);
    }

    map.invalidateSize({ animate: false });
    layoutReadyRafRef.current = requestAnimationFrame(checkLayoutStability);
    layoutReadyTimeoutRef.current = window.setTimeout(finalizeLayout, 1200);

    return () => {
      resizeObserver?.disconnect();
      if (layoutReadyTimeoutRef.current !== null) {
        window.clearTimeout(layoutReadyTimeoutRef.current);
        layoutReadyTimeoutRef.current = null;
      }
      if (layoutReadyRafRef.current !== null) {
        cancelAnimationFrame(layoutReadyRafRef.current);
        layoutReadyRafRef.current = null;
      }
    };
  }, [preparePrintLayoutTrigger, printMode, onPrintLayoutReady]);

  // --- PRINT EVENT HANDLER ---
  useEffect(() => {
      let secondPassTimer: number | null = null;
      const handleBeforePrint = () => {
          if (!mapRef.current) return;
          const map = mapRef.current;

          if (!prePrintSnapshotRef.current) {
            const center = map.getCenter();
            prePrintSnapshotRef.current = {
                center: [center.lat, center.lng],
                zoom: map.getZoom()
            };
          }

          map.invalidateSize({ animate: false });

          if (printViewLockedByUserRef.current && userPrintViewRef.current && !forceAutoPrintFitRef.current) {
            isApplyingPrintFitRef.current = true;
            map.setView(userPrintViewRef.current.center, userPrintViewRef.current.zoom, { animate: false });
            const clearManualViewTimer = window.setTimeout(() => {
              isApplyingPrintFitRef.current = false;
            }, 200);
            map.once('moveend', () => {
              window.clearTimeout(clearManualViewTimer);
              isApplyingPrintFitRef.current = false;
            });
            return;
          }

          runPrintFit();
          secondPassTimer = window.setTimeout(() => {
            map.invalidateSize({ animate: false });
            runPrintFit();
          }, 120);
      };
      
      window.addEventListener('beforeprint', handleBeforePrint);
      return () => {
        window.removeEventListener('beforeprint', handleBeforePrint);
        if (secondPassTimer !== null) {
          window.clearTimeout(secondPassTimer);
          secondPassTimer = null;
        }
      };
  }, [runPrintFit]);

  // --- HIT TESTING ---
  useEffect(() => {
      const map = mapRef.current;
      const container = containerRef.current;
      if (!map || !container || !data) return;

      const handleMapClick = (e: MouseEvent | TouchEvent) => {
          if (isDraggingRef.current) return;
          if (effectiveDisplayRotation !== 0) return;

          let clientX, clientY;
          if ('changedTouches' in e) {
              clientX = e.changedTouches[0].clientX;
              clientY = e.changedTouches[0].clientY;
          } else {
              clientX = (e as MouseEvent).clientX;
              clientY = (e as MouseEvent).clientY;
          }

          if (dragStartPosRef.current) {
             const dist = Math.sqrt(
                 Math.pow(clientX - dragStartPosRef.current.x, 2) + 
                 Math.pow(clientY - dragStartPosRef.current.y, 2)
             );
             if (dist > 10) return; 
          }

          const rect = wrapperRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          const centerX = rect.width / 2 + rect.left;
          const centerY = rect.height / 2 + rect.top;
          const dx = clientX - centerX;
          const dy = clientY - centerY;

          const rad = (effectiveDisplayRotation) * (Math.PI / 180); 
          const theta = -rad;
          const unrotatedDx = dx * Math.cos(theta) - dy * Math.sin(theta);
          const unrotatedDy = dx * Math.sin(theta) + dy * Math.cos(theta);

          const mapSize = map.getSize();
          const mapCenterPoint = L.point(mapSize.x / 2, mapSize.y / 2);
          const clickPoint = mapCenterPoint.add([unrotatedDx, unrotatedDy]);
          const latlng = map.containerPointToLatLng(clickPoint);

          const threshold = isMobile ? 30 : 25;
          const nearestId = getNearestTrail(
            latlng.lat,
            latlng.lng,
            data.trails,
            data.geojson,
            threshold,
            data.featureMap
          );

          if (nearestId) {
              const now = performance.now();
              const lastSelection = lastSelectionRef.current;
              if (lastSelection && lastSelection.id === nearestId && now - lastSelection.at < 350) {
                  return;
              }
              lastSelectionRef.current = { id: nearestId, at: now };
              onSelectTrail(nearestId, true);
          } else if (selectedTrailId && !navActive) {
              onClearSelection?.();
          }
      };

      const handler = (e: Event) => handleMapClick(e as MouseEvent | TouchEvent);
      const el = wrapperRef.current;
      
      if (el) {
          el.addEventListener('click', handler);
          el.addEventListener('touchend', handler, { passive: true });
      }

      return () => {
          if (el) {
              el.removeEventListener('click', handler);
              el.removeEventListener('touchend', handler);
          }
      };
  }, [effectiveDisplayRotation, data, isMobile, onSelectTrail, onClearSelection, selectedTrailId, navActive]);

  // --- DRAG HANDLER ---
  useEffect(() => {
    const map = mapRef.current;
    const wrapper = wrapperRef.current;
    if (!map || !wrapper) return;

    const flushPan = () => {
        if (!map || !pendingPanDeltaRef.current) {
            panRafRef.current = null;
            return;
        }
        const delta = pendingPanDeltaRef.current;
        pendingPanDeltaRef.current = null;
        map.panBy([-delta.x, -delta.y], { animate: false });
        panRafRef.current = null;
    };

    const getClientXY = (e: MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            const activeTouch = activeTouchIdRef.current !== null
                ? Array.from(e.touches).find(t => t.identifier === activeTouchIdRef.current) || e.touches[0]
                : e.touches[0];
            return { x: activeTouch.clientX, y: activeTouch.clientY };
        }
        return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            if (e.touches.length !== 1) {
                activeTouchIdRef.current = null;
                isDraggingRef.current = false;
                return;
            }
            activeTouchIdRef.current = e.touches[0].identifier;
        } else {
            activeTouchIdRef.current = null;
        }

        const pos = getClientXY(e);
        if (!pos) return;
        dragStartPosRef.current = pos; 

        if (effectiveDisplayRotation === 0) return; 

        isDraggingRef.current = true;
        lastMousePosRef.current = pos;
        pendingPanDeltaRef.current = null;
        if (onManualDrag) onManualDrag();
        if ('touches' in e) e.preventDefault();
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (effectiveDisplayRotation === 0) return;
        if (!isDraggingRef.current || !lastMousePosRef.current || !map) return;

        if ('touches' in e) {
            if (e.touches.length !== 1) {
                isDraggingRef.current = false;
                activeTouchIdRef.current = null;
                return;
            }
        }
        
        const pos = getClientXY(e);
        if (!pos) return;
        const { x, y } = pos;
        const deltaX = x - lastMousePosRef.current.x;
        const deltaY = y - lastMousePosRef.current.y;
        
        const rad = -effectiveDisplayRotation * (Math.PI / 180);
        const rotatedDX = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
        const rotatedDY = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

        if (pendingPanDeltaRef.current) {
            pendingPanDeltaRef.current = {
                x: pendingPanDeltaRef.current.x + rotatedDX,
                y: pendingPanDeltaRef.current.y + rotatedDY
            };
        } else {
            pendingPanDeltaRef.current = { x: rotatedDX, y: rotatedDY };
        }
        if (panRafRef.current === null) {
            panRafRef.current = requestAnimationFrame(flushPan);
        }

        lastMousePosRef.current = { x, y };
        if ('touches' in e) e.preventDefault(); 
    };

    const handleUp = () => {
        if (panRafRef.current !== null) {
            cancelAnimationFrame(panRafRef.current);
            panRafRef.current = null;
            if (pendingPanDeltaRef.current) {
                map.panBy([-pendingPanDeltaRef.current.x, -pendingPanDeltaRef.current.y], { animate: false });
                pendingPanDeltaRef.current = null;
            }
        }
        dragResetTimerRef.current = window.setTimeout(() => { isDraggingRef.current = false; dragResetTimerRef.current = null; }, 16);
        activeTouchIdRef.current = null;
        lastMousePosRef.current = null;
    };

    if (effectiveDisplayRotation !== 0) {
        map.dragging.disable();
        wrapper.addEventListener('mousedown', handleDown);
        wrapper.addEventListener('touchstart', handleDown, { passive: false });
        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
        window.addEventListener('touchcancel', handleUp);
        window.addEventListener('blur', handleUp);
    } else {
        map.dragging.enable();
        wrapper.addEventListener('mousedown', handleDown);
        wrapper.addEventListener('touchstart', handleDown, { passive: true });
        
        map.on('dragstart', () => { isDraggingRef.current = true; if (onManualDrag) onManualDrag(); });
        map.on('dragend', () => { isDraggingRef.current = false; });
    }

    return () => {
        wrapper.removeEventListener('mousedown', handleDown);
        wrapper.removeEventListener('touchstart', handleDown);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
        window.removeEventListener('touchcancel', handleUp);
        window.removeEventListener('blur', handleUp);
        map.off('dragstart');
        map.off('dragend');
        if (panRafRef.current !== null) {
            cancelAnimationFrame(panRafRef.current);
            panRafRef.current = null;
        }
        if (dragResetTimerRef.current !== null) {
            window.clearTimeout(dragResetTimerRef.current);
            dragResetTimerRef.current = null;
        }
        pendingPanDeltaRef.current = null;
    };
  }, [effectiveDisplayRotation, onManualDrag]);

  // 2. HANDLE RESIZE
  useEffect(() => {
    if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
    }
  }, [followUser, isMobile, navActive, effectiveDisplayRotation, printMode]);

  useEffect(() => {
    let orientationTimer: number | null = null;

    const handleResize = () => {
      if (!mapRef.current) return;
      requestAnimationFrame(() => {
        mapRef.current?.invalidateSize({ animate: false });
      });
    };

    const handleOrientationChange = () => {
      if (orientationTimer !== null) window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        orientationTimer = null;
        if (!mapRef.current) return;
        mapRef.current.invalidateSize({ animate: false });
        // Force tile refresh after orientation change
        requestAnimationFrame(() => {
          mapRef.current?.invalidateSize({ animate: false });
        });
      }, 300);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (orientationTimer !== null) window.clearTimeout(orientationTimer);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.touchZoom.enable(); 
  }, [effectiveDisplayRotation]);

  useEffect(() => {
    const map = mapRef.current;
    const wrapper = wrapperRef.current;
    if (!map || !wrapper) return;

    const markInteractionStart = () => {
      if (!printMode) return;
      if (isApplyingPrintFitRef.current) return;
      userInteractionPendingRef.current = true;
    };

    const captureManualPrintView = () => {
      if (!printMode || !userInteractionPendingRef.current) return;
      if (isApplyingPrintFitRef.current) return;
      const center = map.getCenter();
      userPrintViewRef.current = {
        center: [center.lat, center.lng],
        zoom: map.getZoom(),
      };
      printViewLockedByUserRef.current = true;
      forceAutoPrintFitRef.current = false;
      userInteractionPendingRef.current = false;
    };

    wrapper.addEventListener('pointerdown', markInteractionStart, { passive: true });
    wrapper.addEventListener('wheel', markInteractionStart, { passive: true });
    map.on('dragstart', markInteractionStart);
    map.on('movestart', markInteractionStart);
    map.on('zoomstart', markInteractionStart);
    map.on('moveend', captureManualPrintView);
    map.on('zoomend', captureManualPrintView);

    return () => {
      wrapper.removeEventListener('pointerdown', markInteractionStart);
      wrapper.removeEventListener('wheel', markInteractionStart);
      map.off('dragstart', markInteractionStart);
      map.off('movestart', markInteractionStart);
      map.off('zoomstart', markInteractionStart);
      map.off('moveend', captureManualPrintView);
      map.off('zoomend', captureManualPrintView);
    };
  }, [printMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.invalidateSize({ animate: false });
    if (printMode && !printViewLockedByUserRef.current && !userPrintViewRef.current) {
      runPrintFit();
    }
    if (!printMode) {
      printViewLockedByUserRef.current = false;
      userPrintViewRef.current = null;
      forceAutoPrintFitRef.current = false;
      userInteractionPendingRef.current = false;
      isPrintLayoutStableRef.current = false;
    }
  }, [printMode, runPrintFit]);

  useEffect(() => {
    if (!mapRef.current || resetViewTrigger === 0) return;
    mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  }, [resetViewTrigger]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMobile) return;

    if (!followUser || !navActive || !userLocation) {
      followViewPrimedRef.current = false;
      return;
    }

    const currentZoom = map.getZoom();
    const maxStableNavZoom = 17.4;
    if (!followViewPrimedRef.current || currentZoom > 17.8) {
      map.invalidateSize({ animate: false });
      map.setView([userLocation.lat, userLocation.lng], Math.min(currentZoom, maxStableNavZoom), { animate: false });
      followViewPrimedRef.current = true;
    }
  }, [followUser, isMobile, navActive, userLocation]);

  // 4. USER MARKER
  useEffect(() => {
    if (!mapRef.current) return;

    // HIDE USER MARKER ON DESKTOP
    if (!isMobile) {
        if (userMarkerRef.current) {
            userMarkerRef.current.remove();
            userMarkerRef.current = null;
        }
        return;
    }

    if (!userLocation) return;
    const { lat, lng, heading = 0 } = userLocation;

    if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([lat, lng], {
            icon: createUserMarkerIcon(),
            zIndexOffset: 10000
        }).addTo(mapRef.current);
    } else {
        userMarkerRef.current.setLatLng([lat, lng]);
        const el = userMarkerRef.current.getElement()?.querySelector('.user-location-pointer') as HTMLElement;
        if (el) {
            el.style.transform = `rotate(${heading}deg)`;
            el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        }
    }

    if (followUser) {
        const now = performance.now();
        const lastPan = lastAutoPanRef.current;
        const movedEnough = !lastPan || Math.abs(lat - lastPan.lat) > 0.000015 || Math.abs(lng - lastPan.lng) > 0.000015;
        if (!lastPan || movedEnough || now - lastPan.at > 220) {
            mapRef.current.panTo([lat, lng], { animate: false });
            lastAutoPanRef.current = { lat, lng, at: now };
        }
    } else {
        lastAutoPanRef.current = null;
    }
  }, [userLocation, followUser, isMobile]);

  // 5. SELECTED ITEM MARKER
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
    }
    if (navPath && navPath.length > 0) return;
    if (!selectedTrailId || !data) return;

    const feature = getFeatureById(selectedTrailId);
    if (!feature) return;
    if (feature.geometry?.type === 'Point') return;

    const targetCoords = getFeatureMarkerTarget(feature);

    if (targetCoords) {
        selectedMarkerRef.current = L.marker(targetCoords, {
          icon: createSelectedMarkerIcon(iconScale),
          zIndexOffset: 4000
        }).addTo(mapRef.current);
    }
  }, [selectedTrailId, data, navPath, getFeatureById, iconScale]);

  // 6A. STATIC LAYERS (Walls) - Only render on data change
  useEffect(() => {
    if (!mapRef.current || !data) return;

    if (wallsGlowLayerRef.current) wallsGlowLayerRef.current.remove();
    if (wallsOutlineLayerRef.current) wallsOutlineLayerRef.current.remove();
    if (wallsInnerLayerRef.current) wallsInnerLayerRef.current.remove();

    const { wallFeatures } = partitionFeatures(data.geojson.features as Feature<Geometry>[]);
    cemeteryBoundsRef.current = getBoundsFromFeatures(wallFeatures);

    wallsGlowLayerRef.current = L.geoJSON(buildFeatureCollection(wallFeatures), {
        style: {
          color: '#ffffff',
          weight: 5.2,
          opacity: 0.95,
          fill: false,
          lineCap: 'round',
          lineJoin: 'round',
        },
        pointToLayer: (_feature, latlng) => L.marker(latlng, { icon: L.divIcon({ className: 'hidden', iconSize: [0,0] }) }),
        pane: 'custom-walls-pane'
    }).addTo(mapRef.current);

    wallsOutlineLayerRef.current = L.geoJSON(buildFeatureCollection(wallFeatures), {
        style: {
          color: '#0f172a',
          weight: 2.7,
          opacity: 1,
          fill: false,
          lineCap: 'round',
          lineJoin: 'round',
        },
        pointToLayer: (_feature, latlng) => L.marker(latlng, { icon: L.divIcon({ className: 'hidden', iconSize: [0,0] }) }),
        pane: 'custom-walls-pane'
    }).addTo(mapRef.current);

    wallsInnerLayerRef.current = L.geoJSON(buildFeatureCollection(wallFeatures), {
        style: { color: 'transparent', weight: 0, fillColor: '#ffffff', fillOpacity: 0.18, fill: true },
        pointToLayer: (_feature, latlng) => L.marker(latlng, { icon: L.divIcon({ className: 'hidden', iconSize: [0,0] }) }),
        pane: 'custom-walls-pane'
    }).addTo(mapRef.current);

  }, [data]);

  // 6B. DYNAMIC LAYERS (Interactive)
  useEffect(() => {
      if (!mapRef.current || !data) return;
      
      if (interactiveLayerRef.current) interactiveLayerRef.current.remove();
      
    const { interactiveFeatures } = partitionFeatures(data.geojson.features as Feature<Geometry>[]);
    const routeStart = navPath && navPath.length >= 2 ? navPath[0] : null;
    const routeEnd = navPath && navPath.length >= 2 ? navPath[navPath.length - 1] : null;
    const isRouteEndpointPoint = (feature: Feature<Geometry>) => {
      if (feature.geometry?.type !== 'Point') return false;
      const [lng, lat] = feature.geometry.coordinates;
      const matches = (point: Coordinates | null) =>
        !!point && Math.abs(point.lat - lat) < 0.000001 && Math.abs(point.lng - lng) < 0.000001;
      return matches(routeStart) || matches(routeEnd);
    };

      interactiveLayerRef.current = L.geoJSON(buildFeatureCollection(interactiveFeatures), {
        filter: (feature) => {
            const name = feature.properties?.name || "";
            const isGate = /cancello\s*[1-3]/i.test(name);
            const isSelected = feature.id === selectedTrailId;
            if (isRouteEndpointPoint(feature)) return false;
            if (printMode) return isSelected;
            if (effectiveDisplayRotation !== 0) return isSelected;
            return isGate || showAllFeatures || isSelected; 
        },
        style: (feature) => {
            const isSelected = feature.id === selectedTrailId;
            return {
                color: isSelected ? '#ff8800' : (feature.properties?.stroke || '#16a34a'),
                weight: isSelected ? 8 : 3,
                opacity: 1,
                fillOpacity: isSelected ? 0.4 : 0.15
            };
        },
        pointToLayer: (feature, latlng) => {
          const isSelected = feature.id === selectedTrailId;
          const color = feature.properties?.stroke || "#16a34a";
          const name = feature.properties?.name || "";
          const isGate = /cancello\s*[1-3]/i.test(name);
          const size = getUnifiedMarkerSize(iconScale);
          const selectedIcon = createSelectedMarkerIcon(iconScale);

          if (isSelected) {
            return L.marker(latlng, {
              icon: selectedIcon,
              zIndexOffset: 2100,
              interactive: effectiveDisplayRotation === 0,
              pane: 'custom-interactive-pane'
            });
          }

          if (isGate) {
              return L.marker(latlng, {
                  icon: L.divIcon({
                      className: 'gate-marker-wrapper',
                      html: createGateMarkerHtml(size),
                      iconSize: [size, size],
                      iconAnchor: [size / 2, size]
                  }),
                  zIndexOffset: isSelected ? 2000 : 1600,
                  interactive: effectiveDisplayRotation === 0,
                  pane: 'custom-interactive-pane'
              });
          }

          return L.marker(latlng, {
              icon: L.divIcon({
                  className: 'poi-circle-icon',
                  html: createPoiMarkerHtml(size, color),
                  iconSize: [size, size],
                  iconAnchor: [size / 2, size]
              }),
              zIndexOffset: isSelected ? 2000 : 1000,
              interactive: effectiveDisplayRotation === 0,
              pane: 'custom-interactive-pane'
          });
        },
        interactive: effectiveDisplayRotation === 0,
        pane: 'custom-interactive-pane' 
      }).addTo(mapRef.current);

      setLayersReady(true);
  }, [data, selectedTrailId, showAllFeatures, effectiveDisplayRotation, iconScale, navPath]);

  // 7a. CREATE NAV PATH POLYLINES (runs when navPath changes)
  useEffect(() => {
    if (!mapRef.current || !layersReady) return;

    if (routeGlowRef.current) { routeGlowRef.current.remove(); routeGlowRef.current = null; }
    if (routeCompletedRef.current) { routeCompletedRef.current.remove(); routeCompletedRef.current = null; }
    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }
    if (navStartMarkerRef.current) { navStartMarkerRef.current.remove(); navStartMarkerRef.current = null; }
    if (navEndMarkerRef.current) { navEndMarkerRef.current.remove(); navEndMarkerRef.current = null; }

    if (navPath && navPath.length >= 2) {
      const latlngs = navPath.map((p) => [p.lat, p.lng] as L.LatLngTuple);

      // White glow behind the full path
      routeGlowRef.current = L.polyline(latlngs, {
        color: '#ffffff', weight: 5.5, opacity: 0.85, lineCap: 'round', lineJoin: 'round',
        className: 'nav-route-glow', interactive: false,
      }).addTo(mapRef.current);

      // Grey "completed" segment — empty initially, filled by progress effect
      routeCompletedRef.current = L.polyline([], {
        color: '#9ca3af', weight: 3, opacity: 0.65, lineCap: 'round', lineJoin: 'round',
        interactive: false,
      }).addTo(mapRef.current);

      // Blue "remaining" segment — starts as full path
      routeLineRef.current = L.polyline(latlngs, {
        color: '#2563eb', weight: 3, opacity: 1, dashArray: '10 6', lineCap: 'round', lineJoin: 'round',
        className: 'nav-route-line', interactive: false,
      }).addTo(mapRef.current);

      const start = navPath[0];
      navStartMarkerRef.current = L.marker([start.lat, start.lng], {
        icon: createNavStartIcon(iconScale), zIndexOffset: 3000, interactive: false,
      }).addTo(mapRef.current);

      const end = navPath[navPath.length - 1];
      navEndMarkerRef.current = L.marker([end.lat, end.lng], {
        icon: createNavEndIcon(iconScale), zIndexOffset: 3000, interactive: false,
      }).addTo(mapRef.current);
    }
  }, [navPath, layersReady, iconScale]);

  // 7b. UPDATE ROUTE PROGRESS SPLIT (runs when user position changes during active nav)
  useEffect(() => {
    if (!navPath || navPath.length < 2 || !layersReady || !navActive) return;
    if (!routeLineRef.current || !routeCompletedRef.current) return;
    if (!userLocation) return;

    const splitIdx = findClosestSegmentIndex(navPath, userLocation);
    // completed: from start to split point (inclusive)
    const completedLL = navPath
      .slice(0, splitIdx + 2)
      .map((p) => [p.lat, p.lng] as L.LatLngTuple);
    // remaining: from split point to end
    const remainingLL = navPath
      .slice(splitIdx)
      .map((p) => [p.lat, p.lng] as L.LatLngTuple);

    routeCompletedRef.current.setLatLngs(completedLL);
    routeLineRef.current.setLatLngs(remainingLL);
  }, [userLocation, navPath, layersReady, navActive]);


  useEffect(() => {
    handledPathZoomTriggerRef.current = 0;
  }, [navPath]);

  // PRINT STOP MARKERS — numbered circles at each multi-stop waypoint (print sandbox only)
  const printStopMarkerRefs = useRef<L.Marker[]>([]);
  useEffect(() => {
    printStopMarkerRefs.current.forEach((m) => m.remove());
    printStopMarkerRefs.current = [];

    if (!printMode || !mapRef.current || !layersReady || printStopMarkers.length === 0) return;

    printStopMarkers.forEach(({ lat, lng, step }) => {
      const icon = L.divIcon({
        className: 'bg-transparent',
        html: `<div class="print-stop-marker">${step}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([lat, lng], { icon, zIndexOffset: 5000, interactive: false });
      if (mapRef.current) marker.addTo(mapRef.current);
      printStopMarkerRefs.current.push(marker);
    });
  }, [printMode, printStopMarkers, layersReady]);

  // LIVE STOP MARKERS — numbered circles on the main map during multi-stop planning
  const liveStopMarkerRefs = useRef<L.Marker[]>([]);
  useEffect(() => {
    liveStopMarkerRefs.current.forEach((m) => m.remove());
    liveStopMarkerRefs.current = [];

    if (printMode || !mapRef.current || !layersReady || liveStopMarkers.length === 0) return;

    liveStopMarkers.forEach(({ lat, lng, step }) => {
      const icon = L.divIcon({
        className: 'bg-transparent',
        html: `<div style="
          width:26px;height:26px;border-radius:50%;
          background:var(--gm-accent,#1a56db);color:#fff;
          border:2.5px solid #fff;
          font-size:11px;font-weight:900;
          font-family:'DM Sans',Arial,sans-serif;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.45);
          line-height:1;
        ">${step}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([lat, lng], { icon, zIndexOffset: 4000, interactive: false });
      if (mapRef.current) marker.addTo(mapRef.current);
      liveStopMarkerRefs.current.push(marker);
    });
  }, [printMode, liveStopMarkers, layersReady]);

  // QUEUE PREVIEW MARKERS — amber numbered pins shown before route calculation
  const queuePreviewMarkerRefs = useRef<L.Marker[]>([]);
  useEffect(() => {
    queuePreviewMarkerRefs.current.forEach((m) => m.remove());
    queuePreviewMarkerRefs.current = [];

    if (printMode || !mapRef.current || !layersReady || queuePreviewMarkers.length === 0) return;

    queuePreviewMarkers.forEach(({ lat, lng, step }) => {
      const icon = L.divIcon({
        className: 'bg-transparent',
        html: `<div style="
          width:26px;height:26px;border-radius:50%;
          background:#f59e0b;color:#fff;
          border:2.5px solid #fff;
          font-size:11px;font-weight:900;
          font-family:'DM Sans',Arial,sans-serif;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.38);
          line-height:1;
        ">${step}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([lat, lng], { icon, zIndexOffset: 3500, interactive: false });
      if (mapRef.current) marker.addTo(mapRef.current);
      queuePreviewMarkerRefs.current.push(marker);
    });
  }, [printMode, queuePreviewMarkers, layersReady]);

  // SERVICE MARKERS — fontanelle, bagni, cestini, info
  const serviceMarkersRef = useRef<L.Marker[]>([]);
  useEffect(() => {
    serviceMarkersRef.current.forEach((m) => m.remove());
    serviceMarkersRef.current = [];
    if (!mapRef.current || !layersReady || !showServices || printMode) return;

    interface ServicePoint { id: string; lat: number; lng: number; name: string; }
    const configs: Array<{ key: string; emoji: string; color: string }> = [
      { key: 'fountains', emoji: '💧', color: '#2563eb' },
      { key: 'toilets',   emoji: '🚻', color: '#7c3aed' },
      { key: 'trash',     emoji: '🗑️', color: '#6b7280' },
      { key: 'info',      emoji: 'ℹ️', color: '#0891b2' },
    ];

    fetch('/data/services.json')
      .then((r) => r.json())
      .then((data: Record<string, ServicePoint[]>) => {
        configs.forEach(({ key, emoji, color }) => {
          (data[key] ?? []).forEach((p) => {
            const icon = L.divIcon({
              className: 'bg-transparent',
              html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${emoji}</div>`,
              iconSize: [28, 28], iconAnchor: [14, 14],
            });
            const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 900, interactive: true });
            marker.bindTooltip(p.name, { direction: 'top', offset: [0, -14] });
            if (mapRef.current) marker.addTo(mapRef.current);
            serviceMarkersRef.current.push(marker);
          });
        });
      })
      .catch(() => {});

    return () => {
      serviceMarkersRef.current.forEach((m) => m.remove());
      serviceMarkersRef.current = [];
    };
  }, [showServices, layersReady, printMode]);

  useEffect(() => {
    if (!mapRef.current || !layersReady || pathZoomTrigger <= 0) return;
    if (pathZoomTrigger === handledPathZoomTriggerRef.current) return;

    handledPathZoomTriggerRef.current = pathZoomTrigger;

    if (printMode && navPathRef.current && navPathRef.current.length > 0) {
      try {
        const fitOk = runPrintFit();
        if (fitOk) return;
      } catch (e) {
        console.warn('Bounds error', e);
      }
    }

    mapRef.current.invalidateSize({ animate: false });
    mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  }, [layersReady, pathZoomTrigger, printMode, runPrintFit]);

  // 7B. PREPARE PRINT VIEW (Deterministic print framing)
  useEffect(() => {
    if (!mapRef.current || preparePrintTrigger === 0) return;
    const map = mapRef.current;
    const tileLayer = tileLayerRef.current;
    if (!isPrintLayoutStableRef.current) {
      map.invalidateSize({ animate: false });
    }
    const center = map.getCenter();
    prePrintSnapshotRef.current = {
      center: [center.lat, center.lng],
      zoom: map.getZoom(),
    };

    let fitApplied = false;
    const shouldUseUserView = printViewLockedByUserRef.current && userPrintViewRef.current && !forceAutoPrintFitRef.current;
    const applyUserPrintView = () => {
      if (!userPrintViewRef.current) return false;
      isApplyingPrintFitRef.current = true;
      map.setView(userPrintViewRef.current.center, userPrintViewRef.current.zoom, { animate: false });
      const clearManualViewTimer = window.setTimeout(() => {
        isApplyingPrintFitRef.current = false;
      }, 220);
      map.once('moveend', () => {
        window.clearTimeout(clearManualViewTimer);
        isApplyingPrintFitRef.current = false;
      });
      return true;
    };

    if (shouldUseUserView) {
      applyUserPrintView();
      map.invalidateSize({ animate: false });
    } else {
      fitApplied = runPrintFit();
      forceAutoPrintFitRef.current = false;
    }

    const secondPassRaf = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      if (shouldUseUserView) {
        applyUserPrintView();
        return;
      }
      runPrintFit();
    });

    const secondPassTimer = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
      if (shouldUseUserView) {
        applyUserPrintView();
        return;
      }
      runPrintFit();
    }, 180);

    let done = false;

    const finalize = () => {
      if (done) return;
      done = true;
      map.off('moveend', finalize);
      if (tileLayer) {
        tileLayer.off('load', finalize);
      }
      onPrintPrepared?.();
    };

    const waitForTilesIfNeeded = () => {
      if (!tileLayer || !tileLayer.isLoading()) {
        finalize();
        return;
      }
      tileLayer.once('load', finalize);
    };

    if (fitApplied) {
      map.once('moveend', waitForTilesIfNeeded);
      const fallbackDelay = printFitAttemptRef.current > 1 ? 1800 : 1400;
      const fallbackTimer = window.setTimeout(finalize, fallbackDelay);
      return () => {
        window.cancelAnimationFrame(secondPassRaf);
        window.clearTimeout(secondPassTimer);
        window.clearTimeout(fallbackTimer);
        map.off('moveend', finalize);
        map.off('moveend', waitForTilesIfNeeded);
        if (tileLayer) {
          tileLayer.off('load', finalize);
        }
      };
    }

    waitForTilesIfNeeded();
    const fallbackTimer = window.setTimeout(finalize, 1200);
    return () => {
      window.cancelAnimationFrame(secondPassRaf);
      window.clearTimeout(secondPassTimer);
      window.clearTimeout(fallbackTimer);
      if (tileLayer) {
        tileLayer.off('load', finalize);
      }
    };
  }, [preparePrintTrigger, runPrintFit, onPrintPrepared]);

  // 7D. RESTORE PRE-PRINT VIEW
  useEffect(() => {
    if (!mapRef.current || restorePrintViewTrigger === 0) return;
    const snapshot = prePrintSnapshotRef.current;
    if (!snapshot) return;
    const map = mapRef.current;
    isApplyingPrintFitRef.current = true;
    map.setView(snapshot.center, snapshot.zoom, { animate: false });
    map.once('moveend', () => {
      isApplyingPrintFitRef.current = false;
    });
    window.setTimeout(() => {
      isApplyingPrintFitRef.current = false;
    }, 150);
    prePrintSnapshotRef.current = null;
    forceAutoPrintFitRef.current = false;
  }, [restorePrintViewTrigger]);

  // 8. ZOOM SELECTION
  useEffect(() => {
    if (!mapRef.current || !data || !selectedTrailId || zoomTrigger === 0) return;
    const feature = getFeatureById(selectedTrailId);
    if (!feature) return;

    if (feature.geometry.type === 'Point') {
        mapRef.current.setView(
          toLatLngTuple(feature.geometry.coordinates),
          isMobile ? 17.6 : MAX_MAP_ZOOM,
          { animate: true }
        );
    } else {
        const layer = L.geoJSON(feature);
        mapRef.current.fitBounds(layer.getBounds(), {
          padding: [50, 50],
          maxZoom: isMobile ? 17.6 : MAX_MAP_ZOOM,
        });
    }
  }, [selectedTrailId, zoomTrigger, data, getFeatureById, isMobile]);

  return (
    <div
        ref={wrapperRef}
        role="application"
        aria-label="Mappa interattiva del cimitero"
        className={`leaflet-map-wrapper ${isLowZoom ? 'map-zoom-low' : 'map-zoom-high'}`}
        style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            background: '#1a1a1a',
            touchAction: effectiveDisplayRotation !== 0 ? 'none' : 'manipulation',
            WebkitUserSelect: 'none'
        }}
    >
        <div 
            ref={containerRef}
            style={{ 
                width: printMode ? '100%' : effectiveDisplayRotation !== 0 ? (isMobile ? '260vmax' : '220vmax') : '150vmax', 
                height: printMode ? '100%' : effectiveDisplayRotation !== 0 ? (isMobile ? '260vmax' : '220vmax') : '150vmax',
                position: 'absolute',
                top: printMode ? '0' : '50%',
                left: printMode ? '0' : '50%',
                transform: printMode ? 'none' : `translate(-50%, -50%) rotate(${effectiveDisplayRotation}deg)`,
                transition: printMode
                  ? 'none'
                  : effectiveDisplayRotation !== 0
                    ? 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)'
                    : isMobile
                      ? 'none'
                      : 'transform 0.3s ease-out',
                transformOrigin: 'center center',
                willChange: printMode ? 'auto' : 'transform',
            }} 
            className="leaflet-map-canvas z-0"
        />
    </div>
  );
};

export default LeafletMap;
