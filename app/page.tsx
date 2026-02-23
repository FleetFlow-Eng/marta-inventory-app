"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, addDoc, deleteDoc, getDoc, getDocs, limit, writeBatch, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

import localParts from './partsData.json';

const BusTracker = dynamic(() => import('./BusTracker'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[50vh] bg-slate-100 rounded-2xl border border-slate-200">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#002d72] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#002d72] font-black uppercase tracking-widest text-xs">Loading Fleet...</p>
      </div>
    </div>
  )
});

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-[5000] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 border-l-8 ${type === 'success' ? 'bg-white border-green-500 text-slate-800' : 'bg-white border-red-500 text-slate-800'}`}>
            <span className="text-2xl">{type === 'success' ? '✅' : '📋'}</span>
            <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{type === 'success' ? 'Success' : 'Notice'}</p><p className="text-sm font-bold text-slate-800">{message}</p></div>
        </div>
    );
};

const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
};

const logHistory = async (busNumber: string, action: string, details: string, userEmail: string) => {
    if (!busNumber) return;
    try { await addDoc(collection(db, "buses", busNumber, "history"), { action, details, user: userEmail, timestamp: serverTimestamp() }); } catch (err) { console.error("History log failed", err); }
};

const getBusSpecs = (num: string) => {
    const n = parseInt(num);
    const thirtyFt = [1951, 1958, 1959];
    const thirtyFiveFt = [1887, 1888, 1889, 1895, 1909, 1912, 1913, 1921, 1922, 1923, 1924, 1925, 1926, 1927, 1928, 1929, 1930, 1931, 1932, 1933, 1935, 2326, 2343];
    if (thirtyFt.includes(n)) return { length: "30'", type: "S" };
    if (thirtyFiveFt.includes(n)) return { length: "35'", type: "M" };
    return { length: "40'", type: "L" };
};

const calculateDaysOOS = (start: string) => {
    if (!start) return 0;
    const s = new Date(start);
    const now = new Date();
    return Math.max(0, Math.ceil((now.getTime() - s.getTime()) / (1000 * 3600 * 24)));
};

const BusDetailView = ({ bus, onClose, showToast, darkMode }: { bus: any; onClose: () => void; showToast: (m:string, t:'success'|'error')=>void, darkMode: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
    const [editData, setEditData] = useState({ status: bus.status || 'Active', location: bus.location || '', notes: bus.notes || '', oosStartDate: bus.oosStartDate || '', expectedReturnDate: bus.expectedReturnDate || '', actualReturnDate: bus.actualReturnDate || '' });
    
    useEffect(() => { if (showHistory) return onSnapshot(query(collection(db, "buses", bus.number, "history"), orderBy("timestamp", "desc")), (snap) => setHistoryLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [showHistory, bus.number]);
    
    const handleSave = async () => {
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
        try { await deleteDoc(doc(db, "buses", bus.number, "history", logId)); showToast("Log deleted", 'success'); } catch(err) { showToast("Failed to delete", 'error'); }
    };

    const handleResetBus = async () => {
        if(!confirm("Reset this bus to Active?")) return;
        try {
            const busRef = doc(db, "buses", bus.number);
            await setDoc(busRef, { status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() }, { merge: true });
            await logHistory(bus.number, "RESET", "Bus reset to default state.", auth.currentUser?.email || 'Unknown');
            showToast(`Bus #${bus.number} reset`, 'success'); onClose();
        } catch(err) { showToast("Reset failed", 'error'); }
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';

    if (showHistory) return (<div className={`p-6 rounded-xl shadow-2xl w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95 border ${bgClass}`}><div className="flex justify-between items-center mb-4 border-b pb-4 font-black text-[#ef7c00] uppercase"><span>History: #{bus.number}</span><button onClick={()=>setShowHistory(false)} className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Back</button></div><div className="flex-grow overflow-y-auto space-y-3">{historyLogs.map(l => (<div key={l.id} className={`p-3 rounded-lg border relative group ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}><div className={`flex justify-between text-[8px] font-black uppercase mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><span>{l.action}</span><span>{formatTime(l.timestamp)}</span></div><p className={`text-xs font-bold whitespace-pre-wrap leading-tight ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{l.details}</p><button onClick={() => handleDeleteLog(l.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">DELETE</button></div>))}</div></div>);
    if (isEditing) return (<div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}><h3 className="text-2xl font-black text-[#ef7c00] mb-6 uppercase italic">Edit Bus #{bus.number}</h3><div className="grid grid-cols-2 gap-4 mb-4"><select className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.status} onChange={e=>setEditData({...editData, status:e.target.value})}><option value="Active">Ready</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option></select><input className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.location} onChange={e=>setEditData({...editData, location:e.target.value})} placeholder="Location" /></div><textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-4 font-bold ${inputClass}`} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} placeholder="Maintenance Notes" /><div className={`grid grid-cols-3 gap-4 mb-6 text-[9px] font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}><div>OOS Date<input type="date" className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.oosStartDate} onChange={e=>setEditData({...editData, oosStartDate:e.target.value})} /></div><div>Exp Return<input type="date" className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.expectedReturnDate} onChange={e=>setEditData({...editData, expectedReturnDate:e.target.value})} /></div><div>Act Return<input type="date" className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.actualReturnDate} onChange={e=>setEditData({...editData, actualReturnDate:e.target.value})} /></div></div><div className="flex gap-4"><button onClick={()=>setIsEditing(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-black'}`}>Cancel</button><button onClick={handleSave} className="w-1/2 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg">Save Changes</button></div></div>);
    return (
        <div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}>
            <div className="flex justify-between items-start mb-6 border-b border-slate-500/20 pb-4">
                <div><h3 className="text-4xl font-black text-[#ef7c00] italic uppercase">Bus #{bus.number}</h3><span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${bus.status==='Active'?'bg-green-500 text-white':'bg-red-500 text-white'}`}>{bus.status}</span></div>
                <div className="flex gap-2">
                    <button onClick={handleResetBus} className="text-red-500 text-xs font-black uppercase border border-red-500/30 bg-red-500/10 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition-colors">Reset</button>
                    <button onClick={onClose} className="text-slate-400 text-2xl font-bold hover:text-slate-300 transition-colors">✕</button>
                </div>
            </div>
            <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}><p className={`text-[10px] font-black uppercase mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Fault Details</p><p className={`text-lg font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{bus.notes || "No active faults."}</p></div>
            <div className="grid grid-cols-3 gap-4 mb-6"><div><p className={`text-[9px] font-black uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>OOS Date</p><p className="text-xl font-black text-[#002d72]">{bus.oosStartDate || '--'}</p></div><div><p className={`text-[9px] font-black uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Exp Return</p><p className="text-xl font-black text-[#ef7c00]">{bus.expectedReturnDate || '--'}</p></div><div><p className={`text-[9px] font-black uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Act Return</p><p className="text-xl font-black text-green-500">{bus.actualReturnDate || '--'}</p></div></div>
            <div className="flex justify-between pt-6 border-t border-slate-500/20"><button onClick={()=>setShowHistory(true)} className={`px-5 py-3 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>📜 History</button><div className="flex gap-3"><button onClick={()=>setIsEditing(true)} className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-slate-700 text-[#ef7c00]' : 'bg-slate-100 text-[#002d72]'}`}>Edit</button><button onClick={onClose} className="px-8 py-3 bg-[#002d72] text-white rounded-lg text-[10px] font-black uppercase">Close</button></div></div>
        </div>
    );
};

const PersonnelManager = ({ showToast, darkMode }: { showToast: (msg: string, type: 'success'|'error') => void, darkMode: boolean }) => {
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'dashboard' | 'log'>('dashboard');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [newEmpName, setNewEmpName] = useState('');
    const [incData, setIncData] = useState({ type: 'Sick', date: '', count: 1, docReceived: false, supervisorReviewDate: '', notes: '' });
    const [rosterSearch, setRosterSearch] = useState('');
    const [logFilter, setLogFilter] = useState({ search: '', type: 'All', sort: 'desc' });

    useEffect(() => { return onSnapshot(query(collection(db, "personnel"), orderBy("name")), (snap) => setPersonnel(snap.docs.map(d => ({ ...d.data(), id: d.id })))); }, []);

    const allIncidents = useMemo(() => {
        let logs: any[] = [];
        personnel.forEach(p => { if (p.incidents) { p.incidents.forEach((inc: any) => { logs.push({ ...inc, employeeName: p.name, employeeId: p.id }); }); } });
        return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [personnel]);

    const stats = useMemo(() => {
        const typeCounts: {[key: string]: number} = {}; const monthlyCounts: {[key: string]: {[key: string]: number}} = {}; let totalOccurrences = 0;
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        allIncidents.forEach(inc => {
            const c = parseInt(inc.count) || 1; totalOccurrences += c; typeCounts[inc.type] = (typeCounts[inc.type] || 0) + c;
            if (inc.date) {
                const month = monthNames[new Date(inc.date).getMonth()];
                if (!monthlyCounts[month]) monthlyCounts[month] = { Total: 0, Sick: 0, FMLA: 0, "No Call/No Show": 0, "Other": 0 };
                if(inc.type === 'Sick' || inc.type === 'Late Reporting') monthlyCounts[month]['Sick'] += c; else if(inc.type === 'FMLA') monthlyCounts[month]['FMLA'] += c; else if(inc.type === 'No Call/No Show' || inc.type === 'Failure to Report') monthlyCounts[month]['No Call/No Show'] += c; else monthlyCounts[month]['Other'] += c;
                monthlyCounts[month].Total += c;
            }
        });
        const topOffenders = [...personnel].sort((a,b) => (b.totalOccurrences || 0) - (a.totalOccurrences || 0));
        return { totalOccurrences, typeCounts, topOffenders, monthlyCounts, monthNames };
    }, [allIncidents, personnel]);

    const filteredLog = useMemo(() => {
        let logs = [...allIncidents];
        if (logFilter.search) logs = logs.filter(l => l.employeeName.toLowerCase().includes(logFilter.search.toLowerCase()));
        if (logFilter.type !== 'All') logs = logs.filter(l => l.type === logFilter.type);
        return logs.sort((a, b) => { return logFilter.sort === 'asc' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime(); });
    }, [allIncidents, logFilter]);

    const filteredRoster = useMemo(() => { if (!rosterSearch) return stats.topOffenders; return stats.topOffenders.filter(p => p.name.toLowerCase().includes(rosterSearch.toLowerCase())); }, [stats.topOffenders, rosterSearch]);

    const handleAddEmployee = async (e: React.FormEvent) => { e.preventDefault(); if(!newEmpName) return; try { await addDoc(collection(db, "personnel"), { name: newEmpName, totalOccurrences: 0, incidents: [], timestamp: serverTimestamp() }); showToast(`Added ${newEmpName}`, 'success'); setNewEmpName(''); setShowAddModal(false); } catch(err) { showToast("Failed to add employee", 'error'); } };
    const handleLogIncident = async () => {
        const targetId = selectedEmp ? selectedEmp.id : selectedEmpId; if(!targetId) return showToast("Select an employee", 'error');
        try {
            const newLog = { type: incData.type, date: incData.date || new Date().toISOString().split('T')[0], count: Number(incData.count), docReceived: incData.docReceived, supervisorReviewDate: incData.supervisorReviewDate, notes: incData.notes, loggedAt: new Date().toISOString() };
            await updateDoc(doc(db, "personnel", targetId), { totalOccurrences: increment(Number(incData.count)), incidents: arrayUnion(newLog) });
            showToast("Incident Saved", 'success'); setShowIncidentModal(false); setIncData({ type: 'Sick', date: '', count: 1, docReceived: false, supervisorReviewDate: '', notes: '' });
        } catch(err) { showToast("Failed to save", 'error'); }
    };
    const handleDeleteIncident = async (empId: string, incident: any) => {
        if(!confirm("Are you sure you want to permanently delete this incident record?")) return;
        try {
            const empSnap = await getDoc(doc(db, "personnel", empId)); if (!empSnap.exists()) return;
            const updatedIncidents = (empSnap.data().incidents || []).filter((i: any) => i.loggedAt !== incident.loggedAt);
            const newTotal = updatedIncidents.reduce((sum: number, i: any) => sum + (Number(i.count) || 0), 0);
            await updateDoc(doc(db, "personnel", empId), { incidents: updatedIncidents, totalOccurrences: newTotal });
            showToast("Incident Deleted", 'success'); if (selectedEmp && selectedEmp.id === empId) setSelectedEmp({ ...selectedEmp, incidents: updatedIncidents, totalOccurrences: newTotal });
        } catch (err) { showToast("Delete Failed", 'error'); }
    };
    const handleExportWord = () => { /* Logic hidden for brevity - same as previous version */ };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex justify-between items-end mb-6 flex-wrap gap-2">
                <div><h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Attendance Tracker</h2><p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incident Dashboard & Logs</p></div>
                <div className="flex gap-2 flex-wrap">
                    <div className={`border rounded-lg p-1 flex ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <button onClick={()=>setViewMode('dashboard')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${viewMode==='dashboard'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Dashboard</button>
                        <button onClick={()=>setViewMode('log')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${viewMode==='log'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Master Log</button>
                    </div>
                    <button onClick={() => setShowIncidentModal(true)} className="px-6 py-2 bg-[#ef7c00] text-white rounded-lg font-black uppercase text-[10px] shadow-lg hover:bg-orange-600 transition-all">+ Log Incident</button>
                </div>
            </div>

            {viewMode === 'dashboard' && (
                <div className="space-y-6 overflow-y-auto pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}><p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-50">Total Occurrences</p><p className="text-4xl font-black text-[#ef7c00]">{stats.totalOccurrences}</p></div>
                        <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}><p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-50">Employees Tracked</p><p className="text-4xl font-black">{personnel.length}</p></div>
                        <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}><p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">Incidents by Type</p><div className="space-y-1">{Object.entries(stats.typeCounts).slice(0,3).map(([k,v]) => (<div key={k} className="flex justify-between text-xs font-bold opacity-80"><span>{k}</span><span>{v}</span></div>))}</div></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[400px] ${bgClass}`}>
                            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><h3 className="text-xs font-black uppercase tracking-widest text-[#ef7c00]">Employee Roster</h3><input type="text" placeholder="Search Name..." className={`text-xs p-1 border rounded w-32 font-bold ${inputClass}`} value={rosterSearch} onChange={e=>setRosterSearch(e.target.value)} /></div>
                            <div className="overflow-y-auto flex-grow"><table className="w-full text-left text-xs"><thead className={`font-black uppercase border-b sticky top-0 ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}><tr><th className="p-3">Employee Name</th><th className="p-3 text-right">Count</th></tr></thead><tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>{filteredRoster.map(emp => (<tr key={emp.id} onClick={() => setSelectedEmp(emp)} className={`cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}><td className="p-3 font-bold">{emp.name}</td><td className={`p-3 text-right font-black ${emp.totalOccurrences > 5 ? 'text-red-500' : ''}`}>{emp.totalOccurrences}</td></tr>))}</tbody></table></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PartsInventory = ({ showToast, darkMode }: { showToast: (msg: string, type: 'success'|'error') => void, darkMode: boolean }) => {
    const [searchTerm, setSearchTerm] = useState(''); const [displayLimit, setDisplayLimit] = useState(100); const [isLargeText, setIsLargeText] = useState(false);
    const filteredParts = useMemo(() => { let r = localParts; if (searchTerm) r = r.filter((p: any) => (p.partNumber && String(p.partNumber).toLowerCase().includes(searchTerm.toLowerCase())) || (p.name && String(p.name).toLowerCase().includes(searchTerm.toLowerCase()))); return r.slice(0, displayLimit); }, [searchTerm, displayLimit]);
    const inputClass = darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-gray-400';
    
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative">
            <div className="flex justify-between items-end mb-6 px-2 flex-wrap gap-4">
                <div><h2 className={`text-3xl font-black italic uppercase tracking-tighter leading-none ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Parts Registry</h2><p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Local Reference</p></div>
                <div className="flex items-center gap-3 w-full max-w-lg"><button onClick={() => setIsLargeText(!isLargeText)} className={`h-12 w-12 flex items-center justify-center rounded-2xl border-2 font-black transition-all ${isLargeText ? 'bg-[#002d72] border-[#002d72] text-white' : inputClass}`}>Aa</button><input type="text" placeholder="Search Part # or Description..." className={`w-full p-4 rounded-2xl font-bold border-2 outline-none focus:border-[#ef7c00] transition-all shadow-sm ${inputClass}`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            </div>
            <div className={`rounded-3xl shadow-xl border flex-grow overflow-hidden flex flex-col relative ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="bg-[#002d72] grid grid-cols-12 gap-4 p-5 text-[10px] font-black uppercase text-white tracking-widest select-none"><div className="col-span-3">Part Number</div><div className="col-span-8">Description</div><div className="col-span-1 text-center">View</div></div>
                <div className="overflow-y-auto flex-grow custom-scrollbar"><div className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>{filteredParts.map((p: any, i: number) => (<div key={i} className={`grid grid-cols-12 gap-4 p-4 transition-all items-center ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}><div onClick={() => { navigator.clipboard.writeText(p.partNumber); showToast(`Copied!`, 'success'); }} className={`col-span-3 font-mono font-black rounded-lg cursor-pointer transition-all shadow-sm ${darkMode ? 'bg-slate-900 text-[#ef7c00]' : 'bg-blue-50 text-[#002d72]'} ${isLargeText ? 'text-xl px-4 py-2' : 'text-sm px-3 py-1'}`}>{p.partNumber}</div><div className={`col-span-8 font-bold uppercase flex items-center ${darkMode ? 'text-slate-200' : 'text-slate-700'} ${isLargeText ? 'text-lg leading-normal' : 'text-[11px] leading-tight'}`}>{p.name}</div><div className="col-span-1 flex justify-center"><a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} target="_blank" rel="noopener noreferrer" className={`text-[#ef7c00] hover:scale-125 transition-transform ${isLargeText ? 'text-2xl' : 'text-lg'}`}>👁️</a></div></div>))}</div></div>
            </div>
        </div>
    );
};

