import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!projectId) {
       return NextResponse.json({ 
         risks: generateFallbackRisks(body)
       }, { status: 200 });
    }

    const vertexAI = new VertexAI({ project: projectId, location: location });
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert aviation risk evaluator for PhaseGuard AI.
You need to generate the top 3 landing hazards for the current scenario.

Data Context:
${JSON.stringify(body, null, 2)}

Requirements:
1. Return exactly 3 risks.
2. Aviation-focused, specific, concise, and actionable.
3. Not generic. Map explicitly to inputs like weather, workload, or aircraft condition.
4. Return ONLY the following JSON structure without markdown formatting blocks:
{
  "risks": [
    "string",
    "string",
    "string"
  ]
}
`;

    const response = await generativeModel.generateContent(prompt);
    let text = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Clean up potential markdown formatting from LLM response
    if (text.startsWith('\`\`\`json')) {
      text = text.substring(7);
      if (text.endsWith('\`\`\`')) {
        text = text.substring(0, text.length - 3);
      }
    } else if (text.startsWith('\`\`\`')) {
      text = text.substring(3);
      if (text.endsWith('\`\`\`')) {
        text = text.substring(0, text.length - 3);
      }
    }
    
    try {
      const data = JSON.parse(text.trim());
      if (Array.isArray(data.risks) && data.risks.length >= 3) {
        return NextResponse.json({ risks: data.risks.slice(0, 3), source: 'GEMINI' });
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response for Top Risks", parseError);
    }

    return NextResponse.json({ risks: generateFallbackRisks(body), source: 'FALLBACK' });

  } catch (error: any) {
    console.error('\n=== VERTEX AI TOP RISKS EVALUATOR ERROR ===');
    console.error(error);
    
    // Attempt dynamic fallback
    try {
      const body = await request.clone().json();
      return NextResponse.json({ risks: generateFallbackRisks(body), source: 'FALLBACK' });
    } catch {
      return NextResponse.json({ 
        risks: [
          "Elevated baseline risk factors during final approach vectors.",
          "Cockpit task saturation requiring focused standard procedures.",
          "Dynamic environment requiring active monitoring."
        ],
        source: 'FALLBACK_HARDCODED'
      });
    }
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

  // Pad to 3 risks
  if (risks.length < 3) {
    risks.push("Elevated baseline operational oversight limits.");
  }
  if (risks.length < 3) {
    risks.push("Cockpit integration metrics tracking continuous telemetry.");
  }
  if (risks.length < 3) {
    risks.push("Active safety vector monitoring.");
  }

  return risks.slice(0, 3);
}
