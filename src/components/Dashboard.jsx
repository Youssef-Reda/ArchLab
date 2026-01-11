import React from 'react';
import { ChevronRight, Activity, Battery, Settings, AlertCircle } from 'lucide-react';

const Dashboard = ({ isOpen, setIsOpen, metrics, alerts, config }) => {
  return (
    <div className={`bg-white border-l border-slate-200 flex flex-col transition-all duration-300 shadow-xl z-10 ${isOpen ? 'w-80' : 'w-0 opacity-0 overflow-hidden'}`}>
      
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Activity size={18} className="text-blue-500"/> System Status</h3>
        <button onClick={() => setIsOpen(false)} className="md:hidden"><ChevronRight size={20}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`p-3 rounded-lg text-xs flex gap-2 items-start border ${alert.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : alert.type === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                <AlertCircle size={14} className="mt-0.5 shrink-0"/> {alert.msg}
              </div>
            ))}
          </div>
        )}

        {/* RAM & CPU Metrics */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
              <span>RAM Usage</span><span>{Math.round((metrics.ramUsage / metrics.ramTotal) * 100) || 0}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${metrics.ramUsage > metrics.ramTotal ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((metrics.ramUsage / metrics.ramTotal) * 100, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono"><span>{Math.round(metrics.ramUsage || 0)}KB Used</span><span>{metrics.ramTotal}KB Total</span></div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
              <span>CPU Load</span><span>{Math.round(metrics.cpuUsage || 0)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${metrics.cpuUsage > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(metrics.cpuUsage, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Battery & Config Summary */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2 text-slate-600 text-sm font-semibold"><Battery size={16} /> Est. Battery Life</div>
          <div className="text-3xl font-bold text-slate-800">{metrics.batteryLifeHours ? metrics.batteryLifeHours.toFixed(1) : '--'} <span className="text-sm font-normal text-slate-500 ml-1">hrs</span></div>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
           <div className="flex items-center gap-2 mb-2 text-slate-600 text-sm font-semibold"><Settings size={16} /> Config Summary</div>
           <div className="space-y-2 text-xs text-slate-500 font-mono">
             <div className="flex justify-between"><span>Algorithm:</span> <span>{config.software.id.split('_')[0].toUpperCase()}</span></div>
             <div className="flex justify-between"><span>MCU:</span> <span>{config.mcu.specs.clock}MHz</span></div>
             <div className="flex justify-between"><span>FPU:</span> <span>{config.mcu.specs.fpu ? 'YES' : 'NO'}</span></div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;