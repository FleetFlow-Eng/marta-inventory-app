"use client";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';

const Map = dynamic(() => import("./Map"), { 
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-[#ef7c00] italic font-black">
            <div className="relative flex items-center justify-center w-32 h-32 mb-6">
                <div className="absolute inset-0 border-4 border-[#ef7c00]/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#ef7c00] rounded-full border-t-transparent animate-spin"></div>
                <span className="text-3xl">📡</span>
            </div>
            <span className="tracking-widest uppercase animate-pulse">Establishing Satellite Link...</span>
        </div>
    )
});

export default function BusTracker({ darkMode = false }: { darkMode?: boolean }) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("unit");
  const [filterStatus, setFilterStatus] = useState("all");

  const GHOST_TIMEOUT = 31536000000; 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vegRes, routeRes] = await Promise.all([
          fetch("/api/vehicles"),
          fetch("/api/routes")
        ]);
        const vehicleData = await vegRes.json();
        const routeData = await routeRes.json();
        
        if (vehicleData && vehicleData.entity) {
            setVehicles(prev => {
              const fleetMap = new window.Map(prev.map((v: any) => [v.id, v]));
              vehicleData.entity.forEach((v: any) => fleetMap.set(v.id, v));
              return Array.from(fleetMap.values());
            });
        }
        setRoutes(routeData || {});
      } catch (error) {
        console.error("Error loading MARTA data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000); 
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const vList = vehicles || [];
    const total = vList.length;
    const active = vList.filter(v => (Date.now() - ((v.vehicle?.timestamp || 0) * 1000)) < GHOST_TIMEOUT).length;
    return { total, active, ghost: total - active }; 
  }, [vehicles]);

  const processedVehicles = useMemo(() => {
    const vList = vehicles || [];
    let filtered = vList.filter(v => {
      const lastSeen = (v.vehicle?.timestamp || 0) * 1000;
      const isStale = (Date.now() - lastSeen) > GHOST_TIMEOUT;
      if (filterStatus === 'active') return !isStale;
      if (filterStatus === 'hold') return isStale;
      return true;
    });

    filtered = filtered.filter(v => {
      const busNum = (v.vehicle?.vehicle?.label || v.vehicle?.vehicle?.id || "").toLowerCase();
      return busNum.includes(searchTerm.toLowerCase());
    });

    return filtered.sort((a, b) => {
      if (sortBy === "route") {
        const idA = a.vehicle?.trip?.route_id || a.vehicle?.trip?.routeId;
        const idB = b.vehicle?.trip?.route_id || b.vehicle?.trip?.routeId;
        const cleanA = idA ? String(idA).trim() : "";
        const cleanB = idB ? String(idB).trim() : "";
        const routeA = (routes && cleanA && routes[cleanA]) ? routes[cleanA] : "zzz";
        const routeB = (routes && cleanB && routes[cleanB]) ? routes[cleanB] : "zzz";
        return routeA.localeCompare(routeB);
      }
      return (a.vehicle?.vehicle?.label || "").localeCompare(b.vehicle?.vehicle?.label || "");
    });
  }, [vehicles, routes, searchTerm, sortBy, filterStatus]);

  if (loading) return null; // Let the dynamic import loading state handle this

  const hudBg = darkMode ? 'bg-slate-900/85 border-slate-700/50' : 'bg-white/85 border-white/50';
  const textPrimary = darkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      
      {/* MAP LAYER - FULL SCREEN */}
      <div className="absolute inset-0 z-0">
        <Map buses={vehicles} selectedId={selectedId} routes={routes} darkMode={darkMode} />
        {/* Screen Glare/Vignette overlay for that modern tactical feel */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.3)] z-[400]"></div>
      </div>

      {/* FLOATING HUD PANEL */}
      <div className={`absolute top-4 left-4 bottom-4 w-80 flex flex-col z-10 rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl pointer-events-auto ${hudBg} hidden sm:flex`}>
        
        {/* Header & Search */}
        <div className={`p-5 border-b ${darkMode ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
            <div className="flex items-center justify-between mb-5">
                <h2 className={`text-xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Fleet Radar</h2>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live</span>
                </div>
            </div>

            <div className="relative mb-4">
                <input 
                    type="text" 
                    placeholder="Search Unit #..." 
                    value={searchTerm} 
                    className={`w-full pl-10 pr-4 py-3.5 rounded-xl text-xs font-bold outline-none transition-all focus:ring-2 focus:ring-[#ef7c00]/50 shadow-inner ${darkMode ? 'bg-slate-950/50 text-white placeholder-slate-500 border border-slate-800' : 'bg-slate-100 text-slate-900 placeholder-slate-400 border border-slate-200'}`} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            </div>

            {/* Segmented Control */}
            <div className={`flex p-1 rounded-xl shadow-inner ${darkMode ? 'bg-slate-950/50 border border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
                <button onClick={() => setFilterStatus("all")} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterStatus === 'all' ? (darkMode ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-[#002d72] shadow-md') : textSecondary}`}>
                    All ({stats.total})
                </button>
                <button onClick={() => setFilterStatus("active")} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterStatus === 'active' ? (darkMode ? 'bg-emerald-500/20 text-emerald-400 shadow-md' : 'bg-emerald-50 text-emerald-600 shadow-md') : textSecondary}`}>
                    Active
                </button>
                <button onClick={() => setFilterStatus("hold")} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterStatus === 'hold' ? (darkMode ? 'bg-rose-500/20 text-rose-400 shadow-md' : 'bg-rose-50 text-rose-600 shadow-md') : textSecondary}`}>
                    Ghost
                </button>
            </div>

            <div className="flex items-center justify-between mt-5 px-1">
               <span className={`text-[8px] font-black uppercase tracking-widest ${textSecondary}`}>Sort Feed By:</span>
               <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer hover:opacity-80 transition-opacity ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>
                  <option value="unit">Bus #</option>
                  <option value="route">Route ID</option>
               </select>
            </div>
        </div>

        {/* Bus List */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
          {processedVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-40 mt-10">
                  <span className="text-3xl mb-3">📡</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center">No Signals Detected</p>
              </div>
          ) : processedVehicles.map((v) => {
            const vehicle = v.vehicle;
            const busNum = vehicle?.vehicle?.label || vehicle?.vehicle?.id;
            const rId = vehicle?.trip?.route_id || vehicle?.trip?.routeId;
            const cleanId = rId ? String(rId).trim() : "";
            let routeInfo = routes?.[cleanId] || (cleanId ? `Route ${cleanId}` : "Special/NIS");
            
            const lastSeenMs = (vehicle?.timestamp || 0) * 1000;
            const isStale = (Date.now() - lastSeenMs) > (5 * 60 * 1000); 

            const isSelected = selectedId === vehicle?.vehicle?.id;
            const itemBg = isSelected 
                ? (darkMode ? 'bg-slate-800/80 border-[#ef7c00] shadow-lg scale-[1.02]' : 'bg-white border-[#002d72] shadow-lg scale-[1.02]') 
                : (darkMode ? 'border-transparent hover:bg-slate-800/50 bg-transparent' : 'border-transparent hover:bg-white/50 bg-transparent');

            return (
              <button 
                  key={v.id} 
                  onClick={() => setSelectedId(vehicle?.vehicle?.id)} 
                  className={`w-full p-3.5 rounded-xl border-l-4 text-left flex items-center justify-between group transition-all duration-200 ${itemBg}`}
              >
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-1">
                      <p className={`text-base font-black tracking-tight ${isStale ? 'opacity-50' : textPrimary}`}>Unit {busNum}</p>
                      {/* Pulse dot indicator inside the list */}
                      <span className={`w-2 h-2 rounded-full shadow-sm ${isStale ? 'bg-rose-500' : 'bg-emerald-400'}`}></span>
                  </div>
                  <p className={`text-[9px] font-bold uppercase truncate pr-2 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>
                      {routeInfo.split(' - ')[1] || routeInfo}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}