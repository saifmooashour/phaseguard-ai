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
 * Implements weighted scoring with compounding logic.
 */
export function calculateRisk(params: RiskParams): RiskResult {
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
    dataSources = {}
  } = params

  // 1. Weather (Baseline: 1)
  const weatherLower = (weatherCondition || '').toLowerCase()
  if (weatherLower.includes('storm') || weatherLower.includes('thunderstorm') || weatherLower.includes('severe')) {
    factors.push({ label: 'Severe Weather (Storm)', weight: 35, category: 'weather' })
  } else if (weatherLower.includes('rain') || weatherLower.includes('snow')) {
    factors.push({ label: 'Adverse Weather (Rain/Snow)', weight: 15, category: 'weather' })
  } else if (weatherLower === 'cloudy' || weatherLower === 'overcast' || weatherLower === 'reduced') {
    factors.push({ label: 'Reduced Sky Condition', weight: 5, category: 'weather' })
  } else if (weatherLower === 'clear') {
    factors.push({ label: 'Clear Weather Baseline', weight: 1, category: 'weather' })
  } else if (!weatherCondition) {
    factors.push({ label: 'Missing Weather Data', weight: 12, category: 'confidence' })
  } else {
    factors.push({ label: 'Weather: Standard', weight: 2, category: 'weather' })
  }

  // 2. Traffic (Baseline: 1)
  const trafficLower = (traffic || '').toLowerCase()
  if (trafficLower === 'high') {
    factors.push({ label: 'High Traffic Density', weight: 25, category: 'traffic' })
  } else if (trafficLower === 'medium') {
    factors.push({ label: 'Moderate Traffic', weight: 10, category: 'traffic' })
  } else if (trafficLower === 'low') {
    factors.push({ label: 'Low Traffic Baseline', weight: 1, category: 'traffic' })
  } else if (!traffic) {
    factors.push({ label: 'Missing Traffic Data', weight: 10, category: 'confidence' })
  } else {
    factors.push({ label: 'Traffic: Standard', weight: 2, category: 'traffic' })
  }

  // 3. Runway (Baseline: 1)
  const runwayLower = (runway || '').toLowerCase()
  if (runwayLower === 'contaminated' || runwayLower === 'icy' || runwayLower === 'snow') {
    factors.push({ label: 'Contaminated Runway Surface', weight: 35, category: 'runway' })
  } else if (runwayLower === 'wet') {
    factors.push({ label: 'Wet Runway Surface', weight: 15, category: 'runway' })
  } else if (runwayLower === 'dry') {
    factors.push({ label: 'Dry Runway Baseline', weight: 1, category: 'runway' })
  } else if (!runway) {
    factors.push({ label: 'Missing Runway Data', weight: 12, category: 'confidence' })
  } else {
    factors.push({ label: 'Runway: Standard', weight: 2, category: 'runway' })
  }

  // 4. Workload (Baseline: 1)
  const workloadLower = (workload || '').toLowerCase()
  if (workloadLower === 'high' || workloadLower === 'heavy') {
    factors.push({ label: 'High Crew Workload', weight: 25, category: 'workload' })
  } else if (workloadLower === 'medium' || workloadLower === 'moderate') {
    factors.push({ label: 'Elevated Workload', weight: 12, category: 'workload' })
  } else if (workloadLower === 'low') {
    factors.push({ label: 'Nominal Workload Baseline', weight: 1, category: 'workload' })
  } else if (!workload) {
    factors.push({ label: 'Missing Workload Data', weight: 10, category: 'confidence' })
  } else {
    factors.push({ label: 'Workload: Standard', weight: 2, category: 'workload' })
  }

  // 5. Aircraft (Baseline: 1)
  const aircraftLower = (aircraft || '').toLowerCase()
  if (aircraftLower === 'abnormal' || aircraftLower === 'major issue' || aircraftLower === 'critical') {
    factors.push({ label: 'Major Aircraft System Issue', weight: 45, category: 'aircraft' })
  } else if (aircraftLower === 'minor issue' || aircraftLower === 'caution') {
    factors.push({ label: 'Minor Aircraft Alert', weight: 15, category: 'aircraft' })
  } else if (aircraftLower === 'normal') {
    factors.push({ label: 'Nominal System Baseline', weight: 1, category: 'aircraft' })
  } else if (!aircraft) {
    factors.push({ label: 'Missing Aircraft Data', weight: 15, category: 'confidence' })
  } else {
    factors.push({ label: 'Aircraft: Standard', weight: 2, category: 'aircraft' })
  }

  // 6. Visibility (Baseline: 1)
  const visLower = (visibilityCategory || '').toLowerCase()
  if (visLower === 'poor' || visLower === 'low' || visLower === 'ifr') {
    factors.push({ label: 'Poor Visibility (IFR)', weight: 25, category: 'visibility' })
  } else if (visLower === 'moderate' || visLower === 'reduced' || visLower === 'mvfr') {
    factors.push({ label: 'Moderate Visibility', weight: 12, category: 'visibility' })
  } else if (visLower === 'good' || visLower === 'vfr') {
    factors.push({ label: 'Good Visibility Baseline', weight: 1, category: 'visibility' })
  } else if (!visibilityCategory) {
    factors.push({ label: 'Missing Visibility Data', weight: 10, category: 'confidence' })
  } else {
    factors.push({ label: 'Visibility: Standard', weight: 2, category: 'visibility' })
  }

  // 7. Wind (Baseline: 1)
  const windLower = (windCategory || '').toLowerCase()
  if (windLower === 'strong' || windLower === 'high' || windLower === 'gusting') {
    factors.push({ label: 'Strong Crosswind/Shear', weight: 25, category: 'wind' })
  } else if (windLower === 'moderate') {
    factors.push({ label: 'Moderate Wind', weight: 10, category: 'wind' })
  } else if (windLower === 'calm' || windLower === 'light') {
    factors.push({ label: 'Calm Wind Baseline', weight: 1, category: 'wind' })
  } else if (!windCategory) {
    factors.push({ label: 'Missing Wind Data', weight: 10, category: 'confidence' })
  } else {
    factors.push({ label: 'Wind: Standard', weight: 2, category: 'wind' })
  }

  // 8. Flight Status (Baseline: 1)
  const statusLower = (flightStatus || '').toLowerCase();
  if (statusLower === 'emergency') {
    factors.push({ label: 'Emergency Mission State', weight: 60, category: 'flight' })
  } else if (statusLower === 'diverted' || statusLower === 'diversion') {
    factors.push({ label: 'Diverted Mission State', weight: 35, category: 'flight' })
  } else if (statusLower === 'cancelled') {
    factors.push({ label: 'Cancelled Mission Context', weight: 30, category: 'flight' })
  } else if (statusLower === 'delayed') {
    factors.push({ label: 'Delayed Mission Context', weight: 12, category: 'flight' })
  } else if (statusLower === 'scheduled' || statusLower === 'on time' || statusLower === 'active') {
    factors.push({ label: 'Active Mission Baseline', weight: 1, category: 'flight' })
  } else if (!flightStatus) {
    factors.push({ label: 'Missing Flight Status', weight: 8, category: 'confidence' })
  } else {
    factors.push({ label: 'Flight: Standard', weight: 2, category: 'flight' })
  }

  // 9. Airport Complexity (Baseline: 1)
  const acLower = (airportComplexity || '').toLowerCase();
  if (acLower === 'high') {
    factors.push({ label: 'High Complexity Airfield', weight: 15, category: 'airport' })
  } else if (acLower === 'medium') {
    factors.push({ label: 'Moderate Complexity Airfield', weight: 8, category: 'airport' })
  } else if (acLower === 'low') {
    factors.push({ label: 'Low Complexity Baseline', weight: 1, category: 'airport' })
  } else if (!airportComplexity) {
    factors.push({ label: 'Missing Airport Data', weight: 8, category: 'confidence' })
  } else {
    factors.push({ label: 'Airport: Standard', weight: 2, category: 'airport' })
  }

  // 10. COMPOUNDING RISKS
  // Wet/Contaminated Runway + Strong Wind
  if ((runwayLower === 'wet' || runwayLower === 'contaminated') && (windLower === 'strong' || windLower === 'high')) {
    factors.push({ label: 'Compounding: Surface & Wind', weight: 20, category: 'compounding' })
    compoundingEvents.push('Adverse Surface + Strong Wind (+20)')
  }
  // Poor Visibility + High Traffic
  if ((visLower === 'poor' || visLower === 'low') && (trafficLower === 'high')) {
    factors.push({ label: 'Compounding: Low Vis & High Traffic', weight: 18, category: 'compounding' })
    compoundingEvents.push('Low Visibility + High Traffic (+18)')
  }
  // Major Aircraft Issue + Severe Weather
  if ((aircraftLower === 'abnormal' || aircraftLower === 'major issue') && (weatherLower.includes('storm'))) {
    factors.push({ label: 'Compounding: System Fail & Severe Weather', weight: 30, category: 'compounding' })
    compoundingEvents.push('System Issue + Storm (+30)')
  }
  // High Workload + High Traffic + High Complexity
  if (workloadLower === 'high' && trafficLower === 'high' && acLower === 'high') {
    factors.push({ label: 'Compounding: Operational Saturation', weight: 25, category: 'compounding' })
    compoundingEvents.push('Workload + Traffic + Complexity Saturation (+25)')
  }
  // Missing data penalty
  const confidenceFactors = factors.filter(f => f.category === 'confidence');
  if (confidenceFactors.length >= 3) {
    factors.push({ label: 'Compounding: High Data Uncertainty', weight: 15, category: 'compounding' })
    compoundingEvents.push('Critical Data Gaps (3+) (+15)')
  }

  // Calculate final score
  let score = factors.reduce((sum, f) => sum + f.weight, 0)
  score = Math.min(Math.max(Math.round(score), 0), 100)

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
    level = 'High'
  } else {
    decision = 'GO'
    level = score > 15 ? 'Medium' : 'Low'
  }

  // Breakdown for UI
  const riskBreakdown: Record<string, number> = {
    runway: 0, traffic: 0, workload: 0, aircraft: 0, visibility: 0, wind: 0, weather: 0, airport: 0, flight: 0, compounding: 0, confidence: 0
  }
  factors.forEach(f => {
    riskBreakdown[f.category] = (riskBreakdown[f.category] || 0) + f.weight
  })

  // Ensure top 3 risks
  let sortedFactors = [...factors].sort((a, b) => b.weight - a.weight);
  let topRisks = sortedFactors.slice(0, 3).map(f => f.label);
  
  while (topRisks.length < 3) {
    const fallbacks = ['Baseline Operations', 'Continuous Monitoring', 'Environmental Assessment'];
    const nextFallback = fallbacks.find(f => !topRisks.includes(f)) || 'Operational Readiness';
    topRisks.push(nextFallback);
  }

  return {
    score,
    level,
    decision,
    decisionReason: factors.length > 0 ? `Decision driven by ${sortedFactors[0].label.toLowerCase()}.` : 'Nominal operational parameters.',
    topRisks,
    riskBreakdown,
    recommendations: generateRecommendations(decision, sortedFactors),
    summary: `Mission status: ${decision}. Calculated safety score is ${score}/100.`,
    explanation: `Dynamic evaluation based on ${factors.length} active risk vectors. Primary factor: ${sortedFactors[0]?.label || 'Standard'}.`,
    confidence: confidenceFactors.length > 2 ? 'Low' : (confidenceFactors.length > 0 ? 'Medium' : 'High'),
    compoundingEvents,
    dataSources
  }
}

function generateRecommendations(decision: string, factors: RiskFactor[]): string[] {
  const recs: string[] = []
  if (decision === 'NO-GO') {
    recs.push("Immediate flight suspension recommended.")
    recs.push("Initiate alternative mission planning.")
  } else if (decision === 'CAUTION') {
    recs.push("Heightened situational awareness required.")
    recs.push("Review emergency procedures for primary risk factors.")
  } else {
    recs.push("Proceed with standard operating procedures.")
    recs.push("Continue routine environmental monitoring.")
  }
  
  // Add factor-specific rec
  if (factors[0]?.category === 'weather') recs.push("Monitor TAF/METAR updates closely.")
  if (factors[0]?.category === 'aircraft') recs.push("Coordinate with maintenance for system verification.")
  
  return recs.slice(0, 3)
}