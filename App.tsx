import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Feature, Geometry } from 'geojson';
import {
  Compass,
  Loader2,
  Target,
  WifiOff,
} from 'lucide-react';
import BottomSheet from './components/BottomSheet';
import CompassCalibrationModal from './components/CompassCalibrationModal';
import MultiStopPanel from './components/MultiStopPanel';
import HelpModal from './components/HelpModal';
import InfoSidebarDesktop from './components/InfoSidebarDesktop';
import InfoModal from './components/InfoModal';
import InstallAppModal from './components/InstallAppModal';
import LeafletMap from './components/LeafletMap';
import Lightbox from './components/Lightbox';
import NavigationUI from './components/NavigationUI';
import PrintSandbox, { PrintSandboxHandle } from './components/PrintSandbox';
import PrintModal from './components/PrintModal';
import QrShareModal from './components/QrShareModal';
import QuickActionsFab from './components/QuickActionsFab';
import SearchBar from './components/SearchBar';
import { useDeviceSensors } from './hooks/useDeviceSensors';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useMapData } from './hooks/useMapData';
import { useNavigationMapRotation } from './hooks/useNavigationMapRotation';
import { useFavorites } from './hooks/useFavorites';
import { useOpeningHours } from './hooks/useOpeningHours';
import { useVoiceGuidance } from './hooks/useVoiceGuidance';
import { parseDeepLink } from './services/deeplink';
import { Coordinates, TrailData } from './types';
import { calculateDistance, computePathDistance, distToPath } from './utils';

const MAP_ID = '1dzlxUTK3bz-7kChq1HASlXEpn6t5uQ8';
const SPLASH_MAX_WAIT_MS = 7000;

type RouteMode = 'idle' | 'navigating' | 'planning';
type AppToastTone = 'info' | 'warning' | 'error';

interface NavState {
  routeMode: RouteMode;
  isCalculatingPath: boolean;
  navDestination: Coordinates | null;
  navPath: Coordinates[] | null;
  followUser: boolean;
}

type NavAction =
  | { type: 'START_CALCULATION' }
  | { type: 'ROUTE_READY'; path: Coordinates[]; destination: Coordinates; mode: RouteMode }
  | { type: 'CALCULATION_DONE' }
  | { type: 'STOP_NAVIGATION' }
  | { type: 'CANCEL_PLANNING' }
  | { type: 'SET_FOLLOW'; follow: boolean }
  | { type: 'RESTORE_FOLLOW' };

const navInitialState: NavState = {
  routeMode: 'idle',
  isCalculatingPath: false,
  navDestination: null,
  navPath: null,
  followUser: false,
};

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'START_CALCULATION':
      return { ...state, isCalculatingPath: true };
    case 'ROUTE_READY':
      return {
        ...state,
        navPath: action.path,
        navDestination: action.destination,
        routeMode: action.mode,
        isCalculatingPath: false,
        followUser: action.mode === 'navigating',
      };
    case 'CALCULATION_DONE':
      return { ...state, isCalculatingPath: false };
    case 'STOP_NAVIGATION':
      return { ...navInitialState };
    case 'CANCEL_PLANNING':
      return { ...state, routeMode: 'idle', navDestination: null, navPath: null };
    case 'SET_FOLLOW':
      return { ...state, followUser: action.follow };
    case 'RESTORE_FOLLOW':
      return { ...state, followUser: true };
    default:
      return state;
  }
}

const extractDestinationFromTrail = (trail: TrailData, feature: Feature<Geometry> | undefined): Coordinates | null => {
  if (trail.coordinates) {
    return { lat: trail.coordinates.lat, lng: trail.coordinates.lng };
  }

  if (!feature?.geometry) return null;
  const geom = feature.geometry;

  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates;
    return { lat, lng };
  }

  if (geom.type === 'LineString') {
    const first = geom.coordinates[0];
    if (!first) return null;
    return { lat: first[1], lng: first[0] };
  }

  if (geom.type === 'Polygon') {
    const first = geom.coordinates[0]?.[0];
    if (!first) return null;
    return { lat: first[1], lng: first[0] };
  }

  return null;
};

