"use client";
import { useEffect, useState } from "react";
import Map from "./Map";

export default function BusTracker() {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vegRes, routeRes] = await Promise.all([
          fetch("/api/vehicles"),
          fetch("/api/routes")
        ]);
        const vehicleData = await vegRes.json();
        const routeData = await routeRes.json();
        setVehicles(vehicleData?.entity || []);
        setRoutes(routeData || []);
      } catch (error) {
        console.error("Error loading MARTA data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-900 text-blue-400 font-black italic">FETCHING LIVE FLEET...</div>;

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* SIDEBAR: List of active buses */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-4 bg-[#002d72] text-white">
          <h2 className="text-[10px] font-black uppercase tracking-widest">Active Units ({vehicles.length})</h2>
        </div>
        <div className="flex-grow overflow-y-auto divide-y divide-slate-100">
          {vehicles.map((v) => (
            <button 
              key={v.id}
              onClick={() => setSelectedBus(v)}
              className="w-full p-3 text-left hover:bg-white transition-colors group"
            >
              <div className="flex justify-between items-center">
                <span className="font-black text-slate-700 text-sm">#{v.vehicle?.vehicle?.id}</span>
                <span className="text-[9px] font-bold text-slate-400 group-hover:text-[#ef7c00]">VIEW →</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MAP AREA */}
      <div className="flex-grow relative">
        <Map vehicles={vehicles} routes={routes} selectedBus={selectedBus} />
      </div>
    </div>
  );
}