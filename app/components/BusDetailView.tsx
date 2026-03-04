import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { logHistory, logActivity, formatTime } from '../utils';

export const BusDetailView = ({ bus, onClose, showToast, darkMode, isAdmin, statusOptions }: { bus: any; onClose: () => void; showToast: any, darkMode: boolean, isAdmin: boolean, statusOptions: any[] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
    const [editData, setEditData] = useState({ 
        status: bus.status || 'Active', 
        location: bus.location || '', 
        notes: bus.notes || '', 
        oosStartDate: bus.oosStartDate || '', 
        expectedReturnDate: bus.expectedReturnDate || '', 
        actualReturnDate: bus.actualReturnDate || '',
        disposition: bus.disposition || ''
    });
    
    useEffect(() => { 
        if (showHistory) {
            return onSnapshot(query(collection(db, "buses", bus.number, "history"), orderBy("timestamp", "desc")), (snap) => {
                setHistoryLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        }
    }, [showHistory, bus.number]);
    
    const handleSave = async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        if (editData.oosStartDate) {
            if (editData.oosStartDate > todayStr) return showToast("Out of Service date cannot be a future date", 'error');
            if (editData.expectedReturnDate && editData.expectedReturnDate < editData.oosStartDate) return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            if (editData.actualReturnDate && editData.actualReturnDate < editData.oosStartDate) return showToast("Actual Return cannot be earlier than OOS Date", 'error');
        }
        try {
            const busRef = doc(db, "buses", bus.number);
            const currentSnap = await getDoc(busRef);
            const old = currentSnap.data() || {};
            let changes = [];
            
            if (old.status !== editData.status) changes.push(`STATUS: ${old.status} ➝ ${editData.status}`);
            if (old.notes !== editData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${editData.notes}"`);
            if (old.location !== editData.location) changes.push(`LOC: ${old.location || '—'} ➝ ${editData.location}`);
            if (isAdmin && old.disposition !== editData.disposition) changes.push(`DISP: "${old.disposition || ''}" ➝ "${editData.disposition}"`);

            await setDoc(busRef, { ...editData, timestamp: serverTimestamp() }, { merge: true });
            
            if (changes.length > 0) {
                await logHistory(bus.number, "EDIT", changes.join('\n'), auth.currentUser?.email || 'Unknown');
            }
            showToast(`Bus #${bus.number} updated`, 'success'); 
            setIsEditing(false);
        } catch (err) { 
            showToast("Save failed", 'error'); 
        }
    };

    const handleDeleteLog = async (logId: string) => {
        if(!confirm("Delete log?")) return;
        try { 
            await deleteDoc(doc(db, "buses", bus.number, "history", logId)); 
            await logActivity(auth.currentUser?.email || 'Unknown', 'BUS', `Bus #${bus.number}`, 'DELETED', 'Deleted a history log entry'); 
            showToast("Log deleted", 'success'); 
        } catch(err) { 
            showToast("Failed to delete.", 'error'); 
        }
    };

    const handleResetBus = async () => {
        if(!confirm("Reset this bus to Active?")) return;
        try {
            await setDoc(doc(db, "buses", bus.number), { status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', disposition: '', timestamp: serverTimestamp() }, { merge: true });
            await logHistory(bus.number, "RESET", "Bus reset to default state.", auth.currentUser?.email || 'Unknown');
            showToast(`Bus #${bus.number} reset`, 'success'); 
            onClose();
        } catch(err) { 
            showToast("Reset failed", 'error'); 
        }
    };

    const handleDateClick = (e: any) => e.currentTarget.showPicker?.();
    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';
    const type = statusOptions.find(o=>o.label===bus.status)?.type || (bus.status==='Active'?'ready':(['In Shop','Engine','Body Shop','Brakes'].includes(bus.status)?'shop':'hold'));
    const statusColorText = type==='ready' ? 'text-green-500' : type==='shop' ? 'text-orange-500' : 'text-red-500';
    const statusColorBadge = type==='ready' ? 'bg-green-500' : type==='shop' ? 'bg-orange-500' : 'bg-red-500';

    if (showHistory) return (
        <div className={`p-6 rounded-xl shadow-2xl w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95 border ${bgClass}`}>
            <div className={`flex justify-between items-center mb-4 border-b pb-4 font-black uppercase ${statusColorText}`}>
                <span>History: #{bus.number}</span>
                <button onClick={()=>setShowHistory(false)} className="text-xs hover:underline">Back</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {historyLogs.map(l => (
                    <div key={l.id} className={`p-3 rounded-lg border relative group ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className={`flex justify-between text-[8px] font-black uppercase mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>{l.action}</span>
                            <span>{formatTime(l.timestamp)}</span>
                        </div>
                        <p className="text-xs font-bold whitespace-pre-wrap leading-tight">{l.details}</p>
                        <p className="text-[8px] font-black uppercase mt-2 opacity-30">{l.user}</p>
                        {isAdmin && <button onClick={() => handleDeleteLog(l.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">DELETE</button>}
                    </div>
                ))}
            </div>
        </div>
    );

    if (isEditing) return (
        <div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}>
            <h3 className={`text-2xl font-black mb-6 uppercase italic ${statusColorText}`}>Edit Bus #{bus.number}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <select className={`p-3 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={editData.status} onChange={e=>setEditData({...editData, status:e.target.value})}>
                    <option value="Active">Ready for Service</option>
                    <option value="On Hold">On Hold</option>
                    <option value="In Shop">In Shop</option>
                    <option value="Engine">Engine</option>
                    <option value="Body Shop">Body Shop</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Safety">Safety</option>
                    {statusOptions.map((o,i)=><option key={i} value={o.label}>{o.label}</option>)}
                </select>
                <input className={`p-3 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={editData.location} onChange={e=>setEditData({...editData, location:e.target.value})} placeholder="Location" />
            </div>
            
            {isAdmin && (
                <input className={`w-full p-3 border-2 rounded-lg font-bold mb-4 outline-none focus:border-purple-500 ${inputClass}`} value={editData.disposition} onChange={e=>setEditData({...editData, disposition:e.target.value})} placeholder="Disposition / Fleet Status (Admin Only)" />
            )}

            <textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-4 font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} placeholder="Maintenance Notes" />
            
            <div className="grid grid-cols-3 gap-4 mb-6 text-[9px] font-black uppercase">
                <div>OOS Date<input type="date" onClick={handleDateClick} max={new Date().toISOString().split('T')[0]} className={`w-full p-2 border rounded mt-1 font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={editData.oosStartDate} onChange={e=>setEditData({...editData, oosStartDate:e.target.value})} /></div>
                <div>Exp Return<input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={editData.expectedReturnDate} onChange={e=>setEditData({...editData, expectedReturnDate:e.target.value})} /></div>
                <div>Act Return<input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={editData.actualReturnDate} onChange={e=>setEditData({...editData, actualReturnDate:e.target.value})} /></div>
            </div>
            
            <div className="flex gap-4">
                <button onClick={()=>setIsEditing(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-black'}`}>Cancel</button>
                <button onClick={handleSave} className="w-1/2 py-3 bg-[#002d72] hover:bg-blue-800 text-white rounded-xl font-black uppercase text-xs shadow-lg transition-colors">Save Changes</button>
            </div>
        </div>
    );

    return (
        <div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}>
            <div className="flex justify-between items-start mb-6 border-b border-slate-500/20 pb-4">
                <div>
                    <h3 className={`text-4xl font-black italic uppercase ${statusColorText}`}>Bus #{bus.number}</h3>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-sm ${statusColorBadge}`}>{bus.status}</span>
                </div>
                <div className="flex gap-2 items-start">
                    <button onClick={handleResetBus} className="text-red-500 text-xs font-black uppercase border border-red-500/30 bg-red-500/10 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition-colors">Reset</button>
                    <button onClick={onClose} className="text-slate-400 text-2xl font-bold hover:text-slate-500 transition-colors ml-2">✕</button>
                </div>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                <p className="text-[10px] font-black uppercase mb-2 opacity-50">Fault Details</p>
                <p className="text-lg font-medium">{bus.notes || "No active faults."}</p>
            </div>

            <div className={`grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-4 mb-6`}>
                <div>
                    <p className="text-[9px] font-black uppercase opacity-50">OOS Date</p>
                    <p className="text-xl font-black text-[#002d72]">{bus.oosStartDate || '--'}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase opacity-50">Exp Return</p>
                    <p className="text-xl font-black text-[#ef7c00]">{bus.expectedReturnDate || '--'}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase opacity-50">Act Return</p>
                    <p className="text-xl font-black text-green-500">{bus.actualReturnDate || '--'}</p>
                </div>
                {isAdmin && (
                    <div>
                        <p className="text-[9px] font-black uppercase opacity-50 text-purple-500">Disposition</p>
                        <p className="text-sm font-black text-purple-500 mt-1">{bus.disposition || '--'}</p>
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-500/20">
                <button onClick={()=>setShowHistory(true)} className={`px-5 py-3 rounded-lg text-[10px] font-black uppercase transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>📜 History</button>
                <div className="flex gap-3">
                    <button onClick={()=>setIsEditing(true)} className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase transition-colors ${darkMode ? 'bg-slate-700 text-[#ef7c00] hover:bg-slate-600' : 'bg-slate-100 text-[#002d72] hover:bg-slate-200'}`}>Edit</button>
                    <button onClick={onClose} className="px-8 py-3 bg-[#002d72] hover:bg-blue-800 text-white rounded-lg text-[10px] font-black uppercase transition-colors shadow-md">Close</button>
                </div>
            </div>
        </div>
    );
};