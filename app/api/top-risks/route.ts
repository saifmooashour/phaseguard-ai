import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {
    console.error('Failed to parse request body:', e);
  }

  const flight = body.flight || {};
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  console.log("--------------------------------------------------");
  console.log("[Groq Debug] Route: /api/top-risks");
  console.log(`[Groq Debug] Flight: ${flight.flightNumber} | Status: ${flight.status}`);
  console.log("[Groq Debug] Key loaded:", !!apiKey);
  console.log("[Groq Debug] Model used:", model);

  if (!apiKey) {
    clearTimeout(timeoutId);
    console.error("[Groq Debug] Groq failed: API key missing");
    return NextResponse.json({ 
      success: true,
      message: "Priority risks synchronized",
      data: { risks: generateFallbackRisks(body), source: 'SYNC' }
    });
  }

  const generateAiRisks = async (retryCount = 0) => {
    if (retryCount > 0) {
      console.log(`[Groq Debug] Retry attempt ${retryCount}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("[Groq Debug] Request sent");
    const prompt = `
Analyze the SELECTED FLIGHT SPECIFICALLY: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata || 'N/A'} to ${flight.arrivalIata || 'N/A'}.

Analyze this specific selected flight and mission context. Do not return generic output. Your response must change based on flight status (${flight.status}), route, airport, weather, runway, traffic, workload, aircraft status, and data confidence.

Requirements:
1. Return exactly 3 specific landing hazards (Operational Reasoning) for THIS MISSION.
2. At least one hazard MUST mention the flight number ${flight.flightNumber} or the route.

Data Context:
${JSON.stringify(body, null, 2)}

Return ONLY the following JSON structure:
{
  "risks": ["string", "string", "string"]
}
`;

    console.log("[Groq Debug] Prompt preview (first 700 chars):", prompt.slice(0, 700));

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
              content: "You are PhaseGuard AI, an aviation safety analysis engine. Return accurate, concise, flight-specific structured JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      }
    );

    if (response.status === 429 && retryCount < 1) {
      return generateAiRisks(retryCount + 1);
    }

    if (!response.ok) {
      console.error(`[Groq Debug] Groq failed (/api/top-risks): Status ${response.status}`);
      throw new Error(`API status ${response.status}`);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    console.log("[Groq Debug] Groq response preview (first 700 chars):", content.slice(0, 700));
    
    return JSON.parse(content.trim());
  };

  try {
    const data = await generateAiRisks(0);
    clearTimeout(timeoutId);

    // Validation
    const risks = Array.isArray(data.risks) ? data.risks : generateFallbackRisks(body);

    return NextResponse.json({
      success: true,
      message: "Priority risks synchronized",
      data: { risks: risks.slice(0, 3), source: 'GROQ' }
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[Groq Debug] Groq failed (/api/top-risks):`, error.message);
    return NextResponse.json({
      success: true,
      message: "Priority risks synchronized (local fallback)",
      data: { risks: generateFallbackRisks(body), source: 'SYNC' }
    });
  }
}

function generateFallbackRisks(body: any): string[] {
  const risks: string[] = [];
  const { runwayCondition, trafficLevel, crewWorkload, aircraftStatus, visibilityCategory, windCategory, flight } = body || {};
  const flightNum = flight?.flightNumber || 'Mission';

  if (runwayCondition === 'Wet' || runwayCondition === 'Contaminated') {
    risks.push(`Reduced braking action on ${runwayCondition.toLowerCase()} surface for ${flightNum}.`);
  }
  if (trafficLevel === 'High') {
    risks.push(`High traffic density at destination affecting ${flightNum} arrival.`);
  }
  if (crewWorkload === 'High' || crewWorkload === 'Elevated') {
    risks.push(`Elevated mission workload increasing task saturation for crew.`);
  }
  if (aircraftStatus === 'Minor Issue') {
    risks.push(`Systems status check required for ${flightNum} indicators.`);
  }
  if (visibilityCategory === 'Low') {
    risks.push(`Limited visual cues for ${flightNum} approach phase.`);
  }

  const defaults = [
    `Monitor ${flightNum} arrival telemetry.`,
    "Verify stabilized approach criteria.",
    "Cross-check landing performance data."
  ];

  while (risks.length < 3) {
    const d = defaults.find(r => !risks.includes(r));
    if (d) risks.push(d);
    else risks.push("Active safety monitoring.");
  }

  return risks.slice(0, 3);
}
