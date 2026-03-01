import React from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  isIosManualInstall: boolean;
  canPromptInstall: boolean;
  onClose: () => void;
  onInstallNow: () => void;
}

const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  isIosManualInstall,
  canPromptInstall,
  onClose,
  onInstallNow,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[8000] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        className="gm-panel-elevated w-full max-w-md overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gm-panel-header px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[var(--gm-accent)]" />
            <div>
              <p className="gm-section-title">Installazione</p>
              <h2 className="text-lg font-semibold text-[var(--gm-text)]">Aggiungi l'app al telefono</h2>
            </div>
          </div>
          <button onClick={onClose} className="gm-icon-button" aria-label="Chiudi finestra installazione">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {canPromptInstall && (
            <div className="gm-card px-4 py-4 space-y-3">
              <p className="text-sm leading-6 text-[var(--gm-text-muted)]">
                Il browser supporta l'installazione diretta. Confermando, l'app verrà aggiunta alla schermata Home.
              </p>
              <button onClick={onInstallNow} className="gm-button-primary w-full">
                <Download className="w-4 h-4" />
                Installa ora
              </button>
            </div>
          )}

          {isIosManualInstall && (
            <div className="gm-card px-4 py-4 space-y-3">
              <p className="text-sm leading-6 text-[var(--gm-text-muted)]">
                Su iPhone e iPad l'installazione avviene dal menu di condivisione del browser.
              </p>
              <div className="space-y-2 text-sm text-[var(--gm-text)]">
                <div className="flex items-start gap-2">
                  <span className="gm-chip-active shrink-0">1</span>
                  <p>Tocca il pulsante <strong>Condividi</strong> di Safari.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="gm-chip-active shrink-0">2</span>
                  <p>Seleziona <strong>Aggiungi a Home</strong>.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="gm-chip-active shrink-0">3</span>
                  <p>Conferma per installare l'app sul telefono.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--gm-text-muted)]">
                <Share2 className="w-4 h-4" />
                <span>Se non vedi l'opzione, scorri il menu azioni di Safari verso il basso.</span>
              </div>
            </div>
          )}

          {!canPromptInstall && !isIosManualInstall && (
            <div className="gm-card px-4 py-4">
              <p className="text-sm leading-6 text-[var(--gm-text-muted)]">
                Questo browser non espone un prompt di installazione diretto. Prova dal menu del browser con l'opzione
                <strong> Installa app</strong> oppure apri il sito in Chrome, Edge o Safari mobile.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallAppModal;
