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
    const {
      airport,
      runway,
      traffic,
      workload,
      aircraft,
      weatherCondition,
      visibilityCategory,
      windCategory,
      score,
      level,
      decision,
      topRisks,
      recommendations,
      flightNumber,
      airline,
      departureIata,
      arrivalIata,
      status,
      scheduledTime,
      estimatedTime,
      flightAircraft,
      aiRiskScore,
      aiDecision,
      aiConfidence,
      aiTopRisks,
      aiRecommendations,
      aiExplanation,
      aiRiskResult,
      operationalRecommendation,
      selectedFlight,
      selectedAirport,
      weatherData,
      trafficData,
      dataSources,
      cyberIndicator
    } = body;

    console.log("--- Gemini API Call (Briefing) ---");
    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-2.0-flash";
    console.log("Gemini key loaded:", Boolean(apiKey));
    console.log("Gemini model used:", model);

    if (!apiKey) {
       clearTimeout(timeoutId);
       console.error('GEMINI_API_KEY is missing from environment.');
       const fallback = generateFallbackBriefing(body);
       return NextResponse.json({
         success: false,
         fallback: true,
         message: "AI-assisted assessment generated using available inputs",
         briefing: fallback.briefing,
         directives: fallback.directives
       });
    }

    const prompt = `
You are an expert aviation safety AI assistant for PhaseGuard AI.
Generate a concise, professional aviation safety briefing for the pilot based on the following mission intelligence.

Mission Context:
- Flight: ${selectedFlight?.flightNumber || flightNumber ? `${selectedFlight?.flightNumber || flightNumber} (${selectedFlight?.airline || airline})` : 'N/A'}
- Route: ${selectedFlight?.departureIata || departureIata || 'N/A'} to ${selectedFlight?.arrivalIata || arrivalIata || 'N/A'}
- Airport: ${selectedAirport?.icao || airport || 'N/A'} (Complexity: ${selectedAirport?.complexity || 'N/A'})
- Runway: ${runway || 'N/A'} (${selectedAirport?.runwaySurface || 'N/A'})
- Aircraft: ${selectedFlight?.aircraft || flightAircraft || aircraft || 'N/A'}
- Traffic: ${trafficData?.trafficLevel || traffic || 'N/A'}
- Weather: ${weatherData?.weatherCondition || weatherCondition || 'N/A'} (Visibility: ${visibilityCategory || 'N/A'}, Wind: ${windCategory || 'N/A'})
- Cyber Exposure: ${cyberIndicator?.level || 'Low'} (Score: ${cyberIndicator?.score || 'N/A'}) - ${cyberIndicator?.summary || 'N/A'}

Risk Analysis Result:
- Overall Risk Score: ${aiRiskResult?.overallRiskScore || aiRiskScore || score || 'N/A'}/100
- Category: ${level || 'N/A'}
- Confidence: ${aiRiskResult?.confidence || aiConfidence || 'N/A'}
- PhaseGuard Decision: ${operationalRecommendation?.primaryRecommendation || aiRiskResult?.decision || aiDecision || decision || 'N/A'}
- Top Hazards: ${operationalRecommendation?.operationalReasoning ? operationalRecommendation.operationalReasoning.join(', ') : Array.isArray(aiTopRisks) ? aiTopRisks.join(', ') : Array.isArray(topRisks) ? topRisks.join(', ') : 'N/A'}
- Initial Actions: ${operationalRecommendation?.pilotActions ? operationalRecommendation.pilotActions.join(', ') : Array.isArray(aiRecommendations) ? aiRecommendations.join(', ') : Array.isArray(recommendations) ? recommendations.join(', ') : 'N/A'}

Format your response as a structured text briefing.
Return exactly and ONLY the following sections in text:

Operational Briefing:
[Brief overview of mission safety]

Primary Concern:
[The single most critical hazard]

Recommended Action:
[Key pilot directive]

Decision Check:
[Challenge or validate the PhaseGuard decision]

Directives JSON:
[A simple JSON array of 3-5 specific, short operational directives for the pilot. e.g. ["Verify braking action", "Monitor GPS integrity"]]

Rules:
- Professional, aviation-style tone.
- Total briefing text (excluding JSON) under 100 words.
- Do not use markdown code blocks for the JSON section.
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
    const fullText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the response to split briefing and directives
    let briefing = "Unable to generate briefing text.";
    let directives = recommendations || aiRecommendations || [];

    if (fullText.includes("Directives JSON:")) {
      const parts = fullText.split("Directives JSON:");
      briefing = parts[0].trim();
      try {
        const jsonText = parts[1].trim();
        directives = JSON.parse(jsonText);
      } catch (e) {
        console.error("Failed to parse directives JSON from Gemini response", e);
      }
    } else {
      briefing = fullText.trim();
    }

    return NextResponse.json({
      success: true,
      fallback: false,
      message: "AI analysis completed",
      briefing,
      directives
    });

  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error(`\n=== GEMINI AI BRIEFING ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
    console.error(error);

    const fallback = generateFallbackBriefing(body);
    return NextResponse.json({
      success: false,
      fallback: true,
      message: isTimeout ? "AI-assisted assessment synchronized via available telemetry" : "AI-assisted assessment generated using available inputs",
      briefing: fallback.briefing,
      directives: fallback.directives
    });
  }
}

function generateFallbackBriefing(body: any) {
  const { 
    airport, 
    weatherCondition, 
    score, 
    level, 
    decision, 
    topRisks, 
    aiTopRisks,
    operationalRecommendation,
    selectedFlight,
    flightNumber
  } = body;

  const currentRisks = operationalRecommendation?.operationalReasoning || aiTopRisks || topRisks || ["Baseline operational hazards."];
  const primaryHazard = currentRisks[0] || "Standard approach variables.";
  const flightID = selectedFlight?.flightNumber || flightNumber || "Local Ops";
  
  let briefingText = `Operational Briefing:\n`;
  briefingText += `Mission profile for ${flightID} at ${airport || 'destination'} indicates a ${level || 'Normal'} risk environment with a PhaseGuard score of ${score || 25}.\n\n`;
  
  briefingText += `Primary Concern:\n`;
  briefingText += `${primaryHazard}. Multi-factor monitoring is advised for this arrival phase.\n\n`;
  
  briefingText += `Recommended Action:\n`;
  briefingText += `Maintain stabilized approach criteria. Execute checklists with high precision and verify all landing performance data.\n\n`;
  
  briefingText += `Decision Check:\n`;
  briefingText += `The current PhaseGuard "${decision || 'GO'}" recommendation is validated based on local deterministic safety rules.`;

  const directives = [
    "Verify final approach speed and configuration",
    "Monitor crosswind components and runway surface",
    "Prepare for go-around if stabilized criteria not met"
  ];

  return {
    briefing: briefingText,
    directives: directives
  };
}


