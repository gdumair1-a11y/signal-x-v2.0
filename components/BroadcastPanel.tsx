import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, VideoOff, Mic, MicOff, Radio, Image as ImageIcon, StopCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { BroadcastData } from '../types';

interface BroadcastPanelProps {
  socket: Socket | null;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({ socket }) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startMedia = async (mode: 'user' | 'environment' = facingMode) => {
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
      const audioRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
      audioRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && isBroadcasting) {
          const reader = new FileReader();
          reader.onloadend = () => {
            socket?.emit('broadcast-stream', { audio: reader.result, timestamp: Date.now() });
          };
          reader.readAsDataURL(e.data);
        }
      };
      audioRecorderRef.current = audioRecorder;

      setHasCamera(true);
      setHasMic(true);
      setError(null);
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Failed to access camera/microphone. Please check permissions.");
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

  const toggleBroadcast = () => {
    if (!isBroadcasting) {
      if (!stream) {
        startMedia(facingMode).then(() => {
          setIsBroadcasting(true);
          audioRecorderRef.current?.start(1000); // Send audio every 1s
          socket?.emit('broadcast-start', { timestamp: Date.now() });
        });
      } else {
        setIsBroadcasting(true);
        audioRecorderRef.current?.start(1000);
        socket?.emit('broadcast-start', { timestamp: Date.now() });
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
        audioRecorderRef.current?.start(1000);
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
        socket?.emit('broadcast-stream', { image: imageData, timestamp: Date.now() });
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBroadcasting && socket && videoRef.current && canvasRef.current) {
      interval = setInterval(() => {
        const context = canvasRef.current?.getContext('2d');
        if (context && videoRef.current) {
          canvasRef.current!.width = 160; // Lower resolution for stream
          canvasRef.current!.height = 120;
          context.drawImage(videoRef.current, 0, 0, 160, 120);
          const frameData = canvasRef.current!.toDataURL('image/jpeg', 0.5);
          socket.emit('broadcast-stream', { video: frameData, timestamp: Date.now() });
        }
      }, 200); // 5 FPS for broadcast
    }
    return () => clearInterval(interval);
  }, [isBroadcasting, socket]);

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
    </div>
  );
};
