import { getDb } from '../models/database';

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

export interface WeatherData {
  date: string;
  temperature_high: number;
  temperature_low: number;
  humidity: number;
  precipitation: number;
  weather_code: number;
  weather_description: string;
  uv_index: number;
  pressure: number;
}

export async function fetchWeatherForDate(date: string): Promise<WeatherData | null> {
  const db = getDb();

  // Check cache first
  const cached = db.prepare('SELECT * FROM weather WHERE date = ?').get(date) as any;
  if (cached) {
    return {
      date: cached.date,
      temperature_high: cached.temperature_high,
      temperature_low: cached.temperature_low,
      humidity: cached.humidity,
      precipitation: cached.precipitation,
      weather_code: cached.weather_code,
      weather_description: cached.weather_description,
      uv_index: cached.uv_index,
      pressure: cached.pressure,
    };
  }

  // Get location from settings
  const lat = (db.prepare("SELECT value FROM settings WHERE key = 'latitude'").get() as any)?.value || '40.7128';
  const lon = (db.prepare("SELECT value FROM settings WHERE key = 'longitude'").get() as any)?.value || '-74.0060';
  const tz = (db.prepare("SELECT value FROM settings WHERE key = 'timezone'").get() as any)?.value || 'America/New_York';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=relativehumidity_2m,surface_pressure&timezone=${encodeURIComponent(tz)}&start_date=${date}&end_date=${date}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data: any = await response.json();
    const daily = data.daily;
    const hourly = data.hourly;

    // Average humidity and pressure from hourly data
    const avgHumidity = hourly?.relativehumidity_2m
      ? hourly.relativehumidity_2m.reduce((a: number, b: number) => a + b, 0) / hourly.relativehumidity_2m.length
      : 0;
    const avgPressure = hourly?.surface_pressure
      ? hourly.surface_pressure.reduce((a: number, b: number) => a + b, 0) / hourly.surface_pressure.length
      : 0;

    const weatherCode = daily.weathercode?.[0] ?? 0;
    const weather: WeatherData = {
      date,
      temperature_high: daily.temperature_2m_max?.[0] ?? 0,
      temperature_low: daily.temperature_2m_min?.[0] ?? 0,
      humidity: Math.round(avgHumidity),
      precipitation: daily.precipitation_sum?.[0] ?? 0,
      weather_code: weatherCode,
      weather_description: WEATHER_CODES[weatherCode] || 'Unknown',
      uv_index: daily.uv_index_max?.[0] ?? 0,
      pressure: Math.round(avgPressure),
    };

    // Cache in database
    db.prepare(`
      INSERT OR REPLACE INTO weather (date, temperature_high, temperature_low, humidity, precipitation, weather_code, weather_description, uv_index, pressure, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      weather.date, weather.temperature_high, weather.temperature_low,
      weather.humidity, weather.precipitation, weather.weather_code,
      weather.weather_description, weather.uv_index, weather.pressure,
      JSON.stringify(data)
    );

    return weather;
  } catch (err) {
    console.error('Weather fetch failed:', err);
    return null;
  }
}
