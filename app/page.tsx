"use client"
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


  // Voice Briefing state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
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

  // AI Briefing state
  const [aiBriefing, setAiBriefing] = useState<string | null>(null)
  const [aiDirectives, setAiDirectives] = useState<string[] | null>(null)
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false)



  const [aiRiskResult, setAiRiskResult] = useState<any | null>(null)
  const [isGeneratingAiRisk, setIsGeneratingAiRisk] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Analysis lock


  // Cyber-Operational Exposure state
  const [cyberIndicator, setCyberIndicator] = useState<any | null>(null)
  const [isGeneratingCyber, setIsGeneratingCyber] = useState(false)

  // Dynamic Landing Risks state
  const [dynamicRisks, setDynamicRisks] = useState<{ risks: string[], source: string, _fallback?: boolean } | null>(null)
  const [isGeneratingTopRisks, setIsGeneratingTopRisks] = useState(false)

  // Global App Loading state for smoother UX transitions
  const [isAppLoading, setIsAppLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")

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
    if (aiRiskResult && !aiRiskResult._error) {
      const decision = aiRiskResult.decision || 'CAUTION';
      const primary: string =
        decision === 'GO' ? 'PROCEED_NORMALLY' :
          decision === 'CAUTION' ? 'PROCEED_WITH_CAUTION' :
            decision === 'HOLD' ? 'NO-GO / HOLD' :
              decision === 'DIVERT' ? 'DIVERT' : 'PROCEED_WITH_CAUTION';

      return {
        primaryRecommendation: primary,
        alternativeRecommendation: aiRiskResult.alternative || (decision === 'GO' ? 'Monitor conditions' : decision === 'CAUTION' ? 'Hold or Divert if conditions worsen' : 'Divert'),
        operationalReasoning: aiRiskResult.operationalReasoning ? [aiRiskResult.operationalReasoning] : (aiRiskResult.topRisks || []),
        pilotActions: aiRiskResult.pilotActions || aiRiskResult.recommendations || [],
        dispatcherNotes: aiRiskResult.dispatcherNotes ? [aiRiskResult.dispatcherNotes] : (aiRiskResult.explanation ? [aiRiskResult.explanation] : []),
        missingDataWarnings: aiRiskResult.missingDataWarnings || []
      };
    }

    if (result) {
      const decision = result.decision || 'CAUTION';
      const primary: string =
        decision === 'GO' ? 'PROCEED_NORMALLY' :
          decision === 'CAUTION' ? 'PROCEED_WITH_CAUTION' :
            decision === 'HOLD' ? 'NO-GO / HOLD' :
              decision === 'DIVERT' ? 'DIVERT' : 'PROCEED_WITH_CAUTION';

      return {
        primaryRecommendation: primary,
        alternativeRecommendation: decision === 'GO' ? 'Monitor conditions' : decision === 'CAUTION' ? 'Hold or Divert if conditions worsen' : 'Divert',
        operationalReasoning: result.topRisks || [],
        pilotActions: result.recommendations || [],
        dispatcherNotes: [result.explanation || 'AI-assisted assessment using validated operational inputs.'],
        missingDataWarnings: []
      };
    }

    return null;
  };

  useEffect(() => {
    if (appScreen === 'dashboard' && result) {
      if (!aiRiskResult && !isGeneratingAiRisk) {
        handleGenerateAiRisk();
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

  // Cancel speech when switching screens or leaving page
  useEffect(() => {
    stopSpeech();
  }, [appScreen]);

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const pauseSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const resumeSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const speakText = (text: string) => {
    if (!speechSupported || typeof window === 'undefined' || !text) return;

    // Prevent overlapping and clean up previous state
    window.speechSynthesis.cancel();

    setIsSpeaking(true);
    setIsPaused(false);

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakBriefing = () => {
    if (!result) return;

    let textToSpeak = "";
    if (appScreen === 'briefing' && aiBriefing) {
      textToSpeak = aiBriefing;
      if (aiDirectives && aiDirectives.length > 0) {
        textToSpeak += ". Operational Directives: " + aiDirectives.join(". ");
      }
    } else {
      const opRec = getOperationalRecommendation();
      if (opRec) {
        const flightInfo = selectedFlight ? `Flight ${selectedFlight.flightNumber} to ${airport}.` : `Mission to ${airport}.`;
        const scoreInfo = `Risk Score: ${aiRiskResult && !aiRiskResult._error ? aiRiskResult.overallRiskScore : result.score}.`;
        const decisionText = opRec.primaryRecommendation.replace(/_/g, ' ');
        const hazards = (dynamicRisks?.risks || opRec.operationalReasoning).length > 0 ? `Top hazards: ${(dynamicRisks?.risks || opRec.operationalReasoning).slice(0, 3).join(', ')}.` : '';
        const actions = opRec.pilotActions.length > 0 ? `Recommended actions: ${opRec.pilotActions.slice(0, 2).join(', ')}.` : '';
        const explanation = opRec.dispatcherNotes.join(' ');
        textToSpeak = `Operational Recommendation: ${decisionText}. ${scoreInfo} ${flightInfo} ${hazards} ${actions} ${explanation}`;
      } else {
        textToSpeak = "AI-assisted risk assessment synchronized via validated operational inputs.";
      }
    }
    speakText(textToSpeak);
  };

  const handleStopBriefing = () => {
    stopSpeech();
  };

  const handleGenerateBriefing = async () => {
    if (!result) return;
    setIsGeneratingBriefing(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...aiRiskResult,
          selectedFlight,
          aiRiskScore: aiRiskResult?.overallRiskScore,
          aiDecision: aiRiskResult?.decision,
          aiTopRisks: dynamicRisks?.risks
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      setAiBriefing(data.briefing);
      setAiDirectives(data.directives);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("[Groq Debug] Briefing failed", e);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };
  const handleSelectFlight = (f: any) => {
    setSelectedFlight(f);
    setResult(null);
    setAiRiskResult(null);
    setAiBriefing(null);
    setDynamicRisks(null);
    setCyberIndicator(null);
    setAiDirectives(null);
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
    console.log("ANALYZE PAYLOAD", selectedFlight, params);
    setIsAppLoading(true)
    setLoadingMessage("Synthesizing Mission Intelligence...")
    setStarted(true)
    setResult(null)
    setAiBriefing(null)
    setAiRiskResult(null)
    setDynamicRisks(null)
    setCyberIndicator(null)
    setAiDirectives(null)

    const dataSources = {
      flight: selectedFlight ? (flightsState?.source || 'LIVE').toUpperCase() : 'NOT_CONNECTED',
      weather: weatherData ? weatherData.source.toUpperCase() : 'MANUAL',
      traffic: 'DERIVED LIVE',
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
    setLoadingMessage("Finalizing Operational Matrix...")
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSaving(false)
    setCyberIndicator(null)
    setAppScreen('dashboard')
    setIsAppLoading(false)
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
    setAiBriefing(null);
    setAiRiskResult(null);
    setWorkflowStep(1);
    setAppScreen('setup');
  }


  const handleGenerateAiRisk = async () => {
    if (!result) return;
    
    if (isAnalyzing) {
      console.log("[Groq Debug] Groq blocked (duplicate request)");
      return;
    }

    setIsAnalyzing(true);
    setIsGeneratingAiRisk(true);
    console.log("[Groq Debug] Groq request started");

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
          console.error('Failed to auto-fetch weather', e);
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
          console.error('Failed to auto-fetch traffic', e);
        }
      }

      const isLiveWeather = currentWeatherData && currentWeatherData.source === 'LIVE';
      const isLiveFlight = selectedFlight && flightsState?.source === 'LIVE';
      const isLiveTraffic = currentTrafficData && currentTrafficData.source === 'LIVE';

      const dataSources = {
        flight: isLiveFlight ? 'LIVE' : (selectedFlight ? 'CACHE' : 'NOT_CONNECTED'),
        weather: isLiveWeather ? 'LIVE' : (currentWeatherData ? 'FALLBACK' : 'MANUAL'),
        traffic: isLiveTraffic ? 'LIVE' : 'DERIVED LIVE',
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
      const riskTimeout = setTimeout(() => riskCtrl.abort(), 12000); // 12s timeout max
      try {
        const res = await fetch('/api/ai-risk-evaluator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: riskCtrl.signal
        });
        clearTimeout(riskTimeout);

        const json = await res.json();
        const data = json.data;
        
        console.log("[Groq Debug] Groq response received (/api/ai-risk-evaluator)");
        
        // Update Risk Evaluator state
        setAiRiskResult({ ...data, _dataSources: dataSources, _message: json.message });

        // Sequential staggered triggers for other Groq routes
        // This restores the previous independent behavior while maintaining stability
        await new Promise(resolve => setTimeout(resolve, 2500));
        await handleGenerateTopRisks();
        
        await new Promise(resolve => setTimeout(resolve, 2500));
        await handleGenerateCyberIndicator();
        
        await new Promise(resolve => setTimeout(resolve, 2500));
        await handleGenerateBriefing();

      } catch (e: any) {
        clearTimeout(riskTimeout);
        console.error("[Groq Debug] Groq failed (/api/ai-risk-evaluator):", e.message);
        setAiRiskResult({ _error: true });
        
        // Trigger fallbacks sequentially even if primary fails
        setTimeout(() => handleGenerateTopRisks(), 2500);
        setTimeout(() => handleGenerateCyberIndicator(), 5000);
        setTimeout(() => handleGenerateBriefing(), 7500);
      }
    } catch (e) {
      console.error("[Groq Debug] Groq failed (Data Prep):", e);
      setAiRiskResult({ _error: true });
    } finally {
      setIsGeneratingAiRisk(false);
      setIsAnalyzing(false);
    }
  };


  const handleGenerateCyberIndicator = async () => {
    if (!result) return;
    setIsGeneratingCyber(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/cyber-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flight: selectedFlight,
          currentRiskScore: aiRiskResult?.overallRiskScore,
          top3Risks: dynamicRisks?.risks
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.data) {
        setCyberIndicator(data.data);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("[Groq Debug] Cyber failed", e);
    } finally {
      setIsGeneratingCyber(false);
    }
  };

  const handleGenerateTopRisks = async () => {
    if (!result) return;
    setIsGeneratingTopRisks(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/top-risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flight: selectedFlight,
          runwayCondition: runway,
          trafficLevel: traffic,
          crewWorkload: workload,
          aircraftStatus: aircraft,
          visibilityCategory,
          windCategory
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.data?.risks) {
        setDynamicRisks({ risks: data.data.risks, source: data.data.source });
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("[Groq Debug] Top Risks failed", e);
    } finally {
      setIsGeneratingTopRisks(false);
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
      aiBriefing: aiBriefing
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
      const ac = selectedFlight.aircraft.toLowerCase();
      // If the aircraft string contains keywords that might suggest a different status (rare in this data, but good for demo)
      if (ac.includes('unknown') || ac.includes('n/a')) {
        setAircraft('Normal'); // Default to normal
      } else {
        setAircraft('Normal'); 
      }
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
    if (runway === 'Wet') risks.push("Reduced braking action potential on wet surface.");
    if (runway === 'Contaminated') risks.push("Contaminated runway surface poses severe deceleration hazards.");
    if (traffic === 'High') risks.push("High traffic density environment requires enhanced spacing awareness.");
    if (traffic === 'Medium') risks.push("Moderate traffic levels increasing arrival phase complexity.");
    if (workload === 'High') risks.push("High task saturation risk detected in current profile.");
    if (workload === 'Medium') risks.push("Elevated crew workload reducing task management reserves.");
    if (aircraft === 'Minor Issue') risks.push("Systems redundancy alert regarding aircraft status.");
    if (visibilityCategory === 'Low') risks.push("Low visibility conditions necessitating precision approach monitoring.");
    if (visibilityCategory === 'Reduced') risks.push("Reduced visual cues requiring heightened situational awareness.");
    if (windCategory === 'Strong') risks.push("Elevated crosswind components scaling handling requirements.");
    if (windCategory === 'Moderate') risks.push("Moderate wind shear potential during final approach.");
    if (weatherCondition === 'Storm') risks.push("Active convective activity posing significant arrival hazards.");
    if (weatherCondition === 'Rain') risks.push("Active precipitation affecting surface friction and visual tracking.");

    const defaultRisks = [
      "Maintain sterile cockpit procedures below terminal altitudes.",
      "Review missed approach and go-around procedures for current conditions.",
      "Verify stabilized approach criteria throughout the arrival phase.",
      "Monitor fuel reserves against potential holding requirements.",
      "Cross-check landing performance data with real-time telemetry."
    ];

    while (risks.length < 3) {
      const nextDefault = defaultRisks.find(r => !risks.includes(r));
      if (nextDefault) {
        risks.push(nextDefault);
      } else {
        risks.push("Baseline operational safety monitoring.");
      }
    }
    return risks.slice(0, 3);
  };

  const operationalRecommendation = getOperationalRecommendation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-cyan-500/30 relative overflow-hidden pb-20 flex flex-col">
      <style dangerouslySetInnerHTML={{
        __html: `
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

      {/* GLOBAL LOADING OVERLAY */}
      {isAppLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
            <svg className="w-20 h-20 text-cyan-500 animate-spin relative" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="mt-8 text-center">
            <div className="text-sm font-black text-white uppercase tracking-[0.3em] animate-pulse mb-2">PhaseGuard Engine Active</div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">{loadingMessage}</div>
          </div>
        </div>
      )}

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
          <div className="flex flex-col items-center justify-center flex-grow py-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Centered Premium Visual */}
            <div className="relative mb-12 group">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-[60px] group-hover:bg-cyan-500/30 transition-all duration-1000 scale-150"></div>
              <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-slate-700/50 p-8 rounded-full shadow-2xl transition-transform duration-700 group-hover:scale-105">
                <svg className="w-24 h-24 text-cyan-400 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                </svg>
              </div>
            </div>

            <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-white mb-6 bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">
              PhaseGuard AI
            </h1>
            <p className="text-slate-400 max-w-2xl text-lg sm:text-2xl mb-12 leading-relaxed font-light">
              Precision Aviation Landing Risk Intelligence. <br />
              <span className="text-cyan-500/80 font-medium">Real-time telemetry, AI-driven safety synthesis.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center mt-12">
              <button
                onClick={handleStartNewMission}
                className="group relative bg-cyan-600 hover:bg-cyan-500 text-white px-12 py-6 rounded-full text-sm font-black uppercase tracking-[0.25em] shadow-[0_0_50px_rgba(8,145,178,0.4)] transition-all overflow-hidden scale-110 active:scale-100"
              >
                <span className="relative z-10">Initialize New Mission</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </button>
            </div>

            {/* DEMO PRESETS */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl px-4">
              <button
                onClick={() => loadScenario('Normal')}
                className="bg-slate-900/60 border border-emerald-500/30 hover:border-emerald-500 p-4 rounded-2xl transition-all group"
              >
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Preset: Nominal</div>
                <div className="text-xs text-slate-400 font-medium">Standard VFR, Low Risk</div>
              </button>
              <button
                onClick={() => loadScenario('Rainy')}
                className="bg-slate-900/60 border border-orange-500/30 hover:border-orange-500 p-4 rounded-2xl transition-all group"
              >
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Preset: Deteriorating</div>
                <div className="text-xs text-slate-400 font-medium">Wet Runway, High Traffic</div>
              </button>
              <button
                onClick={() => loadScenario('Critical')}
                className="bg-slate-900/60 border border-red-500/30 hover:border-red-500 p-4 rounded-2xl transition-all group"
              >
                <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Preset: Critical</div>
                <div className="text-xs text-slate-400 font-medium">Storm, Low Vis, High Risk</div>
              </button>
            </div>

            {/* Quick Access Grid */}
            <div className="mt-20 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 text-left hover:border-cyan-500/30 transition-all group">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-6 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  Operational Scenarios
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(['Normal', 'Rainy', 'High Traffic', 'Storm', 'Critical'] as ScenarioType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => { loadScenario(type); setAppScreen('dashboard'); }}
                      className="text-[10px] px-3 py-2.5 rounded-xl font-bold bg-slate-950/50 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white hover:border-cyan-500/50 transition-all uppercase tracking-wider"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 text-left hover:border-teal-500/30 transition-all">
                <h3 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-6 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  System Logs
                </h3>
                <div className="space-y-3">
                  {recentAssessments.length > 0 ? recentAssessments.slice(0, 3).map((ra: any) => (
                    <div key={ra.id} className="flex justify-between items-center bg-slate-950/30 p-2 rounded-lg border border-slate-800/50">
                      <div className="text-[10px] font-bold text-white uppercase">{ra.airport?.icao || ra.airport}</div>
                      <div className={`text-[9px] font-black px-1.5 py-0.5 rounded ${ra.aiRiskResult?.decision === 'DIVERT' ? 'text-red-400 bg-red-400/10' : 'text-cyan-400 bg-cyan-400/10'}`}>{ra.aiRiskResult?.overallRiskScore || ra.result?.score || 'N/A'}</div>
                    </div>
                  )) : (
                    <p className="text-[10px] text-slate-600 italic">No recent mission telemetry found.</p>
                  )}
                </div>
              </div>
            </div>
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
                          <div key={i} onClick={() => handleSelectFlight(f)} className={`p-3 rounded-lg border cursor-pointer transition-colors flex justify-between items-center ${selectedFlight === f ? 'bg-teal-900/30 border-teal-500' : 'bg-slate-950/50 border-slate-800 hover:border-slate-600'}`}>
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
                      <div className="text-xs text-cyan-400">{flightsState?.message || "Flight data synchronization pending"}</div>
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
                  <span className="text-[9px] font-bold text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/30 uppercase tracking-widest">Derived or estimated weather values in use</span>
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
                        {aiRiskResult && !aiRiskResult._error ? 'AI-Estimated Operational Landing Risk' : 'AI-Assisted Assessment'}
                      </div>
                      <div className="flex space-x-2">
                        {isSpeaking ? (
                          <button onClick={handleStopBriefing} className="flex items-center text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-1 rounded hover:bg-red-500/30 transition-colors uppercase tracking-widest">
                            <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                            Stop Voice
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (!aiRiskResult || aiRiskResult._error) return;
                              const text = `AI Risk Assessment. Decision: ${aiRiskResult.decision}. Score: ${aiRiskResult.overallRiskScore}. Confidence: ${aiRiskResult.confidence}. Top risks: ${aiRiskResult.topRisks.join(', ')}. Recommendations: ${aiRiskResult.recommendations.join(', ')}. Explanation: ${aiRiskResult.explanation}`;
                              speakText(text);
                            }}
                            disabled={!aiRiskResult || aiRiskResult._error}
                            className="flex items-center text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 px-2 py-1 rounded hover:bg-cyan-500/30 transition-colors uppercase tracking-widest disabled:opacity-50"
                          >
                            <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            Read AI Assessment
                          </button>
                        )}
                      </div>
                    </div>

                    {isGeneratingAiRisk && !aiRiskResult ? (
                      <div className="flex flex-col items-center justify-center py-12 h-full text-center">
                        <svg className="w-8 h-8 text-cyan-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-xs text-cyan-400 animate-pulse font-bold tracking-widest uppercase">AI risk assessment in progress...</p>
                      </div>
                    ) : aiRiskResult && !aiRiskResult._error ? (
                      <>
                        <div className="flex flex-col items-center justify-center p-8 border-b border-slate-800/50 mb-6 bg-slate-950/40 rounded-3xl relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
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
                            <strong>Data confidence notes:</strong> {aiRiskResult.missingDataWarnings.join(' ')}
                          </div>
                        )}
                        <button onClick={handleGenerateAiRisk} className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg mt-auto">Re-run AI Risk Assessment</button>
                      </>
                    ) : (
                      <>
                        <div className="mb-4 text-center">
                          <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest animate-pulse">Synchronizing AI Context...</p>
                          <button onClick={handleGenerateAiRisk} disabled={isGeneratingAiRisk} className="mt-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors shadow-lg disabled:opacity-50">Synchronize Assessment</button>
                        </div>
                        <div className="flex flex-col items-center justify-center p-8 border-b border-slate-800/50 mb-6 bg-slate-950/40 rounded-3xl relative opacity-80 overflow-hidden">
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
                        <div className="flex items-center space-x-2">
                          {!isSpeaking ? (
                            <button onClick={() => {
                              const currentScore = aiRiskResult && !aiRiskResult._error ? aiRiskResult.overallRiskScore : result.score;
                              const currentLevel = aiRiskResult && !aiRiskResult._error ? (aiRiskResult.decision === 'DIVERT' ? 'Critical' : aiRiskResult.decision === 'HOLD' ? 'High' : aiRiskResult.decision === 'CAUTION' ? 'Medium' : 'Low') : result.level;
                              const currentDecision = aiRiskResult && !aiRiskResult._error ? aiRiskResult.decision : result.decision;
                              const currentRisks = getTop3Risks().join(', ');
                              const currentAction = (operationalRecommendation?.primaryRecommendation || 'PROCEED_NORMALLY').replace(/_/g, ' ');

                              const text = `Landing Risk Briefing. The current risk score is ${currentScore}, categorized as ${currentLevel} risk. Top 3 hazards identified are: ${currentRisks}. Final recommended action: ${currentAction}.`;
                              speakText(text);
                            }} disabled={!speechSupported} className="flex items-center text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 px-3 py-1.5 rounded hover:bg-indigo-500/30 transition-colors uppercase tracking-widest disabled:opacity-50">
                              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                              Play Briefing
                            </button>
                          ) : (
                            <>
                              {isPaused ? (
                                <button onClick={resumeSpeech} className="flex items-center text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1.5 rounded hover:bg-green-500/30 transition-colors uppercase tracking-widest">
                                  <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                  Resume
                                </button>
                              ) : (
                                <button onClick={pauseSpeech} className="flex items-center text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-3 py-1.5 rounded hover:bg-yellow-500/30 transition-colors uppercase tracking-widest">
                                  <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                  Pause
                                </button>
                              )}
                              <button onClick={stopSpeech} className="flex items-center text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1.5 rounded hover:bg-red-500/30 transition-colors uppercase tracking-widest">
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                                Stop
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800/60 shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Recommendation</div>
                          <div className={`text-lg font-black uppercase tracking-widest ${operationalRecommendation.primaryRecommendation.includes('DIVERT') ? 'text-red-500' : operationalRecommendation.primaryRecommendation.includes('HOLD') ? 'text-orange-500' : operationalRecommendation.primaryRecommendation.includes('CAUTION') ? 'text-yellow-500' : 'text-green-500'}`}>
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
                              <h3 className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-1">Data confidence notes</h3>
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
                      Mission synthesis notes active.
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
                        <span className={`font-bold ${(aiRiskResult?._dataSources || result.dataSources).manualOverride === 'ACTIVE' ? 'text-yellow-400' : 'text-slate-500'}`}>SUPPORT ACTIVE</span>
                      </div>

                      {aiRiskResult?._dataSources && (aiRiskResult._dataSources.weather !== 'LIVE' || aiRiskResult._dataSources.flight === 'NOT_CONNECTED') && (
                        <div className="mt-2 text-[9px] text-orange-400/80 italic leading-snug">
                          Some operational inputs are derived or estimated; AI-assisted analysis confidence may be adjusted.
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
                                <span className={`text-[8px] font-black uppercase rounded border px-1.5 py-0.5 ${(aiRiskResult?._dataSources || result.dataSources).flight === 'LIVE' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'}`}>
                                  {(aiRiskResult?._dataSources || result.dataSources).flight === 'LIVE' ? 'LIVE DATA' : 'DEMO DATASET'}
                                </span>
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
                        <p className="text-xs text-slate-500 leading-relaxed italic">No live flight selected. AI-assisted mission evaluation active.</p>
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
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${weatherData.source === 'FALLBACK' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                          {weatherData.source === 'FALLBACK' ? 'DERIVED' : 'LIVE'}
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

                  <Panel title="Cyber-Operational Exposure Indicator" icon={<svg className="w-4 h-4 mr-2 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} glow={cyberExposure.level === 'High'}>
                    {isGeneratingCyber && !cyberIndicator ? (
                      <div className="flex flex-col items-center justify-center py-8 h-full text-center">
                        <svg className="w-5 h-5 text-teal-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-[9px] text-teal-400 animate-pulse font-bold tracking-widest uppercase">Estimating cyber exposure...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center space-x-1.5">
                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded border inline-block ${cyberExposure.level === 'High' ? 'bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : cyberExposure.level === 'Medium' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-teal-500/20 text-teal-400 border-teal-500/50'}`}>
                              {cyberExposure.level} EXPOSURE
                            </span>
                            {cyberIndicator?._fallback ? (
                              <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">AI Assessment Active</span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-green-500/10 text-green-400 border border-green-500/20">AI Assessment Active</span>
                            )}
                          </div>
                          <span className="text-[10px] font-black font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">SCORE: {cyberExposure.score}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">{cyberExposure.summary || cyberExposure.explanation}</p>
                        {cyberExposure.actions && (
                          <div className="mt-2">
                            <h4 className="text-[9px] font-black text-teal-500 uppercase tracking-widest mb-2 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                              Strategic Awareness Actions:
                            </h4>
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
                            {isGeneratingCyber ? 'Generating...' : 'Generate AI Cyber Briefing'}
                          </button>
                          {!speechSupported ? (
                            <div className="text-[8px] text-cyan-400/80 italic flex items-center justify-center px-1 flex-1">Voice synthesis active</div>
                          ) : (
                            <div className="flex-1 flex space-x-1">
                              {!isSpeaking ? (
                                <button onClick={() => {
                                  const speechText = `Cyber-Operational Exposure: ${cyberExposure.level} level with a score of ${cyberExposure.score}. Summary: ${cyberExposure.summary || cyberExposure.explanation}. Recommended actions: ${cyberExposure.actions.join(', ')}`;
                                  speakText(speechText);
                                }} disabled={isGeneratingCyber} className="flex-1 bg-teal-900/20 hover:bg-teal-900/40 text-[8px] text-teal-400 font-bold uppercase tracking-widest py-1.5 rounded border border-teal-800/50 transition-colors flex items-center justify-center space-x-1">
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                  <span>Play Briefing</span>
                                </button>
                              ) : (
                                <>
                                  {isPaused ? (
                                    <button onClick={resumeSpeech} className="flex-1 bg-green-900/20 hover:bg-green-900/40 text-[8px] text-green-400 font-bold uppercase tracking-widest py-1.5 rounded border border-green-800/50 transition-colors flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                      Resume
                                    </button>
                                  ) : (
                                    <button onClick={pauseSpeech} className="flex-1 bg-yellow-900/20 hover:bg-yellow-900/40 text-[8px] text-yellow-400 font-bold uppercase tracking-widest py-1.5 rounded border border-yellow-800/50 transition-colors flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                      Pause
                                    </button>
                                  )}
                                  <button onClick={stopSpeech} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-[8px] text-red-400 font-bold uppercase tracking-widest py-1.5 rounded border border-red-800/50 transition-colors flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                                    Stop
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Panel>

                </div>
              </div> {/* Close COL 2 */}
              {/* Mission Replay & Map View Panel (FULL WIDTH) */}
              <div className="lg:col-span-12">
                <Panel title="Mission Replay & Visual Intelligence" icon={<svg className="w-4 h-4 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}>
                  {(!aiRiskResult || aiRiskResult._error) && (!result) ? (
                    <div className="flex items-center justify-center h-full min-h-[200px] text-xs text-slate-500 italic border border-slate-800 rounded-xl bg-slate-900/30">
                      Run AI Risk Assessment to generate mission replay context.
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* MAP SECTION - FULL WIDTH */}
                      <div className="relative w-full h-[400px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl">
                        {googleMapsApiKey ? (
                          <div ref={mapRef} className="w-full h-full" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 bg-slate-900/50">
                            <svg className="w-12 h-12 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Tactical Map View</p>
                            <p className="text-[10px] mt-2 opacity-60">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable satellite telemetry.</p>
                          </div>
                        )}

                        {/* OVERLAYS ON MAP */}
                        <div className="absolute top-6 left-6 pointer-events-none">
                          <div className="bg-slate-950/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-slate-700/50 shadow-2xl pointer-events-auto">
                            <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-2">Active Mission Route</div>
                            {selectedFlight && selectedFlight.departureIata ? (
                              <div className="text-sm font-black text-white flex items-center">
                                <span className="bg-slate-800 px-2 py-1 rounded">{selectedFlight.departureIata}</span>
                                <svg className="w-4 h-4 mx-3 text-cyan-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                <span className="bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded border border-cyan-500/30">{airportProfile?.iata || airportProfile?.icao || airport}</span>
                              </div>
                            ) : (
                              <div className="text-sm font-black text-white flex items-center">
                                <span className="bg-slate-800 px-2 py-1 rounded">LOCAL OPS</span>
                                <svg className="w-4 h-4 mx-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                <span className="bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded border border-cyan-500/30">{airportProfile?.iata || airportProfile?.icao || airport}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* MISSION REPLAY ANIMATION SECTION - CENTERED & DOMINANT */}
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <LandingVisualization 
                          mode="dashboard"
                          riskLevel={
                            (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result?.score || 0) >= 75 ? 'Critical' :
                            (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result?.score || 0) >= 50 ? 'High' :
                            (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result?.score || 0) >= 25 ? 'Medium' : 'Low'
                          }
                          riskScore={aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result?.score || 0}
                        />

                        {/* Replay Details */}
                        <div className="relative z-10 w-full text-center mt-2">
                          <div className="inline-flex flex-wrap gap-3 justify-center items-center bg-slate-950/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-800 shadow-xl">
                            <span className={`px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] rounded-lg border shadow-lg ${operationalRecommendation?.primaryRecommendation === 'DIVERT' ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : operationalRecommendation?.primaryRecommendation === 'HOLD' ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' : operationalRecommendation?.primaryRecommendation === 'PROCEED_WITH_CAUTION' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' : 'bg-green-500/20 text-green-500 border-green-500/50'}`}>
                              {operationalRecommendation?.primaryRecommendation?.replace(/_/g, ' ') || 'N/A'}
                            </span>
                            <div className="h-4 w-px bg-slate-800 mx-2"></div>
                            <span className="text-xs font-black text-white uppercase tracking-widest">
                              RISK SCORE: <span className="text-cyan-400">{aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result?.score}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                        {/* TOP 3 LANDING RISKS CARD - CENTERED GRID */}
                        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                          {(dynamicRisks?.risks || getTop3Risks()).map((risk, index) => (
                            <div key={index} className="flex flex-col p-6 border border-slate-800 bg-slate-900/40 rounded-3xl hover:border-cyan-500/30 transition-all group">
                              <div className="flex items-center mb-4">
                                <span className="w-8 h-8 rounded-full bg-cyan-900/50 border border-cyan-500/30 text-xs font-black text-cyan-400 flex items-center justify-center mr-3 flex-shrink-0 group-hover:scale-110 transition-transform">{index + 1}</span>
                                <div className="flex-grow">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority Risk</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {!isSpeaking ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        speakText(`Hazard ${index + 1}: ${risk}`);
                                      }}
                                      className="p-1.5 rounded-lg transition-colors hover:bg-cyan-500/20 text-slate-500 hover:text-cyan-400"
                                      title="Speak Risk"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                    </button>
                                  ) : (
                                    <>
                                      {isPaused ? (
                                        <button onClick={(e) => { e.stopPropagation(); resumeSpeech(); }} className="p-1.5 rounded-lg transition-colors hover:bg-green-500/20 text-green-400" title="Resume">
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </button>
                                      ) : (
                                        <button onClick={(e) => { e.stopPropagation(); pauseSpeech(); }} className="p-1.5 rounded-lg transition-colors hover:bg-yellow-500/20 text-yellow-400" title="Pause">
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                        </button>
                                      )}
                                      <button onClick={(e) => { e.stopPropagation(); stopSpeech(); }} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20 text-red-400" title="Stop">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-slate-200 leading-relaxed font-medium">{risk}</p>
                            </div>
                          ))}
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
          <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col h-full py-8">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-5xl font-black text-white tracking-tighter">Pilot Briefing</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Mission Intelligence Synthesis</p>
              </div>
              <button
                onClick={() => setAppScreen('dashboard')}
                className="group flex items-center bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Tactical Dashboard
              </button>
            </div>

            {/* Centered Primary Decision Gauge */}
            <div className="flex flex-col items-center mb-12">
              <div className="relative bg-slate-900/60 backdrop-blur-2xl border border-slate-800 p-10 rounded-[40px] shadow-2xl w-full max-w-2xl flex flex-col items-center text-center group">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-950 px-4 py-1 rounded-full border border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  System Final Recommendation
                </div>

                <div className={`text-7xl sm:text-9xl font-black uppercase tracking-tighter mb-4 ${operationalRecommendation?.primaryRecommendation === 'DIVERT' ? 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse' : operationalRecommendation?.primaryRecommendation === 'HOLD' ? 'text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]' : operationalRecommendation?.primaryRecommendation === 'PROCEED_WITH_CAUTION' ? 'text-yellow-500 drop-shadow-[0_0_30px_rgba(234,179,8,0.4)]' : 'text-green-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]'}`}>
                  {operationalRecommendation?.primaryRecommendation?.replace(/_/g, ' ') || 'N/A'}
                </div>

                <div className="flex items-center gap-4 mt-2">
                  {!isSpeaking ? (
                    <button
                      onClick={() => speakText(`Final Recommendation: ${operationalRecommendation?.primaryRecommendation?.replace(/_/g, ' ') || 'N/A'}. Risk Score: ${aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score}.`)}
                      className="flex items-center text-[10px] font-black border bg-white/10 text-white border-white/20 hover:bg-white/20 px-4 py-2 rounded-full transition-all uppercase tracking-widest shadow-lg"
                    >
                      <svg className="w-3.5 h-3.5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      Play Summary
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {isPaused ? (
                        <button onClick={resumeSpeech} className="flex items-center text-[10px] font-black border bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 px-4 py-2 rounded-full transition-all uppercase tracking-widest">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          Resume
                        </button>
                      ) : (
                        <button onClick={pauseSpeech} className="flex items-center text-[10px] font-black border bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30 px-4 py-2 rounded-full transition-all uppercase tracking-widest">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                          Pause
                        </button>
                      )}
                      <button onClick={stopSpeech} className="flex items-center text-[10px] font-black border bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 px-4 py-2 rounded-full transition-all uppercase tracking-widest">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                        Stop
                      </button>
                    </div>
                  )}
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                    Risk Score: <span className="text-white">{aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score}</span>
                  </div>
                  <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-400/10 px-3 py-1 rounded-lg border border-cyan-400/20">AI-Assisted Assessment</div>
                </div>
              </div>
            </div>

            {/* Split View: Visualization & Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Landing Visualization (Dominant) */}
              <div className="lg:col-span-1">
                <LandingVisualization
                  mode="pilot"
                  riskLevel={
                    (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score) >= 75 ? 'Critical' :
                      (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score) >= 50 ? 'High' :
                        (aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score) >= 25 ? 'Medium' : 'Low'
                  }
                  riskScore={aiRiskResult && !aiRiskResult.error ? aiRiskResult.overallRiskScore : result.score}
                />
              </div>

              {/* Pilot Action Checklist */}
              <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-xl p-8 rounded-[32px] border border-slate-800 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] flex items-center">
                    <svg className="w-5 h-5 mr-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Operational Directives
                  </h3>
                  {!isSpeaking ? (
                    <button
                      onClick={() => speakText("Operational Directives: " + (aiDirectives || operationalRecommendation?.pilotActions || []).join(". "))}
                      className="flex items-center text-[10px] font-black border bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 px-3 py-1.5 rounded-full transition-all uppercase tracking-widest"
                    >
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      Play Directives
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {isPaused ? (
                        <button onClick={resumeSpeech} className="flex items-center text-[10px] font-black border bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 px-3 py-1.5 rounded-full transition-all uppercase tracking-widest">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          Resume
                        </button>
                      ) : (
                        <button onClick={pauseSpeech} className="flex items-center text-[10px] font-black border bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30 px-3 py-1.5 rounded-full transition-all uppercase tracking-widest">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                          Pause
                        </button>
                      )}
                      <button onClick={stopSpeech} className="flex items-center text-[10px] font-black border bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 px-3 py-1.5 rounded-full transition-all uppercase tracking-widest">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                        Stop
                      </button>
                    </div>
                  )}
                </div>
                <ul className="space-y-4">
                  {operationalRecommendation?.pilotActions.map((action: string, i: number) => (
                    <li key={i} className="flex items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 hover:border-cyan-500/30 transition-colors group">
                      <span className="w-6 h-6 rounded-lg bg-cyan-900/30 border border-cyan-500/30 text-[10px] font-black text-cyan-400 flex items-center justify-center mr-4 flex-shrink-0 group-hover:scale-110 transition-transform">{i + 1}</span>
                      <span className="text-sm text-slate-200 font-medium leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* AI Safety Officer Briefing - Centered & Premium */}
            <div className="w-full">
              <Panel title="AI Safety Synthesis" icon={<svg className="w-4 h-4 mr-2 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}>
                <div className="flex flex-col min-h-[300px] p-2">
                  {/* Voice Controls */}
                  <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Synthetic Voice Assistant</div>
                    {!speechSupported ? null : (
                      <div className="flex items-center space-x-3">
                        {!isSpeaking ? (
                          <button onClick={handleSpeakBriefing} className="flex items-center text-[10px] font-black bg-purple-600 text-white px-5 py-2.5 rounded-full hover:bg-purple-500 transition-all uppercase tracking-widest shadow-lg shadow-purple-500/20 group">
                            <svg className="w-3 h-3 mr-2 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            Speak Briefing
                          </button>
                        ) : (
                          <>
                            {isPaused ? (
                              <button onClick={resumeSpeech} className="flex items-center text-[10px] font-black bg-green-600 text-white px-5 py-2.5 rounded-full hover:bg-green-500 transition-all uppercase tracking-widest shadow-lg shadow-green-500/20 group">
                                <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                Resume
                              </button>
                            ) : (
                              <button onClick={pauseSpeech} className="flex items-center text-[10px] font-black bg-yellow-600 text-white px-5 py-2.5 rounded-full hover:bg-yellow-500 transition-all uppercase tracking-widest shadow-lg shadow-yellow-500/20 group">
                                <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                Pause
                              </button>
                            )}
                            <button onClick={stopSpeech} className="flex items-center text-[10px] font-black bg-red-500 text-white px-5 py-2.5 rounded-full hover:bg-red-600 transition-colors uppercase tracking-widest shadow-lg shadow-red-500/20">
                              <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {aiBriefing ? (
                    <div className="text-base text-slate-200 leading-relaxed font-medium bg-slate-950/50 p-8 rounded-[32px] border border-slate-800">
                      <div className="space-y-6">
                        {aiBriefing.split('\n').map((line, i) => {
                          if (!line.trim()) return null;
                          if (line.includes(':') && line.split(':')[0].length < 30) {
                            const [heading, ...rest] = line.split(':');
                            const content = rest.join(':').trim();
                            return (
                              <div key={i} className="border-l-2 border-purple-500/30 pl-6 py-1">
                                <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2">{heading}</h4>
                                <p className="text-slate-200 text-sm">{content}</p>
                              </div>
                            );
                          }
                          return <p key={i} className="text-slate-300 text-sm leading-relaxed">{line}</p>;
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 bg-slate-950/30 rounded-[32px] border border-dashed border-slate-800">
                      <div className="w-16 h-16 bg-purple-900/20 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.674a1 1 0 00.922-.617l2.108-4.742A1 1 0 0016.445 10H7.555a1 1 0 00-.922.641l2.108 4.742a1 1 0 00.922.617zM2 17V7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2z" /></svg>
                      </div>
                      <h4 className="text-lg font-black text-white mb-2">Ready for AI Synthesis</h4>
                      <p className="text-sm text-slate-400 mb-8 max-w-md">The AI will process all tactical inputs to provide a high-level safety narrative for this mission.</p>
                      <button
                        onClick={handleGenerateBriefing}
                        disabled={isGeneratingBriefing}
                        className="relative group bg-white text-slate-950 px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-purple-500 hover:text-white transition-all shadow-xl hover:shadow-purple-500/20 disabled:opacity-50"
                      >
                        {isGeneratingBriefing ? 'Synthesizing Tactical Intel...' : 'Generate AI Briefing'}
                      </button>
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div className="mt-12 flex justify-center">
              <button
                onClick={handleStartNewMission}
                className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 px-12 py-4 rounded-full text-xs font-black uppercase tracking-[0.3em] transition-all hover:scale-105 active:scale-95 shadow-2xl"
              >
                Reset Mission Control
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
  const dashArrayValue = (normalizedScore / 100) * 251.2; // Adjusted for 80 radius

  const color = level === 'Critical' ? 'text-red-500' : level === 'High' ? 'text-orange-500' : level === 'Medium' ? 'text-yellow-500' : 'text-green-500';
  const decisionColor = decision === 'DIVERT' ? 'text-red-500 animate-pulse' : decision === 'HOLD' ? 'text-orange-500' : decision === 'CAUTION' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="relative flex flex-col items-center py-4 w-full">
      <div className="relative w-64 h-32 overflow-hidden mb-4">
        <svg className="w-64 h-64 transform origin-bottom" viewBox="0 0 200 200">
          <path className="text-slate-800/40" strokeWidth="12" stroke="currentColor" fill="none" strokeLinecap="round" d="M 20,100 A 80,80 0 1,1 180,100" />
          <path className={`${color} transition-all duration-1500 ease-out`} strokeDasharray={`${dashArrayValue}, 251.2`} strokeWidth="12" stroke="currentColor" fill="none" strokeLinecap="round" d="M 20,100 A 80,80 0 1,1 180,100" />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-2">
          <span className={`text-6xl font-black leading-none tracking-tighter ${color}`}>{score}</span>
        </div>
      </div>
      <div className="text-center mt-6">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Final Operational Decision</div>
        <div className={`text-4xl font-black uppercase tracking-widest ${decisionColor} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>{decision}</div>
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
