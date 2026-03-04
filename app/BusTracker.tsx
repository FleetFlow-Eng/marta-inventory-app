"use client";
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- CUSTOM MARKER STYLE ---
// This creates a CSS-based marker that matches your MARTA Blue and Orange theme
const createBusIcon = (status: string, darkMode: boolean) => {
    const color = status === 'Active' ? '#10b981' : '#ef7c00'; // Emerald for active, Orange for others
    const html = `
        <div style="position: relative;">
            <div style="
                background-color: ${color};
                width: 14px;
                height: 14px;
                border: 3px solid ${darkMode ? '#0f172a' : '#fff'};
                border-radius: 50%;
                box-shadow: 0 0 10px ${color}88;
            "></div>
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                width: 14px;
                height: 14px;
                background-color: ${color};
                border-radius: 50%;
                animation: pulse 2s infinite;
                opacity: 0.5;
            "></div>
        </div>
        <style>
            @keyframes pulse {
                0% { transform: scale(1); opacity: 0.5; }
                100% { transform: scale(3); opacity: 0; }
            }
        </style>
    `;
    return L.divIcon({
        className: 'custom-bus-icon',
        html: html,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
};

export default function BusTracker({ buses, darkMode }: { buses: any[], darkMode: boolean }) {
    const [mapCenter] = useState<[number, number]>([33.7490, -84.3880]); // Atlanta Default

    // Professional Map Styles (using CartoDB Voyager or Dark Matter)
    const tileUrl = darkMode 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    return (
        <div className="h-full w-full relative group">
            {/* Overlay Info for "Command Center" feel */}
            <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
                <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 ${
                    darkMode ? 'bg-slate-900/80 border-slate-700 text-white' : 'bg-white/80 border-slate-200 text-slate-900'
                }`}>
                    <h3 className="text-xs font-black uppercase tracking-widest opacity-60">Hamilton Live Feed</h3>
                    <p className="text-xl font-black italic uppercase">Telemetry Active</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">
                            Tracking {buses.length} Units
                        </span>
                    </div>
                </div>
            </div>

            <MapContainer 
                center={mapCenter} 
                zoom={11} 
                style={{ height: '100%', width: '100%', background: darkMode ? '#0f172a' : '#f8fafc' }}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                    url={tileUrl}
                />
                
                <ZoomControl position="bottomright" />

                {buses.map((bus) => {
                    // Note: In a real production app, you'd pull the lat/lng from MARTA's API.
                    // For now, we're assuming the bus object has 'lat' and 'lng' properties.
                    if (!bus.lat || !bus.lng) return null;

                    return (
                        <Marker 
                            key={bus.docId} 
                            position={[bus.lat, bus.lng]} 
                            icon={createBusIcon(bus.status, darkMode)}
                        >
                            <Popup closeButton={false}>
                                <div className={`p-1 min-w-[150px] font-sans ${darkMode ? 'text-slate-900' : ''}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-lg font-black tracking-tighter">#{bus.number}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                            bus.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                        }`}>{bus.status}</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Last Reported</p>
                                    <p className="text-xs font-medium italic">📍 {bus.location || 'In Transit'}</p>
                                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between">
                                        <span className="text-[9px] font-black opacity-40 uppercase">Hamilton Div</span>
                                        <span className="text-[9px] font-black text-blue-600 uppercase">View Log</span>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* Subtle Vignette for "Premium" look */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.1)] z-[999]"></div>
        </div>
    );
}