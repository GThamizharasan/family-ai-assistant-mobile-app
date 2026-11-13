/**
 * Weather Forecast & Live Coordinate Service
 * Provides real-time weather metrics, hourly & 7-day forecasts, reverse geocoding,
 * and high-accuracy GPS/IP location detection for mobile (Capacitor/WebView) and Web.
 */

import { getApiUrl } from './api';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface CurrentWeather {
  time: string;
  temperature: number; // °C
  apparentTemperature: number; // °C
  relativeHumidity: number; // %
  isDay: boolean;
  precipitation: number; // mm
  rain: number; // mm
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  windSpeed: number; // km/h
  windDirection: number; // degrees
  windDirectionCompass: string;
  cloudCover: number; // %
  pressure: number; // hPa
  uvIndex: number;
  visibility: number; // km
}

export interface HourlyForecastItem {
  time: string;
  formattedTime: string;
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  relativeHumidity: number;
  isDay: boolean;
}

export interface DailyForecastItem {
  date: string;
  dayName: string;
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  tempMax: number;
  tempMin: number;
  apparentTempMax: number;
  apparentTempMin: number;
  precipitationProbabilityMax: number;
  precipitationSum: number;
  windSpeedMax: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  coordinates: Coordinates;
  locationName: string;
  region?: string;
  country?: string;
  timezone: string;
  elevation: number;
  current: CurrentWeather;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  fetchedAt: string;
  source: 'gps' | 'search' | 'ip' | 'cached';
}

export interface GeoLocationResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
}

const WEATHER_CACHE_KEY = 'aura_weather_cache_v2';
const LAST_COORDS_KEY = 'aura_weather_last_coords_v2';

/**
 * WMO Weather Code interpreter with descriptions, Lucide icon keys, and theme gradients
 */
export function interpretWeatherCode(code: number, isDay: boolean = true): {
  description: string;
  iconName: 'Sun' | 'Moon' | 'CloudSun' | 'CloudMoon' | 'Cloud' | 'CloudFog' | 'CloudDrizzle' | 'CloudRain' | 'CloudSnow' | 'CloudLightning';
  badgeColor: string;
  gradientBg: string;
} {
  switch (code) {
    case 0:
      return {
        description: isDay ? 'Clear Sky' : 'Clear Night',
        iconName: isDay ? 'Sun' : 'Moon',
        badgeColor: isDay ? 'text-amber-400 bg-amber-500/20' : 'text-indigo-300 bg-indigo-500/20',
        gradientBg: isDay
          ? 'from-amber-600/30 via-orange-950/40 to-slate-950'
          : 'from-indigo-950 via-slate-900 to-slate-950',
      };
    case 1:
      return {
        description: isDay ? 'Mainly Clear' : 'Mainly Clear Night',
        iconName: isDay ? 'CloudSun' : 'CloudMoon',
        badgeColor: 'text-amber-300 bg-amber-500/15',
        gradientBg: isDay
          ? 'from-sky-700/30 via-slate-900 to-slate-950'
          : 'from-slate-900 via-indigo-950/60 to-slate-950',
      };
    case 2:
      return {
        description: 'Partly Cloudy',
        iconName: isDay ? 'CloudSun' : 'CloudMoon',
        badgeColor: 'text-sky-300 bg-sky-500/20',
        gradientBg: 'from-sky-800/30 via-slate-900 to-slate-950',
      };
    case 3:
      return {
        description: 'Overcast & Cloudy',
        iconName: 'Cloud',
        badgeColor: 'text-slate-300 bg-slate-700/40',
        gradientBg: 'from-slate-800/50 via-slate-900 to-slate-950',
      };
    case 45:
    case 48:
      return {
        description: 'Fog & Mist',
        iconName: 'CloudFog',
        badgeColor: 'text-teal-300 bg-teal-500/20',
        gradientBg: 'from-teal-950/60 via-slate-900 to-slate-950',
      };
    case 51:
    case 53:
    case 55:
      return {
        description: code === 51 ? 'Light Drizzle' : code === 53 ? 'Moderate Drizzle' : 'Heavy Drizzle',
        iconName: 'CloudDrizzle',
        badgeColor: 'text-cyan-300 bg-cyan-500/20',
        gradientBg: 'from-cyan-950/60 via-slate-900 to-slate-950',
      };
    case 56:
    case 57:
      return {
        description: 'Freezing Drizzle',
        iconName: 'CloudSnow',
        badgeColor: 'text-blue-300 bg-blue-500/20',
        gradientBg: 'from-blue-950/60 via-slate-900 to-slate-950',
      };
    case 61:
    case 63:
    case 65:
      return {
        description: code === 61 ? 'Slight Rain' : code === 63 ? 'Moderate Rain' : 'Heavy Rain',
        iconName: 'CloudRain',
        badgeColor: 'text-blue-400 bg-blue-500/20',
        gradientBg: 'from-blue-900/40 via-slate-900 to-slate-950',
      };
    case 66:
    case 67:
      return {
        description: 'Freezing Rain',
        iconName: 'CloudRain',
        badgeColor: 'text-cyan-300 bg-cyan-500/20',
        gradientBg: 'from-cyan-950/60 via-slate-900 to-slate-950',
      };
    case 71:
    case 73:
    case 75:
      return {
        description: code === 71 ? 'Slight Snowfall' : code === 73 ? 'Moderate Snow' : 'Heavy Snow',
        iconName: 'CloudSnow',
        badgeColor: 'text-white bg-slate-700/50',
        gradientBg: 'from-blue-900/30 via-slate-900 to-slate-950',
      };
    case 77:
      return {
        description: 'Snow Grains',
        iconName: 'CloudSnow',
        badgeColor: 'text-white bg-slate-700/50',
        gradientBg: 'from-blue-900/30 via-slate-900 to-slate-950',
      };
    case 80:
    case 81:
    case 82:
      return {
        description: code === 80 ? 'Light Showers' : code === 81 ? 'Moderate Showers' : 'Violent Downpour',
        iconName: 'CloudRain',
        badgeColor: 'text-sky-400 bg-sky-500/25',
        gradientBg: 'from-blue-900/50 via-slate-900 to-slate-950',
      };
    case 85:
    case 86:
      return {
        description: 'Snow Showers',
        iconName: 'CloudSnow',
        badgeColor: 'text-sky-200 bg-sky-500/20',
        gradientBg: 'from-slate-800 via-slate-900 to-slate-950',
      };
    case 95:
      return {
        description: 'Thunderstorm',
        iconName: 'CloudLightning',
        badgeColor: 'text-amber-400 bg-amber-500/25',
        gradientBg: 'from-purple-950/70 via-slate-900 to-slate-950',
      };
    case 96:
    case 99:
      return {
        description: 'Severe Thunderstorm with Hail',
        iconName: 'CloudLightning',
        badgeColor: 'text-rose-400 bg-rose-500/25',
        gradientBg: 'from-rose-950/70 via-slate-900 to-slate-950',
      };
    default:
      return {
        description: 'Fair Conditions',
        iconName: isDay ? 'Sun' : 'Moon',
        badgeColor: 'text-slate-300 bg-slate-800',
        gradientBg: 'from-slate-900 to-slate-950',
      };
  }
}

