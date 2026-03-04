"use client";
import { useEffect, useState, useMemo } from "react";
import dynamic from 'next/dynamic';

// Dynamically import the Map to prevent SSR issues
const Map = dynamic(() => import("./Map"), { 
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-50 text-[#002d72] italic font-bold">Loading Map Data...</div>
});

export default function BusTracker() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("unit");
  const [filterStatus, setFilterStatus] = useState("all");

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
    <div className="h-full flex items-center justify-center bg-slate-50 text-[#002d72] font-black italic animate-pulse rounded-3xl border shadow-sm">
        FLEET COMMAND INITIALIZING...
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden rounded-3xl">
      {/* INTERNAL COMPACT HEADER */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-[#002d72] text-white shadow-md z-10">
        <div className="flex gap-2">
          <button onClick={() => setFilterStatus("all")} className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all border ${filterStatus === 'all' ? 'bg-white/20 border-white' : 'border-transparent hover:bg-white/10'}`}>
            Fleet: {stats.total}
          </button>
          <button onClick={() => setFilterStatus("active")} className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all border ${filterStatus === 'active' ? 'bg-green-500 border-green-400' : 'border-transparent hover:bg-white/10'}`}>
            Live: {stats.active}
          </button>
          <button onClick={() => setFilterStatus("hold")} className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all border ${filterStatus === 'hold' ? 'bg-[#ef7c00] border-[#ef7c00]' : 'border-transparent hover:bg-white/10'}`}>
            Ghost: {stats.ghost}
          </button>
        </div>
        <h1 className="text-[10px] font-black italic tracking-widest opacity-50">REAL-TIME TELEMETRY</h1>
      </div>

      <div className="flex flex-grow overflow-hidden relative">
        {/* SIDEBAR BUS LIST */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col hidden sm:flex">
          <div className="p-3 bg-white border-b border-slate-200 flex flex-col gap-2">
            <input 
                type="text" 
                placeholder="Search Bus #..." 
                value={searchTerm} 
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:bg-white focus:border-[#002d72] transition-colors" 
                onChange={(e) => setSearchTerm(e.target.value)} 
            />
            <div className="flex items-center justify-between px-1">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sort By:</span>
               <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-[9px] font-black uppercase outline-none cursor-pointer text-[#002d72]">
                  <option value="unit">Bus #</option>
                  <option value="route">Route</option>
               </select>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar">
            {processedVehicles.length === 0 ? (
                <p className="text-[10px] text-center mt-10 opacity-40 font-bold uppercase">No Units Found</p>
            ) : processedVehicles.map((v) => {
              const vehicle = v.vehicle;
              const busNum = vehicle?.vehicle?.label || vehicle?.vehicle?.id;
              const rId = vehicle?.trip?.route_id || vehicle?.trip?.routeId;
              const cleanId = rId ? String(rId).trim() : "";
              let routeInfo = routes?.[cleanId] || (cleanId ? `Route ${cleanId}` : "Special");
              
              const lastSeenMs = (vehicle?.timestamp || 0) * 1000;
              const isStale = (Date.now() - lastSeenMs) > (5 * 60 * 1000); // Visual stale indicator if older than 5 mins

              return (
                <button 
                    key={v.id} 
                    onClick={() => setSelectedId(vehicle?.vehicle?.id)} 
                    className={`w-full p-3 text-left border-b border-slate-100 flex items-center justify-between group transition-all ${selectedId === vehicle?.vehicle?.id ? 'bg-blue-50 border-l-4 border-[#002d72]' : 'hover:bg-white border-l-4 border-transparent'}`}
                >
                  <div>
                    <p className={`text-xs font-black ${isStale ? 'text-slate-400' : 'text-slate-900'}`}>Unit {busNum}</p>
                    <p className="text-[8px] font-bold text-[#ef7c00] uppercase truncate w-40 mt-0.5">
                        {routeInfo.split(' - ')[1] || routeInfo}
                    </p>
                  </div>
                  {isStale && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_5px_#fb923c]"></span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-grow relative">
          <Map buses={vehicles} selectedId={selectedId} routes={routes} />
        </div>
      </div>
    </div>
  );
}