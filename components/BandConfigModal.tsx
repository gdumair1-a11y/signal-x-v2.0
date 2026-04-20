import React, { useState } from 'react';
import { X, Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { BandPower, FrequencyCategory } from '../types';

interface BandConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  bands: BandPower[];
  onSave: (bands: BandPower[]) => void;
  onReset: () => void;
}

const CATEGORIES: FrequencyCategory[] = ['SUB', 'VOICE', 'V2_MICROWAVE', 'EMP', 'EMF', 'BIO_ORGAN', 'CIRCULAR'];

export const BandConfigModal: React.FC<BandConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  bands, 
  onSave, 
  onReset 
}) => {
  const [localBands, setLocalBands] = useState<BandPower[]>([...bands]);

  if (!isOpen) return null;

  const handleAddBand = () => {
    const newBand: BandPower = {
      label: 'NEW_BAND',
      category: 'EMF',
      frequency: 1000,
      power: 0
    };
    setLocalBands([...localBands, newBand]);
  };

  const handleRemoveBand = (index: number) => {
    setLocalBands(localBands.filter((_, i) => i !== index));
  };

  const handleUpdateBand = (index: number, updates: Partial<BandPower>) => {
    setLocalBands(localBands.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-[#00ff41]/30 w-full max-w-2xl rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,255,65,0.1)] flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#00ff41]/20 flex justify-between items-center bg-black/40">
          <h3 className="text-lg font-bold text-[#00ff41] flex items-center gap-2">
            BAND CONFIGURATION
          </h3>
          <button onClick={onClose} className="text-[#00ff41]/50 hover:text-[#00ff41]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3">
            {localBands.map((band, idx) => (
              <div key={idx} className="bg-black/40 border border-[#00ff41]/10 p-3 rounded-lg flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#00ff41]/50 uppercase font-mono font-bold">Label</label>
                    <input 
                      type="text" 
                      value={band.label}
                      onChange={(e) => handleUpdateBand(idx, { label: e.target.value })}
                      className="bg-black border border-[#00ff41]/20 rounded px-2 py-1 text-xs text-[#00ff41] font-mono focus:border-[#00ff41]/60 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#00ff41]/50 uppercase font-mono font-bold">Category</label>
                    <select 
                      value={band.category}
                      onChange={(e) => handleUpdateBand(idx, { category: e.target.value as FrequencyCategory })}
                      className="bg-black border border-[#00ff41]/20 rounded px-2 py-1 text-xs text-[#00ff41] font-mono focus:border-[#00ff41]/60 outline-none"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#00ff41]/50 uppercase font-mono font-bold">Freq (Hz)</label>
                    <input 
                      type="number" 
                      value={band.frequency}
                      onChange={(e) => handleUpdateBand(idx, { frequency: Number(e.target.value) })}
                      className="bg-black border border-[#00ff41]/20 rounded px-2 py-1 text-xs text-[#00ff41] font-mono focus:border-[#00ff41]/60 outline-none"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveBand(idx)}
                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors self-end md:self-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={handleAddBand}
            className="w-full py-2 border border-dashed border-[#00ff41]/30 rounded-lg text-[#00ff41]/60 hover:text-[#00ff41] hover:bg-[#00ff41]/5 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" /> Add Monitoring Band
          </button>
        </div>

        <div className="p-4 border-t border-[#00ff41]/20 bg-black/40 flex justify-between gap-3">
          <button 
            onClick={() => {
              if (confirm('Reset to default band configuration?')) {
                onReset();
                onClose();
              }
            }}
            className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded flex items-center gap-2 text-xs font-bold transition-all"
          >
            <RotateCcw className="w-4 h-4" /> RESET DEFAULTS
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold"
            >
              CANCEL
            </button>
            <button 
              onClick={() => {
                onSave(localBands);
                onClose();
              }}
              className="px-6 py-2 bg-[#00ff41] text-black rounded flex items-center gap-2 text-xs font-black uppercase tracking-tighter hover:bg-[#00ff41]/90 transition-all shadow-[0_0_20px_rgba(0,255,65,0.3)]"
            >
              <Save className="w-4 h-4" /> SAVE CONFIG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
