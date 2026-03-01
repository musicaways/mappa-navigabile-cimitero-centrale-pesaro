import React, { useEffect, useRef, useState } from 'react';
import { AlignLeft, ChevronDown, Navigation2, Printer, Share2, X } from 'lucide-react';
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
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  trail,
  onClose,
  onNavigate,
  onOpenLightbox,
  onOpenPrintModal,
  onOpenQrShare,
  isDesktop = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  useEffect(() => {
    setIsExpanded(false);
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

    if (diff < -50) {
      setIsExpanded(true);
    } else if (diff > 50) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[3000] no-print transition-transform duration-300"
      style={{
        transform: trail ? 'translateY(0)' : 'translateY(110%)',
        maxHeight: '90vh',
      }}
    >
      <div className="gm-panel-elevated rounded-t-[28px] border-b-0 overflow-hidden">
        <div
          className="relative flex h-10 items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="h-1.5 w-12 rounded-full bg-[var(--gm-border)]" />
          <button
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="gm-icon-button absolute right-4 top-1"
            aria-label="Chiudi scheda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={cn('overflow-y-auto px-5 pb-5', isExpanded ? 'max-h-[calc(90vh-2.5rem)]' : 'max-h-[42vh]')}
          style={{ minHeight: isExpanded ? '70vh' : 'auto' }}
        >
          <div className="pr-12">
            <p className="gm-section-title">Punto selezionato</p>
            <h2 className="gm-info-title mt-1">{trail.name}</h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={() => onNavigate(trail)} className="gm-button-primary">
              <Navigation2 className="w-4 h-4" />
              GPS
            </button>
            <button onClick={onOpenQrShare} className="gm-button-secondary">
              <Share2 className="w-4 h-4" />
              Condividi
            </button>
            {isDesktop ? (
              <button onClick={onOpenPrintModal} className="gm-button-secondary">
                <Printer className="w-4 h-4" />
                Stampa
              </button>
            ) : (
              <button onClick={() => setIsExpanded((prev) => !prev)} className="gm-button-secondary">
                <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                Dettagli
              </button>
            )}
          </div>

          {trail.coordinates && (
            <div className="mt-4">
              <WeatherWidget lat={trail.coordinates.lat} lng={trail.coordinates.lng} />
            </div>
          )}

          {trail.photos.length > 0 && (
            <div className="mt-4">
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {trail.photos.slice(0, 5).map((photo, index) => (
                  <button
                    key={`${trail.id}-${index}`}
                    onClick={() => onOpenLightbox(index)}
                    className="relative flex-shrink-0 w-[96px] h-[96px] rounded-2xl overflow-hidden snap-start border border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)]"
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
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isExpanded && hasDescription && (
            <button
              onClick={() => setIsExpanded(true)}
              className="gm-card mt-4 w-full px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2 text-[var(--gm-accent)]">
                <AlignLeft className="w-4 h-4" />
                <span className="gm-section-title !text-[var(--gm-accent)]">Descrizione</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--gm-text-muted)] line-clamp-2">{trail.description}</p>
            </button>
          )}

          {isExpanded && (
            <div className="mt-4 space-y-4 animate-in fade-in duration-200">
              <div className="gm-card px-4 py-4">
                <p className="gm-section-title">Descrizione completa</p>
                <p className="mt-3 text-[15px] leading-7 text-[var(--gm-text-muted)] whitespace-pre-line">
                  {hasDescription ? trail.description : 'Nessuna descrizione disponibile.'}
                </p>
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="w-full flex items-center justify-center text-[var(--gm-text-muted)] pb-2"
              >
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
