import React, { useEffect, useRef, useState } from 'react';
import { AlignLeft, ChevronDown, Copy, Heart, ListOrdered, MapPin, Navigation2, Share2, X } from 'lucide-react';
import { TrailData } from '../types';
import { cn } from '../utils';
import SmartImage from './SmartImage';
import WeatherWidget from './WeatherWidget';

interface BottomSheetProps {
  trail: TrailData | null;
  onClose: () => void;
  onNavigate: (trail: TrailData) => void;
  onOpenLightbox: (index: number) => void;
  onOpenPrintModal: () => void;
  onOpenQrShare: () => void;
  isDesktop?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (trail: TrailData) => void;
  onCopyCoords?: (trail: TrailData) => void;
  onAddStop?: (trail: TrailData) => void;
  stopAlreadyQueued?: boolean;
  multiStopQueue?: TrailData[];
  onRemoveStop?: (id: string) => void;
  onClearStops?: () => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  trail,
  onClose,
  onNavigate,
  onOpenLightbox,
  onOpenQrShare,
  isFavorite = false,
  onToggleFavorite,
  onCopyCoords,
  onAddStop,
  stopAlreadyQueued = false,
  multiStopQueue = [],
  onRemoveStop,
  onClearStops,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  useEffect(() => {
    setIsExpanded(false);
    setCoordsCopied(false);
  }, [trail]);

  if (!trail) return null;

  const hasDescription =
    trail.description.trim().length > 0 && trail.description !== 'Nessuna descrizione disponibile.';

