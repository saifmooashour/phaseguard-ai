import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      dataSources
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
       clearTimeout(timeoutId);
       console.error('GEMINI_API_KEY is missing from environment.');
       return NextResponse.json({
         success: false,
         fallback: true,
         message: "AI unavailable, using fallback logic",
         data: {
           briefing: "Operational Briefing:\nPhaseGuard local risk analysis is active. Rule-based caution advised.\n\nPrimary Concern:\nBaseline operational factors.\n\nRecommended Action:\nFollow standard approach procedures.\n\nDecision Check:\nPhaseGuard decision validated by rule engine."
         }
       });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an expert aviation safety AI assistant for PhaseGuard AI.
Given the following flight risk assessment data, generate a short, professional aviation safety briefing for the pilot.

Data:
- Flight: ${selectedFlight?.flightNumber || flightNumber ? `${selectedFlight?.flightNumber || flightNumber} (${selectedFlight?.airline || airline})` : 'N/A'}
- Route: ${selectedFlight?.departureIata || departureIata || 'N/A'} to ${selectedFlight?.arrivalIata || arrivalIata || 'N/A'}
- Status: ${selectedFlight?.status || status || 'N/A'}
- Airport: ${selectedAirport?.icao || airport || 'N/A'}
- Runway: ${runway || 'N/A'}
- Aircraft: ${selectedFlight?.aircraft || flightAircraft || aircraft || 'N/A'}
- Traffic Density: ${trafficData?.trafficLevel || traffic || 'N/A'}
- Crew Workload: ${workload || 'N/A'}
- Weather: ${weatherData?.weatherCondition || weatherCondition || 'N/A'}
- Visibility: ${visibilityCategory || 'N/A'}
- Wind: ${windCategory || 'N/A'}

Risk Analysis:
- Score: ${aiRiskResult?.overallRiskScore || aiRiskScore || score || 'N/A'}/100
- Level: ${level || 'N/A'} (Confidence: ${aiRiskResult?.confidence || aiConfidence || 'N/A'})
- System Decision: ${operationalRecommendation?.primaryRecommendation || aiRiskResult?.decision || aiDecision || decision || 'N/A'}
- Operational Reasoning: ${operationalRecommendation?.operationalReasoning ? operationalRecommendation.operationalReasoning.join(', ') : Array.isArray(aiTopRisks) ? aiTopRisks.join(', ') : Array.isArray(topRisks) ? topRisks.join(', ') : 'N/A'}
- Recommended Pilot Actions: ${operationalRecommendation?.pilotActions ? operationalRecommendation.pilotActions.join(', ') : Array.isArray(aiRecommendations) ? aiRecommendations.join(', ') : Array.isArray(recommendations) ? recommendations.join(', ') : 'N/A'}
- Dispatcher/Ops Notes: ${operationalRecommendation?.dispatcherNotes ? operationalRecommendation.dispatcherNotes.join(', ') : aiRiskResult?.explanation || aiExplanation || 'N/A'}

Return a short structured briefing with exactly this format:

Operational Briefing:
[Text]

Primary Concern:
[Text]

Recommended Action:
[Text]

Decision Check:
[Text]

Rules:
- Maximum 90 words
- Pilot-friendly
- Direct and professional
- No long paragraphs
- Do not repeat every input value
- Confirm or challenge the PhaseGuard decision
- Mention compounding risk if present
- IMPORTANT: If runway, wind, traffic, and workload are favorable but weather is severe, explicitly state: "Operational inputs are otherwise favorable, but live METAR weather is the dominant hazard." Do not imply all factors are risky.
`;

    const result = await model.generateContent(prompt);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), 25000);
    });

    const responseResult: any = await Promise.race([
      result.response,
      timeoutPromise
    ]);

    clearTimeout(timeoutId);

    const text = responseResult.text() || "Unable to generate briefing text.";

    return NextResponse.json({
      success: true,
      fallback: false,
      message: "AI analysis completed",
      data: {
        briefing: text
      }
    });

  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.message === 'TIMEOUT' || error.name === 'AbortError';
    console.error(`\n=== GEMINI AI BRIEFING ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
    console.error(error);

    return NextResponse.json({
      success: false,
      fallback: true,
      message: isTimeout ? "AI request timed out, using fallback logic" : "AI unavailable, using fallback logic",
      data: {
        briefing: "Gemini briefing unavailable. Local risk analysis remains available."
      }
    });
  }
}

