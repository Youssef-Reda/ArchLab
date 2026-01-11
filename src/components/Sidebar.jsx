import React from 'react';
import { ChevronLeft, Menu } from 'lucide-react';
import { STAGES } from '../config';

const Sidebar = ({ isOpen, setIsOpen, selectedStage, onSelectStage }) => {
  const progressPercent = (Object.keys(STAGES).indexOf(selectedStage) + 1) / Object.keys(STAGES).length * 100;

  return (
    <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 border-r border-slate-800 z-10 ${isOpen ? 'w-64' : 'w-20'}`}>
      
      {/* Toggle Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        {isOpen && <span className="font-bold text-slate-100 text-sm tracking-wider">STAGING</span>}
        <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white">
          {isOpen ? <ChevronLeft size={20}/> : <Menu size={20}/>}
        </button>
      </div>
      
      {/* Progress Bar */}
      {isOpen && (
        <div className="px-4 py-3">
          <div className="flex justify-between text-xs mb-1 text-slate-400">
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-2">
        {Object.values(STAGES).map((stage) => {
          const Icon = stage.icon;
          const isActive = selectedStage === stage.id.toUpperCase();
          return (
            <button
              key={stage.id}
              onClick={() => onSelectStage(stage.id.toUpperCase())}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${isActive ? 'bg-slate-800 border-blue-500 text-blue-400' : 'border-transparent hover:bg-slate-800 hover:text-slate-100'}`}
              title={!isOpen ? stage.title : ''}
            >
              <Icon size={20} className="shrink-0" />
              {isOpen && <span className="text-sm font-medium truncate">{stage.title}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;