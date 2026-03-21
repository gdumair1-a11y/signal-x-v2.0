
import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { SignalNode, FrequencyCategory, NodeType } from '../types';
import { Crosshair, Map as MapIcon, Layers, Satellite, Radar, Loader2, Navigation, Shield } from 'lucide-react';

// Fix Leaflet marker icon issue
import 'leaflet/dist/leaflet.css';

// Custom icons for different node types
const createIcon = (color: string) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const victimIcon = createIcon('#22c55e');
const protectedVictimIcon = createIcon('#3b82f6');
const stalkerIcon = createIcon('#ef4444');
const relayIcon = createIcon('#3b82f6');

interface Props {
  nodes: SignalNode[];
  onNodeClick: (node: SignalNode) => void;
  onProtect?: (nodeId: string) => void;
  selectedCategory: FrequencyCategory | 'ALL';
  onCategoryFilter: (category: FrequencyCategory | 'ALL') => void;
  userLocation?: { lat: number, lng: number };
  onScan?: () => void;
  isScanning?: boolean;
  highlightedNodeId?: string | null;
  showHidden?: boolean;
  onToggleHidden?: (show: boolean) => void;
  jammerTargetId?: string | null;
  isJamming?: boolean;
  onJam?: (nodeId: string) => void;
  onReceive?: (frequency: number) => void;
}

// Component to handle map center and zoom
const MapController: React.FC<{ center: [number, number], shouldRecenter: boolean, onRecentered: () => void }> = ({ center, shouldRecenter, onRecentered }) => {
  const map = useMap();
  
  useEffect(() => {
    if (shouldRecenter) {
      map.setView(center, 13, { animate: true });
      onRecentered();
    }
  }, [shouldRecenter, center, map, onRecentered]);

  return null;
};