// --- MODULE 3: FLEET ANALYTICS ---
const StatusCharts = ({ buses }: { buses: any[] }) => {
    const statusCounts: {[key: string]: number} = { 'Active': 0, 'In Shop': 0, 'Engine': 0, 'Body Shop': 0, 'Vendor': 0, 'Brakes': 0, 'Safety': 0 };
    buses.forEach(b => { if (statusCounts[b.status] !== undefined) statusCounts[b.status]++; else statusCounts['Active']++; });
    const maxCount = Math.max(...Object.values(statusCounts), 1);
    const trendData = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const ds = d.toISOString().split('T')[0]; return { label: ds.slice(5), count: buses.filter(b => b.oosStartDate === ds).length }; });
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">Status Breakdown</h3><div className="flex items-end gap-3 h-40">{Object.entries(statusCounts).map(([s, c]) => (<div key={s} className="flex-1 flex flex-col justify-end items-center group relative"><div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{c}</div><div className={`w-full rounded-t-md transition-all duration-500 ${s==='Active'?'bg-green-500':s==='In Shop'?'bg-[#ef7c00]':'bg-red-500'}`} style={{ height: `${(c/maxCount)*100 || 2}%` }}></div><p className="text-[8px] font-black text-slate-400 uppercase mt-2 -rotate-45 origin-left translate-y-2 whitespace-nowrap">{s}</p></div>))}</div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">7-Day Intake Trend</h3><div className="flex items-end gap-2 h-40">{trendData.map((d, i) => (<div key={i} className="flex-1 flex flex-col justify-end items-center group relative"><div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</div><div className="w-full bg-blue-100 hover:bg-[#002d72] rounded-t-sm transition-all" style={{ height: `${(d.count/Math.max(...trendData.map(t=>t.count),1))*100 || 2}%` }}></div><p className="text-[8px] font-bold text-slate-400 mt-2">{d.label}</p></div>))}</div></div>
        </div>
    );
};