/**
 * Degrees (0-360) to 8-point Compass Direction
 */
export function degreesToCompass(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Celsius to Fahrenheit converter
 */
export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

/**
 * UV Index Category Description
 */
export function getUvCategory(uv: number): { label: string; color: string } {
  if (uv < 3) return { label: 'Low', color: 'text-emerald-400 bg-emerald-500/20' };
  if (uv < 6) return { label: 'Moderate', color: 'text-amber-400 bg-amber-500/20' };
  if (uv < 8) return { label: 'High', color: 'text-orange-400 bg-orange-500/20' };
  if (uv < 11) return { label: 'Very High', color: 'text-rose-400 bg-rose-500/20' };
  return { label: 'Extreme', color: 'text-purple-400 bg-purple-500/25' };
}

/**
 * Acquire user coordinates:
 * 1. Checks HTML5 / Capacitor navigator.geolocation with high accuracy
 * 2. Falls back to IP-based location services or last known coordinates
 * 3. Default fallback: Chennai (13.0827, 80.2707)
 */
export async function getCurrentCoordinates(): Promise<{ coords: Coordinates; source: 'gps' | 'ip' | 'cached' }> {
  // 1. Try GPS / Browser Geolocation
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
        });
      });

      const coords: Coordinates = {
        latitude: Number(position.coords.latitude.toFixed(4)),
        longitude: Number(position.coords.longitude.toFixed(4)),
        accuracy: Math.round(position.coords.accuracy || 10),
        altitude: position.coords.altitude ? Math.round(position.coords.altitude) : null,
        heading: position.coords.heading ?? null,
        speed: position.coords.speed ?? null,
      };

      try {
        localStorage.setItem(LAST_COORDS_KEY, JSON.stringify(coords));
      } catch {}

      return { coords, source: 'gps' };
    } catch (gpsError: any) {
      console.warn('[Weather] GPS Geolocation failed/denied, falling back to IP/Cache:', gpsError?.message);
    }
  }

  // 2. Try IP-based location fallback
  try {
    const ipRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData.latitude && ipData.longitude) {
        const coords: Coordinates = {
          latitude: Number(Number(ipData.latitude).toFixed(4)),
          longitude: Number(Number(ipData.longitude).toFixed(4)),
          accuracy: 5000,
        };
        return { coords, source: 'ip' };
      }
    }
  } catch (ipErr) {
    console.warn('[Weather] IP location lookup failed:', ipErr);
  }

  // 3. Try last saved coordinates
  try {
    const saved = localStorage.getItem(LAST_COORDS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.latitude && parsed.longitude) {
        return { coords: parsed, source: 'cached' };
      }
    }
  } catch {}

  // 4. Ultimate fallback (Chennai, India)
  return {
    coords: {
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 1000,
    },
    source: 'cached',
  };
}

