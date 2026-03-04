"use client";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';

// Dynamically import the Map to prevent SSR issues
const Map = dynamic(() => import("./Map"), { 
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-[#002d72] dark:text-[#ef7c00] italic font-black animate-pulse rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <svg className="w-12 h-12 mb-4 animate-spin opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            INITIALIZING SATELLITE LINK...
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
  
  // NEW: State to track if the user is looking at the Map or the List on mobile
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  // Configuration: 1 Year timeout (ghost buses essentially never disappear)
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

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-[#002d72] dark:text-[#ef7c00] font-black italic animate-pulse rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <svg className="w-12 h-12 mb-4 animate-spin opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        LOADING FLEET DATA...
    </div>
  );

  const sidebarBg = darkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-xl' : 'bg-white/90 border-slate-200 backdrop-blur-xl';
  const textPrimary = darkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex h-full overflow-hidden rounded-3xl border shadow-xl relative ${darkMode ? 'border-slate-800' : 'border-slate-300'}`}>
      
      {/* FLOATING MOBILE TOGGLE */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] sm:hidden flex bg-slate-900/90 backdrop-blur-md p-1.5 rounded-full shadow-2xl border border-slate-700">
         <button onClick={() => setMobileView('map')} className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${mobileView === 'map' ? 'bg-[#ef7c00] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Map</button>
         <button onClick={() => setMobileView('list')} className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${mobileView === 'list' ? 'bg-[#ef7c00] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>List</button>
      </div>

      {/* SIDEBAR COMMAND CENTER (Toggles visibility on mobile) */}
      <div className={`w-full sm:w-80 flex-col flex-shrink-0 border-r z-10 ${mobileView === 'list' ? 'flex' : 'hidden'} sm:flex ${sidebarBg}`}>
        
        {/* Header & Search */}
        <div className={`p-5 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Fleet Radar</h2>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${textSecondary}`}>Live</span>
                </div>
            </div>

            <div className="relative mb-4">
                <input 
                    type="text" 
                    placeholder="Search Unit #..." 
                    value={searchTerm} 
                    className={`w-full pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none transition-all focus:ring-2 focus:ring-[#ef7c00]/50 ${darkMode ? 'bg-slate-950 text-white placeholder-slate-600' : 'bg-slate-100 text-slate-900 placeholder-slate-400'}`} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40">🔍</span>
            </div>

            {/* Segmented Control for Filters */}
            <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
                <button onClick={() => setFilterStatus("all")} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${filterStatus === 'all' ? (darkMode ? 'bg-slate-800 text-white shadow' : 'bg-white text-[#002d72] shadow-sm') : textSecondary}`}>
                    All ({stats.total})
                </button>
                <button onClick={() => setFilterStatus("active")} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${filterStatus === 'active' ? (darkMode ? 'bg-emerald-500/20 text-emerald-400 shadow' : 'bg-emerald-50 text-emerald-600 shadow-sm') : textSecondary}`}>
                    Live
                </button>
                <button onClick={() => setFilterStatus("hold")} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${filterStatus === 'hold' ? (darkMode ? 'bg-rose-500/20 text-rose-400 shadow' : 'bg-rose-50 text-rose-600 shadow-sm') : textSecondary}`}>
                    Ghost
                </button>
            </div>

            <div className="flex items-center justify-between mt-4 px-1">
               <span className={`text-[8px] font-black uppercase tracking-widest ${textSecondary}`}>Sort By:</span>
               <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`bg-transparent text-[9px] font-black uppercase outline-none cursor-pointer ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>
                  <option value="unit">Bus #</option>
                  <option value="route">Route</option>
               </select>
            </div>
        </div>

        {/* Bus List */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1 pb-24 sm:pb-2">
          {processedVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-40">
                  <span className="text-2xl mb-2">📡</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center">No Signals Found</p>
              </div>
          ) : processedVehicles.map((v) => {
            const vehicle = v.vehicle;
            const busNum = vehicle?.vehicle?.label || vehicle?.vehicle?.id;
            const rId = vehicle?.trip?.route_id || vehicle?.trip?.routeId;
            const cleanId = rId ? String(rId).trim() : "";
            let routeInfo = routes?.[cleanId] || (cleanId ? `Route ${cleanId}` : "Special/NIS");
            
            const lastSeenMs = (vehicle?.timestamp || 0) * 1000;
            const isStale = (Date.now() - lastSeenMs) > (5 * 60 * 1000); // 5 minutes stale threshold

            const isSelected = selectedId === vehicle?.vehicle?.id;
            const itemBg = isSelected 
                ? (darkMode ? 'bg-slate-800 border-[#ef7c00]' : 'bg-blue-50 border-[#002d72]') 
                : (darkMode ? 'border-transparent hover:bg-slate-800/50' : 'border-transparent hover:bg-slate-50');

            return (
              <button 
                  key={v.id} 
                  onClick={() => {
                      setSelectedId(vehicle?.vehicle?.id);
                      setMobileView('map'); // Auto-switch to map on mobile when a bus is clicked
                  }} 
                  className={`w-full p-3 rounded-xl border-l-4 text-left flex items-center justify-between group transition-all duration-200 ${itemBg}`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-black tracking-tight ${isStale ? 'opacity-50' : textPrimary}`}>Unit {busNum}</p>
                      {/* Status LED */}
                      {isStale ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]" title="Signal Lost"></span>
                      ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" title="Signal Active"></span>
                      )}
                  </div>
                  <p className={`text-[9px] font-bold uppercase truncate w-48 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>
                      {routeInfo.split(' - ')[1] || routeInfo}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAP CONTAINER (Toggles visibility on mobile) */}
      <div className={`flex-grow relative bg-slate-100 ${darkMode ? 'bg-[#0f172a]' : 'bg-[#e2e8f0]'} ${mobileView === 'map' ? 'block' : 'hidden'} sm:block`}>
        <Map buses={vehicles} selectedId={selectedId} routes={routes} darkMode={darkMode} />
        {/* Subtle interior shadow for depth */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.1)] z-[400]"></div>
      </div>

    </div>
  );
}