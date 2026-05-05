import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = await request.json();
  const { flight = {}, airport = {}, requestId, timestamp, aiRiskScore, aiDecision, aiTopRisks, factors = {} } = body;
  
  console.log(`[Briefing API] NEW REQUEST | ID: ${requestId} | TIME: ${timestamp}`);

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    return NextResponse.json({
      requestId,
      briefing: `- Flight ${flight.flightNumber || 'TBD'} from ${flight.departureIata || 'N/A'} to ${flight.arrivalIata || airport.icao || 'N/A'} is assessed as ${aiDecision} with a risk score of ${aiRiskScore}\n- Primary risk drivers: ${factors.weather || 'Weather'} and ${factors.traffic || 'Traffic'}\n- Operational impact: Standard safety margin compression\n- Pilot action: Verify local environmental data\n- Monitoring: Continuous telemetry check\n- Final guidance: Proceed with high situational awareness`,
      directives: ["Verify landing data", "Monitor METAR trends"],
      _fallback: true
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
You are a senior aviation safety analyst generating a pilot-ready operational briefing.

STRICT RULES:
- Output MUST be bullet points only (5–7 bullets).
- Each bullet must be short, clear, and actionable.
- NO paragraphs.
- NO generic language.
- MUST be specific to this flight.
- MUST reference real inputs.

======================================================
FLIGHT CONTEXT
======================================================
Flight Number: ${flight.flightNumber || 'TBD'}
Route: ${flight.departureIata || 'N/A'} → ${flight.arrivalIata || airport.icao || 'N/A'}
Status: ${factors.flightStatus || 'Active'}

======================================================
RISK ENGINE OUTPUT (GROUND TRUTH)
======================================================
Final Risk Score: ${aiRiskScore}
Decision: ${aiDecision}

======================================================
FACTOR BREAKDOWN
======================================================
Weather: ${factors.weather || 'Unknown'}
Traffic: ${factors.traffic || 'Unknown'}
Runway: ${factors.runway || 'Unknown'}
Workload: ${factors.workload || 'Unknown'}
Aircraft: ${factors.aircraft || 'Unknown'}
Visibility: ${factors.visibility || 'Unknown'}
Wind: ${factors.wind || 'Unknown'}
Flight Status Impact: ${factors.flightStatus || 'Unknown'}

======================================================
TOP RISKS
======================================================
${JSON.stringify(aiTopRisks)}

======================================================
TASK
======================================================

Generate a pilot briefing in bullet points that includes:
1. Overall situation (flight + route + decision)
2. Main risk drivers (top 2–3 factors ONLY)
3. Operational impact (what could go wrong)
4. Immediate pilot actions
5. Monitoring priorities
6. Final instruction (GO / CAUTION / NO-GO behavior)

======================================================
FORMAT (STRICT)
======================================================

- Flight ${flight.flightNumber || 'TBD'} from ${flight.departureIata || 'N/A'} to ${flight.arrivalIata || airport.icao || 'N/A'} is assessed as ${aiDecision} with a risk score of ${aiRiskScore}
- Primary risk drivers: [factor 1] and [factor 2]
- Operational impact: [what risk affects]
- Pilot action: [clear instruction]
- Monitoring: [what to watch]
- Final guidance: [clear cockpit instruction]

======================================================
IMPORTANT
======================================================

- DO NOT output explanations.
- DO NOT repeat data.
- DO NOT say "based on the data".
- DO NOT be generic.
- MUST feel like a real cockpit briefing.

RETURN JSON ONLY with keys: "briefing" (string with \n separated bullets) and "directives" (array of strings).
`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a senior aviation safety analyst. Return structured JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.25,
        response_format: { type: "json_object" }
      }),
      cache: 'no-store'
    });

    const result = await groqResponse.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}");
    
    return NextResponse.json({ ...parsed, requestId }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });

  } catch (error: any) {
    console.error("[Briefing API] Error:", error);
    const flightNum = flight?.flightNumber || "Mission";
    return NextResponse.json({ 
      requestId,
      briefing: [
        `• Flight ${flightNum} — Decision: ${aiDecision || "GO"}`,
        `• Primary risk: Terminal environment monitoring`,
        `• Secondary risk: Tactical telemetry awareness`,
        `• Impact: Maintain awareness of operational margins`,
        `• Action: Adhere to stabilized approach criteria`,
        `• Monitor: Continuous runway and weather updates`,
        `• Guidance: Proceed with standard caution protocols`
      ].join('\n'), 
      directives: ["Verify landing data", "Monitor METAR trends"] 
    }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  }
}