/**
 * Reverse Geocode coordinates to human-readable Location Name
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<{ name: string; region?: string; country?: string }> {
  // 1. Try local backend reverse endpoint first
  try {
    const res = await fetch(getApiUrl(`/api/weather/reverse?lat=${latitude}&lon=${longitude}`), { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.name) {
        return { name: data.name, region: data.region, country: data.country };
      }
    }
  } catch {}

  // 2. Try Open-Meteo Geocoding / BigDataCloud client-side
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const res = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const d = await res.json();
      const city = d.locality || d.city || d.principalSubdivision || 'Current Location';
      const region = d.principalSubdivision || '';
      const country = d.countryName || '';
      return {
        name: region && city !== region ? `${city}, ${region}` : city,
        region,
        country,
      };
    }
  } catch {}

  // 3. Fallback to coordinate string
  return {
    name: `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`,
  };
}

/**
 * Search locations worldwide via Open-Meteo Geocoding API
 */
export async function searchLocations(query: string): Promise<GeoLocationResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // Try local proxy endpoint first
  try {
    const res = await fetch(getApiUrl(`/api/weather/geocode?query=${encodeURIComponent(trimmed)}`), { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch {}

  // Direct fetch fallback
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        return data.results.map((r: any) => ({
          id: r.id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          admin1: r.admin1,
          country: r.country,
          countryCode: r.country_code,
          timezone: r.timezone,
        }));
      }
    }
  } catch (err) {
    console.warn('[Weather] Geocode search failed:', err);
  }

  return [];
}

/**
 * Fetch full weather dataset (Current, Hourly, 7-Day Daily) by coordinates
 */
