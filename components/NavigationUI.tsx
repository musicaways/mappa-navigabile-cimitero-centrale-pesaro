import React from 'react';
import { Clock3, Navigation, Volume2, VolumeX, X } from 'lucide-react';

interface NavigationUIProps {
  isActive: boolean;
  distance: number;
  pathDistance: number;
  onStop: () => void;
  destinationName: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

const NavigationUI: React.FC<NavigationUIProps> = ({
  isActive,
  distance,
  pathDistance,
  onStop,
  destinationName,
  voiceEnabled,
  onToggleVoice,
}) => {
  if (!isActive) return null;

  // 4 km/h = 66.67 m/min
  const WALK_M_PER_MIN = 4000 / 60;
  const fmtEta = (meters: number) => {
    const mins = Math.ceil(meters / WALK_M_PER_MIN);
    return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
  };
  const timeLeft = fmtEta(distance);
  const distanceFormatted = distance > 1000 ? (distance / 1000).toFixed(1) : Math.round(distance);
  const distanceUnit = distance > 1000 ? 'km' : 'm';

  const totalLabel =
    pathDistance >= 1000
      ? `Percorso ${(pathDistance / 1000).toFixed(1)} km · ~${fmtEta(pathDistance)}`
      : pathDistance > 0
        ? `Percorso ${Math.round(pathDistance)} m · ~${fmtEta(pathDistance)}`
        : '';

  return (
    <div
      className="fixed bottom-6 left-4 right-4 md:left-auto md:w-[360px] z-[2200] animate-in slide-in-from-bottom duration-300 no-print"
      role="status"
      aria-live="polite"
    >
      <div className="gm-panel-elevated overflow-hidden">
        <div className="gm-panel-header px-4 py-3 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[var(--gm-accent)] shrink-0" />
          <h2 className="text-sm font-semibold text-[var(--gm-text)] truncate flex-1">
            Verso {destinationName}
          </h2>
          <button
            onClick={onToggleVoice}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
              voiceEnabled
                ? 'bg-[var(--gm-accent)] text-white shadow-sm'
                : 'bg-[var(--gm-surface-soft)] border border-[color:var(--gm-border)] text-[var(--gm-text-muted)]'
            }`}
            title={voiceEnabled ? 'Disattiva guida vocale' : 'Attiva guida vocale'}
            aria-label={voiceEnabled ? 'Disattiva guida vocale' : 'Attiva guida vocale'}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-end gap-2">
              <span className="text-[2.6rem] leading-none font-black text-[var(--gm-text)] tracking-[-0.04em]">
                {distanceFormatted}
              </span>
              <span className="pb-1 text-base font-bold text-[var(--gm-text-muted)]">
                {distanceUnit}
              </span>
            </div>
            {totalLabel && (
              <p className="text-[10px] text-[var(--gm-text-muted)] mt-0.5 leading-none">
                {totalLabel}
              </p>
            )}
            <div
              className="mt-2.5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[var(--gm-accent)] text-sm font-semibold"
              style={{ background: 'color-mix(in srgb, var(--gm-accent) 10%, white)' }}
            >
              <Clock3 className="w-4 h-4" />
              {timeLeft}
            </div>
          </div>

          <button
            onClick={onStop}
            className="gm-icon-button bg-[#fce8e6] border-[#f6c7c2] text-[var(--gm-danger)]"
            title="Termina navigazione"
            aria-label="Termina navigazione"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationUI;
