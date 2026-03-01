import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Printer, QrCode, X } from 'lucide-react';
import { buildDeepLink } from '../services/deeplink';

interface QrShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureId: string;
  title: string;
}

const QrShareModal: React.FC<QrShareModalProps> = ({ isOpen, onClose, featureId, title }) => {
  const [openPrint, setOpenPrint] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => buildDeepLink(featureId, { openPrint }), [featureId, openPrint]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    void QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#202124',
        light: '#ffffff',
      },
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
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
    <div className="fixed inset-0 z-[8100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="gm-panel w-full max-w-sm overflow-hidden" onClick={(event) => event.stopPropagation()}>
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

        <div className="px-4 py-4 space-y-4">
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
              <span className="text-sm text-[var(--gm-text)]">Apri anche stampa su desktop</span>
            </div>
            <input
              type="checkbox"
              checked={openPrint}
              onChange={(event) => setOpenPrint(event.target.checked)}
              className="h-4 w-4 accent-[var(--gm-accent)]"
            />
          </label>

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