export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  customLocationName?: string,
  accuracy?: number
): Promise<WeatherData> {
  const roundedLat = Number(latitude.toFixed(4));
  const roundedLon = Number(longitude.toFixed(4));

  // Determine location name
  let locName = customLocationName;
  let locRegion = '';
  let locCountry = '';
  if (!locName) {
    const rev = await reverseGeocode(roundedLat, roundedLon);
    locName = rev.name;
    locRegion = rev.region || '';
    locCountry = rev.country || '';
  }

  // 1. Fetch from proxy endpoint or direct Open-Meteo
  let apiJson: any = null;

  try {
    const proxyRes = await fetch(getApiUrl(`/api/weather/forecast?lat=${roundedLat}&lon=${roundedLon}`), { signal: AbortSignal.timeout(4000) });
    if (proxyRes.ok) {
      apiJson = await proxyRes.json();
    }
  } catch {}

  if (!apiJson || !apiJson.current) {
    const directUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m` +
      `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=7`;

    const res = await fetch(directUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Weather service returned HTTP ${res.status}`);
    }
    apiJson = await res.json();
  }

  const currentRaw = apiJson.current;
  const hourlyRaw = apiJson.hourly || {};
  const dailyRaw = apiJson.daily || {};

  const currentInterp = interpretWeatherCode(currentRaw.weather_code, Boolean(currentRaw.is_day));

  const current: CurrentWeather = {
    time: currentRaw.time,
    temperature: Math.round(currentRaw.temperature_2m),
    apparentTemperature: Math.round(currentRaw.apparent_temperature),
    relativeHumidity: currentRaw.relative_humidity_2m,
    isDay: Boolean(currentRaw.is_day),
    precipitation: currentRaw.precipitation || 0,
    rain: currentRaw.rain || 0,
    weatherCode: currentRaw.weather_code,
    weatherDescription: currentInterp.description,
    weatherIcon: currentInterp.iconName,
    windSpeed: Math.round(currentRaw.wind_speed_10m),
    windDirection: currentRaw.wind_direction_10m,
    windDirectionCompass: degreesToCompass(currentRaw.wind_direction_10m),
    cloudCover: currentRaw.cloud_cover,
    pressure: Math.round(currentRaw.pressure_msl || 1013),
    uvIndex: dailyRaw.uv_index_max?.[0] ? Math.round(dailyRaw.uv_index_max[0]) : 5,
    visibility: 10,
  };

  // Format next 24 hourly points
  const hourly: HourlyForecastItem[] = [];
  if (Array.isArray(hourlyRaw.time)) {
    const nowIso = new Date().toISOString();
    let startIndex = hourlyRaw.time.findIndex((t: string) => t >= nowIso.slice(0, 13));
    if (startIndex === -1) startIndex = 0;

    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyRaw.time.length); i++) {
      const timeStr = hourlyRaw.time[i];
      const dateObj = new Date(timeStr);
      const hours = dateObj.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formatted = `${hours % 12 || 12} ${ampm}`;

      const code = hourlyRaw.weather_code?.[i] ?? 0;
      const isDayItem = Boolean(hourlyRaw.is_day?.[i] ?? 1);
      const interp = interpretWeatherCode(code, isDayItem);

      hourly.push({
        time: timeStr,
        formattedTime: i === startIndex ? 'Now' : formatted,
        temperature: Math.round(hourlyRaw.temperature_2m?.[i] ?? current.temperature),
        apparentTemperature: Math.round(hourlyRaw.apparent_temperature?.[i] ?? current.apparentTemperature),
        weatherCode: code,
        weatherDescription: interp.description,
        weatherIcon: interp.iconName,
        precipitationProbability: hourlyRaw.precipitation_probability?.[i] ?? 0,
        precipitation: hourlyRaw.precipitation?.[i] ?? 0,
        windSpeed: Math.round(hourlyRaw.wind_speed_10m?.[i] ?? 0),
        relativeHumidity: hourlyRaw.relative_humidity_2m?.[i] ?? 0,
        isDay: isDayItem,
      });
    }
  }

  // Format 7 days daily
  const daily: DailyForecastItem[] = [];
  if (Array.isArray(dailyRaw.time)) {
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < dailyRaw.time.length; i++) {
      const dStr = dailyRaw.time[i];
      const dObj = new Date(dStr + 'T00:00:00');
      const isToday = i === 0;
      const dayName = isToday ? 'Today' : daysMap[dObj.getDay()];

      const code = dailyRaw.weather_code?.[i] ?? 0;
      const interp = interpretWeatherCode(code, true);

      // Format sunrise / sunset
      const sunriseIso = dailyRaw.sunrise?.[i] || '';
      const sunsetIso = dailyRaw.sunset?.[i] || '';
      const sunriseTime = sunriseIso ? new Date(sunriseIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '6:00 AM';
      const sunsetTime = sunsetIso ? new Date(sunsetIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '6:30 PM';

      daily.push({
        date: dStr,
        dayName,
        weatherCode: code,
        weatherDescription: interp.description,
        weatherIcon: interp.iconName,
        tempMax: Math.round(dailyRaw.temperature_2m_max?.[i] ?? current.temperature),
        tempMin: Math.round(dailyRaw.temperature_2m_min?.[i] ?? current.temperature - 5),
        apparentTempMax: Math.round(dailyRaw.apparent_temperature_max?.[i] ?? current.apparentTemperature),
        apparentTempMin: Math.round(dailyRaw.apparent_temperature_min?.[i] ?? current.apparentTemperature - 5),
        precipitationProbabilityMax: dailyRaw.precipitation_probability_max?.[i] ?? 0,
        precipitationSum: dailyRaw.precipitation_sum?.[i] ?? 0,
        windSpeedMax: Math.round(dailyRaw.wind_speed_10m_max?.[i] ?? current.windSpeed),
        uvIndexMax: Math.round(dailyRaw.uv_index_max?.[i] ?? 5),
        sunrise: sunriseTime,
        sunset: sunsetTime,
      });
    }
  }

  const result: WeatherData = {
    coordinates: {
      latitude: roundedLat,
      longitude: roundedLon,
      accuracy,
    },
    locationName: locName,
    region: locRegion,
    country: locCountry,
    timezone: apiJson.timezone || 'auto',
    elevation: apiJson.elevation || 0,
    current,
    hourly,
    daily,
    fetchedAt: new Date().toISOString(),
    source: customLocationName ? 'search' : 'gps',
  };

  // Cache latest weather data in localStorage for offline availability & notify listeners
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(result));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura_weather_updated', { detail: result }));
    }
  } catch {}

  return result;
}

/**
 * Retrieve cached weather data (used for instant loading or offline mode)
 */
export function getCachedWeatherData(): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

