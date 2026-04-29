import { NextResponse } from 'next/server';

export const FALLBACK_WEATHER = {
  rawMetar: 'KJFK 241851Z 13012G18KT 10SM BKN040 OVC070 18/12 A2985 RMK AO2 SLP108',
  windDirection: 130,
  windSpeed: 12,
  visibility: 10,
  temperature: 18,
  flightCategory: 'VFR',
  weatherCondition: 'Clear',
  source: 'FALLBACK'
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let icao = searchParams.get('icao');

  if (!icao || icao.length < 3) {
    return NextResponse.json({ ...FALLBACK_WEATHER, errorMessage: 'Invalid ICAO code provided.' });
  }

  icao = icao.toUpperCase();
  const endpoint = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PhaseGuardAI/1.0',
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json({ ...FALLBACK_WEATHER, errorMessage: `Live API failed with status ${response.status}` });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ ...FALLBACK_WEATHER, errorMessage: `No METAR data returned for ${icao}` });
    }

    const metar = data[0];

    return NextResponse.json({
      rawMetar: metar.rawOb || 'No raw METAR available',
      windDirection: metar.wdir !== undefined ? metar.wdir : 'VRB',
      windSpeed: metar.wspd !== undefined ? metar.wspd : 0,
      visibility: metar.visib !== undefined ? metar.visib : 10,
      temperature: metar.temp !== undefined ? metar.temp : 15,
      flightCategory: metar.fltcat || metar.fltCat || 'VFR',
      weatherCondition: determineWeatherCondition(metar),
      source: 'LIVE',
    });

  } catch (error: any) {
    return NextResponse.json({ ...FALLBACK_WEATHER, errorMessage: error?.message || 'Unknown network error' });
  }
}

function determineWeatherCondition(metar: any): string {
  const raw = (metar.rawOb || '').toUpperCase();
  if (raw.includes('TS') || raw.includes('CB')) return 'Storm';
  if (raw.includes('SN')) return 'Snow';
  if (raw.includes('RA') || raw.includes('SH')) return 'Rain';
  if (raw.includes('FG') || raw.includes('BR') || raw.includes('HZ')) return 'Fog';
  return 'Clear';
}
