import React, { useEffect, useState } from 'react';
import { Download, ListOrdered, Loader2, MapPin, Palette, Printer, X } from 'lucide-react';
import { TrailData } from '../types';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailName: string;
  gates: TrailData[];
  onPlan: (gate: TrailData) => void;
  isCalculating: boolean;
  hasPath: boolean;
  pathDistanceM?: number;
  printInColor: boolean;
  onTogglePrintColorMode: () => void;
  onPrepareAndPrint: () => Promise<void>;
  onExportImage?: () => Promise<void>;
  multiStopQueue?: TrailData[];
  onRemoveStop?: (id: string) => void;
  // Post-calculation sorted data
  sortedStops?: TrailData[];
  segmentDistancesM?: number[];
}

const WALK_M_PER_MIN = 4000 / 60;
const fmtDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
const fmtEta = (m: number) => { const mins = Math.ceil(m / WALK_M_PER_MIN); return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`; };

const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  trailName,
  gates,
  onPlan,
  isCalculating,
  hasPath,
  pathDistanceM = 0,
  printInColor,
  onTogglePrintColorMode,
  onPrepareAndPrint,
  onExportImage,
  multiStopQueue = [],
  onRemoveStop,
  sortedStops = [],
  segmentDistancesM = [],
}) => {
  const etaLabel = pathDistanceM > 0
    ? `${fmtDist(pathDistanceM)} · ~${fmtEta(pathDistanceM)} a piedi`
    : '';
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedGateId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGateSelect = (gate: TrailData) => {
    setSelectedGateId(gate.id);
    onPlan(gate);
  };

  const handlePrint = async () => {
    if (isPreparingPrint || !hasPath || isCalculating) return;

    setIsPreparingPrint(true);
    try {
      await onPrepareAndPrint();
    } finally {
      setIsPreparingPrint(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[6000] w-full max-w-sm no-print animate-in slide-in-from-right duration-200">
      <div className="gm-panel-elevated overflow-hidden max-h-[90vh] flex flex-col">
        <div className="gm-panel-header px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[var(--gm-accent)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--gm-text)]">Stampa percorso</h2>
              <p className="text-xs text-[var(--gm-text-muted)]">{trailName}</p>
            </div>
          </div>
          <button onClick={onClose} className="gm-icon-button" title="Chiudi">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto space-y-5">
          <section>
            <p className="gm-section-title">Punto selezionato</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--gm-text)] leading-tight">{trailName}</h3>

            {/* After calculation: sorted route with distances */}
            {sortedStops.length > 0 && hasPath ? (
              <div className="mt-2 rounded-xl border border-emerald-200 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-100">
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                    Percorso ottimizzato · {sortedStops.length} tappe
                  </span>
                </div>
                {sortedStops.map((stop, i) => {
                  const distM = segmentDistancesM[i] ?? 0;
                  return (
                    <div key={stop.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--gm-border-soft)] last:border-0 bg-white">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-xs text-[var(--gm-text)] truncate flex-1">{stop.name}</span>
                      {distM > 0 && (
                        <span className="text-[10px] text-[var(--gm-text-muted)] font-medium shrink-0">{fmtDist(distM)}</span>
                      )}
                      {onRemoveStop && (
                        <button onClick={() => onRemoveStop(stop.id)} className="p-0.5 rounded hover:bg-[var(--gm-surface-soft)]" title="Rimuovi tappa">
                          <X className="w-3 h-3 text-[var(--gm-text-muted)]" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : multiStopQueue.length > 0 ? (
              /* Before calculation: click order */
              <div className="mt-2 rounded-xl border border-[color:var(--gm-border)] overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gm-surface-soft)] border-b border-[color:var(--gm-border-soft)]">
                  <ListOrdered className="w-3.5 h-3.5 text-[var(--gm-accent)]" />
                  <span className="text-[11px] font-semibold text-[var(--gm-text-muted)] uppercase tracking-wide">
                    + {multiStopQueue.length} {multiStopQueue.length === 1 ? 'tappa aggiuntiva' : 'tappe aggiuntive'}
                  </span>
                </div>
                {[{ name: trailName, id: '__primary__' }, ...multiStopQueue].map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--gm-border-soft)] last:border-0">
                    <div className="w-5 h-5 rounded-full bg-[var(--gm-accent)] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-xs text-[var(--gm-text)] truncate flex-1">{stop.name}</span>
                    {onRemoveStop && i > 0 && (
                      <button onClick={() => onRemoveStop(stop.id)} className="p-0.5 rounded hover:bg-[var(--gm-surface-soft)]">
                        <X className="w-3 h-3 text-[var(--gm-text-muted)]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section>
            <label className="gm-section-title flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--gm-accent)]" />
              Cancello di partenza
            </label>
            <div className="mt-3 space-y-2">
              {gates.length === 0 && (
                <div className="gm-card px-3 py-3 text-sm text-[var(--gm-danger)]">Nessun cancello trovato.</div>
              )}
              {gates.map((gate) => {
                const selected = selectedGateId === gate.id;
                return (
                  <button
                    key={gate.id}
                    onClick={() => handleGateSelect(gate)}
                    disabled={isCalculating}
                    className={selected ? 'gm-chip-active w-full flex items-center justify-between text-left' : 'gm-chip w-full flex items-center justify-between text-left hover:bg-white'}
                  >
                    <span>{gate.name}</span>
                    {selected && isCalculating && <Loader2 className="w-4 h-4 animate-spin" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label className="gm-section-title flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--gm-accent)]" />
              Modalita stampa
            </label>
            <button
              onClick={onTogglePrintColorMode}
              className={printInColor ? 'gm-chip-active mt-3 w-full flex items-center justify-between' : 'gm-chip mt-3 w-full flex items-center justify-between hover:bg-white'}
              title={printInColor ? 'Stampa a colori attiva' : 'Stampa bianco e nero attiva'}
            >
              <span>{printInColor ? 'Stampa a colori' : 'Stampa B/N ad alto contrasto'}</span>
              <span className="text-xs">{printInColor ? 'Colori' : 'B/N'}</span>
            </button>
            <p className="mt-2 text-xs text-[var(--gm-text-muted)]">
              B/N resta la modalita piu leggibile su stampanti monocromatiche.
            </p>
          </section>

          {hasPath && !isCalculating && (
            <div
              className="gm-card px-3 py-3 text-sm text-[var(--gm-success)] space-y-0.5"
              style={{ background: 'color-mix(in srgb, var(--gm-success) 10%, white)' }}
            >
              <p>Percorso calcolato e pronto per la stampa.</p>
              {etaLabel && (
                <p className="text-xs font-semibold opacity-80">{etaLabel}</p>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)] flex flex-col gap-2">
          {onExportImage && hasPath && !isCalculating && (
            <button
              onClick={async () => {
                if (isExportingImage) return;
                setIsExportingImage(true);
                try { await onExportImage(); } finally { setIsExportingImage(false); }
              }}
              disabled={isExportingImage}
              className="gm-button-secondary w-full disabled:opacity-50"
            >
              {isExportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExportingImage ? 'Generazione immagine...' : 'Salva immagine percorso'}
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="gm-button-secondary">
              Annulla
            </button>
            <button
              onClick={handlePrint}
              disabled={!hasPath || isCalculating || isPreparingPrint}
              className="gm-button-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPreparingPrint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {isPreparingPrint ? 'Preparazione stampa...' : 'Stampa ora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintModal;
