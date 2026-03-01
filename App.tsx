import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feature, Geometry } from 'geojson';
import {
  Loader2,
  Target,
  WifiOff,
} from 'lucide-react';
import BottomSheet from './components/BottomSheet';
import HelpModal from './components/HelpModal';
import InfoSidebarDesktop from './components/InfoSidebarDesktop';
import InfoModal from './components/InfoModal';
import LeafletMap from './components/LeafletMap';
import Lightbox from './components/Lightbox';
import NavigationUI from './components/NavigationUI';
import PrintSandbox, { PrintSandboxHandle } from './components/PrintSandbox';
import PrintModal from './components/PrintModal';
import QrShareModal from './components/QrShareModal';
import QuickActionsFab from './components/QuickActionsFab';
import SearchBar from './components/SearchBar';
import { useDeviceSensors } from './hooks/useDeviceSensors';
import { useMapData } from './hooks/useMapData';
import { parseDeepLink } from './services/deeplink';
import { Coordinates, TrailData } from './types';
import { calculateDistance } from './utils';

const MAP_ID = '1dzlxUTK3bz-7kChq1HASlXEpn6t5uQ8';

type RouteMode = 'idle' | 'navigating' | 'planning';
type AppToastTone = 'info' | 'warning' | 'error';

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
  const { isMobile, gpsData, gpsLoading, userLocation } = useDeviceSensors();
  const deepLink = useMemo(
    () =>
      typeof window === 'undefined'
        ? { focusId: null, openPrint: false, uiDebug: false }
        : parseDeepLink(window.location.search),
    []
  );

  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>('idle');
  const [isCalculatingPath, setIsCalculatingPath] = useState(false);
  const [navDestination, setNavDestination] = useState<Coordinates | null>(null);
  const [navPath, setNavPath] = useState<Coordinates[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [followUser, setFollowUser] = useState(false);
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedPrintGate, setSelectedPrintGate] = useState<TrailData | null>(null);
  const [searchOpenRequestKey, setSearchOpenRequestKey] = useState(0);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [isStartupSplashLeaving, setIsStartupSplashLeaving] = useState(false);
  const [appToast, setAppToast] = useState<{ id: number; message: string; tone: AppToastTone } | null>(null);
  const routeRequestRef = useRef(0);
  const pendingLayoutResolveRef = useRef<(() => void) | null>(null);
  const pendingLayoutTimeoutRef = useRef<number | null>(null);
  const pendingPrintResolveRef = useRef<(() => void) | null>(null);
  const pendingPrintTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const printSandboxRef = useRef<PrintSandboxHandle | null>(null);
  const deepLinkHandledRef = useRef(false);
  const splashStartRef = useRef(performance.now());

  const isNavigating = routeMode === 'navigating';
  const isPlanning = routeMode === 'planning';

  const selectedTrail = useMemo(() => {
    if (!selectedTrailId || !data) return null;
    return data.idMap[selectedTrailId] ?? null;
  }, [data, selectedTrailId]);

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

    if (deepLink.openPrint && !isMobile) {
      window.setTimeout(() => setShowPrintModal(true), 120);
    }
  }, [data, deepLink.focusId, deepLink.openPrint, isMobile, showToast]);

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

  const clearSelection = useCallback(() => {
    setSelectedTrailId(null);
    setShowPrintModal(false);
    setShowQrModal(false);
    setSelectedPrintGate(null);
    if (routeMode === 'planning') {
      setRouteMode('idle');
      setNavDestination(null);
      setNavPath(null);
    }
  }, [routeMode]);

  const stopNavigation = useCallback(() => {
    routeRequestRef.current += 1;
    setRouteMode('idle');
    setIsCalculatingPath(false);
    setNavDestination(null);
    setNavPath(null);
    setFollowUser(false);
    setSelectedTrailId(null);
    setShowPrintModal(false);
    setShowQrModal(false);
    setSelectedPrintGate(null);
  }, []);

  const handleSelectTrailId = useCallback(
    (id: string, shouldZoom = false) => {
      if (isNavigating) return;

      setSelectedTrailId(id);
      setShowQrModal(false);
      if (isPlanning) {
        setRouteMode('idle');
        setNavDestination(null);
        setNavPath(null);
      }
      if (shouldZoom) {
        window.setTimeout(() => setZoomToSelection((prev) => prev + 1), 50);
      }
    },
    [isNavigating, isPlanning]
  );

  const calculateRoute = useCallback(
    async (start: Coordinates, trail: TrailData, mode: Extract<RouteMode, 'navigating' | 'planning'>) => {
      if (!pathfinder || !data) return;
      const feature = data.featureMap[trail.id];
      const targetCoords = extractDestinationFromTrail(trail, feature);
      if (!targetCoords) return;

      const requestId = ++routeRequestRef.current;
      setIsCalculatingPath(true);
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      try {
        const calculatedPath = await pathfinder.findPath(start, targetCoords);
        if (requestId !== routeRequestRef.current) return;

        setNavPath(calculatedPath);
        setNavDestination(targetCoords);
        setSelectedTrailId(trail.id);

        if (mode === 'navigating') {
          setRouteMode('navigating');
          setFollowUser(true);
        } else {
          setRouteMode('planning');
          setFollowUser(false);
          window.setTimeout(() => setZoomToPath((prev) => prev + 1), 100);
        }
      } catch (error) {
        console.error('Path calculation failed', error);
        showToast('Errore nel calcolo del percorso.', 'error');
      } finally {
        if (requestId === routeRequestRef.current) {
          setIsCalculatingPath(false);
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
        showToast('In attesa del segnale GPS... Assicurati di essere all aperto.', 'warning');
        return;
      }
      calculateRoute({ lat: gpsData.lat, lng: gpsData.lng }, trail, 'navigating');
    },
    [calculateRoute, gpsData, isMobile, showToast]
  );

  const handlePlanRouteFromGate = useCallback(
    (gate: TrailData) => {
      if (!selectedTrailId || !data?.idMap[selectedTrailId] || !gate.coordinates) return;
      setSelectedPrintGate(gate);
      calculateRoute(
        { lat: gate.coordinates.lat, lng: gate.coordinates.lng },
        data.idMap[selectedTrailId],
        'planning'
      );
    },
    [calculateRoute, data, selectedTrailId]
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
    if (distanceToDest <= 0) return '--';
    if (distanceToDest >= 1000) return `${(distanceToDest / 1000).toFixed(2)} km`;
    return `${Math.round(distanceToDest)} m`;
  }, [distanceToDest]);

  const printFromGateLabel = selectedPrintGate?.name || 'Cancello non selezionato';
  const printDestinationLabel = selectedTrail?.name || '--';

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
        mapRotation={0}
        onManualDrag={() => setFollowUser(false)}
        zoomTrigger={zoomToSelection}
        pathZoomTrigger={zoomToPath}
        resetViewTrigger={resetMapTrigger}
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
          onStop={stopNavigation}
          destinationName={selectedTrail?.name || 'Destinazione'}
        />
      </div>

      {!isNavigating && (
        <div className="search-ui">
          <SearchBar
            trails={data?.trails || []}
            onSelect={(trail) => handleSelectTrailId(trail.id, true)}
            openRequestKey={searchOpenRequestKey}
            onOpen={clearSelection}
          />
        </div>
      )}

      <div
        className="fixed top-4 z-[2000] pointer-events-none no-print compass-ui"
        style={{ left: !isMobile && selectedTrail && !isNavigating && !showPrintModal ? 388 : 16 }}
      >
        <div
          className="gm-map-control"
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

      {userLocation && isNavigating && (
        <button
          onClick={() => setFollowUser(true)}
          className={`fixed top-4 right-4 z-[2000] w-12 h-12 rounded-full border flex items-center justify-center transition-all no-print ${
            followUser
              ? 'bg-[var(--gm-accent)] border-[var(--gm-accent)] text-white shadow-[var(--gm-shadow-soft)] animate-pulse'
              : 'gm-map-control'
          }`}
          title="Centra su posizione"
        >
          <Target className="w-5 h-5" />
        </button>
      )}

      {!isNavigating && (
        <QuickActionsFab
          showAllFeatures={showAllFeatures}
          onToggleFeatures={() => setShowAllFeatures((prev) => !prev)}
          onResetView={() => {
            setResetMapTrigger((prev) => prev + 1);
            setFollowUser(false);
          }}
          onInfo={() => setShowInfoModal(true)}
          onHelp={() => setShowHelpModal(true)}
        />
      )}

      {!isNavigating && isMobile && !showPrintModal && (
        <div className="bottom-sheet-ui">
          <BottomSheet
            trail={selectedTrail}
            onClose={clearSelection}
            onNavigate={startNavigation}
            onOpenLightbox={setLightboxIndex}
            onOpenPrintModal={() => setShowPrintModal(true)}
            onOpenQrShare={() => setShowQrModal(true)}
            isDesktop={!isMobile}
          />
        </div>
      )}

      {!isNavigating && !isMobile && !showPrintModal && selectedTrail && (
        <InfoSidebarDesktop
          trail={selectedTrail}
          onClose={clearSelection}
          onNavigate={startNavigation}
          onOpenLightbox={setLightboxIndex}
          onOpenPrintModal={() => setShowPrintModal(true)}
          onOpenQrShare={() => setShowQrModal(true)}
        />
      )}

      {showPrintModal && selectedTrail && (
        <PrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          trailName={selectedTrail.name}
          gates={gates}
          onPlan={handlePlanRouteFromGate}
          isCalculating={isCalculatingPath}
          hasPath={!!navPath}
          printInColor={printInColor}
          onTogglePrintColorMode={() => setPrintInColor((prev) => !prev)}
          onPrepareAndPrint={handlePrepareAndPrint}
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
        />
      )}

      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}
