"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

      {/* Safety check: ensure vehicles is an array before mapping */}
      {Array.isArray(vehicles) && vehicles.map((entity) => {
        const vehicle = entity?.vehicle;
        if (!vehicle?.position) return null;

        // FIXED: Optional chaining (?.) prevents the "find of undefined" crash
        const routeInfo = routes?.find?.(r => r.route_id === vehicle.trip?.route_id);

        return (
          <Marker 
            key={entity.id} 
            position={[vehicle.position.latitude, vehicle.position.longitude]}
            icon={busIcon}
          >
            <Popup>
              <div className="font-sans">
                <p className="font-black text-[#002d72] text-sm italic uppercase">
                  Unit #{vehicle.vehicle?.id || "Unknown"}
                </p>
                <hr className="my-1 border-slate-200" />
                <p className="text-[10px] font-bold text-slate-600 uppercase">
                  Route: <span className="text-[#ef7c00]">{routeInfo?.route_short_name || "N/A"}</span>
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {routeInfo?.route_long_name || "Route Details Loading..."}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}