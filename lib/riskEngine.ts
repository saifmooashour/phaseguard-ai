import { RunwayLengthCategory, AirportComplexity } from './airportData'

export interface RiskParams {
  runway: string
  traffic: string
  workload: string
  aircraft: string
  visibilityCategory: string
  windCategory: string
  weatherCondition: string
  runwayLengthCategory: RunwayLengthCategory | string
  airportComplexity: AirportComplexity | string
  flightStatus?: string
  flight?: any
  dataSources?: Record<string, string>
}

export interface RiskFactor {
  label: string
  weight: number
  category: 'runway' | 'traffic' | 'workload' | 'aircraft' | 'visibility' | 'wind' | 'weather' | 'airport' | 'flight' | 'compounding' | 'confidence'
}

export interface RiskResult {
  score: number
  level: 'Low' | 'Medium' | 'High' | 'Critical'
  decision: 'GO' | 'CAUTION' | 'NO-GO'
  decisionReason: string
  topRisks: string[]
  riskBreakdown: Record<string, number>
  recommendations: string[]
  summary: string
  explanation: string
  confidence: 'High' | 'Medium' | 'Low'
  compoundingEvents: string[]
  dataSources: Record<string, string>
}

/**
 * PhaseGuard AI Dynamic Risk Engine (Local Engine)
 * Implements weighted scoring with compounding logic as requested.
 */
