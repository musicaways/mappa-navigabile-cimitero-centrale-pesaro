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

interface PrintSandboxProps {
  enabled: boolean;
  data: MyMapsData | null;
  selectedTrailId: string | null;
  navPath: Coordinates[] | null;
  destination: Coordinates | null;
  fromGateLabel: string;
  destinationLabel: string;
  distanceLabel: string;
  preparePrintLayoutTrigger: number;
  preparePrintTrigger: number;
  restorePrintViewTrigger: number;
  onPrintLayoutReady?: () => void;
  onPrintPrepared?: () => void;
}

const frameHead = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,1,0&icon_names=directions_walk,flag,meeting_room&display=block" rel="stylesheet" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
    <style>
      :root {
        --print-page-w: 210mm;
        --print-page-h: 297mm;
        --print-page-margin: 3mm;
        --print-content-w: calc(var(--print-page-w) - (var(--print-page-margin) * 2));
        --print-content-h: calc(var(--print-page-h) - (var(--print-page-margin) * 2));
        --print-header-h: 9.8mm;
        --print-map-top: calc(var(--print-header-h) + 2.2mm);
      }

      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #ffffff;
        overflow: hidden;
        font-family: "DM Sans", "Segoe UI", Arial, sans-serif;
      }
      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      #print-root {
        width: var(--print-content-w);
        height: var(--print-content-h);
        position: relative;
      }
      .print-scene {
        position: relative;
        width: 100%;
        height: 100%;
        background: #ffffff;
        overflow: hidden;
      }
      .print-only-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: var(--print-header-h);
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 3mm;
        background: rgba(255, 255, 255, 0.97);
        border: 1px solid #d4d4d8;
        border-radius: 2.5mm;
        padding: 1.25mm 2.2mm;
      }
      .print-header-main {
        display: flex;
        flex-direction: column;
        gap: 0.35mm;
        min-width: 0;
        flex: 1 1 auto;
      }
      .print-eyebrow {
        margin: 0;
        font-size: 6.5px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #71717a;
        font-weight: 700;
        line-height: 1;
      }
      .print-title {
        margin: 0;
        font-size: 10.8px;
        line-height: 1.08;
        color: #111111;
        font-weight: 900;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 145mm;
      }
      .print-distance {
        margin: 0;
        font-size: 7.8px;
        color: #374151;
        font-weight: 600;
        line-height: 1.1;
      }
      .print-header-brand {
        display: flex;
        gap: 1.2mm;
        align-items: center;
        justify-content: flex-end;
        flex: 0 0 auto;
      }
      .print-brand-label {
        font-size: 6.4px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 700;
        line-height: 1;
      }
      .print-logo-badge {
        width: 7.3mm;
        height: 7.3mm;
        border-radius: 50%;
        border: 1px solid #d4d4d8;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.4mm;
      }
      .print-logo {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .print-map-shell {
        position: absolute;
        top: var(--print-map-top);
        left: 0;
        width: 100%;
        height: calc(100% - var(--print-map-top));
      }
      .leaflet-map-wrapper {
        position: absolute !important;
        inset: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
        border-radius: 2.5mm;
        border: 1px solid #d1d5db;
      }
      .leaflet-map-canvas {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        top: 0 !important;
        left: 0 !important;
        transform: none !important;
        transition: none !important;
      }
      .leaflet-container {
        width: 100% !important;
        height: 100% !important;
        background: #f9fafb !important;
      }
      .leaflet-control-zoom,
      .leaflet-control-attribution {
        display: none !important;
      }
      .leaflet-tile-pane {
        filter: grayscale(100%) contrast(165%) brightness(88%) saturate(0%) !important;
        opacity: 1 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .leaflet-tile-pane .leaflet-tile {
        filter: grayscale(100%) contrast(120%) brightness(96%) !important;
        opacity: 1 !important;
      }
      html.print-color-mode .leaflet-tile-pane,
      body.print-color-mode .leaflet-tile-pane {
        filter: none !important;
      }
      html.print-color-mode .leaflet-tile-pane .leaflet-tile,
      body.print-color-mode .leaflet-tile-pane .leaflet-tile {
        filter: none !important;
      }
      .leaflet-overlay-pane svg path:not(.nav-route-line):not(.nav-route-glow) {
        stroke: #2f2f2f !important;
        stroke-width: 1.45px !important;
        stroke-opacity: 0.72 !important;
        fill-opacity: 0 !important;
      }
      path.nav-route-glow {
        stroke: #ffffff !important;
        stroke-width: 5.5px !important;
        stroke-opacity: 0.96 !important;
        fill: none !important;
      }
      path.nav-route-line {
        stroke: #050505 !important;
        stroke-width: 2.4px !important;
        stroke-dasharray: 10 6 !important;
        stroke-opacity: 1 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        fill: none !important;
      }
      html.print-color-mode path.nav-route-line,
      body.print-color-mode path.nav-route-line {
        stroke: #2563eb !important;
      }
      .leaflet-marker-pane {
        z-index: 2200 !important;
      }
      .gate-marker-container .gate-dot-view,
      .gate-marker-container .gate-icon-view {
        display: none;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .map-zoom-low .gate-marker-container .gate-dot-view {
        display: block;
      }
      .map-zoom-low .gate-marker-container .gate-icon-view.force-show {
        display: block !important;
      }
      .map-zoom-high .gate-marker-container .gate-icon-view {
        display: block;
      }
      @page {
        size: A4 portrait;
        margin: var(--print-page-margin);
      }
      @media print {
        html,
        body {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background: #fff !important;
        }
      }
    </style>
  </head>
  <body>
    <div id="print-root"></div>
  </body>
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
      if (!enabled) {
        setMountNode(null);
        return;
      }

      const iframe = iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.open();
      doc.write(frameHead);
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
            const cleanup = () => {
              frameWindow.removeEventListener('afterprint', handleAfterPrint);
            };
            const finalize = () => {
              if (done) return;
              done = true;
              cleanup();
              resolve();
            };
            const fail = (error: unknown) => {
              if (done) return;
              done = true;
              cleanup();
              reject(error instanceof Error ? error : new Error(String(error)));
            };
            const handleAfterPrint = () => finalize();

            frameWindow.addEventListener('afterprint', handleAfterPrint, { once: true });
            frameWindow.setTimeout(() => finalize(), 6500);

            frameWindow.requestAnimationFrame(() => {
              frameWindow.requestAnimationFrame(() => {
                try {
                  frameWindow.focus();
                  frameWindow.print();
                } catch (error) {
                  fail(error);
                }
              });
            });
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
              position: 'fixed',
              top: 0,
              left: '-10000px',
              width: '210mm',
              height: '297mm',
              opacity: 0,
              border: 0,
              pointerEvents: 'none',
            }}
          />
        )}

        {enabled &&
          mountNode &&
          createPortal(
            <div className="print-scene">
              <div className="print-only-header">
                <div className="print-header-main">
                  <p className="print-eyebrow">Cimitero Centrale Pesaro</p>
                  <h1 className="print-title">
                    Percorso: Da {fromGateLabel} A {destinationLabel}
                  </h1>
                  <p className="print-distance">Distanza stimata: {distanceLabel}</p>
                </div>
                <div className="print-header-brand">
                  <span className="print-brand-label">ASPES</span>
                  <div className="print-logo-badge">
                    <img
                      src="https://www.aspes.it/wp-content/uploads/2022/05/logo_notesto.png"
                      alt="Logo Aspes"
                      className="print-logo"
                    />
                  </div>
                </div>
              </div>

              <div className="print-map-shell">
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
                  resetViewTrigger={0}
                />
              </div>
            </div>,
            mountNode
          )}
      </>
    );
  }
);

PrintSandbox.displayName = 'PrintSandbox';

export default PrintSandbox;
