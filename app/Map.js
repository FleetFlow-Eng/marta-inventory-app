"use client";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default Leaflet marker icons in Next.js
const busIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Map({ vehicles, routes }) {
  // Center of Atlanta/MARTA service area
  const center = [33.7490, -84.3880];

  return (
    <MapContainer 
      center={center} 
      zoom={11} 
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Loop through the MARTA vehicle entity array */}
      {Array.isArray(vehicles) && vehicles.map((entity) => {
        const vehicle = entity?.vehicle;
        if (!vehicle?.position) return null;

        // Extract Unit # and Route ID
        const unitNumber = vehicle?.vehicle?.id || "N/A";
        const routeID = vehicle?.trip?.route_id;

        // Cross-reference with the routes list safely
        const routeInfo = routes?.find?.(r => r.route_id === routeID);
        const routeShortName = routeInfo?.route_short_name || "??";
        const routeLongName = routeInfo?.route_long_name || "Searching for route info...";

        return (
          <Marker 
            key={entity.id} 
            position={[vehicle.position.latitude, vehicle.position.longitude]}
            icon={busIcon}
          >
            {/* TOOLTIP: Shows the bus number permanently above the icon */}
            <Tooltip permanent direction="top" offset={[0, -40]} opacity={0.9}>
              <span className="font-black text-[10px] text-[#002d72]">#{unitNumber}</span>
            </Tooltip>

            {/* POPUP: Full details when you click the marker */}
            <Popup>
              <div className="p-1 min-w-[140px] font-sans">
                <div className="flex justify-between items-center mb-1 gap-4">
                  <span className="text-[#002d72] font-black italic uppercase text-sm">
                    Unit #{unitNumber}
                  </span>
                  <span className="bg-[#ef7c00] text-white text-[10px] px-1.5 py-0.5 rounded font-black">
                    {routeShortName}
                  </span>
                </div>
                
                <p className="text-[10px] font-bold text-slate-600 uppercase leading-tight mb-2">
                  {routeLongName}
                </p>
                
                <hr className="my-2 border-slate-100" />
                
                <div className="flex flex-col gap-1">
                   <p className="text-[9px] text-slate-400 font-medium">
                    <span className="font-bold">LAT:</span> {vehicle.position.latitude.toFixed(5)}
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium">
                    <span className="font-bold">LON:</span> {vehicle.position.longitude.toFixed(5)}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}