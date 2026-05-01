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
    console.log("Gemini key loaded:", Boolean(process.env.GEMINI_API_KEY));
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      clearTimeout(timeoutId);
      console.error('GEMINI_API_KEY is missing from environment.');
      return NextResponse.json({
        success: false,
        fallback: true,
        message: "GEMINI_API_KEY is missing from environment",
        data: generateFallbackData(body)
      });
    }

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
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Clean up potential markdown formatting from LLM response
    if (text.startsWith('```json')) {
      text = text.substring(7);
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
    } else if (text.startsWith('```')) {
      text = text.substring(3);
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
    }
    
    let data;
    try {
      data = JSON.parse(text.trim());
    } catch (e) {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json({
        success: false,
        fallback: true,
        message: "AI response format error, using fallback logic",
        data: generateFallbackData(body)
      });
    }

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

    return NextResponse.json({
      success: true,
      fallback: false,
      message: "AI analysis completed",
      data: data
    });

  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error(`\n=== GEMINI AI RISK EVALUATOR ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
    console.error(error);
    
    return NextResponse.json({
      success: false,
      fallback: true,
      message: isTimeout ? "AI request timed out, using fallback logic" : "AI unavailable, using fallback logic",
      data: generateFallbackData(body)
    });
  }
}

function generateFallbackData(body: any) {
  const { manualOperationalInputs, weather, traffic } = body || {};
  const runway = manualOperationalInputs?.runwayCondition || 'Dry';
  const workload = manualOperationalInputs?.workload || 'Low';
  const aircraft = manualOperationalInputs?.aircraftCondition || 'Normal';
  
  let score = 20;
  const risks = [];
  
  if (runway === 'Wet') { score += 15; risks.push("Wet runway surface"); }
  if (runway === 'Contaminated') { score += 30; risks.push("Contaminated runway surface"); }
  if (traffic === 'Medium') { score += 10; risks.push("Moderate traffic density"); }
  if (traffic === 'High') { score += 20; risks.push("High traffic density"); }
  if (workload === 'Medium') { score += 10; risks.push("Elevated crew workload"); }
  if (workload === 'High') { score += 25; risks.push("High crew workload task saturation"); }
  if (aircraft === 'Minor Issue') { score += 20; risks.push("Minor aircraft systems alert"); }
  
  if (weather?.weatherCondition === 'Storm') { score += 25; risks.push("Adverse storm conditions"); }
  if (weather?.weatherCondition === 'Rain') { score += 10; risks.push("Active precipitation"); }

  score = Math.min(100, score);
  let decision = "GO";
  if (score > 75) decision = "DIVERT";
  else if (score > 50) decision = "HOLD";
  else if (score > 25) decision = "CAUTION";

  return {
    overallRiskScore: score,
    decision: decision,
    confidence: "Medium",
    factorScores: {
      weather: weather?.weatherCondition === 'Storm' ? 20 : (weather?.weatherCondition === 'Rain' ? 10 : 5),
      wind: 5,
      visibility: 5,
      traffic: traffic === 'High' ? 15 : (traffic === 'Medium' ? 8 : 2),
      runway: runway === 'Contaminated' ? 20 : (runway === 'Wet' ? 10 : 2),
      airport: 5,
      flightStatus: 2,
      manualOperationalInputs: workload === 'High' ? 15 : 5,
      compounding: score > 60 ? 10 : 0
    },
    topRisks: risks.length > 0 ? risks : ["Baseline operational awareness."],
    compoundingFactors: [],
    missingDataWarnings: ["AI analysis offline. Rule-based evaluation active."],
    recommendations: ["Maintain standard operational awareness.", "Verify all digital telemetry."],
    explanation: `Rule-based assessment completed. Primary hazards: ${risks.join(', ') || 'None identified'}.`
  };
}



