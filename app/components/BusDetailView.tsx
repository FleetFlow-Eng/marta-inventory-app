import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { logHistory, logActivity, formatTime } from '../utils';

export const BusDetailView = ({ bus, onClose, showToast, darkMode, isAdmin, statusOptions }: { bus: any; onClose: () => void; showToast: any, darkMode: boolean, isAdmin: boolean, statusOptions: any[] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
    const [editData, setEditData] = useState({ status: bus.status || 'Active', location: bus.location || '', notes: bus.notes || '', oosStartDate: bus.oosStartDate || '', expectedReturnDate: bus.expectedReturnDate || '', actualReturnDate: bus.actualReturnDate || '' });
    
    useEffect(() => { if (showHistory) return onSnapshot(query(collection(db, "buses", bus.number, "history"), orderBy("timestamp", "desc")), (snap) => setHistoryLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [showHistory, bus.number]);
    
    const handleSave = async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        if (editData.oosStartDate && editData.oosStartDate > todayStr) return showToast("Out of Service date cannot be a future date", 'error');
        try {
            const busRef = doc(db, "buses", bus.number);
            const currentSnap = await getDoc(busRef);
            const old = currentSnap.data() || {};
            let changes = [];
            if (old.status !== editData.status) changes.push(`STATUS: ${old.status} ➝ ${editData.status}`);
            if (old.notes !== editData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${editData.notes}"`);
            if (old.location !== editData.location) changes.push(`LOC: ${old.location || '—'} ➝ ${editData.location}`);
            await setDoc(busRef, { ...editData, timestamp: serverTimestamp() }, { merge: true });
            if (changes.length > 0) await logHistory(bus.number, "EDIT", changes.join('\n'), auth.currentUser?.email || 'Unknown');
            showToast(`Bus #${bus.number} updated`, 'success'); setIsEditing(false);
        } catch (err) { showToast("Save failed", 'error'); }
    };

    const handleDeleteLog = async (logId: string) => {
        if(!confirm("Delete log?")) return;
        try { await deleteDoc(doc(db, "buses", bus.number, "history", logId)); await logActivity(auth.currentUser?.email || 'Unknown', 'BUS', `Bus #${bus.number}`, 'DELETED', 'Deleted a history log entry'); showToast("Log deleted", 'success'); } 
        catch(err) { showToast("Failed to delete.", 'error'); }
    };

    const handleResetBus = async () => {
        if(!confirm("Reset this bus to Active?")) return;
        try {
            await setDoc(doc(db, "buses", bus.number), { status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() }, { merge: true });
            await logHistory(bus.number, "RESET", "Bus reset to default state.", auth.currentUser?.email || 'Unknown');
            showToast(`Bus #${bus.number} reset`, 'success'); onClose();
        } catch(err) { showToast("Reset failed", 'error'); }
    };

    const handleDateClick = (e: any) => e.currentTarget.showPicker?.();
    
    // Sleek glassmorphism classes
    const modalBgClass = darkMode ? 'bg-slate-900/95 border-slate-700/50 text-white backdrop-blur-xl' : 'bg-white/95 border-white/20 text-slate-900 backdrop-blur-xl';
    const inputClass = darkMode 
        ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-2 focus:ring-[#ef7c00]/50 focus:border-[#ef7c00] transition-all' 
        : 'bg-slate-50 border-slate-200 text-black focus:ring-2 focus:ring-[#002d72]/30 focus:border-[#002d72] transition-all shadow-inner';
        
    const type = statusOptions.find(o=>o.label===bus.status)?.type || (bus.status==='Active'?'ready':(['In Shop','Engine','Body Shop','Brakes'].includes(bus.status)?'shop':'hold'));
    const statusColorText = type==='ready' ? 'text-emerald-500' : type==='shop' ? 'text-amber-500' : 'text-rose-500';
    
    // Soft pastel badge for the modal
    const statusColorBadge = type==='ready' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400' : 
                             type==='shop' ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20 dark:text-amber-400' : 
                             'bg-rose-500/15 text-rose-600 border border-rose-500/20 dark:text-rose-400';

    if (showHistory) return (
        <div className={`p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95 duration-300 border ${modalBgClass}`}>
            <div className={`flex justify-between items-center mb-6 border-b border-slate-500/20 pb-4 font-black uppercase ${statusColorText}`}>
                <span className="text-xl">History: #{bus.number}</span>
                <button onClick={()=>setShowHistory(false)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 transition-colors text-slate-500 dark:text-slate-300">Back</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {historyLogs.map(l => (
                    <div key={l.id} className={`p-4 rounded-2xl border relative group transition-all hover:shadow-md ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className={`flex justify-between text-[9px] font-black uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <span className={l.action==='EDIT' ? 'text-[#ef7c00]' : l.action==='CREATED' ? 'text-emerald-500' : ''}>{l.action}</span>
                            <span>{formatTime(l.timestamp)}</span>
                        </div>
                        <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed opacity-90">{l.details}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest mt-3 opacity-40">{l.user}</p>
                        {isAdmin && <button onClick={() => handleDeleteLog(l.id)} className="absolute top-3 right-3 text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-rose-500/10 px-2 py-1 rounded font-black">DELETE</button>}
                    </div>
                ))}
                {historyLogs.length === 0 && <p className="text-center italic opacity-50 pt-10">No history found for this unit.</p>}
            </div>
        </div>
    );

    if (isEditing) return (
        <div className={`p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-2xl animate-in zoom-in-95 duration-300 border ${modalBgClass}`}>
            <h3 className={`text-2xl font-black mb-6 uppercase italic tracking-tight ${statusColorText}`}>Edit Bus #{bus.number}</h3>
            
            <div className="grid grid-cols-2 gap-5 mb-5">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Status</label>
                    <select className={`w-full p-3.5 rounded-xl font-bold outline-none ${inputClass}`} value={editData.status} onChange={e=>setEditData({...editData, status:e.target.value})}>
                        <option value="Active">Ready for Service</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option>
                        {statusOptions.map((o,i)=><option key={i} value={o.label}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Location</label>
                    <input className={`w-full p-3.5 rounded-xl font-bold outline-none ${inputClass}`} value={editData.location} onChange={e=>setEditData({...editData, location:e.target.value})} placeholder="E.g. Bay 4" />
                </div>
            </div>
            
            <div className="mb-5">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Maintenance Notes</label>
                <textarea className={`w-full p-4 rounded-xl h-28 font-medium outline-none resize-none ${inputClass}`} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} placeholder="Detail the current faults or required parts..." />
            </div>
            
            <div className="grid grid-cols-3 gap-5 mb-8">
                <div><label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">OOS Date</label><input type="date" onClick={handleDateClick} max={new Date().toISOString().split('T')[0]} className={`w-full p-2.5 rounded-xl font-bold cursor-pointer outline-none ${inputClass}`} value={editData.oosStartDate} onChange={e=>setEditData({...editData, oosStartDate:e.target.value})} /></div>
                <div><label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Exp. Return</label><input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2.5 rounded-xl font-bold cursor-pointer outline-none ${inputClass}`} value={editData.expectedReturnDate} onChange={e=>setEditData({...editData, expectedReturnDate:e.target.value})} /></div>
                <div><label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Act. Return</label><input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2.5 rounded-xl font-bold cursor-pointer outline-none ${inputClass}`} value={editData.actualReturnDate} onChange={e=>setEditData({...editData, actualReturnDate:e.target.value})} /></div>
            </div>
            
            <div className="flex gap-4">
                <button onClick={()=>setIsEditing(false)} className={`w-1/2 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Cancel</button>
                <button onClick={handleSave} className="w-1/2 py-4 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-colors">Save Changes</button>
            </div>
        </div>
    );

    return (
        <div className={`p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-2xl animate-in zoom-in-95 duration-300 border ${modalBgClass}`}>
            <div className="flex justify-between items-start mb-8 border-b border-slate-500/20 pb-6">
                <div>
                    <h3 className={`text-5xl font-black italic uppercase tracking-tighter ${statusColorText}`}>Unit #{bus.number}</h3>
                    <span className={`inline-block mt-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColorBadge}`}>{bus.status}</span>
                </div>
                <div className="flex gap-3 items-start">
                    <button onClick={handleResetBus} className="text-rose-500 text-[10px] tracking-widest font-black uppercase border border-rose-500/30 bg-rose-500/10 px-4 py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-colors">Reset Unit</button>
                    <button onClick={onClose} className={`p-1.5 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
            </div>

            <div className={`p-5 rounded-2xl mb-8 ${darkMode ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>
                <div className="flex items-center gap-2 mb-2 opacity-60">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <p className="text-[10px] font-black uppercase tracking-widest">Active Faults & Notes</p>
                </div>
                <p className="text-lg font-medium leading-relaxed">{bus.notes || <span className="italic opacity-50">No faults recorded for this unit.</span>}</p>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">OOS Date</p>
                    <p className="text-xl font-black text-[#002d72] dark:text-blue-400">{bus.oosStartDate || '--'}</p>
                </div>
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">Exp Return</p>
                    <p className="text-xl font-black text-[#ef7c00]">{bus.expectedReturnDate || '--'}</p>
                </div>
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">Act Return</p>
                    <p className="text-xl font-black text-emerald-500">{bus.actualReturnDate || '--'}</p>
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-500/20">
                <button onClick={()=>setShowHistory(true)} className={`px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    History
                </button>
                <div className="flex gap-3">
                    <button onClick={()=>setIsEditing(true)} className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${darkMode ? 'bg-[#ef7c00]/10 text-[#ef7c00] hover:bg-[#ef7c00]/20' : 'bg-[#002d72]/10 text-[#002d72] hover:bg-[#002d72]/20'}`}>Edit Unit</button>
                    <button onClick={onClose} className="px-8 py-3.5 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg">Close</button>
                </div>
            </div>
        </div>
    );
};