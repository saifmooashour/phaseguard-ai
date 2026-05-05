import { NextResponse } from 'next/server';

// Simple in-memory cache to prevent duplicate processing for same mission
const analysisCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout max

  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {
    console.error('Failed to parse request body:', e);
  }

  const flight = body.flight || {};
  const airport = body.airport || {};
  const manualInputs = body.manualOperationalInputs || {};
  const weather = body.weather || {};
  
  // 5. Disable stale cache / Precise Cache Key
  const cacheKey = `v3_${flight.flightNumber}_${flight.status}_${flight.departureIata}_${flight.arrivalIata || airport.icao}_${weather.weatherCondition}_${manualInputs.runwayCondition}_${manualInputs.workload}_${manualInputs.aircraftCondition}_${body.traffic?.trafficLevel}_${weather.visibility}_${weather.windSpeed}`;
  
  if (analysisCache[cacheKey] && (Date.now() - analysisCache[cacheKey].timestamp < CACHE_TTL)) {
    console.log(`[Groq Debug] Cache hit for ${flight.flightNumber}`);
    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using validated operational inputs (cached)",
      data: analysisCache[cacheKey].data
    });
  }

  // 1. Flight Context Risk Modifiers
  let flightRiskModifier = 0;
  const fStatus = (flight.status || "").toLowerCase();
  if (fStatus === "active" || fStatus === "scheduled" || fStatus === "on-time") {
    flightRiskModifier += 2;
  } else if (fStatus === "delayed") {
    flightRiskModifier += 10;
  } else if (fStatus === "unknown") {
    flightRiskModifier += 15;
  } else if (fStatus === "cancelled") {
    flightRiskModifier += 25;
  } else if (fStatus === "diverted") {
    flightRiskModifier += 30;
  } else if (fStatus === "emergency") {
    flightRiskModifier += 35;
  }

  // 2. Airport Complexity Context
  if (airport.complexity === "High") {
    flightRiskModifier += 10;
  } else if (airport.complexity === "Medium") {
    flightRiskModifier += 5;
  }

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  
  // 7. Visible Debug in console (Backend)
  console.log("--------------------------------------------------");
  console.log("RECEIVED FLIGHT", flight.flightNumber, flight.departureIata, flight.arrivalIata || airport.icao, flight.status);
  console.log("FLIGHT RISK MODIFIER", flightRiskModifier);
  console.log("[Groq Debug] Route: /api/ai-risk-evaluator");
  console.log("[Groq Debug] Manual Overrides:", manualInputs);

  if (!apiKey) {
    clearTimeout(timeoutId);
    console.warn("[Groq Debug] Groq failed: API key missing - using fallback");
    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using local safety engine",
      data: generateFallbackData(body, flightRiskModifier)
    });
  }

  // Deterministic Context Weighting
  let contextWeighting = `PRE-COMPUTED MISSION RISK BASE: ${flightRiskModifier}. `;
  if (fStatus === "delayed") {
    contextWeighting += "FACTOR: CREW FATIGUE / SCHEDULE PRESSURE. ";
  } else if (fStatus === "unknown") {
    contextWeighting += "FACTOR: DATA CONFIDENCE DEGRADED. ";
  }

  const generateAiResponse = async (retryCount = 0): Promise<any> => {
    if (retryCount > 0) {
      console.log(`[Groq Debug] Retry attempt ${retryCount}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const prompt = `
Perform a COMPLETE safety synthesis for SELECTED FLIGHT: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata || 'UNKNOWN'} to ${flight.arrivalIata || airport.icao || 'UNKNOWN'} (Status: ${flight.status}).

Mission Parameters:
- Weather: ${JSON.stringify(weather)}
- Runway: ${manualInputs.runwayCondition || 'Dry'}
- Traffic: ${body.traffic?.trafficLevel || 'Low'}
- Aircraft: ${manualInputs.aircraftCondition || 'Normal'}
- Workload: ${manualInputs.workload || 'Low'}
- Visibility: ${weather.visibility || 'Good'}
- Wind: ${weather.windSpeed || 'Calm'}
- Mission Risk Base: +${flightRiskModifier}
- Context: ${contextWeighting}

STRICT INSTRUCTIONS:
Analyze THIS specific flight. Reference flight ${flight.flightNumber} and route ${flight.departureIata} -> ${flight.arrivalIata || airport.icao} in notes.

Required dispatcher_notes (MUST MENTION ${flight.flightNumber}):
- 2-4 sentences
- Mention route
- Mention final decision
- Mention main risk driver

Return JSON ONLY:
{
  "overallRiskScore": number (0-100, MUST consider base +${flightRiskModifier}),
  "decision": "GO" | "CAUTION" | "NO-GO",
  "confidence": "High" | "Medium" | "Low",
  "factorScores": { "weather": number, "wind": number, "visibility": number, "traffic": number, "runway": number, "airport": number, "flightStatus": number, "manualOperationalInputs": number, "compounding": number },
  "topRisks": ["string"],
  "recommendations": ["string"],
  "explanation": "string",
  "alternative": "string",
  "dispatcherNotes": "string",
  "operationalReasoning": "string",
  "pilotActions": ["string"],
  "cyberIndicator": { "level": "string", "score": number, "summary": "string", "actions": ["string"] },
  "briefing": { "text": "string", "directives": ["string"] }
}
`;

    const response = await fetch(
      `https://api.groq.com/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ 
          model: model,
          messages: [
            {
              role: "system",
              content: "You are PhaseGuard AI. Output mission-specific JSON only. Never use generic templates."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      }
    );

    if (response.status === 429 && retryCount < 1) {
      return generateAiResponse(retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`Groq API Error: ${response.status}`);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    let parsedData = JSON.parse(content.trim());

    // 6. Force dispatcher notes to be flight-specific (Validation)
    const mentionsFlight = parsedData.dispatcherNotes?.includes(flight.flightNumber);
    const mentionsRoute = parsedData.dispatcherNotes?.includes(flight.arrivalIata || airport.icao);

    if (retryCount === 0 && (!mentionsFlight || !mentionsRoute)) {
       console.warn("[Groq Debug] Response generic. Retrying...");
       return generateAiResponse(1);
    }

    return parsedData;
  };

  try {
    const data = await generateAiResponse(0);
    clearTimeout(timeoutId);

    // Final Injection if still generic
    if (!data.dispatcherNotes?.includes(flight.flightNumber)) {
      data.dispatcherNotes = `Analysis for ${flight.flightNumber} (${flight.departureIata} to ${flight.arrivalIata || airport.icao}) finalized. ${data.dispatcherNotes}`;
    }

    // 3. selectedFlight must be included in final analysis object
    data.selectedFlightContext = {
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      origin: flight.departureIata,
      destination: flight.arrivalIata || airport.icao,
      status: flight.status,
      scheduledTime: flight.scheduledTime
    };

    data.source = 'GROQ';
    analysisCache[cacheKey] = { data, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using validated operational inputs",
      data
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[Groq Debug] Groq failed:`, error.message);
    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using local engine (Fallback)",
      data: generateFallbackData(body, flightRiskModifier)
    });
  }
}

function generateFallbackData(body: any, flightModifier: number = 0) {
  const { manualOperationalInputs, weather, traffic, flight, airport } = body || {};
  const runway = manualOperationalInputs?.runwayCondition || 'Dry';
  const workload = manualOperationalInputs?.workload || 'Low';
  const aircraft = manualOperationalInputs?.aircraftCondition || 'Normal';
  const flightNum = flight?.flightNumber || 'MISSION';

  let score = 15 + flightModifier;
  const risks = [];

  if (runway === 'Wet') { score += 15; risks.push("Reduced runway friction (Wet)"); }
  if (runway === 'Contaminated') { score += 30; risks.push("Contaminated runway surface"); }
  if (traffic?.trafficLevel === 'High') { score += 20; risks.push("High density traffic"); }
  if (workload === 'High') { score += 25; risks.push("High task saturation"); }
  if (aircraft === 'Minor Issue') { score += 20; risks.push("Systems redundancy alert"); }
  if (weather?.weatherCondition === 'Storm') { score += 25; risks.push("Convective hazards"); }

  score = Math.min(100, score);
  let decision = score > 75 ? "NO-GO" : (score > 40 ? "CAUTION" : "GO");

  return {
    overallRiskScore: score,
    decision: decision,
    confidence: "High",
    factorScores: { weather: 5, wind: 5, visibility: 5, traffic: 5, runway: 5, airport: 5, flightStatus: flightModifier, manualOperationalInputs: 5, compounding: 0 },
    topRisks: risks.length > 0 ? risks : ["Active mission monitoring"],
    recommendations: ["Maintain stabilized approach criteria."],
    dispatcherNotes: `Flight ${flightNum} from ${flight?.departureIata || 'N/A'} to ${flight?.arrivalIata || airport?.icao || 'N/A'} assessed. Decision: ${decision}. Risk base: ${flightModifier}.`,
    operationalReasoning: `Mission ${flightNum} analysis based on ${risks.length} factors. Final score: ${score}.`,
    pilotActions: ["Verify landing data", "Monitor environmental trends"],
    selectedFlightContext: {
        flightNumber: flight.flightNumber,
        airline: flight.airline,
        origin: flight.departureIata,
        destination: flight.arrivalIata || airport.icao,
        status: flight.status,
        scheduledTime: flight.scheduledTime
    }
  };
}
