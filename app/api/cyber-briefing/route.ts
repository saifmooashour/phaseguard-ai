import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        clearTimeout(timeoutId);
        console.error('GEMINI_API_KEY is missing from environment.');
        return NextResponse.json({ 
          success: false,
          fallback: true,
          message: "AI unavailable, using fallback logic",
          data: generateFallbackCyber(body)
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

      const result = await model.generateContent(prompt);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 25000);
      });

      const responseResult: any = await Promise.race([
        result.response,
        timeoutPromise
      ]);

      clearTimeout(timeoutId);

      let text = responseResult.text() || "{}";

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
          message: "AI response format error, using fallback logic",
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
      const isTimeout = error.message === 'TIMEOUT' || error.name === 'AbortError';
      console.error(`\n=== GEMINI AI CYBER BRIEFING ERROR (${isTimeout ? 'TIMEOUT' : 'GENERAL'}) ===`);
      console.error(error);
      
      return NextResponse.json({
        success: false,
        fallback: true,
        message: isTimeout ? "AI request timed out, using fallback logic" : "AI unavailable, using fallback logic",
        data: generateFallbackCyber(body)
      });
    }
}

function generateFallbackCyber(body: any) {
  return {
    level: 'Low',
    score: 25,
    summary: 'Cyber-operational exposure estimated using local fallback logic.',
    actions: [
      'Verify communication channels.',
      'Monitor abnormal system alerts.',
      'Maintain standard digital awareness.'
    ]
  };
}

