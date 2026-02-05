"use client";
import { useEffect, useState, useMemo } from "react";
import Map from "./Map";

export default function BusTracker() {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("unit");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vegRes, routeRes] = await Promise.all([
          fetch("/api/vehicles"),
          fetch("/api/routes")
        ]);
        const vehicleData = await vegRes.json();
        const routeData = await routeRes.json();
        
        setVehicles(prev => {
          const fleetMap = new window.Map(prev.map(v => [v.id, v]));
          vehicleData.entity?.forEach(v => fleetMap.set(v.id, v));
          return Array.from(fleetMap.values());
        });
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
    const total = vehicles.length;
    const active = vehicles.filter(v => (Date.now() - (v.vehicle?.timestamp * 1000)) < 300000).length;
    return { total, active, hold: total - active };
  }, [vehicles]);

  const processedVehicles = useMemo(() => {
    let filtered = vehicles.filter(v => {
      const lastSeen = v.vehicle?.timestamp * 1000;
      const isStale = (Date.now() - lastSeen) > 300000;
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
        const routeA = (routes && idA && routes[String(idA)]) ? routes[String(idA)] : "zzz";
        const routeB = (routes && idB && routes[String(idB)]) ? routes[String(idB)] : "zzz";
        return routeA.localeCompare(routeB);
      }
      return (a.vehicle?.vehicle?.label || "").localeCompare(b.vehicle?.vehicle?.label || "");
    });
  }, [vehicles, routes, searchTerm, sortBy, filterStatus]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#002d72] text-white font-black italic">FLEET COMMAND INITIALIZING...</div>;

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 overflow-hidden">
      {/* SLENDER METRICS HEADER */}
      <div className="flex-none flex items-center justify-between px-6 py-2 bg-[#002d72] text-white shadow-xl z-[2000] relative">
        <div className="flex gap-4">
          <button onClick={() => setFilterStatus("all")} className={`flex flex-col items-start px-3 py-0.5 rounded transition-all border ${filterStatus === 'all' ? 'bg-white/20 border-white' : 'border-transparent hover:bg-white/10'}`}>
            <p className="text-[8px] font-bold opacity-70 uppercase">Total Fleet</p>
            <p className="text-lg font-black">{stats.total}</p>
          </button>
          <button onClick={() => setFilterStatus("active")} className={`flex flex-col items-start px-3 py-0.5 rounded transition-all border ${filterStatus === 'active' ? 'bg-green-900/40 border-green-400' : 'border-transparent hover:bg-white/10'}`}>
            <p className="text-[8px] font-bold opacity-70 uppercase text-green-400">Live Active</p>
            <p className="text-lg font-black text-green-400">{stats.active}</p>
          </button>
          <button onClick={() => setFilterStatus("hold")} className={`flex flex-col items-start px-3 py-0.5 rounded transition-all border ${filterStatus === 'hold' ? 'bg-orange-900/40 border-[#ef7c00]' : 'border-transparent hover:bg-white/10'}`}>
            <p className="text-[8px] font-bold opacity-70 uppercase text-[#ef7c00]">On Hold</p>
            <p className="text-lg font-black text-[#ef7c00]">{stats.hold}</p>
          </button>
        </div>
        <div className="text-right">
           <h1 className="text-lg font-black italic tracking-tighter">MARTA FLEET OPS</h1>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden relative z-0">
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shadow-2xl z-10">
          <div className="p-3 bg-white border-b border-slate-200 flex flex-col gap-2 shadow-sm">
            <input type="text" placeholder="🔍 Search Bus #..." value={searchTerm} className="w-full bg-slate-100 border border-slate-300 rounded px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:border-[#002d72] transition-colors text-slate-700" onChange={(e) => setSearchTerm(e.target.value)} />
            <div className="flex items-center justify-between">
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sort:</span>
               <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-white text-[9px] font-black uppercase py-1 px-2 rounded border border-slate-300 outline-none cursor-pointer text-[#002d72]">
                  <option value="unit">Bus #</option>
                  <option value="route">Route</option>
               </select>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto">
            {processedVehicles.map((v) => {
              const vehicle = v.vehicle;
              const busNum = vehicle?.vehicle?.label || vehicle?.vehicle?.id;
              const rId = vehicle?.trip?.route_id || vehicle?.trip?.routeId;
              const routeInfo = (routes && rId && routes[String(rId)]) ? routes[String(rId)] : "Special";
              const lastSeenMs = vehicle?.timestamp * 1000;
              const isStale = (Date.now() - lastSeenMs) > 300000;

              return (
                <button key={v.id} onClick={() => setSelectedId(vehicle?.vehicle?.id)} className={`w-full p-3 text-left border-b border-slate-100 flex items-center justify-between group ${selectedId === vehicle?.vehicle?.id ? 'bg-blue-50 border-l-4 border-[#002d72]' : 'hover:bg-white border-l-4 border-transparent'}`}>
                  <div>
                    {/* Bus: 1880 (Not bold) */}
                    <p className={`text-sm italic ${isStale ? 'text-slate-400' : 'text-slate-900'}`}>Bus: {busNum}</p>
                    <p className="text-[9px] font-bold text-[#ef7c00] uppercase truncate w-52 leading-none mt-1">{routeInfo.split(' - ')[1] || routeInfo}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-grow relative z-0">
          <Map buses={vehicles} selectedId={selectedId} routes={routes} />
        </div>
      </div>
    </div>
  );
}