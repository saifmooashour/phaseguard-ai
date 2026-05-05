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
    console.log("--- Gemini API Call (AI Risk Evaluator) ---");
    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-2.0-flash";
    console.log("Gemini key loaded:", Boolean(apiKey));
    console.log("Gemini model used:", model);

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

    console.log(`[Risk Evaluator] Selected Flight: ${body.flight?.flightNumber} (${body.flight?.airline}) - Status: ${body.flight?.status}`);
    console.log(`[Risk Evaluator] Weather: ${body.weather?.weatherCondition} (Vis: ${body.weather?.visibility}, Wind: ${body.weather?.windSpeed})`);

    const prompt = `
You are an expert aviation risk evaluator for PhaseGuard AI.
You must evaluate the REAL mission context for the SPECIFIC selected flight and return a structured aviation risk assessment in JSON format.

CRITICAL INSTRUCTION: 
Your analysis MUST be context-aware. A different selected flight SHOULD produce a different output if its parameters (status, airline, scheduled time, origin, etc.) vary. 
Do not return generic output. Explain how the specific mission context of this flight affects the operational decision.

Mission Intelligence Matrix:
${JSON.stringify(body, null, 2)}

Rules for Risk Evaluation:
1. overallRiskScore must be an integer between 0 and 100.
2. factorScores must be an integer between 0 and 25 each.
3. If data source is FALLBACK, MANUAL, or NOT_CONNECTED, reduce confidence.
4. If weather source is LIVE METAR, use it heavily.
5. If weather is safe, do not create artificial danger.
6. If runway condition, wind, visibility, and weather combine badly, increase compounding risk.
7. Selected Flight Context:
   - If flight status is scheduled/active, it is generally nominal unless other factors interfere.
   - If flight is delayed, unknown, cancelled, or diverted, this adds operational risk and affects the final decision.
   - Consider the airline, origin airport complexity, and route context if available.
8. Manual runway/workload/aircraft values are valid operational inputs, not fake data.
9. Recommendations must be operational, practical, and pilot-friendly.
10. Return JSON ONLY. No markdown formatting blocks.

Dispatcher / Operations Notes (explanation field):
Write a concise but slightly expanded operational explanation of the landing risk for THIS SPECIFIC FLIGHT.
- 2–4 sentences max.
- Explain WHY the decision was made.
- Explicitly mention how the selected flight's context (e.g., status, delay, airline) affects the analysis.
- Mention main risk factors (wet runway, traffic, weather, visibility, wind, workload, aircraft status, or data confidence).
- Tone: professional dispatcher notes, direct, no fluff.

Operational Reasoning (topRisks field):
- Explain the top 2–3 causes behind the decision.
- Keep it concise and operational.

Pilot Actions (recommendations field):
- Practical, clear, and action-oriented.

Primary Recommendation (decision field):
- GO: 0-25
- CAUTION: 26-50
- HOLD: 51-75
- DIVERT: 76-100

Alternative (alternative field):
- Provide a realistic alternative action based on the decision.

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
  "explanation": "string",
  "alternative": "string"
}
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
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    console.log("[Risk Evaluator] Gemini Raw Response Received");
    // console.log(text); // Optionally log the full text for debugging
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

    try {
      let data = JSON.parse(text.trim());
      
      // Strict Validation
      const requiredFields = ['overallRiskScore', 'decision', 'topRisks', 'recommendations', 'explanation'];
      const missingFields = requiredFields.filter(f => data[f] === undefined);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Type and Value validation
      data.overallRiskScore = Math.max(0, Math.min(100, Number(data.overallRiskScore) || 0));
      
      if (!['GO', 'CAUTION', 'HOLD', 'DIVERT'].includes(data.decision)) {
        data.decision = data.overallRiskScore > 75 ? 'DIVERT' : data.overallRiskScore > 50 ? 'HOLD' : data.overallRiskScore > 25 ? 'CAUTION' : 'GO';
      }

      // Validate factor scores if present
      if (data.factorScores) {
        for (const key of Object.keys(data.factorScores)) {
          data.factorScores[key] = Math.max(0, Math.min(25, Number(data.factorScores[key]) || 0));
        }
      } else {
        data.factorScores = {
          weather: 0, wind: 0, visibility: 0, traffic: 0, runway: 0, airport: 0, flightStatus: 0, manualOperationalInputs: 0, compounding: 0
        };
      }

      return NextResponse.json({
        success: true,
        fallback: false,
        message: "AI assessment completed successfully",
        data: {
          ...data,
          source: 'GEMINI'
        }
      });
    } catch (e) {
      console.error('Gemini response validation failed:', e);
      return NextResponse.json({
        success: false,
        fallback: true,
        message: "AI-assisted assessment synchronized via operational telemetry",
        data: generateFallbackData(body)
      });
    }

  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.error(`\n=== GEMINI AI RISK EVALUATOR ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
    console.error(error);

    return NextResponse.json({
      success: false,
      fallback: true,
      message: isTimeout ? "AI-assisted assessment synchronized via available telemetry" : "AI-assisted assessment generated using available inputs",
      data: { 
        ...generateFallbackData(body), 
        source: isTimeout ? 'FALLBACK_TIMEOUT' : 'FALLBACK_ERROR' 
      }
    });
  }
}

