import React, { useEffect } from 'react';
import { Image as ImageIcon, Info, Navigation2, Printer, Share2, X } from 'lucide-react';
import { TrailData } from '../types';
import SmartImage, { preloadImagePreview } from './SmartImage';
import WeatherWidget from './WeatherWidget';

interface InfoSidebarDesktopProps {
  trail: TrailData;
  onClose: () => void;
  onNavigate: (trail: TrailData) => void;
  onOpenLightbox: (index: number) => void;
  onOpenPrintModal: () => void;
  onOpenQrShare: () => void;
}

const InfoSidebarDesktop: React.FC<InfoSidebarDesktopProps> = ({
  trail,
  onClose,
  onNavigate,
  onOpenLightbox,
  onOpenPrintModal,
  onOpenQrShare,
}) => {
  const hasDescription =
    trail.description.trim().length > 0 && trail.description !== 'Nessuna descrizione disponibile.';

  useEffect(() => {
    trail.photos.slice(0, 8).forEach((photo, index) => {
      preloadImagePreview(photo, index < 3 ? 420 : 300, index < 3 ? 68 : 56);
    });
  }, [trail.id, trail.photos]);

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-[3300] w-[360px] no-print">
      <div className="gm-panel-elevated h-full flex flex-col overflow-hidden">
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
              title="Chiudi selezione"
              aria-label="Chiudi selezione"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)]">
          {trail.coordinates && <WeatherWidget lat={trail.coordinates.lat} lng={trail.coordinates.lng} variant="compact" />}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onOpenPrintModal} className="gm-button-primary">
              <Printer className="w-4 h-4" />
              Stampa
            </button>
            <button onClick={() => onNavigate(trail)} className="gm-button-secondary">
              <Navigation2 className="w-4 h-4" />
              GPS
            </button>
            <button onClick={onOpenQrShare} className="gm-button-secondary col-span-2">
              <Share2 className="w-4 h-4" />
              Condividi posizione
            </button>
          </div>
        </div>

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
