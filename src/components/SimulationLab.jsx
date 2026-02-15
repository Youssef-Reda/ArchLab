import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Waves, Signal, Watch, Zap } from 'lucide-react';

// --- 1. LOGIC & CONSTANTS ---

const CONSTANTS = {
  DEFAULT_SAMPLE_RATE: 50, 
  BYTES_PER_FLOAT: 4,
};

// Signal Processor Class 
class SignalProcessor {
  constructor(sampleRate) {
    this.sampleRate = sampleRate || CONSTANTS.DEFAULT_SAMPLE_RATE;
  }
  
  // --- PHYSICS ENGINE ---
  getInstantaneousValue(t, heartRateBpm, noiseLevel, motionArtifact, respirationArtifact) {
    const heartRateHz = heartRateBpm / 60;
    const cardiac = 0.5 + 0.4 * Math.sin(2 * Math.PI * heartRateHz * t) + 0.1 * Math.sin(4 * Math.PI * heartRateHz * t);
    const motion = motionArtifact * Math.sin(2 * Math.PI * 2 * t + Math.random());
    const respiration = respirationArtifact * Math.sin(2 * Math.PI * 0.25 * t);
    const noise = noiseLevel * (Math.random() - 0.5);
    return cardiac + motion + respiration + noise;
  }
  
  applyMovingAverageFilter(buffer, cutoffHz) {
    if (buffer.length === 0) return 0;
    const windowSize = Math.max(1, Math.floor(this.sampleRate / cutoffHz));
    const start = Math.max(0, buffer.length - windowSize);
    const subset = buffer.slice(start);
    const sum = subset.reduce((a, b) => a + b, 0);
    return sum / subset.length;
  }
  
  // --- ALGO 1: BASIC PEAK DETECTION ---
  detectPeaksBasic(signalData, threshold = 0.1) {
    const peaks = [];
    for (let i = 1; i < signalData.length - 1; i++) {
      // Simple local maxima check on AC component
      if (signalData[i].ac > signalData[i-1].ac && 
          signalData[i].ac > signalData[i+1].ac && 
          signalData[i].ac > threshold) {
        peaks.push(i);
      }
    }
    return peaks;
  }
  
  calculateHeartRateBasic(peaks) {
    if (peaks.length < 2) return 0;
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      const intervalSamples = peaks[i] - peaks[i-1];
      const intervalSeconds = intervalSamples / this.sampleRate;
      intervals.push(intervalSeconds);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval > 0 ? Math.round(60 / avgInterval) : 0;
  }

  // --- ALGO 2: DSP (AUTOCORRELATION) ---
  calculateHeartRateDSP(buffer) {
     const n = buffer.length;
     // Use filtered AC data
     const input = buffer.map(b => b.ac);
     
     let bestCorrelation = -1;
     let bestLag = 0;

     // Search range: 40 BPM (75 samples) to 200 BPM (15 samples)
     for (let lag = 15; lag < 75; lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
            sum += input[i] * input[i+lag];
        }
        const avgCorr = sum / (n - lag);
        
        if (avgCorr > bestCorrelation) {
            bestCorrelation = avgCorr;
            bestLag = lag;
        }
     }
     
     // Threshold to reject pure noise
     if (bestCorrelation > 0.05) {
         const period = bestLag / this.sampleRate;
         return Math.round(60 / period);
     }
     return 0;
  }
  
  calculateSpo2(redAc, redDc, irAc, irDc) {
    if (redDc === 0 || irDc === 0) return 0;
    const R = (redAc / redDc) / (irAc / irDc);
    const spo2 = 110 - 25 * R;
    return Math.max(85, Math.min(100, Math.round(spo2)));
  }
}

// --- 2. MAIN COMPONENT ---

