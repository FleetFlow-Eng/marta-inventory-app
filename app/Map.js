"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Component to handle jumping the map to a selected bus
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
        const unitNumber = vehicle?.vehicle?.id; // Standard MARTA Unit ID
        const routeInfo = routes?.find?.(r => r.route_id === vehicle?.trip?.route_id);

        if (!vehicle?.position) return null;

        return (
          <Marker 
            key={entity.id} 
            position={[vehicle.position.latitude, vehicle.position.longitude]}
            icon={busIcon}
          >
            {/* HOVER TOOLTIP: Now only shows when you hover over the icon */}
            <Tooltip direction="top" offset={[0, -40]} opacity={1}>
              <div className="font-black text-[#002d72] px-1">
                UNIT #{unitNumber} | ROUTE {routeInfo?.route_short_name || '??'}
              </div>
            </Tooltip>

            <Popup>
              <div className="p-1">
                <p className="font-black text-[#002d72] uppercase italic">Unit #{unitNumber}</p>
                <p className="text-[10px] font-bold text-[#ef7c00]">{routeInfo?.route_long_name}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}