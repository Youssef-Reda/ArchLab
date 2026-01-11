import React, { useState } from 'react';
import { RotateCcw, ChevronLeft, Watch } from 'lucide-react';

// Data & Hooks
import { STAGES } from './config';
import { useSystemMetrics } from './hooks/useSystemMetrics';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StageSelector from './components/StageSelector';
import SimulationLab from './components/SimulationLab';

const initialConfig = {
  display: STAGES.DISPLAY.options[0],
  emitters: STAGES.EMITTERS.options[0],
  drive: STAGES.DRIVE.options[0],
  detectors: STAGES.DETECTORS.options[0],
  afe: STAGES.AFE.options[0],
  mcu: STAGES.MCU.options[0],
  software: STAGES.SOFTWARE.options[0],
  battery: STAGES.BATTERY.options[0]
};

const App = () => {
  // State
  const [selectedStage, setSelectedStage] = useState('DISPLAY');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isDashboardOpen, setDashboardOpen] = useState(true);
  
  const [config, setConfig] = useState(initialConfig);
  const [simParams, setSimParams] = useState({
    heartRate: 75, spo2: 98, motionArtifact: 10, noiseLevel: 5, filterCutoff: 50
  });

  // Custom Hook
  const { metrics, alerts } = useSystemMetrics(config, simParams);

  // Handlers
  const handleSelectOption = (stageKey, option) => {
    setConfig(prev => ({ ...prev, [stageKey.toLowerCase()]: option }));
  };

  const handleParamChange = (key, value) => {
    setSimParams(prev => ({ ...prev, [key]: parseInt(value) }));
  };

  const handleReset = () => {
    setConfig(initialConfig);
    setSimParams({ heartRate: 75, spo2: 98, motionArtifact: 10, noiseLevel: 5, filterCutoff: 50 });
    setSelectedStage('DISPLAY');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md"><Watch size={24} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ArchLab</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">SMARTWATCH ENGINEERING PLAYGROUND</p>
          </div>
        </div>
        <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
          <RotateCcw size={16} /> <span className="hidden sm:inline">Reset System</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setSidebarOpen} 
          selectedStage={selectedStage} 
          onSelectStage={setSelectedStage} 
        />

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
              
              {/* 1. ALWAYS SHOW THE SELECTION GRID (So you can choose Basic/DSP/ML) */}
              <StageSelector 
                selectedStage={selectedStage} 
                config={config} 
                onSelectOption={handleSelectOption} 
              />

              {/* 2. IF SOFTWARE STAGE, SHOW THE LAB BELOW IT */}
              {selectedStage === 'SOFTWARE' && (
                <div className="mt-8 border-t border-slate-200 pt-8">
                  <SimulationLab 
                    config={config} 
                    simParams={simParams} 
                    metrics={metrics}
                    onParamChange={handleParamChange} 
                  />
                </div>
              )}

            </div>
          </div>
        </main>

        {/* RIGHT DASHBOARD */}
        <Dashboard 
          isOpen={isDashboardOpen} 
          setIsOpen={setDashboardOpen} 
          metrics={metrics} 
          alerts={alerts} 
          config={config} 
        />
        
        {/* Toggle for Dashboard (Visible when closed) */}
        {!isDashboardOpen && (
          <button onClick={() => setDashboardOpen(true)} className="absolute top-1/2 right-0 transform -translate-y-1/2 bg-white border-l border-t border-b border-slate-200 p-2 rounded-l-lg shadow-md z-20 hover:bg-slate-50 text-slate-500">
            <ChevronLeft size={20}/>
          </button>
        )}

      </div>
    </div>
  );
};

export default App;