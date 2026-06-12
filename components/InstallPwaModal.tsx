import React, { useState } from 'react';
import { X, Download, Monitor, Smartphone, ShieldCheck, Zap, Copy, Check, ExternalLink, Cpu } from 'lucide-react';

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
}

type TabType = 'PWA' | 'APK' | 'EXE';

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({ isOpen, onClose, onInstall }) => {
  const [activeTab, setActiveTab] = useState<TabType>('PWA');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.origin;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy URL:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
      <div className="bg-zinc-950 border border-emerald-500 w-full max-w-lg rounded-xl overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.25)] flex flex-col relative animate-in fade-in zoom-in duration-300">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
        
        {/* Custom Header */}
        <div className="p-5 border-b border-emerald-500/20 flex justify-between items-center bg-black/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/30">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-md font-black text-emerald-400 leading-none uppercase tracking-wider">Device Compiler</h3>
              <p className="text-[10px] text-emerald-500/50 font-mono mt-1 uppercase tracking-widest">Offline Package & APK Distribution</p>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-500/50 hover:text-emerald-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-emerald-500/10 bg-zinc-900/40 p-1">
          {[
            { id: 'PWA', label: '1-Click Install', icon: Download },
            { id: 'APK', label: 'Offline APK', icon: Smartphone },
            { id: 'EXE', label: 'Standalone EXE', icon: Monitor },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-1 py-2.5 px-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-emerald-600/55 hover:text-emerald-500 hover:bg-zinc-900/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'PWA' && (
            <div className="space-y-4">
              <div className="bg-black/60 border border-emerald-500/10 p-4 rounded-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <ShieldCheck className="w-12 h-12 text-emerald-400" />
                </div>
                <h4 className="text-xs font-black text-emerald-400 mb-2 flex items-center gap-2">
                  <Zap className="w-3 h-3" /> SECURITY ADVANTAGES:
                </h4>
                <ul className="text-[10px] text-emerald-500/70 font-mono space-y-2 uppercase leading-tight">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    OFFLINE SIGNAL CACHING ENGINE ENABLED
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    STANDALONE APP WINDOW WITH NO ADDRESS BAR
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    IMPROVED AUDIO CAPTURE AND MICROPHONE POLLING IN BACKGROUND
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    AUTONOMOUS OFFLINE WAKELOCK ACCELERATION
                  </li>
                </ul>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    onInstall();
                    onClose();
                  }}
                  className="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] group"
                >
                  <Download className="w-5 h-5 group-hover:animate-bounce" />
                  INSTANT SYSTEM INSTALL
                </button>
              </div>
            </div>
          )}

          {activeTab === 'APK' && (
            <div className="space-y-4 font-mono text-[10px] text-zinc-400">
              <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-lg">
                <h4 className="text-xs font-black text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> Android Offline .APK Creation
                </h4>
                <p className="leading-relaxed mb-3 text-[9px] uppercase tracking-wide">
                  This application includes a strict service worker and manifest making it prepared to compile instantly into a native android APK package. Follow these straightforward steps to distribute the system package locally:
                </p>
                
                <div className="space-y-3">
                  <div className="bg-black/50 border border-zinc-800 p-2.5 rounded">
                    <span className="text-emerald-400 font-bold block mb-1">STAGES 1: COPY INTERCEPT TARGET URL</span>
                    <div className="flex items-center justify-between gap-2 bg-zinc-900 px-3 py-2 rounded border border-emerald-500/10">
                      <span className="text-emerald-500/70 truncate text-[9px] select-all">{currentUrl}</span>
                      <button 
                        onClick={handleCopyUrl}
                        className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'COPIED' : 'COPY'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/50 border border-zinc-800 p-2.5 rounded">
                    <span className="text-emerald-400 font-bold block mb-1">STAGES 2: COMPILE STANDALONE PACKAGE</span>
                    <p className="mb-2 leading-snug">
                      Submit the target URL to a professional offline-first APK compiler service of your choice.
                    </p>
                    <a 
                      href="https://www.pwabuilder.com/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-emerald-500 hover:text-black transition-all text-emerald-400 border border-emerald-500/20 rounded font-black text-[9px]"
                    >
                      <ExternalLink className="w-3 h-3" /> LAUNCH PWABUILDER (FREE)
                    </a>
                  </div>

                  <div className="bg-black/50 border border-zinc-800 p-2.5 rounded">
                    <span className="text-emerald-400 font-bold block mb-1">STAGES 3: CONFIGURATION RECOMMENDATIONS</span>
                    <ul className="space-y-1 text-[9px] text-zinc-500 list-disc pl-4 uppercase">
                      <li>Package Id: <span className="text-emerald-400 font-mono">com.umair.v2k.frequencyvoice</span></li>
                      <li>Display Mode: <span className="text-emerald-400 font-mono">Standalone / Fullscreen</span></li>
                      <li>Offline Support: <span className="text-emerald-400 font-mono">ServiceWorker CacheEnabled</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'EXE' && (
            <div className="space-y-4 font-mono text-[10px] text-zinc-400">
              <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg">
                <h4 className="text-xs font-black text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" /> Standalone Desktop Executive Wrapper (.EXE)
                </h4>
                <p className="leading-relaxed mb-3 text-[9px] uppercase">
                  Run the frequency interception package inside a specialized borderless shell with direct sandbox hardware priority. High compatibility for Windows and macOS workstations:
                </p>

                <div className="space-y-3 text-[9px] uppercase">
                  <div className="border-l-2 border-emerald-500/30 pl-3 py-1">
                    <span className="text-emerald-400 block font-bold mb-0.5">PROCESS A: VIA INTEGRATED CHROMIUM SHELL</span>
                    <p className="text-zinc-500">
                      When browsing on Chrome or Edge, click the "App Available" or "Install" download icon in the upper-right corner of the address bar to create an isolated executable process on your taskbar.
                    </p>
                  </div>
                  <div className="border-l-2 border-emerald-500/30 pl-3 py-1">
                    <span className="text-emerald-400 block font-bold mb-0.5">PROCESS B: COMPACT WEB-TO-EXE WRAPPER</span>
                    <p className="text-zinc-500">
                      You can compile this manifest into a native standalone .exe package in seconds using Node command line tools: 
                      <code className="text-emerald-400 block bg-black border border-emerald-500/10 p-1.5 mt-1 select-all rounded font-mono text-[8px]">
                        npx nativefier --name "V2K-Signal-X" --platform "windows" "{currentUrl}"
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 border-t border-emerald-500/15 bg-black/30 flex justify-between items-center text-[8px] font-mono uppercase tracking-wider text-emerald-500/50">
          <span>Target Platform: {activeTab}</span>
          <span>Status: Verified Safe Standalone</span>
        </div>
      </div>
    </div>
  );
};