export function calculateRisk(params: RiskParams): RiskResult {
  let score = 0
  const factors: RiskFactor[] = []
  const compoundingEvents: string[] = []

  const {
    runway,
    traffic,
    workload,
    aircraft,
    visibilityCategory,
    windCategory,
    weatherCondition,
    airportComplexity,
    flightStatus,
    flight = {},
    dataSources = {}
  } = params

  console.log("RISK INPUTS", {
    weatherCondition,
    traffic,
    runway,
    workload,
    aircraft,
    visibilityCategory,
    windCategory,
    flightStatus
  });

  // 1. Weather (Baseline: +3)
  const weatherLower = (weatherCondition || '').toLowerCase()
  if (weatherLower === 'storm' || weatherLower === 'heavy rain') {
    factors.push({ label: 'Severe Weather (Storm)', weight: 20, category: 'weather' })
  } else if (weatherLower === 'rain' || weatherLower === 'light rain') {
    factors.push({ label: 'Adverse Weather (Rain)', weight: 10, category: 'weather' })
  } else if (weatherLower === 'cloudy' || weatherLower === 'overcast') {
    factors.push({ label: 'Cloudy Conditions', weight: 4, category: 'weather' })
  } else if (weatherLower === 'clear') {
    factors.push({ label: 'Clear Weather Baseline', weight: 3, category: 'weather' })
  } else {
    console.warn("Missing weather data");
    factors.push({ label: 'Data confidence: Weather', weight: 8, category: 'confidence' })
  }

  // 2. Traffic (Baseline: +3)
  const trafficLower = (traffic || '').toLowerCase()
  if (trafficLower === 'high') {
    factors.push({ label: 'High Traffic Density', weight: 15, category: 'traffic' })
  } else if (trafficLower === 'medium') {
    factors.push({ label: 'Moderate Traffic', weight: 8, category: 'traffic' })
  } else if (trafficLower === 'low') {
    factors.push({ label: 'Low Traffic Baseline', weight: 3, category: 'traffic' })
  } else {
    console.warn("Missing traffic data");
    factors.push({ label: 'Data confidence: Traffic', weight: 8, category: 'confidence' })
  }

  // 3. Runway (Baseline: +3)
  const runwayLower = (runway || '').toLowerCase()
  if (runwayLower === 'contaminated') {
    factors.push({ label: 'Contaminated Runway Surface', weight: 25, category: 'runway' })
  } else if (runwayLower === 'wet') {
    factors.push({ label: 'Wet Runway Surface', weight: 12, category: 'runway' })
  } else if (runwayLower === 'dry') {
    factors.push({ label: 'Dry Runway Baseline', weight: 3, category: 'runway' })
  } else {
    console.warn("Missing runway data");
    factors.push({ label: 'Data confidence: Runway', weight: 8, category: 'confidence' })
  }

  // 4. Workload (Baseline: +3)
  const workloadLower = (workload || '').toLowerCase()
  if (workloadLower === 'high') {
    factors.push({ label: 'High Crew Workload', weight: 18, category: 'workload' })
  } else if (workloadLower === 'medium') {
    factors.push({ label: 'Elevated Workload', weight: 8, category: 'workload' })
  } else if (workloadLower === 'low') {
    factors.push({ label: 'Nominal Workload Baseline', weight: 3, category: 'workload' })
  } else {
    console.warn("Missing workload data");
    factors.push({ label: 'Data confidence: Workload', weight: 8, category: 'confidence' })
  }

  // 5. Aircraft (Baseline: +3)
  const aircraftLower = (aircraft || '').toLowerCase()
  if (aircraftLower === 'abnormal' || aircraftLower === 'major issue') {
    factors.push({ label: 'Major Aircraft System Issue', weight: 25, category: 'aircraft' })
  } else if (aircraftLower === 'minor issue') {
    factors.push({ label: 'Minor Aircraft Alert', weight: 10, category: 'aircraft' })
  } else if (aircraftLower === 'normal') {
    factors.push({ label: 'Nominal System Baseline', weight: 3, category: 'aircraft' })
  } else {
    console.warn("Missing aircraft data");
    factors.push({ label: 'Data confidence: Aircraft', weight: 8, category: 'confidence' })
  }

  // 6. Visibility (Baseline: +3)
  const visLower = (visibilityCategory || '').toLowerCase()
  if (visLower === 'poor' || visLower === 'low') {
    factors.push({ label: 'Poor Visibility', weight: 18, category: 'visibility' })
  } else if (visLower === 'moderate' || visLower === 'reduced') {
    factors.push({ label: 'Moderate Visibility', weight: 8, category: 'visibility' })
  } else if (visLower === 'good') {
    factors.push({ label: 'Good Visibility Baseline', weight: 3, category: 'visibility' })
  } else {
    console.warn("Missing visibility data");
    factors.push({ label: 'Data confidence: Visibility', weight: 8, category: 'confidence' })
  }

  // 7. Wind (Baseline: +3)
  const windLower = (windCategory || '').toLowerCase()
  if (windLower === 'strong') {
    factors.push({ label: 'Strong Crosswind/Shear', weight: 18, category: 'wind' })
  } else if (windLower === 'moderate') {
    factors.push({ label: 'Moderate Wind', weight: 8, category: 'wind' })
  } else if (windLower === 'calm') {
    factors.push({ label: 'Calm Wind Baseline', weight: 3, category: 'wind' })
  } else {
    console.warn("Missing wind data");
    factors.push({ label: 'Data confidence: Wind', weight: 8, category: 'confidence' })
  }

  // 8. Flight Status and Route (Baseline: +3)
  const statusLower = (flightStatus || '').toLowerCase();
  if (statusLower === 'emergency') {
    factors.push({ label: 'Emergency Mission State', weight: 45, category: 'flight' })
  } else if (statusLower === 'diverted') {
    factors.push({ label: 'Diverted Mission State', weight: 35, category: 'flight' })
  } else if (statusLower === 'cancelled') {
    factors.push({ label: 'Cancelled Mission Context', weight: 30, category: 'flight' })
  } else if (statusLower === 'unknown') {
    factors.push({ label: 'Unknown Mission Data', weight: 18, category: 'flight' })
  } else if (statusLower === 'delayed') {
    factors.push({ label: 'Delayed Mission Context', weight: 15, category: 'flight' })
  } else if (statusLower === 'actual' || statusLower === 'landed' || statusLower === 'completed') {
    factors.push({ label: 'Historical Data Refreshness', weight: 5, category: 'confidence' })
  } else if (statusLower) {
    factors.push({ label: 'Active Mission Baseline', weight: 3, category: 'flight' })
  } else {
    console.warn("Missing flight status");
    factors.push({ label: 'Data confidence: Status', weight: 8, category: 'confidence' })
  }

  // 9. Airport Complexity (Baseline: +2)
  const acLower = (airportComplexity || '').toLowerCase();
  if (acLower === 'high') {
    factors.push({ label: 'High Complexity Airfield', weight: 8, category: 'airport' })
  } else if (acLower === 'medium') {
    factors.push({ label: 'Moderate Complexity Airfield', weight: 5, category: 'airport' })
  } else if (acLower === 'low') {
    factors.push({ label: 'Low Complexity Baseline', weight: 2, category: 'airport' })
  } else {
    console.warn("Missing airport complexity");
    factors.push({ label: 'Data confidence: Complexity', weight: 10, category: 'confidence' })
  }

  // 10. COMPOUNDING RISKS
  if (runwayLower === 'wet' && windLower === 'strong') {
    factors.push({ label: 'Wet Runway + Strong Wind Impact', weight: 14, category: 'compounding' })
    compoundingEvents.push('Wet Runway + Strong Wind (+14)')
  }
  if ((visLower === 'poor' || visLower === 'low') && trafficLower === 'high') {
    factors.push({ label: 'Poor Visibility + High Traffic Impact', weight: 14, category: 'compounding' })
    compoundingEvents.push('Poor Visibility + High Traffic (+14)')
  }
  if (weatherLower === 'storm' && workloadLower === 'high') {
    factors.push({ label: 'Storm + High Workload Impact', weight: 16, category: 'compounding' })
    compoundingEvents.push('Storm + High Workload (+16)')
  }
  if (acLower === 'high' && trafficLower === 'high') {
    factors.push({ label: 'High Complexity + High Traffic Impact', weight: 12, category: 'compounding' })
    compoundingEvents.push('High Complexity Airport + High Traffic (+12)')
  }
  if ((aircraftLower === 'abnormal' || aircraftLower === 'major issue') && windLower === 'strong') {
    factors.push({ label: 'Aircraft Issue + Strong Wind Impact', weight: 12, category: 'compounding' })
    compoundingEvents.push('Aircraft Issue + Strong Wind (+12)')
  }
  
  const unknownCount = factors.filter(f => f.category === 'confidence').length;
  if (unknownCount >= 2) {
    factors.push({ label: 'Multiple Data Uncertainty Impact', weight: 10, category: 'compounding' })
    compoundingEvents.push('2+ Unknown Data Fields (+10)')
  }

  // Calculate final score
  score = factors.reduce((sum, f) => sum + f.weight, 0)
  score = Math.min(Math.max(score, 0), 100)

  // Decision Thresholds:
  // 0–30 = GO
  // 31–60 = CAUTION
  // 61–100 = NO-GO
  let decision: RiskResult['decision'] = 'GO'
  let level: RiskResult['level'] = 'Low'

  if (score > 60) {
    decision = 'NO-GO'
    level = 'Critical'
  } else if (score > 30) {
    decision = 'CAUTION'
    level = 'Medium'
  } else if (score > 20) {
    level = 'Medium'
  }

  // Breakdown for UI
  const riskBreakdown: Record<string, number> = {
    runway: 0, traffic: 0, workload: 0, aircraft: 0, visibility: 0, wind: 0, weather: 0, airport: 0, flight: 0, compounding: 0, confidence: 0
  }
  factors.forEach(f => {
    riskBreakdown[f.category] = (riskBreakdown[f.category] || 0) + f.weight
  })

  // FORCE 3 RISKS ALWAYS
  let sortedFactors = [...factors].sort((a, b) => b.weight - a.weight);
  let topRisks = sortedFactors.slice(0, 3).map(f => f.label);
  
  while (topRisks.length < 3) {
    const fallbacks = ['Data Confidence Limitation', 'Airport Complexity Load', 'Traffic Monitoring'];
    const nextFallback = fallbacks.find(f => !topRisks.includes(f)) || 'Operational Baseline';
    topRisks.push(nextFallback);
  }

  return {
    score,
    level,
    decision,
    decisionReason: factors.length > 0 ? `Decision driven by ${factors[0].label.toLowerCase()}.` : 'Standard parameters.',
    topRisks,
    riskBreakdown,
    recommendations: ["Maintain stabilized approach criteria.", "Monitor environmental trends."],
    summary: `Risk assessment for current mission indicates a ${decision} profile (Score: ${score}).`,
    explanation: `Calculated safety synthesis based on mission telemetry. Decision: ${decision}.`,
    confidence: 'High',
    compoundingEvents,
    dataSources
  }
}