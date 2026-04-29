import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';

/**
 * POST /api/cyber-briefing
 * Uses Gemini AI to estimate cyber-operational exposure based on mission context.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!projectId) {
       return NextResponse.json({ 
         level: 'Low',
         score: 25,
         summary: 'Cyber-operational exposure estimated using local fallback logic.',
         actions: [
           'Verify communication channels.',
           'Monitor abnormal system alerts.'
         ]
       }, { status: 200 });
    }

    const vertexAI = new VertexAI({ project: projectId, location: location });
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are a cybersecurity expert specializing in aviation operational technology (OT) and digital threat assessments.
Evaluate the "Cyber-Operational Exposure" for the flight crew using the following real-time mission context.

Mission Context:
- Airport: ${JSON.stringify(body.airport || 'Unknown')}
- METAR/Weather: ${JSON.stringify(body.weather || 'Unavailable')}
- Runway Condition: ${JSON.stringify(body.runwayCondition || 'Dry')}
- Traffic Level: ${JSON.stringify(body.trafficLevel || 'Low')}
- Crew Workload: ${JSON.stringify(body.crewWorkload || 'Low')}
- Aircraft Status: ${JSON.stringify(body.aircraftStatus || 'Normal')}
- Current Operational Risk Score: ${JSON.stringify(body.currentRiskScore || 0)}
- Top 3 Landing Risks: ${JSON.stringify(body.top3Risks || [])}

Rules for Evaluation:
1. Cyber-Operational Exposure represents the likelihood and impact of operational disruption via cyber-physical or digital vectors (e.g., GPS spoofing, automated navigation disruptions, degraded telemetry feeds).
2. Complex scenarios (e.g., high traffic, contaminated runways, low visibility, high workload) elevate cyber vulnerability as crews rely more heavily on digital decision support.
3. Determine a level: "Low", "Medium", or "High".
4. Determine a score from 0 to 100.
5. Provide a short, actionable summary (explanation).
6. Provide 2 or 3 recommended cyber-awareness actions for the flight crew.

You MUST return EXACTLY a JSON object. No markdown formatting. No extra words.
Expected JSON Structure:
{
  "level": "Low" | "Medium" | "High",
  "score": number,
  "summary": "string",
  "actions": ["string"]
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
    
    const data = JSON.parse(text.trim());

    const result = {
      level: ['Low', 'Medium', 'High'].includes(data.level) ? data.level : 'Low',
      score: Math.max(0, Math.min(100, Number(data.score) || 25)),
      summary: data.summary || "Cyber-operational exposure analyzed based on current mission parameters.",
      actions: Array.isArray(data.actions) && data.actions.length > 0 ? data.actions : ['Verify communication channels.', 'Monitor abnormal system alerts.']
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Cyber Briefing API Error:', error);
    // Safe fallback logic
    return NextResponse.json({
      level: 'Low',
      score: 25,
      summary: 'Fallback cyber assessment.',
      actions: [
        'Monitor systems',
        'Verify communication'
      ]
    }, { status: 200 });
  }
}
