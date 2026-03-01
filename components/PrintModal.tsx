import React, { useEffect, useState } from 'react';
import { Loader2, MapPin, Palette, Printer, X } from 'lucide-react';
import { TrailData } from '../types';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailName: string;
  gates: TrailData[];
  onPlan: (gate: TrailData) => void;
  isCalculating: boolean;
  hasPath: boolean;
  printInColor: boolean;
  onTogglePrintColorMode: () => void;
  onPrepareAndPrint: () => Promise<void>;
}

const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  trailName,
  gates,
  onPlan,
  isCalculating,
  hasPath,
  printInColor,
  onTogglePrintColorMode,
  onPrepareAndPrint,
}) => {
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

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
              className="gm-card px-3 py-3 text-sm text-[var(--gm-success)]"
              style={{ background: 'color-mix(in srgb, var(--gm-success) 10%, white)' }}
            >
              Percorso calcolato e pronto per la stampa.
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)] flex gap-2">
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
  );
};

export default PrintModal;
