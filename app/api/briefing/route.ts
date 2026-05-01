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

    console.log("Gemini key loaded:", Boolean(process.env.GEMINI_API_KEY));
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
       clearTimeout(timeoutId);
       console.error('GEMINI_API_KEY is missing from environment.');
       return NextResponse.json({
         success: false,
         fallback: true,
         message: "GEMINI_API_KEY is missing from environment",
         briefing: "Operational Briefing:\nPhaseGuard local risk analysis is active. Rule-based caution advised.\n\nPrimary Concern:\nBaseline operational factors.\n\nRecommended Action:\nFollow standard approach procedures.\n\nDecision Check:\nPhaseGuard decision validated by rule engine.",
         directives: recommendations || aiRecommendations || ["Maintain standard operational awareness.", "Verify all digital telemetry."]
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
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

    return NextResponse.json({
      success: false,
      fallback: true,
      message: isTimeout ? "AI request timed out, using fallback logic" : "AI unavailable, using fallback logic",
      briefing: "Gemini briefing unavailable. Local risk analysis remains available.",
      directives: body.recommendations || body.aiRecommendations || ["Maintain standard operational awareness.", "Verify all digital telemetry."]
    });
  }
}


