"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, writeBatch, getDocs, getDoc, addDoc, deleteDoc, limit } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

const BusTracker = dynamic(() => import('./BusTracker'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[85vh] bg-slate-900 rounded-2xl border border-slate-700">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#002d72] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#ef7c00] font-black uppercase tracking-widest text-xs">Initializing Fleet Sync...</p>
      </div>
    </div>
  )
});

// --- HELPER: FORMAT TIMESTAMP ---
const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
};

const logHistory = async (busNumber: string, action: string, details: string, userEmail: string) => {
    if (!busNumber) return;
    try {
        await addDoc(collection(db, "buses", busNumber, "history"), {
            action,
            details,
            user: userEmail,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Failed to log history", err);
    }
};

// --- COMPONENT: STATUS CHARTS (Pure CSS/SVG) ---
const StatusCharts = ({ buses }: { buses: any[] }) => {
    // 1. Calculate Status Counts
    const statusCounts: {[key: string]: number} = {
        'Active': 0, 'In Shop': 0, 'Engine': 0, 'Body Shop': 0, 'Vendor': 0, 'Brakes': 0, 'Safety': 0
    };
    buses.forEach(b => {
        const s = b.status || 'Active';
        if (statusCounts[s] !== undefined) statusCounts[s]++;
    });
    const maxCount = Math.max(...Object.values(statusCounts), 1);

    // 2. Calculate 7-Day Intake Trend (Based on OOS Date)
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });
    const trendData = last7Days.map(date => {
        return buses.filter(b => b.oosStartDate === date).length;
    });
    const maxTrend = Math.max(...trendData, 1);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* CHART 1: STATUS DISTRIBUTION */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">Current Fleet Status</h3>
                <div className="flex items-end gap-3 h-40">
                    {Object.entries(statusCounts).map(([status, count]) => {
                        const height = (count / maxCount) * 100;
                        const color = status === 'Active' ? 'bg-green-500' : status === 'In Shop' ? 'bg-[#ef7c00]' : 'bg-red-500';
                        return (
                            <div key={status} className="flex-1 flex flex-col justify-end items-center group relative">
                                <div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                                <div className={`w-full rounded-t-md transition-all duration-500 ${color} ${height < 2 ? 'h-1' : ''}`} style={{ height: `${height}%` }}></div>
                                <p className="text-[8px] font-black text-slate-400 uppercase mt-2 -rotate-45 origin-left translate-y-2 whitespace-nowrap">{status}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CHART 2: 7-DAY INTAKE TREND */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">7-Day Shop Intake (New Failures)</h3>
                <div className="flex items-end gap-2 h-40 border-l border-b border-slate-100 pl-2 pb-2">
                    {trendData.map((count, i) => {
                        const height = (count / maxTrend) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                                <div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                                <div className="w-full bg-blue-100 hover:bg-blue-300 rounded-t-sm transition-all relative group" style={{ height: `${height || 2}%` }}>
                                    <div className="absolute w-full top-0 h-1 bg-blue-500"></div>
                                </div>
                                <p className="text-[8px] font-bold text-slate-300 mt-2">{last7Days[i].slice(5)}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: Analytics Tab ---
const AnalyticsDashboard = ({ buses }: { buses: any[] }) => {
    const [shopQueens, setShopQueens] = useState<{number: string, count: number}[]>([]);
    
    useEffect(() => {
        const fetchRankings = async () => {
            const rankings: {number: string, count: number}[] = [];
            // Optimization: Only scan 'Active' buses if fleet is huge, but here we scan all for accuracy
            // Limiting to first 50 buses to save reads in this demo context
            const sampleBuses = buses.slice(0, 50); 
            
            for (const bus of sampleBuses) {
                const hSnap = await getDocs(query(collection(db, "buses", bus.number, "history"), limit(20)));
                // We count 'EDIT' actions that changed status to non-active
                // For simplicity in this demo, we count total history logs as "activity"
                if (hSnap.size > 0) { 
                    rankings.push({ number: bus.number, count: hSnap.size });
                }
            }
            setShopQueens(rankings.sort((a,b) => b.count - a.count).slice(0, 5));
        };
        if(buses.length > 0) fetchRankings();
    }, [buses]);

    const avgOOS = buses.reduce((acc, b) => acc + (b.status !== 'Active' ? 1 : 0), 0);

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* STATUS CHARTS ADDED HERE */}
            <StatusCharts buses={buses} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Availability</p>
                    <p className="text-4xl font-black text-[#002d72] italic">{Math.round(((buses.length - avgOOS) / Math.max(buses.length, 1)) * 100)}%</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Down Units</p>
                    <p className="text-4xl font-black text-red-500 italic">{avgOOS}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Alerts</p>
                    <p className="text-4xl font-black text-slate-700 italic">0</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                <h3 className="text-xl font-black text-[#002d72] uppercase mb-6 flex items-center gap-2">
                    <span>👑</span> Top "Shop Queens" (High Activity)
                </h3>
                <div className="space-y-4">
                    {shopQueens.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Gathering reliability data...</p>
                    ) : shopQueens.map((queen, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-lg font-black text-slate-700">Bus #{queen.number}</span>
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold text-slate-400 uppercase">Recent Events:</span>
                                <div className="h-2 w-32 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${Math.min((queen.count / 10) * 100, 100)}%` }}></div>
                                </div>
                                <span className="text-sm font-black text-red-600">{queen.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: Shift Handover Tab ---
const ShiftHandover = ({ buses }: { buses: any[] }) => {
    const [report, setReport] = useState<any[]>([]);

    useEffect(() => {
        const fetchRecentLogs = async () => {
            const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
            let recentActivity: any[] = [];

            // Fetching recent logs from visible buses 
            // (Note: In a large production app, you'd query a root-level 'logs' collection instead)
            const activeBuses = buses.filter(b => b.status !== 'Active' || b.notes); 
            
            for (const bus of activeBuses.slice(0, 30)) { // Limit checks for performance
                const hRef = collection(db, "buses", bus.number, "history");
                const q = query(hRef, orderBy("timestamp", "desc"), limit(2));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const data = d.data();
                    const ts = data.timestamp?.toMillis() || 0;
                    if (ts > twelveHoursAgo) {
                        recentActivity.push({ bus: bus.number, ...data });
                    }
                });
            }
            setReport(recentActivity.sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
        };
        if(buses.length > 0) fetchRecentLogs();
    }, [buses]);

    const copyReport = () => {
        const text = report.map(r => `[Bus ${r.bus}] ${r.action}: ${r.details} (${r.user})`).join('\n');
        navigator.clipboard.writeText(`SHIFT HANDOVER REPORT - ${new Date().toLocaleDateString()}\n\n${text}`);
        alert("Report copied to clipboard!");
    };

    return (
        <div className="max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-[#002d72] uppercase italic">Shift Handover</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Automatic summary of the last 12 hours</p>
                </div>
                <button onClick={copyReport} className="px-6 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-[#ef7c00] transition-all">Copy Full Report</button>
            </div>

            <div className="space-y-4">
                {report.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-300 italic">No activity detected in recent logs.</div>
                ) : (
                    report.map((log, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-6 items-center">
                            <div className="w-20 h-20 bg-[#002d72]/5 rounded-xl flex flex-col items-center justify-center border border-[#002d72]/10">
                                <span className="text-[10px] font-black text-[#002d72] uppercase">Bus</span>
                                <span className="text-xl font-black text-[#002d72]">#{log.bus}</span>
                            </div>
                            <div className="flex-grow">
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] font-black text-[#ef7c00] uppercase tracking-tighter">{log.action}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{formatTime(log.timestamp)}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap line-clamp-2">{log.details}</p>
                                <p className="text-[9px] text-slate-400 mt-2 uppercase tracking-widest">Supervisor: {log.user}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- COMPONENT: Bus Details ---
const BusDetailView = ({ bus, onClose }: { bus: any; onClose: () => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
    
    const [editData, setEditData] = useState({
        status: bus.status || 'Active',
        location: bus.location || '',
        notes: bus.notes || '',
        oosStartDate: bus.oosStartDate || '',
        expectedReturnDate: bus.expectedReturnDate || '',
        actualReturnDate: bus.actualReturnDate || ''
    });

    useEffect(() => {
        if (showHistory) {
            const hRef = collection(db, "buses", bus.number, "history");
            const q = query(hRef, orderBy("timestamp", "desc"));
            const unsub = onSnapshot(q, (snap) => {
                setHistoryLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            return () => unsub();
        }
    }, [showHistory, bus.number]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            const busRef = doc(db, "buses", bus.number);
            const currentSnap = await getDoc(busRef);
            const oldData = currentSnap.exists() ? currentSnap.data() : {};

            let changes = [];
            if (oldData.status !== editData.status) changes.push(`STATUS: ${oldData.status} ➝ ${editData.status}`);
            if (oldData.location !== editData.location) changes.push(`LOC: ${oldData.location} ➝ ${editData.location}`);
            if (oldData.notes !== editData.notes) changes.push(`NOTES UPDATED`);
            if (oldData.oosStartDate !== editData.oosStartDate) changes.push(`OOS DATE: ${oldData.oosStartDate || 'N/A'} ➝ ${editData.oosStartDate}`);

            // Always save, even if changes array is empty (to update timestamp etc)
            await setDoc(busRef, { ...editData, timestamp: serverTimestamp() }, { merge: true });
            
            // Only log if something interesting happened
            if (changes.length > 0) {
                await logHistory(bus.number, "EDIT", changes.join('\n'), auth.currentUser?.email || 'Unknown');
            }
            
            setIsEditing(false);
        } catch (err) { alert("Save failed"); }
    };

    const deleteLog = async (id: string) => {
        if(confirm("Delete log?")) await deleteDoc(doc(db, "buses", bus.number, "history", id));
    };

    const handleReset = async () => {
        if (!confirm("Reset bus to Active?")) return;
        await setDoc(doc(db, "buses", bus.number), { status: 'Active', notes: '', location: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() }, { merge: true });
        await logHistory(bus.number, "RESET", "Unit reset to Active/Ready.", auth.currentUser?.email || 'Unknown');
        setIsEditing(false);
        onClose();
    };

    if (showHistory) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="text-xl font-black text-[#002d72] uppercase">History: #{bus.number}</h3>
                    <button onClick={() => setShowHistory(false)} className="text-sm font-bold text-slate-400">Back</button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-3">
                    {historyLogs.map((log) => (
                        <div key={log.id} className="group relative p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <button onClick={() => deleteLog(log.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">✕</button>
                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 mb-1">
                                <span className={log.action === 'RESET' ? 'text-red-500' : 'text-blue-500'}>{log.action}</span>
                                <span>{formatTime(log.timestamp)}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-700 leading-snug whitespace-pre-line">{log.details}</p>
                            <p className="text-[8px] text-slate-400 italic mt-1 text-right">{log.user}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl animate-in zoom-in-95">
                <h3 className="text-2xl font-black text-[#002d72] mb-6 uppercase italic tracking-tighter">Edit Bus #{bus.number}</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Status</label>
                        <select name="status" className="w-full p-3 bg-slate-50 border-2 rounded-lg font-bold" value={editData.status} onChange={handleChange}>
                            <option value="Active">Ready for Service</option>
                            <option value="In Shop">In Shop</option>
                            <option value="Engine">Engine</option>
                            <option value="Body Shop">Body Shop</option>
                            <option value="Vendor">Vendor</option>
                            <option value="Brakes">Brakes</option>
                            <option value="Safety">Safety</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Location</label>
                        <input name="location" type="text" className="w-full p-3 bg-slate-50 border-2 rounded-lg font-bold" value={editData.location} onChange={handleChange} />
                    </div>
                </div>
                <div className="space-y-1 mb-6">
                    <label className="text-[9px] font-black uppercase text-slate-400">Fault Details</label>
                    <textarea name="notes" className="w-full p-3 bg-slate-50 border-2 rounded-lg h-24" value={editData.notes} onChange={handleChange} />
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">OOS Date</label>
                        <input name="oosStartDate" type="date" className="w-full p-2 bg-slate-50 border-2 rounded-lg text-xs font-bold" value={editData.oosStartDate} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Exp Return</label>
                        <input name="expectedReturnDate" type="date" className="w-full p-2 bg-slate-50 border-2 rounded-lg text-xs font-bold" value={editData.expectedReturnDate} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Act Return</label>
                        <input name="actualReturnDate" type="date" className="w-full p-2 bg-slate-50 border-2 rounded-lg text-xs font-bold" value={editData.actualReturnDate} onChange={handleChange} />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={handleReset} className="w-1/3 py-3 bg-red-50 text-red-500 font-black rounded-xl uppercase text-xs hover:bg-red-100 transition-colors">Reset to Default</button>
                    <button onClick={handleSave} className="w-2/3 py-3 bg-[#002d72] text-white font-black rounded-xl uppercase text-xs shadow-lg hover:bg-[#ef7c00] transition-colors">Save Changes</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-8 border-b pb-6">
                <div>
                    <h3 className="text-4xl font-black text-[#002d72] italic uppercase">Bus #{bus.number}</h3>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${bus.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{bus.status}</span>
                </div>
                <button onClick={onClose} className="text-slate-400 text-2xl font-bold hover:text-slate-600">✕</button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Fault Details</p>
                <p className="text-lg font-medium text-slate-800">{bus.notes || "No active faults."}</p>
            </div>
            <div className="flex justify-between pt-6 border-t">
                <button onClick={() => setShowHistory(true)} className="px-5 py-3 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200">📜 History</button>
                <div className="flex gap-3">
                    <button onClick={() => setIsEditing(true)} className="px-8 py-3 bg-slate-100 text-[#002d72] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200">Edit</button>
                    <button onClick={onClose} className="px-8 py-3 bg-[#002d72] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#001a3d]">Close</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: Data Entry Form ---
const BusInputForm = () => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const busRef = doc(db, "buses", formData.number);
        const busSnap = await getDoc(busRef);
        if (!busSnap.exists()) return alert("⛔ ACCESS DENIED: Bus not in registry.");
        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        await logHistory(formData.number, "UPDATE", `Manual update via Data Entry. Status: ${formData.status}`, auth.currentUser?.email || 'Unknown');
        alert("Unit Updated!");
        setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    };

    return (
        <div className="max-w-2xl mx-auto mt-10 pb-20 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-[#002d72]">
                <h2 className="text-3xl font-black text-[#002d72] italic uppercase mb-8 text-center">Data Entry Terminal</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <input type="text" placeholder="Unit #" className="p-4 bg-slate-50 border-2 rounded-xl font-black text-[#002d72]" value={formData.number} onChange={handleChange} name="number" required />
                        <select className="p-4 bg-slate-50 border-2 rounded-xl font-bold" value={formData.status} onChange={handleChange} name="status"><option value="Active">Ready for Service</option><option value="On Hold">Maintenance Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option></select>
                    </div>
                    <input type="text" placeholder="Location" className="w-full p-4 bg-slate-50 border-2 rounded-xl" value={formData.location} onChange={handleChange} name="location" />
                    <textarea placeholder="Maintenance Notes" className="w-full p-4 bg-slate-50 border-2 rounded-xl h-24" value={formData.notes} onChange={handleChange} name="notes" />
                    <button className="w-full py-4 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg">Update Record</button>
                </form>
            </div>
        </div>
    );
};

export default MartaInventory;