import React from 'react';
import { ListOrdered, MapPin, X } from 'lucide-react';
import { TrailData } from '../types';

interface MultiStopPanelProps {
  stops: TrailData[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const MultiStopPanel: React.FC<MultiStopPanelProps> = ({ stops, onRemove, onClear }) => {
  if (stops.length === 0) return null;

  return (
    <div className="fixed left-4 right-4 bottom-[calc(44vh+0.5rem)] z-[2900] gm-panel-elevated rounded-2xl overflow-hidden no-print">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--gm-border-soft)]">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-3.5 h-3.5 text-[var(--gm-accent)]" />
          <span className="text-[11px] font-semibold text-[var(--gm-text-muted)] uppercase tracking-wide">
            Tappe in coda ({stops.length})
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-[11px] text-rose-500 font-semibold px-2 py-0.5 rounded-md hover:bg-rose-50 transition-colors"
        >
          Rimuovi tutte
        </button>
      </div>

      <div className="max-h-28 overflow-y-auto">
        {stops.map((trail, index) => (
          <div
            key={trail.id}
            className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--gm-border-soft)] last:border-0"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
              style={{ background: 'var(--gm-accent)' }}
            >
              {index + 1}
            </div>
            <MapPin className="w-3 h-3 text-[var(--gm-text-muted)] flex-shrink-0" />
            <span className="text-xs text-[var(--gm-text)] truncate flex-1">{trail.name}</span>
            <button
              onClick={() => onRemove(trail.id)}
              className="p-1 rounded-full hover:bg-[var(--gm-surface-soft)] transition-colors flex-shrink-0"
              aria-label={`Rimuovi ${trail.name}`}
            >
              <X className="w-3 h-3 text-[var(--gm-text-muted)]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiStopPanel;