const AnalyticsDashboard = ({ buses, showToast }: { buses: any[], showToast: (msg: string, type: 'success'|'error') => void }) => {
    const [shopQueens, setShopQueens] = useState<{number: string, count: number}[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    useEffect(() => { const fetchRankings = async () => { const rankings: {number: string, count: number}[] = []; const sampleBuses = buses.slice(0, 50); for (const bus of sampleBuses) { const hSnap = await getDocs(query(collection(db, "buses", bus.number, "history"), limit(20))); if (hSnap.size > 0) rankings.push({ number: bus.number, count: hSnap.size }); } setShopQueens(rankings.sort((a,b) => b.count - a.count).slice(0, 5)); }; if(buses.length > 0) fetchRankings(); }, [buses]);
    const handleResetMetrics = async () => { if(!confirm("⚠️ WARNING: This will WIPE ALL HISTORY logs.")) return; setIsResetting(true); try { for (const bus of buses) { const hSnap = await getDocs(collection(db, "buses", bus.number, "history")); if (!hSnap.empty) { const batch = writeBatch(db); hSnap.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); } } showToast(`Reset Complete`, 'success'); setShopQueens([]); } catch (err) { showToast("Reset failed", 'error'); } setIsResetting(false); };
    const avgOOS = buses.reduce((acc, b) => acc + (b.status !== 'Active' ? 1 : 0), 0);
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Availability</p><p className="text-4xl font-black text-[#002d72] italic">{Math.round(((buses.length - avgOOS) / Math.max(buses.length, 1)) * 100)}%</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Down Units</p><p className="text-4xl font-black text-red-500 italic">{avgOOS}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex justify-between items-center mb-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Admin</p><button onClick={handleResetMetrics} disabled={isResetting} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase border border-red-200 rounded px-2 py-1 bg-red-50 disabled:opacity-50">{isResetting ? "..." : "Reset All Logs"}</button></div><div className="space-y-2">{shopQueens.map((queen, i) => (<div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1"><span className="font-bold text-slate-700">#{queen.number}</span><span className="font-mono text-red-500">{queen.count} logs</span></div>))}</div></div>
        </div>
    );
};

