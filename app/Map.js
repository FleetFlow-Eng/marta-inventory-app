import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- CUSTOM CSS MARKERS ---
const createBusIcon = (isStale: boolean, isSelected: boolean) => {
    const color = isStale ? '#f43f5e' : '#10b981'; // Rose for stale (Ghost), Emerald for live
    const size = isSelected ? 24 : 14; // Make the selected bus larger
    const ringSize = isSelected ? 4 : 2;
    const shadow = isSelected ? `0 0 15px ${color}` : `0 0 8px ${color}88`;
    
    const html = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: ${size}px; height: ${size}px;">
            <div style="
                background-color: ${color};
                width: 100%;
                height: 100%;
                border: ${ringSize}px solid #ffffff;
                border-radius: 50%;
                box-shadow: ${shadow};
                z-index: 2;
                transition: all 0.3s ease;
            "></div>
            ${!isStale ? `
            <div style="
                position: absolute;
                width: ${size * 2.5}px;
                height: ${size * 2.5}px;
                background-color: ${color};
                border-radius: 50%;
                animation: pulse 2s infinite;
                opacity: 0.4;
                z-index: 1;
            "></div>
            ` : ''}
        </div>
        <style>
            @keyframes pulse {
                0% { transform: scale(0.5); opacity: 0.6; }
                100% { transform: scale(1); opacity: 0; }
            }
        </style>
    `;
    
    return L.divIcon({
        className: 'custom-bus-icon',
        html: html,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
};

// --- MAP CONTROLLER (For Auto-Zooming) ---
const MapController = ({ center, zoom }: { center: [number, number] | null, zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
        }
    }, [center, zoom, map]);
    return null;
};

// --- MAIN MAP COMPONENT ---
export default function Map({ buses, selectedId, routes, darkMode }: any) {
    const defaultCenter: [number, number] = [33.7490, -84.3880]; // Atlanta Center
    
    // Find the currently selected bus to center the map
    const selectedBus = buses.find((b: any) => b.vehicle?.vehicle?.id === selectedId);
    const centerPoint: [number, number] | null = selectedBus && selectedBus.vehicle?.position?.latitude 
        ? [selectedBus.vehicle.position.latitude, selectedBus.vehicle.position.longitude] 
        : null;

    // Use CartoDB tiles for a much cleaner, professional look
    const tileUrl = darkMode 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    return (
        <MapContainer 
            center={defaultCenter} 
            zoom={11} 
            style={{ height: '100%', width: '100%', background: darkMode ? '#0f172a' : '#f8fafc' }}
            zoomControl={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                url={tileUrl}
            />
            
            {/* Triggers the "Fly-to" animation when you click a bus in the sidebar */}
            {centerPoint && <MapController center={centerPoint} zoom={16} />}

            {buses.map((v: any) => {
                const vehicle = v.vehicle;
                const lat = vehicle?.position?.latitude;
                const lng = vehicle?.position?.longitude;
                
                if (!lat || !lng) return null;

                const busNum = vehicle?.vehicle?.label || vehicle?.vehicle?.id;
                const rId = vehicle?.trip?.route_id || vehicle?.trip?.routeId;
                const cleanId = rId ? String(rId).trim() : "";
                const routeInfo = routes?.[cleanId] || (cleanId ? `Route ${cleanId}` : "Special/NIS");
                
                const lastSeenMs = (vehicle?.timestamp || 0) * 1000;
                const isStale = (Date.now() - lastSeenMs) > (5 * 60 * 1000); // 5 mins
                const isSelected = selectedId === vehicle?.vehicle?.id;

                return (
                    <Marker 
                        key={v.id} 
                        position={[lat, lng]} 
                        icon={createBusIcon(isStale, isSelected)}
                        zIndexOffset={isSelected ? 1000 : (isStale ? 1 : 100)}
                    >
                        <Popup closeButton={false}>
                            <div className="p-1 font-sans min-w-[140px]">
                                <h3 className="font-black text-xl mb-0.5 tracking-tighter text-[#002d72]">Unit {busNum}</h3>
                                <p className="text-[10px] font-bold text-[#ef7c00] uppercase mb-3 leading-tight border-b pb-2">
                                    {routeInfo.split(' - ')[1] || routeInfo}
                                </p>
                                
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[9px] font-black opacity-50 uppercase tracking-widest">Signal</span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isStale ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {isStale ? 'Lost' : 'Active'}
                                    </span>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MapContainer>
    );
}