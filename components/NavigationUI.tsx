import React from 'react';
import { Clock3, Navigation, X } from 'lucide-react';

interface NavigationUIProps {
  isActive: boolean;
  distance: number;
  onStop: () => void;
  destinationName: string;
}

const NavigationUI: React.FC<NavigationUIProps> = ({ isActive, distance, onStop, destinationName }) => {
  if (!isActive) return null;

  const minutesLeft = Math.ceil(distance / 83);
  const timeLeft = minutesLeft > 60 ? `${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m` : `${minutesLeft} min`;
  const distanceFormatted = distance > 1000 ? (distance / 1000).toFixed(1) : Math.round(distance);
  const distanceUnit = distance > 1000 ? 'km' : 'm';

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-auto md:w-[360px] z-[2200] animate-in slide-in-from-bottom duration-300 no-print">
      <div className="gm-panel-elevated overflow-hidden">
        <div className="gm-panel-header px-4 py-3 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[var(--gm-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--gm-text)] truncate">Verso {destinationName}</h2>
        </div>

        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-end gap-2">
              <span className="text-[2.6rem] leading-none font-black text-[var(--gm-text)] tracking-[-0.04em]">
                {distanceFormatted}
              </span>
              <span className="pb-1 text-base font-bold text-[var(--gm-text-muted)]">{distanceUnit}</span>
            </div>
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[var(--gm-accent)] text-sm font-semibold"
              style={{ background: 'color-mix(in srgb, var(--gm-accent) 10%, white)' }}
            >
              <Clock3 className="w-4 h-4" />
              {timeLeft}
            </div>
          </div>

          <button onClick={onStop} className="gm-icon-button bg-[#fce8e6] border-[#f6c7c2] text-[var(--gm-danger)]" title="Termina navigazione">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationUI;
