import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!projectId) {
       return NextResponse.json({ error: 'Vertex AI project ID is missing from environment.' }, { status: 500 });
    }

    const vertexAI = new VertexAI({ project: projectId, location: location });
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert aviation risk evaluator for PhaseGuard AI.
You must evaluate the real mission context and return a structured aviation risk assessment in JSON format.

Data Context:
${JSON.stringify(body, null, 2)}

Rules for Risk Evaluation:
1. overallRiskScore must be an integer between 0 and 100.
2. factorScores must be an integer between 0 and 25 each.
3. Do not invent missing data.
4. If data source is FALLBACK, MANUAL, or NOT_CONNECTED, reduce confidence.
5. If weather source is LIVE METAR, use it heavily.
6. If weather is safe, do not create artificial danger.
7. If runway condition, wind, visibility, and weather combine badly, increase compounding risk.
8. If selected flight status is scheduled/active, do not treat it as risky.
9. If flight is delayed, unknown, cancelled, or diverted, include operational risk.
10. Manual runway/workload/aircraft values are valid operational inputs, not fake data.
11. Recommendations must be operational and pilot-friendly.
12. Do not claim certified aviation authority.
13. Return JSON only. No markdown formatting blocks.
14. IMPORTANT: If runway, wind, traffic, and workload are favorable but weather is severe, your explanation must explicitly state: "Operational inputs are otherwise favorable, but live METAR weather is the dominant hazard." Do not imply all factors are risky.

Decision Guidance based on overallRiskScore:
0–25 = GO
26–50 = CAUTION
51–75 = HOLD
76–100 = DIVERT

Return EXACTLY and ONLY the following JSON structure without any markdown blocks:
{
  "overallRiskScore": number,
  "decision": "GO" | "CAUTION" | "HOLD" | "DIVERT",
  "confidence": "Low" | "Medium" | "High",
  "factorScores": {
    "weather": number,
    "wind": number,
    "visibility": number,
    "traffic": number,
    "runway": number,
    "airport": number,
    "flightStatus": number,
    "manualOperationalInputs": number,
    "compounding": number
  },
  "topRisks": ["string"],
  "compoundingFactors": ["string"],
  "missingDataWarnings": ["string"],
  "recommendations": ["string"],
  "explanation": "string"
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

    // Validate bounds
    data.overallRiskScore = Math.max(0, Math.min(100, Number(data.overallRiskScore) || 0));
    
    if (data.factorScores) {
      for (const key of Object.keys(data.factorScores)) {
        data.factorScores[key] = Math.max(0, Math.min(25, Number(data.factorScores[key]) || 0));
      }
    } else {
       data.factorScores = {
        weather: 0, wind: 0, visibility: 0, traffic: 0, runway: 0, airport: 0, flightStatus: 0, manualOperationalInputs: 0, compounding: 0
       };
    }

    if (!['GO', 'CAUTION', 'HOLD', 'DIVERT'].includes(data.decision)) {
       data.decision = 'CAUTION';
    }
    if (!['Low', 'Medium', 'High'].includes(data.confidence)) {
       data.confidence = 'Low';
    }
    if (!Array.isArray(data.topRisks)) data.topRisks = [];
    if (!Array.isArray(data.compoundingFactors)) data.compoundingFactors = [];
    if (!Array.isArray(data.missingDataWarnings)) data.missingDataWarnings = [];
    if (!Array.isArray(data.recommendations)) data.recommendations = [];

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('\n=== VERTEX AI RISK EVALUATOR ERROR ===');
    console.error(error);
    return NextResponse.json({ error: 'AI Risk Evaluator unavailable due to backend error.' }, { status: 500 });
  }
}
