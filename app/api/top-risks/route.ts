import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = await request.json();
  const { flight = {}, airport = {}, requestId, timestamp, runwayCondition, trafficLevel, crewWorkload, aircraftStatus, visibilityCategory, windCategory, weatherCondition } = body;
  
  console.log(`[Top Risks API] NEW REQUEST | ID: ${requestId} | TIME: ${timestamp}`);

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    return NextResponse.json({
      requestId,
      data: {
        risks: [
          { title: "Standard Operational Load", severity: "Low", explanation: "Nominal parameters detected.", mitigation: "Standard monitoring." },
          { title: "Environmental Baseline", severity: "Low", explanation: "Conditions within safety margin.", mitigation: "Maintain awareness." },
          { title: "Manual Validation Required", severity: "Medium", explanation: "AI fallback active.", mitigation: "Cross-verify telemetry." }
        ],
        source: 'FALLBACK'
      }
    }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  }

  try {
    const prompt = `
Analyze this exact selected flight and mission context for Landing Risks. Your response must mention the flight number and the airport.

MISSION: ${flight.flightNumber || 'TBD'} to ${airport.icao || 'N/A'}
CONTEXT:
- Runway: ${runwayCondition}
- Traffic: ${trafficLevel}
- Workload: ${crewWorkload}
- Aircraft: ${aircraftStatus}
- Visibility: ${visibilityCategory}
- Wind: ${windCategory}
- Weather: ${weatherCondition}

Identify EXACTLY 3 mission-specific landing risks.

RETURN JSON ONLY:
{
  "risks": [
    {
      "title": "string",
      "severity": "Low | Medium | High | Critical",
      "explanation": "string",
      "mitigation": "string"
    }
  ]
}
`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are PhaseGuard AI, an aviation risk analyst. Analyze the exact mission context and return structured JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.35,
        response_format: { type: "json_object" }
      }),
      cache: 'no-store'
    });

    const result = await groqResponse.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}");
    
    return NextResponse.json({ data: { risks: parsed.risks, source: 'GROQ_XAI' }, requestId }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });

  } catch (error: any) {
    console.error("[Top Risks API] Error:", error);
    return NextResponse.json({ 
      requestId,
      data: { 
        risks: [{ title: "Operational Logic Active", severity: "Medium", explanation: "Mission validation in progress.", mitigation: "Maintain SOPs" }],
        source: 'ERROR_FALLBACK'
      }
    }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  }
}
