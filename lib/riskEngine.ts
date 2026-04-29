import { RunwayLengthCategory, AirportComplexity } from './airportData'

export interface RiskParams {
  runway: string
  traffic: string
  workload: string
  aircraft: string
  visibilityCategory: string
  windCategory: string
  weatherCondition: string
  runwayLengthCategory: RunwayLengthCategory
  airportComplexity: AirportComplexity
  flightStatus?: string
  dataSources?: Record<string, string>
}

export interface RiskFactor {
  label: string
  weight: number
  category: 'runway' | 'traffic' | 'workload' | 'aircraft' | 'visibility' | 'wind' | 'weather' | 'airport' | 'flight'
}

export interface RiskResult {
  score: number
  level: 'Low' | 'Medium' | 'High' | 'Critical'
  decision: 'GO' | 'CAUTION' | 'HOLD' | 'DIVERT'
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

export function calculateRisk(params: RiskParams): RiskResult {
  let score = 0
  const factors: RiskFactor[] = []
  const recommendations: string[] = []
  const compoundingEvents: string[] = []

  const {
    runway,
    traffic,
    workload,
    aircraft,
    visibilityCategory,
    windCategory,
    weatherCondition,
    runwayLengthCategory,
    airportComplexity,
    flightStatus,
    dataSources = {}
  } = params

  // Runway
  if (runway === 'Wet') {
    factors.push({ label: 'Wet runway', weight: 12, category: 'runway' })
  } else if (runway === 'Contaminated') {
    factors.push({ label: 'Contaminated runway', weight: 25, category: 'runway' })
  }

  // Traffic
  if (traffic === 'Medium') {
    factors.push({ label: 'Medium traffic', weight: 8, category: 'traffic' })
  } else if (traffic === 'High') {
    factors.push({ label: 'High traffic', weight: 16, category: 'traffic' })
  }

  // Workload
  if (workload === 'Medium') {
    factors.push({ label: 'Medium workload', weight: 8, category: 'workload' })
  } else if (workload === 'High') {
    factors.push({ label: 'High workload', weight: 16, category: 'workload' })
  }

  // Aircraft
  if (aircraft === 'Minor Issue') {
    factors.push({ label: 'Aircraft minor issue', weight: 12, category: 'aircraft' })
  } else if (aircraft === 'Major Issue') {
    factors.push({ label: 'Aircraft major issue', weight: 30, category: 'aircraft' })
  }

  // Visibility
  if (visibilityCategory === 'Reduced') {
    factors.push({ label: 'Reduced visibility', weight: 8, category: 'visibility' })
  } else if (visibilityCategory === 'Low') {
    factors.push({ label: 'Low visibility', weight: 18, category: 'visibility' })
  }

  // Wind
  if (windCategory === 'Moderate') {
    factors.push({ label: 'Moderate wind', weight: 8, category: 'wind' })
  } else if (windCategory === 'Strong') {
    factors.push({ label: 'Strong wind', weight: 18, category: 'wind' })
  }

  // Weather
  if (weatherCondition === 'Rain') {
    factors.push({ label: 'Rain', weight: 10, category: 'weather' })
  } else if (weatherCondition === 'Fog') {
    factors.push({ label: 'Fog', weight: 20, category: 'weather' })
  } else if (weatherCondition === 'Snow') {
    factors.push({ label: 'Snow', weight: 20, category: 'weather' })
  } else if (weatherCondition === 'Storm') {
    factors.push({ label: 'Storm', weight: 25, category: 'weather' })
  }

  // Airport Complexity
  if (airportComplexity === 'Medium') {
    factors.push({ label: 'Medium airport complexity', weight: 5, category: 'airport' })
  } else if (airportComplexity === 'High') {
    factors.push({ label: 'High airport complexity', weight: 10, category: 'airport' })
  }

  // Runway Length
  if (runwayLengthCategory === 'Medium') {
    factors.push({ label: 'Medium runway length', weight: 5, category: 'airport' })
  } else if (runwayLengthCategory === 'Short') {
    factors.push({ label: 'Short runway length', weight: 12, category: 'airport' })
  }

  // Flight Status
  if (flightStatus) {
    const s = flightStatus.toLowerCase();
    if (s === 'delayed' || s === 'unknown') {
      factors.push({ label: 'Flight delayed/unknown context', weight: 5, category: 'flight' })
    } else if (s === 'cancelled' || s === 'diverted') {
      factors.push({ label: 'Flight cancelled/diverted context', weight: 15, category: 'flight' })
    }
  }

  // Compounding Factors
  if ((runway === 'Wet' || runway === 'Contaminated') && windCategory === 'Strong') {
    factors.push({ label: 'Degraded runway + Strong wind', weight: 12, category: 'weather' })
    compoundingEvents.push('Degraded runway + Strong wind (+12)')
  }
  if (visibilityCategory === 'Low' && traffic === 'High') {
    factors.push({ label: 'Low visibility + High traffic', weight: 10, category: 'traffic' })
    compoundingEvents.push('Low visibility + High traffic (+10)')
  }
  if (workload === 'High' && weatherCondition === 'Storm') {
    factors.push({ label: 'High workload + Storm', weight: 12, category: 'workload' })
    compoundingEvents.push('High workload + Storm (+12)')
  }
  if (runwayLengthCategory === 'Short' && (runway === 'Wet' || runway === 'Contaminated')) {
    factors.push({ label: 'Short runway + Degraded runway', weight: 15, category: 'runway' })
    compoundingEvents.push('Short runway + Degraded runway (+15)')
  }
  if (airportComplexity === 'High' && visibilityCategory === 'Low') {
    factors.push({ label: 'High complexity + Low visibility', weight: 8, category: 'airport' })
    compoundingEvents.push('High complexity + Low visibility (+8)')
  }
  if ((aircraft === 'Minor Issue' || aircraft === 'Major Issue') && (weatherCondition === 'Storm' || windCategory === 'Strong')) {
    factors.push({ label: 'Aircraft issue + Severe weather', weight: 15, category: 'aircraft' })
    compoundingEvents.push('Aircraft issue + Severe weather (+15)')
  }
  if (weatherCondition === 'Rain' && visibilityCategory === 'Reduced') {
    factors.push({ label: 'Rain + Reduced visibility', weight: 6, category: 'weather' })
    compoundingEvents.push('Rain + Reduced visibility (+6)')
  }
  if (runway === 'Contaminated' && visibilityCategory === 'Low') {
    factors.push({ label: 'Contaminated runway + Low visibility', weight: 10, category: 'runway' })
    compoundingEvents.push('Contaminated runway + Low visibility (+10)')
  }

  // Aggregate breakdown
  const riskBreakdown: Record<string, number> = {
    runway: 0,
    traffic: 0,
    workload: 0,
    aircraft: 0,
    visibility: 0,
    wind: 0,
    weather: 0,
    airport: 0,
    flight: 0,
  }

  factors.forEach(f => {
    riskBreakdown[f.category] = (riskBreakdown[f.category] || 0) + f.weight
    score += f.weight
  })

  // Recommendations based on highest factors
  const topRiskFactors = [...factors].sort((a, b) => b.weight - a.weight)
  const highestCategories = new Set(topRiskFactors.slice(0, 3).map(f => f.category))

  if (highestCategories.has('wind')) {
    recommendations.push('Confirm crosswind limits and stabilize approach early.')
  }
  if (highestCategories.has('runway')) {
    recommendations.push('Recalculate landing distance and braking action.')
  }
  if (highestCategories.has('visibility')) {
    recommendations.push('Review minima and missed approach plan.')
  }
  if (highestCategories.has('traffic')) {
    recommendations.push('Coordinate early with ATC.')
  }
  if (highestCategories.has('workload')) {
    recommendations.push('Reduce cockpit task saturation.')
  }
  if (highestCategories.has('aircraft')) {
    recommendations.push('Consider holding or diversion depending on severity.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue standard approach monitoring.')
    recommendations.push('Maintain sterile cockpit.')
  }

  score = Math.min(Math.max(score, 0), 100)

  // Decision Thresholds:
  // 0–25 = GO
  // 26–50 = CAUTION
  // 51–75 = HOLD
  // 76–100 = DIVERT
  let decision: RiskResult['decision'] = 'GO'
  let level: RiskResult['level'] = 'Low'

  if (score >= 76) {
    decision = 'DIVERT'
    level = 'Critical'
  } else if (score >= 51) {
    decision = 'HOLD'
    level = 'High'
  } else if (score >= 26) {
    decision = 'CAUTION'
    level = 'Medium'
  }

  const topRisks = topRiskFactors.length > 0
    ? topRiskFactors.slice(0, 3).map((f) => f.label)
    : ['Baseline operational risk only. No elevated hazards detected.']

  let decisionReason = 'All parameters are within acceptable standard operational limits.'
  if (topRiskFactors.length > 0) {
    decisionReason = `Decision driven by ${topRiskFactors[0].label.toLowerCase()}${topRiskFactors.length > 1 ? ` and ${topRiskFactors[1].label.toLowerCase()}` : ''}.`
  }

  // Evaluate Confidence and Summary adjustments
  let confidence: RiskResult['confidence'] = 'High'
  let confidenceMessage = ''
  
  if (dataSources) {
    const isLiveFlight = dataSources.flight === 'LIVE'
    const isLiveWeather = dataSources.weather === 'LIVE'
    const isLiveTraffic = dataSources.traffic === 'LIVE'
    
    let fallbackCount = 0
    if (!isLiveFlight) fallbackCount++
    if (!isLiveWeather) fallbackCount++
    if (!isLiveTraffic) fallbackCount++

    if (fallbackCount >= 2) {
      confidence = 'Low'
      confidenceMessage = 'Some operational inputs are manual or unavailable; analysis confidence reduced.'
    } else if (fallbackCount === 1) {
      confidence = 'Medium'
    }
  }

  let summary = 'Conditions are favorable for a standard approach.'
  if (level === 'Critical') summary = 'Severe hazards detected. Immediate diversion recommended.'
  else if (level === 'High') summary = 'Significant risks present. Heightened crew awareness and possible holding required.'
  else if (level === 'Medium') summary = 'Moderate challenges exist. Adhere strictly to SOPs and exercise caution.'
  else if (level === 'Low' && confidence !== 'Low') {
    summary = 'Low risk because live/current inputs do not indicate elevated hazards.'
  }

  let explanation = summary;
  if (confidence === 'Low' && confidenceMessage) {
    explanation += ` ${confidenceMessage}`;
  }

  return {
    score,
    level,
    decision,
    decisionReason,
    topRisks,
    riskBreakdown,
    recommendations: Array.from(new Set(recommendations)).slice(0, 5),
    summary,
    explanation,
    confidence,
    compoundingEvents,
    dataSources
  }
}