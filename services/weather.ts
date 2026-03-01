
export interface WeatherData {
  current: {
    temp: number;
    code: number;
    windSpeed: number;
  };
  daily: {
    time: string[];
    code: number[];
    tempMax: number[];
    tempMin: number[];
  };
}

interface WeatherCacheEntry {
  data: WeatherData;
  expiresAt: number;
}

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 8000;
const weatherCache = new Map<string, WeatherCacheEntry>();

// Open-Meteo WMO Code Mapping
export const getWeatherInfo = (code: number) => {
  switch (code) {
    case 0: return { label: 'Sereno', icon: 'sun' };
    case 1: 
    case 2: return { label: 'Poco Nuvoloso', icon: 'cloud-sun' };
    case 3: return { label: 'Nuvoloso', icon: 'cloud' };
    case 45: 
    case 48: return { label: 'Nebbia', icon: 'cloud-fog' };
    case 51:
    case 53:
    case 55: return { label: 'Pioviggine', icon: 'cloud-drizzle' };
    case 61:
    case 63:
    case 65: return { label: 'Pioggia', icon: 'cloud-rain' };
    case 71:
    case 73:
    case 75: return { label: 'Neve', icon: 'cloud-snow' };
    case 95:
    case 96:
    case 99: return { label: 'Temporale', icon: 'cloud-lightning' };
    default: return { label: 'Variabile', icon: 'cloud' };
  }
};

export const fetchWeather = async (lat: number, lng: number): Promise<WeatherData | null> => {
  try {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const now = Date.now();
    const cached = weatherCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'temperature_2m,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: 'auto',
      forecast_days: '3'
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      signal: controller.signal,
    }).finally(() => {
      window.clearTimeout(timeout);
    });
    if (!res.ok) throw new Error('Weather fetch failed');
    
    const data = await res.json();
    
    const parsed: WeatherData = {
      current: {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weather_code,
        windSpeed: Math.round(data.current.wind_speed_10m)
      },
      daily: {
        time: data.daily.time,
        code: data.daily.weather_code,
        tempMax: data.daily.temperature_2m_max,
        tempMin: data.daily.temperature_2m_min
      }
    };
    weatherCache.set(cacheKey, {
      data: parsed,
      expiresAt: now + WEATHER_CACHE_TTL_MS,
    });
    return parsed;
  } catch (error) {
    console.error(error);
    return null;
  }
};
