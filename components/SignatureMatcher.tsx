
import React, { useRef, useEffect, useState } from 'react';
import { Target, Zap, Shield, Search, Lock, Unlock, Loader2, Compass, MapPin } from 'lucide-react';
import { SignalNode, FrequencyCategory } from '../types';

interface Props {
  analyzer: AnalyserNode | null;
  isActive: boolean;
  onReveal: (nodeId: string) => void;
  onTargetChange?: (nodeId: string | null) => void;
  hiddenNodes: SignalNode[];
  userLocation: { lat: number, lng: number } | null;
}

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const λ1 = lon1 * Math.PI/180;
  const λ2 = lon2 * Math.PI/180;

  const y = Math.sin(λ2-λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) -
          Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  const θ = Math.atan2(y, x);
  const brng = (θ*180/Math.PI + 360) % 360; // in degrees
  return brng;
};

export const SignatureMatcher: React.FC<Props> = ({ analyzer, isActive, onReveal, onTargetChange, hiddenNodes, userLocation }) => {
  const [currentHue, setCurrentHue] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [targetNode, setTargetNode] = useState<SignalNode | null>(null);
  const requestRef = useRef<number>();

  const updateColor = () => {
    if (!analyzer || !isActive) return;

    const bufferLength = analyzer.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    analyzer.getByteFrequencyData(freqData);

    let maxVal = -1;
    let maxIndex = -1;
    for (let i = 0; i < bufferLength; i++) {
      if (freqData[i] > maxVal) {
        maxVal = freqData[i];
        maxIndex = i;
      }
    }

    // Map frequency to hue (0-360)
    const hue = (maxIndex / bufferLength) * 360;
    setCurrentHue(hue);

    if (isCapturing && targetNode) {
      // Check if current hue matches target signature color
      // targetNode.signatureColor is expected to be a hue value for simplicity in this logic
      const targetHue = parseInt(targetNode.signatureColor || '0');
      const diff = Math.abs(hue - targetHue);
      const normalizedDiff = Math.min(diff, 360 - diff); // Circular difference

      if (normalizedDiff < 15) { // Match within 15 degrees
        setMatchProgress(prev => Math.min(prev + 2, 100));
      } else {
        setMatchProgress(prev => Math.max(prev - 1, 0));
      }
    }

    requestRef.current = requestAnimationFrame(updateColor);
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(updateColor);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, analyzer, isCapturing, targetNode]);

  useEffect(() => {
    if (matchProgress >= 100 && targetNode) {
      onReveal(targetNode.id);
      onTargetChange?.(null);
      setTargetNode(null);
      setMatchProgress(0);
      setIsCapturing(false);
    }
  }, [matchProgress, targetNode, onReveal, onTargetChange]);

  const startCapture = (node: SignalNode) => {
    setTargetNode(node);
    onTargetChange?.(node.id);
    setIsCapturing(true);
    setMatchProgress(0);
  };

  const abortCapture = () => {
    setTargetNode(null);
    onTargetChange?.(null);
    setIsCapturing(false);
    setMatchProgress(0);
  };

  return (
    <div className="bg-zinc-900 border border-green-900 rounded p-4 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 border-b border-green-900/30 pb-2">
        <Shield className="w-4 h-4 text-green-500" />
        <h3 className="text-xs font-black text-green-500 uppercase tracking-widest">Colouration Signature Capture</h3>
      </div>

      <div className="flex flex-col gap-6">
        {/* Visual Feedback */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Outer Ring - Current Frequency Color */}
            <div 
              className="absolute inset-0 rounded-full border-4 transition-colors duration-200 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              style={{ 
                borderColor: `hsla(${currentHue}, 100%, 50%, 0.8)`,
                boxShadow: `0 0 30px hsla(${currentHue}, 100%, 50%, 0.3)`
              }}
            />
            
            {/* Inner Ring - Target Color (if capturing) */}
            {isCapturing && targetNode && (
              <div 
                className="absolute inset-4 rounded-full border-4 border-dashed animate-spin-slow"
                style={{ borderColor: `hsla(${targetNode.signatureColor}, 100%, 50%, 0.5)` }}
              />
            )}

            <div className="z-10 flex flex-col items-center">
              {isCapturing ? (
                <div className="text-xl font-black text-white animate-pulse">{matchProgress}%</div>
              ) : (
                <Target className="w-8 h-8 text-green-500/20" />
              )}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Current Spectral Hue</div>
            <div className="text-lg font-mono text-white" style={{ color: `hsla(${currentHue}, 100%, 50%, 1)` }}>
              {Math.round(currentHue)}°
            </div>
          </div>
        </div>

        {/* Hidden Devices List */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-black text-green-900 uppercase mb-2 flex items-center gap-2">
            <Search className="w-3 h-3" />
            Localized Hidden Signatures ({hiddenNodes.length})
          </div>
          
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {hiddenNodes.length === 0 ? (
              <div className="text-[10px] text-zinc-600 italic p-4 border border-dashed border-zinc-800 rounded text-center">
                No hidden signatures detected in current sweep.
              </div>
            ) : (
              hiddenNodes.map(node => (
                <div 
                  key={node.id}
                  className={`p-3 border rounded transition-all flex justify-between items-center group ${
                    targetNode?.id === node.id 
                      ? 'bg-green-500/10 border-green-500' 
                      : 'bg-black/40 border-zinc-800 hover:border-green-900'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] font-black text-zinc-300 uppercase">{node.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: `hsla(${node.signatureColor}, 100%, 50%, 1)` }}
                      />
                      <span className="text-[8px] text-zinc-500 font-mono">SIG_ID: {node.signatureColor}° HUE</span>
                    </div>
                  </div>

                  <button
                    onClick={() => isCapturing && targetNode?.id === node.id ? abortCapture() : startCapture(node)}
                    className={`px-3 py-1 text-[8px] font-black uppercase tracking-tighter rounded border transition-all ${
                      targetNode?.id === node.id
                        ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                        : 'bg-green-500/10 border-green-500/50 text-green-500 hover:bg-green-500 hover:text-black'
                    }`}
                  >
                    {targetNode?.id === node.id ? 'ABORT' : 'CAPTURE'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {isCapturing && targetNode && (
          <div className="bg-black/60 p-3 border border-green-500/30 rounded flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-green-500 animate-spin" />
                <span className="text-[9px] font-black text-green-500 uppercase">Synchronizing Frequency...</span>
              </div>
              <div className="text-[9px] font-mono text-zinc-500">LOCK_STABILITY: {matchProgress}%</div>
            </div>

            {userLocation && targetNode.lat !== undefined && targetNode.lng !== undefined && (
              <div className="grid grid-cols-2 gap-2 border-y border-green-900/20 py-2">
                <div className="flex items-center gap-2">
                  <Compass 
                    className="w-4 h-4 text-green-500 transition-transform duration-500" 
                    style={{ transform: `rotate(${getBearing(userLocation.lat, userLocation.lng, targetNode.lat, targetNode.lng)}deg)` }}
                  />
                  <div className="flex flex-col">
                    <span className="text-[7px] text-zinc-500 uppercase">Bearing</span>
                    <span className="text-[10px] font-mono text-white">
                      {Math.round(getBearing(userLocation.lat, userLocation.lng, targetNode.lat, targetNode.lng))}°
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-green-900/20 pl-2">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <div className="flex flex-col">
                    <span className="text-[7px] text-zinc-500 uppercase">Distance</span>
                    <span className="text-[10px] font-mono text-white">
                      {getDistance(userLocation.lat, userLocation.lng, targetNode.lat, targetNode.lng).toFixed(1)}m
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[8px] text-zinc-400 font-mono leading-relaxed">
              [ADVISORY] Adjust your receiver frequency to match the target's spectral hue. Maintain lock until synchronization reaches 100% to reveal device location.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #14532d;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
