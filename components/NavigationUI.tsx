import React from 'react';
import { Clock3, Navigation, Volume2, VolumeX, X } from 'lucide-react';
import { TurnInstruction } from '../types';

interface NavigationUIProps {
  isActive: boolean;
  distance: number;
  pathDistance: number;
  onStop: () => void;
  destinationName: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  nextInstruction?: { instruction: TurnInstruction; distanceToTurn: number } | null;
  walkingSpeedMs?: number;
}

const fmtDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

const fmtEta = (meters: number, speedMs: number) => {
  const mins = Math.ceil(meters / speedMs / 60);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
};

const NavigationUI: React.FC<NavigationUIProps> = ({
  isActive,
  distance,
  pathDistance,
  onStop,
  destinationName,
  voiceEnabled,
  onToggleVoice,
  nextInstruction,
  walkingSpeedMs = 4000 / 3600,
}) => {
  if (!isActive) return null;

  const timeLeft = fmtEta(distance, walkingSpeedMs);
  const distanceFormatted = distance > 1000 ? (distance / 1000).toFixed(1) : Math.round(distance);
  const distanceUnit = distance > 1000 ? 'km' : 'm';

  const totalLabel =
    pathDistance >= 1000
      ? `Percorso ${(pathDistance / 1000).toFixed(1)} km · ~${fmtEta(pathDistance, walkingSpeedMs)}`
      : pathDistance > 0
        ? `Percorso ${Math.round(pathDistance)} m · ~${fmtEta(pathDistance, walkingSpeedMs)}`
        : '';

  const showTurn =
    nextInstruction &&
    nextInstruction.instruction.direction !== 'start' &&
    nextInstruction.instruction.direction !== 'arrive' &&
    nextInstruction.distanceToTurn > 8;

  const showArrival =
    nextInstruction?.instruction.direction === 'arrive' &&
    nextInstruction.distanceToTurn <= 30;

  return (
    <div
      className="fixed bottom-6 left-4 right-4 md:left-auto md:w-[360px] z-[2200] animate-in slide-in-from-bottom duration-300 no-print"
      role="status"
      aria-live="polite"
    >
      <div className="gm-panel-elevated overflow-hidden">
        {/* Turn instruction banner */}
        {(showTurn || showArrival) && (
          <div
            className="px-4 py-2.5 flex items-center gap-3 border-b border-[color:var(--gm-border-soft)]"
            style={{ background: showArrival ? 'color-mix(in srgb, var(--gm-success) 12%, white)' : 'color-mix(in srgb, var(--gm-accent) 10%, white)' }}
          >
            <span className="text-2xl leading-none select-none">
              {nextInstruction!.instruction.symbol}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--gm-text)] truncate">
                {nextInstruction!.instruction.label}
              </p>
              {showTurn && (
                <p className="text-xs text-[var(--gm-text-muted)]">
                  tra {fmtDist(nextInstruction!.distanceToTurn)}
                </p>
              )}
            </div>
          </div>
        )}

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
