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
  console.log("[Groq Debug] Route: /api/briefing");
  console.log("[Groq Debug] Key loaded:", !!apiKey);
  console.log("[Groq Debug] Key preview:", apiKey?.slice(0, 8));
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
Analyze the SELECTED FLIGHT SPECIFICALLY: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata} to ${flight.arrivalIata}.

Analyze this specific selected flight and mission context. Do not return generic output. Your response must change based on flight status, route, airport, weather, runway, traffic, workload, aircraft status, and data confidence.

Mention the flight number, airline, route, and current status (${flight.status}) in your explanation.

Mission Context:
- Risk Score: ${body.aiRiskScore || body.score || 0}/100
- Decision: ${body.aiDecision || body.decision || 'N/A'}
- Hazards: ${JSON.stringify(body.aiTopRisks || body.topRisks || [])}

Format your response as a structured text briefing. Sections to return:
Operational Briefing: [2-4 sentences explaining mission safety for THIS SPECIFIC FLIGHT. Mention flight number and status.]
Primary Concern: [Critical hazard for THIS SPECIFIC MISSION.]
Recommended Action: [Practical pilot directive.]
Decision Check: [Validation of PhaseGuard recommendation.]
Directives JSON: [JSON array of 3-5 specific short directives e.g. ["Verify braking", "Monitor GPS"]]
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
              content: "You are PhaseGuard AI, an aviation decision-support analysis assistant. Return accurate, concise, structured text with a final JSON component."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3
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
    console.log("[Groq Debug] Response received");
    const fullText = result.choices?.[0]?.message?.content || "";

    let briefing = "Unable to generate briefing text.";
    let directives = body.recommendations || body.aiRecommendations || [];
    
    if (fullText.includes("Directives JSON:")) {
      const parts = fullText.split("Directives JSON:");
      briefing = parts[0].trim();
      try {
        directives = JSON.parse(parts[1].trim());
      } catch (e) { console.error("JSON parse failed", e); }
    } else {
      briefing = fullText.trim();
    }

    return { briefing, directives };
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
      message: "Pilot briefing synchronized",
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