export const SignalMap: React.FC<Props> = ({ 
  nodes, 
  onNodeClick, 
  onProtect, 
  selectedCategory, 
  onCategoryFilter, 
  userLocation, 
  onScan, 
  isScanning,
  highlightedNodeId,
  showHidden = true,
  onToggleHidden,
  jammerTargetId,
  isJamming,
  onJam,
  onReceive
}) => {
  const [isSatellite, setIsSatellite] = useState(false);
  const [scanRadius, setScanRadius] = useState(0);
  const [shouldRecenter, setShouldRecenter] = useState(false);

  // Auto-recenter on first location acquisition
  useEffect(() => {
    if (userLocation) {
      setShouldRecenter(true);
    }
  }, [userLocation ? `${userLocation.lat}-${userLocation.lng}` : null]);
  useEffect(() => {
    let interval: any;
    if (isScanning) {
      setScanRadius(0);
      interval = setInterval(() => {
        setScanRadius(prev => (prev >= 2000 ? 0 : prev + 100));
      }, 50);
    } else {
      setScanRadius(0);
    }
    return () => clearInterval(interval);
  }, [isScanning]);
  
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (selectedCategory !== 'ALL') {
      result = result.filter(n => n.category === selectedCategory);
    }
    if (!showHidden) {
      result = result.filter(n => !n.isHidden);
    }
    return result;
  }, [nodes, selectedCategory, showHidden]);

  const categories: (FrequencyCategory | 'ALL')[] = [
    'ALL', 'V2_MICROWAVE', 'EMP', 'EMF', 'CIRCULAR', 'BIO_ORGAN', 'VOICE'
  ];

  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : [0, 0];

  return (
    <div className="bg-zinc-900 border border-green-900 rounded p-4 flex flex-col gap-4 h-full relative overflow-hidden">
      <div className="flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-green-500" />
          <h3 className="text-xs font-black text-green-500 uppercase">Geospatial Signal Intercept Map</h3>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryFilter(cat)}
              className={`px-2 py-0.5 text-[8px] font-bold border transition-colors ${
                selectedCategory === cat 
                  ? 'bg-green-500 text-black border-green-400' 
                  : 'bg-zinc-800 text-green-900 border-zinc-700 hover:border-green-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 bg-black/50 border border-green-900/20 rounded overflow-hidden min-h-[300px] z-10">
        {!userLocation ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 p-6 text-center">
            <MapIcon className="w-12 h-12 text-green-900 mb-4 animate-pulse" />
            <h4 className="text-green-500 font-black uppercase mb-2">Location Confirmation Required</h4>
            <p className="text-[10px] text-zinc-500 max-w-xs uppercase font-mono">
              [SYSTEM_ALERT] Geospatial mapping disabled. Please confirm your current coordinates to initialize satellite intercept overlay.
            </p>
          </div>
        ) : (
          <MapContainer 
            center={center} 
            zoom={13} 
            style={{ height: '100%', width: '100%', background: '#050505' }}
            zoomControl={false}
            scrollWheelZoom={true}
            dragging={true}
          >
            <TileLayer
              url={isSatellite 
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png'
              }
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MapController 
              center={center} 
              shouldRecenter={shouldRecenter} 
              onRecentered={() => setShouldRecenter(false)} 
            />
            
            {isScanning && userLocation && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={scanRadius}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.1,
                  weight: 1,
                  dashArray: '5, 5'
                }}
              />
            )}
            
            {filteredNodes.map(node => {
              if (node.lat === undefined || node.lng === undefined) return null;
              
              const nodePos: [number, number] = [node.lat, node.lng];
              const isHidden = node.isHidden;
              const isHighlighted = highlightedNodeId === node.id;
              const isJammed = isJamming && jammerTargetId === node.id;
              
              return (
                <React.Fragment key={node.id}>
                  {isHighlighted && (
                    <Circle
                      center={nodePos}
                      radius={100}
                      pathOptions={{
                        color: isHidden ? '#52525b' : '#ef4444',
                        fillColor: isHidden ? '#52525b' : '#ef4444',
                        fillOpacity: 0.3,
                        weight: 2,
                        className: 'animate-pulse'
                      }}
                    />
                  )}
                  {isJammed && (
                    <Circle
                      center={nodePos}
                      radius={150}
                      pathOptions={{
                        color: '#a855f7',
                        fillColor: '#a855f7',
                        fillOpacity: 0.2,
                        weight: 1,
                        dashArray: '2, 5',
                        className: 'animate-spin-slow'
                      }}
                    />
                  )}
                  <Marker 
                    position={nodePos} 
                    icon={isHidden ? createIcon('#52525b') : (node.type === 'STALKER' ? stalkerIcon : node.type === 'VICTIM' ? (node.isProtected ? protectedVictimIcon : victimIcon) : relayIcon)}
                    eventHandlers={{
                      click: () => !isHidden && onNodeClick(node)
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="bg-zinc-900 text-green-500 p-2 font-mono text-[10px] border border-green-900 rounded">
                        {isHidden ? (
                          <div className="flex flex-col gap-1">
                            <div className="font-black border-b border-red-900/50 pb-1 mb-1 uppercase text-red-500 flex items-center gap-1">
                              <Radar className="w-3 h-3 animate-pulse" />
                              UNKNOWN_SIGNAL
                            </div>
                            <div className="text-zinc-500">SIGNATURE: {node.signatureColor}° HUE</div>
                            <div className="text-[8px] mt-1 text-zinc-600 italic">LOCATION_LOCKED_BUT_ENCRYPTED</div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className={`font-black border-b pb-1 mb-1 uppercase flex items-center justify-between ${node.isProtected ? 'text-blue-400 border-blue-900' : 'text-green-500 border-green-900'}`}>
                              <span>{node.label}</span>
                              {node.isProtected && <Shield className="w-3 h-3 animate-pulse" />}
                            </div>
                            <div>TYPE: {node.type}</div>
                            <div>FREQ: {(node.frequency / 1000000).toFixed(6)} MHz</div>
                            <div>CAT: {node.category}</div>
                            <div className="mb-2">INTENSITY: {(node.intensity * 100).toFixed(1)}%</div>
                            
                            <div className="flex flex-col gap-1 mt-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReceive && onReceive(node.frequency);
                                }}
                                className="w-full py-1 bg-green-900/20 border border-green-500/30 text-green-500 font-black uppercase rounded hover:bg-green-500 hover:text-black transition-all text-[8px]"
                              >
                                Receive Signal
                              </button>
                              
                              {node.type === 'STALKER' && onJam && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onJam(node.id);
                                  }}
                                  className={`w-full py-1 font-black uppercase rounded transition-colors border text-[8px] ${
                                    isJamming && jammerTargetId === node.id 
                                      ? 'bg-purple-600 text-white border-purple-400' 
                                      : 'bg-zinc-800 text-purple-500 border-purple-900 hover:bg-purple-900 hover:text-white'
                                  }`}
                                >
                                  {isJamming && jammerTargetId === node.id ? 'Stop Jamming' : 'Jam Signal'}
                                </button>
                              )}
                            </div>

                            {node.type === 'VICTIM' && !node.isProtected && onProtect && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onProtect(node.id);
                                }}
                                className="w-full py-1 bg-blue-600 text-white font-black uppercase rounded hover:bg-blue-500 transition-colors mt-1"
                              >
                                Erase_Attack
                              </button>
                            )}
                            {node.isProtected && (
                              <div className="text-[8px] text-blue-400 font-black uppercase text-center py-1 border border-blue-900/50 bg-blue-900/10">
                                SHIELDING_ACTIVE
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>

                  {!isHidden && node.connectedTo?.map(targetId => {
                    const target = nodes.find(n => n.id === targetId);
                    if (!target || target.lat === undefined || target.lng === undefined) return null;
                    
                    return (
                      <Polyline
                        key={`${node.id}-${targetId}`}
                        positions={[nodePos, [target.lat, target.lng]]}
                        color={node.type === 'STALKER' ? '#ef4444' : '#22c55e'}
                        weight={1}
                        dashArray="5, 5"
                        opacity={0.5}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </MapContainer>
        )}

        {userLocation && (
          <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-2">
            <button 
              onClick={() => onToggleHidden?.(!showHidden)}
              className={`p-2 bg-zinc-900 border border-green-900 rounded transition-colors shadow-lg ${showHidden ? 'text-green-500' : 'text-zinc-600'}`}
              title={showHidden ? "Hide Unknown Signals" : "Show Unknown Signals"}
            >
              <Radar className={`w-4 h-4 ${showHidden ? '' : 'opacity-50'}`} />
            </button>
            <button 
              onClick={() => setIsSatellite(!isSatellite)}
              className="p-2 bg-zinc-900 border border-green-900 rounded text-green-500 hover:bg-green-800 hover:text-black transition-colors shadow-lg"
              title={isSatellite ? "Switch to Streets" : "Switch to Satellite"}
            >
              {isSatellite ? <Layers className="w-4 h-4" /> : <Satellite className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setShouldRecenter(true)}
              className="p-2 bg-zinc-900 border border-green-900 rounded text-green-500 hover:bg-green-800 hover:text-black transition-colors shadow-lg"
              title="Recenter Map"
            >
              <Navigation className="w-4 h-4" />
            </button>
            <button 
              onClick={onScan}
              disabled={isScanning}
              className={`p-2 bg-zinc-900 border border-green-900 rounded text-green-500 hover:bg-green-800 hover:text-black transition-colors shadow-lg ${isScanning ? 'animate-pulse' : ''}`}
              title="Scan Area for Frequencies"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            </button>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-[1000] bg-black/50 p-2 rounded border border-green-900/20 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[8px] text-zinc-300 uppercase">Target (Victim)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[8px] text-zinc-300 uppercase">Source (Stalker)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[8px] text-zinc-300 uppercase">Relay/EMF Node</span>
          </div>
        </div>
      </div>

      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: #18181b;
          color: #22c55e;
          border: 1px solid #14532d;
          border-radius: 4px;
        }
        .custom-popup .leaflet-popup-tip {
          background: #14532d;
        }
        .leaflet-container {
          cursor: crosshair !important;
        }
      `}</style>
    </div>
  );
};
