import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Compass,
  Wind,
  Droplets,
  Eye,
  Thermometer,
  Gauge,
  Sunrise,
  Sunset,
  Navigation,
  RefreshCw,
  Search,
  MapPin,
  Check,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  Umbrella,
  Heart,
  Footprints,
} from 'lucide-react';
import {
  WeatherData,
  GeoLocationResult,
  Coordinates,
  getCurrentCoordinates,
  fetchWeatherForecast,
  searchLocations,
  getCachedWeatherData,
  interpretWeatherCode,
  celsiusToFahrenheit,
  getUvCategory,
} from '../../services/weatherService';

interface WeatherForecastTabProps {
  onNavigateHome?: () => void;
  onNavigateMap?: () => void;
  onNavigateWellness?: () => void;
}

export const WeatherForecastTab: React.FC<WeatherForecastTabProps> = ({
  onNavigateHome,
  onNavigateMap,
  onNavigateWellness,
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(() => getCachedWeatherData());
  const [isLoading, setIsLoading] = useState<boolean>(!weather);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useFahrenheit, setUseFahrenheit] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aura_weather_temp_unit') === 'F';
    } catch {
      return false;
    }
  });

  // Location search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoLocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Load weather on mount
  useEffect(() => {
    loadLiveGpsWeather();
  }, []);

  const toggleTempUnit = () => {
    const next = !useFahrenheit;
    setUseFahrenheit(next);
    try {
      localStorage.setItem('aura_weather_temp_unit', next ? 'F' : 'C');
    } catch {}
  };

  const formatTemp = (celsius: number) => {
    if (useFahrenheit) {
      return `${celsiusToFahrenheit(celsius)}°F`;
    }
    return `${celsius}°C`;
  };

  const loadLiveGpsWeather = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { coords, source } = await getCurrentCoordinates();
      const data = await fetchWeatherForecast(coords.latitude, coords.longitude, undefined, coords.accuracy);
      data.source = source;
      setWeather(data);
    } catch (err: any) {
      console.error('[WeatherTab] Error fetching weather:', err);
      setErrorMsg(err?.message || 'Unable to load weather forecast for current coordinates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLocation = async (loc: GeoLocationResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const locDisplay = loc.admin1 ? `${loc.name}, ${loc.admin1}` : `${loc.name}, ${loc.country || ''}`;
      const data = await fetchWeatherForecast(loc.latitude, loc.longitude, locDisplay);
      data.country = loc.country;
      data.source = 'search';
      setWeather(data);
    } catch (err: any) {
      setErrorMsg(`Failed to fetch weather for ${loc.name}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search handler
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(val);
        setSearchResults(results);
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Render weather Lucide Icon
  const renderWeatherIcon = (iconName: string, className = 'w-6 h-6') => {
    switch (iconName) {
      case 'Sun':
        return <Sun className={`${className} text-amber-400`} />;
      case 'Moon':
        return <Moon className={`${className} text-indigo-300`} />;
      case 'CloudSun':
        return <CloudSun className={`${className} text-amber-300`} />;
      case 'CloudMoon':
        return <CloudMoon className={`${className} text-indigo-200`} />;
      case 'Cloud':
        return <Cloud className={`${className} text-slate-300`} />;
      case 'CloudFog':
        return <CloudFog className={`${className} text-teal-300`} />;
      case 'CloudDrizzle':
        return <CloudDrizzle className={`${className} text-cyan-300`} />;
      case 'CloudRain':
        return <CloudRain className={`${className} text-blue-400`} />;
      case 'CloudSnow':
        return <CloudSnow className={`${className} text-cyan-100`} />;
      case 'CloudLightning':
        return <CloudLightning className={`${className} text-amber-400 animate-pulse`} />;
      default:
        return <Sun className={`${className} text-amber-400`} />;
    }
  };

  const weatherTheme = weather
    ? interpretWeatherCode(weather.current.weatherCode, weather.current.isDay)
    : {
        description: 'Clear',
        iconName: 'Sun' as const,
        badgeColor: 'text-amber-400 bg-amber-500/20',
        gradientBg: 'from-indigo-950 via-slate-900 to-slate-950',
      };

  const uvInfo = weather ? getUvCategory(weather.current.uvIndex) : { label: 'Moderate', color: 'text-amber-400' };

  return (
    <div className="space-y-4 pb-28 pt-1 max-w-4xl mx-auto px-1 sm:px-2">
      {/* =========================================================================
          TOP LOCATION HEADER & COORDINATES BAR
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-sky-900/40">
            {weather ? (
              renderWeatherIcon(weather.current.weatherIcon, 'w-7 h-7')
            ) : (
              <CloudSun className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {weather?.locationName || 'Detecting Location...'}
              </h2>
              {weather?.source === 'gps' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE GPS
                </span>
              )}
              {weather?.source === 'search' && (
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold border border-sky-500/30">
                  CITY SEARCH
                </span>
              )}
              {weather?.source === 'ip' && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/30">
                  NETWORK IP
                </span>
              )}
            </div>

            {weather?.coordinates && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-sky-400 rotate-45" />
                  {weather.coordinates.latitude.toFixed(4)}°N, {weather.coordinates.longitude.toFixed(4)}°E
                </span>
                {weather.coordinates.accuracy && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                    ±{weather.coordinates.accuracy}m
                  </span>
                )}
                {weather.elevation !== undefined && (
                  <span className="text-[10px] text-slate-500">Elev: {weather.elevation}m</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls: Refresh, Use GPS, Unit Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Unit Switcher */}
          <button
            onClick={toggleTempUnit}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Toggle between Celsius and Fahrenheit"
          >
            {useFahrenheit ? '°F' : '°C'}
          </button>

          {/* Current GPS Trigger */}
          <button
            onClick={loadLiveGpsWeather}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Fetch current coordinates via GPS"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">My GPS</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={loadLiveGpsWeather}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50 shadow-sm active:scale-95"
            title="Refresh latest weather data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          GLOBAL CITY SEARCH BAR
          ========================================================================= */}
      <div className="relative z-20">
        <div className="flex items-center bg-slate-900/90 border border-slate-800 focus-within:border-sky-500/50 rounded-2xl px-3.5 py-2 transition-all shadow-lg">
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchResults(true);
            }}
            placeholder="Search any city or coordinates worldwide (e.g. Coimbatore, London, Tokyo)..."
            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
          />
          {isSearching && <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0 ml-2" />}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-60 overflow-y-auto">
            {searchResults.map((res) => (
              <button
                key={res.id}
                onClick={() => handleSelectLocation(res)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 border-b border-slate-800/50 last:border-none flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white group-hover:text-sky-300 block truncate">
                    {res.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate block">
                    {[res.admin1, res.country].filter(Boolean).join(', ')} • {res.latitude.toFixed(2)}°, {res.longitude.toFixed(2)}°
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-center gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* =========================================================================
          HERO WEATHER CARD (CURRENT CONDITIONS)
          ========================================================================= */}
      {weather && (
        <div
          className={`rounded-3xl bg-gradient-to-br ${weatherTheme.gradientBg} border border-slate-700/60 p-5 sm:p-6 shadow-2xl relative overflow-hidden`}
        >
          {/* Ambient Lighting Blurs */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Temp and Status */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${weatherTheme.badgeColor}`}>
                  {weather.current.weatherDescription}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Feels like {formatTemp(weather.current.apparentTemperature)}
                </span>
              </div>

              <div className="flex items-baseline gap-3 my-1">
                <span className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight font-sans">
                  {formatTemp(weather.current.temperature)}
                </span>
                <div className="flex flex-col text-xs text-slate-300 font-mono">
                  <span>H: {formatTemp(weather.daily[0]?.tempMax ?? weather.current.temperature)}</span>
                  <span className="text-slate-400">L: {formatTemp(weather.daily[0]?.tempMin ?? weather.current.temperature)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 mt-2 flex items-center gap-2 flex-wrap">
                <span>Updated at {new Date(weather.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>•</span>
                <span className="text-sky-300 font-mono">{weather.timezone}</span>
              </p>
            </div>

            {/* Right: Weather Hero Icon Display */}
            <div className="flex items-center justify-center md:justify-end">
              <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-inner flex flex-col items-center gap-2">
                {renderWeatherIcon(weather.current.weatherIcon, 'w-16 h-16 sm:w-20 sm:h-20')}
                <span className="text-xs font-semibold text-slate-200">
                  {weather.current.isDay ? 'Daytime' : 'Nighttime'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6 pt-5 border-t border-slate-800/80 relative z-10">
            {/* Humidity */}
            <div className="bg-slate-950/60 rounded-2xl p-2.5 border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Humidity</span>
                <span className="text-xs font-bold text-white">{weather.current.relativeHumidity}%</span>
              </div>
            </div>

            {/* Wind */}
            <div className="bg-slate-950/60 rounded-2xl p-2.5 border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Wind</span>
                <span className="text-xs font-bold text-white">
                  {weather.current.windSpeed} km/h {weather.current.windDirectionCompass}
                </span>
              </div>
            </div>

            {/* UV Index */}
            <div className="bg-slate-950/60 rounded-2xl p-2.5 border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">UV Index</span>
                <span className="text-xs font-bold text-white">
                  {weather.current.uvIndex}{' '}
                  <span className={`text-[9px] px-1 rounded ${uvInfo.color}`}>{uvInfo.label}</span>
                </span>
              </div>
            </div>

            {/* Rain / Precip */}
            <div className="bg-slate-950/60 rounded-2xl p-2.5 border border-slate-800/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Umbrella className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Precipitation</span>
                <span className="text-xs font-bold text-white">
                  {weather.daily[0]?.precipitationProbabilityMax ?? 0}% ({weather.daily[0]?.precipitationSum ?? 0} mm)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HOURLY FORECAST SLIDER (NEXT 24 HOURS)
          ========================================================================= */}
      {weather && weather.hourly.length > 0 && (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Hourly Forecast</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Next 24 Hours</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
            {weather.hourly.map((h, i) => (
              <div
                key={i}
                className={`flex flex-col items-center justify-between min-w-[70px] p-2.5 rounded-2xl border transition-all shrink-0 ${
                  i === 0
                    ? 'bg-sky-600/20 border-sky-500/40 shadow-md shadow-sky-950'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <span className="text-[11px] font-mono text-slate-300 font-semibold">{h.formattedTime}</span>
                <div className="my-2">{renderWeatherIcon(h.weatherIcon, 'w-6 h-6')}</div>
                <span className="text-xs font-bold text-white font-mono">{formatTemp(h.temperature)}</span>
                {h.precipitationProbability > 0 ? (
                  <span className="text-[10px] text-sky-400 font-bold mt-1 flex items-center gap-0.5">
                    <Droplets className="w-2.5 h-2.5" />
                    {h.precipitationProbability}%
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 font-mono mt-1">0%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          7-DAY EXTENDED FORECAST
          ========================================================================= */}
      {weather && weather.daily.length > 0 && (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">7-Day Forecast</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Daily Outlook</span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {weather.daily.map((d, i) => (
              <div
                key={d.date}
                className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-800/40 rounded-xl transition-colors"
              >
                {/* Day name & date */}
                <div className="w-20 sm:w-24 shrink-0">
                  <span className="text-xs font-bold text-white block">{d.dayName}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Condition & Icon */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="shrink-0">{renderWeatherIcon(d.weatherIcon, 'w-5 h-5')}</div>
                  <div className="min-w-0">
                    <span className="text-xs text-slate-200 block truncate">{d.weatherDescription}</span>
                    {d.precipitationProbabilityMax > 15 && (
                      <span className="text-[10px] text-sky-400 font-semibold flex items-center gap-1">
                        <Droplets className="w-2.5 h-2.5" />
                        {d.precipitationProbabilityMax}% rain
                      </span>
                    )}
                  </div>
                </div>

                {/* Min / Max Temp Bar */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
                    {formatTemp(d.tempMin)}
                  </span>
                  <div className="w-16 sm:w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-400 rounded-full"
                      style={{
                        width: '100%',
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-white w-10 text-left">
                    {formatTemp(d.tempMax)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAILED ENVIRONMENTAL CONDITIONS GRID
          ========================================================================= */}
      {weather && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Sunrise & Sunset */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-4 shadow-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Sun Schedule</span>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sunrise className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Sunrise: {weather.daily[0]?.sunrise || '6:00 AM'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sunset className="w-4 h-4 text-orange-400 shrink-0" />
                <span>Sunset: {weather.daily[0]?.sunset || '6:30 PM'}</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sun className="w-6 h-6" />
            </div>
          </div>

          {/* Pressure & Visibility */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-4 shadow-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Barometer & View</span>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Gauge className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Pressure: {weather.current.pressure} hPa</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Visibility: {weather.current.visibility} km</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Gauge className="w-6 h-6" />
            </div>
          </div>

          {/* Coordinate Precision & Map Navigation */}
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-4 shadow-xl flex items-center justify-between sm:col-span-2 md:col-span-1">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">GPS Coordinates</span>
              <p className="text-xs font-bold text-white font-mono truncate">
                {weather.coordinates.latitude.toFixed(4)}, {weather.coordinates.longitude.toFixed(4)}
              </p>
              {onNavigateMap && (
                <button
                  onClick={onNavigateMap}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer pt-0.5"
                >
                  <span>Open on Google Maps</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
              <Navigation className="w-6 h-6 rotate-45" />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HEALTH & OUTDOOR LIFESTYLE ADVICE
          ========================================================================= */}
      {weather && (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Footprints className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Daily Wellness & Outdoor Advisory</span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30">
                  RECOMMENDED
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {weather.current.temperature > 32
                  ? `High heat (${formatTemp(weather.current.temperature)}). Stay well hydrated and carry cold water.`
                  : weather.daily[0]?.precipitationProbabilityMax > 50
                  ? `Rain expected today (${weather.daily[0]?.precipitationProbabilityMax}%). Carry an umbrella for your commute.`
                  : `Ideal weather for outdoor walking and fitness (${formatTemp(weather.current.temperature)} with light wind).`}
              </p>
            </div>
          </div>

          {onNavigateWellness && (
            <button
              onClick={onNavigateWellness}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Log Walking Steps</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

function ClockIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CalendarIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