// --- COMPONENT: SHIFT HANDOVER ---
const ShiftHandover = ({ buses, showToast }: { buses: any[], showToast: (m:string, t:'success'|'error')=>void }) => {
    const [report, setReport] = useState<any[]>([]);
    useEffect(() => { const fetchRecent = async () => { const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000); let logs: any[] = []; for (const b of buses.filter(x => x.status !== 'Active' || x.notes).slice(0,30)) { const hSnap = await getDocs(query(collection(db, "buses", b.number, "history"), orderBy("timestamp", "desc"), limit(2))); hSnap.forEach(d => { if((d.data().timestamp?.toMillis() || 0) > twelveHoursAgo) logs.push({ bus: b.number, ...d.data() }); }); } setReport(logs.sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))); }; if(buses.length > 0) fetchRecent(); }, [buses]);
    const copy = () => { const txt = report.map(r => `[Unit ${r.bus}] ${r.action}: ${r.details}`).join('\n'); navigator.clipboard.writeText(`SHIFT REPORT - ${new Date().toLocaleDateString()}\n\n${txt}`); showToast("Report copied!", 'success'); };
    return (
        <div className="max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4"><div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-[#002d72] uppercase italic">Shift Handover</h2><button onClick={copy} className="px-6 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-[#ef7c00] transition-all transform active:scale-95">Copy Report</button></div><div className="space-y-4">{report.map((l, i) => (<div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex gap-6 items-center"><div className="w-16 h-16 bg-[#002d72]/5 rounded-xl flex items-center justify-center font-black text-[#002d72] text-lg">#{l.bus}</div><div className="flex-grow"><div className="flex justify-between mb-1"><span className="text-[10px] font-black text-[#ef7c00] uppercase">{l.action}</span><span className="text-[10px] font-bold text-slate-500">{formatTime(l.timestamp)}</span></div><p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{l.details}</p><p className="text-[9px] text-slate-400 mt-2 uppercase tracking-widest">{l.user}</p></div></div>))}</div></div>
    );
};

