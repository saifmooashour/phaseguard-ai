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
  source: 'LIVE' | 'FALLBACK' | 'ERROR'
  errorMessage?: string
}

export async function fetchWeather(icao: string): Promise<WeatherProfile> {
  if (!icao || icao.length < 3) {
    return {
      rawMetar: '', stationId: '', observationTime: '', windDirection: 0, windSpeed: 0, visibility: 0, temperature: 0, flightCategory: '',
      source: 'ERROR', errorMessage: 'Invalid ICAO provided.'
    }
  }

  try {
    const response = await fetch(`/api/weather?icao=${icao}`)
    const data = await response.json()
    return data
  } catch (error: any) {
    console.error('Error fetching weather data from local API:', error)
    return {
      rawMetar: '', stationId: icao.toUpperCase(), observationTime: '', windDirection: 0, windSpeed: 0, visibility: 0, temperature: 0, flightCategory: '',
      source: 'ERROR',
      errorMessage: error?.message || 'Failed to reach local weather API' 
    }
  }
}
