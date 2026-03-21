
import React, { useRef, useEffect, useState } from 'react';

interface Props {
  analyzer: AnalyserNode | null;
  isActive: boolean;
  sampleRate?: number;
  freqPoints?: import('../types').FreqPoint[];
}

export const FrequencyScanner: React.FC<Props> = ({ analyzer, isActive, sampleRate = 44100, freqPoints = [] }) => {
  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  const [stats, setStats] = useState({ dominantFreq: 0, peakAmp: 0 });

  const draw = () => {
    if (!analyzer || !isActive) return;

    const bufferLength = analyzer.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);
    
    analyzer.getByteFrequencyData(freqData);
    analyzer.getByteTimeDomainData(timeData);

    // Calculate Dominant Frequency and Peak Amplitude
    let maxVal = -1;
    let maxIndex = -1;
    let sumAmp = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      if (freqData[i] > maxVal) {
        maxVal = freqData[i];
        maxIndex = i;
      }
      // RMS calculation for amplitude
      const val = (timeData[i] - 128) / 128;
      sumAmp += val * val;
    }
    
    const dominantFreq = maxIndex * (sampleRate / (bufferLength * 2));
    const rmsAmp = Math.sqrt(sumAmp / bufferLength);

    // Update stats occasionally to avoid too many renders if we were using state
    // But here we can just draw them on canvas for performance
    
    // FFT Visualization
    if (fftCanvasRef.current) {
      const canvas = fftCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (freqData[i] / 255) * canvas.height;
          
          // Color based on frequency and intensity
          const hue = (i / bufferLength) * 120 + 100; // Green to Blue
          ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${freqData[i] / 255 + 0.2})`;
          
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
        
        // Draw dominant frequency line
        const domX = (maxIndex / bufferLength) * canvas.width;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(domX, 0);
        ctx.lineTo(domX, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw TX/RX Markers
        if (Array.isArray(freqPoints)) {
          freqPoints.forEach(p => {
            if (!p.isActive) return;
            const x = (p.frequency / (sampleRate / 2)) * canvas.width;
            ctx.strokeStyle = p.type === 'TX' ? '#ff00ff' : '#00ffff';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            
            ctx.fillStyle = p.type === 'TX' ? '#ff00ff' : '#00ffff';
            ctx.font = '8px monospace';
            ctx.fillText(`${p.type}:${(p.frequency / 1000000).toFixed(6)}M`, x + 2, 10);
          });
        }
        ctx.setLineDash([]);
      }
    }

    // Oscilloscope Visualization
    if (scopeCanvasRef.current) {
      const canvas = scopeCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.1)';
        ctx.lineWidth = 1;
        for(let i=0; i<canvas.width; i+=50) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for(let i=0; i<canvas.height; i+=50) {
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00ff41';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00ff41';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Scrolling Spectrogram
    if (spectrogramCanvasRef.current) {
       const canvas = spectrogramCanvasRef.current;
       const ctx = canvas.getContext('2d');
       if (ctx) {
         // Shift everything left
         const imgData = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
         ctx.putImageData(imgData, 0, 0);

         // Draw new column at the right
         for (let i = 0; i < bufferLength; i++) {
           const val = freqData[i];
           // Heatmap colors: Black -> Blue -> Green -> Yellow -> Red
           let color;
           if (val < 64) color = `rgb(0, 0, ${val * 4})`;
           else if (val < 128) color = `rgb(0, ${(val - 64) * 4}, 255)`;
           else if (val < 192) color = `rgb(${(val - 128) * 4}, 255, ${255 - (val - 128) * 4})`;
           else color = `rgb(255, ${255 - (val - 192) * 4}, 0)`;
           
           ctx.fillStyle = color;
           const y = canvas.height - (i / bufferLength) * canvas.height;
           ctx.fillRect(canvas.width - 1, y, 1, (1 / bufferLength) * canvas.height + 1);
         }

         // Draw TX/RX horizontal lines on spectrogram
         if (Array.isArray(freqPoints)) {
           freqPoints.forEach(p => {
             if (!p.isActive) return;
             const y = canvas.height - (p.frequency / (sampleRate / 2)) * canvas.height;
             ctx.fillStyle = p.type === 'TX' ? 'rgba(255, 0, 255, 0.5)' : 'rgba(0, 255, 255, 0.5)';
             ctx.fillRect(canvas.width - 1, y, 1, 1);
           });
         }
       }
    }

    // Update stats for the UI
    if (Math.random() > 0.9) { // Throttle state updates
      setStats({ dominantFreq, peakAmp: rmsAmp });
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(draw);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, analyzer]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-green-900 p-2 rounded relative overflow-hidden">
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            <span className="text-[10px] uppercase font-bold text-green-500/70">Frequency Spectrum (FFT)</span>
            <span className="text-[12px] font-mono text-red-500 font-bold">
              PEAK: {(stats.dominantFreq / 1000000).toFixed(6)} MHz
            </span>
          </div>
          <canvas ref={fftCanvasRef} width={800} height={200} className="w-full h-32 md:h-48" />
        </div>
        
        <div className="bg-zinc-900 border border-green-900 p-2 rounded relative overflow-hidden">
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            <span className="text-[10px] uppercase font-bold text-green-500/70">Time Domain (Waveform)</span>
            <span className="text-[12px] font-mono text-green-400 font-bold">
              RMS: {(stats.peakAmp * 100).toFixed(2)}%
            </span>
          </div>
          <canvas ref={scopeCanvasRef} width={800} height={200} className="w-full h-32 md:h-48" />
        </div>
      </div>

      <div className="bg-zinc-900 border border-green-900 p-2 rounded relative md:col-span-2 overflow-hidden">
        <div className="absolute top-2 left-2 flex justify-between w-full pr-4 z-10">
          <span className="text-[10px] uppercase font-bold text-green-500/70">Signal Waterfall (Spectrogram)</span>
          <div className="flex gap-4 text-[8px] font-mono text-zinc-500">
            <span>0.020MHz</span>
            <span>0.010MHz</span>
            <span>0.005MHz</span>
            <span>0.000MHz</span>
          </div>
        </div>
        <canvas ref={spectrogramCanvasRef} width={1000} height={300} className="w-full h-48 md:h-64 cursor-crosshair" />
        <div className="absolute bottom-2 right-2 text-[8px] text-green-900 font-mono">
          REAL_TIME_SPECTRAL_FLUX_ACTIVE
        </div>
      </div>
    </div>
  );
};
