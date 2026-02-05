"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// --- ICONS ---
const blueIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const greyIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const redIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapController({ selectedBus }) {
  const map = useMap();
  useEffect(() => {
    if (selectedBus?.vehicle?.position) {
      map.flyTo(
        [selectedBus.vehicle.position.latitude, selectedBus.vehicle.position.longitude], 
        15, { duration: 2 }
      );
    }
  }, [selectedBus, map]);
  return null;
}

// ADDED 'routes' prop here to receive your routes.json data
export default function Map({ buses, selectedId, pinnedIds = [], routes = {} }) {
  const position = [33.7490, -84.3880];
  const selectedBus = buses.find(b => b.vehicle?.vehicle?.id === selectedId);
  
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <MapContainer center={position} zoom={11} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap'
      />
      <MapController selectedBus={selectedBus} />
      
      {buses.map((bus) => {
        const vehicle = bus.vehicle?.vehicle;
        const id = vehicle?.id;
        if (!id) return null;

        // --- PROPER DECODING ---
        // 1. Bus Number (Uses Label like #2316)
        const busNumber = vehicle?.label || id;
        
        // 2. Route Number (Look up in your routes.json dictionary)
        const rawRouteId = bus.vehicle?.trip?.route_id;
        const properRouteNumber = routes[rawRouteId] || "??";

        const isSelected = id === selectedId;
        const isPinned = pinnedIds.includes(id); 
        const lat = bus.vehicle.position.latitude;
        const lon = bus.vehicle.position.longitude;
        const miles = bus.distanceToGarage ? bus.distanceToGarage.toFixed(1) : "?";
        
        const trail = bus.trail && bus.trail.length > 0 ? bus.trail : [[lat, lon]];

        // --- GHOST LOGIC ---
        // MARTA timestamp is in seconds, JavaScript needs milliseconds
        const lastSeen = bus.vehicle?.timestamp ? bus.vehicle.timestamp * 1000 : Date.now();
        const isStale = (Date.now() - lastSeen) > 300000;
        const timeString = new Date(lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        let currentIcon = blueIcon;
        let trailColor = "#3388ff"; 

        if (isPinned) {
            currentIcon = redIcon;
            trailColor = "red"; 
        } else if (isStale) {
            currentIcon = greyIcon;
            trailColor = "grey";
        }

        return (
          <div key={id}>
            <Polyline 
                positions={trail} 
                pathOptions={{ color: trailColor, weight: 3, opacity: 0.6, dashArray: '5, 10' }} 
            />

            <Marker 
                position={[lat, lon]}
                icon={currentIcon}
                opacity={isSelected ? 1.0 : (isStale && !isPinned ? 0.6 : 0.9)}
                zIndexOffset={isPinned ? 1000 : 0} 
            >
                {/* TOOLTIP: Now shows proper Unit and Route on hover */}
                <Tooltip direction="top" offset={[0, -40]}>
                    <span className="font-black text-[#002d72]">#{busNumber} | RT {properRouteNumber}</span>
                </Tooltip>

                <Popup>
                    <div className="font-sans">
                        <strong className="text-lg">Bus #{busNumber}</strong> 
                        {isPinned && <span style={{color: "red", fontWeight: "bold"}}> (OOS/WORK ORDER)</span>}
                        <br />
                        <span className="font-bold text-[#ef7c00]">Route: {properRouteNumber}</span>
                        <br />
                        
                        <div style={{fontWeight: "bold", color: "#d9534f", margin: "4px 0"}}>
                            {miles} miles from garage
                        </div>
                        
                        {isStale ? (
                           <span style={{ fontSize: "12px", color: "gray", fontWeight: "bold" }}>
                             👻 GHOST (Offline {timeString})
                           </span>
                        ) : (
                           <span style={{ fontSize: "12px", color: "green", fontWeight: "bold" }}>
                             🟢 LIVE ({timeString})
                           </span>
                        )}

                        <div style={{ marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "8px" }}>
                            <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "block",
                                backgroundColor: "#4285F4",
                                color: "white",
                                textAlign: "center",
                                padding: "8px 10px",
                                borderRadius: "4px",
                                textDecoration: "none",
                                fontSize: "12px",
                                fontWeight: "bold"
                            }}
                            >
                            🚗 Navigate to Unit
                            </a>
                        </div>
                    </div>
                </Popup>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  );
}