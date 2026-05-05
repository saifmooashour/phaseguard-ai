import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let icao = searchParams.get('icao');

  if (!icao || icao.length < 3) {
    return NextResponse.json({ source: 'ERROR', errorMessage: 'Invalid ICAO code provided.' }, { status: 400 });
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
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ source: 'ERROR', errorMessage: `Live API failed with status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return NextResponse.json({ source: 'ERROR', errorMessage: `No METAR data returned for ${icao}` }, { status: 404 });
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
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    return NextResponse.json({ source: 'ERROR', errorMessage: error?.message || 'Unknown network error' }, { status: 500 });
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
