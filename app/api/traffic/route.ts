import { NextResponse } from 'next/server';
import { getAirportByIcao } from '../../../lib/airportData';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get('icao');

  if (!icao || icao.length < 3) {
    return NextResponse.json({ source: "ERROR", message: 'Invalid ICAO code provided.' });
  }

  const profile = getAirportByIcao(icao);
  if (!profile) {
     return NextResponse.json({
        source: "FALLBACK",
        aircraftCount: null,
        trafficLevel: "Low",
        message: "Live airspace telemetry unavailable. Baseline traffic density estimation active."
      });
  }

  const lomin = profile.longitude - 0.5;
  const lomax = profile.longitude + 0.5;
  const lamin = profile.latitude - 0.5;
  const lamax = profile.latitude + 0.5;
  const endpoint = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  
  try {
    const response = await fetch(endpoint, { next: { revalidate: 60 } });
    if (!response.ok) {
       return NextResponse.json({
         source: "FALLBACK",
         aircraftCount: null,
         trafficLevel: "Low",
         message: `Live Airspace API failed with status ${response.status}. Baseline density estimation active.`
       });
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
    });
  } catch (e) {
    return NextResponse.json({
       source: "FALLBACK",
       aircraftCount: null,
       trafficLevel: "Low",
       message: "Failed to reach Live Airspace API. Baseline density estimation active."
    });
  }
}
