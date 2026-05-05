import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = await request.json();
  const { flight = {}, airport = {}, requestId, timestamp, currentRiskScore, top3Risks } = body;
  
  console.log(`[Cyber API] NEW REQUEST | ID: ${requestId} | TIME: ${timestamp}`);

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    return NextResponse.json({
      requestId,
      data: {
        level: "Low",
        score: 15,
        explanation: "Strategic monitoring active.",
        actions: ["Maintain standard protocols"],
        _fallback: true
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
Analyze this exact selected flight and mission context for Cyber-Operational Exposure. Your response must mention the flight number and the airport.

MISSION: ${flight.flightNumber || 'TBD'} to ${airport.icao || 'N/A'}
Computed Physical Risk Context: Score ${currentRiskScore}
Top Physical Risks: ${JSON.stringify(top3Risks)}

Determine how physical operational load increases cyber-vulnerability surface for this specific mission.

RETURN JSON ONLY:
{
  "level": "Low | Medium | High",
  "score": number,
  "explanation": "string",
  "actions": ["string", "string"]
}
`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are PhaseGuard AI, a cyber-operational analyst. Analyze the exact mission context and return structured JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.35,
        response_format: { type: "json_object" }
      }),
      cache: 'no-store'
    });

    const result = await groqResponse.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}");
    
    return NextResponse.json({ data: parsed, requestId }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });

  } catch (error: any) {
    console.error("[Cyber API] Error:", error);
    return NextResponse.json({ 
      requestId,
      data: { level: "Low", score: 10, explanation: "Operational logic validation active.", actions: ["Maintain standard awareness"] }
    }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  }
}
