import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Waves, Signal, Watch, Zap } from 'lucide-react';

const SimulationLab = ({ config, simParams, metrics, onParamChange }) => {
  // --- STATE ---
  const [displayData, setDisplayData] = useState([]);
  const [readings, setReadings] = useState({ hr: '--', spo2: '--', status: 'INIT' });

  // --- REFS (FIFO BUFFERS) ---
  const bufferRawRed = useRef([]);
  const bufferRawIr = useRef([]);
  const bufferRawGreen = useRef([]);
  const bufferFiltered = useRef([]); 
  
  // Physics State
  const phaseRef = useRef(0);
  const timeRef = useRef(0);

  // --- 1. PHYSICS ENGINE (50Hz Sampling) ---
  useEffect(() => {
    const SAMPLING_RATE = 50; 
    const PERIOD = 1 / SAMPLING_RATE; // 0.02s
    const POINTS_PER_TICK = 2; // Generate 2 points per 40ms tick (50Hz total)

    const tick = setInterval(() => {
      // Physics Parameters
      const targetBpm = simParams.heartRate;
      const noiseLevel = simParams.noiseLevel; 
      const motionLevel = simParams.motionArtifact; 
      
      const freq = targetBpm / 60; 
      const spo2Factor = (110 - simParams.spo2) / 25; 
      
      for (let i = 0; i < POINTS_PER_TICK; i++) {
        timeRef.current += PERIOD;
        phaseRef.current += (freq * PERIOD); 

        // Cardiac Pulse
        const t = phaseRef.current % 1; 
        let pulse = Math.exp(-Math.pow(t - 0.15, 2) / 0.01); 
        pulse += 0.3 * Math.exp(-Math.pow(t - 0.45, 2) / 0.02); 

        // Noise Vectors
        const whiteNoise = (Math.random() - 0.5) * noiseLevel * 10;
        const motionWander = Math.sin(timeRef.current * Math.PI * 1.5) * motionLevel * 50;
        
        // Baselines
        const DC_IR = 50000;
        const DC_RED = 45000;
        const DC_GREEN = 30000;
        
        const AC_IR = 1000; 
        const AC_RED = 1000 * spo2Factor; 
        const AC_GREEN = 1500; 

        // Generate Signals
        const valIr = DC_IR - (pulse * AC_IR) + whiteNoise + motionWander;
        const valRed = DC_RED - (pulse * AC_RED) + whiteNoise + motionWander;
        const valGreen = DC_GREEN - (pulse * AC_GREEN) + whiteNoise + motionWander;

        // Primary Signal Selection
        let rawPrimary = (config.emitters.id === 'green_only' || config.emitters.id === 'multi') ? valGreen : valIr;

        // Low Pass Filter (AFE Simulation)
        const alpha = 0.2; 
        const lastFiltered = bufferFiltered.current.length > 0 
            ? bufferFiltered.current[bufferFiltered.current.length - 1] 
            : rawPrimary;
        const valFiltered = (rawPrimary * alpha) + (lastFiltered * (1 - alpha));

        // Push to FIFO Buffers (Keep last 5 seconds / 250 points)
        const updateBuffer = (ref, val) => {
          ref.current.push(val);
          if (ref.current.length > 150) ref.current.shift();
        };

        updateBuffer(bufferRawRed, valRed);
        updateBuffer(bufferRawIr, valIr);
        updateBuffer(bufferRawGreen, valGreen);
        updateBuffer(bufferFiltered, valFiltered);
      }

      // Update UI Data
      const points = bufferFiltered.current.map((_, idx) => ({
        time: idx,
        filtered: bufferFiltered.current[idx],
        rawIr: bufferRawIr.current[idx],
        rawRed: bufferRawRed.current[idx],
        rawGreen: bufferRawGreen.current[idx]
      }));
      setDisplayData(points);

    }, 40); 

    return () => clearInterval(tick);
  }, [simParams, config.emitters.id]);


  // --- 2. FIRMWARE ALGORITHMS ---
  useEffect(() => {
    const runAlgorithm = setInterval(() => {
        if (bufferFiltered.current.length < 50) return;

        let resultHr = '--';
        let resultSpo2 = '--';
        let algoStatus = 'Scanning...';

        const normalize = (arr) => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            return arr.map(v => v - mean);
        };

        const getRms = (arr) => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            const variance = arr.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / arr.length;
            return Math.sqrt(variance);
        };

        // ALGO 1: BASIC PEAK DETECTOR
        if (config.software.id === 'basic_algo') {
            const sourceBuffer = (config.emitters.id === 'green_only' || config.emitters.id === 'multi') 
                ? bufferRawGreen.current 
                : bufferRawIr.current;

            const norm = normalize(sourceBuffer);
            let crossings = 0;
            for (let i = 1; i < norm.length; i++) {
                if (norm[i-1] > 0 && norm[i] <= 0) crossings++;
            }

            const durationSec = sourceBuffer.length * 0.02;
            const calculatedBpm = (crossings / durationSec) * 60;

            if (simParams.motionArtifact > 20 || simParams.noiseLevel > 15) {
                resultHr = '--'; 
                algoStatus = 'Noise Error';
            } else {
                resultHr = Math.round(calculatedBpm);
                algoStatus = 'Locked';
            }
        }

        // ALGO 2: DSP (AUTOCORRELATION)
        else if (config.software.id === 'dsp_algo') {
            const input = normalize(bufferFiltered.current);
            const n = input.length;
            let bestCorrelation = -1;
            let bestLag = 0;

            for (let lag = 15; lag < 75; lag++) { // 40-200 BPM
                let sum = 0;
                for (let i = 0; i < n - lag; i++) {
                    sum += input[i] * input[i + lag];
                }
                const avgCorr = sum / (n - lag);

                if (avgCorr > bestCorrelation) {
                    bestCorrelation = avgCorr;
                    bestLag = lag;
                }
            }

            if (bestCorrelation > 500) { 
                const periodSec = bestLag * 0.02; 
                resultHr = Math.round(60 / periodSec);
                algoStatus = 'DSP Tracked';
            } else {
                algoStatus = 'Weak Signal';
            }
        }

        // ALGO 3: ML
        else if (config.software.id === 'ml_algo') {
            const snr = 100 / (simParams.noiseLevel + simParams.motionArtifact + 1);
            if (snr > 2) {
                const jitter = (Math.random() - 0.5) * 2;
                resultHr = Math.round(simParams.heartRate + jitter);
                algoStatus = 'AI Infer';
            } else {
                algoStatus = 'Lost';
            }
        }

        // SPO2 CALCULATION
        if (config.emitters.id !== 'green_only') {
            const redAc = getRms(normalize(bufferRawRed.current));
            const redDc = bufferRawRed.current.reduce((a,b)=>a+b,0) / bufferRawRed.current.length;
            const irAc = getRms(normalize(bufferRawIr.current));
            const irDc = bufferRawIr.current.reduce((a,b)=>a+b,0) / bufferRawIr.current.length;

            if (irAc > 5 && redAc > 5) { 
                const R = (redAc / redDc) / (irAc / irDc);
                const rawSpo2 = 110 - (25 * R);
                resultSpo2 = Math.min(100, Math.round(rawSpo2));
            }
        }

        setReadings({ hr: resultHr, spo2: resultSpo2, status: algoStatus });

    }, 500); 

    return () => clearInterval(runAlgorithm);
  }, [simParams, config.emitters.id, config.software.id]);

  // --- 3. HARDWARE VISUALIZATION LOGIC ---
  const getDeviceStyle = () => {
    switch (config.display.id) {
        case 'oled_mono':
            return {
                shape: 'rounded-sm w-36 h-20', // Small Rectangle (0.96")
                bg: 'bg-black border-slate-700',
                textPrimary: 'text-cyan-400 font-mono text-xl tracking-tighter',
                textSecondary: 'text-cyan-600 font-mono text-[16px]',
                label: 'OLED 128x64'
            };
        case 'tft_color':
            return {
                shape: 'rounded-lg w-28 h-32', // Vertical Rectangle (1.69")
                bg: 'bg-slate-800 border-slate-600',
                textPrimary: 'text-white font-sans text-3xl font-bold',
                textSecondary: 'text-slate-300 font-sans text-[16px]',
                label: 'LCD 240x280'
            };
        case 'amoled':
        default:
            return {
                shape: 'rounded-full w-32 h-32', // Circular (1.4")
                bg: 'bg-black border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.5)]',
                textPrimary: 'text-emerald-400 font-sans text-4xl font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]',
                textSecondary: 'text-emerald-700 font-sans text-xs font-bold uppercase',
                label: 'AMOLED 454px'
            };
    }
  };

  const deviceStyle = getDeviceStyle();


  // --- RENDER ---
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
                FW: {config.software.name}
            </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT: SLIDERS */}
        <div className="w-full lg:w-1/3 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-100 h-fit">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Target HR</label>
              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{simParams.heartRate} BPM</span>
            </div>
            <input type="range" min="40" max="180" value={simParams.heartRate} onChange={(e) => onParamChange('heartRate', e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
          </div>

          <div className={config.emitters.id === 'green_only' ? 'opacity-40 pointer-events-none grayscale' : ''}>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Target SpO2</label>
              <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{simParams.spo2}%</span>
            </div>
            <input type="range" min="80" max="100" value={simParams.spo2} onChange={(e) => onParamChange('spo2', e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Motion Artifacts</label>
              <span className="text-xs font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded">{simParams.motionArtifact}</span>
            </div>
            <input type="range" min="0" max="100" value={simParams.motionArtifact} onChange={(e) => onParamChange('motionArtifact', e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"/>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase">Sensor Noise</label>
              <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{simParams.noiseLevel}</span>
            </div>
            <input type="range" min="0" max="50" value={simParams.noiseLevel} onChange={(e) => onParamChange('noiseLevel', e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"/>
          </div>
        </div>

        {/* RIGHT: VISUALIZATION */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* CHART: FIXED HEIGHT */}
          <div className="h-[300px] bg-white rounded-lg p-2 border border-slate-200 relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  domain={['auto', 'auto']} 
                  width={45} 
                  tick={{fontSize: 10, fill: '#64748b'}} 
                  tickFormatter={(val) => val.toFixed(0)}
                />
                <Tooltip contentStyle={{fontSize:'12px'}} labelFormatter={() => ''} />
                <Legend verticalAlign="top" iconSize={8} height={20}/>
                
                {config.emitters.id === 'green_only' && (
                  <>
                    <Line name="Green Raw" dataKey="rawGreen" stroke="#86efac" dot={false} strokeWidth={1} isAnimationActive={false} />
                    <Line name="Filtered" dataKey="filtered" stroke="#16a34a" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </>
                )}
                
                {(config.emitters.id === 'red_ir' || config.emitters.id === 'multi') && (
                  <>
                    <Line name="IR Raw" dataKey="rawIr" stroke="#a5b4fc" dot={false} strokeWidth={1} isAnimationActive={false} />
                    <Line name="Red Raw" dataKey="rawRed" stroke="#fca5a5" dot={false} strokeWidth={1} isAnimationActive={false} />
                  </>
                )}
                
                {config.emitters.id === 'multi' && (
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
                 
                 {/* DYNAMIC SCREEN CONTAINER */}
                 <div className={`${deviceStyle.shape} ${deviceStyle.bg} border-4 shadow-xl flex flex-col items-center justify-center transition-all duration-300`}>
                     <div className="text-center">
                         {readings.hr !== '--' ? (
                             <>
                                <div className={deviceStyle.textPrimary}>
                                    {readings.hr}
                                    <span className={`ml-1 text-[10px] ${config.display.id === 'oled_mono' ? 'text-cyan-600' : 'text-slate-400'}`}>BPM</span>
                                </div>
                                <div className={deviceStyle.textSecondary}>
                                    {config.emitters.id === 'green_only' ? '--' : readings.spo2} % SpO2
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
                   <Signal size={24} className={metrics.snr > 8 ? "text-emerald-400" : "text-red-500"} />
                 </div>
                 
                 <div className="text-5xl font-bold text-white tracking-tighter">
                    {metrics.snr ? metrics.snr.toFixed(1) : '0.0'}
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