export default function App() {
  const { data, gates, loading: mapLoading, error: mapError, pathfinder } = useMapData(MAP_ID);
  const { isMobile, gpsData, gpsLoading, userLocation, ensureCompassPermission } = useDeviceSensors();
  const deepLink = useMemo(
    () =>
      typeof window === 'undefined'
        ? { focusId: null, openPrint: false }
        : parseDeepLink(window.location.search),
    []
  );

  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [nav, dispatchNav] = useReducer(navReducer, navInitialState);
  const { routeMode, isCalculatingPath, navDestination, navPath, followUser } = nav;
  const [navPathDistance, setNavPathDistance] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [zoomToSelection, setZoomToSelection] = useState(0);
  const [zoomToPath, setZoomToPath] = useState(0);
  const [preparePrintLayoutTrigger, setPreparePrintLayoutTrigger] = useState(0);
  const [preparePrintTrigger, setPreparePrintTrigger] = useState(0);
  const [restorePrintViewTrigger, setRestorePrintViewTrigger] = useState(0);
  const [resetMapTrigger, setResetMapTrigger] = useState(0);
  const [printInColor, setPrintInColor] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showCompassCalibration, setShowCompassCalibration] = useState(false);
  const [selectedPrintGate, setSelectedPrintGate] = useState<TrailData | null>(null);
  const [searchOpenRequestKey, setSearchOpenRequestKey] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [isStartupSplashLeaving, setIsStartupSplashLeaving] = useState(false);
  const [appToast, setAppToast] = useState<{ id: number; message: string; tone: AppToastTone } | null>(null);
  const [multiStopQueue, setMultiStopQueue] = useState<TrailData[]>([]);
  const [multiStopSegmentPaths, setMultiStopSegmentPaths] = useState<import('./types').Coordinates[][]>([]);
  const [multiStopSortedStops, setMultiStopSortedStops] = useState<TrailData[]>([]);
  const routeRequestRef = useRef(0);
  const arrivedRef = useRef(false);
  const rerouteOffTrackSinceRef = useRef<number | null>(null);
  const routeCalculatedAtRef = useRef<number>(0);
  const closingNotifTimerRef = useRef<number | null>(null);
  const pendingLayoutResolveRef = useRef<(() => void) | null>(null);
  const pendingLayoutTimeoutRef = useRef<number | null>(null);
  const pendingPrintResolveRef = useRef<(() => void) | null>(null);
  const pendingPrintTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const printSandboxRef = useRef<PrintSandboxHandle | null>(null);
  const deepLinkHandledRef = useRef(false);
  const splashStartRef = useRef(performance.now());
  const installStateInitializedRef = useRef(false);
  const previousInstalledRef = useRef(false);

  const isNavigating = routeMode === 'navigating';
  const isPlanning = routeMode === 'planning';
  const { canInstall, canPromptInstall, isInstalled, isAndroidManualInstall, isIosManualInstall, promptInstall } = useInstallPrompt(isMobile);
  const navigationMapRotation = useNavigationMapRotation(isMobile && isNavigating, userLocation, navPath);
  const { isOpen: cemeteryOpen, statusLabel: cemeteryStatus, minutesUntilChange } = useOpeningHours();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const selectedTrail = useMemo(() => {
    if (!selectedTrailId || !data) return null;
    return data.idMap[selectedTrailId] ?? null;
  }, [data, selectedTrailId]);

  // ── Voice guidance ────────────────────────────────────────────────────────
  const distanceToDest_forVoice = useMemo(() => {
    if (isNavigating && userLocation && navDestination) {
      return calculateDistance(userLocation.lat, userLocation.lng, navDestination.lat, navDestination.lng);
    }
    return 0;
  }, [isNavigating, userLocation, navDestination]);

  const { voiceEnabled, toggleVoice, speak } = useVoiceGuidance({
    isNavigating,
    destinationName: selectedTrail?.name ?? '',
    distanceToDest: distanceToDest_forVoice,
    navPath,
    userLocation,
    pathDistance: navPathDistance,
  });

  const showToast = useCallback((message: string, tone: AppToastTone = 'info', durationMs = 3200) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setAppToast({ id: Date.now(), message, tone });
    toastTimeoutRef.current = window.setTimeout(() => {
      setAppToast(null);
      toastTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pendingLayoutTimeoutRef.current !== null) {
        window.clearTimeout(pendingLayoutTimeoutRef.current);
        pendingLayoutTimeoutRef.current = null;
      }
      if (pendingPrintTimeoutRef.current !== null) {
        window.clearTimeout(pendingPrintTimeoutRef.current);
        pendingPrintTimeoutRef.current = null;
      }
      if (pendingLayoutResolveRef.current) {
        pendingLayoutResolveRef.current();
        pendingLayoutResolveRef.current = null;
      }
      if (pendingPrintResolveRef.current) {
        pendingPrintResolveRef.current();
        pendingPrintResolveRef.current = null;
      }
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!data || deepLinkHandledRef.current) return;

    deepLinkHandledRef.current = true;
    if (!deepLink.focusId) return;

    const deepLinkedTrail = data.idMap[deepLink.focusId];
    if (!deepLinkedTrail) {
      showToast('Link non valido o punto non trovato.', 'warning');
      return;
    }

    setSelectedTrailId(deepLinkedTrail.id);
    window.setTimeout(() => setZoomToSelection((prev) => prev + 1), 80);

    // Restore multi-stop queue from deeplink
    if (deepLink.stopIds && deepLink.stopIds.length > 0) {
      const stops = deepLink.stopIds
        .map((id) => data.idMap[id])
        .filter((t): t is TrailData => !!t);
      if (stops.length > 0) {
        setMultiStopQueue(stops);
        showToast(`Percorso con ${stops.length} tapp${stops.length === 1 ? 'a' : 'e'} ripristinato.`, 'info', 3000);
      }
    }

    if (deepLink.openPrint && !isMobile) {
      window.setTimeout(() => setShowPrintModal(true), 120);
    }
  }, [data, deepLink.focusId, deepLink.openPrint, deepLink.stopIds, isMobile, showToast]);

  useEffect(() => {
    if (!showStartupSplash) return;
    if (mapLoading && !mapError) return;

    const elapsed = performance.now() - splashStartRef.current;
    const exitDelay = Math.max(0, 950 - elapsed);

    const leaveTimer = window.setTimeout(() => {
      setIsStartupSplashLeaving(true);
    }, exitDelay);

    const hideTimer = window.setTimeout(() => {
      setShowStartupSplash(false);
    }, exitDelay + 420);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [mapError, mapLoading, showStartupSplash]);

  useEffect(() => {
    if (!showStartupSplash) return;

    const hardStopTimer = window.setTimeout(() => {
      setIsStartupSplashLeaving(true);
      window.setTimeout(() => setShowStartupSplash(false), 420);

      if (mapLoading && !mapError) {
        showToast('Caricamento dati più lento del previsto. Verifica rete e disponibilità del servizio.', 'warning', 4800);
      }
    }, SPLASH_MAX_WAIT_MS);

    return () => {
      window.clearTimeout(hardStopTimer);
    };
  }, [mapError, mapLoading, showStartupSplash, showToast]);

  useEffect(() => {
    if (!installStateInitializedRef.current) {
      installStateInitializedRef.current = true;
      previousInstalledRef.current = isInstalled;
      return;
    }

    if (!previousInstalledRef.current && isInstalled) {
      showToast('Applicazione installata correttamente sul dispositivo.', 'info', 3200);
      setShowInstallModal(false);
    }
    previousInstalledRef.current = isInstalled;
  }, [isInstalled, showToast]);

  // ── Total path distance ───────────────────────────────────────────────────
  useEffect(() => {
    setNavPathDistance(navPath && navPath.length >= 2 ? computePathDistance(navPath) : 0);
  }, [navPath]);


  // ── Closing-time notification (30 min before) ─────────────────────────────
  useEffect(() => {
    if (closingNotifTimerRef.current !== null) return; // already scheduled
    if (!cemeteryOpen || minutesUntilChange <= 30) return;

    const msDelay = (minutesUntilChange - 30) * 60_000;
    closingNotifTimerRef.current = window.setTimeout(async () => {
      closingNotifTimerRef.current = null;
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification('Cimitero Centrale — Chiusura imminente', {
          body: 'Il cimitero chiude tra 30 minuti.',
          icon: '/icons/icon-192.png',
          tag: 'closing-soon',
        });
      }
    }, msDelay);

    return () => {
      if (closingNotifTimerRef.current !== null) {
        window.clearTimeout(closingNotifTimerRef.current);
        closingNotifTimerRef.current = null;
      }
    };
  }, [cemeteryOpen, minutesUntilChange]);

  // ── KML background sync registration ─────────────────────────────────────
  useEffect(() => {
    if (!navigator.onLine || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        type SWReg = ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        return (reg as SWReg).sync?.register('kml-update');
      })
      .catch(() => { /* background sync not available */ });
  }, []);

  // ── KML updated message from SW ───────────────────────────────────────────
  useEffect(() => {
    const handleMsg = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === 'KML_UPDATED') {
        showToast('Mappa aggiornata in background.', 'info', 3200);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMsg);
  }, [showToast]);

  const clearSelection = useCallback(() => {
    setSelectedTrailId(null);
    setShowPrintModal(false);
    setShowQrModal(false);
    setSelectedPrintGate(null);
    if (routeMode === 'planning') {
      dispatchNav({ type: 'CANCEL_PLANNING' });
    }
  }, [routeMode]);

  const stopNavigation = useCallback(() => {
    routeRequestRef.current += 1;
    dispatchNav({ type: 'STOP_NAVIGATION' });
    setSelectedTrailId(null);
    setShowPrintModal(false);
    setShowQrModal(false);
    setMultiStopQueue([]);
    setMultiStopSegmentPaths([]); setMultiStopSortedStops([]);
    setSelectedPrintGate(null);
  }, []);

  const handleSelectTrailId = useCallback(
    (id: string, shouldZoom = false) => {
      if (isNavigating) return;

      setSelectedTrailId(id);
      setShowQrModal(false);
      // If this trail is already queued as an extra stop, remove it and clear
      // any cached route — it can't be both the primary destination and in queue.
      // NOTE: setState calls must NOT be nested inside other setState updaters;
      // read the current multiStopQueue from the closure instead.
      if (multiStopQueue.some((t) => t.id === id)) {
        setMultiStopQueue((prev) => prev.filter((t) => t.id !== id));
        setMultiStopSegmentPaths([]);
        setMultiStopSortedStops([]);
      }
      if (isPlanning) {
        dispatchNav({ type: 'CANCEL_PLANNING' });
      }
      if (shouldZoom) {
        window.setTimeout(() => setZoomToSelection((prev) => prev + 1), 50);
      }
    },
    [isNavigating, isPlanning, multiStopQueue]
  );

  const calculateRoute = useCallback(
    async (start: Coordinates, trail: TrailData, mode: Extract<RouteMode, 'navigating' | 'planning'>) => {
      if (!pathfinder || !data) return;
      const feature = data.featureMap[trail.id];
      const targetCoords = extractDestinationFromTrail(trail, feature);
      if (!targetCoords) return;

      const requestId = ++routeRequestRef.current;
      dispatchNav({ type: 'START_CALCULATION' });
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      try {
        const calculatedPath = await pathfinder.findPath(start, targetCoords);
        if (requestId !== routeRequestRef.current) return;

        routeCalculatedAtRef.current = Date.now();
        rerouteOffTrackSinceRef.current = null;
        setSelectedTrailId(trail.id);
        dispatchNav({ type: 'ROUTE_READY', path: calculatedPath, destination: targetCoords, mode });

        if (mode === 'planning') {
          window.setTimeout(() => setZoomToPath((prev) => prev + 1), 100);
        }
      } catch (error) {
        console.error('Path calculation failed', error);
        showToast('Errore nel calcolo del percorso.', 'error');
      } finally {
        if (requestId === routeRequestRef.current) {
          dispatchNav({ type: 'CALCULATION_DONE' });
        }
      }
    },
    [data, pathfinder, showToast]
  );

  const startNavigation = useCallback(
    (trail: TrailData) => {
      if (!isMobile) {
        showToast('Navigazione GPS disponibile solo su dispositivi mobili.', 'info');
        return;
      }
      if (!gpsData) {
        showToast('In attesa del segnale GPS... Assicurati di essere all\'aperto.', 'warning');
        return;
      }
      void ensureCompassPermission();
      calculateRoute({ lat: gpsData.lat, lng: gpsData.lng }, trail, 'navigating');
    },
    [calculateRoute, ensureCompassPermission, gpsData, isMobile, pathfinder, showToast]
  );

  // Multi-stop handlers
  const addMultiStop = useCallback(
    (trail: TrailData) => {
      setMultiStopQueue((prev) => {
        if (prev.some((t) => t.id === trail.id)) return prev;
        // Insert sorted by distance from current GPS (nearest first); fallback: append
        if (!userLocation) return [...prev, trail];
        const dist = (t: TrailData) =>
          t.coordinates
            ? calculateDistance(userLocation.lat, userLocation.lng, t.coordinates.lat, t.coordinates.lng)
            : Infinity;
        const newList = [...prev, trail].sort((a, b) => dist(a) - dist(b));
        return newList;
      });
      showToast(`Tappa aggiunta: ${trail.name}`, 'info', 2000);
    },
    [userLocation, showToast]
  );

  const removeMultiStop = useCallback((id: string) => {
    setMultiStopQueue((prev) => prev.filter((t) => t.id !== id));
    setMultiStopSegmentPaths([]); setMultiStopSortedStops([]); // invalidate cached paths
  }, []);

  const clearMultiStops = useCallback(() => {
    setMultiStopQueue([]);
    setMultiStopSegmentPaths([]); setMultiStopSortedStops([]);
  }, []);

  // Desktop: add stop in click order (no GPS sorting)
  const addMultiStopDesktop = useCallback(
    (trail: TrailData) => {
      setMultiStopQueue((prev) => {
        if (prev.some((t) => t.id === trail.id)) return prev;
        return [...prev, trail];
      });
      setMultiStopSegmentPaths([]); setMultiStopSortedStops([]); // invalidate cached paths — recalculate on next print
      showToast(`Tappa aggiunta: ${trail.name}`, 'info', 2000);
    },
    [showToast]
  );

  const handleInstallApp = useCallback(async () => {
    if (canPromptInstall) {
      const result = await promptInstall();
      if (result === 'dismissed') {
        showToast('Installazione annullata.', 'warning', 2200);
      } else if (result === 'unsupported') {
        setShowInstallModal(true);
      }
      return;
    }

    setShowInstallModal(true);
  }, [canPromptInstall, promptInstall, showToast]);

  const restoreNavigationView = useCallback(() => {
    if (!userLocation) return;
    void ensureCompassPermission();
    dispatchNav({ type: 'RESTORE_FOLLOW' });
  }, [ensureCompassPermission, userLocation]);

  const handlePlanRouteFromGate = useCallback(
    async (gate: TrailData) => {
      if (!selectedTrailId || !data?.idMap[selectedTrailId] || !gate.coordinates || !pathfinder) return;
      setSelectedPrintGate(gate);

      const primaryStop = data.idMap[selectedTrailId];

      if (multiStopQueue.length === 0) {
        // Single-stop: existing flow
        setMultiStopSegmentPaths([]); setMultiStopSortedStops([]);
        calculateRoute(
          { lat: gate.coordinates.lat, lng: gate.coordinates.lng },
          primaryStop,
          'planning'
        );
        return;
      }

      // Multi-stop: nearest-neighbor using ACTUAL A* path distances (parallel per round)
      // For each step, compute A* from current position to ALL remaining stops concurrently,
      // then pick the stop with the shortest real walking distance (not Euclidean).
      const gateCoord = { lat: gate.coordinates.lat, lng: gate.coordinates.lng };
      const requestId = ++routeRequestRef.current;
      dispatchNav({ type: 'START_CALCULATION' });
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      try {
        const paths: import('./types').Coordinates[][] = [];
        const sortedStops: TrailData[] = [];
        let prevCoord = gateCoord;
        // Deduplicate by ID — selectedTrail may accidentally equal a queued stop
        const seenIds = new Set<string>();
        const remaining: TrailData[] = [primaryStop, ...multiStopQueue].filter(s => {
          if (!s.coordinates || seenIds.has(s.id)) return false;
          seenIds.add(s.id);
          return true;
        });
        const totalStops = remaining.length;

        while (remaining.length > 0) {
          if (requestId !== routeRequestRef.current) return;

          const stepNum = totalStops - remaining.length + 1;
          if (totalStops > 1) {
            showToast(`Calcolo tappa ${stepNum} di ${totalStops}...`, 'info', 1800);
          }

          // Run A* to all remaining stops in parallel — each has its own isolated grid
          const results = await Promise.all(
            remaining.map(async (stop) => {
              const dest = { lat: stop.coordinates!.lat, lng: stop.coordinates!.lng };
              const path = await pathfinder.findPath(prevCoord, dest);
              return { stop, path, dist: computePathDistance(path) };
            })
          );

          if (requestId !== routeRequestRef.current) return;

          // Pick the stop reachable via the shortest ACTUAL walked distance
          results.sort((a, b) => a.dist - b.dist);
          const best = results[0];

          sortedStops.push(best.stop);
          paths.push(best.path);
          prevCoord = { lat: best.stop.coordinates!.lat, lng: best.stop.coordinates!.lng };
          remaining.splice(remaining.indexOf(best.stop), 1);
        }

        if (requestId !== routeRequestRef.current) return;

        const lastStop = sortedStops[sortedStops.length - 1];
        const lastCoord = { lat: lastStop.coordinates!.lat, lng: lastStop.coordinates!.lng };
        const combinedPath = paths.flat();

        setMultiStopSortedStops(sortedStops);
        setMultiStopSegmentPaths(paths);
        dispatchNav({ type: 'ROUTE_READY', path: combinedPath, destination: lastCoord, mode: 'planning' });
        window.setTimeout(() => setZoomToPath((prev) => prev + 1), 100);
      } catch (err) {
        console.error('Multi-stop calculation failed', err);
        showToast('Errore nel calcolo del percorso multi-tappa.', 'error');
      } finally {
        if (requestId === routeRequestRef.current) {
          dispatchNav({ type: 'CALCULATION_DONE' });
        }
      }
    },
    [calculateRoute, data, selectedTrailId, pathfinder, multiStopQueue, showToast]
  );

  const handlePrintPrepared = useCallback(() => {
    if (pendingPrintTimeoutRef.current !== null) {
      window.clearTimeout(pendingPrintTimeoutRef.current);
      pendingPrintTimeoutRef.current = null;
    }
    if (pendingPrintResolveRef.current) {
      pendingPrintResolveRef.current();
      pendingPrintResolveRef.current = null;
    }
  }, []);

  const handlePrintLayoutReady = useCallback(() => {
    if (pendingLayoutTimeoutRef.current !== null) {
      window.clearTimeout(pendingLayoutTimeoutRef.current);
      pendingLayoutTimeoutRef.current = null;
    }
    if (pendingLayoutResolveRef.current) {
      pendingLayoutResolveRef.current();
      pendingLayoutResolveRef.current = null;
    }
  }, []);

  const handlePrepareAndPrint = useCallback(async () => {
    if (isCalculatingPath || !navPath || navPath.length < 2) return;

    try {
      if (!printSandboxRef.current) {
        showToast('Sandbox di stampa non pronto.', 'error');
        return;
      }

      await new Promise<void>((resolve) => {
        pendingLayoutResolveRef.current = resolve;
        if (pendingLayoutTimeoutRef.current !== null) {
          window.clearTimeout(pendingLayoutTimeoutRef.current);
        }
        pendingLayoutTimeoutRef.current = window.setTimeout(() => {
          if (pendingLayoutResolveRef.current) {
            pendingLayoutResolveRef.current();
            pendingLayoutResolveRef.current = null;
          }
          pendingLayoutTimeoutRef.current = null;
        }, 1200);

        setPreparePrintLayoutTrigger((prev) => prev + 1);
      });

      await new Promise<void>((resolve) => {
        pendingPrintResolveRef.current = resolve;
        if (pendingPrintTimeoutRef.current !== null) {
          window.clearTimeout(pendingPrintTimeoutRef.current);
        }
        pendingPrintTimeoutRef.current = window.setTimeout(() => {
          if (pendingPrintResolveRef.current) {
            pendingPrintResolveRef.current();
            pendingPrintResolveRef.current = null;
          }
          pendingPrintTimeoutRef.current = null;
        }, 1800);

        setPreparePrintTrigger((prev) => prev + 1);
      });

      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await printSandboxRef.current.print(printInColor);
      setRestorePrintViewTrigger((prev) => prev + 1);
    } catch (error) {
      console.error('Errore durante la preparazione della stampa', error);
      showToast('Errore durante la stampa del percorso.', 'error');
    }
  }, [isCalculatingPath, navPath, printInColor, showToast]);

  const distanceToDest = useMemo(() => {
    if (isNavigating && userLocation && navDestination) {
      return calculateDistance(userLocation.lat, userLocation.lng, navDestination.lat, navDestination.lng);
    }

    if (isPlanning && navPath && navPath.length >= 2) {
      return calculateDistance(
        navPath[0].lat,
        navPath[0].lng,
        navPath[navPath.length - 1].lat,
        navPath[navPath.length - 1].lng
      );
    }

    return 0;
  }, [isNavigating, isPlanning, navDestination, navPath, userLocation]);

  const printDistanceLabel = useMemo(() => {
    if (navPathDistance <= 0) return '--';
    if (navPathDistance >= 1000) return `${(navPathDistance / 1000).toFixed(2)} km`;
    return `${Math.round(navPathDistance)} m`;
  }, [navPathDistance]);


  const isMultiStopPrint = multiStopSegmentPaths.length > 0;

  const printFromGateLabel = selectedPrintGate?.name || 'Cancello non selezionato';
  const printDestinationLabel = isMultiStopPrint
    ? `${multiStopSortedStops.length || [selectedTrail, ...multiStopQueue].length} tappe`
    : selectedTrail?.name || '--';

  // Per-segment distances (metres) — derived from actual A* paths
  const segmentDistancesM = useMemo(
    () => multiStopSegmentPaths.map((p) => computePathDistance(p)),
    [multiStopSegmentPaths]
  );

  // Per-segment stop data for print layout — uses actual sorted order from routing
  const printStops = useMemo(() => {
    if (!isMultiStopPrint) return [];
    const stopsInOrder = multiStopSortedStops.length > 0
      ? multiStopSortedStops
      : [selectedTrail, ...multiStopQueue].filter((s): s is TrailData => !!s);
    return stopsInOrder.map((stop, i) => ({
      name: stop?.name ?? `Tappa ${i + 1}`,
      distanceM: segmentDistancesM[i] ?? 0,
    }));
  }, [isMultiStopPrint, segmentDistancesM, multiStopSortedStops, multiStopQueue, selectedTrail]);

  // Markers at each stop endpoint for the print map
  const printStopMarkers = useMemo(() => {
    if (!isMultiStopPrint) return [];
    return multiStopSegmentPaths.map((path, i) => {
      const last = path[path.length - 1];
      return last ? { lat: last.lat, lng: last.lng, step: i + 1 } : null;
    }).filter((m): m is { lat: number; lng: number; step: number } => m !== null);
  }, [isMultiStopPrint, multiStopSegmentPaths]);

  // Amber preview markers for queued stops — shown on the main map before route calculation.
  // Numbered 1-N to match the sidebar queue list (primary trail shown separately by its own pin).
  const queuePreviewMarkers = useMemo(() => {
    if (isMultiStopPrint || multiStopQueue.length === 0) return [];
    return multiStopQueue
      .filter((t): t is TrailData => !!t && !!t.coordinates)
      .map((stop, i) => ({
        lat: stop.coordinates!.lat,
        lng: stop.coordinates!.lng,
        step: i + 1,
      }));
  }, [isMultiStopPrint, multiStopQueue]);

  // ── Proximity alert (≤10 m) — must be after distanceToDest ───────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isNavigating) {
      arrivedRef.current = false;
      return;
    }
    if (distanceToDest <= 0 || distanceToDest > 10) return;
    if (arrivedRef.current) return;

    arrivedRef.current = true;

    setMultiStopQueue((prev) => {
      if (prev.length === 0) {
        // Normal single-destination arrival
        showToast('Sei arrivato a destinazione!', 'info', 5000);
        speak('Sei arrivato a destinazione.');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
        return prev;
      }

      // Multi-stop: chain to next stop
      const [nextStop, ...remaining] = prev;
      const currentName = selectedTrail?.name ?? 'destinazione';
      showToast(`Arrivato a ${currentName}. Proseguendo verso ${nextStop.name}.`, 'info', 4000);
      speak(`Arrivato a ${currentName}. Proseguendo verso ${nextStop.name}.`);
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

      // Delay slightly so the toast is visible before rerouting
      window.setTimeout(() => {
        arrivedRef.current = false;
        if (userLocation) {
          handleSelectTrailId(nextStop.id, false);
          calculateRoute({ lat: userLocation.lat, lng: userLocation.lng }, nextStop, 'navigating');
        }
      }, 1500);

      return remaining;
    });
  }, [isNavigating, distanceToDest, showToast, speak]);

  // ── Auto-reroute (>20 m off-track for >4 s) — must be after calculateRoute
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isNavigating || !userLocation || !navPath || navPath.length < 2) {
      rerouteOffTrackSinceRef.current = null;
      return;
    }
    if (Date.now() - routeCalculatedAtRef.current < 5000) return;

    const offDist = distToPath(navPath, userLocation);
    if (offDist > 20) {
      if (rerouteOffTrackSinceRef.current === null) {
        rerouteOffTrackSinceRef.current = Date.now();
      } else if (Date.now() - rerouteOffTrackSinceRef.current > 4000) {
        rerouteOffTrackSinceRef.current = null;
        showToast('Ricalcolo percorso...', 'info', 2500);
        if (selectedTrail) {
          calculateRoute(
            { lat: userLocation.lat, lng: userLocation.lng },
            selectedTrail,
            'navigating'
          );
        }
      }
    } else {
      rerouteOffTrackSinceRef.current = null;
    }
  }, [isNavigating, userLocation, navPath, calculateRoute, selectedTrail, showToast]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--gm-app-bg)]">
      {showStartupSplash && (
        <div className={`app-startup-splash${isStartupSplashLeaving ? ' is-leaving' : ''}`}>
          <div className="app-startup-orb app-startup-orb-a" />
          <div className="app-startup-orb app-startup-orb-b" />
          <div className="app-startup-card">
            <div className="app-startup-logo-wrap">
              <img
                src="https://www.aspes.it/wp-content/uploads/2022/05/logo_notesto.png"
                alt="Logo Aspes"
                className="app-startup-logo"
              />
            </div>
            <p className="app-startup-eyebrow">ASPES Pesaro</p>
            <h1 className="app-startup-title">Mappa Cimiteriale</h1>
            <div className="app-startup-loader">
              <span className="app-startup-loader-bar" />
            </div>
          </div>
        </div>
      )}

      <LeafletMap
        data={data}
        selectedTrailId={selectedTrailId}
        onSelectTrail={handleSelectTrailId}
        onClearSelection={clearSelection}
        userLocation={userLocation}
        destination={navDestination}
        navPath={navPath}
        navActive={isNavigating || isPlanning}
        showAllFeatures={showAllFeatures}
        followUser={followUser}
        mapRotation={navigationMapRotation}
        onManualDrag={() => dispatchNav({ type: 'SET_FOLLOW', follow: false })}
        zoomTrigger={zoomToSelection}
        pathZoomTrigger={zoomToPath}
        resetViewTrigger={resetMapTrigger}
        liveStopMarkers={isPlanning && isMultiStopPrint ? printStopMarkers : []}
        queuePreviewMarkers={queuePreviewMarkers}
      />

      {isOffline && (
        <div className="fixed top-4 right-16 z-[4000] gm-panel px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold text-[var(--gm-text)] animate-in slide-in-from-top-4 no-print">
          <WifiOff className="w-3 h-3" />
          <span>Offline mode</span>
        </div>
      )}

      {isMobile && !isOffline && gpsLoading && (
        <div className="fixed top-4 left-16 z-[4000] gm-panel px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium animate-pulse no-print">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Ricerca GPS...</span>
        </div>
      )}

      {mapLoading && (
        <div className="fixed top-16 left-16 z-[4000] gm-panel px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium no-print">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Caricamento mappa...</span>
        </div>
      )}

      {mapError && (
        <div className="fixed top-16 right-16 z-[4000] px-3 py-1.5 rounded-full text-xs font-semibold no-print bg-[#fce8e6] text-[var(--gm-danger)] border border-[#f6c7c2] shadow-[var(--gm-shadow)]">
          {mapError}
        </div>
      )}

      {appToast && (
        <div
          key={appToast.id}
          role="alert"
          aria-live="assertive"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[5000] px-4 py-2 rounded-full text-xs font-semibold shadow-[var(--gm-shadow-soft)] no-print ${
            appToast.tone === 'error'
              ? 'bg-[#d93025] text-white'
              : appToast.tone === 'warning'
                ? 'bg-[#fbbc04] text-[#202124]'
                : 'bg-[var(--gm-text)] text-white'
          }`}
        >
          {appToast.message}
        </div>
      )}

      <div className="nav-ui">
        <NavigationUI
          isActive={isNavigating}
          distance={distanceToDest}
          pathDistance={navPathDistance}
          onStop={stopNavigation}
          destinationName={selectedTrail?.name || 'Destinazione'}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
        />
      </div>

      {!isNavigating && (
        <div className="search-ui">
          <SearchBar
            trails={data?.trails || []}
            onSelect={(trail) => handleSelectTrailId(trail.id, true)}
            openRequestKey={searchOpenRequestKey}
            onOpen={clearSelection}
            onOpenChange={setIsSearchOpen}
            favorites={favorites}
          />
        </div>
      )}

      {/* Opening hours status badge */}
      {!isNavigating && (
        <div className="fixed bottom-4 left-4 z-[1900] gm-panel px-2.5 py-1 rounded-full flex items-center gap-1.5 no-print pointer-events-none">
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${cemeteryOpen ? 'bg-green-500' : 'bg-red-400'}`}
          />
          <span className="text-[10px] text-[var(--gm-text-muted)] whitespace-nowrap">
            {cemeteryStatus}
          </span>
        </div>
      )}

      {!isSearchOpen && (
        <div
          className="fixed top-4 z-[2000] no-print compass-ui"
          style={{ left: !isMobile && selectedTrail && !isNavigating && !showPrintModal ? 388 : 16 }}
        >
          {/* Compass calibration button */}
          {isMobile && (
            <button
              onClick={() => setShowCompassCalibration(true)}
              className="gm-map-control w-8 h-8 mb-1 flex items-center justify-center pointer-events-auto"
              title="Calibra bussola"
              aria-label="Calibra bussola"
            >
              <Compass className="w-4 h-4 text-[var(--gm-text-muted)]" />
            </button>
          )}
          <div
            className="gm-map-control pointer-events-none"
          >
            <div className="relative w-full h-full">
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-black text-red-500 tracking-tighter">N</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white">S</span>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white">E</span>
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white">W</span>
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-full h-[1px] bg-white absolute" />
                <div className="h-full w-[1px] bg-white absolute" />
                <div className="w-7 h-7 rounded-full border border-white absolute" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-red-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {userLocation && isNavigating && (
        <button
          onClick={restoreNavigationView}
          className={`fixed top-4 right-4 z-[2000] w-12 h-12 rounded-full border flex items-center justify-center transition-all no-print ${
            followUser
              ? 'bg-[var(--gm-accent)] border-[var(--gm-accent)] text-white shadow-[var(--gm-shadow-soft)] animate-pulse'
              : 'gm-map-control'
          }`}
          title="Ripristina posizione e orientamento"
          aria-label={followUser ? 'Posizione GPS attiva' : 'Ripristina posizione GPS'}
        >
          <Target className="w-5 h-5" />
        </button>
      )}


      {/* "Vicino a me" button — mobile, when GPS available, not navigating, no trail selected */}
      {isMobile && userLocation && !isNavigating && !selectedTrail && data && (
        <button
          onClick={() => {
            if (!data) return;
            // Find nearest trail to current location
            const nearest = data.trails.reduce<{ id: string; dist: number } | null>((best, t) => {
              const feat = data.featureMap[t.id];
              if (!feat?.geometry) return best;
              let lat = userLocation.lat, lng = userLocation.lng;
              const geom = feat.geometry;
              if (geom.type === 'Point') { lng = geom.coordinates[0]; lat = geom.coordinates[1]; }
              else if (geom.type === 'LineString' && geom.coordinates[0]) { lng = geom.coordinates[0][0]; lat = geom.coordinates[0][1]; }
              else if (geom.type === 'Polygon' && geom.coordinates[0]?.[0]) { lng = geom.coordinates[0][0][0]; lat = geom.coordinates[0][0][1]; }
              else return best;
              const d = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);
              if (!best || d < best.dist) return { id: t.id, dist: d };
              return best;
            }, null);
            if (nearest) handleSelectTrailId(nearest.id, true);
          }}
          className="fixed bottom-16 right-4 z-[2000] gm-map-control px-3 h-10 flex items-center gap-2 text-xs font-semibold no-print"
          title="Trova il punto più vicino a me"
          aria-label="Vicino a me"
        >
          <Target className="w-4 h-4 text-[var(--gm-accent)]" />
          Vicino a me
        </button>
      )}

      {!isNavigating && (
        <QuickActionsFab
          showAllFeatures={showAllFeatures}
          onToggleFeatures={() => setShowAllFeatures((prev) => !prev)}
          onResetView={() => {
            setResetMapTrigger((prev) => prev + 1);
            dispatchNav({ type: 'SET_FOLLOW', follow: false });
          }}
          onInfo={() => setShowInfoModal(true)}
          onHelp={() => setShowHelpModal(true)}
          canInstallApp={isMobile && canInstall}
          onInstallApp={handleInstallApp}
          behindBottomSheet={isMobile && !!selectedTrail && !showPrintModal}
        />
      )}

      {!isNavigating && isMobile && !showPrintModal && (
        <div className="bottom-sheet-ui">
          {/* Multi-stop queue panel — shows above BottomSheet when stops are queued */}
          {selectedTrail && multiStopQueue.length > 0 && (
            <MultiStopPanel
              stops={multiStopQueue}
              onRemove={removeMultiStop}
              onClear={clearMultiStops}
            />
          )}
          <BottomSheet
            trail={selectedTrail}
            onClose={() => { clearSelection(); clearMultiStops(); }}
            onNavigate={startNavigation}
            onOpenLightbox={setLightboxIndex}
            onOpenPrintModal={() => setShowPrintModal(true)}
            onOpenQrShare={() => setShowQrModal(true)}
            isDesktop={!isMobile}
            isFavorite={selectedTrail ? isFavorite(selectedTrail.id) : false}
            onToggleFavorite={(trail) => {
              toggleFavorite(trail.id, trail.name);
              showToast(
                isFavorite(trail.id) ? 'Rimosso dai preferiti.' : 'Aggiunto ai preferiti.',
                'info', 2000
              );
            }}
            onCopyCoords={(trail) => {
              if (!trail.coordinates) return;
              const text = `${trail.coordinates.lat.toFixed(6)}, ${trail.coordinates.lng.toFixed(6)}`;
              navigator.clipboard.writeText(text).catch(() => {});
              showToast('Coordinate copiate negli appunti.', 'info', 2000);
            }}
            onAddStop={userLocation ? addMultiStop : undefined}
            stopAlreadyQueued={!!selectedTrail && multiStopQueue.some((t) => t.id === selectedTrail.id)}
          />
        </div>
      )}

      {!isNavigating && !isMobile && !showPrintModal && selectedTrail && (
        <InfoSidebarDesktop
          trail={selectedTrail}
          onClose={() => { clearSelection(); clearMultiStops(); }}
          onNavigate={startNavigation}
          onOpenLightbox={setLightboxIndex}
          onOpenPrintModal={() => setShowPrintModal(true)}
          onOpenQrShare={() => setShowQrModal(true)}
          isFavorite={isFavorite(selectedTrail.id)}
          onToggleFavorite={(trail) => {
            toggleFavorite(trail.id, trail.name);
            showToast(
              isFavorite(trail.id) ? 'Rimosso dai preferiti.' : 'Aggiunto ai preferiti.',
              'info', 2000
            );
          }}
          multiStopQueue={multiStopQueue}
          onAddStop={addMultiStopDesktop}
          onRemoveStop={removeMultiStop}
          stopAlreadyQueued={multiStopQueue.some((t) => t.id === selectedTrail.id)}
          sortedStops={multiStopSortedStops}
          segmentDistancesM={segmentDistancesM}
          routeReady={isMultiStopPrint}
        />
      )}

      {showPrintModal && selectedTrail && (
        <PrintModal
          isOpen={showPrintModal}
          onClose={() => { setShowPrintModal(false); setMultiStopSegmentPaths([]); setMultiStopSortedStops([]); }}
          trailName={selectedTrail.name}
          gates={gates}
          onPlan={handlePlanRouteFromGate}
          isCalculating={isCalculatingPath}
          hasPath={!!navPath}
          pathDistanceM={navPathDistance}
          printInColor={printInColor}
          onTogglePrintColorMode={() => setPrintInColor((prev) => !prev)}
          onPrepareAndPrint={handlePrepareAndPrint}
          multiStopQueue={multiStopQueue.filter(t => t.id !== selectedTrail.id)}
          onRemoveStop={removeMultiStop}
          sortedStops={multiStopSortedStops}
          segmentDistancesM={segmentDistancesM}
        />
      )}

      <PrintSandbox
        ref={printSandboxRef}
        enabled={showPrintModal && !!selectedTrail && !isMobile}
        data={data}
        selectedTrailId={selectedTrailId}
        navPath={navPath}
        destination={navDestination}
        fromGateLabel={printFromGateLabel}
        destinationLabel={printDestinationLabel}
        distanceLabel={printDistanceLabel}
        printStops={printStops}
        printStopMarkers={printStopMarkers}
        preparePrintLayoutTrigger={preparePrintLayoutTrigger}
        preparePrintTrigger={preparePrintTrigger}
        restorePrintViewTrigger={restorePrintViewTrigger}
        onPrintLayoutReady={handlePrintLayoutReady}
        onPrintPrepared={handlePrintPrepared}
      />

      {selectedTrail && lightboxIndex !== null && (
        <Lightbox
          photos={selectedTrail.photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={selectedTrail.name}
        />
      )}

      {selectedTrail && (
        <QrShareModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          featureId={selectedTrail.id}
          title={selectedTrail.name}
          userLocation={userLocation}
          multiStopQueue={multiStopQueue}
        />
      )}

      <InstallAppModal
        isOpen={showInstallModal}
        isAndroidManualInstall={isAndroidManualInstall}
        isIosManualInstall={isIosManualInstall}
        canPromptInstall={canPromptInstall}
        onClose={() => setShowInstallModal(false)}
        onInstallNow={handleInstallApp}
      />

      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <CompassCalibrationModal
        isOpen={showCompassCalibration}
        onClose={() => setShowCompassCalibration(false)}
      />
    </div>
  );
}
