"use client";
import { useEffect, useState } from "react";
import Map from "./Map";

export default function BusTracker() {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vegRes, routeRes] = await Promise.all([
          fetch("/api/vehicles"),
          fetch("/api/routes")
        ]);

        // Guard against failed network requests
        if (!vegRes.ok || !routeRes.ok) throw new Error("Network response was not ok");

        const vehicleData = await vegRes.json();
        const routeData = await routeRes.json();

        // Safely set data with fallback to empty arrays
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

  // Display a themed loading state for MARTA Ops
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#ef7c00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Updating Live Positions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-3 bg-[#002d72] text-white flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h1 className="text-xs font-black uppercase tracking-tighter italic">Live Fleet Status</h1>
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
          Units Transmitting: <span className="text-[#ef7c00] ml-1">{vehicles?.length || 0}</span>
        </div>
      </div>
      
      <div className="flex-grow relative">
        {/* Only render Map if we have data to prevent the .find() crash */}
        {vehicles?.length > 0 ? (
          <Map vehicles={vehicles} routes={routes} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-bold uppercase">
            Waiting for GPS Signal...
          </div>
        )}
      </div>
    </div>
  );
}