const BusInputForm = ({ showToast, darkMode }: { showToast: (m:string, t:'success'|'error')=>void, darkMode: boolean }) => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); const busRef = doc(db, "buses", formData.number); const busSnap = await getDoc(busRef);
        if (!busSnap.exists()) return showToast(`⛔ Access Denied`, 'error');
        const old = busSnap.data(); let changes = []; if (old.status !== formData.status) changes.push(`STATUS: ${old.status} ➝ ${formData.status}`); if (old.notes !== formData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${formData.notes}"`); if (old.oosStartDate !== formData.oosStartDate) changes.push(`OOS: ${old.oosStartDate || '—'} ➝ ${formData.oosStartDate}`);
        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        if (changes.length > 0) await logHistory(formData.number, "UPDATE", changes.join('\n'), auth.currentUser?.email || 'Unknown'); else await logHistory(formData.number, "UPDATE", "Routine Update via Terminal", auth.currentUser?.email || 'Unknown');
        showToast(`Bus #${formData.number} Updated`, 'success'); setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    };
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-gray-400';
    return (
        <div className={`max-w-2xl mx-auto mt-4 md:mt-10 p-6 md:p-8 rounded-2xl shadow-xl border-t-8 border-[#ef7c00] animate-in slide-in-from-bottom-4 duration-500 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <h2 className={`text-3xl font-black italic uppercase mb-8 text-center tracking-tighter ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Data Entry Terminal</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <input type="text" placeholder="Unit #" className={`p-4 border-2 rounded-xl font-black outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.number} onChange={handleChange} name="number" required />
                    <select className={`p-4 border-2 rounded-xl font-bold outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.status} onChange={handleChange} name="status"><option value="Active">Ready for Service</option><option value="On Hold">Maintenance Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option></select>
                </div>
                <input type="text" placeholder="Location" className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.location} onChange={handleChange} name="location" />
                <textarea placeholder="Maintenance Notes" className={`w-full p-4 border-2 rounded-xl h-24 outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.notes} onChange={handleChange} name="notes" />
                <div className="grid grid-cols-3 gap-4">
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>OOS Date</label><input name="oosStartDate" type="date" className={`w-full p-2 border-2 rounded-lg text-xs font-bold ${inputClass}`} value={formData.oosStartDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exp Return</label><input name="expectedReturnDate" type="date" className={`w-full p-2 border-2 rounded-lg text-xs font-bold ${inputClass}`} value={formData.expectedReturnDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Act Return</label><input name="actualReturnDate" type="date" className={`w-full p-2 border-2 rounded-lg text-xs font-bold ${inputClass}`} value={formData.actualReturnDate} onChange={handleChange} /></div>
                </div>
                <button className="w-full py-4 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest transition-all transform active:scale-95 shadow-lg">Update Record</button>
            </form>
        </div>
    );
};

// --- MAIN APPLICATION ENTRY ---
export default function FleetManager() {
  const [user, setUser] = useState<any>(null);
  
  const [view, setView] = useState<'inventory' | 'tracker' | 'input' | 'analytics' | 'handover' | 'personnel' | 'parts'>('inventory');
  const [inventoryMode, setInventoryMode] = useState<'list' | 'grid' | 'tv'>('grid');
  const [buses, setBuses] = useState<any[]>([]);
  const [selectedBusDetail, setSelectedBusDetail] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'number', direction: 'asc' });
  const [activeFilter, setActiveFilter] = useState('Total Fleet');
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  
  // DARK MODE & FULLSCREEN
  const [darkMode, setDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tvBoardRef = useRef<HTMLDivElement>(null);

  const holdStatuses = ['On Hold', 'Engine', 'Body Shop', 'Vendor', 'Brakes', 'Safety'];
  
  const isAdmin = user && (user.email === 'anetowestfield@gmail.com' || user.email === 'supervisor@fleet.com' || user.email === 'admin@admin.com');
  const triggerToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); };

  useEffect(() => { onAuthStateChanged(auth, u => setUser(u)); }, []);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "buses"), orderBy("number", "asc")), s => setBuses(s.docs.map(d => ({...d.data(), docId: d.id})))); }, [user]);

  // Fullscreen Listener
  useEffect(() => {
      const handleFsChange = () => { setIsFullscreen(!!document.fullscreenElement); };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullScreen = () => {
      if (!document.fullscreenElement && tvBoardRef.current) {
          tvBoardRef.current.requestFullscreen().catch(err => console.log(err));
      } else if (document.fullscreenElement) {
          document.exitFullscreen();
      }
  };

  // Auto-scroll TV Board Marquee (FASTER SPEED)
  useEffect(() => {
      let animationFrameId: number;
      let isPaused = false;
      let scrollPos = 0;
      
      const scroll = () => {
          if (inventoryMode === 'tv' && isFullscreen && tvBoardRef.current && !isPaused) {
              const el = tvBoardRef.current;
              if (el.scrollHeight > el.clientHeight) {
                  // Reached the bottom
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
                      isPaused = true;
                      setTimeout(() => { 
                          if(tvBoardRef.current) {
                              tvBoardRef.current.scrollTop = 0; 
                              scrollPos = 0;
                          }
                          setTimeout(() => { isPaused = false; }, 2000); 
                      }, 4000); 
                  } else {
                      // FASTER SCROLL SPEED
                      scrollPos += 1.2; 
                      el.scrollTop = scrollPos;
                      // Detect manual scroll
                      if (Math.abs(el.scrollTop - Math.round(scrollPos)) > 2) {
                          scrollPos = el.scrollTop;
                      }
                  }
              }
          }
          animationFrameId = requestAnimationFrame(scroll);
      };

      if (inventoryMode === 'tv' && isFullscreen) {
          setTimeout(() => {
              if (tvBoardRef.current) {
                  tvBoardRef.current.scrollTop = 0;
                  scrollPos = 0;
                  animationFrameId = requestAnimationFrame(scroll);
              }
          }, 1000); 
      }

      return () => {
          if(animationFrameId) cancelAnimationFrame(animationFrameId);
      };
  }, [inventoryMode, isFullscreen]);

  const sortedBuses = [...buses].filter(b => {
    const matchesSearch = b.number.includes(searchTerm);
    if (!matchesSearch) return false;
    if (activeFilter === 'Total Fleet') return true;
    if (activeFilter === 'Ready') return b.status === 'Active' || b.status === 'In Shop';
    if (activeFilter === 'On Hold') return holdStatuses.includes(b.status);
    if (activeFilter === 'In Shop') return b.status === 'In Shop';
    return true;
  }).sort((a, b) => {
    let aV = a[sortConfig.key] || ''; let bV = b[sortConfig.key] || '';
    if (sortConfig.key === 'daysOOS') { aV = calculateDaysOOS(a.oosStartDate); bV = calculateDaysOOS(b.oosStartDate); }
    if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: string) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('OOS Detail');
    ws.columns = [{header:'Bus #',key:'number',width:10},{header:'Status',key:'status',width:15},{header:'Location',key:'location',width:15},{header:'Fault',key:'notes',width:30},{header:'OOS Start',key:'start',width:15}];
    buses.forEach(b => ws.addRow({number:b.number, status:b.status, location:b.location||'', notes:b.notes||'', start:b.oosStartDate||''}));
    const buf = await wb.xlsx.writeBuffer(); saveAs(new Blob([buf]), `Fleet_Status_Report.xlsx`);
    triggerToast("Excel Downloaded", 'success');
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      <form onSubmit={async e => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); } catch(e){} }} className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-[#ef7c00] relative z-10 animate-in fade-in zoom-in">
        <h2 className="text-4xl font-black text-white italic mb-8 text-center leading-none uppercase">FLEET OPS</h2>
        <div className="space-y-4">
          <input className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-xl font-bold text-white placeholder:text-gray-500" placeholder="supervisor@fleet.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-xl font-bold text-white placeholder:text-gray-500" placeholder="password123" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button className="w-full bg-[#ef7c00] text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all transform active:scale-95 shadow-xl">Authorized Login</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className={`min-h-screen font-sans selection:bg-[#ef7c00] selection:text-white transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {selectedBusDetail && (<div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={triggerToast} darkMode={darkMode} /></div>)}

      {/* TOP NAV BAR */}
      <nav className={`backdrop-blur-md border-b sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm overflow-x-auto ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="flex items-center gap-2 flex-shrink-0"><div className="w-2 h-6 bg-[#ef7c00] rounded-full"></div><span className={`font-black text-lg italic uppercase tracking-tighter ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Fleet Manager</span></div>
        <div className="flex gap-4 items-center flex-nowrap">
          {['inventory', 'input', 'tracker', 'handover', 'parts'].concat(isAdmin ? ['analytics', 'personnel'] : []).map(v => (
            <button key={v} onClick={() => setView(v as any)} className={`text-[9px] font-black uppercase tracking-widest border-b-2 pb-1 transition-all whitespace-nowrap ${view === v ? 'border-[#ef7c00] text-[#ef7c00]' : (darkMode ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-[#002d72]')}`}>{v.replace('input', 'Data Entry').replace('parts', 'Parts List').replace('personnel', 'Personnel')}</button>
          ))}
          <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${darkMode ? 'bg-slate-800 text-yellow-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
          <button onClick={exportExcel} className={`text-[10px] font-black uppercase whitespace-nowrap ${darkMode ? 'text-green-400 hover:text-green-300' : 'text-[#002d72] hover:text-[#ef7c00]'}`}>Excel</button>
          <button onClick={() => signOut(auth)} className="text-red-500 text-[10px] font-black uppercase whitespace-nowrap">Logout</button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6 overflow-x-hidden">
        {view === 'tracker' ? <div className={`h-[85vh] rounded-2xl shadow-sm border overflow-hidden relative ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><BusTracker /></div> :
         view === 'input' ? <BusInputForm showToast={triggerToast} darkMode={darkMode} /> :
         view === 'parts' ? <PartsInventory showToast={triggerToast} darkMode={darkMode} /> :
         view === 'analytics' ? (isAdmin ? <div className="animate-in fade-in duration-500"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={triggerToast} /></div> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) :
         view === 'handover' ? <ShiftHandover buses={buses} showToast={triggerToast} /> :
         view === 'personnel' ? (isAdmin ? <PersonnelManager showToast={triggerToast} darkMode={darkMode} /> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) : (
          <>
            {/* STAT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[{label:'Total Fleet',val:buses.length,c: darkMode?'text-white':'text-slate-900'},{label:'Ready',val:buses.filter(b=>b.status==='Active'||b.status==='In Shop').length,c:'text-green-500'},{label:'On Hold',val:buses.filter(b=>holdStatuses.includes(b.status)).length,c:'text-red-500'},{label:'In Shop',val:buses.filter(b=>b.status==='In Shop').length,c:'text-[#ef7c00]'}].map(m=>(
                    <div key={m.label} onClick={()=>setActiveFilter(m.label)} className={`p-5 rounded-2xl shadow-sm border flex flex-col items-center cursor-pointer transition-all hover:-translate-y-1 ${activeFilter===m.label ? (darkMode ? 'border-[#ef7c00] bg-slate-800' : 'border-[#002d72] bg-blue-50') : (darkMode ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800' : 'border-slate-200 bg-white')}`}>
                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{m.label}</p>
                        <p className={`text-3xl font-black ${m.c}`}>{m.val}</p>
                    </div>
                ))}
            </div>
            
            {/* SEARCH & VIEW TOGGLES */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
                <input type="text" placeholder="Search Unit #..." className={`w-full max-w-md pl-4 pr-10 py-3 border-2 rounded-lg text-sm font-bold outline-none shadow-sm transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#ef7c00]' : 'bg-white border-slate-200 text-black placeholder:text-gray-400 focus:border-[#002d72]'}`} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className={`border rounded-lg p-1 flex w-full md:w-auto ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <button onClick={()=>setInventoryMode('list')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${inventoryMode==='list'?'bg-[#ef7c00] text-white shadow-md':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>List</button>
                    <button onClick={()=>setInventoryMode('grid')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${inventoryMode==='grid'?'bg-[#ef7c00] text-white shadow-md':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Grid</button>
                    <button onClick={()=>setInventoryMode('tv')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all flex items-center justify-center gap-1 ${inventoryMode==='tv'?'bg-red-600 text-white shadow-md':'text-red-500 hover:bg-red-600/10'}`}>⛶ TV Board</button>
                </div>
            </div>

            {/* MAIN INVENTORY CONTAINER */}
            <div className={`rounded-2xl shadow-sm border overflow-hidden min-h-[500px] ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                
                {/* 1. LIST VIEW */}
                {inventoryMode === 'list' && (
                    <div className="overflow-x-auto">
                        <div className={`grid grid-cols-10 gap-4 p-5 border-b text-[9px] font-black uppercase tracking-widest min-w-[800px] ${darkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            <div onClick={()=>requestSort('number')} className={`cursor-pointer ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>Unit #</div><div>Series</div><div>Status</div><div>Location</div><div className="col-span-2">Fault Preview</div><div>Exp Return</div><div>Act Return</div><div>Days OOS</div>
                        </div>
                        <div className={`divide-y min-w-[800px] ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {sortedBuses.map(b => (
                                <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`grid grid-cols-10 gap-4 p-5 items-center cursor-pointer transition-all border-l-4 ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} ${b.status==='Active'?'border-green-500':'border-red-500'}`}>
                                    <div className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>#{b.number}</div>
                                    <div className={`text-[9px] font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{getBusSpecs(b.number).length}</div>
                                    <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-full w-fit ${b.status==='Active'?'bg-green-500 text-white':'bg-red-500 text-white'}`}>{b.status}</div>
                                    <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{b.location || 'Location Unavailable'}</div>
                                    <div className={`col-span-2 text-xs font-medium truncate italic ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{b.notes||'No faults.'}</div>
                                    <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{b.expectedReturnDate||'—'}</div>
                                    <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{b.actualReturnDate||'—'}</div>
                                    <div className="text-xs font-black text-red-500">{b.status!=='Active' ? `${calculateDaysOOS(b.oosStartDate)} days` : '—'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. STANDARD GRID VIEW */}
                {inventoryMode === 'grid' && (
                    <div className={`p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${darkMode ? 'bg-slate-900' : 'bg-slate-50/50'}`}>
                        {sortedBuses.map(b => (
                            <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`p-4 rounded-2xl border-2 flex flex-col cursor-pointer hover:-translate-y-1 transition-all shadow-sm ${darkMode ? 'bg-slate-800' : 'bg-white'} ${b.status==='Active' ? (darkMode ? 'border-green-600/50 hover:border-green-400' : 'border-green-200 hover:border-green-500') : (darkMode ? 'border-red-600/50 hover:border-red-400' : 'border-red-200 hover:border-red-500')}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>#{b.number}</span>
                                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${b.status==='Active'?'bg-green-500 text-white':'bg-red-500 text-white'}`}>{b.status}</span>
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-bold mb-2 truncate ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>📍 {b.location || 'Location Unavailable'}</div>
                                <div className={`text-[10px] italic line-clamp-2 mb-3 h-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🔧 {b.notes || 'No active faults recorded.'}</div>
                                {b.status !== 'Active' && <div className="mt-auto text-[10px] font-black text-white bg-red-600 p-1.5 rounded-lg text-center border border-red-700 shadow-inner tracking-widest">⏱️ DOWN {calculateDaysOOS(b.oosStartDate)} DAYS</div>}
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. WIDER TV BOARD WITH FULL NOTES (SCROLLING MARQUEE) */}
                {inventoryMode === 'tv' && (
                    <div ref={tvBoardRef} className={`p-4 sm:p-6 overflow-y-auto custom-scrollbar ${isFullscreen ? (darkMode ? 'bg-slate-900' : 'bg-slate-100') : ''} ${!isFullscreen && darkMode ? 'bg-slate-900' : (!isFullscreen ? 'bg-slate-100' : '')} min-h-[75vh] h-full`}>
                        
                        {/* Fullscreen Header */}
                        {isFullscreen && (
                            <div className={`flex justify-between items-end mb-6 border-b-2 pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                                <div>
                                    <h2 className="text-5xl font-black uppercase tracking-tighter text-[#ef7c00]">Fleet Status Board</h2>
                                    <p className={`text-xl font-bold mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Units: {buses.length} | Down: <span className="text-red-500">{buses.filter(b=>b.status!=='Active').length}</span></p>
                                </div>
                                <button onClick={toggleFullScreen} className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-2xl transition-all transform active:scale-95">Exit Fullscreen</button>
                            </div>
                        )}

                        {/* Launch Button (Visible only when NOT fullscreen) */}
                        {!isFullscreen && (
                            <div className="mb-6 flex justify-end">
                                <button onClick={toggleFullScreen} className="px-6 py-3 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl font-black uppercase text-xs shadow-lg flex items-center gap-2 transition-all transform active:scale-95">
                                    ⛶ Launch Fullscreen TV Mode
                                </button>
                            </div>
                        )}

                        {/* TV Grid - Wider Cards, Full Notes */}
                        <div className={`grid gap-4 sm:gap-6 pb-20 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                            {sortedBuses.map(b => (
                                <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`p-4 rounded-xl flex flex-col justify-between border-[3px] shadow-md cursor-pointer hover:scale-105 transition-transform ${
                                    b.status === 'Active' 
                                    ? (darkMode ? 'bg-slate-800 border-green-500' : 'bg-white border-green-500') 
                                    : (darkMode ? 'bg-slate-800 border-red-600' : 'bg-white border-red-600')
                                }`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-4xl font-black leading-none tracking-tighter ${b.status==='Active' ? (darkMode?'text-green-400':'text-green-600') : (darkMode?'text-red-500':'text-red-600')}`}>#{b.number}</span>
                                        <span className={`w-fit px-2 py-1 rounded text-xs font-black uppercase tracking-wider shadow-sm ${b.status==='Active'?'bg-green-500 text-white':'bg-red-600 text-white'}`}>{b.status}</span>
                                    </div>
                                    
                                    <div className={`text-sm font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>📍 {b.location || 'Location Unavailable'}</div>
                                    
                                    {/* FULL NOTES: Removed line-clamp and fixed height */}
                                    <div className={`text-xs font-bold leading-snug mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{b.notes || 'No active faults recorded.'}</div>
                                    
                                    <div className="mt-auto pt-2">
                                        {b.status !== 'Active' && <div className="text-xs font-black text-white bg-red-600 rounded px-2 py-1.5 text-center tracking-widest shadow-inner">DOWN {calculateDaysOOS(b.oosStartDate)} DAYS</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}