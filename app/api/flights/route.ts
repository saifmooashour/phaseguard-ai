import { NextResponse } from 'next/server';

interface CacheEntry {
  timestamp: number;
  data: any;
}

const flightCache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get('icao');
  const type = searchParams.get('type') || 'arrivals'; 

  if (!icao || icao.length < 3) {
    return NextResponse.json({ source: "ERROR", flights: [], message: 'Invalid ICAO code provided.' });
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  console.log("Aviationstack key present:", Boolean(apiKey));

  if (!apiKey) {
    console.log(`[Flights API] Aviationstack key missing. ICAO: ${icao}, Type: ${type}`);
    const demoFlights = [
      {
        id: 'DEMO1',
        flightNumber: 'PG101',
        airline: 'Phase Air',
        departureIata: 'LHR',
        arrivalIata: icao.toUpperCase(),
        departureAirport: 'London Heathrow',
        arrivalAirport: 'Destination',
        status: 'scheduled',
        scheduledTime: new Date().toISOString(),
        estimatedTime: new Date().toISOString(),
        aircraft: 'Airbus A320'
      },
      {
        id: 'DEMO2',
        flightNumber: 'PG202',
        airline: 'Guard Airways',
        departureIata: 'DXB',
        arrivalIata: icao.toUpperCase(),
        departureAirport: 'Dubai International',
        arrivalAirport: 'Destination',
        status: 'delayed',
        scheduledTime: new Date(Date.now() - 3600000).toISOString(),
        estimatedTime: new Date(Date.now() + 1800000).toISOString(),
        aircraft: 'Boeing 737'
      },
      {
        id: 'DEMO3',
        flightNumber: 'PG303',
        airline: 'Safe Sky',
        departureIata: 'JFK',
        arrivalIata: icao.toUpperCase(),
        departureAirport: 'John F. Kennedy',
        arrivalAirport: 'Destination',
        status: 'unknown',
        scheduledTime: new Date(Date.now() - 7200000).toISOString(),
        estimatedTime: new Date(Date.now() - 3600000).toISOString(),
        aircraft: 'Boeing 777'
      }
    ];
    return NextResponse.json({
      source: "DEMO_MODE",
      flights: demoFlights,
      message: "Using meaningfully varied demo flights (Live API not connected)."
    });
  }

  const cacheKey = `${icao.toUpperCase()}_${type.toLowerCase()}`;
  const now = Date.now();

  if (flightCache[cacheKey] && now - flightCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log(`[Flights API] CACHE HIT | ICAO: ${icao} | Type: ${type} | Flights: ${flightCache[cacheKey].data.length}`);
    return NextResponse.json({
      source: "CACHE",
      flights: flightCache[cacheKey].data,
      message: "Flight schedules retrieved from cache."
    });
  }

  try {
    const directionParam = type === 'departures' ? 'dep_icao' : 'arr_icao';
    const endpoint = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&${directionParam}=${icao.toUpperCase()}&limit=20`;
    
    console.log(`[Flights API] Requesting live data | ICAO: ${icao} | Type: ${type}`);
    
    const response = await fetch(endpoint);
    
    console.log(`[Flights API] Provider status: ${response.status}`);
    
    if (!response.ok) {
      return NextResponse.json({ source: "FALLBACK", flights: [], message: `Aviationstack API failed with status ${response.status}` });
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log(`[Flights API] Invalid response format`);
      return NextResponse.json({ source: "FALLBACK", flights: [], message: "Invalid data format from Aviationstack." });
    }

    const normalizedFlights = data.data.map((flight: any) => ({
      id: flight.flight?.iata || flight.flight?.icao || Math.random().toString(36).substring(7),
      flightNumber: flight.flight?.iata || flight.flight?.icao || 'Unknown',
      airline: flight.airline?.name || 'Unknown Airline',
      departureIata: flight.departure?.iata || 'N/A',
      arrivalIata: flight.arrival?.iata || 'N/A',
      departureAirport: flight.departure?.airport || 'Unknown',
      arrivalAirport: flight.arrival?.airport || 'Unknown',
      status: flight.flight_status || 'scheduled',
      scheduledTime: flight.arrival?.scheduled || flight.departure?.scheduled || new Date().toISOString(),
      estimatedTime: flight.arrival?.estimated || flight.departure?.estimated || new Date().toISOString(),
      aircraft: flight.aircraft?.iata || 'Normal'
    }));

    flightCache[cacheKey] = {
      timestamp: now,
      data: normalizedFlights
    };

    console.log(`[Flights API] LIVE SUCCESS | ICAO: ${icao} | Type: ${type} | Flights: ${normalizedFlights.length}`);

    return NextResponse.json({
      source: "LIVE",
      flights: normalizedFlights,
      message: "Live flight schedules retrieved."
    });

  } catch (error: any) {
    console.error(`[Flights API] Error | ICAO: ${icao}`, error?.message);
    return NextResponse.json({ source: "FALLBACK", flights: [], message: error?.message || 'Network error' });
  }
}
