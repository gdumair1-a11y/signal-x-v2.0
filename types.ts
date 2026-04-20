
export type FrequencyCategory = 'V2_MICROWAVE' | 'EMP' | 'EMF' | 'CIRCULAR' | 'BIO_ORGAN' | 'VOICE' | 'SUB';

export interface AudioFilterConfig {
  lowPass: number;
  highPass: number;
  gain: number;
  resonance: number;
  v2kLock: boolean;
  monitor: boolean;
  targetFrequency: number;
}

export interface BandPower {
  label: string;
  category: FrequencyCategory;
  power: number;
  frequency: number;
}

export type FreqType = 'TX' | 'RX';

export interface FreqPoint {
  id: string;
  frequency: number;
  type: FreqType;
  isActive: boolean;
  label: string;
  gain: number;
  category?: FrequencyCategory;
}

export interface Recording {
  id: string;
  timestamp: number;
  blob: Blob;
  url: string;
  duration: number;
  label?: string;
  analysis?: string;
}

export interface SpectralAnalysis {
  dominantFrequency: number;
  averageAmplitude: number;
  frequencyPeaks: number[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  category: FrequencyCategory;
  frequency: number;
  intensity: number;
  message: string;
  location?: { x: number, y: number, lat?: number, lng?: number };
}

export type NodeType = 'VICTIM' | 'STALKER' | 'RELAY' | 'SOURCE';

export interface SignalNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  frequency: number;
  category: FrequencyCategory;
  connectedTo?: string[]; // IDs of other nodes
  intensity: number;
  isHidden?: boolean;
  signatureColor?: string;
  isProtected?: boolean;
}

export interface BroadcastData {
  id: string;
  video?: string; // base64
  audio?: string; // base64
  image?: string; // base64
  timestamp: number;
  userName?: string;
  lat?: number;
  lng?: number;
  frequency?: number; // Custom broadcast frequency
}

export interface BroadcastLogEntry {
  id: string;
  timestamp: number;
  type: 'VIDEO' | 'AUDIO' | 'IMAGE';
  url?: string;
  frequency?: number;
  location?: { lat: number, lng: number };
  snapshot?: string;
}

export interface AutoRecordConfig {
  isEnabled: boolean;
  threshold: number; // 0-1
  targets: FrequencyCategory[];
}

export interface BroadcastState {
  isBroadcasting: boolean;
  activeBroadcasts: BroadcastData[];
  logs: BroadcastLogEntry[];
}
