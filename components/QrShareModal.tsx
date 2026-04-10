import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ListOrdered, MapPin, Printer, QrCode, X } from 'lucide-react';
import { buildDeepLink } from '../services/deeplink';
import { TrailData } from '../types';

interface QrShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureId: string;
  title: string;
  userLocation?: { lat: number; lng: number } | null;
  multiStopQueue?: TrailData[];
}

const QrShareModal: React.FC<QrShareModalProps> = ({
  isOpen,
  onClose,
  featureId,
  title,
  userLocation,
  multiStopQueue = [],
}) => {
  const [openPrint, setOpenPrint] = useState(false);
  const [includeRoute, setIncludeRoute] = useState(false);
  const [includeStops, setIncludeStops] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(
    () =>
      buildDeepLink(featureId, {
        openPrint,
        from: includeRoute && userLocation ? userLocation : undefined,
        stops: includeStops && multiStopQueue.length > 0
          ? multiStopQueue.map((t) => t.id)
          : undefined,
      }),
    [featureId, openPrint, includeRoute, includeStops, userLocation, multiStopQueue]
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#202124', light: '#ffffff' },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, shareUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch (error) {
      console.error('Clipboard copy failed', error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[8100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        className="gm-panel w-full max-w-sm overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gm-panel-header px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <QrCode className="w-5 h-5 text-[var(--gm-accent)]" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--gm-text)] truncate">Condividi punto</h2>
              <p className="text-xs text-[var(--gm-text-muted)] truncate">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="gm-icon-button" aria-label="Chiudi QR">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div
            className="border border-[color:var(--gm-border)] bg-white p-4 flex justify-center"
            style={{ borderRadius: 'calc(var(--gm-radius) - 2px)' }}
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code per ${title}`} className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 bg-neutral-100 animate-pulse rounded-xl" />
            )}
          </div>

          <label className="gm-chip flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-[var(--gm-accent)]" />
              <span className="text-sm text-[var(--gm-text)]">Apri stampa su desktop</span>
            </div>
            <input
              type="checkbox"
              checked={openPrint}
              onChange={(e) => setOpenPrint(e.target.checked)}
              className="h-4 w-4 accent-[var(--gm-accent)]"
            />
          </label>

          {userLocation && (
            <label className="gm-chip flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--gm-accent)]" />
                <div>
                  <p className="text-sm text-[var(--gm-text)]">Includi posizione di partenza</p>
                  <p className="text-[10px] text-[var(--gm-text-muted)]">
                    Chi scansiona vedrà il percorso dal tuo punto
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeRoute}
                onChange={(e) => setIncludeRoute(e.target.checked)}
                className="h-4 w-4 accent-[var(--gm-accent)]"
              />
            </label>
          )}

          {multiStopQueue.length > 0 && (
            <label className="gm-chip flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-[var(--gm-accent)]" />
                <div>
                  <p className="text-sm text-[var(--gm-text)]">Includi tappe aggiuntive</p>
                  <p className="text-[10px] text-[var(--gm-text-muted)]">
                    {multiStopQueue.length} {multiStopQueue.length === 1 ? 'tappa' : 'tappe'} in coda verranno condivise
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeStops}
                onChange={(e) => setIncludeStops(e.target.checked)}
                className="h-4 w-4 accent-[var(--gm-accent)]"
              />
            </label>
          )}

          <div
            className="border border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)] px-3 py-2 text-xs text-[var(--gm-text-muted)] break-all"
            style={{ borderRadius: 'calc(var(--gm-radius) - 2px)' }}
          >
            {shareUrl}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[color:var(--gm-border)] bg-[var(--gm-surface-soft)] flex gap-2">
          <button onClick={handleCopy} className="gm-button-secondary flex-1">
            <Copy className="w-4 h-4" />
            {copied ? 'Copiato' : 'Copia link'}
          </button>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`qr-${featureId}.png`}
              className="gm-button-primary flex-1"
            >
              <Download className="w-4 h-4" />
              Scarica
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrShareModal;
