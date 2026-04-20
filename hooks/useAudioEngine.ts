
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioFilterConfig, BandPower, FreqPoint, AutoRecordConfig, Recording, FrequencyCategory } from '../types';

export function useAudioEngine() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const DEFAULT_BANDS: BandPower[] = [
    { label: 'SUB', category: 'SUB', frequency: 60, power: 0 },
    { label: 'V2K_L', category: 'VOICE', frequency: 440, power: 0 },
    { label: 'V2K_H', category: 'VOICE', frequency: 2500, power: 0 },
    { label: 'MICROWAVE', category: 'V2_MICROWAVE', frequency: 12000, power: 0 },
    { label: 'EMP_PULSE', category: 'EMP', frequency: 15000, power: 0 },
    { label: 'EMF_STATIC', category: 'EMF', frequency: 50, power: 0 },
    { label: 'BIO_ORG', category: 'BIO_ORGAN', frequency: 7.83, power: 0 },
    { label: 'CIRCULAR', category: 'CIRCULAR', frequency: 1000, power: 0 },
  ];

  const [bandPowers, setBandPowers] = useState<BandPower[]>(() => {
    try {
      const saved = localStorage.getItem('V2K_BAND_CONFIG');
      if (saved) {
        const parsed = JSON.parse(saved) as BandPower[];
        return parsed.map(p => ({ ...p, power: 0 }));
      }
    } catch (e) {
      console.error("Failed to load band config:", e);
    }
    return DEFAULT_BANDS;
  });

  useEffect(() => {
    localStorage.setItem('V2K_BAND_CONFIG', JSON.stringify(bandPowers));
  }, [bandPowers]);
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
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  
  // TX Oscillators storage
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode, gain: GainNode }>>(new Map());
  const jammerOscRef = useRef<{ osc: OscillatorNode, gain: GainNode } | null>(null);

  const [autoRecordConfig, setAutoRecordConfig] = useState<AutoRecordConfig>({
    isEnabled: false,
    threshold: 0.8,
    targets: ['V2_MICROWAVE', 'EMP', 'VOICE']
  });

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startManualRecording = useCallback(() => {
    if (!streamRef.current || !isActive) return;
    
    // Ensure the stream has active tracks
    const activeTracks = streamRef.current.getTracks().filter(t => t.readyState === 'live');
    if (activeTracks.length === 0) {
      console.warn("Cannot start recording: No active live tracks found.");
      return;
    }

    setIsRecording(true);
    audioChunksRef.current = [];
    
    // Small delay to ensure tracks are ready across all hardware
    setTimeout(() => {
      try {
        if (!streamRef.current || !isActive) {
          setIsRecording(false);
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          setIsRecording(false);
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const newRecording: Recording = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            blob,
            url,
            duration: 0, // Simplified
            label: 'AUDIO_SIGNAL_CAPTURE'
          };
          setRecordings(prev => [newRecording, ...prev]);
        };

        if (recorder.state === 'inactive' && streamRef.current.active) {
          recorder.start();
          mediaRecorderRef.current = recorder;
        } else {
          setIsRecording(false);
        }
      } catch (err) {
        console.error("Failed to start MediaRecorder in useAudioEngine:", err);
        setIsRecording(false);
      }
    }, 200);
  }, [streamRef, isActive]);

  const stopManualRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const updateBandPowers = useCallback(() => {
    if (!analyzerRef.current || !isActive) return;
    
    // Throttle band power updates to 10fps for UI smoothness
    const now = performance.now();
    if (now - lastUpdateRef.current > 100) {
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

      let autoRecordTriggered = false;
      const nextBandPowers = bandPowers.map(band => {
        const bin = Math.floor(band.frequency / (sampleRate / fftSize));
        const power = dataArray[bin] / 255;
        
        if (autoRecordConfig.isEnabled && 
            autoRecordConfig.targets.includes(band.category) && 
            power > autoRecordConfig.threshold && 
            (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive')) {
          autoRecordTriggered = true;
        }

        return { ...band, power };
      });

      if (autoRecordTriggered) {
        startManualRecording();
        setTimeout(() => stopManualRecording(), 5000); // Record 5s burst
      }

      setBandPowers(nextBandPowers);
      lastUpdateRef.current = now;
    }
    
    rafRef.current = requestAnimationFrame(updateBandPowers);
  }, [isActive, autoRecordConfig, startManualRecording, stopManualRecording, bandPowers]);

  const startEngine = useCallback(async () => {
    setError(null);
    try {
      // Request audio stream with basic constraints first
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // If constraints fail, try basic audio
        if (err.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw err;
        }
      }

      streamRef.current = stream;
      
      // Enumerate devices to update label
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const activeTrack = stream.getAudioTracks()[0];
        if (activeTrack) {
          setActiveMicLabel(activeTrack.label || 'SYSTEM_DEFAULT');
        }
      } catch (e) {
        console.warn('Could not enumerate devices for labels', e);
      }
      
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
      lastUpdateRef.current = 0;
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
  }, [updateBandPowers, filterConfig.monitor]);

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
    setBandPowers,
    resetBands: () => setBandPowers(DEFAULT_BANDS),
    tunedFrequency,
    audioContext: audioContextRef.current,
    stream: streamRef.current,
    freqPoints,
    setFreqPoints,
    preferBuiltIn,
    setPreferBuiltIn,
    autoMicLabel: activeMicLabel,
    jammerConfig,
    setJammerConfig,
    autoRecordConfig,
    setAutoRecordConfig,
    recordings,
    setRecordings,
    isRecording,
    startManualRecording,
    stopManualRecording,
    error,
    setError
  };
}
