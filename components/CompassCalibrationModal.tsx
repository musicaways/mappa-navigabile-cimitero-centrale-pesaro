import React from 'react';
import { Compass, X } from 'lucide-react';

interface CompassCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CompassCalibrationModal: React.FC<CompassCalibrationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        className="gm-panel w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gm-panel-header px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[var(--gm-accent)]" />
            <h2 className="text-base font-semibold text-[var(--gm-text)]">Calibra Bussola</h2>
          </div>
          <button onClick={onClose} className="gm-icon-button" aria-label="Chiudi">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-6 flex flex-col items-center gap-5">
          {/* Figure-8 phone animation */}
          <div className="relative flex items-center justify-center w-32 h-40">
            {/* SVG figure-8 path for reference */}
            <svg
              className="absolute inset-0 w-full h-full opacity-10"
              viewBox="0 0 128 160"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M64 80 C64 50 100 30 100 60 C100 90 64 80 64 80 C64 80 28 70 28 100 C28 130 64 110 64 80"
                stroke="var(--gm-accent)"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            </svg>
            <span
              className="text-4xl select-none"
              style={{ animation: 'compass-figure8 3s ease-in-out infinite' }}
              aria-hidden="true"
            >
              📱
            </span>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-[var(--gm-text)]">
              Disegna un 8 nell&apos;aria con il telefono
            </p>
            <p className="text-xs text-[var(--gm-text-muted)] leading-relaxed">
              Tieni il dispositivo in verticale e muovilo lentamente formando
              il simbolo ∞ per 3–5 volte.
            </p>
          </div>

          <div className="w-full space-y-2.5 text-xs text-[var(--gm-text-muted)]">
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--gm-accent)] shrink-0">1.</span>
              <span>Allontanati da strutture metalliche o fonti magnetiche</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--gm-accent)] shrink-0">2.</span>
              <span>Muovi il telefono descrivendo lentamente la cifra 8 nell&apos;aria</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--gm-accent)] shrink-0">3.</span>
              <span>Ripeti 3–5 volte — la bussola migliorerà automaticamente</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)]">
          <button onClick={onClose} className="gm-button-primary w-full">
            Ho capito
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompassCalibrationModal;
