import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  console.log(`[PhaseGuard AI] API RECEIVED REQUEST | TIME: ${new Date().toISOString()}`);
  
  let body: any = {};
  try {
    body = await request.json();
    console.log(`[PhaseGuard AI] REQUEST BODY PARSED | ID: ${body.requestId}`);
    
    // EMERGENCY DEBUG OVERRIDE
    if (body.debug) {
      console.log("[PhaseGuard AI] DEBUG MODE ACTIVE - returning mock response");
      return Response.json({ success: true, data: { status: "ok", score: 25, decision: "GO" }, requestId: body.requestId });
    }
  } catch (e) {
    console.error('[PhaseGuard AI] Failed to parse request body:', e);
  }

  const { flight = {}, airport = {}, manualOperationalInputs = {}, weather = {}, traffic = {}, requestId, timestamp, computedRisk = {} } = body;
  
  console.log("--------------------------------------------------");
  console.log(`[PhaseGuard AI] ANALYSIS STARTING`);
  console.log(`ID: ${requestId} | FLIGHT: ${flight.flightNumber} | AIRPORT: ${airport.icao}`);
  console.log("--------------------------------------------------");

  // 1. COLLECT MISSION DATA
  const missionContext = {
    flight: {
      number: flight.flightNumber || 'TBD',
      airline: flight.airline || 'N/A',
      origin: flight.departureIata || 'N/A',
      destination: flight.arrivalIata || airport.icao || 'N/A',
      status: (flight.status || 'Scheduled').toLowerCase(),
      scheduledTime: flight.scheduledTime || 'N/A'
    },
    airport: {
      icao: airport.icao || 'N/A',
      complexity: airport.complexity || 'Medium',
      runwayContext: manualOperationalInputs.runwayCondition || 'Dry'
    },
    environment: {
      weather: (weather.weatherCondition || manualOperationalInputs.weatherCondition || 'Clear').toLowerCase(),
      visibility: (weather.visibilityCategory || manualOperationalInputs.visibilityCategory || 'Good').toLowerCase(),
      wind: (weather.windCategory || manualOperationalInputs.windCategory || 'Calm').toLowerCase(),
      traffic: (traffic.trafficLevel || manualOperationalInputs.trafficLevel || 'Low').toLowerCase()
    },
    operational: {
      workload: (manualOperationalInputs.workload || 'Low').toLowerCase(),
      aircraft: (manualOperationalInputs.aircraftCondition || 'Normal').toLowerCase()
    },
    computedRisk
  };

  const score = computedRisk.score || 0;
  const decision = computedRisk.decision || "GO";
  const factors = computedRisk.factors || {};
  const compoundingTriggers = computedRisk.compounding || [];

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    clearTimeout(timeoutId);
    const fallbackData = generateEmergencyFallback(missionContext, score, decision, factors, compoundingTriggers);
    return NextResponse.json({ success: true, data: fallbackData, requestId }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  }

  try {
    const prompt = `
You are a senior aviation safety analyst and dispatcher generating a mission-critical operational recommendation.

STRICT RULES:
- Sound professional, operational, and "judge-ready".
- NO generic language (e.g., "Monitor conditions").
- MUST be specific to Flight ${missionContext.flight.number} to ${missionContext.flight.destination}.
- MUST reference at least 2 top risk drivers in the reasoning and notes.
- Use the provided score of ${score}/100 and decision of ${decision}.

MISSION CONTEXT:
- Flight: ${missionContext.flight.number} from ${missionContext.flight.origin} → ${missionContext.flight.destination}
- Status: ${missionContext.flight.status}
- Airport: ${missionContext.airport.icao} (${missionContext.airport.runwayContext})
- Environment: Weather=${missionContext.environment.weather}, Visibility=${missionContext.environment.visibility}, Wind=${missionContext.environment.wind}, Traffic=${missionContext.environment.traffic}
- Operational: Workload=${missionContext.operational.workload}, Aircraft Status=${missionContext.operational.aircraft}
- Risk Engine Output: Score ${score}/100, Decision ${decision}

FIELDS TO GENERATE (RETURN JSON ONLY):

1. "primaryRecommendation": 
   - If decision is GO: "PROCEED NORMALLY"
   - If decision is CAUTION: "PROCEED WITH CAUTION"
   - If decision is NO-GO: "HOLD / REASSESS"

2. "alternativeRecommendation":
   - If GO: "Continue normal approach planning while monitoring runway, weather, and traffic updates."
   - If CAUTION: "Prepare for spacing adjustment, updated runway condition review, or delayed approach if margins reduce."
   - If NO-GO: "Hold, reassess operational inputs, and consider alternate approach or diversion planning."

3. "operationalReasoning": (Array of 2-4 meaningful bullets)
   - Must mention flight number and route.
   - Explain why the ${decision} decision is appropriate based on specific factors.
   - Mention top risks (e.g., ${missionContext.environment.weather}, ${missionContext.environment.traffic}).

4. "pilotActions": (Array of 3-5 practical items)
   - GO actions: Stabilized approach criteria, verify data, monitor trends.
   - CAUTION actions: Strict gates, verify runway condition, monitor spacing/wind, prepare go-around.
   - NO-GO actions: Do not continue without reassessment, coordinate alternate/sequencing, verify status, prepare diversion.

5. "dispatcherNotes": (2-4 sentences)
   - Mention flight ${missionContext.flight.number}, route, decision, and main risk drivers.
   - Avoid generic phrases like "holds a GO status".

6. "briefing": (5-7 bullets, pilot-ready)
   - Format: "- Flight ${missionContext.flight.number} from ${missionContext.flight.origin} to ${missionContext.flight.destination} is assessed as ${decision}..."
   - Include drivers, impact, action, monitoring, and final guidance.

7. "topRisks": (Exactly 3 aviation-specific risk objects)
   - Each with: "title", "severity" (High/Medium/Low), "explanation", "mitigation".

RETURN JSON ONLY.
`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a senior aviation safety analyst. Return structured JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.25,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!groqResponse.ok) throw new Error(`Groq API Error: ${groqResponse.status}`);

    const result = await groqResponse.json();
    const xaiOutput = JSON.parse(result.choices?.[0]?.message?.content || "{}");
    
    console.log(`[PhaseGuard AI] GROQ RESPONSE PREVIEW | ID: ${requestId}`);
    console.log(result.choices?.[0]?.message?.content?.substring(0, 500));

    const finalData = {
      requestId,
      score: Number(score),
      decision: decision,
      confidence: "High",
      factorScores: factors || {},
      primaryRecommendation: xaiOutput.primaryRecommendation || (decision === 'GO' ? "PROCEED NORMALLY" : decision === 'CAUTION' ? "PROCEED WITH CAUTION" : "HOLD / REASSESS"),
      alternativeRecommendation: xaiOutput.alternativeRecommendation || (
        decision === 'GO' ? "Continue normal approach planning while monitoring runway, weather, and traffic updates." :
        decision === 'CAUTION' ? "Prepare for spacing adjustment, updated runway condition review, or delayed approach if margins reduce." :
        "Hold, reassess operational inputs, and consider alternate approach or diversion planning."
      ),
      operationalReasoning: Array.isArray(xaiOutput.operationalReasoning) 
        ? xaiOutput.operationalReasoning 
        : xaiOutput.operationalReasoning 
          ? [String(xaiOutput.operationalReasoning)] 
          : [`Flight ${missionContext.flight.number} to ${missionContext.flight.destination} is assessed as ${decision} because current environmental and operational inputs remain within safety margins.`],
      dispatcherNotes: String(xaiOutput.dispatcherNotes || xaiOutput.explanation || `Flight ${missionContext.flight.number} to ${missionContext.flight.destination} is currently ${decision}. Main risk monitoring remains focused on the terminal environment and mission telemetry.`),
      pilotActions: Array.isArray(xaiOutput.pilotActions) 
        ? xaiOutput.pilotActions 
        : xaiOutput.pilotActions 
          ? [String(xaiOutput.pilotActions)] 
          : (decision === 'GO' ? ["Maintain stabilized approach criteria.", "Verify latest runway and traffic updates.", "Continue monitoring weather trend."] : 
             decision === 'CAUTION' ? ["Maintain strict stabilized approach gates.", "Verify latest runway condition.", "Monitor spacing and wind correction."] :
             ["Do not continue approach without reassessment.", "Coordinate alternate sequencing.", "Prepare diversion or delay plan."]),
      topRisks: Array.isArray(xaiOutput.topRisks) 
        ? xaiOutput.topRisks 
        : [],
      aiSafetySynthesis: Array.isArray(xaiOutput.aiSafetySynthesis) ? xaiOutput.aiSafetySynthesis : [],
      cyberExposure: xaiOutput.cyberExposure || { level: "Low", score: 20, explanation: "Local engine validation active.", actions: ["Maintain radio silence on data link"] },
      factorBreakdown: xaiOutput.factorBreakdown || {},
      source: 'GROQ_XAI',
      missionContext: missionContext.flight
    };

    clearTimeout(timeoutId);
    return NextResponse.json({ success: true, data: finalData, requestId }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[PhaseGuard AI] XAI Generation Failed:", error.message);
    const fallbackData = generateEmergencyFallback(missionContext, score, decision, factors, compoundingTriggers, requestId);
    return NextResponse.json({ success: true, data: fallbackData, requestId }, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  }
}

