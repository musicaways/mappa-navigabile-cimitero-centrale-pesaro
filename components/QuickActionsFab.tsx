import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Eye, EyeOff, HelpCircle, Home, Info, Layers, Plus } from 'lucide-react';

interface QuickActionsFabProps {
  showAllFeatures: boolean;
  onToggleFeatures: () => void;
  onResetView: () => void;
  onInfo: () => void;
  onHelp: () => void;
  canInstallApp?: boolean;
  onInstallApp?: () => void;
  behindBottomSheet?: boolean;
  showServices?: boolean;
  onToggleServices?: () => void;
}

const QuickActionsFab: React.FC<QuickActionsFabProps> = ({
  showAllFeatures,
  onToggleFeatures,
  onResetView,
  onInfo,
  onHelp,
  canInstallApp = false,
  onInstallApp,
  behindBottomSheet = false,
  showServices = false,
  onToggleServices,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const runAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`fixed right-4 bottom-4 ${behindBottomSheet ? 'z-[2800]' : 'z-[3200]'} flex flex-col items-end gap-3 no-print`}
    >
      {open && (
        <>
          {canInstallApp && onInstallApp && (
            <button onClick={() => runAction(onInstallApp)} className="gm-map-control-pill">
              <Download className="w-4 h-4" />
              Installa app
            </button>
          )}
          <a
            href="https://www.aspes.it/servizi/servizi-cimiteriali/"
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="gm-map-control-pill"
          >
            <ExternalLink className="w-4 h-4" />
            Sito ASPES
          </a>
          {onToggleServices && (
            <button onClick={() => runAction(onToggleServices)} className="gm-map-control-pill">
              <Layers className="w-4 h-4" />
              {showServices ? 'Nascondi servizi' : 'Servizi cimitero'}
            </button>
          )}
          <button onClick={() => runAction(onToggleFeatures)} className="gm-map-control-pill">
            {showAllFeatures ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAllFeatures ? 'Nascondi settori' : 'Mostra settori'}
          </button>
          <button onClick={() => runAction(onResetView)} className="gm-map-control-pill">
            <Home className="w-4 h-4" />
            Vista iniziale
          </button>
          <button onClick={() => runAction(onInfo)} className="gm-map-control-pill">
            <Info className="w-4 h-4" />
            Informazioni
          </button>
          <button onClick={() => runAction(onHelp)} className="gm-map-control-pill">
            <HelpCircle className="w-4 h-4" />
            Guida
          </button>
        </>
      )}

      <button onClick={() => setOpen((prev) => !prev)} className="gm-map-control" title="Azioni rapide" aria-label={open ? 'Chiudi menu azioni' : 'Apri menu azioni'} aria-expanded={open}>
        <Plus className={`w-5 h-5 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
};

export default QuickActionsFab;
