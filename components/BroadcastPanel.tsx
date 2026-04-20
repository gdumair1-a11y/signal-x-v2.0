import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, VideoOff, Mic, MicOff, Radio, Image as ImageIcon, StopCircle, PlayCircle, RefreshCw, Hash, Save } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { BroadcastData, BroadcastLogEntry } from '../types';

interface BroadcastPanelProps {
  socket: Socket | null;
  userLocation: { lat: number, lng: number } | null;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({ socket, userLocation }) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [broadcastFrequency, setBroadcastFrequency] = useState<number>(440);
  const [logs, setLogs] = useState<BroadcastLogEntry[]>([]);

  const startMedia = async (mode: 'user' | 'environment' = facingMode): Promise<boolean> => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: mode
        },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // Setup audio recorder for streaming
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const audioRecorder = new MediaRecorder(mediaStream, { mimeType });
      audioRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && isBroadcasting) {
          const reader = new FileReader();
          reader.onloadend = () => {
            socket?.emit('broadcast-stream', { 
              audio: reader.result, 
              timestamp: Date.now(),
              lat: userLocation?.lat,
              lng: userLocation?.lng,
              frequency: broadcastFrequency
            });
          };
          reader.readAsDataURL(e.data);
        }
      };
      audioRecorderRef.current = audioRecorder;

      setHasCamera(true);
      setHasMic(true);
      setError(null);
      return true;
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Failed to access camera/microphone. Please check permissions.");
      return false;
    }
  };

  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    setIsBroadcasting(false);
  };

  const toggleBroadcast = async () => {
    if (!isBroadcasting) {
      let success = true;
      if (!stream) {
        success = await startMedia(facingMode);
      }
      
      if (success) {
        setIsBroadcasting(true);
        // Small delay to ensure stream tracks are fully operational across all browsers
        setTimeout(() => {
          try {
            if (audioRecorderRef.current && audioRecorderRef.current.state === 'inactive') {
              const stream = audioRecorderRef.current.stream;
              if (stream && stream.active && stream.getTracks().some(t => t.readyState === 'live')) {
                audioRecorderRef.current.start(1000); // Send audio every 1s
              } else {
                console.warn("MediaRecorder start deferred: Stream tracks not live yet.");
              }
            }
          } catch (err) {
            console.error("Failed to start audio recorder:", err);
          }
        }, 200);

        socket?.emit('broadcast-start', { 
          timestamp: Date.now(),
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          frequency: broadcastFrequency
        });

        const newLog: BroadcastLogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          type: 'VIDEO',
          frequency: broadcastFrequency,
          location: userLocation || { lat: 0, lng: 0 }
        };
        setLogs(prev => [newLog, ...prev]);
      }
    } else {
      setIsBroadcasting(false);
      if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
        audioRecorderRef.current.stop();
      }
      socket?.emit('broadcast-stop');
    }
  };

  const flipCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (stream) {
      const wasBroadcasting = isBroadcasting;
      stopMedia();
      await startMedia(newMode);
      if (wasBroadcasting) {
        setIsBroadcasting(true);
        setTimeout(() => {
          try {
            if (audioRecorderRef.current && audioRecorderRef.current.state === 'inactive') {
              const stream = audioRecorderRef.current.stream;
              if (stream && stream.active && stream.getTracks().some(t => t.readyState === 'live')) {
                audioRecorderRef.current.start(1000);
              }
            }
          } catch (err) {
            console.error("Failed to restart audio recorder during flip:", err);
          }
        }, 200);
      }
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        socket?.emit('broadcast-stream', { 
          image: imageData, 
          timestamp: Date.now(),
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          frequency: broadcastFrequency
        });

        const newLog: BroadcastLogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          type: 'IMAGE',
          snapshot: imageData,
          frequency: broadcastFrequency,
          location: userLocation || { lat: 0, lng: 0 }
        };
        setLogs(prev => [newLog, ...prev]);
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBroadcasting && socket && videoRef.current && canvasRef.current) {
      interval = setInterval(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const context = canvas?.getContext('2d');
        if (context && video && canvas) {
          canvas.width = 160; // Lower resolution for stream
          canvas.height = 120;
          context.drawImage(video, 0, 0, 160, 120);
          const frameData = canvas.toDataURL('image/jpeg', 0.5);
          socket.emit('broadcast-stream', { 
            video: frameData, 
            timestamp: Date.now(),
            lat: userLocation?.lat,
            lng: userLocation?.lng,
            frequency: broadcastFrequency
          });
        }
      }, 200); // 5 FPS for broadcast
    }
    return () => clearInterval(interval);
  }, [isBroadcasting, socket, userLocation]);

  return (
    <div className="bg-black/40 border border-[#00ff41]/30 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Radio className={`w-5 h-5 ${isBroadcasting ? 'text-red-500 animate-pulse' : 'text-[#00ff41]'}`} />
          LIVE BROADCAST
        </h3>
        <div className="flex gap-2">
          {stream && (
            <button 
              onClick={flipCamera}
              className="px-3 py-1 bg-[#00ff41]/10 border border-[#00ff41]/50 rounded hover:bg-[#00ff41]/20 transition-colors text-xs flex items-center gap-2"
              title="Flip Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {!stream ? (
            <button 
              onClick={() => startMedia(facingMode)}
              className="px-3 py-1 bg-[#00ff41]/10 border border-[#00ff41]/50 rounded hover:bg-[#00ff41]/20 transition-colors text-xs flex items-center gap-2"
            >
              <Camera className="w-4 h-4" /> ENABLE CAM
            </button>
          ) : (
            <button 
              onClick={stopMedia}
              className="px-3 py-1 bg-red-500/10 border border-red-500/50 rounded hover:bg-red-500/20 transition-colors text-xs flex items-center gap-2 text-red-400"
            >
              <VideoOff className="w-4 h-4" /> DISABLE CAM
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/30">{error}</div>}

      <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[#00ff41]/20">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-[#00ff41]/40 text-sm">
            CAMERA OFFLINE
          </div>
        )}
        {isBroadcasting && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded animate-pulse">
            LIVE
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-[#00ff41]/70 uppercase font-mono flex items-center gap-2">
          <Hash className="w-3 h-3" /> BROADCAST FREQUENCY (Hz)
        </label>
        <input 
          type="number" 
          value={broadcastFrequency}
          onChange={(e) => setBroadcastFrequency(Number(e.target.value))}
          className="bg-black/40 border border-[#00ff41]/30 rounded px-3 py-2 text-[#00ff41] font-mono text-sm focus:outline-none focus:border-[#00ff41]/60"
          placeholder="Enter frequency..."
          disabled={isBroadcasting}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleBroadcast}
          disabled={!stream}
          className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${
            isBroadcasting 
              ? 'bg-red-600/20 border-red-600 text-red-400 hover:bg-red-600/30' 
              : 'bg-[#00ff41]/10 border-[#00ff41]/50 text-[#00ff41] hover:bg-[#00ff41]/20 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isBroadcasting ? (
            <><StopCircle className="w-5 h-5" /> STOP BROADCAST</>
          ) : (
            <><PlayCircle className="w-5 h-5" /> START BROADCAST</>
          )}
        </button>

        <button
          onClick={takeSnapshot}
          disabled={!stream}
          className="flex items-center justify-center gap-2 py-2 bg-blue-600/20 border border-blue-600/50 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImageIcon className="w-5 h-5" /> SEND SNAPSHOT
        </button>
      </div>

      <div className="text-[10px] text-[#00ff41]/50 font-mono">
        {isBroadcasting ? 'TRANSMITTING ENCRYPTED FEED...' : 'READY FOR TRANSMISSION'}
      </div>

      {logs.length > 0 && (
        <div className="mt-4 pt-4 border-top border-[#00ff41]/20 flex flex-col gap-2">
          <h4 className="text-[10px] text-[#00ff41]/70 font-bold uppercase tracking-widest flex items-center gap-2">
            <Save className="w-3 h-3" /> BROADCAST HISTORY
          </h4>
          <div className="max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {logs.map((log) => (
              <div key={log.id} className="bg-white/5 p-2 rounded border border-[#00ff41]/10 text-[10px] font-mono flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[#00ff41]">[{log.type}] {log.frequency}Hz</span>
                  <span className="opacity-50">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                {log.snapshot && (
                  <img src={log.snapshot} alt="Snapshot" className="w-full h-auto rounded border border-[#00ff41]/20 mt-1" referrerPolicy="no-referrer" />
                )}
                {log.location && (
                  <div className="text-[8px] opacity-40">LOC: {log.location.lat.toFixed(4)}, {log.location.lng.toFixed(4)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
