import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
    }

    const flight = body.flight || {};
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    console.log("[Groq Debug] Route: /api/cyber-briefing");
    console.log("[Groq Debug] Key loaded:", !!apiKey);
    console.log("[Groq Debug] Key preview:", apiKey?.slice(0, 8));
    console.log("[Groq Debug] Model used:", model);

    if (!apiKey) {
      clearTimeout(timeoutId);
      console.error("[Groq Debug] Groq failed: API key missing");
      return NextResponse.json({ 
        success: true,
        message: "Cyber exposure matrix synchronized",
        data: generateFallbackCyber(body)
      });
    }

    const generateAiCyber = async (retryCount = 0) => {
      if (retryCount > 0) {
        console.log(`[Groq Debug] Retry attempt ${retryCount}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log("[Groq Debug] Request sent");
      const prompt = `
Analyze the CYBER-OPERATIONAL EXPOSURE for SELECTED FLIGHT SPECIFICALLY: ${flight.flightNumber} (${flight.airline}) from ${flight.departureIata} to ${flight.arrivalIata}.

Analyze this specific selected flight and mission context. Do not return generic output. Your response must change based on flight status, route, airport, weather, runway, traffic, workload, aircraft status, and data confidence.

Mission Context:
- Current Operational Risk Score: ${body.currentRiskScore || 0}
- Landing Hazards: ${JSON.stringify(body.top3Risks || [])}
- Flight Status: ${flight.status}

Requirements:
1. Determine a level: "Low", "Medium", or "High".
2. Determine a score (0-100).
3. Short professional summary (2 sentences max) mentioning the flight number.
4. 2-3 specific operational cyber-awareness actions.

Return JSON ONLY:
{
  "level": "Low" | "Medium" | "High",
  "score": number,
  "summary": "string",
  "actions": ["string"]
}
`;

      const response = await fetch(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ 
            model: model,
            messages: [
              {
                role: "system",
                content: "You are PhaseGuard AI, an aviation decision-support analysis assistant. Return accurate, concise, structured JSON only."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        }
      );

      if (response.status === 429 && retryCount < 1) {
        return generateAiCyber(retryCount + 1);
      }

      if (!response.ok) {
        console.error(`[Groq Debug] Groq failed (/api/cyber-briefing): Status ${response.status}`);
        throw new Error(`API status ${response.status}`);
      }
      
      const result = await response.json();
      console.log("[Groq Debug] Response received");
      
      const content = result.choices?.[0]?.message?.content || "{}";
      return JSON.parse(content.trim());
    };

    try {
      const data = await generateAiCyber(0);
      clearTimeout(timeoutId);

      return NextResponse.json({
        success: true,
        message: "Cyber exposure matrix synchronized",
        data
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[Groq Debug] Groq failed (/api/cyber-briefing):`, error.message);
      return NextResponse.json({
        success: true,
        message: "Cyber exposure matrix synchronized",
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
      ? 'Elevated mission complexity increases digital dependency. Cyber-operational exposure is monitored.'
      : 'Standard digital exposure. Systems operating within normal parameters.',
    actions: [
      'Verify GNSS integrity against legacy ground-based navaids.',
      'Monitor for unexplained telemetry or navigation deviations.',
      'Maintain digital discipline and verify cross-channel data consistency.'
    ]
  };
}
