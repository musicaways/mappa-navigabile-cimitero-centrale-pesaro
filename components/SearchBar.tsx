import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { TrailData } from '../types';
import { cn } from '../utils';

interface SearchBarProps {
  trails: TrailData[];
  onSelect: (trail: TrailData) => void;
  openRequestKey?: number;
  onOpen?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  trails,
  onSelect,
  openRequestKey = 0,
  onOpen,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      return [];
    }

    return trails
      .map((trail) => {
        const name = trail.name.toLowerCase();
        const keywords = trail.keywords.join(' ').toLowerCase();
        const description = trail.description.toLowerCase();
        let score = 0;

        if (name.startsWith(q)) score += 120;
        if (name.includes(q)) score += 80;
        if (keywords.includes(q)) score += 45;
        if (description.includes(q)) score += 15;

        return { trail, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.trail.name.localeCompare(b.trail.name, 'it'))
      .slice(0, 40)
      .map((entry) => entry.trail);
  }, [query, trails]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideInteraction = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current?.contains(target)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('pointerdown', handleOutsideInteraction);
    return () => document.removeEventListener('pointerdown', handleOutsideInteraction);
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (openRequestKey === 0) return;
    onOpen?.();
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [onOpen, openRequestKey]);

  const closeSearch = () => {
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(0);
  };

  const toggleSearch = () => {
    if (isOpen) {
      closeSearch();
      return;
    }

    onOpen?.();
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSelect = (trail: TrailData) => {
    onSelect(trail);
    closeSearch();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'fixed top-4 z-[3300] flex flex-col transition-all duration-200 no-print',
        isOpen ? 'left-4 right-4 items-stretch' : 'right-4 w-[48px] items-end'
      )}
    >
      <div
        className={cn(
          'flex items-center overflow-hidden transition-all duration-200',
          isOpen ? 'gm-input-shell w-full' : 'w-[48px]'
        )}
      >
        <button
          type="button"
          onClick={toggleSearch}
          className={cn(
            'border-0 shadow-none',
            isOpen ? 'gm-icon-button bg-transparent text-[var(--gm-text-muted)]' : 'gm-map-control'
          )}
          aria-label={isOpen ? 'Chiudi ricerca' : 'Apri ricerca'}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeSearch();
              return;
            }

            if (!results.length) return;

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlightedIndex((prev) => Math.min(results.length - 1, prev + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlightedIndex((prev) => Math.max(0, prev - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const selected = results[highlightedIndex];
              if (selected) handleSelect(selected);
            }
          }}
          placeholder="Cerca settore, padiglione, campo o tomba di famiglia"
          className={cn(
            'h-[var(--gm-control-size)] flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--gm-text)] placeholder:text-[var(--gm-text-muted)] pr-4',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none w-0'
          )}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="gm-panel-elevated w-full mt-2 max-h-[50vh] overflow-y-auto overflow-x-hidden">
          {results.map((trail, index) => (
            <button
              key={trail.id}
              onClick={() => handleSelect(trail)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[color:var(--gm-border-soft)] last:border-0 transition-colors hover:bg-[var(--gm-surface-soft)]"
              style={highlightedIndex === index ? { background: 'color-mix(in srgb, var(--gm-accent) 10%, white)' } : undefined}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--gm-accent)] flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--gm-accent) 12%, white)' }}
              >
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold leading-5 text-[var(--gm-text)] whitespace-normal break-words">
                  {trail.name}
                </h4>
                <p className="text-xs leading-5 text-[var(--gm-text-muted)] whitespace-normal break-words line-clamp-2">
                  {trail.description || 'Punto disponibile sulla mappa'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim().length >= 2 && results.length === 0 && (
        <div className="gm-panel mt-2 w-full px-4 py-3 text-sm text-[var(--gm-text-muted)]">
          Nessun risultato trovato.
        </div>
      )}
    </div>
  );
};

export default SearchBar;
