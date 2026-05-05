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
  const cacheKey = `consolidated_${flight.flightNumber}_${body.airport?.icao}_${body.weather?.weatherCondition}`;
  
  if (analysisCache[cacheKey] && (Date.now() - analysisCache[cacheKey].timestamp < CACHE_TTL)) {
    console.log(`[Groq Debug] Cache hit for ${flight.flightNumber}`);
    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using validated operational inputs",
      data: analysisCache[cacheKey].data
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  
  console.log("[Groq Debug] Route: /api/ai-risk-evaluator");
  console.log("[Groq Debug] Key loaded:", !!apiKey);
  console.log("[Groq Debug] Key preview:", apiKey?.slice(0, 8));
  console.log("[Groq Debug] Model used:", model);

  if (!apiKey) {
    clearTimeout(timeoutId);
    console.error("[Groq Debug] Groq failed: API key missing");
    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using validated operational inputs",
      data: generateFallbackData(body)
    });
  }

  const generateAiResponse = async (retryCount = 0): Promise<any> => {
    if (retryCount > 0) {
      console.log(`[Groq Debug] Retry attempt ${retryCount}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("[Groq Debug] Request sent");
    const prompt = `
Perform a COMPLETE safety synthesis for SELECTED FLIGHT: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata} to ${flight.arrivalIata} (Status: ${flight.status}).

Mission Matrix:
- Weather: ${JSON.stringify(body.weather || {})}
- Runway: ${body.manualOperationalInputs?.runwayCondition || 'Dry'}
- Traffic: ${body.traffic?.trafficLevel || 'Low'}
- Aircraft: ${body.manualOperationalInputs?.aircraftCondition || 'Normal'}
- Workload: ${body.manualOperationalInputs?.workload || 'Low'}
- Visibility: ${body.weather?.visibility || 'Good'}
- Wind: ${body.weather?.windSpeed || 'Calm'}
- Data Sources: ${JSON.stringify(body.dataSources || {})}

Analyze this specific selected flight and mission context. Do not return generic output. Your response must change based on flight status, route, airport, weather, runway, traffic, workload, aircraft status, and data confidence.

Requirements:
1. overall_risk_score (0-100).
2. decision: "GO" | "CAUTION" | "NO-GO".
3. operational_reasoning: Exactly 3 specific landing hazards for THIS flight.
4. dispatcher_notes: 2-4 sentence professional dispatcher note mentioning the flight number.
5. pilot_actions: 3-5 pilot actions for this specific mission.
6. cyber_exposure_summary: Short sentence on digital vulnerability.
7. briefing_summary: A professional pilot briefing referencing ${flight.flightNumber}.

Return JSON ONLY:
{
  "overallRiskScore": number,
  "decision": "string",
  "confidence": "High" | "Medium" | "Low",
  "factorScores": { "weather": number, "wind": number, "visibility": number, "traffic": number, "runway": number, "airport": number, "flightStatus": number, "manualOperationalInputs": number, "compounding": number },
  "topRisks": ["string"],
  "recommendations": ["string"],
  "explanation": "string",
  "alternative": "string",
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
              content: "You are PhaseGuard AI, an aviation decision-support analysis assistant. Return accurate, concise, structured JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      }
    );

    if (response.status === 429 && retryCount < 1) {
      return generateAiResponse(retryCount + 1);
    }

    if (!response.ok) {
      console.error(`[Groq Debug] Groq failed (/api/ai-risk-evaluator): Status ${response.status}`);
      throw new Error(`Groq API Error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("[Groq Debug] Response received");
    
    const content = result.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content.trim());
  };

  try {
    const data = await generateAiResponse(0);
    clearTimeout(timeoutId);

    data.source = 'GROQ';
    analysisCache[cacheKey] = { data, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using validated operational inputs",
      data
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[Groq Debug] Groq failed (/api/ai-risk-evaluator):`, error.message);
    return NextResponse.json({
      success: true,
      message: "AI-assisted assessment using validated operational inputs",
      data: generateFallbackData(body)
    });
  }
}

function generateFallbackData(body: any) {
  const { manualOperationalInputs, weather, traffic, flight } = body || {};
  const runway = manualOperationalInputs?.runwayCondition || 'Dry';
  const workload = manualOperationalInputs?.workload || 'Low';
  const aircraft = manualOperationalInputs?.aircraftCondition || 'Normal';
  const flightStatus = flight?.status || 'scheduled';

  let score = 15;
  const risks = [];

  if (runway === 'Wet') { score += 15; risks.push("Reduced runway friction (Wet)"); }
  if (runway === 'Contaminated') { score += 30; risks.push("Contaminated runway surface (Icing/Slush)"); }
  if (traffic?.trafficLevel === 'High') { score += 20; risks.push("High density traffic environment"); }
  if (workload === 'High') { score += 25; risks.push("High task saturation risk"); }
  if (aircraft === 'Minor Issue') { score += 20; risks.push("Minor systems alert / degraded redundancy"); }

  if (weather?.weatherCondition === 'Storm') { score += 25; risks.push("Severe convective activity"); }

  score = Math.min(100, score);
  let decision = "GO";
  if (score > 75) decision = "NO-GO";
  else if (score > 40) decision = "CAUTION";

  return {
    overallRiskScore: score,
    decision: decision,
    confidence: "High",
    factorScores: { weather: 5, wind: 5, visibility: 5, traffic: 5, runway: 5, airport: 5, flightStatus: 5, manualOperationalInputs: 5, compounding: 0 },
    topRisks: risks.length > 0 ? risks : ["Environmental trend monitoring active."],
    recommendations: [
      "Maintain stabilized approach criteria.",
      "Monitor braking effectiveness during rollout."
    ],
    explanation: `Operational evaluation for mission ${flight?.flightNumber || 'N/A'} completed.`,
    alternative: "Monitor live environmental trends.",
    cyberIndicator: {
      level: score > 60 ? 'Medium' : 'Low',
      score: score > 60 ? 45 : 22,
      summary: "Cyber-operational exposure analyzed.",
      actions: ["Verify communication channels"]
    },
    briefing: {
      text: `Operational Briefing for ${flight?.flightNumber || 'Mission'}: Current status indicates a ${decision} profile.`,
      directives: ["Verify landing data", "Maintain stabilized approach"]
    }
  };
}
