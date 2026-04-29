'use client'

import { useState, useEffect, useRef } from 'react'
import { calculateRisk, RiskResult } from '../lib/riskEngine'
import { fetchWeather, WeatherProfile } from '../lib/weatherApi'
import { getAirportProfile, getNearestAirports, searchAirports } from '../lib/airportData'
import LandingVisualization from '../components/LandingVisualization'


type ScenarioType = 'Normal' | 'Rainy' | 'High Traffic' | 'Storm' | 'Critical'

export default function Home() {
  const [airport, setAirport] = useState('KJFK')
  const [runway, setRunway] = useState('Dry')
  const [traffic, setTraffic] = useState('Low')
  const [workload, setWorkload] = useState('Low')
  const [aircraft, setAircraft] = useState('Normal')
  const [visibilityCategory, setVisibilityCategory] = useState('Good')
  const [windCategory, setWindCategory] = useState('Calm')
  const [weatherCondition, setWeatherCondition] = useState('Clear')

  const airportProfile = airport.length >= 3 ? getAirportProfile(airport) : null;
  const [weatherData, setWeatherData] = useState<WeatherProfile | null>(null)
  const [isFetchingWeather, setIsFetchingWeather] = useState(false)

  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<RiskResult | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [activeScenario, setActiveScenario] = useState<ScenarioType | null>(null)

  // Pilot Mode state (Deprecated but kept for stability)
  const [pilotMode, setPilotMode] = useState(false)

  // Voice Briefing state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)

  // Multi-Screen Navigation state
  const [appScreen, setAppScreen] = useState<'start' | 'setup' | 'dashboard' | 'briefing'>('start')

  // Guided Workflow state
  const [workflowMode, setWorkflowMode] = useState<'guided' | 'manual'>('guided')
  const [workflowStep, setWorkflowStep] = useState(1) // 1: Location, 2: Airport, 3: Flight, 4: Data
  const [nearestAirports, setNearestAirports] = useState<any[]>([])
  const [flightsState, setFlightsState] = useState<{ source: string, flights: any[], message: string } | null>(null)
  const [selectedFlight, setSelectedFlight] = useState<any | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isFetchingFlights, setIsFetchingFlights] = useState(false)
  const [flightType, setFlightType] = useState<'arrivals' | 'departures'>('arrivals')

  // Gemini Briefing state
  const [geminiBriefing, setGeminiBriefing] = useState<string | null>(null)
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false)



  // AI Risk Evaluator state
  const [aiRiskResult, setAiRiskResult] = useState<any | null>(null)
  const [isGeneratingAiRisk, setIsGeneratingAiRisk] = useState(false)

  // AI Scenario Video state
  const [videoResult, setVideoResult] = useState<{ source: string, operationName?: string, message: string, outputUri?: string, videoUrl?: string } | null>(null)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [isCheckingVideo, setIsCheckingVideo] = useState(false)

  // Cyber-Operational Exposure state
  const [cyberIndicator, setCyberIndicator] = useState<any | null>(null)
  const [isGeneratingCyber, setIsGeneratingCyber] = useState(false)

  // Dynamic Landing Risks state
  const [dynamicRisks, setDynamicRisks] = useState<{ risks: string[], source: string } | null>(null)
  const [isGeneratingTopRisks, setIsGeneratingTopRisks] = useState(false)

  // Google Maps State
  const mapRef = useRef<HTMLDivElement>(null);
  const [recentAssessments, setRecentAssessments] = useState<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!googleMapsApiKey || mapLoaded || mapError) return;
    if ((window as any).google && (window as any).google.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, [googleMapsApiKey, mapLoaded, mapError]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !airportProfile || appScreen !== 'dashboard') return;

    try {
      const map = new (window as any).google.maps.Map(mapRef.current, {
         center: { lat: airportProfile.latitude, lng: airportProfile.longitude },
         zoom: 11,
         mapTypeId: 'satellite',
         disableDefaultUI: true,
      });

      new (window as any).google.maps.Marker({
         position: { lat: airportProfile.latitude, lng: airportProfile.longitude },
         map,
         title: airportProfile.name,
         icon: {
           path: (window as any).google.maps.SymbolPath.CIRCLE,
           scale: 8,
           fillColor: "#14b8a6",
           fillOpacity: 1,
           strokeWeight: 2,
           strokeColor: "#ffffff"
         }
      });

      if (selectedFlight && selectedFlight.departureIata) {
         const depAirports = searchAirports(selectedFlight.departureIata);
         const depAirport = depAirports.length > 0 ? depAirports[0] : null;
         
         if (depAirport) {
            const path = [
               { lat: depAirport.latitude, lng: depAirport.longitude },
               { lat: airportProfile.latitude, lng: airportProfile.longitude }
            ];
            
            new (window as any).google.maps.Marker({
               position: path[0],
               map,
               title: depAirport.name,
               icon: {
                 path: (window as any).google.maps.SymbolPath.CIRCLE,
                 scale: 5,
                 fillColor: "#64748b",
                 fillOpacity: 1,
                 strokeWeight: 1,
                 strokeColor: "#ffffff"
               }
            });

            new (window as any).google.maps.Polyline({
               path,
               geodesic: true,
               strokeColor: '#06b6d4',
               strokeOpacity: 0.8,
               strokeWeight: 3,
               map
            });
            
            const bounds = new (window as any).google.maps.LatLngBounds();
            bounds.extend(path[0]);
            bounds.extend(path[1]);
            map.fitBounds(bounds);
         }
      }
    } catch (e) {
      console.error("Map rendering error", e);
    }
  }, [mapLoaded, airportProfile, selectedFlight, appScreen]);

  const getOperationalRecommendation = () => {
    return aiRiskResult && !aiRiskResult.error ? {
      primaryRecommendation: aiRiskResult.decision === 'CAUTION' ? 'PROCEED_WITH_CAUTION' : aiRiskResult.decision,
      alternativeRecommendation: aiRiskResult.decision === 'GO' ? 'Monitor conditions' : aiRiskResult.decision === 'CAUTION' ? 'Hold or Divert if conditions worsen' : 'Divert',
      operationalReasoning: aiRiskResult.topRisks || [],
      pilotActions: aiRiskResult.recommendations || [],
      dispatcherNotes: aiRiskResult.explanation ? [aiRiskResult.explanation] : [],
      missingDataWarnings: aiRiskResult.missingDataWarnings || []
    } : result ? {
      primaryRecommendation: result.decision === 'CAUTION' ? 'PROCEED_WITH_CAUTION' : result.decision,
      alternativeRecommendation: result.decision === 'GO' ? 'Monitor conditions' : result.decision === 'CAUTION' ? 'Hold or Divert if conditions worsen' : 'Divert',
      operationalReasoning: result.topRisks || [],
      pilotActions: result.recommendations || [],
      dispatcherNotes: [result.explanation || 'Rule-based analysis active.'],
      missingDataWarnings: []
    } : null;
  };

  useEffect(() => {
    if (appScreen === 'dashboard' && result) {
      if (!aiRiskResult && !isGeneratingAiRisk) {
        handleGenerateAiRisk();
      }
      if (!cyberIndicator && !isGeneratingCyber) {
        handleGenerateCyberIndicator();
      }
      if (!dynamicRisks && !isGeneratingTopRisks) {
        handleGenerateTopRisks();
      }
    }
  }, [appScreen, result]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.speechSynthesis) {
      setSpeechSupported(false)
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleSpeakBriefing = () => {
    if (!result || !speechSupported || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    let textToSpeak = "";
    if (appScreen === 'briefing' && geminiBriefing) {
      textToSpeak = geminiBriefing;
    } else {
      const opRec = getOperationalRecommendation();
      if (opRec) {
        const flightInfo = selectedFlight ? `Flight ${selectedFlight.flightNumber} to ${airport}.` : `Mission to ${airport}.`;
        const scoreInfo = `Risk Score: ${aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score}.`;
        const decisionText = opRec.primaryRecommendation.replace(/_/g, ' ');
        const hazards = (dynamicRisks?.risks || opRec.operationalReasoning).length > 0 ? `Top hazards: ${(dynamicRisks?.risks || opRec.operationalReasoning).slice(0, 3).join(', ')}.` : '';
        const actions = opRec.pilotActions.length > 0 ? `Recommended actions: ${opRec.pilotActions.slice(0, 2).join(', ')}.` : '';
        const explanation = opRec.dispatcherNotes.join(' ');
        textToSpeak = `Operational Recommendation: ${decisionText}. ${scoreInfo} ${flightInfo} ${hazards} ${actions} ${explanation}`;
      } else {
        textToSpeak = "Risk assessment unavailable.";
      }
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopBriefing = () => {
    if (!speechSupported || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleGenerateBriefing = async () => {
    if (!result) return;
    setIsGeneratingBriefing(true);
    setGeminiBriefing(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airport: airport,
          runway, traffic, workload, aircraft, visibilityCategory, windCategory, weatherCondition,
          aiRiskScore: aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : undefined,
          aiDecision: aiRiskResult && !aiRiskResult.error ? aiRiskResult.decision : undefined,
          aiConfidence: aiRiskResult && !aiRiskResult.error ? aiRiskResult.confidence : undefined,
          aiTopRisks: aiRiskResult && !aiRiskResult.error ? aiRiskResult.topRisks : undefined,
          aiRecommendations: aiRiskResult && !aiRiskResult.error ? aiRiskResult.recommendations : undefined,
          aiExplanation: aiRiskResult && !aiRiskResult.error ? aiRiskResult.explanation : undefined,
          factorScores: aiRiskResult && !aiRiskResult.error ? aiRiskResult.factorScores : undefined,
          missingDataWarnings: aiRiskResult && !aiRiskResult.error ? aiRiskResult.missingDataWarnings : undefined,
          score: (!aiRiskResult || aiRiskResult.error) ? result.score : undefined,
          level: (!aiRiskResult || aiRiskResult.error) ? result.level : undefined,
          decision: (!aiRiskResult || aiRiskResult.error) ? result.decision : undefined,
          topRisks: (!aiRiskResult || aiRiskResult.error) ? result.topRisks : undefined,
          recommendations: (!aiRiskResult || aiRiskResult.error) ? result.recommendations : undefined,
          flightNumber: selectedFlight?.flightNumber,
          airline: selectedFlight?.airline,
          departureIata: selectedFlight?.departureIata,
          arrivalIata: selectedFlight?.arrivalIata,
          status: selectedFlight?.status,
          scheduledTime: selectedFlight?.scheduledTime,
          estimatedTime: selectedFlight?.estimatedTime,
          flightAircraft: selectedFlight?.aircraft,
          aiRiskResult: aiRiskResult && !aiRiskResult.error ? aiRiskResult : undefined,
          operationalRecommendation: getOperationalRecommendation(),
          selectedFlight,
          selectedAirport: airportProfile,
          weatherData,
          trafficData: { trafficLevel: traffic },
          dataSources: aiRiskResult?._dataSources || result?.dataSources || {}
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Briefing API returned non-JSON response", err);
        throw new Error("Invalid JSON");
      }
      if (!res.ok) throw new Error(data?.error || 'Failed to generate briefing');
      setGeminiBriefing(data.briefing);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Briefing error", e);
      setGeminiBriefing("Gemini briefing unavailable. Local risk analysis remains available.");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const handleFetchWeather = async () => {
    if (!airportProfile) return;
    setIsFetchingWeather(true)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`/api/weather?icao=${airportProfile.icao}`, { signal: controller.signal })
      clearTimeout(timeoutId);
      const data = await res.json()
      setWeatherData(data)

      if (data.source === 'LIVE') {
        let visCat = 'Good';
        if (data.flightCategory === 'MVFR') visCat = 'Reduced';
        else if (data.flightCategory === 'IFR' || data.flightCategory === 'LIFR') visCat = 'Low';
        else if (data.visibility < 3) visCat = 'Low';
        else if (data.visibility <= 5) visCat = 'Reduced';

        let windCat = 'Calm';
        if (data.windSpeed >= 10 && data.windSpeed <= 20) windCat = 'Moderate';
        else if (data.windSpeed > 20) windCat = 'Strong';

        setVisibilityCategory(visCat);
        setWindCategory(windCat);
        if (data.weatherCondition) {
          setWeatherCondition(data.weatherCondition);
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('Failed to fetch weather', e)
    } finally {
      setIsFetchingWeather(false)
    }
  };

  const runAnalysisWithParams = async (params: any) => {
    setStarted(true)
    setResult(null)
    setGeminiBriefing(null)
    setAiRiskResult(null)
    setVideoResult(null)
    setDynamicRisks(null)

    const dataSources = {
      flight: selectedFlight ? (flightsState?.source || 'LIVE').toUpperCase() : 'NOT_CONNECTED',
      weather: weatherData ? weatherData.source.toUpperCase() : 'MANUAL',
      traffic: 'MANUAL', // Assuming traffic is manual unless a live API is integrated
      airport: 'LOCAL DATASET',
      manualOverride: 'ACTIVE'
    }

    const profile = getAirportProfile(params.airport)
    const safeProfile = profile || {
      runwayLengthCategory: 'Medium',
      complexity: 'Medium'
    }

    const riskResult = calculateRisk({
      runway: params.runway,
      traffic: params.traffic,
      workload: params.workload,
      aircraft: params.aircraft,
      visibilityCategory: params.visibilityCategory,
      windCategory: params.windCategory,
      weatherCondition: params.weatherCondition,
      runwayLengthCategory: safeProfile.runwayLengthCategory as any,
      airportComplexity: safeProfile.complexity as any,
      flightStatus: params.flightStatus,
      dataSources
    })

    setResult(riskResult)

    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSaving(false)
    setCyberIndicator(null)
    setAppScreen('dashboard')
  }

  const loadScenario = (type: ScenarioType) => {
    setActiveScenario(type)
    setWeatherData(null)

    let p = { airport: 'KJFK', runway: 'Dry', traffic: 'Low', workload: 'Low', aircraft: 'Normal', visibilityCategory: 'Good', windCategory: 'Calm', weatherCondition: 'Clear' }

    switch (type) {
      case 'Normal':
        p = { airport: 'KJFK', runway: 'Dry', traffic: 'Low', workload: 'Low', aircraft: 'Normal', visibilityCategory: 'Good', windCategory: 'Calm', weatherCondition: 'Clear' }
        break;
      case 'Rainy':
        p = { airport: 'EGLL', runway: 'Wet', traffic: 'Medium', workload: 'Medium', aircraft: 'Normal', visibilityCategory: 'Reduced', windCategory: 'Moderate', weatherCondition: 'Rain' }
        break;
      case 'High Traffic':
        p = { airport: 'OMDB', runway: 'Dry', traffic: 'High', workload: 'High', aircraft: 'Normal', visibilityCategory: 'Good', windCategory: 'Calm', weatherCondition: 'Clear' }
        break;
      case 'Storm':
        p = { airport: 'OJAI', runway: 'Wet', traffic: 'Medium', workload: 'High', aircraft: 'Normal', visibilityCategory: 'Low', windCategory: 'Strong', weatherCondition: 'Storm' }
        break;
      case 'Critical':
        p = { airport: 'EGLC', runway: 'Contaminated', traffic: 'High', workload: 'High', aircraft: 'Minor Issue', visibilityCategory: 'Low', windCategory: 'Strong', weatherCondition: 'Storm' }
        break;
    }

    setAirport(p.airport)
    setRunway(p.runway)
    setTraffic(p.traffic)
    setWorkload(p.workload)
    setAircraft(p.aircraft)
    setVisibilityCategory(p.visibilityCategory)
    setWindCategory(p.windCategory)
    setWeatherCondition(p.weatherCondition)

    runAnalysisWithParams(p)
  }

  const handleStartAnalysis = async () => {
    console.log("Risk analysis requested");
    runAnalysisWithParams({
      airport, runway, traffic, workload, aircraft, visibilityCategory, windCategory, weatherCondition, flightStatus: selectedFlight?.status
    })
  }

  const handleStartNewMission = () => {
    setResult(null);
    setGeminiBriefing(null);
    setAiRiskResult(null);
    setVideoResult(null);
    setWorkflowStep(1);
    setAppScreen('setup');
  }


  const handleGenerateAiRisk = async () => {
    if (!result) return;
    setIsGeneratingAiRisk(true);
    try {
      let currentWeatherData = weatherData;
      if (!currentWeatherData && airportProfile) {
        const weatherCtrl = new AbortController();
        const weatherTimeout = setTimeout(() => weatherCtrl.abort(), 8000);
        try {
          const res = await fetch(`/api/weather?icao=${airportProfile.icao}`, { signal: weatherCtrl.signal });
          clearTimeout(weatherTimeout);
          currentWeatherData = await res.json();
          setWeatherData(currentWeatherData);

          if (currentWeatherData?.source === 'LIVE') {
            let visCat = 'Good';
            if (currentWeatherData.flightCategory === 'MVFR') visCat = 'Reduced';
            else if (currentWeatherData.flightCategory === 'IFR' || currentWeatherData.flightCategory === 'LIFR') visCat = 'Low';
            else if (Number(currentWeatherData.visibility) < 3) visCat = 'Low';
            else if (Number(currentWeatherData.visibility) <= 5) visCat = 'Reduced';

            let windCat = 'Calm';
            const speed = Number(currentWeatherData.windSpeed);
            if (speed >= 10 && speed <= 20) windCat = 'Moderate';
            else if (speed > 20) windCat = 'Strong';

            setVisibilityCategory(visCat);
            setWindCategory(windCat);
            if (currentWeatherData.weatherCondition) {
              setWeatherCondition(currentWeatherData.weatherCondition);
            }
          }
        } catch (e) {
          clearTimeout(weatherTimeout);
          console.error('Failed to auto-fetch weather for AI payload', e);
        }
      }

      let currentTrafficData = null;
      if (airportProfile) {
        const trafficCtrl = new AbortController();
        const trafficTimeout = setTimeout(() => trafficCtrl.abort(), 8000);
        try {
          const res = await fetch(`/api/traffic?icao=${airportProfile.icao}`, { signal: trafficCtrl.signal });
          clearTimeout(trafficTimeout);
          currentTrafficData = await res.json();
          if (currentTrafficData && currentTrafficData.trafficLevel !== 'Manual') {
            setTraffic(currentTrafficData.trafficLevel);
          }
        } catch (e) {
          clearTimeout(trafficTimeout);
          console.error('Failed to auto-fetch traffic for AI payload', e);
        }
      }

      const isLiveWeather = currentWeatherData && currentWeatherData.source === 'LIVE';
      const isLiveFlight = selectedFlight && flightsState?.source === 'LIVE';
      const isLiveTraffic = currentTrafficData && currentTrafficData.source === 'LIVE';

      const dataSources = {
        flight: isLiveFlight ? 'LIVE' : (selectedFlight ? 'CACHE' : 'NOT_CONNECTED'),
        weather: isLiveWeather ? 'LIVE' : (currentWeatherData ? 'FALLBACK' : 'MANUAL'),
        traffic: isLiveTraffic ? 'LIVE' : 'MANUAL',
        airport: 'LOCAL DATASET',
        manualOverride: (runway !== 'Dry' || workload !== 'Low' || aircraft !== 'Normal' || !isLiveWeather || !isLiveTraffic) ? 'ACTIVE' : 'INACTIVE'
      };

      const payload = {
        airport: airportProfile || { icao: airport },
        flight: selectedFlight || { status: 'Unknown' },
        weather: currentWeatherData || { source: 'MANUAL', rawMetar: 'N/A', visibility: visibilityCategory, windSpeed: windCategory, weatherCondition },
        traffic: currentTrafficData || { source: 'MANUAL', trafficLevel: traffic },
        manualOperationalInputs: { runwayCondition: runway, workload, aircraftCondition: aircraft },
        dataSources
      };

      const riskCtrl = new AbortController();
      const riskTimeout = setTimeout(() => riskCtrl.abort(), 30000);
      try {
        const res = await fetch('/api/ai-risk-evaluator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: riskCtrl.signal
        });
        clearTimeout(riskTimeout);

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (err) {
          console.error("AI Risk API returned non-JSON response", err);
          throw new Error("Invalid JSON");
        }
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to generate AI Risk');
        }
        setAiRiskResult({ ...data, _dataSources: dataSources });
      } catch (e: any) {
        clearTimeout(riskTimeout);
        if (e.name === 'AbortError') {
          console.log("AI Risk Assessment timed out. Falling back to local rules.");
        } else {
          console.error("AI Risk Evaluator Error", e);
        }
        setAiRiskResult({ error: true });
      }
    } catch (e) {
      console.error("AI Risk Assessment Error", e);
      setAiRiskResult({ error: true });
    } finally {
      setIsGeneratingAiRisk(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!result) return;
    setIsGeneratingVideo(true);
    setVideoResult(null);
    try {
      const res = await fetch('/api/scenario-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flight: selectedFlight,
          airport: airportProfile,
          weather: weatherData,
          aiRiskResult: aiRiskResult,
          operationalRecommendation: getOperationalRecommendation(),
          dataSources: aiRiskResult?._dataSources || result?.dataSources || {}
        })
      });
      const data = await res.json();
      setVideoResult(data);
    } catch (e) {
      console.error("Video Generation Error", e);
      setVideoResult({
        source: "UNAVAILABLE",
        message: "AI scenario video generation is not available in this project. Local Mission Replay remains active."
      });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleGenerateCyberIndicator = async () => {
    if (!result) return;
    setIsGeneratingCyber(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 sec timeout
    try {
      const payload = {
        airport: airportProfile || { icao: airport },
        weather: weatherData || { source: 'MANUAL', rawMetar: 'N/A', visibility: visibilityCategory, windSpeed: windCategory, weatherCondition },
        runwayCondition: runway,
        trafficLevel: traffic,
        crewWorkload: workload,
        aircraftStatus: aircraft,
        currentRiskScore: aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score,
        top3Risks: getTop3Risks()
      };

      const res = await fetch('/api/cyber-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Cyber API returned non-JSON response", err);
        throw new Error("Invalid JSON");
      }
      setCyberIndicator(data);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Cyber Evaluator Error", e);
      setCyberIndicator({ 
        score: 25, 
        level: 'Low', 
        summary: 'Fallback cyber assessment.', 
        actions: ["Monitor systems", "Verify communication"] 
      });
    } finally {
      setIsGeneratingCyber(false);
    }
  };

  const handleGenerateTopRisks = async () => {
    if (!result) return;
    setIsGeneratingTopRisks(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 sec timeout
    try {
      const payload = {
        airport: airportProfile || { icao: airport },
        weather: weatherData || { source: 'MANUAL', rawMetar: 'N/A', visibility: visibilityCategory, windSpeed: windCategory, weatherCondition },
        runwayCondition: runway,
        trafficLevel: traffic,
        crewWorkload: workload,
        aircraftStatus: aircraft,
        currentRiskScore: aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score,
        top3Risks: getTop3Risks()
      };

      const res = await fetch('/api/top-risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Top Risks API returned non-JSON response", err);
        throw new Error("Invalid JSON");
      }
      setDynamicRisks(data);
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        console.log("Top Risks evaluation timed out.");
      } else {
        console.error("Top Risks Error", e);
      }
      setDynamicRisks({ risks: getTop3Risks(), source: 'FALLBACK' });
    } finally {
      setIsGeneratingTopRisks(false);
    }
  };

  const handleCheckVideoStatus = async () => {
    if (!videoResult?.operationName) return;
    setIsCheckingVideo(true);
    try {
      const res = await fetch(`/api/scenario-video/status?operationName=${encodeURIComponent(videoResult.operationName)}`);
      const data = await res.json();
      
      setVideoResult(prev => prev ? {
        ...prev,
        source: data.source,
        message: data.message,
        outputUri: data.outputUri,
        videoUrl: data.videoUrl
      } : null);
    } catch (e) {
      console.error("Video Check Error", e);
    } finally {
      setIsCheckingVideo(false);
    }
  };

  const fetchRecentAssessments = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/assessments', { signal: controller.signal })
      clearTimeout(timeoutId);
      const data = await res.json()
      if (Array.isArray(data)) {
        setRecentAssessments(data)
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Fetch assessments error", e)
    }
  };

  useEffect(() => {
    fetchRecentAssessments()
  }, [])

  const handleSaveAssessment = async () => {
    const opRec = getOperationalRecommendation()
    const payload = {
      flight: selectedFlight || { flightNumber: 'MANUAL', airline: 'N/A' },
      airport: airportProfile || { icao: airport },
      aiRiskResult: aiRiskResult,
      operationalRecommendation: opRec,
      weatherData: weatherData,
      trafficData: { trafficLevel: traffic },
      dataSources: aiRiskResult?._dataSources || result?.dataSources || {},
      geminiBriefing: geminiBriefing
    }

    setIsSaving(true)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      clearTimeout(timeoutId);
      const data = await res.json()
      if (data.success) {
        fetchRecentAssessments()
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Save assessment error", e)
    } finally {
      setIsSaving(false)
    }
  }

  // --- Guided Workflow Functions ---
  const handleUseMyLocation = () => {
    console.log("Use My Location clicked")
    setIsLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported. Enter ICAO manually.");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log("Location success", latitude, longitude)
        const nearest = getNearestAirports(latitude, longitude, 5);
        console.log("Nearest airports", nearest)
        setNearestAirports(nearest);
        setIsLocating(false);
        setLocationError("Success: Nearest airports found.");
      },
      (error) => {
        console.error("Location error", error)
        setLocationError("Location permission denied. Enter ICAO manually.");
        setIsLocating(false);
      }
    );
  };

  const handleSelectAirport = (icao: string) => {
    console.log("Airport selected:", icao);
    setAirport(icao);
    setWorkflowStep(2);
  };

  const handleFetchFlights = async () => {
    setIsFetchingFlights(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`/api/flights?icao=${airport}&type=${flightType}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      setFlightsState(data);
    } catch (e) {
      clearTimeout(timeoutId);
      setFlightsState({ source: "ERROR", flights: [], message: "Failed to fetch flights." });
    } finally {
      setIsFetchingFlights(false);
    }
  };

  const handlePrepareMissionData = () => {
    console.log("Mission data prepared.");
    if (selectedFlight && selectedFlight.aircraft) {
      setAircraft(selectedFlight.aircraft.includes('Boeing') || selectedFlight.aircraft.includes('Airbus') ? 'Normal' : 'Normal');
    }
    if (airportProfile) {
      setRunway(airportProfile.runwaySurface === 'Asphalt' || airportProfile.runwaySurface === 'Concrete' ? 'Dry' : 'Wet');
    }
    setWorkflowStep(4);
  };

  const cyberExposure = cyberIndicator || {
    level: 'Low',
    score: 15,
    summary: "Estimating cyber-operational exposure...",
    actions: ["Standard operational monitoring"]
  };

  const getTop3Risks = () => {
    const risks: string[] = [];
    if (runway === 'Wet') risks.push("Wet runway may increase landing distance.");
    if (runway === 'Contaminated') risks.push("Contaminated runway poses severe braking action risk.");
    if (traffic === 'High') risks.push("High traffic reduces decision-making margin.");
    if (traffic === 'Medium') risks.push("Elevated traffic requires tighter approach spacing.");
    if (workload === 'High') risks.push("High crew workload increases the chance of missed cues.");
    if (workload === 'Medium') risks.push("Increased crew workload reduces task management reserves.");
    if (aircraft === 'Minor Issue') risks.push("Minor aircraft issue requires additional monitoring.");
    if (visibilityCategory === 'Low') risks.push("Low visibility may affect final approach stability.");
    if (visibilityCategory === 'Reduced') risks.push("Reduced visibility requires heightened visual awareness.");
    if (windCategory === 'Strong') risks.push("Strong winds increase dynamic handling difficulty.");
    if (windCategory === 'Moderate') risks.push("Moderate winds may induce minor approach turbulence.");
    if (weatherCondition === 'Storm') risks.push("Severe weather/storm conditions threaten microburst or shear events.");
    if (weatherCondition === 'Rain') risks.push("Active precipitation affects runway friction and visual tracking.");

    const defaultRisks = [
      "Maintain sterile cockpit procedures below 10,000 feet.",
      "Review missed approach and go-around procedures.",
      "Ensure stable approach criteria are continuously monitored.",
      "Monitor fuel reserves and potential holding delays.",
      "Cross-check navigation aids and landing performance data."
    ];

    while (risks.length < 3) {
      const nextDefault = defaultRisks.find(r => !risks.includes(r));
      if (nextDefault) {
        risks.push(nextDefault);
      } else {
        risks.push("Standard operational risks apply.");
      }
    }
    return risks.slice(0, 3);
  };

  const operationalRecommendation = getOperationalRecommendation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-cyan-500/30 relative overflow-hidden pb-20 flex flex-col">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes runway-anim {
          from { background-position: 0 0; }
          to { background-position: 0 100px; }
        }
        .animate-runway {
          background-image: linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.4) 50%);
          background-size: 100% 20px;
          animation: runway-anim 0.8s linear infinite;
        }
        @keyframes approach-anim {
          0% { transform: scale(0.6) translateY(-20px); opacity: 0; }
          30% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: scale(1.4) translateY(30px); opacity: 0; }
        }
        .animate-approach {
          animation: approach-anim 3.5s ease-in-out infinite;
        }
        @keyframes rain-anim {
          0% { background-position: 0 0; }
          100% { background-position: -20px 100px; }
        }
        .animate-rain {
          animation: rain-anim 0.4s linear infinite;
        }
        @keyframes snow-anim {
          0% { background-position: 0 0; }
          100% { background-position: 20px 100px; }
        }
        .animate-snow {
          animation: snow-anim 3s linear infinite;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        .rotate-x-60 {
          transform: rotateX(60deg);
        }
      `}} />

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col flex-grow w-full">

        {/* Global Navigation Bar */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-800/60 pb-6">
          <div className="inline-flex items-center space-x-2 bg-slate-900/80 border border-slate-700/50 rounded-full px-4 py-1.5 shadow-lg backdrop-blur-md">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">PhaseGuard AI</span>
          </div>

          {appScreen !== 'start' && (
            <div className="hidden sm:flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className={appScreen === 'setup' ? 'text-teal-400' : 'text-slate-500'}>Setup</span>
              <span className="text-slate-700">&rarr;</span>
              <span className={appScreen === 'dashboard' ? 'text-cyan-400' : 'text-slate-500'}>Dashboard</span>
              <span className="text-slate-700">&rarr;</span>
              <span className={appScreen === 'briefing' ? 'text-purple-400' : 'text-slate-500'}>Briefing</span>
            </div>
          )}
        </div>

        {/* SCREEN 1: START SCREEN */}
        {appScreen === 'start' && (
          <div className="flex flex-col items-center justify-center flex-grow py-12 text-center animate-in fade-in slide-in-from-bottom-4">
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-white mb-6">
              Landing Risk Intelligence
            </h1>
            <p className="text-slate-400 max-w-2xl text-lg sm:text-xl mb-12 leading-relaxed">
              Analyze airport, weather, traffic, aircraft, and workload conditions to support landing risk decisions.
            </p>
            <button
              onClick={handleStartNewMission}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(8,145,178,0.4)] transition-all transform hover:scale-105"
            >
              Start New Analysis
            </button>

            <div className="mt-16 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl max-w-2xl w-full">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex justify-center items-center">
                <svg className="w-4 h-4 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                Quick Scenario Lab
              </h3>
              <div className="flex flex-wrap gap-3 justify-center">
                {(['Normal', 'Rainy', 'High Traffic', 'Storm', 'Critical'] as ScenarioType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => { loadScenario(type); setAppScreen('dashboard'); }}
                    className="text-xs px-4 py-2 rounded-lg font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {recentAssessments.length > 0 && (
              <div className="mt-12 w-full max-w-4xl">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Recent Assessments
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {recentAssessments.map((ra: any) => (
                    <div key={ra.id} className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-4 rounded-xl flex flex-col hover:border-teal-500/30 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs font-black text-white">{ra.flight?.flightNumber || 'MANUAL'}</div>
                        <div className={`text-[8px] font-bold px-1 rounded ${ra.aiRiskResult?.decision === 'DIVERT' ? 'bg-red-500/20 text-red-400' : ra.aiRiskResult?.decision === 'HOLD' ? 'bg-orange-500/20 text-orange-400' : ra.aiRiskResult?.decision === 'CAUTION' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                          {ra.aiRiskResult?.overallRiskScore || ra.aiRiskResult?.score || ra.result?.score || 'N/A'}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{ra.airport?.icao}</div>
                      <div className="text-[9px] text-slate-500 mb-3 line-clamp-2 italic">&quot;{ra.aiRiskResult?.decision || ra.operationalRecommendation?.primaryRecommendation || 'Analyzed'}&quot;</div>
                      <div className="mt-auto text-[8px] text-slate-600 font-mono">{new Date(ra.createdAt).toLocaleDateString()} {new Date(ra.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2: SETUP SCREEN */}
        {appScreen === 'setup' && (
          <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white tracking-tight">Mission Setup</h2>
              <button onClick={() => setAppScreen('start')} className="text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold">Cancel</button>
            </div>

            {/* Guided Workflow UI */}
            <div className="mb-8 bg-slate-900/60 backdrop-blur-xl border border-teal-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(20,184,166,0.1)]">
              <div className="flex items-center justify-between mb-6 border-b border-slate-700/50 pb-4">
                <div className="flex items-center">
                  <h2 className="text-lg font-black text-teal-400 uppercase tracking-widest mr-4">Guided Workflow</h2>
                </div>
                <div className="flex space-x-2 text-xs font-mono">
                  {[1, 2, 3, 4].map(step => (
                    <button key={step} onClick={() => setWorkflowStep(step)} className={`w-8 h-8 rounded-full flex items-center justify-center ${workflowStep === step ? 'bg-teal-500 text-white font-bold' : workflowStep > step ? 'bg-teal-900 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
                      {step}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-[200px]">
                {workflowStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Step 1: Location</h3>
                    <p className="text-xs text-slate-400">Enable location to find the nearest valid airports in the database, or skip to enter manually.</p>
                    <button onClick={handleUseMyLocation} disabled={isLocating} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded transition-colors text-xs font-bold uppercase tracking-widest">
                      {isLocating ? 'Locating...' : 'Use My Location'}
                    </button>
                    {locationError && <p className="text-xs text-orange-400 mt-2">{locationError}</p>}

                    {nearestAirports.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {nearestAirports.map(ap => (
                          <div key={ap.icao} onClick={() => handleSelectAirport(ap.icao)} className={`border p-3 rounded-lg cursor-pointer transition-colors ${airport === ap.icao ? 'bg-teal-900/30 border-teal-500' : 'bg-slate-950/50 border-slate-800 hover:border-teal-500/50'}`}>
                            <div className="font-bold text-white text-sm">{ap.icao} <span className="text-slate-500 text-xs font-normal">({ap.iata || 'N/A'})</span></div>
                            <div className="text-[10px] text-slate-400 truncate">{ap.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => setWorkflowStep(2)} className="text-teal-400 text-xs font-bold uppercase tracking-widest hover:text-teal-300">Skip & Enter ICAO &rarr;</button>
                    </div>
                  </div>
                )}

                {workflowStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Step 2: Airport Selection</h3>
                    <input
                      type="text"
                      value={airport}
                      onChange={(e) => setAirport(e.target.value.toUpperCase())}
                      maxLength={4}
                      placeholder="e.g. KJFK"
                      className="block w-full max-w-xs px-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-white uppercase tracking-widest font-mono text-sm"
                    />
                    {airportProfile ? (
                      <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg max-w-lg">
                        <div className="font-bold text-white text-lg">{airportProfile.icao} <span className="text-slate-500 text-sm font-normal">({airportProfile.iata || 'N/A'})</span></div>
                        <div className="text-xs text-slate-400 mb-2">{airportProfile.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                          <div>Runway: <span className="text-white">{airportProfile.runwayLengthCategory} ({airportProfile.runwaySurface})</span></div>
                          <div>Complexity: <span className="text-white">{airportProfile.complexity}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-orange-400">UNKNOWN ICAO: Enter a valid database code to proceed.</div>
                    )}
                    <div className="mt-4 flex justify-between">
                      <button onClick={() => setWorkflowStep(1)} className="text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-300">&larr; Back</button>
                      <button onClick={() => { handleFetchFlights(); setWorkflowStep(3); }} disabled={!airportProfile} className="bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest">Confirm & Fetch Flights &rarr;</button>
                    </div>
                  </div>
                )}

                {workflowStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Step 3: Flight Selection</h3>
                    <div className="flex space-x-2 mb-2">
                      <button onClick={() => setFlightType('arrivals')} className={`px-3 py-1 text-[10px] uppercase font-bold rounded ${flightType === 'arrivals' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Arrivals</button>
                      <button onClick={() => setFlightType('departures')} className={`px-3 py-1 text-[10px] uppercase font-bold rounded ${flightType === 'departures' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Departures</button>
                    </div>
                    {isFetchingFlights ? (
                      <div className="text-xs text-slate-400 animate-pulse">Fetching live schedules...</div>
                    ) : flightsState?.source === 'NOT_CONNECTED' ? (
                      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg text-center">
                        <p className="text-xs text-slate-400 mb-2">{flightsState.message}</p>
                        <p className="text-[10px] text-slate-500">Provide an AVIATIONSTACK_API_KEY in the backend to enable this feature.</p>
                      </div>
                    ) : flightsState?.source === 'LIVE' ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {flightsState.flights.map((f: any, i: number) => (
                          <div key={i} onClick={() => setSelectedFlight(f)} className={`p-3 rounded-lg border cursor-pointer transition-colors flex justify-between items-center ${selectedFlight === f ? 'bg-teal-900/30 border-teal-500' : 'bg-slate-950/50 border-slate-800 hover:border-slate-600'}`}>
                            <div>
                              <div className="text-xs font-bold text-white">{f.flightNumber} <span className="text-[10px] text-slate-500 font-normal">{f.airline}</span></div>
                              <div className="text-[10px] text-slate-400">{f.departureIata} &rarr; {f.arrivalIata}</div>
                            </div>
                            <div className="text-right">
                              <div className={`text-[10px] font-bold uppercase ${f.status === 'scheduled' ? 'text-green-400' : 'text-yellow-400'}`}>{f.status}</div>
                              <div className="text-[9px] text-slate-500">{new Date(f.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-red-400">{flightsState?.message || "Failed to load flights"}</div>
                    )}

                    <div className="mt-4 flex justify-between">
                      <button onClick={() => setWorkflowStep(2)} className="text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-300">&larr; Back</button>
                      <button onClick={() => handlePrepareMissionData()} className="bg-teal-600 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest">Proceed to Data Prep &rarr;</button>
                    </div>
                  </div>
                )}

                {workflowStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Step 4: Prepare Mission Data</h3>
                    <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg text-xs text-slate-300">
                      <p>Destination: <strong className="text-white">{airport}</strong></p>
                      <p>Flight: <strong className="text-white">{selectedFlight ? selectedFlight.flightNumber : 'Manual/None'}</strong></p>
                      <p>Aircraft: <strong className="text-white">{aircraft}</strong></p>
                      <p className="mt-2 text-[10px] text-slate-500">Weather and Traffic inputs remain adjustable in the Manual Override below.</p>
                    </div>
                    <div className="mt-6 text-center">
                      <button onClick={() => { handleStartAnalysis(); }} disabled={isSaving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all">
                        {isSaving ? 'Processing Matrix...' : 'Analyze Selected Flight'}
                      </button>
                    </div>
                    <div className="mt-4 flex justify-between">
                      <button onClick={() => setWorkflowStep(3)} className="text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-300">&larr; Back to Flights</button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Manual Override Section */}
            <div className="mb-8 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Manual Override Parameters</h3>
                {weatherData && weatherData.source === 'LIVE' ? (
                  <span className="text-[9px] font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded border border-green-500/30 uppercase tracking-widest">Weather values derived from LIVE METAR</span>
                ) : (
                  <span className="text-[9px] font-bold text-orange-400 bg-orange-900/30 px-2 py-1 rounded border border-orange-500/30 uppercase tracking-widest">Manual or fallback weather values in use</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SelectInput label="Runway" value={runway} onChange={setRunway} options={['Dry', 'Wet', 'Contaminated']} />
                <SelectInput label="Traffic" value={traffic} onChange={setTraffic} options={['Low', 'Medium', 'High']} />
                <SelectInput label="Workload" value={workload} onChange={setWorkload} options={['Low', 'Medium', 'High']} />
                <SelectInput label="Aircraft" value={aircraft} onChange={setAircraft} options={['Normal', 'Minor Issue']} />
                <SelectInput label="Visibility" value={visibilityCategory} onChange={setVisibilityCategory} options={['Good', 'Reduced', 'Low']} />
                <SelectInput label="Wind" value={windCategory} onChange={setWindCategory} options={['Calm', 'Moderate', 'Strong']} />
                <div className="col-span-2">
                  <SelectInput label="Weather" value={weatherCondition} onChange={setWeatherCondition} options={['Clear', 'Rain', 'Fog', 'Storm']} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => handleStartAnalysis()} disabled={isSaving} className="bg-slate-800 hover:bg-cyan-600 border border-slate-600 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors shadow-lg">
                  {isSaving ? 'Processing Matrix...' : 'Analyze Risk Intelligence'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: DASHBOARD SCREEN */}
        {appScreen === 'dashboard' && result && (
          <div className="w-full animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white tracking-tight">Analysis Dashboard</h2>
              <button onClick={() => setAppScreen('setup')} className="text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold">&larr; Back to Setup</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* COL 1: Main Engine Result */}
              <div className="lg:col-span-5 space-y-6">
                <Panel title="Operational Risk Assessment" icon={<svg className="w-4 h-4 mr-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} glow={aiRiskResult ? aiRiskResult.decision === 'DIVERT' : result?.level === 'Critical'}>
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {aiRiskResult && !aiRiskResult.error ? 'AI-Estimated Operational Landing Risk' : 'Rule-Based Fallback'}
                      </div>
                      <div className="flex space-x-2">
                        {!speechSupported ? null : isSpeaking ? (
                          <button onClick={handleStopBriefing} className="flex items-center text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-1 rounded hover:bg-red-500/30 transition-colors uppercase tracking-widest">
                            Stop Voice
                          </button>
                        ) : (
                          <button onClick={() => {
                            if (!speechSupported || typeof window === 'undefined' || !aiRiskResult || aiRiskResult.error) return;
                            window.speechSynthesis.cancel();
                            setIsSpeaking(true);
                            const text = `AI Risk Assessment. Decision: ${aiRiskResult.decision}. Score: ${aiRiskResult.overallRiskScore}. Confidence: ${aiRiskResult.confidence}. Top risks: ${aiRiskResult.topRisks.join(', ')}. Recommendations: ${aiRiskResult.recommendations.join(', ')}. Explanation: ${aiRiskResult.explanation}`;
                            const utterance = new SpeechSynthesisUtterance(text);
                            utterance.onend = () => setIsSpeaking(false);
                            utterance.onerror = () => setIsSpeaking(false);
                            window.speechSynthesis.speak(utterance);
                          }} disabled={!aiRiskResult || aiRiskResult.error} className="flex items-center text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 px-2 py-1 rounded hover:bg-cyan-500/30 transition-colors uppercase tracking-widest disabled:opacity-50">
                            Read AI Risk Assessment
                          </button>
                        )}
                      </div>
                    </div>

                    {isGeneratingAiRisk && !aiRiskResult ? (
                      <div className="flex flex-col items-center justify-center py-12 h-full text-center">
                        <svg className="w-8 h-8 text-cyan-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-xs text-cyan-400 animate-pulse font-bold tracking-widest uppercase">AI risk assessment in progress...</p>
                      </div>
                    ) : aiRiskResult && !aiRiskResult.error ? (
                      <>
                        <div className="flex flex-col items-center justify-center p-6 border-b border-slate-800/50 mb-4 bg-slate-950/40 rounded-xl relative">
                          <RiskGauge score={aiRiskResult.overallRiskScore} level={aiRiskResult.decision === 'DIVERT' ? 'Critical' : aiRiskResult.decision === 'HOLD' ? 'High' : aiRiskResult.decision === 'CAUTION' ? 'Medium' : 'Low'} decision={aiRiskResult.decision} />
                        </div>
                        <div className="mb-5">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Risk Factor Breakdown
                            <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">CONFIDENCE: {aiRiskResult.confidence}</span>
                          </h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {Object.entries(aiRiskResult.factorScores || {}).map(([category, score]: [string, any]) => (
                              <div key={category} className="flex items-center space-x-2">
                                <div className="w-16 text-[9px] text-slate-400 uppercase tracking-wider text-right">{category}</div>
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${score >= 15 ? 'bg-red-500' : score >= 10 ? 'bg-orange-500' : score > 0 ? 'bg-yellow-500' : 'bg-slate-700'}`} style={{ width: `${Math.min(100, Math.max(0, (score / 25) * 100))}%` }}></div>
                                </div>
                                <div className="w-6 text-[9px] font-mono text-slate-500 text-right">{score > 0 ? `+${score}` : '0'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mb-4 bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/50">
                          <p className="text-sm text-cyan-100 italic border-l-2 border-cyan-500/50 pl-3">&quot;{aiRiskResult.explanation}&quot;</p>
                        </div>
                        {aiRiskResult.missingDataWarnings && aiRiskResult.missingDataWarnings.length > 0 && (
                          <div className="mb-4 bg-orange-950/30 border border-orange-900/50 p-2 rounded text-[10px] text-orange-400">
                            <strong>Warnings:</strong> {aiRiskResult.missingDataWarnings.join(' ')}
                          </div>
                        )}
                        <button onClick={handleGenerateAiRisk} className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg mt-auto">Re-run AI Risk Assessment</button>
                      </>
                    ) : (
                      <>
                        {aiRiskResult?.error && (
                          <div className="mb-4 text-center">
                            <p className="text-xs text-red-400">AI risk evaluation unavailable. Rule-based fallback remains active.</p>
                            <button onClick={handleGenerateAiRisk} disabled={isGeneratingAiRisk} className="mt-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors shadow-lg disabled:opacity-50">Try Again</button>
                          </div>
                        )}
                        <div className="flex flex-col items-center justify-center p-6 border-b border-slate-800/50 mb-4 bg-slate-950/40 rounded-xl relative opacity-80">
                          <RiskGauge score={result.score} level={result.level} decision={result.decision} />
                        </div>

                        <div className="mb-5 opacity-80">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Risk Factor Breakdown
                            <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">CONFIDENCE: {result.confidence}</span>
                          </h3>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {Object.values(result.riskBreakdown).every(v => v === 0) ? (
                              <div className="col-span-2 text-[11px] text-green-400 italic text-center py-4 bg-green-500/10 rounded-lg border border-green-500/20">
                                Baseline operational risk only. No elevated hazards detected.
                              </div>
                            ) : (
                              Object.entries(result.riskBreakdown).map(([category, score]) => (
                                <div key={category} className="flex items-center space-x-2">
                                  <div className="w-16 text-[9px] text-slate-400 uppercase tracking-wider text-right">{category}</div>
                                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${score >= 30 ? 'bg-red-500' : score >= 15 ? 'bg-orange-500' : score > 0 ? 'bg-yellow-500' : 'bg-slate-700'}`} style={{ width: `${Math.min(100, Math.max(0, (score / 50) * 100))}%` }}></div>
                                  </div>
                                  <div className="w-6 text-[9px] font-mono text-slate-500 text-right">{score > 0 ? `+${score}` : '0'}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 opacity-80">
                          <p className="text-sm text-slate-300 italic border-l-2 border-slate-500/50 pl-3">&quot;{result.explanation}&quot;</p>
                        </div>
                      </>
                    )}
                  </div>
                </Panel>


                {/* Navigation Actions */}
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(8,145,178,0.15)] flex flex-col items-center text-center">
                  <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-widest mb-2">Proceed to Briefing</h3>
                  <p className="text-xs text-cyan-200/70 mb-4">Generate an AI Pilot Briefing or proceed directly to the Briefing screen.</p>
                  <div className="flex space-x-3 w-full">
                    <button onClick={handleGenerateBriefing} disabled={isGeneratingBriefing} className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      {isGeneratingBriefing ? 'Generating...' : 'Generate AI Briefing'}
                    </button>
                    <button onClick={handleSaveAssessment} disabled={isSaving} className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      {isSaving ? 'Saving...' : 'Save Assessment'}
                    </button>
                    <button onClick={() => setAppScreen('briefing')} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      Go to Briefing &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* COL 2: Context Data */}
              <div className="lg:col-span-7 space-y-6">
                {/* Operational Recommendation System */}
                <Panel title="Operational Recommendation System" icon={<svg className="w-4 h-4 mr-2 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
                  {operationalRecommendation ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800/50 mb-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audio Briefing Synthesis</div>
                        <button onClick={() => {
                          if (!speechSupported || typeof window === 'undefined') return;
                          window.speechSynthesis.cancel();
                          setIsSpeaking(true);
                          
                          const currentScore = aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score;
                          const currentLevel = aiRiskResult && !aiRiskResult.error ? (aiRiskResult.decision === 'DIVERT' ? 'Critical' : aiRiskResult.decision === 'HOLD' ? 'High' : aiRiskResult.decision === 'CAUTION' ? 'Medium' : 'Low') : result.level;
                          const currentDecision = aiRiskResult && !aiRiskResult.error ? aiRiskResult.decision : result.decision;
                          const currentRisks = getTop3Risks().join(', ');
                          const currentAction = operationalRecommendation?.primaryRecommendation.replace(/_/g, ' ') || 'Monitor conditions';
                          
                          const text = `Landing Risk Briefing. The current risk score is ${currentScore}, categorized as ${currentLevel} risk. Top 3 hazards identified are: ${currentRisks}. Final recommended action: ${currentAction}.`;
                          
                          const utterance = new SpeechSynthesisUtterance(text);
                          utterance.onend = () => setIsSpeaking(false);
                          utterance.onerror = () => setIsSpeaking(false);
                          window.speechSynthesis.speak(utterance);
                        }} disabled={!speechSupported} className="flex items-center text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 px-3 py-1.5 rounded hover:bg-indigo-500/30 transition-colors uppercase tracking-widest disabled:opacity-50">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                          {isSpeaking ? 'Speaking...' : 'Play Briefing'}
                        </button>
                      </div>
                      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800/60 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Recommendation</div>
                          <div className={`text-lg font-black uppercase tracking-widest ${operationalRecommendation.primaryRecommendation === 'DIVERT' ? 'text-red-500' : operationalRecommendation.primaryRecommendation === 'HOLD' ? 'text-orange-500' : operationalRecommendation.primaryRecommendation === 'PROCEED_WITH_CAUTION' ? 'text-yellow-500' : 'text-green-500'}`}>
                            {operationalRecommendation.primaryRecommendation.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 border-t border-slate-800/50 pt-2 mt-2 flex justify-between items-center">
                          <span>Alternative:</span>
                          <span className="text-slate-300 italic">{operationalRecommendation.alternativeRecommendation}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/40">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                            <span className="text-red-400 mr-2 text-sm">⚠</span> Operational Reasoning
                          </h3>
                          <ul className="space-y-1.5">
                            {operationalRecommendation.operationalReasoning.map((reason: string, i: number) => (
                              <li key={i} className="flex items-start text-xs text-slate-300 leading-relaxed">
                                <span className="w-1 h-1 mt-1.5 rounded-full bg-red-500/50 mr-2 flex-shrink-0"></span>{reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/40">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                            <svg className="w-3.5 h-3.5 mr-2 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Pilot Actions
                          </h3>
                          <ul className="space-y-1.5">
                            {operationalRecommendation.pilotActions.map((action: string, i: number) => (
                              <li key={i} className="flex items-start text-xs text-cyan-200/80 leading-relaxed">
                                <span className="w-1 h-1 mt-1.5 rounded-full bg-cyan-500/50 mr-2 flex-shrink-0"></span>{action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {(operationalRecommendation.dispatcherNotes.length > 0 || operationalRecommendation.missingDataWarnings.length > 0) && (
                        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/40">
                          {operationalRecommendation.dispatcherNotes.length > 0 && (
                            <div className="mb-2">
                              <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Dispatcher / Ops Notes</h3>
                              <p className="text-xs text-slate-400 italic leading-relaxed">{operationalRecommendation.dispatcherNotes.join(' ')}</p>
                            </div>
                          )}
                          {operationalRecommendation.missingDataWarnings.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-800/50">
                              <h3 className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-1">Missing Data Warnings</h3>
                              <p className="text-[10px] text-orange-300/80 leading-relaxed">{operationalRecommendation.missingDataWarnings.join(' ')}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[9px] text-slate-500/70 italic text-center mt-2">
                        AI-estimated operational recommendation based on available flight, weather, airport, traffic, and manual inputs.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[150px] text-xs text-slate-500 italic">
                      Recommendation context unavailable.
                    </div>
                  )}
                </Panel>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Panel title="Data Sources Used" icon={<svg className="w-4 h-4 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-b border-slate-800/50 pb-2">
                        <span className="text-slate-400">Flight</span>
                        <span className={`font-bold ${(aiRiskResult?._dataSources || result.dataSources).flight === 'LIVE' ? 'text-green-400' : 'text-orange-400'}`}>{(aiRiskResult?._dataSources || result.dataSources).flight}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-b border-slate-800/50 pb-2">
                        <span className="text-slate-400">Weather</span>
                        <span className={`font-bold ${(aiRiskResult?._dataSources || result.dataSources).weather === 'LIVE' ? 'text-green-400' : 'text-orange-400'}`}>{(aiRiskResult?._dataSources || result.dataSources).weather}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-b border-slate-800/50 pb-2">
                        <span className="text-slate-400">Airport</span>
                        <span className="font-bold text-green-400">{(aiRiskResult?._dataSources || result.dataSources).airport}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-b border-slate-800/50 pb-2">
                        <span className="text-slate-400">Traffic</span>
                        <span className={`font-bold ${(aiRiskResult?._dataSources || result.dataSources).traffic === 'LIVE' ? 'text-green-400' : 'text-orange-400'}`}>{(aiRiskResult?._dataSources || result.dataSources).traffic}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest pb-1">
                        <span className="text-slate-400">Manual Override</span>
                        <span className={`font-bold ${(aiRiskResult?._dataSources || result.dataSources).manualOverride === 'ACTIVE' ? 'text-yellow-400' : 'text-slate-500'}`}>{(aiRiskResult?._dataSources || result.dataSources).manualOverride}</span>
                      </div>

                      {aiRiskResult?._dataSources && (aiRiskResult._dataSources.weather !== 'LIVE' || aiRiskResult._dataSources.flight === 'NOT_CONNECTED') && (
                        <div className="mt-2 text-[9px] text-orange-400/80 italic leading-snug">
                          Some operational inputs are manual or unavailable; AI confidence may be reduced.
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Selected Flight Intelligence" icon={<svg className="w-4 h-4 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
                    {selectedFlight ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-start border-b border-slate-800/50 pb-2 mb-2">
                          <div>
                            <div className="text-lg font-bold text-white">{selectedFlight.flightNumber}</div>
                            <div className="text-xs text-slate-400">{selectedFlight.airline}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border inline-block ${selectedFlight.status === 'scheduled' || selectedFlight.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'}`}>
                              {selectedFlight.status}
                            </div>
                            {flightsState?.source && (
                              <div className="text-[8px] text-slate-500 uppercase mt-1">{flightsState.source}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-center w-1/4">
                            <div className="text-sm font-bold text-slate-300">{selectedFlight.departureIata}</div>
                            <div className="text-[9px] text-slate-500 truncate" title={selectedFlight.departureAirport}>{selectedFlight.departureAirport}</div>
                          </div>
                          <div className="flex-1 px-2 text-center relative">
                            <div className="h-px bg-slate-700 w-full absolute top-1/2 left-0 transform -translate-y-1/2 z-0"></div>
                            <svg className="w-3 h-3 text-slate-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-slate-900/80 px-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                            <div className="text-[9px] text-slate-500 mt-3 pt-1">{selectedFlight.aircraft || 'Unknown Aircraft'}</div>
                          </div>
                          <div className="text-center w-1/4">
                            <div className="text-sm font-bold text-slate-300">{selectedFlight.arrivalIata}</div>
                            <div className="text-[9px] text-slate-500 truncate" title={selectedFlight.arrivalAirport}>{selectedFlight.arrivalAirport}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-800/50">
                          <div>Sch: <span className="text-white">{new Date(selectedFlight.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                          <div className="text-right">Est: <span className="text-white">{new Date(selectedFlight.estimatedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full min-h-[100px] text-center p-4">
                        <p className="text-xs text-slate-500 leading-relaxed italic">No live flight selected. Manual mission analysis active.</p>
                      </div>
                    )}
                  </Panel>

                  <Panel title="Airport Intelligence" icon={<svg className="w-4 h-4 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}>
                    {airportProfile ? (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="text-xl font-bold text-white tracking-wide">{airportProfile.icao}</div>
                            {airportProfile.iata && <div className="text-xs font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">{airportProfile.iata}</div>}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{airportProfile.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{airportProfile.city}, {airportProfile.country}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/50">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">Runway</div>
                            <div className={`text-xs font-semibold ${airportProfile.runwayLengthCategory === 'Short' ? 'text-orange-400' : 'text-green-400'}`}>{airportProfile.runwayLengthCategory} <span className="text-[10px] text-slate-500 font-normal">({airportProfile.runwaySurface})</span></div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">Complexity</div>
                            <div className={`text-xs font-semibold ${airportProfile.complexity === 'High' ? 'text-red-400' : airportProfile.complexity === 'Medium' ? 'text-yellow-400' : 'text-green-400'}`}>{airportProfile.complexity}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-500 text-xs italic">UNKNOWN ICAO</div>
                    )}
                  </Panel>

                  <Panel title="Weather Intelligence" icon={<svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>}>
                    <div className="flex justify-between items-center mb-3">
                      {weatherData && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${weatherData.source === 'FALLBACK' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                          {weatherData.source === 'FALLBACK' ? 'FALLBACK' : 'LIVE'}
                        </span>
                      )}
                      <button
                        onClick={handleFetchWeather}
                        disabled={isFetchingWeather || !airportProfile}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-50 text-white px-2 py-1 rounded flex items-center ml-auto"
                      >
                        FETCH
                      </button>
                    </div>
                    {weatherData ? (
                      <div className="space-y-3">
                        <div className="bg-slate-950/80 border border-slate-800/80 rounded p-2.5 font-mono text-[10px] text-slate-300 break-words">{weatherData.rawMetar}</div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-600 text-xs italic">Fetch to view.</div>
                    )}
                  </Panel>

                  <Panel title="Traffic Intelligence" icon={<svg className="w-4 h-4 mr-2 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
                      <div className="mb-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-1">Density:</div>
                      <div className={`text-sm font-bold tracking-wider uppercase ${traffic === 'High' ? 'text-red-400' : traffic === 'Medium' ? 'text-orange-400' : 'text-green-400'}`}>{traffic}</div>
                    </div>
                  </Panel>

                  <Panel title="Cyber-Operational Exposure Indicator" icon={<svg className="w-4 h-4 mr-2 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}>
                    {isGeneratingCyber && !cyberIndicator ? (
                      <div className="flex flex-col items-center justify-center py-8 h-full text-center">
                        <svg className="w-5 h-5 text-teal-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-[9px] text-teal-400 animate-pulse font-bold tracking-widest uppercase">Estimating cyber exposure...</p>
                      </div>
                    ) : (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center space-x-1.5">
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded border inline-block ${cyberExposure.level === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/30' : cyberExposure.level === 'Medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-teal-500/10 text-teal-400 border-teal-500/30'}`}>
                                {cyberExposure.level} EXPOSURE
                              </span>
                              {cyberIndicator && !cyberIndicator.error ? (
                                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-green-500/10 text-green-400 border border-green-500/20">AI Assessment Active</span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Fallback Mode Active</span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">SCORE: {cyberExposure.score}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed">{cyberExposure.summary || cyberExposure.explanation}</p>
                          {cyberExposure.actions && (
                            <div className="mt-2">
                              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Awareness Actions:</h4>
                              <ul className="space-y-1">
                                {cyberExposure.actions.map((act: string, i: number) => (
                                  <li key={i} className="text-[10px] text-teal-200/70 flex items-start">
                                    <span className="w-1 h-1 mt-1.5 rounded-full bg-teal-500/50 mr-2 flex-shrink-0"></span>{act}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="flex space-x-2 mt-2">
                            <button onClick={handleGenerateCyberIndicator} disabled={isGeneratingCyber} className="flex-1 bg-slate-800/50 hover:bg-slate-800 disabled:opacity-50 text-[8px] text-slate-500 hover:text-teal-400 font-bold uppercase tracking-widest py-1.5 rounded border border-slate-800 transition-colors">
                              {isGeneratingCyber ? 'Generating...' : 'Generate Gemini Cyber Briefing'}
                            </button>
                            {!speechSupported ? (
                              <div className="text-[8px] text-orange-400/80 italic flex items-center justify-center px-1 flex-1">Voice unavailable</div>
                            ) : (
                              <button onClick={() => {
                                if (typeof window === 'undefined' || !window.speechSynthesis) return;
                                window.speechSynthesis.cancel();
                                setIsSpeaking(true);
                                const speechText = `Cyber-Operational Exposure: ${cyberExposure.level} level with a score of ${cyberExposure.score}. Summary: ${cyberExposure.summary || cyberExposure.explanation}. Recommended actions: ${cyberExposure.actions.join(', ')}`;
                                const utterance = new SpeechSynthesisUtterance(speechText);
                                utterance.onend = () => setIsSpeaking(false);
                                utterance.onerror = () => setIsSpeaking(false);
                                window.speechSynthesis.speak(utterance);
                              }} disabled={isGeneratingCyber} className="flex-1 bg-teal-900/20 hover:bg-teal-900/40 text-[8px] text-teal-400 font-bold uppercase tracking-widest py-1.5 rounded border border-teal-800/50 transition-colors flex items-center justify-center space-x-1">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                <span>Play Cyber Briefing</span>
                              </button>
                            )}
                          </div>
                        </div>
                    )}
                  </Panel>

                </div>
              </div> {/* Close COL 2 */}
                
              {/* Mission Replay & Map View Panel (FULL WIDTH) */}
              <div className="lg:col-span-12">
                  <Panel title="Mission Replay & Map View" icon={<svg className="w-4 h-4 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}>
                    {(!aiRiskResult || aiRiskResult.error) && (!result) ? (
                       <div className="flex items-center justify-center h-full min-h-[150px] text-xs text-slate-500 italic border border-slate-800 rounded-xl bg-slate-900/30">
                         Run AI Risk Assessment to generate mission replay context.
                       </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* LEFT: MAP SECTION */}
                        <div className="relative w-full h-[320px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50 shadow-inner">
                          {googleMapsApiKey ? (
                            <div ref={mapRef} className="w-full h-full" />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 bg-slate-900/50">
                               <svg className="w-8 h-8 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                               <p className="text-xs font-medium">Map view unavailable.</p>
                               <p className="text-[10px] mt-1 opacity-80">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps.</p>
                            </div>
                          )}
                          
                          {/* OVERLAYS ON MAP */}
                          <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
                             <div className="bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 shadow-xl pointer-events-auto">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Mission Route</div>
                                {selectedFlight && selectedFlight.departureIata ? (
                                   <div className="text-xs font-bold text-white flex items-center">
                                      {selectedFlight.departureIata}
                                      <svg className="w-3 h-3 mx-1.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                      {airportProfile?.iata || airportProfile?.icao || airport}
                                   </div>
                                ) : (
                                   <div className="text-xs font-bold text-white flex items-center">
                                      LOCAL FLIGHT
                                      <svg className="w-3 h-3 mx-1.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                      {airportProfile?.iata || airportProfile?.icao || airport}
                                   </div>
                                )}
                             </div>
                          </div>
                        </div>

                        {/* RIGHT: MISSION REPLAY ANIMATION SECTION */}
                        <div className="space-y-4">
                          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 relative overflow-hidden flex flex-col sm:flex-row gap-5 items-center shadow-inner h-[230px]">
                             {/* Weather Animation Canvas */}
                             <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                                {weatherCondition.toLowerCase().includes('rain') && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjIwIj48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSI4IiBmaWxsPSIjNGRhNmZmIiBvcGFjaXR5PSIwLjUiLz48L3N2Zz4=')] animate-rain" />}
                                {weatherCondition.toLowerCase().includes('snow') && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxjaXJjbGUgY3g9IjQiIGN5PSI0IiByPSIyIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjgiLz48L3N2Zz4=')] animate-snow" />}
                                {(weatherCondition.toLowerCase().includes('fog') || visibilityCategory === 'Low') && <div className="absolute inset-0 bg-gradient-to-t from-slate-400/40 to-transparent" />}
                                {weatherCondition.toLowerCase().includes('storm') && <div className="absolute inset-0 bg-red-500/10 animate-pulse" />}
                             </div>

                             {/* Animation Scene */}
                             <div className="relative w-40 h-40 flex-shrink-0 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden z-10 flex items-center justify-center perspective-1000 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                                <div className="w-10 h-48 bg-slate-800 relative flex items-center justify-center rotate-x-60 scale-125 border-x-2 border-slate-700">
                                   {/* Runway dashes */}
                                   <div className="h-full w-0.5 border-r border-dashed border-white/60 animate-runway"></div>
                                   <div className="absolute top-2 w-full h-0.5 bg-white/30"></div>
                                   <div className="absolute top-6 w-full h-0.5 bg-white/30"></div>
                                </div>
                                <div className="absolute text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-approach">
                                   <svg className="w-10 h-10 transform -rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
                                </div>
                             </div>

                             {/* Replay Details */}
                             <div className="flex-1 z-10 space-y-3 text-center sm:text-left py-2">
                                <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
                                   <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border shadow-sm ${operationalRecommendation?.primaryRecommendation === 'DIVERT' ? 'bg-red-500/20 text-red-400 border-red-500/50' : operationalRecommendation?.primaryRecommendation === 'HOLD' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : operationalRecommendation?.primaryRecommendation === 'PROCEED_WITH_CAUTION' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-green-500/20 text-green-400 border-green-500/50'}`}>
                                      {operationalRecommendation?.primaryRecommendation?.replace(/_/g, ' ') || 'N/A'}
                                   </span>
                                   <span className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border bg-slate-800 text-slate-300 border-slate-600 shadow-sm">
                                      SCORE: {aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result?.score}
                                   </span>
                                   {aiRiskResult && !aiRiskResult.error ? (
                                     <span className="px-1.5 py-1 text-[8px] font-bold uppercase rounded bg-green-500/10 text-green-400 border border-green-500/20">AI Assessment Active</span>
                                   ) : (
                                     <span className="px-1.5 py-1 text-[8px] font-bold uppercase rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Fallback Mode Active</span>
                                   )}
                                </div>
                                <div className="text-[10px] text-slate-400/90 leading-relaxed italic mt-2 border-t border-slate-700/50 pt-2">
                                   Mission replay visualization based on available operational inputs. Not a certified flight simulation.
                                </div>
                             </div>
                          </div>

                          {/* TOP 3 LANDING RISKS CARD */}
                          <div className="flex flex-col p-4 border border-dashed border-cyan-700/50 rounded-xl bg-cyan-950/20 shadow-inner mt-4">
                            <div className="flex items-center mb-3">
                              <svg className="w-5 h-5 mr-3 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              <div>
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest block mb-0.5">Top 3 Landing Risks</span>
                                {isGeneratingTopRisks && !dynamicRisks ? (
                                  <p className="text-[10px] text-teal-400 animate-pulse font-bold tracking-widest uppercase">Generating scenario-specific risks...</p>
                                ) : dynamicRisks && dynamicRisks.source === 'GEMINI' ? (
                                  <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">AI-generated landing risks</p>
                                ) : (
                                  <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">Rule-based landing risks</p>
                                )}
                              </div>
                            </div>
                            <ul className="space-y-2">
                              {isGeneratingTopRisks && !dynamicRisks ? (
                                <div className="flex items-center justify-center py-4">
                                  <svg className="w-5 h-5 text-cyan-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                              ) : (
                                (dynamicRisks?.risks || getTop3Risks()).map((risk, index) => (
                                  <li key={index} className="flex items-start text-xs text-slate-300 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                                    <span className="w-5 h-5 rounded-full bg-cyan-900/50 border border-cyan-500/30 text-[10px] font-bold text-cyan-400 flex items-center justify-center mr-2 flex-shrink-0">{index + 1}</span>
                                    <span className="mt-0.5">{risk}</span>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>

                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            </div>
        )}

        {/* SCREEN 4: PILOT BRIEFING SCREEN */}
        {appScreen === 'briefing' && result && (
          <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-right-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white tracking-tight">Pilot Briefing</h2>
              <button onClick={() => setAppScreen('dashboard')} className="text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold">&larr; Back to Dashboard</button>
            </div>

            {/* Briefing Header: Decision & Hazards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Final Recommendation</div>
                <div className={`text-3xl font-black uppercase tracking-widest ${operationalRecommendation?.primaryRecommendation === 'DIVERT' ? 'text-red-500' : operationalRecommendation?.primaryRecommendation === 'HOLD' ? 'text-orange-500' : operationalRecommendation?.primaryRecommendation === 'PROCEED_WITH_CAUTION' ? 'text-yellow-500' : 'text-green-500'}`}>
                  {operationalRecommendation?.primaryRecommendation?.replace(/_/g, ' ') || 'N/A'}
                </div>
                <div className="text-xs text-slate-400 mt-2">Score: {aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score}</div>
                {(!aiRiskResult || aiRiskResult.error) && <div className="text-[8px] mt-1 bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">Rule-Based Fallback</div>}
              </div>
              <div className="md:col-span-2 bg-slate-900/80 p-5 rounded-2xl border border-slate-700/50">
                <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center"><svg className="w-3.5 h-3.5 mr-2 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Pilot Action Checklist</h3>
                <ul className="space-y-2 text-xs text-slate-300">
                  {operationalRecommendation?.pilotActions.map((action: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="w-1 h-1 mt-1.5 rounded-full bg-cyan-500/50 mr-2 flex-shrink-0"></span>{action}
                    </li>
                  ))}
                </ul>
            </div>
          </div>

          {/* Landing Visualization (Pilot Mode Preview) */}
          <div className="mb-6">
            <LandingVisualization 
              riskLevel={
                (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score) >= 75 ? 'Critical' :
                (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score) >= 50 ? 'High' :
                (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score) >= 25 ? 'Medium' : 'Low'
              }
              riskScore={aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score}
            />
          </div>

          {/* AI Safety Officer Briefing */}
          <Panel title="Gemini Safety Officer Briefing" icon={<svg className="w-4 h-4 mr-2 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}>
              <div className="flex flex-col flex-grow min-h-[300px]">
                {/* Voice Controls */}
                <div className="flex justify-end mb-4 border-b border-purple-900/30 pb-3">
                  {!speechSupported ? null : isSpeaking ? (
                    <button onClick={handleStopBriefing} className="flex items-center text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1.5 rounded hover:bg-red-500/30 transition-colors uppercase tracking-widest">
                      <svg className="w-3 h-3 mr-1.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                      Stop Voice
                    </button>
                  ) : (
                    <button onClick={() => {
                      if (!speechSupported || typeof window === 'undefined') return;
                      window.speechSynthesis.cancel();
                      handleSpeakBriefing();
                    }} className="flex items-center text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/50 px-3 py-1.5 rounded hover:bg-purple-500/30 transition-colors uppercase tracking-widest">
                      <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      Read Briefing
                    </button>
                  )}
                </div>

                {geminiBriefing ? (
                  <div className="text-sm text-purple-100 leading-relaxed font-medium">
                    {geminiBriefing === "Gemini briefing unavailable. Local risk analysis remains available." ? (
                      <p className="text-red-400">{geminiBriefing}</p>
                    ) : (
                      geminiBriefing.split('\n').map((line, i) => {
                        if (!line.trim()) return <div key={i} className="h-3"></div>;
                        if (line.includes(':') && line.split(':')[0].length < 25) {
                          const [heading, ...rest] = line.split(':');
                          const content = rest.join(':').trim();
                          if (content) {
                            return (
                              <div key={i} className="mb-3">
                                <span className="text-purple-300 font-bold uppercase text-[10px] tracking-widest mr-2">{heading}:</span>
                                <span className="text-purple-100">{content}</span>
                              </div>
                            );
                          } else {
                            return (
                              <div key={i} className="mt-4 mb-1 text-purple-300 font-bold uppercase text-[10px] tracking-widest">
                                {heading}:
                              </div>
                            );
                          }
                        }
                        return <p key={i} className="mb-3 pl-2 border-l-2 border-purple-800/50 text-purple-200">{line}</p>;
                      })
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-center py-10 flex-grow">
                    <p className="text-sm text-slate-400 mb-6 max-w-md">Gemini LLM requires manual triggering to synthesize the operational context into a pilot-friendly safety briefing.</p>
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl max-w-lg mb-6">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Local Summary</h4>
                      <p className="text-xs text-slate-300 italic">{operationalRecommendation?.dispatcherNotes.join(' ') || 'Generate Gemini briefing for advanced synthesis.'}</p>
                    </div>
                    <button
                      onClick={handleGenerateBriefing}
                      disabled={isGeneratingBriefing}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(147,51,234,0.4)]"
                    >
                      {isGeneratingBriefing ? 'Generating Gemini Briefing...' : 'Generate AI Briefing'}
                    </button>
                  </div>
                )}
              </div>
            </Panel>

            <div className="mt-8 flex justify-center">
              <button onClick={handleStartNewMission} className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors">
                Start New Mission
              </button>
            </div>
          </div>
        )}

        <div className="text-[9px] text-slate-600/80 uppercase tracking-widest text-center mt-12 mb-4 border-t border-slate-900/50 pt-4 max-w-xl mx-auto">
          This is a prototype decision-support tool and is not certified for real-world aviation operations.
        </div>
      </div>


      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        .animate-pulse-slow { animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}} />
    </div>
  )
}

function RiskGauge({ score, level, decision }: { score: number, level: string, decision: string }) {
  const normalizedScore = Math.min(100, Math.max(0, score));
  const dashArrayValue = (normalizedScore / 100) * 125.6;

  const color = level === 'Critical' ? 'text-red-500' : level === 'High' ? 'text-orange-500' : level === 'Medium' ? 'text-yellow-500' : 'text-green-500';
  const decisionColor = decision === 'DIVERT' ? 'text-red-500 animate-pulse' : decision === 'HOLD' ? 'text-orange-500' : decision === 'CAUTION' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="relative flex flex-col items-center py-2 w-full">
      <div className="relative w-48 h-24 overflow-hidden mb-1">
        <svg className="w-48 h-48 transform origin-bottom" viewBox="0 0 100 100">
          <path className="text-slate-800/80" strokeWidth="8" stroke="currentColor" fill="none" strokeLinecap="round" d="M 10,50 A 40,40 0 1,1 90,50" />
          <path className={`${color} transition-all duration-1000 ease-out`} strokeDasharray={`${dashArrayValue}, 125.6`} strokeWidth="8" stroke="currentColor" fill="none" strokeLinecap="round" d="M 10,50 A 40,40 0 1,1 90,50" />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
          <span className={`text-5xl font-black leading-none tracking-tighter ${color}`}>{score}</span>
        </div>
      </div>
      <div className="text-center mt-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">System Decision</div>
        <div className={`text-2xl font-black uppercase tracking-widest ${decisionColor}`}>{decision}</div>
      </div>
    </div>
  )
}

function Panel({ title, icon, children, glow = false }: { title: string, icon: React.ReactNode, children: React.ReactNode, glow?: boolean }) {
  return (
    <div className={`bg-slate-900/70 backdrop-blur-xl border ${glow ? 'border-red-900/50 shadow-[0_0_30px_rgba(220,38,38,0.15)]' : 'border-slate-800/60 shadow-2xl'} rounded-2xl overflow-hidden flex flex-col transition-all duration-500 h-full`}>
      <div className="px-5 py-3.5 bg-slate-800/30 border-b border-slate-800/60 flex items-center">
        {icon}
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">{title}</h2>
      </div>
      <div className="p-5 flex-grow flex flex-col">
        {children}
      </div>
    </div>
  )
}

function SelectInput({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: string[] }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{label}</label>
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full pl-3 pr-8 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all appearance-none shadow-inner text-xs cursor-pointer group-hover:border-slate-600"
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-500 group-hover:text-cyan-500 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
