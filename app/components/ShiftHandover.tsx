import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { formatTime } from '../utils';

export const ShiftHandover = ({ buses, showToast }: { buses: any[], showToast: any }) => {
    const [report, setReport] = useState<any[]>([]);
    useEffect(() => { 
        let isMounted = true;
        const fetchRecent = async () => { 
            const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000); 
            let logs: any[] = []; 
            const sampleBuses = buses.filter(x => x.status !== 'Active' || x.notes).slice(0, 30);
            for (const b of sampleBuses) { 
                if (!b.number) continue;
                const hSnap = await getDocs(query(collection(db, "buses", String(b.number), "history"), orderBy("timestamp", "desc"), limit(2))); 
                hSnap.forEach(d => { if((d.data().timestamp?.toMillis() || 0) > twelveHoursAgo) logs.push({ bus: b.number, ...d.data() }); }); 
            } 
            if (isMounted) setReport(logs.sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))); 
        }; 
        if(buses.length > 0) fetchRecent(); 
        return () => { isMounted = false; };
    }, [buses]);

    const copy = () => { 
        const txt = report.map(r => `[Unit ${r.bus}] ${r.action}: ${r.details}`).join('\n'); 
        navigator.clipboard.writeText(`SHIFT REPORT - ${new Date().toLocaleDateString()}\n\n${txt}`); 
        showToast("Report copied!", 'success'); 
    };

    return (
        <div className="max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-[#002d72] uppercase italic">Shift Handover</h2>
                <button onClick={copy} className="px-6 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-[#ef7c00] transition-all transform active:scale-95">Copy Report</button>
            </div>
            <div className="space-y-4">
                {report.length === 0 && <p className="text-center italic opacity-50 py-10">No recent activity in the last 12 hours.</p>}
                {report.map((l, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex gap-6 items-center">
                        <div className="w-16 h-16 bg-[#002d72]/5 rounded-xl flex items-center justify-center font-black text-[#002d72] text-lg">#{l.bus}</div>
                        <div className="flex-grow">
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] font-black text-[#ef7c00] uppercase">{l.action}</span>
                                <span className="text-[10px] font-bold text-slate-500">{formatTime(l.timestamp)}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{l.details}</p>
                            <p className="text-[9px] text-slate-400 mt-2 uppercase tracking-widest">{l.user}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};