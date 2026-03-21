
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioFilterConfig, BandPower, FreqPoint } from '../types';

export function useAudioEngine() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bandPowers, setBandPowers] = useState<BandPower[]>([
    { label: 'SUB', category: 'SUB', frequency: 60, power: 0 },
    { label: 'V2K_L', category: 'VOICE', frequency: 440, power: 0 },
    { label: 'V2K_H', category: 'VOICE', frequency: 2500, power: 0 },
    { label: 'MICROWAVE', category: 'V2_MICROWAVE', frequency: 12000, power: 0 },
    { label: 'EMP_PULSE', category: 'EMP', frequency: 15000, power: 0 },
    { label: 'EMF_STATIC', category: 'EMF', frequency: 50, power: 0 },
    { label: 'BIO_ORG', category: 'BIO_ORGAN', frequency: 7.83, power: 0 },
    { label: 'CIRCULAR', category: 'CIRCULAR', frequency: 1000, power: 0 },
  ]);
  const [tunedFrequency, setTunedFrequency] = useState<number>(0);
  const [filterConfig, setFilterConfig] = useState<AudioFilterConfig>({
    lowPass: 20000,
    highPass: 20,
    gain: 1,
    resonance: 1,
    v2kLock: false,
    monitor: false,
    targetFrequency: 1850,
  });

  const [freqPoints, setFreqPoints] = useState<FreqPoint[]>([]);

  const [preferBuiltIn, setPreferBuiltIn] = useState<boolean>(true);
  const [activeMicLabel, setActiveMicLabel] = useState<string>('DEFAULT');
  const [jammerConfig, setJammerConfig] = useState<{ isActive: boolean, frequency: number }>({ isActive: false, frequency: 1000 });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const lowPassRef = useRef<BiquadFilterNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const v2kVoiceRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();
  
  // TX Oscillators storage
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode, gain: GainNode }>>(new Map());
  const jammerOscRef = useRef<{ osc: OscillatorNode, gain: GainNode } | null>(null);

  const updateBandPowers = useCallback(() => {
    if (!analyzerRef.current || !isActive) return;
    
    // Throttle band power updates to 10fps for UI smoothness
    const now = performance.now();
    if (!rafRef.current || now - (rafRef.current as any).lastUpdate > 100) {
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteFrequencyData(dataArray);
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const fftSize = analyzerRef.current.fftSize;

      let maxVal = -1;
      let maxIndex = -1;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }
      if (maxIndex !== -1) {
        setTunedFrequency(maxIndex * (sampleRate / fftSize));
      }

      setBandPowers(prev => prev.map(band => {
        const bin = Math.floor(band.frequency / (sampleRate / fftSize));
        return { ...band, power: dataArray[bin] / 255 };
      }));
      (rafRef.current as any).lastUpdate = now;
    }
    
    rafRef.current = requestAnimationFrame(updateBandPowers);
  }, [isActive]);

  const startEngine = useCallback(async () => {
    setError(null);
    try {
      // First, get permissions to see device labels
      let initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Enumerate devices to find the built-in microphone
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      // Heuristic to find the built-in microphone
      // We look for labels that suggest internal/built-in and avoid "headset", "bluetooth", "external"
      let selectedDeviceId = '';
      
      if (preferBuiltIn) {
        const builtInMic = audioInputs.find(device => {
          const label = device.label.toLowerCase();
          return (label.includes('internal') || label.includes('built-in') || label.includes('integrated')) && 
                 !label.includes('headset') && !label.includes('bluetooth');
        });

        if (builtInMic) {
          selectedDeviceId = builtInMic.deviceId;
        } else {
          // Fallback: find the first one that is NOT a headset or bluetooth
          const fallbackMic = audioInputs.find(device => {
            const label = device.label.toLowerCase();
            return !label.includes('headset') && !label.includes('bluetooth');
          });
          if (fallbackMic) {
            selectedDeviceId = fallbackMic.deviceId;
          }
        }
      }

      // If we found a specific device, stop the initial stream and get the specific one
      if (selectedDeviceId) {
        initialStream.getTracks().forEach(track => track.stop());
        initialStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            deviceId: { exact: selectedDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      } else if (preferBuiltIn) {
        // If we wanted built-in but didn't find a specific ID, just use the initial stream but re-request with constraints
        initialStream.getTracks().forEach(track => track.stop());
        initialStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      }
      // If !preferBuiltIn, we just keep the initialStream (which is the default system mic)

      const stream = initialStream;
      streamRef.current = stream;
      
      const activeTrack = stream.getAudioTracks()[0];
      if (activeTrack) {
        setActiveMicLabel(activeTrack.label || 'SYSTEM_DEFAULT');
      }
      
      // ... rest of the setup ...
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
      audioContextRef.current = context;

      const analyzer = context.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      analyzerRef.current = analyzer;

      const lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPassRef.current = lowPass;

      const highPass = context.createBiquadFilter();
      highPass.type = 'highpass';
      highPassRef.current = highPass;

      const v2kVoice = context.createBiquadFilter();
      v2kVoice.type = 'peaking';
      v2kVoice.gain.value = 0;
      v2kVoiceRef.current = v2kVoice;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);
      compressorRef.current = compressor;

      const gainNode = context.createGain();
      gainNodeRef.current = gainNode;

      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;

      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(v2kVoice);
      v2kVoice.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(analyzer);
      
      if (filterConfig.monitor) {
        analyzer.connect(context.destination);
      }

      await context.resume();
      setIsActive(true);
      (rafRef.current as any) = { lastUpdate: 0 };
      rafRef.current = requestAnimationFrame(updateBandPowers);
    } catch (err: any) {
      console.error('Failed to start audio engine:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('PERMISSION_DENIED: Access to microphone was blocked. Please enable microphone permissions in your browser settings and refresh.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('HARDWARE_ERROR: No microphone detected. Please connect an audio input device.');
      } else {
        setError(`SYSTEM_ERROR: ${err.message || 'Unknown initialization failure'}`);
      }
      setIsActive(false);
    }
  }, [updateBandPowers, filterConfig.monitor, preferBuiltIn]);

  const stopEngine = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    // Stop all oscillators
    oscillatorsRef.current.forEach(({ osc }) => osc.stop());
    oscillatorsRef.current.clear();
    
    if (jammerOscRef.current) {
      jammerOscRef.current.osc.stop();
      jammerOscRef.current.osc.disconnect();
      jammerOscRef.current.gain.disconnect();
      jammerOscRef.current = null;
    }
    
    setIsActive(false);
  }, []);

  // Handle TX Frequency Points
  useEffect(() => {
    if (!isActive || !audioContextRef.current || !Array.isArray(freqPoints)) return;
    const context = audioContextRef.current;

    freqPoints.forEach(point => {
      if (point.type === 'TX') {
        let entry = oscillatorsRef.current.get(point.id);
        
        if (point.isActive) {
          if (!entry) {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = 'sine';
            osc.frequency.value = point.frequency;
            gain.gain.value = point.gain * 0.3; // Increased gain for better audibility
            
            osc.connect(gain);
            gain.connect(context.destination);
            osc.start();
            
            oscillatorsRef.current.set(point.id, { osc, gain });
          } else {
            // Update existing
            entry.osc.frequency.setTargetAtTime(point.frequency, context.currentTime, 0.05);
            entry.gain.gain.setTargetAtTime(point.gain * 0.1, context.currentTime, 0.05);
          }
        } else if (entry) {
          // Stop if deactivated
          entry.osc.stop();
          entry.osc.disconnect();
          entry.gain.disconnect();
          oscillatorsRef.current.delete(point.id);
        }
      }
    });

    // Cleanup oscillators that are no longer in freqPoints
    oscillatorsRef.current.forEach((_, id) => {
      if (!freqPoints.find(p => p.id === id)) {
        const entry = oscillatorsRef.current.get(id);
        if (entry) {
          entry.osc.stop();
          entry.osc.disconnect();
          entry.gain.disconnect();
          oscillatorsRef.current.delete(id);
        }
      }
    });
  }, [freqPoints, isActive]);

  // Handle Jammer Oscillator
  useEffect(() => {
    if (!isActive || !audioContextRef.current) return;
    const context = audioContextRef.current;

    if (jammerConfig.isActive) {
      if (!jammerOscRef.current) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        
        // Use a more disruptive waveform for jamming
        osc.type = 'square'; 
        osc.frequency.value = jammerConfig.frequency;
        
        // Add some frequency modulation for "noise" effect
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 15; // 15Hz modulation
        lfoGain.gain.value = 100; // 100Hz deviation
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        
        gain.gain.value = 0.2;
        
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start();
        
        jammerOscRef.current = { osc, gain };
      } else {
        jammerOscRef.current.osc.frequency.setTargetAtTime(jammerConfig.frequency, context.currentTime, 0.05);
      }
    } else if (jammerOscRef.current) {
      jammerOscRef.current.osc.stop();
      jammerOscRef.current.osc.disconnect();
      jammerOscRef.current.gain.disconnect();
      jammerOscRef.current = null;
    }
  }, [jammerConfig, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const context = audioContextRef.current;
    if (!context) return;

    if (lowPassRef.current) lowPassRef.current.frequency.setTargetAtTime(filterConfig.lowPass, context.currentTime, 0.05);
    if (highPassRef.current) highPassRef.current.frequency.setTargetAtTime(filterConfig.highPass, context.currentTime, 0.05);
    if (gainNodeRef.current) gainNodeRef.current.gain.setTargetAtTime(filterConfig.gain, context.currentTime, 0.05);
    
    if (analyzerRef.current) {
      if (filterConfig.monitor) {
        analyzerRef.current.connect(context.destination);
      } else {
        try {
          analyzerRef.current.disconnect(context.destination);
        } catch (e) {
          // Already disconnected
        }
      }
    }
    
    if (v2kVoiceRef.current) {
      if (filterConfig.v2kLock) {
        v2kVoiceRef.current.type = 'bandpass';
        v2kVoiceRef.current.frequency.setTargetAtTime(filterConfig.targetFrequency, context.currentTime, 0.05); 
        v2kVoiceRef.current.Q.setTargetAtTime(filterConfig.resonance, context.currentTime, 0.05);
      } else {
        v2kVoiceRef.current.type = 'peaking';
        v2kVoiceRef.current.gain.setTargetAtTime(0, context.currentTime, 0.05);
      }
    }
  }, [filterConfig, isActive]);

  return {
    isActive,
    startEngine,
    stopEngine,
    analyzer: analyzerRef.current,
    filterConfig,
    setFilterConfig,
    bandPowers,
    tunedFrequency,
    audioContext: audioContextRef.current,
    stream: streamRef.current,
    freqPoints,
    setFreqPoints,
    preferBuiltIn,
    setPreferBuiltIn,
    activeMicLabel,
    jammerConfig,
    setJammerConfig,
    error,
    setError
  };
}
