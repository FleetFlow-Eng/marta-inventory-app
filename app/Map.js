"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Function to move the map to a selected bus from the sidebar
function MapRecenter({ bus }) {
  const map = useMap();
  useEffect(() => {
    if (bus?.vehicle?.position) {
      map.flyTo([bus.vehicle.position.latitude, bus.vehicle.position.longitude], 16);
    }
  }, [bus, map]);
  return null;
}

const busIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Map({ vehicles, routes, selectedBus }) {
  const center = [33.7490, -84.3880];

  return (
    <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapRecenter bus={selectedBus} />

      {vehicles?.map((entity) => {
        const vehicle = entity?.vehicle;
        if (!vehicle?.position) return null;

        // DECODING UNIT NUMBER
        const unitNumber = vehicle?.vehicle?.label || vehicle?.vehicle?.id;

        // DECODING ROUTE NUMBER
        const currentRouteId = vehicle?.trip?.route_id;
        const routeMatch = routes?.find(r => String(r.route_id) === String(currentRouteId));
        const routeDisplay = routeMatch?.route_short_name || "??";

        return (
          <Marker 
            key={entity.id} 
            position={[vehicle.position.latitude, vehicle.position.longitude]}
            icon={busIcon}
          >
            {/* HOVER TOOLTIP: Cleans up the map, shows numbers on hover */}
            <Tooltip direction="top" offset={[0, -40]} opacity={1}>
              <div className="font-black text-[#002d72] px-1 text-xs">
                #{unitNumber} | RT {routeDisplay}
              </div>
            </Tooltip>

            <Popup>
              <div className="p-1 min-w-[120px]">
                <p className="font-black text-[#002d72] uppercase italic text-sm">Unit #{unitNumber}</p>
                <p className="text-[10px] font-bold text-[#ef7c00] uppercase mb-1">Route {routeDisplay}</p>
                <p className="text-[9px] text-slate-500 italic border-t pt-1 border-slate-100">
                  {routeMatch?.route_long_name || "Details Loading..."}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}