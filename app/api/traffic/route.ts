import { NextResponse } from 'next/server';
import { getAirportByIcao } from '../../../lib/airportData';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get('icao');

  if (!icao || icao.length < 3) {
    return NextResponse.json({ source: "ERROR", message: 'Invalid ICAO code provided.' });
  }

  const profile = getAirportByIcao(icao);
  if (!profile) {
     return NextResponse.json({
        source: "ERROR",
        message: "Live airspace telemetry unavailable. Airport coordinates missing."
      }, { status: 404 });
  }

  const lomin = profile.longitude - 0.5;
  const lomax = profile.longitude + 0.5;
  const lamin = profile.latitude - 0.5;
  const lamax = profile.latitude + 0.5;
  const endpoint = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  
  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
       return NextResponse.json({
         source: "ERROR",
         message: `Live Airspace API failed with status ${response.status}.`
       }, { status: response.status });
    }

    const data = await response.json();
    const aircraftCount = data.states ? data.states.length : 0;
    
    let trafficLevel = "Low";
    if (aircraftCount > 30) trafficLevel = "High";
    else if (aircraftCount >= 11) trafficLevel = "Medium";

    return NextResponse.json({
       source: "LIVE",
       aircraftCount,
       trafficLevel,
       message: "Live traffic density retrieved successfully."
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (e) {
    return NextResponse.json({
       source: "ERROR",
       message: "Failed to reach Live Airspace API."
    }, { status: 500 });
  }
}
