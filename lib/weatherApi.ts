export interface WeatherProfile {
  rawMetar: string
  stationId: string
  observationTime: string
  windDirection: string | number
  windSpeed: number
  visibility: string | number
  temperature: string | number
  flightCategory: string
  weatherCondition?: string
  source: 'LIVE' | 'FALLBACK'
  errorMessage?: string
}

export const FALLBACK_WEATHER: WeatherProfile = {
  rawMetar: 'KJFK 241851Z 13012G18KT 10SM BKN040 OVC070 18/12 A2985 RMK AO2 SLP108',
  stationId: 'KJFK',
  observationTime: new Date().toISOString(),
  windDirection: 130,
  windSpeed: 12,
  visibility: 10,
  temperature: 18,
  flightCategory: 'VFR',
  weatherCondition: 'Clear',
  source: 'FALLBACK',
}

export async function fetchWeather(icao: string): Promise<WeatherProfile> {
  if (!icao || icao.length < 3) {
    return FALLBACK_WEATHER
  }

  try {
    const response = await fetch(`/api/weather?icao=${icao}`)
    const data = await response.json()
    return data
  } catch (error: any) {
    console.error('Error fetching weather data from local API:', error)
    return { 
      ...FALLBACK_WEATHER, 
      stationId: icao.toUpperCase(), 
      errorMessage: error?.message || 'Failed to reach local weather API' 
    }
  }
}
