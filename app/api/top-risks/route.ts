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
  console.log("[Groq Debug] Route: /api/top-risks");
  console.log("[Groq Debug] Key loaded:", !!apiKey);
  console.log("[Groq Debug] Key preview:", apiKey?.slice(0, 8));
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
Analyze the SELECTED FLIGHT SPECIFICALLY: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata} to ${flight.arrivalIata}.

Analyze this specific selected flight and mission context. Do not return generic output. Your response must change based on flight status, route, airport, weather, runway, traffic, workload, aircraft status, and data confidence.

Requirements:
1. Return exactly 3 landing hazards (Operational Reasoning). 
2. Your output must reflect the specific flight status (${flight.status}).

Data Context:
${JSON.stringify(body, null, 2)}

Return ONLY the following JSON structure:
{
  "risks": ["string", "string", "string"]
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
      return generateAiRisks(retryCount + 1);
    }

    if (!response.ok) {
      console.error(`[Groq Debug] Groq failed (/api/top-risks): Status ${response.status}`);
      throw new Error(`API status ${response.status}`);
    }
    
    const result = await response.json();
    console.log("[Groq Debug] Response received");
    
    const content = result.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content.trim());
  };

  try {
    const data = await generateAiRisks(0);
    clearTimeout(timeoutId);

    return NextResponse.json({
      success: true,
      message: "Priority risks synchronized",
      data: { risks: data.risks.slice(0, 3), source: 'GROQ' }
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[Groq Debug] Groq failed (/api/top-risks):`, error.message);
    return NextResponse.json({
      success: true,
      message: "Priority risks synchronized",
      data: { risks: generateFallbackRisks(body), source: 'SYNC' }
    });
  }
}

function generateFallbackRisks(body: any): string[] {
  const risks: string[] = [];
  const { runwayCondition, trafficLevel, crewWorkload, aircraftStatus, visibilityCategory, windCategory } = body || {};

  if (runwayCondition === 'Wet' || runwayCondition === 'Contaminated') {
    risks.push(`Degraded runway braking capabilities due to ${runwayCondition.toLowerCase()} surface.`);
  }
  if (trafficLevel === 'High') {
    risks.push('High traffic density causing reduced ATC spacing safety margins.');
  }
  if (crewWorkload === 'High' || crewWorkload === 'Elevated') {
    risks.push('High crew workload scaling cockpit saturation parameters.');
  }
  if (aircraftStatus === 'Minor Issue') {
    risks.push(`Operational aircraft alerts regarding systems indicators.`);
  }
  if (visibilityCategory === 'Low') {
    risks.push('Reduced visual cues necessitating precision glide path checks.');
  }

  while (risks.length < 3) {
    risks.push(["Environmental trend monitoring active.", "Arrival phase telemetry tracking.", "Stabilized approach criteria verification."][risks.length]);
  }

  return risks.slice(0, 3);
}