  const handleTouchStart = (event: React.TouchEvent) => {
    startY.current = event.touches[0].clientY;
    currentY.current = startY.current;
  };
  const handleTouchMove = (event: React.TouchEvent) => {
    currentY.current = event.touches[0].clientY;
  };
  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;
    if (Math.abs(diff) < 20) return;
    if (diff < -50) setIsExpanded(true);
    else if (diff > 50) isExpanded ? setIsExpanded(false) : onClose();
  };

  const handleCopyCoords = () => {
    if (onCopyCoords) {
      onCopyCoords(trail);
      setCoordsCopied(true);
      setTimeout(() => setCoordsCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[3000] no-print transition-transform duration-300"
      style={{ transform: trail ? 'translateY(0)' : 'translateY(110%)', maxHeight: '90vh' }}
    >
      <div className="gm-panel-elevated rounded-t-[28px] border-b-0 overflow-hidden">
        {/* Drag handle */}
        <div
          className="relative flex h-10 items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="h-1.5 w-12 rounded-full bg-[var(--gm-border)]" />
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="gm-icon-button absolute right-4 top-1"
            aria-label="Chiudi scheda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={cn('overflow-y-auto px-5 pb-6', isExpanded ? 'max-h-[calc(90vh-2.5rem)]' : 'max-h-[44vh]')}
        >
          {/* Title */}
          <div className="pr-4">
            <p className="gm-section-title">Punto selezionato</p>
            <h2 className="gm-info-title mt-0.5 leading-snug">{trail.name}</h2>
            {trail.coordinates && (
              <p className="text-[11px] text-[var(--gm-text-muted)] mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {trail.coordinates.lat.toFixed(5)}, {trail.coordinates.lng.toFixed(5)}
              </p>
            )}
          </div>

          {/* Primary action row */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => onNavigate(trail)}
              className="gm-button-primary"
            >
              <Navigation2 className="w-4 h-4" />
              Naviga GPS
            </button>
            <button onClick={onOpenQrShare} className="gm-button-secondary">
              <Share2 className="w-4 h-4" />
              Condividi
            </button>
          </div>

          {/* Secondary action row */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(trail)}
                className={cn(
                  'gm-button-secondary text-xs transition-colors',
                  isFavorite && 'bg-rose-50 border-rose-200 text-rose-500'
                )}
                aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                <Heart className={cn('w-3.5 h-3.5', isFavorite && 'fill-rose-500 text-rose-500')} />
                {isFavorite ? 'Salvato' : 'Salva'}
              </button>
            )}
            {onCopyCoords && trail.coordinates && (
              <button
                onClick={handleCopyCoords}
                className="gm-button-secondary text-xs"
                aria-label="Copia coordinate"
              >
                <Copy className="w-3.5 h-3.5" />
                {coordsCopied ? 'Copiato!' : 'Coord.'}
              </button>
            )}
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="gm-button-secondary text-xs col-span-1"
            >
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isExpanded && 'rotate-180')} />
              {isExpanded ? 'Meno' : 'Dettagli'}
            </button>
          </div>

          {/* Add stop — shown only when onAddStop is provided (GPS available, mobile) */}
          {onAddStop && (
            <button
              onClick={() => onAddStop(trail)}
              disabled={stopAlreadyQueued}
              className={cn(
                'mt-2 w-full gm-button-secondary text-xs transition-colors',
                stopAlreadyQueued && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={stopAlreadyQueued ? 'Tappa già in coda' : 'Aggiungi come tappa al percorso'}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              {stopAlreadyQueued ? 'Tappa già in coda' : 'Aggiungi tappa al percorso'}
            </button>
          )}

          {/* Multi-stop queue — integrated inside the sheet, no overlap */}
          {multiStopQueue.length > 0 && (
            <div className="mt-3 rounded-xl border border-[color:var(--gm-border)] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--gm-surface-soft)] border-b border-[color:var(--gm-border-soft)]">
                <div className="flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-[var(--gm-accent)]" />
                  <span className="text-[11px] font-semibold text-[var(--gm-text-muted)] uppercase tracking-wide">
                    Tappe in coda ({multiStopQueue.length})
                  </span>
                </div>
                {onClearStops && (
                  <button
                    onClick={onClearStops}
                    className="text-[11px] text-rose-500 font-semibold px-2 py-0.5 rounded-md hover:bg-rose-50 transition-colors"
                  >
                    Rimuovi tutte
                  </button>
                )}
              </div>
              {multiStopQueue.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--gm-border-soft)] last:border-0"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                    style={{ background: 'var(--gm-accent)' }}>
                    {index + 1}
                  </div>
                  <MapPin className="w-3 h-3 text-[var(--gm-text-muted)] flex-shrink-0" />
                  <span className="text-xs text-[var(--gm-text)] truncate flex-1">{stop.name}</span>
                  {onRemoveStop && (
                    <button
                      onClick={() => onRemoveStop(stop.id)}
                      className="p-1 rounded-full hover:bg-[var(--gm-surface-soft)] transition-colors flex-shrink-0"
                      aria-label={`Rimuovi ${stop.name}`}
                    >
                      <X className="w-3 h-3 text-[var(--gm-text-muted)]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Weather */}
          {trail.coordinates && (
            <div className="mt-4">
              <WeatherWidget lat={trail.coordinates.lat} lng={trail.coordinates.lng} />
            </div>
          )}

          {/* Photo strip */}
          {trail.photos.length > 0 && (
            <div className="mt-4">
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {trail.photos.slice(0, 6).map((photo, index) => (
                  <button
                    key={`${trail.id}-${index}`}
                    onClick={() => onOpenLightbox(index)}
                    className="relative flex-shrink-0 w-[96px] h-[96px] rounded-2xl overflow-hidden snap-start border border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)] active:scale-95 transition-transform"
                  >
                    <SmartImage
                      src={photo}
                      alt=""
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                      width={220}
                      quality={60}
                      priority={index < 2}
                    />
                    {index === 5 && trail.photos.length > 6 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">+{trail.photos.length - 6}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description preview */}
          {!isExpanded && hasDescription && (
            <button
              onClick={() => setIsExpanded(true)}
              className="gm-card mt-4 w-full px-4 py-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2 text-[var(--gm-accent)]">
                <AlignLeft className="w-4 h-4" />
                <span className="gm-section-title !text-[var(--gm-accent)]">Descrizione</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--gm-text-muted)] line-clamp-2">
                {trail.description}
              </p>
            </button>
          )}

          {/* Expanded description */}
          {isExpanded && (
            <div className="mt-4 space-y-4 animate-in fade-in duration-200">
              {hasDescription && (
                <div className="gm-card px-4 py-4">
                  <p className="gm-section-title">Descrizione</p>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--gm-text-muted)] whitespace-pre-line">
                    {trail.description}
                  </p>
                </div>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full flex items-center justify-center gap-1 text-xs text-[var(--gm-text-muted)] py-2"
              >
                <ChevronDown className="w-4 h-4 rotate-180" />
                Comprimi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
