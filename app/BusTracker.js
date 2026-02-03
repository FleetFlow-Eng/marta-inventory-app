"use client";
import { useEffect, useState } from "react";
import Map from "./Map";
import useBusData from "./useBusData";

export default function BusTracker() {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetching both vehicles and routes to match your tracker logic
        const [vegRes, routeRes] = await Promise.all([
          fetch("/api/vehicles"),
          fetch("/api/routes")
        ]);

        const vehicleData = await vegRes.json();
        const routeData = await routeRes.json();

        // MARTA API usually returns data in an 'entity' array
        setVehicles(vehicleData.entity || []);
        setRoutes(routeData || []);
      } catch (error) {
        console.error("Error loading MARTA data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-4 text-white">Loading Live MARTA Feed...</div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
        <h1 className="text-xl font-bold">MARTA Live Fleet Tracker</h1>
        <div className="text-sm">
          Active Buses: {vehicles.length}
        </div>
      </div>
      
      <div className="flex-grow relative">
        {/* This passes the fetched data directly to your Map component */}
        <Map vehicles={vehicles} routes={routes} />
      </div>
    </div>
  );
}