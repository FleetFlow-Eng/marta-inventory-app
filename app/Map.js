import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- CLEAN MARKER ---
const createBusIcon = (isStale, isSelected) => {
    const color = isStale ? '#f43f5e' : '#10b981'; // Rose for stale, Emerald for live
    const size = isSelected ? 20 : 14; 
    
    const html = `
        <div style="
            background-color: ${color};
            width: ${size}px;
            height: ${size}px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 8px ${color};
            transition: all 0.2s ease;
        "></div>
    `;
    
    return L.divIcon({
        className: 'clean-bus-icon',
        html: html,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
};

// --- MAP CONTROLLER ---
const MapController = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
        }
    }, [center, zoom, map]);
    return null;
};

// --- MAIN MAP COMPONENT ---
export default function Map({ buses, selectedId, routes, darkMode }) {
    const defaultCenter = [33.7490, -84.3880]; 
    
    const selectedBus = buses?.find((b) => b.vehicle?.vehicle?.id === selectedId);
    const centerPoint = selectedBus && selectedBus.vehicle?.position?.latitude 
        ? [selectedBus.vehicle.position.latitude, selectedBus.vehicle.position.longitude] 
        : null;

    const tileUrl = darkMode 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    return (
        <MapContainer 
            center={defaultCenter} 
            zoom={11} 
            style={{ height: '100%', width: '100%', background: darkMode ? '#0f172a' : '#f8fafc', zIndex: 0 }}
            zoomControl={true}
        >
            <TileLayer url={tileUrl} />
            {centerPoint && <MapController center={centerPoint} zoom={16} />}

            {buses?.map((v) => {
                const vehicle = v.vehicle;
                const lat = vehicle?.position?.latitude;
                const lng = vehicle?.position?.longitude;
                
                if (!lat || !lng) return null;

                const busNum = vehicle?.vehicle?.label || vehicle?.vehicle?.id;
                const rId = vehicle?.trip?.route_id || vehicle?.trip?.routeId;
                const cleanId = rId ? String(rId).trim() : "";
                const routeInfo = routes?.[cleanId] || (cleanId ? `Route ${cleanId}` : "Special/NIS");
                
                const lastSeenMs = (vehicle?.timestamp || 0) * 1000;
                const isStale = (Date.now() - lastSeenMs) > (5 * 60 * 1000); 
                const isSelected = selectedId === vehicle?.vehicle?.id;

                return (
                    <Marker 
                        key={v.id} 
                        position={[lat, lng]} 
                        icon={createBusIcon(isStale, isSelected)}
                        zIndexOffset={isSelected ? 1000 : (isStale ? 1 : 100)}
                    >
                        {/* Native Tooltip for cleaner mobile viewing */}
                        <Tooltip permanent direction="bottom" offset={[0, 5]} opacity={0.9}>
                            <span style={{ fontWeight: '900', fontSize: '10px' }}>{busNum}</span>
                        </Tooltip>

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