import type {Infer} from 'alinea'
import {unstable_cacheLife as cacheLife} from 'next/cache'
import type {WeatherBlock} from './WeatherBlock.schema'

type WeatherBlockData = Infer.ListItem<typeof WeatherBlock>

type GeocodingResponse = {
  results?: Array<{
    name: string
    country?: string
    latitude: number
    longitude: number
  }>
}

type ForecastResponse = {
  current?: {
    temperature_2m?: number
    weather_code?: number
  }
  current_units?: {
    temperature_2m?: string
  }
}

const weatherCodeLabels: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm'
}

async function getCurrentWeather(region: string) {
  'use cache'
  cacheLife({stale: 900, revalidate: 900, expire: 900})

  const geocoding = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(region)}&count=1`
  )
  if (!geocoding.ok) return null

  const geocodingData = (await geocoding.json()) as GeocodingResponse
  const result = geocodingData.results?.[0]
  if (!result) return null

  const forecast = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,weather_code&timezone=auto`
  )
  if (!forecast.ok) return null

  const forecastData = (await forecast.json()) as ForecastResponse
  if (!forecastData.current) return null

  return {
    location: result.country
      ? `${result.name}, ${result.country}`
      : result.name,
    temperature: forecastData.current.temperature_2m,
    unit: forecastData.current_units?.temperature_2m ?? '°C',
    summary:
      weatherCodeLabels[forecastData.current.weather_code ?? -1] ??
      'Current weather'
  }
}

export async function WeatherBlockView({block}: {block: WeatherBlockData}) {
  const weather = await getCurrentWeather(block.region)

  return (
    <section>
      <h2>{block.title}</h2>
      {!weather ? (
        <p>Could not load weather for {block.region}.</p>
      ) : (
        <p>
          {weather.location}: {weather.temperature}
          {weather.unit} ({weather.summary})
        </p>
      )}
    </section>
  )
}
