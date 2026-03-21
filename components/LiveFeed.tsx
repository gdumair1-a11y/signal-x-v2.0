import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { BroadcastData } from '../types';
import { Monitor, User, Clock, ShieldCheck } from 'lucide-react';

interface LiveFeedProps {
  socket: Socket | null;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ socket }) => {
  const [broadcasts, setBroadcasts] = useState<Record<string, BroadcastData>>({});

  useEffect(() => {
    if (!socket) return;

    socket.on('broadcast-received', (data: BroadcastData) => {
      setBroadcasts(prev => ({
        ...prev,
        [data.id]: {
          ...prev[data.id],
          ...data,
          timestamp: Date.now()
        }
      }));
    });

    socket.on('broadcast-stopped', (data: { id: string }) => {
      setBroadcasts(prev => {
        const next = { ...prev };
        delete next[data.id];
        return next;
      });
    });

    // Cleanup stale broadcasts (no updates for 5 seconds)
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

    return () => {
      socket.off('broadcast-received');
      socket.off('broadcast-stopped');
      clearInterval(interval);
    };
  }, [socket]);

  const broadcastList: BroadcastData[] = Object.values(broadcasts);

  return (
    <div className="bg-black/40 border border-[#00ff41]/30 rounded-xl p-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between border-b border-[#00ff41]/20 pb-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[#00ff41]" />
          INCOMING FEEDS
        </h3>
        <span className="text-xs bg-[#00ff41]/20 px-2 py-0.5 rounded text-[#00ff41]">
          {broadcastList.length} ACTIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {broadcastList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#00ff41]/30 gap-2 opacity-50">
            <ShieldCheck className="w-12 h-12" />
            <p className="text-sm">NO ACTIVE TRANSMISSIONS DETECTED</p>
          </div>
        ) : (
          broadcastList.map(feed => (
            <div key={feed.id} className="bg-black/60 border border-[#00ff41]/20 rounded-lg overflow-hidden">
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
                  <div className="absolute inset-0 flex items-center justify-center text-[#00ff41]/20">
                    SIGNAL LOST...
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-2">
                  <span className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded">LIVE</span>
                  {feed.image && !feed.video && (
                    <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-bold rounded">SNAPSHOT</span>
                  )}
                </div>
                {feed.audio && (
                  <audio 
                    src={feed.audio} 
                    autoPlay 
                    className="hidden" 
                    onPlay={(e) => {
                      // Ensure audio plays (browsers might block autoplay)
                      const target = e.target as HTMLAudioElement;
                      target.volume = 0.5;
                    }}
                  />
                )}
              </div>
              <div className="p-2 flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-2 text-[#00ff41]">
                  <User className="w-3 h-3" />
                  <span>NODE_{feed.id.slice(0, 4).toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2 text-[#00ff41]/60">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(feed.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