const SimulationLab = ({ config, simParams, metrics, onParamChange }) => {
  // --- STATE ---
  // Local state for sliders (Stable)
  const [localParams, setLocalParams] = useState(() => ({
    heartRate: simParams?.heartRate || 70,
    spo2: simParams?.spo2 || 98,
    noiseLevel: simParams?.noiseLevel || 0,
    motionArtifact: simParams?.motionArtifact || 0,
    noiseLevel: 0, 
    motionArtifact: 0,
    filterCutoff: simParams?.filterCutoff || 5
  }));

  const [displayData, setDisplayData] = useState([]);
  const [readings, setReadings] = useState({ hr: '--', spo2: '--', status: 'INIT' });
  const [calculatedSnr, setCalculatedSnr] = useState(0);

  const handleSliderChange = (key, value) => {
    const newVal = parseFloat(value);
    setLocalParams(prev => ({ ...prev, [key]: newVal }));
    if (onParamChange) {
        onParamChange(key, newVal);
    }
  };

  // --- REFS ---
  const bufferRaw = useRef([]);      
  const bufferFiltered = useRef([]); 
  const bufferRedRaw = useRef([]);   
  const bufferProcessed = useRef([]); 
  
  const paramsRef = useRef(localParams);
  const configRef = useRef(config);

  useEffect(() => {
    paramsRef.current = localParams;
    configRef.current = config;
  }, [localParams, config]);

  const phaseRef = useRef(0);

  // --- PHYSICS ENGINE (THE LIVE LOOP) ---
  useEffect(() => {
    const processor = new SignalProcessor(CONSTANTS.DEFAULT_SAMPLE_RATE);
    
    const tick = setInterval(() => {
      const params = paramsRef.current;
      
      // 1. Advance Time
      phaseRef.current += (1 / CONSTANTS.DEFAULT_SAMPLE_RATE);
      const t = phaseRef.current;

      // 2. Generate Primary Signal
      const rawPrimary = processor.getInstantaneousValue(
        t, 
        params.heartRate, 
        params.noiseLevel, 
        params.motionArtifact, 
        0.02
      );

      // 3. Generate Red Signal (SpO2)
      const targetSpo2 = params.spo2;
      const targetR = (110 - targetSpo2) / 25;
      const rawRed = rawPrimary * targetR; 

      // 4. Update FIFO Buffers
      const updateFifo = (ref, val) => {
        ref.current.push(val);
        if (ref.current.length > 200) ref.current.shift();
      };

      updateFifo(bufferRaw, rawPrimary);
      updateFifo(bufferRedRaw, rawRed);

      // 5. Filter
      const filteredVal = processor.applyMovingAverageFilter(bufferRaw.current, params.filterCutoff);
      updateFifo(bufferFiltered, filteredVal);

      // 6. Process Point
      const dc = bufferFiltered.current.reduce((a,b)=>a+b,0) / (bufferFiltered.current.length || 1);
      const ac = filteredVal - dc;
      
      const processedPoint = {
        time: t,
        raw: rawPrimary,
        filtered: filteredVal,
        dc: dc,
        ac: ac,
        rawRed: rawRed,
        // BUG FIX: Add rawIr explicit mapping for chart
        rawIr: rawPrimary, 
        rawGreen: rawPrimary * 0.8
      };
      
      updateFifo(bufferProcessed, processedPoint);
      setDisplayData([...bufferProcessed.current]); 

    }, 20); // 50Hz

    return () => clearInterval(tick);
  }, []); 


  // --- ALGORITHM RUNNER ---
  useEffect(() => {
    const processor = new SignalProcessor(CONSTANTS.DEFAULT_SAMPLE_RATE);

    const algoInterval = setInterval(() => {
      if (bufferProcessed.current.length < 50) return;

      const dataSnapshot = bufferProcessed.current;
      const params = paramsRef.current;
      const algoType = configRef.current?.software?.id || 'basic_algo';

      // 1. Calculate SNR
      const signalPower = 0.5;
      const noisePower = (params.noiseLevel) + (params.motionArtifact) + 0.001;
      const snr = 20 * Math.log10(signalPower / noisePower);
      setCalculatedSnr(Math.max(0, snr));

      let hr = 0;
      let status = 'Scanning...';

      // 2. RUN SELECTED ALGORITHM
      if (algoType === 'basic_algo') {
          // BASIC: Simple Peak Detection
          // Vulnerable to noise/motion
          if (params.motionArtifact > 0.15 || params.noiseLevel > 0.2) {
              hr = 0;
              status = 'Noise Error';
          } else {
              const peaks = processor.detectPeaksBasic(dataSnapshot, 0.1);
              hr = processor.calculateHeartRateBasic(peaks);
              status = hr > 0 ? 'Locked' : 'Scanning...';
          }
      } 
      else if (algoType === 'dsp_algo') {
          // DSP: Autocorrelation
          // Robust to noise, but computationally heavier (simulated delay/stability)
          hr = processor.calculateHeartRateDSP(dataSnapshot);
          
          if (hr > 0) status = 'DSP Tracked';
          else if (snr < 5) status = 'Weak Signal';
          else status = 'Scanning...';
      }
      else if (algoType === 'ml_algo') {
          // ML: Confidence Estimation
          // Works even in low SNR by "predicting" pattern
          if (snr > 0) {
              const jitter = (Math.random() - 0.5) * 3;
              hr = Math.round(params.heartRate + jitter);
              status = 'AI Infer';
          } else {
              status = 'Lost';
          }
      }

      // 3. SpO2 Calculation
      const getStats = (arrFiltered) => {
         const dc = arrFiltered.reduce((a,b)=>a+b,0) / (arrFiltered.length || 1);
         const variance = arrFiltered.reduce((a, v) => a + Math.pow(v - dc, 2), 0) / (arrFiltered.length || 1);
         return { ac: Math.sqrt(variance), dc };
      };

      const statsIr = getStats(bufferFiltered.current);
      const statsRed = { ac: statsIr.ac * ((110 - (params.spo2))/25), dc: statsIr.dc };

      let spo2 = processor.calculateSpo2(statsRed.ac, statsRed.dc, statsIr.ac, statsIr.dc);

      setReadings({
          hr: hr || '--',
          spo2: spo2 || 98,
          status: status
      });

    }, 500); 

    return () => clearInterval(algoInterval);
  }, []);


  // --- STYLES ---
  const getDeviceStyle = () => {
    const displayId = config?.display?.id || 'amoled'; 
    switch (displayId) {
        case 'oled_mono':
            return {
                shape: 'rounded-sm w-36 h-20',
                bg: 'bg-black border-slate-700',
                textPrimary: 'text-cyan-400 font-mono text-xl tracking-tighter',
                textSecondary: 'text-cyan-600 font-mono text-[9px]',
                label: 'OLED 128x64'
            };
        case 'tft_color':
            return {
                shape: 'rounded-lg w-28 h-32',
                bg: 'bg-slate-800 border-slate-600',
                textPrimary: 'text-white font-sans text-3xl font-bold',
                textSecondary: 'text-slate-300 font-sans text-[10px]',
                label: 'LCD 240x280'
            };
        case 'amoled':
        default:
            return {
                shape: 'rounded-full w-32 h-32',
                bg: 'bg-black border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.5)]',
                textPrimary: 'text-emerald-400 font-sans text-4xl font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]',
                textSecondary: 'text-emerald-700 font-sans text-xs font-bold uppercase',
                label: 'AMOLED 454px'
            };
    }
  };

  const deviceStyle = getDeviceStyle();
  const emitterId = config?.emitters?.id || 'multi';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Waves size={20} className="text-indigo-600"/> 
          Algorithm Simulation Lab
        </h3>
        <div className="flex gap-2 items-center">
            <div className={`px-3 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                readings.status.includes('Locked') || readings.status.includes('Tracked') || readings.status.includes('AI')
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
                {readings.status}
            </div>
            <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                FW: {config?.software?.name || 'Standard'}
            </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT: SLIDERS */}
        <div className="w-full lg:w-1/3 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-100 h-fit">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Target HR</label>
              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{localParams.heartRate} BPM</span>
            </div>
            <input 
              type="range" min="40" max="180" 
              value={localParams.heartRate} 
              onChange={(e) => handleSliderChange('heartRate', e.target.value)} 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className={emitterId === 'green_only' ? 'opacity-40 pointer-events-none grayscale' : ''}>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Target SpO2</label>
              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{localParams.spo2}%</span>
            </div>
            <input 
              type="range" min="80" max="100" 
              value={localParams.spo2} 
              onChange={(e) => handleSliderChange('spo2', e.target.value)} 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Motion Artifacts</label>
              <span className="text-xs font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded">{(localParams.motionArtifact * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" min="0" max="0.5" step="0.01" 
              value={localParams.motionArtifact} 
              onChange={(e) => handleSliderChange('motionArtifact', e.target.value)} 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Sensor Noise</label>
              <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{(localParams.noiseLevel * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" min="0" max="0.5" step="0.01" 
              value={localParams.noiseLevel} 
              onChange={(e) => handleSliderChange('noiseLevel', e.target.value)} 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        </div>

        {/* RIGHT: VISUALIZATION */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* CHART */}
          <div className="h-[300px] bg-white rounded-lg p-2 border border-slate-200 relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  domain={['auto', 'auto']} 
                  width={45} 
                  tick={{fontSize: 10, fill: '#64748b'}} 
                  tickFormatter={(val) => val.toFixed(1)}
                />
                <Tooltip contentStyle={{fontSize:'12px'}} labelFormatter={() => ''} />
                <Legend verticalAlign="top" iconSize={8} height={20}/>
                
                {emitterId === 'green_only' && (
                  <>
                    <Line name="Green Raw" dataKey="rawGreen" stroke="#86efac" dot={false} strokeWidth={1} isAnimationActive={false} />
                    <Line name="Filtered" dataKey="filtered" stroke="#16a34a" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </>
                )}
                
                {(emitterId === 'red_ir' || emitterId === 'multi') && (
                  <>
                    <Line name="IR Raw" dataKey="rawIr" stroke="#a5b4fc" dot={false} strokeWidth={1} isAnimationActive={false} />
                    <Line name="Red Raw" dataKey="rawRed" stroke="#fca5a5" dot={false} strokeWidth={1} isAnimationActive={false} />
                  </>
                )}
                
                {emitterId === 'multi' && (
                     <Line name="Green Raw" dataKey="rawGreen" stroke="#86efac" dot={false} strokeWidth={1} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* BOTTOM: DEVICE PREVIEW + SNR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-[180px]">
             
             {/* 1. DEVICE OUTPUT PREVIEW */}
             <div className="bg-slate-100 rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center relative">
                 <div className="absolute top-2 left-3 flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Watch size={12} /> {deviceStyle.label}
                 </div>
                 
                 <div className={`${deviceStyle.shape} ${deviceStyle.bg} border-4 shadow-xl flex flex-col items-center justify-center transition-all duration-300`}>
                     <div className="text-center">
                         {readings.hr !== '--' ? (
                             <>
                                <div className={deviceStyle.textPrimary}>
                                    {readings.hr}
                                    <span className={`ml-1 text-[10px] ${config?.display?.id === 'oled_mono' ? 'text-cyan-600' : 'text-slate-400'}`}>BPM</span>
                                </div>
                                <div className={deviceStyle.textSecondary}>
                                    {emitterId === 'green_only' ? '--' : readings.spo2} % SpO2
                                </div>
                             </>
                         ) : (
                             <div className="text-red-500 font-bold text-[10px] animate-pulse">NO SIGNAL</div>
                         )}
                     </div>
                 </div>
             </div>

             {/* 2. SNR METER */}
             <div className="bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner border border-slate-800 relative">
                 <div className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Zap size={12} /> Signal Quality
                 </div>
                 
                 <div className="flex items-center gap-3 mb-1">
                   <Signal size={24} className={calculatedSnr > 8 ? "text-emerald-400" : "text-red-500"} />
                 </div>
                 
                 <div className="text-5xl font-bold text-white tracking-tighter">
                    {calculatedSnr ? calculatedSnr.toFixed(1) : '0.0'}
                 </div>
                 <div className="text-xs font-mono text-slate-500 mt-1">dB SNR</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationLab;