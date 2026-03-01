import React from 'react';
import { HelpCircle, Home, Plus, Printer, Search as SearchIcon, Share2, Smartphone, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const items = [
  {
    icon: SearchIcon,
    title: 'Ricerca rapida',
    description: 'La barra in alto usa quasi tutta la larghezza disponibile. Quando la apri, la scheda laterale si chiude per lasciare spazio ai risultati.',
  },
  {
    icon: Plus,
    title: 'Menu azioni',
    description: 'Il pulsante + raccoglie le azioni principali: mostra o nascondi i settori, reset vista, informazioni e guida.',
  },
  {
    icon: Smartphone,
    title: 'Navigazione GPS',
    description: 'La navigazione attiva resta disponibile su mobile. Da desktop puoi comunque pianificare e stampare il percorso dal cancello scelto.',
  },
  {
    icon: Printer,
    title: 'Calcolo e stampa percorso',
    description: 'La finestra stampa calcola il percorso da un cancello, mantiene la vista completa del cimitero e stampa solo il tracciato selezionato.',
  },
  {
    icon: Share2,
    title: 'Condividi posizione',
    description: 'Dal pannello laterale puoi generare un QR o un link diretto al punto selezionato per aprirlo subito su un altro dispositivo.',
  },
  {
    icon: Home,
    title: 'Vista iniziale',
    description: 'Il reset dal menu + riporta rapidamente la mappa alla visione completa del cimitero e delle sue mura.',
  },
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[8000] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="gm-panel-elevated w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="gm-panel-header px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[var(--gm-accent)]" />
            <div>
              <p className="gm-section-title">Guida</p>
              <h2 className="text-lg font-semibold text-[var(--gm-text)]">Funzioni disponibili</h2>
            </div>
          </div>
          <button onClick={onClose} className="gm-icon-button" aria-label="Chiudi guida">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto space-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="gm-card px-4 py-4 flex gap-3">
                <div
                  className="w-10 h-10 rounded-full text-[var(--gm-accent)] flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--gm-accent) 10%, white)' }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--gm-text)]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--gm-text-muted)]">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
