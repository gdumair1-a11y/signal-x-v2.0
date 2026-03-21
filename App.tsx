
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAudioEngine } from './hooks/useAudioEngine';
import { FrequencyScanner } from './components/FrequencyScanner';
import { SignalMap } from './components/SignalMap';
import { LogPanel } from './components/LogPanel';
import { SignatureMatcher } from './components/SignatureMatcher';
import { Recording, FreqPoint, FreqType, LogEntry, SignalNode, FrequencyCategory, BroadcastData } from './types';
import { analyzeSpectralData } from './services/geminiService';
import { MapPin, Navigation, Shield, AlertTriangle, Activity, List, Settings, Radio, Volume2, VolumeX, Camera } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { BroadcastPanel } from './components/BroadcastPanel';
import { LiveFeed } from './components/LiveFeed';

const App: React.FC = () => {
  const { 
    isActive, 
    startEngine, 
    stopEngine, 
    analyzer, 
    filterConfig, 
    setFilterConfig, 
    bandPowers,
    tunedFrequency,
    stream,
    audioContext,
    freqPoints,
    setFreqPoints,
    preferBuiltIn,
    setPreferBuiltIn,
    activeMicLabel,
    jammerConfig,
    setJammerConfig,
    error: audioEngineError,
    setError: setAudioEngineError
  } = useAudioEngine();
  
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [nodes, setNodes] = useState<SignalNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<FrequencyCategory | 'ALL'>('ALL');
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'SCANNER' | 'MAP' | 'LOGS' | 'INTEL' | 'BROADCAST'>('SCANNER');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [broadcasts, setBroadcasts] = useState<Record<string, BroadcastData>>({});
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [showHiddenSignatures, setShowHiddenSignatures] = useState(true);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [jammerTargetId, setJammerTargetId] = useState<string | null>(null);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('broadcast-received', (data: BroadcastData) => {
      setBroadcasts(prev => ({
        ...prev,
        [data.id]: {
          ...prev[data.id],
          ...data,
          timestamp: Date.now()
        }
      }));
    });

    newSocket.on('broadcast-stopped', (data: { id: string }) => {
      setBroadcasts(prev => {
        const next = { ...prev };
        delete next[data.id];
        return next;
      });
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Cleanup stale broadcasts
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setBroadcasts(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[id].timestamp > 5000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Initialize some nodes
  useEffect(() => {
    const initialNodes: SignalNode[] = [
      { id: 'V-01', type: 'VICTIM', label: 'TARGET_ALPHA', x: 50, y: 50, frequency: 1850, category: 'VOICE', intensity: 0.8, connectedTo: ['S-01', 'R-01'] },
      { id: 'S-01', type: 'STALKER', label: 'SOURCE_DELTA', x: 20, y: 30, frequency: 12000, category: 'V2_MICROWAVE', intensity: 0.9, connectedTo: ['R-01'] },
      { id: 'R-01', type: 'RELAY', label: 'RELAY_NODE_7', x: 40, y: 40, frequency: 15000, category: 'EMP', intensity: 0.4, connectedTo: ['V-01'] },
      { id: 'S-02', type: 'STALKER', label: 'SOURCE_GAMMA', x: 80, y: 70, frequency: 50, category: 'EMF', intensity: 0.7, connectedTo: ['V-01'] },
    ];
    setNodes(initialNodes);
  }, []);

  const requestLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setIsLocating(false);
          
          // Initialize nodes around user location
          const initialNodes: SignalNode[] = [
            { id: 'V-01', type: 'VICTIM', label: 'TARGET_ALPHA', x: 50, y: 50, lat: latitude, lng: longitude, frequency: 1850, category: 'VOICE', intensity: 0.8, connectedTo: ['S-01', 'R-01'] },
            { id: 'S-01', type: 'STALKER', label: 'SOURCE_DELTA', x: 20, y: 30, lat: latitude + 0.005, lng: longitude + 0.005, frequency: 12000, category: 'V2_MICROWAVE', intensity: 0.9, connectedTo: ['R-01'] },
            { id: 'R-01', type: 'RELAY', label: 'RELAY_NODE_7', x: 40, y: 40, lat: latitude + 0.002, lng: longitude - 0.003, frequency: 15000, category: 'EMP', intensity: 0.4, connectedTo: ['V-01'] },
            { id: 'S-02', type: 'STALKER', label: 'SOURCE_GAMMA', x: 80, y: 70, lat: latitude - 0.004, lng: longitude + 0.002, frequency: 50, category: 'EMF', intensity: 0.7, connectedTo: ['V-01'] },
          ];
          setNodes(initialNodes);
          
          setLogs(prev => [{
            id: `SYS-${Date.now()}`,
            timestamp: Date.now(),
            category: 'SUB',
            frequency: 0,
            intensity: 1,
            message: `Geospatial mapping initialized at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}. Satellite link established.`,
          }, ...prev]);
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLocating(false);
          alert("Failed to acquire location. Please ensure GPS is enabled and permissions are granted.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setIsLocating(false);
    }
  };

  // Log microphone changes
  useEffect(() => {
    if (activeMicLabel && activeMicLabel !== 'DEFAULT') {
      setLogs(prev => [{
        id: `MIC-${Date.now()}`,
        timestamp: Date.now(),
        category: 'SUB',
        frequency: 0,
        intensity: 1,
        message: `Audio input source changed: ${activeMicLabel}. Input synchronization verified.`,
      }, ...prev].slice(0, 50));
    }
  }, [activeMicLabel]);

  // Automatic Signal Detection Simulation
  useEffect(() => {
    if (!isActive || !userLocation) return;

    const interval = setInterval(() => {
      // Find bands with activity
      const activeBands = bandPowers.filter(b => b.power > 0.5);
      
      activeBands.forEach(band => {
        // Only log occasionally to avoid spam
        if (Math.random() > 0.7) {
          const latOffset = (Math.random() - 0.5) * 0.02;
          const lngOffset = (Math.random() - 0.5) * 0.02;
          
          const newLog: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            category: band.category,
            frequency: band.frequency + (Math.random() - 0.5) * 100,
            intensity: band.power,
            message: `Detected ${band.category} signature in ${band.label} range. Signal flux: ${(band.power * 100).toFixed(1)}%.`,
            location: { 
              x: 10 + Math.random() * 80, 
              y: 10 + Math.random() * 80,
              lat: userLocation.lat + latOffset,
              lng: userLocation.lng + lngOffset
            }
          };
          
          setLogs(prev => [newLog, ...prev].slice(0, 50));

          // Occasionally add a node to the map for significant detections
          if (band.power > 0.8 && Math.random() > 0.5) {
            const newNode: SignalNode = {
              id: `N-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
              type: band.category === 'VOICE' ? 'VICTIM' : (Math.random() > 0.3 ? 'STALKER' : 'RELAY'),
              label: `${band.category}_${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
              x: newLog.location!.x,
              y: newLog.location!.y,
              lat: newLog.location!.lat,
              lng: newLog.location!.lng,
              frequency: newLog.frequency,
              category: band.category,
              intensity: band.power,
              connectedTo: ['V-01']
            };
            setNodes(prev => {
              if (prev.length > 30) return prev; 
              return [...prev, newNode];
            });
          }
        }
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isActive, bandPowers, userLocation]);

  const handleScan = () => {
    if (!userLocation) return;
    setIsScanning(true);
    
    // Simulate a 3-second scan
    setTimeout(() => {
      const categories: FrequencyCategory[] = ['V2_MICROWAVE', 'EMP', 'EMF', 'CIRCULAR', 'BIO_ORGAN', 'VOICE'];
      const newNodes: SignalNode[] = [];
      
      const count = 2 + Math.floor(Math.random() * 3); // 2-4 new nodes
      for (let i = 0; i < count; i++) {
        const latOffset = (Math.random() - 0.5) * 0.015;
        const lngOffset = (Math.random() - 0.5) * 0.015;
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const isHidden = Math.random() > 0.5;
        
        newNodes.push({
          id: `SCAN-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          type: Math.random() > 0.4 ? 'STALKER' : 'RELAY',
          label: isHidden ? 'UNKNOWN' : `SCAN_${cat}_${Math.random().toString(36).substr(2, 2).toUpperCase()}`,
          x: 50, // Not used for map
          y: 50, // Not used for map
          lat: userLocation.lat + latOffset,
          lng: userLocation.lng + lngOffset,
          frequency: 100 + Math.random() * 20000,
          category: cat,
          intensity: 0.3 + Math.random() * 0.6,
          connectedTo: ['V-01'],
          isHidden,
          signatureColor: Math.floor(Math.random() * 360).toString()
        });
      }
      
      setNodes(prev => [...prev, ...newNodes]);
      setLogs(prev => [{
        id: `SCAN-${Date.now()}`,
        timestamp: Date.now(),
        category: 'EMF',
        frequency: 0,
        intensity: 1,
        message: `Area scan complete. ${count} new signal signatures localized in vicinity.`,
      }, ...prev]);
      
      setIsScanning(false);
    }, 3000);
  };

  const handleReveal = (nodeId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return { ...n, isHidden: false, label: `REVEALED_${n.category}_${n.id.substr(-2)}` };
      }
      return n;
    }));
    
    setLogs(prev => [{
      id: `REV-${Date.now()}`,
      timestamp: Date.now(),
      category: 'VOICE',
      frequency: 0,
      intensity: 1,
      message: `Spectral signature matched. Hidden device ${nodeId} revealed and localized on intercept map.`,
    }, ...prev]);
  };

  const handleProtectVictim = (nodeId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return { ...n, isProtected: true, intensity: 0.1, connectedTo: [] };
      }
      // Also remove connections from other nodes to this victim
      if (n.connectedTo?.includes(nodeId)) {
        return { ...n, connectedTo: n.connectedTo.filter(id => id !== nodeId) };
      }
      return n;
    }));

    setLogs(prev => [{
      id: `PROT-${Date.now()}`,
      timestamp: Date.now(),
      category: 'EMP',
      frequency: 0,
      intensity: 1,
      message: `Counter-frequency broadcast initiated for node ${nodeId}. Attack vector neutralized. Shielding active.`,
    }, ...prev]);
  };

  const handleJamSignal = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (jammerTargetId === nodeId && jammerConfig.isActive) {
      // Stop jamming
      setJammerConfig(p => ({ ...p, isActive: false }));
      setJammerTargetId(null);
      setLogs(prev => [{
        id: `JAM-OFF-${Date.now()}`,
        timestamp: Date.now(),
        category: 'CIRCULAR',
        frequency: 0,
        intensity: 1,
        message: `Signal jammer deactivated for node ${nodeId}. Spectrum cleared.`,
      }, ...prev]);
    } else {
      // Start jamming
      setJammerTargetId(nodeId);
      setJammerConfig({ isActive: true, frequency: node.frequency });
      setLogs(prev => [{
        id: `JAM-ON-${Date.now()}`,
        timestamp: Date.now(),
        category: 'CIRCULAR',
        frequency: node.frequency,
        intensity: 1,
        message: `Signal jammer locked on ${node.label} (${(node.frequency / 1000000).toFixed(4)} MHz). Disruptive broadcast initiated.`,
      }, ...prev]);
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      if (!stream) return;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const newRec: Recording = {
          id: `REC-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          timestamp: Date.now(),
          blob,
          url,
          duration: 0,
        };
        setRecordings(prev => [newRec, ...prev]);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const runAnalysis = async (rec: Recording) => {
    setAnalyzingId(rec.id);
    const summary = `
      V2K Intercept Log: ${rec.id}
      Frequency Lock Status: ${filterConfig.v2kLock ? 'V2K_ISOLATION_ACTIVE' : 'WIDEBAND'}
      Observed Peak Frequencies: ${bandPowers.map(b => `${b.label}:${(b.power * 100).toFixed(0)}%`).join(', ')}
      Objective: Isolate embedded vocal transmissions.
    `;
    const result = await analyzeSpectralData(summary);
    setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, analysis: result } : r));
    setAnalyzingId(null);
  };

  const addFreqPoint = (type: FreqType) => {
    const count = Array.isArray(freqPoints) ? freqPoints.filter(p => p.type === type).length : 0;
    if (count >= 20) return;
    
    const newPoint: FreqPoint = {
      id: Math.random().toString(36).substr(2, 9),
      frequency: type === 'TX' ? 1000 : 500,
      type,
      isActive: false,
      label: `${type}_${count + 1}`,
      gain: 0.5
    };
    setFreqPoints(prev => [...prev, newPoint]);
  };

  const updateFreqPoint = (id: string, updates: Partial<FreqPoint>) => {
    setFreqPoints(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeFreqPoint = (id: string) => {
    setFreqPoints(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen p-2 md:p-6 flex flex-col gap-4 max-w-[1600px] mx-auto bg-black text-green-500 overflow-x-hidden">
      {/* Error Overlay */}
      {audioEngineError && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="bg-zinc-900 border-2 border-red-500 p-8 rounded-lg max-w-lg w-full shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-red-500/20 p-3 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-black text-red-500 uppercase tracking-tighter">Hardware Access Failure</h2>
            </div>
            <p className="text-sm text-zinc-400 font-mono mb-8 leading-relaxed">
              {audioEngineError}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setAudioEngineError(null);
                  startEngine();
                }}
                className="w-full py-3 bg-red-500 text-black font-black uppercase tracking-widest hover:bg-red-400 transition-colors"
              >
                RETRY_INITIALIZATION
              </button>
              <button 
                onClick={() => setAudioEngineError(null)}
                className="w-full py-3 bg-zinc-800 text-zinc-400 font-black uppercase tracking-widest hover:bg-zinc-700 transition-colors"
              >
                DISMISS
              </button>
            </div>
            <p className="mt-6 text-[10px] text-zinc-600 uppercase font-mono text-center">
              [TIP] Check your browser address bar for a microphone icon to reset permissions.
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center md:items-end border-b-2 border-green-500/30 pb-4 gap-4">
        <div className="flex flex-col items-center md:items-start">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black text-green-500 tracking-tighter italic">V2K SIGNAL-X</h1>
            <div className={`px-2 py-0.5 text-[10px] rounded font-bold ${isActive ? 'bg-green-500 text-black animate-pulse' : 'bg-red-500 text-white'}`}>
              {isActive ? 'SYSTEM_ARMED' : 'OFFLINE'}
            </div>
          </div>
          <p className="text-[10px] text-green-700 font-mono tracking-widest mt-1 text-center md:text-left uppercase">Multi-Band Interception Engine v2.4</p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 items-center">
          <div className="flex flex-col items-end mr-2">
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-green-800 uppercase font-mono">Input Source:</span>
              <button 
                onClick={() => setPreferBuiltIn(!preferBuiltIn)}
                className={`px-2 py-0.5 text-[8px] font-black rounded border transition-all ${
                  preferBuiltIn ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}
              >
                {preferBuiltIn ? 'FORCE_BUILTIN' : 'SYSTEM_DEFAULT'}
              </button>
            </div>
            <span className="text-[7px] text-zinc-600 font-mono truncate max-w-[150px] mt-0.5 uppercase">
              {activeMicLabel}
            </span>
          </div>

          {!userLocation ? (
            <button 
              onClick={requestLocation}
              disabled={isLocating}
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black tracking-widest bg-blue-500/10 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-black transition-all disabled:opacity-50"
            >
              <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
              {isLocating ? 'GPS...' : 'CONFIRM_LOC'}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-mono border border-green-500/30 text-green-500 bg-green-500/5">
              <MapPin className="w-3 h-3" />
              <span>{userLocation.lat.toFixed(3)}, {userLocation.lng.toFixed(3)}</span>
            </div>
          )}
          <button 
            onClick={isActive ? stopEngine : startEngine}
            className={`px-6 py-1.5 text-[10px] font-black tracking-widest transition-all border ${
              isActive ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-green-500 text-green-500 hover:bg-green-500/10'
            }`}
          >
            {isActive ? 'DEACTIVATE' : 'BOOT_ENGINE'}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Tabs */}
      <nav className="flex md:hidden border-b border-green-900/50">
        {[
          { id: 'SCANNER', icon: Activity, label: 'SCAN' },
          { id: 'MAP', icon: Radio, label: 'MAP' },
          { id: 'BROADCAST', icon: Camera, label: 'LIVE' },
          { id: 'LOGS', icon: List, label: 'LOGS' },
          { id: 'INTEL', icon: Shield, label: 'INTEL' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center py-2 gap-1 transition-colors ${
              activeTab === tab.id ? 'text-green-400 bg-green-500/10 border-b-2 border-green-500' : 'text-green-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Band Monitoring, Logs & Broadcast */}
        <div className={`xl:col-span-3 flex flex-col gap-4 ${activeTab === 'LOGS' || activeTab === 'BROADCAST' ? 'flex' : 'hidden xl:flex'}`}>
          {/* Broadcast & Live Feed (Visible on xl or when activeTab is BROADCAST) */}
          <div className={`${activeTab === 'BROADCAST' ? 'flex' : 'hidden xl:flex'} flex-col gap-4`}>
            <BroadcastPanel socket={socket} userLocation={userLocation} />
            <LiveFeed broadcasts={Object.values(broadcasts)} />
          </div>

          {/* Band Monitoring & Logs (Visible on xl or when activeTab is LOGS) */}
          <div className={`${activeTab === 'LOGS' ? 'flex' : 'hidden xl:flex'} flex-col gap-4 flex-1`}>
            <div className="bg-zinc-900/50 border border-green-900/50 p-4 rounded flex flex-col gap-4">
              <h3 className="text-[10px] font-black text-green-600 uppercase border-b border-green-900 pb-2">Multi-Band Intercept</h3>
              <div className="grid grid-cols-2 xl:grid-cols-1 gap-4 py-2">
                {bandPowers.map(band => (
                  <div key={band.label} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-green-800">{band.label}</span>
                      <span className={band.power > 0.7 ? 'text-red-500' : 'text-green-500'}>
                        {(band.power * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden border border-green-900/20">
                      <div 
                        className={`h-full transition-all duration-75 ${band.power > 0.7 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-green-500'}`}
                        style={{ width: `${band.power * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              <LogPanel logs={logs} onClear={() => setLogs([])} />
            </div>
          </div>
        </div>

        {/* Center: Main Visualizers & Map */}
        <div className={`xl:col-span-6 flex flex-col gap-4 ${activeTab === 'SCANNER' || activeTab === 'MAP' ? 'flex' : 'hidden xl:flex'}`}>
          <div className={`${activeTab === 'SCANNER' ? 'block' : 'hidden xl:block'}`}>
            <FrequencyScanner 
              analyzer={analyzer} 
              isActive={isActive} 
              sampleRate={audioContext?.sampleRate} 
              freqPoints={freqPoints}
            />
          </div>
          
          <div className={`grid grid-cols-1 gap-4 ${activeTab === 'MAP' ? 'h-[500px]' : 'h-[400px]'} xl:grid-cols-2`}>
            <div className={`${activeTab === 'MAP' ? 'block h-full' : 'hidden xl:block'} xl:col-span-1`}>
              <SignalMap 
                nodes={nodes} 
                onNodeClick={(node) => {
                  const newLog: LogEntry = {
                    id: `MAN-${Date.now()}`,
                    timestamp: Date.now(),
                    category: node.category,
                    frequency: node.frequency,
                    intensity: node.intensity,
                    message: `Manual investigation of ${node.type}: ${node.label}. Frequency lock requested.`,
                  };
                  setLogs(prev => [newLog, ...prev]);
                }}
                selectedCategory={selectedCategory}
                onCategoryFilter={setSelectedCategory}
                onProtect={handleProtectVictim}
                userLocation={userLocation || undefined}
                onScan={handleScan}
                isScanning={isScanning}
                highlightedNodeId={highlightedNodeId}
                showHidden={showHiddenSignatures}
                onToggleHidden={setShowHiddenSignatures}
                jammerTargetId={jammerTargetId}
                isJamming={jammerConfig.isActive}
                onJam={handleJamSignal}
                broadcasts={Object.values(broadcasts)}
              />
            </div>
            
            <div className={`flex flex-col gap-4 ${activeTab === 'SCANNER' ? 'flex' : 'hidden xl:flex'}`}>
              <div className="bg-zinc-900 p-4 border border-green-900 rounded flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-green-500 uppercase">V2K Voice Isolation</h3>
                  <div className="flex gap-2">
                    {/* Monitor Toggle */}
                    <button
                      onClick={() => setFilterConfig(p => ({ ...p, monitor: !p.monitor }))}
                      className={`p-1.5 rounded border transition-colors ${filterConfig.monitor ? 'bg-green-600 border-green-400 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}
                      title={filterConfig.monitor ? "Monitoring ON" : "Monitoring OFF"}
                    >
                      {filterConfig.monitor ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    <div 
                      onClick={() => setFilterConfig(p => ({ ...p, v2kLock: !p.v2kLock }))}
                      className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors border ${filterConfig.v2kLock ? 'bg-green-600 border-green-400' : 'bg-zinc-800 border-zinc-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${filterConfig.v2kLock ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
                <div className="bg-black/40 p-2 rounded border border-green-900/20 mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] text-green-900 uppercase">Auto-Tuned Frequency</span>
                    {isActive && tunedFrequency > 0 && (
                      <span className="flex items-center gap-1 text-[7px] text-red-500 animate-pulse">
                        <AlertTriangle className="w-2 h-2" />
                        ANOMALY_DETECTED
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-mono text-green-400">{(tunedFrequency / 1000000).toFixed(6)} MHz</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                   <div className="bg-black/50 p-2 border border-green-900/20 rounded">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] text-green-900 uppercase">Resonance</span>
                        <Shield className="w-2 h-2 text-green-900" />
                      </div>
                      <input 
                        type="range" min="0.1" max="20" step="0.1" 
                        value={filterConfig.resonance} 
                        onChange={(e) => setFilterConfig(p => ({ ...p, resonance: Number(e.target.value) }))}
                        className="w-full accent-green-500"
                      />
                   </div>
                   <div className="bg-black/50 p-2 border border-green-900/20 rounded">
                      <span className="text-[8px] block text-green-900 uppercase mb-1">Signal Gain</span>
                      <input 
                        type="range" min="0" max="4" step="0.1" 
                        value={filterConfig.gain} 
                        onChange={(e) => setFilterConfig(p => ({ ...p, gain: Number(e.target.value) }))}
                        className="w-full accent-green-500"
                      />
                   </div>
                </div>
                
                <p className="text-[9px] text-green-800 leading-relaxed italic">
                  {filterConfig.v2kLock 
                    ? "SYSTEM_LOCK: Isolating human vocal frequencies (300-3400Hz). Background harmonic suppression active."
                    : "WIDE_SCAN: Monitoring all atmospheric audio perturbations. Full spectrum pass-through."}
                </p>
              </div>

              <div className="bg-zinc-900 p-4 border border-green-900 rounded flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-black text-green-500 uppercase">Capture Module</h3>
                  <span className="text-[9px] text-green-900 font-mono">ENCRYPTED_OUT</span>
                </div>
                <button 
                  onClick={toggleRecording}
                  disabled={!isActive}
                  className={`w-full py-4 mt-2 rounded font-black text-sm tracking-widest border-2 transition-all ${
                    isRecording 
                      ? 'bg-red-500 border-red-400 text-black animate-pulse' 
                      : 'bg-green-500/10 border-green-500 text-green-500 hover:bg-green-500 hover:text-black'
                  } disabled:opacity-20`}
                >
                  {isRecording ? 'HALT_CAPTURE' : 'EXECUTE_SIGNAL_GRAB'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Frequency Management & Recordings */}
        <div className={`xl:col-span-3 flex flex-col gap-4 ${activeTab === 'INTEL' ? 'flex' : 'hidden xl:flex'}`}>
          {/* Victim Identification & Protection */}
          <div className="bg-zinc-900 border border-green-900 rounded p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-green-900 pb-2">
              <h3 className="text-[10px] font-black text-green-500 uppercase flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Victim Intel & Protection
              </h3>
            </div>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
              {nodes.filter(n => n.type === 'VICTIM').length === 0 ? (
                <p className="text-[8px] text-zinc-600 italic text-center py-4 uppercase">No victims localized in sector</p>
              ) : (
                nodes.filter(n => n.type === 'VICTIM').map(victim => (
                  <div key={victim.id} className={`p-2 rounded border transition-all ${victim.isProtected ? 'border-blue-500/50 bg-blue-500/5' : 'border-green-900/30 bg-green-900/5'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[9px] font-black uppercase ${victim.isProtected ? 'text-blue-400' : 'text-green-500'}`}>
                        {victim.label}
                      </span>
                      {victim.isProtected && <Shield className="w-3 h-3 text-blue-400 animate-pulse" />}
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-[7px] text-zinc-500 uppercase flex flex-col">
                        <span>FREQ: {(victim.frequency / 1000000).toFixed(4)} MHz</span>
                        <span>STATUS: {victim.isProtected ? 'SHIELDED' : 'EXPOSED'}</span>
                      </div>
                      {!victim.isProtected && (
                        <button 
                          onClick={() => handleProtectVictim(victim.id)}
                          className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded hover:bg-blue-500 transition-colors uppercase"
                        >
                          Erase_Attack
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <SignatureMatcher 
            analyzer={analyzer} 
            isActive={isActive} 
            hiddenNodes={nodes.filter(n => n.isHidden)} 
            onReveal={handleReveal} 
            onTargetChange={setHighlightedNodeId}
            userLocation={userLocation}
          />

          {/* Signal Jammer Control Panel */}
          <div className="bg-zinc-900 border border-purple-900/50 rounded p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-purple-900/30 pb-2">
              <h3 className="text-[10px] font-black text-purple-400 uppercase flex items-center gap-2">
                <Radio className="w-3 h-3" />
                Signal Jammer Control
              </h3>
              {jammerConfig.isActive && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                  <span className="text-[7px] text-purple-500 font-black">JAMMING_ACTIVE</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {nodes.filter(n => n.type === 'STALKER').length === 0 ? (
                <p className="text-[8px] text-zinc-600 italic text-center py-2 uppercase">No active stalkers identified</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                  {nodes.filter(n => n.type === 'STALKER').map(stalker => (
                    <div key={stalker.id} className={`p-2 rounded border transition-all ${jammerTargetId === stalker.id ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 bg-black/40'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-black text-zinc-300 uppercase">{stalker.label}</span>
                        <span className="text-[7px] font-mono text-zinc-500">{(stalker.frequency / 1000000).toFixed(4)} MHz</span>
                      </div>
                      <button 
                        onClick={() => handleJamSignal(stalker.id)}
                        className={`w-full py-1 text-[8px] font-black uppercase rounded border transition-all ${
                          jammerTargetId === stalker.id && jammerConfig.isActive
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-zinc-800 border-zinc-700 text-purple-500 hover:bg-purple-900 hover:text-white'
                        }`}
                      >
                        {jammerTargetId === stalker.id && jammerConfig.isActive ? 'CEASE_JAMMING' : 'INITIATE_JAM'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {jammerConfig.isActive && (
              <div className="bg-purple-900/10 border border-purple-500/20 p-2 rounded">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[7px] text-purple-400 uppercase">Jamming Frequency</span>
                  <span className="text-[9px] font-mono text-purple-300">{(jammerConfig.frequency / 1000000).toFixed(6)} MHz</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
          
          {/* Frequency Management */}
          <div className="bg-zinc-900 border border-green-900 rounded p-4 flex flex-col gap-4 max-h-[400px]">
            <div className="flex justify-between items-center border-b border-green-900 pb-2">
              <h3 className="text-[10px] font-black text-green-500 uppercase">Freq Management</h3>
              <div className="flex gap-2">
                <button onClick={() => addFreqPoint('TX')} className="text-[8px] bg-purple-900/50 hover:bg-purple-500 px-2 py-0.5 rounded border border-purple-500/30">+TX</button>
                <button onClick={() => addFreqPoint('RX')} className="text-[8px] bg-cyan-900/50 hover:bg-cyan-500 px-2 py-0.5 rounded border border-cyan-500/30">+RX</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {Array.isArray(freqPoints) && freqPoints.length === 0 && <p className="text-[8px] text-zinc-600 italic text-center py-4">NO FREQUENCIES PLACED</p>}
              {Array.isArray(freqPoints) && freqPoints.map(p => (
                <div key={p.id} className={`p-2 rounded border ${p.type === 'TX' ? 'border-purple-900/30 bg-purple-900/10' : 'border-cyan-900/30 bg-cyan-900/10'} flex flex-col gap-2`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-bold ${p.type === 'TX' ? 'text-purple-400' : 'text-cyan-400'}`}>{p.label}</span>
                    <div className="flex gap-2 items-center">
                      <button 
                        onClick={() => updateFreqPoint(p.id, { isActive: !p.isActive })}
                        className={`w-3 h-3 rounded-full ${p.isActive ? (p.type === 'TX' ? 'bg-purple-500 animate-pulse' : 'bg-cyan-500 animate-pulse') : 'bg-zinc-800'}`}
                      />
                      <button onClick={() => removeFreqPoint(p.id)} className="text-red-500 text-[10px] hover:text-red-400">×</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[7px] text-zinc-500 uppercase">Freq (MHz)</span>
                      <input 
                        type="number" 
                        step="0.000001"
                        value={p.frequency / 1000000} 
                        onChange={(e) => updateFreqPoint(p.id, { frequency: Number(e.target.value) * 1000000 })}
                        className="bg-black text-[9px] text-green-500 border border-green-900/30 rounded px-1 outline-none w-full"
                      />
                    </div>
                    {p.type === 'TX' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[7px] text-zinc-500 uppercase">Gain</span>
                        <input 
                          type="range" min="0" max="1" step="0.01" 
                          value={p.gain} 
                          onChange={(e) => updateFreqPoint(p.id, { gain: Number(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="bg-zinc-950 border border-green-900/50 rounded flex flex-col flex-1 overflow-hidden min-h-[300px]">
            <div className="p-3 bg-zinc-900 border-b border-green-900 flex justify-between items-center">
              <span className="text-[10px] font-black text-green-500 uppercase">Intercepted Intel</span>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {recordings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-green-900/30 italic text-[10px]">
                  <p>NO SIGNALS BUFFERED</p>
                </div>
              ) : (
                recordings.map((rec) => (
                  <div key={rec.id} className="bg-zinc-900 border border-green-900/30 p-3 rounded hover:border-green-500 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-mono font-bold text-green-500">{rec.id}</span>
                      <button 
                        onClick={() => runAnalysis(rec)}
                        className="text-[8px] bg-green-900/50 hover:bg-green-500 hover:text-black px-2 py-0.5 rounded uppercase font-bold border border-green-500/30 transition-all"
                      >
                        {analyzingId === rec.id ? 'EXTRACTING...' : 'DECODE'}
                      </button>
                    </div>
                    <audio src={rec.url} controls className="w-full h-8 grayscale contrast-150 brightness-75 invert mt-1" />
                    {rec.analysis && (
                      <div className="mt-2 text-[9px] font-mono text-green-400/80 bg-black/50 p-2 rounded border-l-2 border-green-500">
                        <span className="text-green-600 block mb-1">DECRYPTED_INTEL:</span>
                        {rec.analysis}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #000; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #004400; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #00ff00; }
      `}</style>
    </div>
  );
};

export default App;
