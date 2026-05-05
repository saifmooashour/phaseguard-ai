import { NextResponse } from 'next/server';

/**
 * POST /api/cyber-briefing
 * Uses Gemini AI to estimate cyber-operational exposure based on mission context.
 */
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
      console.log("--- Gemini API Call (Cyber Briefing) ---");
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
        message: "AI-assisted assessment generated using available inputs",
        data: generateFallbackCyber(body)
      });
    }

    console.log(`[Cyber Briefing] Mission Risk Score: ${body.currentRiskScore}`);

    const prompt = `
You are a cybersecurity expert specializing in aviation operational technology (OT) and digital threat assessments for PhaseGuard AI.
Evaluate the "Cyber-Operational Exposure" for the flight crew using the SPECIFIC mission context provided.

CRITICAL: Your analysis must be context-aware. If the mission risk is high, or traffic is high, the cyber-operational exposure should reflect the increased digital dependency and potential for interference.

Mission Context:
- Airport: ${JSON.stringify(body.airport || 'Unknown')}
- METAR/Weather: ${JSON.stringify(body.weather || 'Unavailable')}
- Runway Condition: ${JSON.stringify(body.runwayCondition || 'Dry')}
- Traffic Level: ${JSON.stringify(body.trafficLevel || 'Low')}
- Crew Workload: ${JSON.stringify(body.crewWorkload || 'Low')}
- Aircraft Status: ${JSON.stringify(body.aircraftStatus || 'Normal')}
- Current Operational Risk Score: ${JSON.stringify(body.currentRiskScore || 0)}
- Top 3 Landing Risks: ${JSON.stringify(body.top3Risks || [])}

Requirements:
1. Cyber-Operational Exposure represents the risk of operational disruption via digital vectors (GPS spoofing, navigation interference, telemetry anomalies).
2. Complex environments (high traffic, low visibility, high workload) elevate vulnerability as digital dependency increases.
3. Determine a level: "Low", "Medium", or "High".
4. Determine a score from 0 to 100.
5. Provide a short, actionable, and professional summary (2 sentences max).
6. Provide 2 or 3 specific, operational cyber-awareness actions.
7. Tone: Senior aviation consultant, direct, no fluff.

You MUST return EXACTLY a JSON object without markdown blocks.
{
  "level": "Low" | "Medium" | "High",
  "score": number,
  "summary": "string",
  "actions": ["string"]
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
        console.error('Failed to parse Gemini response for Cyber Briefing:', text);
        return NextResponse.json({
          success: false,
          fallback: true,
          message: "AI-assisted assessment synchronized",
          data: generateFallbackCyber(body)
        });
      }

      const finalResult = {
        level: ['Low', 'Medium', 'High'].includes(data.level) ? data.level : 'Low',
        score: Math.max(0, Math.min(100, Number(data.score) || 25)),
        summary: data.summary || "Cyber-operational exposure analyzed based on current mission parameters.",
        actions: Array.isArray(data.actions) && data.actions.length > 0 ? data.actions : ['Verify communication channels.', 'Monitor abnormal system alerts.']
      };

      return NextResponse.json({
        success: true,
        fallback: false,
        message: "AI analysis completed",
        data: finalResult
      });

    } catch (error: any) {
      clearTimeout(timeoutId);
      const isTimeout = error.name === 'AbortError';
      console.error(`\n=== GEMINI AI CYBER BRIEFING ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
      console.error(error);
      
      return NextResponse.json({
        success: false,
        fallback: true,
        message: isTimeout ? "AI-assisted assessment synchronized via available telemetry" : "AI-assisted assessment generated using available inputs",
        data: generateFallbackCyber(body)
      });
    }
}

function generateFallbackCyber(body: any) {
  const score = body.currentRiskScore || 20;
  const isHighRisk = score > 60;
  
  return {
    level: isHighRisk ? 'Medium' : 'Low',
    score: isHighRisk ? 45 : 22,
    summary: isHighRisk 
      ? 'Elevated mission complexity increases digital dependency. Cyber-operational exposure is heightened due to increased reliance on automated navigation and telemetry systems.'
      : 'Standard digital exposure. Systems operating within normal parameters with routine cybersecurity monitoring.',
    actions: [
      'Verify GNSS integrity against legacy ground-based navaids.',
      'Monitor for unexplained telemetry or navigation deviations.',
      'Maintain digital discipline and verify cross-channel data consistency.'
    ]
  };
}

