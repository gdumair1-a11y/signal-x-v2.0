
import React from 'react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export const LogPanel: React.FC<Props> = ({ logs, onClear }) => {
  return (
    <div className="bg-zinc-900 border border-green-900 rounded p-4 flex flex-col gap-4 h-full">
      <div className="flex justify-between items-center border-b border-green-900/30 pb-2">
        <h3 className="text-xs font-black text-green-500 uppercase">System Intercept Logs</h3>
        <button 
          onClick={onClear}
          className="text-[8px] text-red-500 hover:text-red-400 font-bold uppercase"
        >
          Clear_Logs
        </button>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[9px] flex flex-col gap-1 pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-zinc-700 italic py-4 text-center">No signals intercepted in current session...</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`border-l-2 pl-2 py-1 transition-colors group ${log.id.startsWith('PROT-') ? 'border-blue-500 bg-blue-500/10' : 'border-green-900/30 hover:bg-green-500/5'}`}>
              <div className="flex justify-between items-center">
                <span className={log.id.startsWith('PROT-') ? 'text-blue-400' : 'text-green-800'}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={`px-1 rounded font-bold ${
                  log.id.startsWith('PROT-') ? 'bg-blue-500 text-white' :
                  log.category === 'V2_MICROWAVE' ? 'bg-red-500/20 text-red-500' :
                  log.category === 'EMP' ? 'bg-yellow-500/20 text-yellow-500' :
                  log.category === 'BIO_ORGAN' ? 'bg-blue-500/20 text-blue-500' :
                  'bg-green-500/20 text-green-500'
                }`}>
                  {log.id.startsWith('PROT-') ? 'PROTECTION' : log.category}
                </span>
              </div>
              <div className="text-zinc-400 mt-0.5 leading-tight">
                {log.message} - <span className="text-zinc-600">{(log.frequency / 1000000).toFixed(6)} MHz</span>
              </div>
              <div className="text-[7px] text-zinc-700 italic uppercase mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Intensity: {(log.intensity * 100).toFixed(1)}% | Loc: {log.location ? `${log.location.x}, ${log.location.y}` : 'N/A'}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="bg-black/50 p-2 rounded border border-green-900/10">
        <p className="text-[7px] text-green-900 uppercase leading-none">
          [Auto-Journal] All intercepted perturbations are logged locally. 
          Encrypted backup active.
        </p>
      </div>
    </div>
  );
};
