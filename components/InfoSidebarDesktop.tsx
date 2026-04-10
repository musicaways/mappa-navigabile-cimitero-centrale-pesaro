import React, { useEffect } from 'react';
import {
  CheckCircle2,
  Clock3,
  Heart,
  Image as ImageIcon,
  Info,
  ListOrdered,
  Navigation2,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import { TrailData } from '../types';
import { cn } from '../utils';
import SmartImage, { preloadImagePreview } from './SmartImage';
import WeatherWidget from './WeatherWidget';

interface InfoSidebarDesktopProps {
  trail: TrailData;
  onClose: () => void;
  onNavigate: (trail: TrailData) => void;
  onOpenLightbox: (index: number) => void;
  onOpenPrintModal: () => void;
  onOpenQrShare: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (trail: TrailData) => void;
  multiStopQueue?: TrailData[];
  onAddStop?: (trail: TrailData) => void;
  onRemoveStop?: (id: string) => void;
  stopAlreadyQueued?: boolean;
  // Populated after route calculation
  sortedStops?: TrailData[];
  segmentDistancesM?: number[];
  routeReady?: boolean;
}

const WALK_M_PER_MIN = 4000 / 60;

const fmtDist = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

const fmtEta = (m: number) => {
  const mins = Math.ceil(m / WALK_M_PER_MIN);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
};

const InfoSidebarDesktop: React.FC<InfoSidebarDesktopProps> = ({
  trail,
  onClose,
  onNavigate,
  onOpenLightbox,
  onOpenPrintModal,
  onOpenQrShare,
  isFavorite = false,
  onToggleFavorite,
  multiStopQueue = [],
  onAddStop,
  onRemoveStop,
  stopAlreadyQueued = false,
  sortedStops = [],
  segmentDistancesM = [],
  routeReady = false,
}) => {
  const hasDescription =
    trail.description.trim().length > 0 &&
    trail.description !== 'Nessuna descrizione disponibile.';

  const totalDistM = segmentDistancesM.reduce((s, d) => s + d, 0);

  // Escape key closes sidebar
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    trail.photos.slice(0, 8).forEach((photo, index) => {
      preloadImagePreview(photo, index < 3 ? 420 : 300, index < 3 ? 68 : 56);
    });
  }, [trail.id, trail.photos]);

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-[3300] w-[360px] no-print">
      <div className="gm-panel-elevated h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="gm-panel-header px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="gm-section-title">Punto selezionato</p>
              <h2 className="gm-info-title mt-1 pr-2 !text-[1.18rem] leading-6 whitespace-normal break-words">
                {trail.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="gm-icon-button shrink-0"
              title="Chiudi (Esc)"
              aria-label="Chiudi selezione"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-b border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)]">
          {trail.coordinates && (
            <WeatherWidget lat={trail.coordinates.lat} lng={trail.coordinates.lng} variant="compact" />
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onOpenPrintModal} className="gm-button-primary">
              <Printer className="w-4 h-4" />
              Stampa
            </button>
            <button onClick={() => onNavigate(trail)} className="gm-button-secondary">
              <Navigation2 className="w-4 h-4" />
              GPS
            </button>
            <button onClick={onOpenQrShare} className="gm-button-secondary">
              <Share2 className="w-4 h-4" />
              Condividi
            </button>
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(trail)}
                className={cn('gm-button-secondary', isFavorite && 'bg-rose-50 border-rose-200 text-rose-500')}
                aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                <Heart className={cn('w-4 h-4', isFavorite && 'fill-rose-500 text-rose-500')} />
                {isFavorite ? 'Salvato' : 'Salva'}
              </button>
            )}
          </div>

          {/* Add multi-stop button */}
          {onAddStop && (
            <button
              onClick={() => onAddStop(trail)}
              disabled={stopAlreadyQueued}
              className={cn(
                'mt-2 w-full gm-button-secondary text-sm transition-colors',
                stopAlreadyQueued && 'opacity-50 cursor-not-allowed'
              )}
            >
              <ListOrdered className="w-4 h-4" />
              {stopAlreadyQueued ? 'Tappa già in coda' : 'Aggiungi tappa al percorso stampa'}
            </button>
          )}

          {/* ── Optimized route — shown after calculation ── */}
          {routeReady && sortedStops.length > 0 ? (
            <div className="mt-3 rounded-xl border border-emerald-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border-b border-emerald-100">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                    Percorso ottimizzato
                  </span>
                </div>
                {totalDistM > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                    <Clock3 className="w-3 h-3" />
                    {fmtEta(totalDistM)}
                  </div>
                )}
              </div>
              {sortedStops.map((stop, i) => {
                const distM = segmentDistancesM[i] ?? 0;
                return (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--gm-border-soft)] last:border-0 bg-white"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-xs text-[var(--gm-text)] truncate flex-1">{stop.name}</span>
                    {distM > 0 && (
                      <span className="text-[10px] text-[var(--gm-text-muted)] font-medium shrink-0">
                        {fmtDist(distM)}
                      </span>
                    )}
                    {onRemoveStop && (
                      <button
                        onClick={() => onRemoveStop(stop.id)}
                        className="p-0.5 rounded hover:bg-[var(--gm-surface-soft)] shrink-0"
                        title="Rimuovi tappa"
                        aria-label="Rimuovi tappa"
                      >
                        <X className="w-3 h-3 text-[var(--gm-text-muted)]" />
                      </button>
                    )}
                  </div>
                );
              })}
              {totalDistM > 0 && (
                <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100 flex justify-between text-[10px] font-semibold text-emerald-700">
                  <span>Totale</span>
                  <span>{fmtDist(totalDistM)}</span>
                </div>
              )}
            </div>
          ) : multiStopQueue.length > 0 ? (
            /* Queue — not yet calculated */
            <div className="mt-3 rounded-xl border border-[color:var(--gm-border)] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--gm-surface-soft)] border-b border-[color:var(--gm-border-soft)]">
                <div className="flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-[var(--gm-accent)]" />
                  <span className="text-[11px] font-semibold text-[var(--gm-text-muted)] uppercase tracking-wide">
                    Tappe in coda ({multiStopQueue.length})
                  </span>
                </div>
                {onRemoveStop && (
                  <button
                    onClick={() => multiStopQueue.forEach((t) => onRemoveStop(t.id))}
                    className="text-[11px] text-rose-500 font-semibold"
                  >
                    Rimuovi tutte
                  </button>
                )}
              </div>
              {multiStopQueue.map((stop, i) => (
                <div
                  key={stop.id}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--gm-border-soft)] last:border-0"
                >
                  <div className="w-5 h-5 rounded-full bg-[var(--gm-accent)] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs text-[var(--gm-text)] truncate flex-1">{stop.name}</span>
                  {onRemoveStop && (
                    <button
                      onClick={() => onRemoveStop(stop.id)}
                      className="p-0.5 rounded hover:bg-[var(--gm-surface-soft)]"
                      title="Rimuovi tappa"
                    >
                      <X className="w-3 h-3 text-[var(--gm-text-muted)]" />
                    </button>
                  )}
                </div>
              ))}
              <p className="px-3 py-1.5 text-[10px] text-[var(--gm-text-muted)] bg-amber-50 border-t border-amber-100">
                Calcola un percorso dalla finestra di stampa per ottimizzare l'ordine.
              </p>
            </div>
          ) : null}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {trail.photos.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="gm-section-title">Anteprime</p>
                <span className="text-xs text-[var(--gm-text-muted)]">{trail.photos.length} foto</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {trail.photos.slice(0, 8).map((photo, index) => (
                  <button
                    key={`${trail.id}-${index}`}
                    onClick={() => onOpenLightbox(index)}
                    className="relative aspect-[4/3] overflow-hidden border border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)]"
                    style={{ borderRadius: 'calc(var(--gm-radius) + 2px)' }}
                    title="Apri anteprima"
                  >
                    <SmartImage
                      src={photo}
                      alt=""
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                      width={index < 3 ? 420 : 280}
                      quality={index < 3 ? 68 : 56}
                      priority={index < 2}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="gm-card px-4 py-3 text-sm text-[var(--gm-text-muted)] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[var(--gm-text-muted)]" />
              Nessuna foto disponibile
            </div>
          )}

          {hasDescription ? (
            <section className="gm-card px-4 py-4">
              <p className="gm-section-title flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--gm-accent)]" />
                Descrizione
              </p>
              <p className="mt-3 text-[15px] leading-7 text-[var(--gm-text-muted)] whitespace-pre-line">
                {trail.description}
              </p>
            </section>
          ) : (
            <div className="gm-card px-4 py-3 text-sm text-[var(--gm-text-muted)]">
              Nessuna descrizione disponibile.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default InfoSidebarDesktop;