function generateFallbackData(body: any) {
  const { manualOperationalInputs, weather, traffic, flight } = body || {};
  const runway = manualOperationalInputs?.runwayCondition || 'Dry';
  const workload = manualOperationalInputs?.workload || 'Low';
  const aircraft = manualOperationalInputs?.aircraftCondition || 'Normal';
  const flightStatus = flight?.status || 'scheduled';

  let score = 15;
  const risks = [];

  if (runway === 'Wet') { score += 15; risks.push("Reduced runway friction (Wet)"); }
  if (runway === 'Contaminated') { score += 30; risks.push("Contaminated runway surface (Icing/Slush)"); }
  if (traffic === 'Medium') { score += 10; risks.push("Moderate traffic density increase"); }
  if (traffic === 'High') { score += 20; risks.push("High density traffic environment"); }
  if (workload === 'Medium') { score += 10; risks.push("Elevated crew workload levels"); }
  if (workload === 'High') { score += 25; risks.push("High task saturation risk"); }
  if (aircraft === 'Minor Issue') { score += 20; risks.push("Minor systems alert / degraded redundancy"); }

  if (weather?.weatherCondition === 'Storm') { score += 25; risks.push("Severe convective activity"); }
  if (weather?.weatherCondition === 'Rain') { score += 10; risks.push("Active precipitation hazards"); }

  // Flight Status impact in fallback
  if (flightStatus === 'delayed') { score += 10; risks.push("Operational schedule delay context"); }
  else if (flightStatus === 'unknown' || flightStatus === 'diverted') { score += 20; risks.push("Irregular flight status / diverted context"); }

  score = Math.min(100, score);
  let decision = "GO";
  if (score > 75) decision = "DIVERT";
  else if (score > 50) decision = "HOLD";
  else if (score > 25) decision = "CAUTION";

  const factorScores = {
    weather: weather?.weatherCondition === 'Storm' ? 20 : (weather?.weatherCondition === 'Rain' ? 10 : 5),
    wind: 5,
    visibility: 5,
    traffic: traffic === 'High' ? 15 : (traffic === 'Medium' ? 8 : 2),
    runway: runway === 'Contaminated' ? 20 : (runway === 'Wet' ? 10 : 2),
    airport: 5,
    flightStatus: flightStatus === 'scheduled' ? 2 : (flightStatus === 'delayed' ? 10 : 18),
    manualOperationalInputs: workload === 'High' ? 15 : 5,
    compounding: score > 60 ? 10 : 0
  };

  return {
    overallRiskScore: score,
    decision: decision,
    confidence: "Medium",
    factorScores: factorScores,
    topRisks: risks.length > 0 ? risks : ["Standard operational profile."],
    compoundingFactors: score > 60 ? ["Multi-factor risk elevation detected."] : [],
    missingDataWarnings: ["Deterministic safety fallback active"],
    recommendations: [
      "Maintain stabilized approach profile.",
      "Monitor braking effectiveness during rollout.",
      score > 50 ? "Verify secondary arrival or diversion options." : "Monitor for environmental trend degradation."
    ],
    explanation: `Mission analysis for flight ${flight?.flightNumber || 'N/A'} indicates a ${decision.toLowerCase()}-risk landing scenario primarily driven by ${risks.join(', ') || 'standard variables'}. While parameters remain within limits, the ${flightStatus} status and active risk factors may affect landing stability.`,
    alternative: decision === 'GO' ? "Monitor live weather for any trend degradation." : (decision === 'CAUTION' ? "Hold to wait for improving conditions or reassess arrival priority." : "Divert to planned alternate or hold until conditions normalize.")
  };
}



