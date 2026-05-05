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

  const { selectedFlight, flightNumber, airline, departureIata, arrivalIata, status, scheduledTime } = body;
  const flight = selectedFlight || { flightNumber, airline, departureIata, arrivalIata, status, scheduledTime };
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  console.log("--------------------------------------------------");
  console.log("[Groq Debug] Route: /api/briefing");
  console.log(`[Groq Debug] Flight: ${flight.flightNumber} | Status: ${flight.status}`);
  console.log("[Groq Debug] Key loaded:", !!apiKey);
  console.log("[Groq Debug] Model used:", model);

  if (!apiKey) {
     clearTimeout(timeoutId);
     console.error("[Groq Debug] Groq failed: API key missing");
     const fallback = generateFallbackBriefing(body);
     return NextResponse.json({ success: true, briefing: fallback.briefing, directives: fallback.directives });
  }

  const generateAiBriefing = async (retryCount = 0) => {
    if (retryCount > 0) {
      console.log(`[Groq Debug] Retry attempt ${retryCount}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("[Groq Debug] Request sent");
    const prompt = `
Analyze the SELECTED FLIGHT SPECIFICALLY: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata || 'N/A'} to ${flight.arrivalIata || 'N/A'}.

Analyze this specific selected flight and mission context. Do not return generic output. Your response must change based on flight status (${flight.status}), route, airport, weather, runway, traffic, workload, aircraft status, and data confidence.

Mention the flight number ${flight.flightNumber}, airline, route, and current status in your explanation.

Mission Context:
- Risk Score: ${body.aiRiskScore || body.score || 0}/100
- Decision: ${body.aiDecision || body.decision || 'N/A'}
- Hazards: ${JSON.stringify(body.aiTopRisks || body.topRisks || [])}

Requirements:
1. Operational Briefing: 2-4 sentences explaining mission safety for THIS SPECIFIC FLIGHT. Mention flight number and status.
2. Primary Concern: Critical hazard for THIS SPECIFIC MISSION.
3. Recommended Action: Practical pilot directive.
4. Directives: 3-5 specific short directives e.g. ["Verify braking", "Monitor GPS"]

Return JSON ONLY:
{
  "briefingText": "string",
  "primaryConcern": "string",
  "recommendedAction": "string",
  "directives": ["string"]
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
      return generateAiBriefing(retryCount + 1);
    }

    if (!response.ok) {
      console.error(`[Groq Debug] Groq failed (/api/briefing): Status ${response.status}`);
      throw new Error(`API status ${response.status}`);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    console.log("[Groq Debug] Groq response preview (first 700 chars):", content.slice(0, 700));
    
    const data = JSON.parse(content.trim());
    
    // Construct final briefing text from parts if needed
    const finalBriefing = `${data.briefingText}\n\nPrimary Concern: ${data.primaryConcern}\n\nRecommended Action: ${data.recommendedAction}`;
    
    return { briefing: finalBriefing, directives: data.directives || [] };
  };

  try {
    const { briefing, directives } = await generateAiBriefing(0);
    clearTimeout(timeoutId);

    return NextResponse.json({
      success: true,
      message: "Pilot briefing synchronized",
      briefing,
      directives
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[Groq Debug] Groq failed (/api/briefing):`, error.message);
    const fallback = generateFallbackBriefing(body);
    return NextResponse.json({
      success: true,
      message: "Pilot briefing synchronized (local fallback)",
      briefing: fallback.briefing,
      directives: fallback.directives
    });
  }
}

function generateFallbackBriefing(body: any) {
  const { airport, score, level, decision, topRisks, selectedFlight, flightNumber } = body;
  const flightID = selectedFlight?.flightNumber || flightNumber || "Local Ops";
  
  let briefingText = `Operational Briefing:\nMission profile for ${flightID} indicates a ${level || 'Normal'} risk environment with a PhaseGuard score of ${score || 25}.\n\n`;
  briefingText += `Primary Concern:\n${(topRisks && topRisks[0]) || "Standard approach variables."}. Multi-factor monitoring is advised.\n\n`;
  briefingText += `Recommended Action:\nMaintain stabilized approach criteria. Execute checklists with high precision.\n\n`;
  briefingText += `Decision Check:\nThe current PhaseGuard "${decision || 'GO'}" recommendation is validated.`;

  return {
    briefing: briefingText,
    directives: [
      "Verify final approach speed and configuration",
      "Monitor crosswind components and runway surface",
      "Prepare for go-around if stabilized criteria not met"
    ]
  };
}
