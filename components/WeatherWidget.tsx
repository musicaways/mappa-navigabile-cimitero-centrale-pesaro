
import React, { useEffect, useState } from 'react';
import { fetchWeather, WeatherData, getWeatherInfo } from '../services/weather';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Loader2,
  CloudSun,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WeatherWidgetProps {
  lat?: number;
  lng?: number;
  variant?: 'compact' | 'full';
}

const WeatherIcon = ({ iconName, className }: { iconName: string, className?: string }) => {
  switch (iconName) {
    case 'sun': return <Sun className={className} />;
    case 'cloud-sun': return <CloudSun className={className} />; 
    case 'cloud': return <Cloud className={className} />;
    case 'cloud-fog': return <CloudFog className={className} />;
    case 'cloud-drizzle': return <CloudDrizzle className={className} />;
    case 'cloud-rain': return <CloudRain className={className} />;
    case 'cloud-snow': return <CloudSnow className={className} />;
    case 'cloud-lightning': return <CloudLightning className={className} />;
    default: return <Cloud className={className} />;
  }
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ lat, lng, variant = 'full' }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCompactDetails, setShowCompactDetails] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;
    
    let mounted = true;
    setLoading(true);
    fetchWeather(lat, lng)
      .then((data) => {
        if (mounted) setWeather(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [lat, lng]);

  useEffect(() => {
    setShowCompactDetails(false);
  }, [lat, lng, variant]);

  if (lat == null || lng == null) return null;

  if (loading) {
    if (variant === 'compact') {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-2 text-[11px] text-[var(--gm-text-muted)] bg-[var(--gm-surface)] rounded-full border border-[color:var(--gm-border)] shadow-[var(--gm-shadow)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          Meteo
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-1 py-3 mb-2 text-xs text-[var(--gm-text-muted)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        Meteo...
      </div>
    );
  }

  if (!weather) return null;

  const currentInfo = getWeatherInfo(weather.current.code);

  if (variant === 'compact') {
    return (
      <div className="gm-card mb-1">
        <button
          onClick={() => setShowCompactDetails((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
          aria-label="Mostra dettagli meteo"
        >
          <div className="flex items-center gap-2">
            <WeatherIcon iconName={currentInfo.icon} className="w-4 h-4 text-[var(--gm-text-muted)]" />
            <span className="text-sm font-semibold text-[var(--gm-text)]">{weather.current.temp}°</span>
            <span className="text-[10px] font-semibold text-[var(--gm-text-muted)] uppercase tracking-wide">{currentInfo.label}</span>
          </div>
          {showCompactDetails ? (
            <ChevronUp className="w-4 h-4 text-[var(--gm-text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--gm-text-muted)]" />
          )}
        </button>
        {showCompactDetails && (
          <div className="px-3 pb-2 border-t border-[color:var(--gm-border-soft)]">
            <div className="flex items-center gap-4 pt-2">
              {weather.daily.time.slice(1, 3).map((dateStr, i) => {
                const info = getWeatherInfo(weather.daily.code[i + 1]);
                const maxTemp = Math.round(weather.daily.tempMax[i + 1]);
                const date = new Date(dateStr);
                const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');

                return (
                  <div key={dateStr} className="flex items-center gap-1 text-xs">
                    <span className="font-bold text-[var(--gm-text-muted)] uppercase">{dayName}</span>
                    <WeatherIcon iconName={info.icon} className="w-3 h-3 text-[var(--gm-text-muted)]" />
                    <span className="font-semibold text-[var(--gm-text)]">{maxTemp}°</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between py-3 px-3 bg-[var(--gm-surface-soft)] border border-[color:var(--gm-border)] mb-3 select-none"
      style={{ borderRadius: 'calc(var(--gm-radius) - 2px)' }}
    >
      
      {/* Sinistra: Meteo Attuale */}
      <div className="flex items-center gap-3">
          <WeatherIcon iconName={currentInfo.icon} className="w-6 h-6 text-[var(--gm-text-muted)]" />
          <div className="flex flex-col leading-none">
             <span className="text-lg font-bold text-[var(--gm-text)]">{weather.current.temp}°</span>
             <span className="text-[10px] font-medium text-[var(--gm-text-muted)] uppercase">{currentInfo.label}</span>
          </div>
      </div>

      {/* Destra: Prossimi 2 giorni (Compatto) */}
      <div className="flex items-center gap-4 pl-4 border-l border-[color:var(--gm-border)]">
        {weather.daily.time.slice(1, 3).map((dateStr, i) => {
             // daily.code e tempMax partono da oggi (index 0), quindi per domani prendiamo index 1
             const info = getWeatherInfo(weather.daily.code[i + 1]);
             const maxTemp = Math.round(weather.daily.tempMax[i + 1]);
             const date = new Date(dateStr);
             const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');

             return (
                 <div key={dateStr} className="flex flex-col items-center gap-0.5">
                     <span className="text-[9px] uppercase font-bold text-[var(--gm-text-muted)]">{dayName}</span>
                     <div className="flex items-center gap-1">
                        <WeatherIcon iconName={info.icon} className="w-3 h-3 text-[var(--gm-text-muted)]" />
                        <span className="text-xs font-semibold text-[var(--gm-text)]">{maxTemp}°</span>
                     </div>
                 </div>
             );
        })}
      </div>

    </div>
  );
};

export default WeatherWidget;