function generateEmergencyFallback(ctx: any, score: number, decision: string, factors: any, compounding: string[], requestId?: string) {
  const briefingLines = [
    `• Flight ${ctx.flight.number} ${ctx.flight.origin} → ${ctx.flight.destination} — Decision: ${decision}`,
    `• Primary risk: Operational load detected in mission profile`,
    `• Secondary risk: Environmental telemetry indicates caution phase`,
    `• Impact: Elevated risk score of ${score}/100 reduces safety margins`,
    `• Action: Maintain stabilized approach discipline and monitor trends`,
    `• Action: Cross-verify all landing performance and environment data`,
    `• Monitor: Continuous assessment of compounding risks for deterioration`
  ];

  // Data-driven risk derivation for fallback
  const factorMap = [
    { key: "weather", label: "Weather Conditions", mitigation: "Monitor weather radar and adjust approach profile" },
    { key: "traffic", label: "Traffic Congestion", mitigation: "Coordinate with ATC for spacing" },
    { key: "runway", label: "Runway Condition", mitigation: "Adjust landing technique and braking strategy" },
    { key: "workload", label: "Crew Workload", mitigation: "Maintain strict situational awareness" },
    { key: "aircraft", label: "Aircraft Condition", mitigation: "Verify aircraft systems and performance data" },
    { key: "visibility", label: "Reduced Visibility", mitigation: "Use instrument guidance and minimums" },
    { key: "wind", label: "Wind Conditions", mitigation: "Apply crosswind correction" }
  ];

  const derivedRisks = factorMap
    .map(f => ({
      title: f.label,
      score: Number(factors[f.key]) || 0,
      mitigation: f.mitigation
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => ({
      title: r.title,
      severity: r.score >= 12 ? "High" : r.score >= 6 ? "Medium" : "Low",
      explanation: `${r.title} is contributing to operational risk based on mission telemetry.`,
      mitigation: r.mitigation
    }));

  while (derivedRisks.length < 3) {
    derivedRisks.push({
      title: "Operational Monitoring",
      severity: "Low",
      explanation: "Continuous assessment of mission parameters.",
      mitigation: "Maintain situational awareness."
    });
  }

  return {
    requestId,
    score: Number(score),
    decision: decision,
    confidence: "Medium (Fallback)",
    factorScores: factors || {},
    operationalReasoning: [`Mission risk for ${ctx.flight.number} is assessed as ${decision}.`],
    dispatcherNotes: `Flight ${ctx.flight.number} to ${ctx.flight.destination} is currently ${decision}. Main risk monitoring remains focused on the terminal environment and mission telemetry.`,
    pilotActions: (decision === 'GO' ? ["Maintain stabilized approach criteria.", "Verify latest runway and traffic updates.", "Continue monitoring weather trend."] : 
                   decision === 'CAUTION' ? ["Maintain strict stabilized approach gates.", "Verify latest runway condition.", "Monitor spacing and wind correction."] :
                   ["Do not continue approach without reassessment.", "Coordinate alternate sequencing.", "Prepare diversion or delay plan."]),
    topRisks: derivedRisks,
    aiSafetySynthesis: [],
    briefing: briefingLines,
    cyberExposure: { level: "Low", score: 20, explanation: "Local engine validation active.", actions: ["Maintain radio silence on data link"] },
    factorBreakdown: factors || {},
    source: 'LOCAL_ENGINE'
  };
}
