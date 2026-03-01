import React from 'react';
import { Clock3, Mail, MapPin, Phone, X } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[8000] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="gm-panel-elevated w-full max-w-md max-h-[88vh] overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="gm-panel-header px-4 py-3 flex items-center justify-between">
          <div>
            <p className="gm-section-title">Servizi</p>
            <h2 className="text-lg font-semibold text-[var(--gm-text)]">Info e contatti</h2>
          </div>
          <button onClick={onClose} className="gm-icon-button" aria-label="Chiudi informazioni">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto space-y-4">
          <section className="gm-card px-4 py-4">
            <h3 className="text-base font-semibold text-[var(--gm-text)] flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-[var(--gm-accent)]" />
              Orari apertura cimiteri
            </h3>
            <div className="mt-3 space-y-3 text-sm text-[var(--gm-text-muted)]">
              <div>
                <p className="font-semibold text-[var(--gm-text)]">Da ottobre a marzo</p>
                <p>07:30 - 17:00</p>
              </div>
              <div className="border-t border-[color:var(--gm-border-soft)] pt-3">
                <p className="font-semibold text-[var(--gm-text)]">Da marzo a ottobre</p>
                <p>07:30 - 19:00</p>
              </div>
              <p className="text-xs">L&apos;orario cambia con il passaggio tra ora legale e ora solare.</p>
            </div>
          </section>

          <section className="gm-card px-4 py-4">
            <p className="gm-section-title">Cimitero Centrale di Pesaro S. Decenzio</p>
            <div className="mt-3 space-y-3 text-sm text-[var(--gm-text-muted)]">
              <p className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-[var(--gm-accent)] shrink-0" />
                <span>Via Giovan Battista Mirabelli, 13 - Pesaro</span>
              </p>
              <p className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[var(--gm-accent)] shrink-0" />
                <a href="tel:0721390705" className="font-semibold text-[var(--gm-text)] hover:underline">
                  0721.390705
                </a>
              </p>
              <p className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[var(--gm-accent)] shrink-0" />
                <a href="mailto:cimiteriali.segreteria@aspes.it" className="font-semibold text-[var(--gm-text)] hover:underline break-all">
                  cimiteriali.segreteria@aspes.it
                </a>
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[color:var(--gm-border-soft)] text-sm text-[var(--gm-text-muted)]">
              <p className="font-semibold text-[var(--gm-text)]">Orari apertura uffici al pubblico</p>
              <p>Lun - Sab: 08:00 - 13:00</p>
            </div>
          </section>

          <section className="gm-card px-4 py-4">
            <p className="gm-section-title">Polizia Mortuaria e Lampade Votive</p>
            <div className="mt-3 space-y-3 text-sm text-[var(--gm-text-muted)]">
              <p className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-[var(--gm-accent)] shrink-0" />
                <span>
                  c/o Centro Direzionale Benelli
                  <br />
                  Via Goffredo Mameli, 116 - Pesaro
                </span>
              </p>
              <p className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[var(--gm-accent)] shrink-0" />
                <a href="tel:0721372481" className="font-semibold text-[var(--gm-text)] hover:underline">
                  0721.372481
                </a>
              </p>
              <p className="text-sm">Fax: 0721.392459</p>
              <p className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[var(--gm-accent)] shrink-0" />
                <a href="mailto:info.poliziamortuaria@aspes.it" className="font-semibold text-[var(--gm-text)] hover:underline break-all">
                  info.poliziamortuaria@aspes.it
                </a>
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[color:var(--gm-border-soft)] text-sm text-[var(--gm-text-muted)]">
              <p className="font-semibold text-[var(--gm-text)]">Orari apertura uffici al pubblico</p>
              <p>Lun - Sab: 08:00 - 13:00</p>
            </div>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)]">
          <a
            href="https://www.aspes.it/servizi/servizi-cimiteriali/"
            target="_blank"
            rel="noopener noreferrer"
            className="gm-button-primary w-full"
          >
            Visita il sito ufficiale
          </a>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
