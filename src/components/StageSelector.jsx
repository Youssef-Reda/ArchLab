import React from 'react';
import { CheckCircle, Zap } from 'lucide-react';
import { STAGES } from '../config';

const StageSelector = ({ selectedStage, config, onSelectOption }) => {
  const currentStage = STAGES[selectedStage];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          {React.createElement(currentStage.icon, { size: 32, className: "text-blue-600" })}
          {currentStage.title}
        </h2>
        <p className="text-slate-500 mt-2">Configure component parameters and observe system impact.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {currentStage.options.map((option) => (
          <div 
            key={option.id}
            onClick={() => onSelectOption(selectedStage, option)}
            className={`relative cursor-pointer group rounded-xl border-2 p-5 transition-all duration-200
              ${config[selectedStage.toLowerCase()].id === option.id 
                ? 'bg-blue-50 border-blue-500 shadow-md transform scale-[1.02]' 
                : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
              }
            `}
          >
            {config[selectedStage.toLowerCase()].id === option.id && (
              <div className="absolute top-3 right-3 text-blue-600"><CheckCircle size={20} /></div>
            )}
            <h3 className="font-bold text-slate-800 mb-2">{option.name}</h3>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">{option.desc}</p>
            <div className="space-y-1">
              {Object.entries(option.specs).slice(0, 3).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs text-slate-500 font-mono">
                  <span className="capitalize">{key}:</span>
                  <span className="font-medium text-slate-700">{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Tips
      <div className="bg-amber-50 rounded-xl border border-amber-100 p-6">
        <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Zap size={16} /> Engineering Notes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded border border-amber-100 shadow-sm text-xs text-slate-600">
            <span className="font-bold text-amber-600 block mb-1">Constraints:</span> 
            Always check RAM requirements against the MCU specs.
          </div>
          <div className="bg-white p-3 rounded border border-amber-100 shadow-sm text-xs text-slate-600">
            <span className="font-bold text-amber-600 block mb-1">Latency:</span> 
            DSP/ML filters improve signal but add processing delay.
          </div>
        </div>
      </div> */}
    </>
  );
};

export default StageSelector;