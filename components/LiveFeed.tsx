import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { BroadcastData } from '../types';
import { Monitor, User, Clock, ShieldCheck, Download, Hash, LayoutGrid, History, Trash2, Camera, Video, Signal } from 'lucide-react';

interface LiveFeedProps {
  broadcasts: BroadcastData[];
  signalHistory: BroadcastData[];
  onClearHistory: () => void;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ broadcasts, signalHistory, onClearHistory }) => {
  const [activeView, setActiveView] = useState<'MONITORS' | 'GALLERY'>('MONITORS');
  const broadcastList = broadcasts;
  
  // Get the most recent 2 broadcasts for the "multi-monitor" layout
  const mostRecentTwo = [...broadcastList].sort((a, b) => b.timestamp - a.timestamp).slice(0, 2);
  const otherBroadcasts = broadcastList.filter(b => !mostRecentTwo.find(m => m.id === b.id));

  const downloadAsset = (data: string, type: 'video' | 'image' | 'audio', id: string) => {
    const link = document.createElement('a');
    link.href = data;
    const ext = type === 'image' ? 'jpg' : type === 'audio' ? 'webm' : 'webm';
    link.download = `broadcast_${id}_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-black/40 border border-[#00ff41]/30 rounded-xl p-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between border-b border-[#00ff41]/20 pb-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[#00ff41]" />
          SIGNAL INTERCEPT
        </h3>
        <div className="flex bg-black/60 rounded p-1 border border-[#00ff41]/20">
          <button 
            onClick={() => setActiveView('MONITORS')}
            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${activeView === 'MONITORS' ? 'bg-[#00ff41] text-black' : 'text-[#00ff41] hover:bg-[#00ff41]/10'}`}
          >
            <LayoutGrid className="w-3 h-3" /> LIVE
          </button>
          <button 
            onClick={() => setActiveView('GALLERY')}
            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${activeView === 'GALLERY' ? 'bg-[#00ff41] text-black' : 'text-[#00ff41] hover:bg-[#00ff41]/10'}`}
          >
            <History className="w-3 h-3" /> ARCHIVE
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {activeView === 'MONITORS' ? (
          <div className="flex flex-col gap-4">
            {broadcastList.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#00ff41]/30 gap-2 opacity-50">
                <ShieldCheck className="w-12 h-12" />
                <p className="text-sm">SCANNING FREQUENCIES...</p>
              </div>
            ) : (
              <>
                {/* Main Multi-Monitor Section (Next two lives) */}
                <div className={`grid gap-4 ${mostRecentTwo.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {mostRecentTwo.map(feed => (
                    <MonitorFrame key={feed.id} feed={feed} onDownload={downloadAsset} isLarge />
                  ))}
                </div>

                {/* Sub-Monitors Section */}
                {otherBroadcasts.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-[#00ff41]/10">
                    <h4 className="text-[10px] text-[#00ff41]/50 font-black uppercase tracking-widest pl-1">Secondary Channels</h4>
                    {otherBroadcasts.map(feed => (
                      <MonitorFrame key={feed.id} feed={feed} onDownload={downloadAsset} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-[10px] text-[#00ff41]/50 font-black uppercase">Intercept History</h4>
              <button 
                onClick={onClearHistory}
                className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                title="Clear History"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            
            {signalHistory.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#00ff41]/20 italic text-xs">
                NO SAVED INTERCEPTS
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {signalHistory.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="group relative bg-black border border-[#00ff41]/10 rounded overflow-hidden aspect-video">
                    {item.image || item.video ? (
                      <img 
                        src={item.video || item.image} 
                        alt="Archived Signal" 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-green-900/10">
                        <Signal className="w-6 h-6 text-green-900/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-1 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-center text-[8px] font-mono">
                        <span className="text-[#00ff41] truncate max-w-[60%]">{item.frequency || '??'}Hz</span>
                        <div className="flex gap-1">
                          {(item.video || item.image) && (
                            <button onClick={() => downloadAsset(item.video || item.image!, item.video ? 'video' : 'image', item.id)} className="p-1 bg-black/60 rounded border border-[#00ff41]/20">
                              <Download className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface MonitorFrameProps {
  feed: BroadcastData;
  onDownload: (data: string, type: 'video' | 'image' | 'audio', id: string) => void;
  isLarge?: boolean;
}

const MonitorFrame: React.FC<MonitorFrameProps> = ({ feed, onDownload, isLarge }) => {
  return (
    <div className={`bg-black/60 border border-[#00ff41]/20 rounded-lg overflow-hidden group shadow-[0_0_15px_rgba(0,255,65,0.05)]`}>
      <div className="aspect-video bg-black relative">
        {feed.video ? (
          <img 
            src={feed.video} 
            alt="Live Feed" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : feed.image ? (
          <img 
            src={feed.image} 
            alt="Snapshot" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#00ff41]/20 bg-[radial-gradient(#00ff4111_1px,transparent_1px)] [background-size:10px_10px]">
            <Signal className="w-8 h-8 animate-pulse text-[#00ff41]/10" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase tracking-tighter opacity-40">
              Carrier Detected...
            </div>
          </div>
        )}
        
        {/* Overlays */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <div className="px-1.5 py-0.5 bg-red-600 text-white text-[7px] font-black rounded flex items-center gap-1 uppercase">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
            Live
          </div>
          {feed.frequency && (
            <div className="px-1.5 py-0.5 bg-black/80 border border-[#00ff41]/40 text-[#00ff41] text-[7px] font-mono rounded flex items-center gap-1">
              <Hash className="w-2 h-2 opacity-50" /> {feed.frequency}
            </div>
          )}
        </div>

        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {feed.video && (
            <button 
              onClick={() => onDownload(feed.video!, 'video', feed.id)}
              className="p-1 bg-[#00ff41]/10 border border-[#00ff41]/40 rounded hover:bg-[#00ff41]/40 text-[#00ff41] transition-all"
            >
              <Video className="w-3 h-3" />
            </button>
          )}
          {feed.image && (
            <button 
              onClick={() => onDownload(feed.image!, 'image', feed.id)}
              className="p-1 bg-blue-600/10 border border-blue-600/40 rounded hover:bg-blue-600/40 text-blue-400 transition-all"
            >
              <Camera className="w-3 h-3" />
            </button>
          )}
        </div>

        {feed.audio && (
          <audio 
            src={feed.audio} 
            autoPlay 
            className="hidden" 
            onPlay={(e) => {
              const target = e.target as HTMLAudioElement;
              target.volume = 0.5;
            }}
          />
        )}
        
        {/* Subtle Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-10 [background-size:100%_2px,3px_100%]" />
      </div>

      <div className="p-1.5 flex items-center justify-between text-[8px] font-mono bg-zinc-900/80 border-t border-[#00ff41]/10">
        <div className="flex items-center gap-1.5 text-[#00ff41]/80">
          <User className="w-2.5 h-2.5 opacity-50" />
          <span className="tracking-tighter">NODE_{feed.id.slice(0, 6).toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#00ff41]/40">
          <Clock className="w-2.5 h-2.5" />
          <span>{new Date(feed.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
