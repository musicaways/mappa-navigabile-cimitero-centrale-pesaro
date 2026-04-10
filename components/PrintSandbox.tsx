import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import LeafletMap from './LeafletMap';
import { Coordinates, MyMapsData } from '../types';

export interface PrintSandboxHandle {
  print: (printInColor: boolean) => Promise<void>;
}

interface PrintStop {
  name: string;
  distanceM: number;
}

interface PrintStopMarker {
  lat: number;
  lng: number;
  step: number;
}

interface PrintSandboxProps {
  enabled: boolean;
  data: MyMapsData | null;
  selectedTrailId: string | null;
  navPath: Coordinates[] | null;
  destination: Coordinates | null;
  fromGateLabel: string;
  destinationLabel: string;
  distanceLabel: string;
  printStops?: PrintStop[];
  printStopMarkers?: PrintStopMarker[];
  preparePrintLayoutTrigger: number;
  preparePrintTrigger: number;
  restorePrintViewTrigger: number;
  onPrintLayoutReady?: () => void;
  onPrintPrepared?: () => void;
}

// Only CSS + empty container — React owns all content via portal
const FRAME_HEAD = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" rel="stylesheet" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%; height: 100%;
        background: #fff;
        font-family: "DM Sans", "Segoe UI", Arial, sans-serif;
        overflow: hidden;
      }
      body { display: flex; justify-content: center; align-items: flex-start; }

      /* ── Page layout ── */
      #print-root {
        width: calc(210mm - 8mm);
        height: calc(297mm - 8mm);
        display: flex;
        flex-direction: column;
        gap: 2mm;
      }

      /* ── Header (compact) ── */
      .pp-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 3mm;
        border: 1.5px solid #000;
        border-radius: 2mm;
        padding: 1.2mm 2.5mm;
        background: #fff;
      }
      .pp-header-main { min-width: 0; flex: 1 1 auto; }
      .pp-eyebrow {
        font-size: 6px; letter-spacing: 0.08em; text-transform: uppercase;
        color: #555; font-weight: 700; line-height: 1;
      }
      .pp-title {
        font-size: 10px; font-weight: 900; color: #000; line-height: 1.1;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: 145mm; margin-top: 0.4mm;
      }
      .pp-subtitle {
        font-size: 7px; color: #333; font-weight: 600; line-height: 1.2; margin-top: 0.3mm;
      }
      .pp-brand {
        flex: 0 0 auto; display: flex; align-items: center; gap: 1.5mm;
      }
      .pp-brand-label {
        font-size: 6px; text-transform: uppercase; letter-spacing: 0.08em;
        color: #555; font-weight: 700;
      }
      .pp-logo {
        width: 7mm; height: 7mm; border-radius: 50%;
        border: 1px solid #999;
        object-fit: contain; display: block;
      }

      /* ── Map shell — fills remaining space ── */
      .pp-map {
        flex: 1 1 0;
        min-height: 0;
        position: relative;
        border: 1.5px solid #000;
        border-radius: 2mm;
        overflow: hidden;
        background: #e8e8e8;
      }
      .leaflet-map-wrapper {
        position: absolute !important; inset: 0 !important;
        overflow: hidden !important; background: #f0f0f0 !important;
      }
      .leaflet-map-canvas {
        position: absolute !important; inset: 0 !important;
        width: 100% !important; height: 100% !important;
        transform: none !important; transition: none !important;
      }
      .leaflet-container {
        width: 100% !important; height: 100% !important;
        background: #e8e8e8 !important;
      }
      .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }

      /* Tile B/W filter */
      .leaflet-tile-pane {
        filter: grayscale(100%) contrast(175%) brightness(86%) saturate(0%) !important;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      html.print-color-mode .leaflet-tile-pane { filter: none !important; }

      /* Map paths */
      .leaflet-overlay-pane svg path:not(.nav-route-line):not(.nav-route-glow) {
        stroke: #1a1a1a !important; stroke-width: 1.4px !important;
        stroke-opacity: 0.6 !important; fill-opacity: 0 !important;
      }
      path.nav-route-glow {
        stroke: #ffffff !important; stroke-width: 5px !important;
        stroke-opacity: 1 !important; fill: none !important;
      }
      path.nav-route-line {
        stroke: #000000 !important; stroke-width: 2px !important;
        stroke-dasharray: 10 4 !important; stroke-opacity: 1 !important;
        stroke-linecap: round !important; stroke-linejoin: round !important;
        fill: none !important;
      }
      html.print-color-mode path.nav-route-glow { stroke: rgba(255,255,255,0.9) !important; }
      html.print-color-mode path.nav-route-line  { stroke: #1a56db !important; stroke-width: 2px !important; }

      /* Gate markers */
      .gate-marker-container .gate-dot-view,
      .gate-marker-container .gate-icon-view {
        display: none; position: absolute; top: 50%; left: 50%;
        transform: translate(-50%,-50%);
      }
      .map-zoom-low  .gate-marker-container .gate-dot-view { display: block; }
      .map-zoom-high .gate-marker-container .gate-icon-view { display: block; }

      /* ── Multi-stop: stop list table below map ── */
      .pp-stops {
        flex: 0 0 auto;
        border: 1.5px solid #000; border-radius: 2mm;
        overflow: hidden; background: #fff;
      }
      .pp-stops-header {
        background: #000; color: #fff; padding: 1.5mm 3mm;
        font-size: 7px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
        display: flex; align-items: center; gap: 2mm;
      }
      .pp-stops-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(55mm, 1fr));
        gap: 0;
      }
      .pp-stop-cell {
        display: flex; align-items: center; gap: 2mm;
        padding: 1.8mm 3mm;
        border-right: 0.5px solid #ddd; border-bottom: 0.5px solid #ddd;
        font-size: 7.5px; font-family: "DM Sans", Arial, sans-serif;
      }
      .pp-stop-cell:last-child { border-right: none; }
      .pp-stop-num {
        width: 14px; height: 14px; border-radius: 50%;
        background: #000; color: #fff; border: 1.5px solid #fff;
        font-size: 7px; font-weight: 900; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 0 1px #000; line-height: 1;
      }
      .pp-stop-name { flex: 1; font-weight: 600; color: #000; line-height: 1.2; }
      .pp-stop-dist {
        font-size: 6.5px; font-weight: 700; color: #555;
        white-space: nowrap; padding: 1px 3px;
        background: #f0f0f0; border-radius: 2px; border: 0.5px solid #ccc;
      }
      .pp-stop-total {
        border-top: 1px solid #000; background: #f7f7f7;
        padding: 1.5mm 3mm; font-size: 7.5px; font-weight: 700; color: #000;
        display: flex; justify-content: space-between; align-items: center;
      }

      /* ── Multi-stop numbered markers on map ── */
      .print-stop-marker {
        width: 18px; height: 18px;
        background: #000; color: #fff;
        border-radius: 50%; border: 2px solid #fff;
        font-size: 9px; font-weight: 900;
        font-family: "DM Sans", Arial, sans-serif;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 1px 5px rgba(0,0,0,0.6); line-height: 1;
      }
      html.print-color-mode .print-stop-marker { background: #1a56db; border-color: #fff; }

      @page { size: A4 portrait; margin: 4mm; }
      @media print {
        html, body { width: 100% !important; height: 100% !important; overflow: hidden !important; }
      }
    </style>
  </head>
  <body><div id="print-root"></div></body>
</html>`;

const PrintSandbox = forwardRef<PrintSandboxHandle, PrintSandboxProps>(
  (
    {
      enabled,
      data,
      selectedTrailId,
      navPath,
      destination,
      fromGateLabel,
      destinationLabel,
      distanceLabel,
      printStops = [],
      printStopMarkers = [],
      preparePrintLayoutTrigger,
      preparePrintTrigger,
      restorePrintViewTrigger,
      onPrintLayoutReady,
      onPrintPrepared,
    },
    ref
  ) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    const isPathReady = useMemo(() => !!navPath && navPath.length >= 2, [navPath]);

    useEffect(() => {
      if (!enabled) { setMountNode(null); return; }

      const iframe = iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.open();
      doc.write(FRAME_HEAD);
      doc.close();

      const root = doc.getElementById('print-root');
      setMountNode(root as HTMLElement | null);
    }, [enabled]);

    useImperativeHandle(
      ref,
      () => ({
        print: (printInColor: boolean) =>
          new Promise<void>((resolve, reject) => {
            const iframe = iframeRef.current;
            const frameWindow = iframe?.contentWindow;
            const frameDocument = iframe?.contentDocument;
            if (!iframe || !frameWindow || !frameDocument || !mountNode) {
              reject(new Error('Sandbox di stampa non pronto.'));
              return;
            }

            frameDocument.documentElement.classList.toggle('print-color-mode', printInColor);
            frameDocument.body.classList.toggle('print-color-mode', printInColor);

            let done = false;
            const cleanup = () => frameWindow.removeEventListener('afterprint', handleAfterPrint);
            const finalize = () => { if (done) return; done = true; cleanup(); resolve(); };
            const fail = (error: unknown) => {
              if (done) return; done = true; cleanup();
              reject(error instanceof Error ? error : new Error(String(error)));
            };
            const handleAfterPrint = () => finalize();

            frameWindow.addEventListener('afterprint', handleAfterPrint, { once: true });
            frameWindow.setTimeout(() => finalize(), 6500);
            frameWindow.requestAnimationFrame(() =>
              frameWindow.requestAnimationFrame(() => {
                try { frameWindow.focus(); frameWindow.print(); }
                catch (error) { fail(error); }
              })
            );
          }),
      }),
      [mountNode]
    );

    return (
      <>
        {enabled && (
          <iframe
            ref={iframeRef}
            title="Sandbox stampa"
            aria-hidden="true"
            style={{
              position: 'fixed', top: 0, left: '-10000px',
              width: '210mm', height: '297mm',
              opacity: 0, border: 0, pointerEvents: 'none',
            }}
          />
        )}

        {enabled && mountNode && createPortal(
          <>
            {/* Header */}
            <div className="pp-header">
              <div className="pp-header-main">
                <p className="pp-eyebrow">Cimitero Centrale — ASPES Pesaro</p>
                <h1 className="pp-title">{fromGateLabel} → {destinationLabel}</h1>
                <p className="pp-subtitle">
                  {printStops.length > 1
                    ? `Percorso totale: ${distanceLabel}  ·  ${printStops.length} tappe`
                    : `Percorso: ${distanceLabel}`}
                </p>
              </div>
              <div className="pp-brand">
                <span className="pp-brand-label">ASPES</span>
                <img
                  src="https://www.aspes.it/wp-content/uploads/2022/05/logo_notesto.png"
                  alt="Logo Aspes"
                  className="pp-logo"
                />
              </div>
            </div>

            {/* Map */}
            <div className="pp-map">
              <LeafletMap
                data={data}
                selectedTrailId={selectedTrailId}
                onSelectTrail={() => undefined}
                userLocation={null}
                destination={destination}
                navPath={navPath}
                navActive={isPathReady}
                showAllFeatures={false}
                followUser={false}
                mapRotation={0}
                preparePrintLayoutTrigger={preparePrintLayoutTrigger}
                preparePrintTrigger={preparePrintTrigger}
                restorePrintViewTrigger={restorePrintViewTrigger}
                onPrintLayoutReady={onPrintLayoutReady}
                onPrintPrepared={onPrintPrepared}
                printMode
                printStopMarkers={printStopMarkers}
                resetViewTrigger={0}
              />
            </div>

            {/* Multi-stop list — only when more than 1 stop */}
            {printStops.length > 1 && (() => {
              const totalM = printStops.reduce((s, p) => s + p.distanceM, 0);
              const fmtM = (m: number) =>
                m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
              return (
                <div className="pp-stops">
                  <div className="pp-stops-header">
                    Itinerario
                  </div>
                  <div className="pp-stops-grid">
                    {printStops.map((stop, i) => (
                      <div key={i} className="pp-stop-cell">
                        <div className="pp-stop-num">{i + 1}</div>
                        <div className="pp-stop-name">{stop.name}</div>
                        <div className="pp-stop-dist">{fmtM(stop.distanceM)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="pp-stop-total">
                    <span>Distanza totale percorso</span>
                    <span>{fmtM(totalM)}</span>
                  </div>
                </div>
              );
            })()}
          </>,
          mountNode
        )}
      </>
    );
  }
);

PrintSandbox.displayName = 'PrintSandbox';

export default PrintSandbox;
