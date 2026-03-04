import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, limit, getDocs, deleteDoc, updateDoc } from "firebase/firestore";

export const StatusCharts = ({ buses, statusOptions, darkMode = false }: { buses: any[], statusOptions: any[], darkMode?: boolean }) => {
    // Dynamically calculate statuses
    const statusCounts: {[key: string]: number} = {};
    buses.forEach(b => { 
        const s = b.status || 'Active';
        statusCounts[s] = (statusCounts[s] || 0) + 1; 
    });

    const maxCount = Math.max(...Object.values(statusCounts), 1);
    
    // Generate Last 7 Days Data
    const trendData = [...Array(7)].map((_, i) => { 
        const d = new Date(); 
        d.setDate(d.getDate() - (6 - i)); 
        const ds = d.toISOString().split('T')[0]; 
        const label = `${d.getMonth() + 1}/${d.getDate()}`; // Format as MM/DD
        return { label, count: buses.filter(b => b.oosStartDate === ds).length }; 
    });

    const maxTrend = Math.max(...trendData.map(d => d.count), 4); // Minimum ceiling of 4 for better scaling
    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const gridClass = darkMode ? 'border-slate-700' : 'border-slate-100';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* --- HORIZONTAL BAR CHART: STATUS BREAKDOWN --- */}
            <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}>
                <h3 className={`text-[10px] font-black uppercase tracking-widest mb-6 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Status Breakdown</h3>
                <div className="space-y-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                    {Object.entries(statusCounts).sort((a,b) => b[1] - a[1]).map(([s, c]) => {
                        const type = statusOptions.find(o=>o.label===s)?.type || (s==='Active'?'ready':(['In Shop','Engine','Body Shop','Brakes'].includes(s)?'shop':'hold'));
                        const colorClass = type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-500';
                        const barBg = darkMode ? 'bg-slate-700' : 'bg-slate-100';
                        
                        return (
                            <div key={s} className="group">
                                <div className="flex justify-between items-end text-xs font-bold mb-1.5">
                                    <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>{s}</span>
                                    <span className="text-[10px] font-black">{c}</span>
                                </div>
                                <div className={`w-full ${barBg} rounded-full h-2 overflow-hidden`}>
                                    <div className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-out`} style={{ width: `${(c/maxCount)*100}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- VERTICAL BAR CHART: 7-DAY INTAKE TREND --- */}
            <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}>
                <h3 className={`text-[10px] font-black uppercase tracking-widest mb-6 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>7-Day Intake Trend</h3>
                
                <div className="relative h-[220px] flex items-end justify-between pt-4 pb-6">
                    {/* Y-Axis Labels & Background Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pb-6">
                        {[...Array(5)].map((_, i) => {
                            const val = Math.round(maxTrend - (i * (maxTrend / 4)));
                            return (
                                <div key={i} className={`flex items-center w-full border-t ${gridClass} h-0`}>
                                    <span className={`absolute -top-2.5 left-0 text-[9px] font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{val}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bars Container */}
                    <div className="relative z-10 flex items-end justify-around w-full h-full ml-6">
                        {trendData.map((d, i) => (
                            <div key={i} className="relative flex flex-col items-center flex-1 group h-full justify-end">
                                {/* Hover Tooltip */}
                                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                                    {d.count} unit{d.count !== 1 && 's'}
                                </div>
                                
                                {/* Vertical Bar */}
                                <div 
                                    className={`w-1/2 sm:w-2/3 max-w-[40px] rounded-t-md transition-all duration-700 ease-out hover:brightness-110 cursor-pointer ${darkMode ? 'bg-[#ef7c00]' : 'bg-[#002d72]'}`} 
                                    style={{ height: `${(d.count/maxTrend)*100}%`, minHeight: d.count > 0 ? '4px' : '0px' }}
                                ></div>
                                
                                {/* X-Axis Date Label */}
                                <div className={`absolute -bottom-6 text-[9px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {d.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AnalyticsDashboard = ({ buses, showToast, darkMode = false }: { buses: any[], showToast: any, darkMode?: boolean }) => {
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
    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Availability</p>
                <p className={`text-4xl font-black italic ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>
                    {Math.round(((buses.length - avgOOS) / Math.max(buses.length, 1)) * 100)}%
                </p>
            </div>
            <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Down Units</p>
                <p className="text-4xl font-black text-red-500 italic">{avgOOS}</p>
            </div>
            <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}>
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Admin</p>
                    <button onClick={handleResetMetrics} disabled={isResetting} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase border border-red-200 rounded px-2 py-1 bg-red-50 disabled:opacity-50 transition-colors">
                        {isResetting ? "Wiping..." : "Wipe All Databases"}
                    </button>
                </div>
                <div className="space-y-2 mt-4">
                    {shopQueens.length === 0 && <p className="text-xs italic opacity-50">No recurring issues found.</p>}
                    {shopQueens.map((queen, i) => (
                        <div key={i} className={`flex justify-between items-center text-xs border-b pb-1 ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                            <span className="font-bold">#{queen.number}</span>
                            <span className="font-mono text-red-500">{queen.count} logs</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};