import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, limit, getDocs, deleteDoc, updateDoc } from "firebase/firestore";

export const StatusCharts = ({ buses, statusOptions }: { buses: any[], statusOptions: any[] }) => {
    const statusCounts: {[key: string]: number} = {};
    buses.forEach(b => { 
        const s = b.status || 'Active';
        statusCounts[s] = (statusCounts[s] || 0) + 1; 
    });

    const maxCount = Math.max(...Object.values(statusCounts), 1);
    const trendData = [...Array(7)].map((_, i) => { 
        const d = new Date(); 
        d.setDate(d.getDate() - (6 - i)); 
        const ds = d.toISOString().split('T')[0]; 
        return { label: ds.slice(5), count: buses.filter(b => b.oosStartDate === ds).length }; 
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">Status Breakdown</h3>
                <div className="flex items-end gap-3 h-40">
                    {Object.entries(statusCounts).map(([s, c]) => {
                        const type = statusOptions.find(o=>o.label===s)?.type || (s==='Active'?'ready':(['In Shop','Engine','Body Shop','Brakes'].includes(s)?'shop':'hold'));
                        const colorClass = type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-500';
                        return (
                            <div key={s} className="flex-1 flex flex-col justify-end items-center group relative">
                                <div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{c}</div>
                                <div className={`w-full rounded-t-md transition-all duration-500 ${colorClass}`} style={{ height: `${(c/maxCount)*100 || 2}%` }}></div>
                                <p className="text-[8px] font-black text-slate-400 uppercase mt-2 -rotate-45 origin-left translate-y-2 whitespace-nowrap truncate w-full text-center">{s}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">7-Day Intake Trend</h3>
                <div className="flex items-end gap-2 h-40">
                    {trendData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                            <div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</div>
                            <div className="w-full bg-blue-100 hover:bg-[#002d72] rounded-t-sm transition-all" style={{ height: `${(d.count/Math.max(...trendData.map(t=>t.count),1))*100 || 2}%` }}></div>
                            <p className="text-[8px] font-bold text-slate-400 mt-2">{d.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const AnalyticsDashboard = ({ buses, showToast }: { buses: any[], showToast: any }) => {
    const [shopQueens, setShopQueens] = useState<{number: string, count: number}[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    
    useEffect(() => { 
        let isMounted = true;
        const fetchRankings = async () => { 
            try {
                const rankings: {number: string, count: number}[] = []; 
                const sampleBuses = buses.filter(b => b.number && b.status !== 'Active').slice(0, 30); 
                for (const bus of sampleBuses) { 
                    if (!bus.number) continue;
                    const hSnap = await getDocs(query(collection(db, "buses", String(bus.number), "history"), limit(20))); 
                    if (hSnap.size > 0) rankings.push({ number: bus.number, count: hSnap.size }); 
                } 
                if (isMounted) setShopQueens(rankings.sort((a,b) => b.count - a.count).slice(0, 5)); 
            } catch(e) { console.error("Failed to load rankings", e); }
        }; 
        if(buses.length > 0 && shopQueens.length === 0) fetchRankings(); 
        return () => { isMounted = false; };
    }, [buses, shopQueens.length]);
    
    const handleResetMetrics = async () => { 
        if(!confirm("⚠️ WARNING: This will permanently wipe ALL bus history, personnel incidents, and global audit logs. Proceed?")) return; 
        setIsResetting(true); 
        let errorCount = 0;
        try { 
            showToast("Wiping databases... please wait.", "success");
            
            const aSnap = await getDocs(collection(db, "activity_logs"));
            const aDocs = aSnap.docs;
            for (let i = 0; i < aDocs.length; i += 250) {
                await Promise.all(aDocs.slice(i, i + 250).map(d => deleteDoc(d.ref).catch(e => { errorCount++; })));
            }
            
            for (const bus of buses) { 
                if(!bus.number) continue;
                const hSnap = await getDocs(collection(db, "buses", String(bus.number), "history")); 
                const hDocs = hSnap.docs;
                for (let i = 0; i < hDocs.length; i += 250) {
                    await Promise.all(hDocs.slice(i, i + 250).map(d => deleteDoc(d.ref).catch(e => { errorCount++; })));
                }
            } 

            const pSnap = await getDocs(collection(db, "personnel"));
            const pDocs = pSnap.docs;
            for (let i = 0; i < pDocs.length; i += 250) {
                await Promise.all(pDocs.slice(i, i + 250).map(d => updateDoc(d.ref, { incidents: [], totalOccurrences: 0 }).catch(e => { errorCount++; })));
            }

            if (errorCount > 0) showToast(`Wiped, but ${errorCount} items failed. (Check console)`, 'error'); 
            else showToast(`All databases wiped successfully.`, 'success'); 
            
            setShopQueens([]); 
        } catch (err: any) { 
            showToast(`Failed: ${err.message}`, 'error'); 
        } 
        setIsResetting(false); 
    };

    const avgOOS = buses.reduce((acc, b) => acc + (b.status !== 'Active' ? 1 : 0), 0);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Availability</p>
                <p className="text-4xl font-black text-[#002d72] italic">{Math.round(((buses.length - avgOOS) / Math.max(buses.length, 1)) * 100)}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Down Units</p>
                <p className="text-4xl font-black text-red-500 italic">{avgOOS}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Admin</p>
                    <button onClick={handleResetMetrics} disabled={isResetting} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase border border-red-200 rounded px-2 py-1 bg-red-50 disabled:opacity-50 transition-colors">
                        {isResetting ? "Wiping..." : "Wipe All Databases"}
                    </button>
                </div>
                <div className="space-y-2">
                    {shopQueens.map((queen, i) => (
                        <div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1">
                            <span className="font-bold text-slate-700">#{queen.number}</span>
                            <span className="font-mono text-red-500">{queen.count} logs</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};