import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    console.log('Initializing Google Cloud Vertex AI:');
    console.log('- Project ID:', projectId);
    console.log('- Location:', location);
    console.log('- Model:', 'gemini-2.5-flash');

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

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

    const response = await generativeModel.generateContent(prompt);
    
    // Safely extract the generated text
    const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate briefing text.";

    return NextResponse.json({
      briefing: text
    });

  } catch (error: any) {
    console.error('\n=== VERTEX AI ERROR ===');
    console.error('Message:', error?.message || error);
    if (error?.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('========================\n');

    return NextResponse.json({
      briefing: "Gemini briefing unavailable. Local risk analysis remains available."
    }, { status: 200 });
  }
}
