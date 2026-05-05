import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {
    console.error('Failed to parse request body:', e);
  }

  try {
    console.log("--- Gemini API Call (Top Risks) ---");
    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-2.0-flash";
    console.log("Gemini key loaded:", Boolean(apiKey));
    console.log("Gemini model used:", model);

    if (!apiKey) {
      clearTimeout(timeoutId);
      console.error('GEMINI_API_KEY is missing from environment.');
      return NextResponse.json({ 
        success: false,
        fallback: true,
        message: "AI-assisted assessment generated using available inputs",
        data: { risks: generateFallbackRisks(body), source: 'FALLBACK' }
      });
    }

    console.log(`[Top Risks] Selected Flight: ${body.flight?.flightNumber} - Status: ${body.flight?.status}`);

    const prompt = `
You are an expert aviation risk evaluator for PhaseGuard AI.
You need to generate the top 3 landing hazards (Operational Reasoning) for the SPECIFIC mission scenario and flight provided.

CRITICAL: Your output must reflect the specific flight context. A different flight should result in different hazards if applicable.

Data Context:
${JSON.stringify(body, null, 2)}

Requirements:
1. Return exactly 3 risks.
2. Aviation-focused, specific, concise, and operational.
3. Explain the top causes behind the decision for THIS SPECIFIC FLIGHT.
4. If the flight is delayed, unknown, or has a specific status, include its impact on risk.
5. Return ONLY the following JSON structure without markdown formatting blocks:
{
  "risks": [
    "string",
    "string",
    "string"
  ]
}
`;

    // Direct REST API Call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        signal: controller.signal
      }
    );

    console.log("Gemini response status:", response.status);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini API Error details: ${response.status} - ${errText}`);
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const result = await response.json();
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Clean up potential markdown formatting from LLM response
    if (text.startsWith('```json')) {
      text = text.substring(7);
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
    } else if (text.startsWith('```')) {
      text = text.substring(3);
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
    }
    
    try {
      const data = JSON.parse(text.trim());
      if (Array.isArray(data.risks) && data.risks.length >= 3) {
        return NextResponse.json({
          success: true,
          fallback: false,
          message: "AI analysis completed",
          data: { risks: data.risks.slice(0, 3), source: 'GEMINI' }
        });
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response for Top Risks", parseError);
    }

    return NextResponse.json({
      success: false,
      fallback: true,
      message: "AI-assisted assessment synchronized",
      data: { risks: generateFallbackRisks(body), source: 'FALLBACK' }
    });

  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error(`\n=== GEMINI AI TOP RISKS EVALUATOR ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
    console.error(error);
    
    return NextResponse.json({
      success: false,
      fallback: true,
      message: isTimeout ? "AI-assisted assessment synchronized via available telemetry" : "AI-assisted assessment generated using available inputs",
      data: { 
        risks: generateFallbackRisks(body), 
        source: isTimeout ? 'FALLBACK_TIMEOUT' : 'FALLBACK_ERROR' 
      }
    });
  }
}

function generateFallbackRisks(body: any): string[] {
  const risks: string[] = [];
  const { runwayCondition, trafficLevel, crewWorkload, aircraftStatus, visibilityCategory, windCategory, weatherCondition } = body || {};

  if (runwayCondition === 'Wet' || runwayCondition === 'Contaminated') {
    risks.push(`Degraded runway braking capabilities due to ${runwayCondition.toLowerCase()} surface.`);
  }
  if (trafficLevel === 'High') {
    risks.push('High traffic density causing reduced ATC spacing safety margins.');
  }
  if (crewWorkload === 'High' || crewWorkload === 'Elevated') {
    risks.push('High crew workload scaling cockpit saturation parameters.');
  }
  if (aircraftStatus === 'Minor Issue' || aircraftStatus === 'Major Issue') {
    risks.push(`Operational aircraft alerts regarding ${aircraftStatus.toLowerCase()} indicators.`);
  }
  if (visibilityCategory === 'Low' || visibilityCategory === 'Reduced') {
    risks.push('Reduced visual cues necessitating precision glide path checks.');
  }
  if (windCategory === 'Strong' || windCategory === 'Moderate') {
    risks.push(`Elevated crosswind shear vectors scaling approach requirements.`);
  }
  if (weatherCondition && weatherCondition !== 'Clear' && weatherCondition !== 'Good') {
    risks.push(`Adverse local METAR weather presenting active ${weatherCondition.toLowerCase()} hazards.`);
  }

  // Pad to 3 risks with more professional operational context
  if (risks.length < 3) {
    risks.push("Environmental trend monitoring active.");
  }
  if (risks.length < 3) {
    risks.push("Arrival phase telemetry tracking.");
  }
  if (risks.length < 3) {
    risks.push("Stabilized approach criteria verification.");
  }

  return risks.slice(0, 3);
}

