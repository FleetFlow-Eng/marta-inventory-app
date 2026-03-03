"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, addDoc, deleteDoc, getDoc, getDocs, limit, where, writeBatch, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';
import localParts from './partsData.json';

const HAMILTON_FLEET = ["1625","1628","1629","1631","1632","1633","1634","1635","1636","1637","1638","1639","1640","1641","1642","1643","1644","1645","1646","1647","1648","1660","1802","1803","1804","1805","1806","1807","1808","1809","1810","1811","1812","1813","1815","1817","1818","1819","1820","1821","1822","1823","1824","1826","1827","1828","1829","1830","1831","1832","1833","1834","1835","1836","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1850","1851","1852","1853","1854","1855","1856","1858","1859","1860","1861","1862","1863","1864","1865","1867","1868","1870","1871","1872","1873","1874","1875","1876","1877","1878","1879","1880","1881","1883","1884","1885","1887","1888","1889","1895","1909","1912","1913","1921","1922","1923","1924","1925","1926","1927","1928","1929","1930","1931","1932","1933","1935","1951","1958","1959","7021","7022","7023","7024","7025","7026","7027","7028","7029","7030","7031","7033","7092","7093","7094","7095","7096","7097","7098","7099","7102","7103","7104","7105","1406","1408","1434","1440","2326","2343","2593"];
const ADMIN_EMAILS = ['anetowestfield@gmail.com', 'admin@fleetflow.services'];

const BusTracker = dynamic(() => import('./BusTracker'), { ssr: false, loading: () => <div className="flex items-center justify-center h-[50vh] bg-slate-100 rounded-2xl"><div className="w-12 h-12 border-4 border-[#002d72] border-t-transparent rounded-full animate-spin"></div></div> });

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-[9999] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 border-l-8 ${type === 'success' ? 'bg-white border-green-500 text-slate-800' : 'bg-white border-red-500 text-slate-800'}`}>
            <span className="text-2xl">{type === 'success' ? '✅' : '📋'}</span>
            <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{type === 'success' ? 'Success' : 'Notice'}</p><p className="text-sm font-bold text-slate-800">{message}</p></div>
        </div>
    );
};

const LegalModal = ({ type, onClose, darkMode }: { type: 'privacy'|'about', onClose: ()=>void, darkMode: boolean }) => (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className={`p-8 rounded-2xl w-full max-w-lg shadow-2xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-500/20">
                <h3 className={`text-2xl font-black uppercase italic ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{type === 'privacy' ? 'Privacy Policy' : 'About Us'}</h3>
                <button onClick={onClose} className="text-2xl font-bold hover:text-red-500">✕</button>
            </div>
            <p className="font-medium leading-relaxed text-sm opacity-90">{type === 'privacy' ? "LLC Fleetflow Transit Solutions values your privacy. We collect minimal data necessary for internal fleet management, diagnostic tracking, and attendance coordination. We do not sell or share your data with unauthorized third parties. All data is securely handled via industry-standard encrypted databases." : "LLC Fleetflow Transit Solutions is dedicated to modernizing fleet operations. Our management systems provide real-time tracking, inventory analytics, and seamless personnel coordination to keep your transit systems moving safely and efficiently. Built for reliability and high visibility on the shop floor."}</p>
            <button onClick={onClose} className="mt-8 w-full py-3 bg-[#002d72] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#ef7c00] shadow-lg">Acknowledge & Close</button>
        </div>
    </div>
);

const Footer = ({ onShowLegal, darkMode }: { onShowLegal: (type: 'privacy'|'about')=>void, darkMode?: boolean }) => (
    <div className={`w-full py-6 text-center text-[10px] font-bold tracking-widest uppercase mt-auto border-t ${darkMode ? 'border-slate-800 text-slate-500 bg-slate-900' : 'border-slate-200 text-slate-400 bg-slate-100'}`}>
        <p>© {new Date().getFullYear()} LLC Fleetflow Transit Solutions.</p>
        <div className="flex justify-center gap-6 mt-3">
            <button onClick={() => onShowLegal('privacy')} className={`transition-colors ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>Privacy Policy</button>
            <button onClick={() => onShowLegal('about')} className={`transition-colors ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>About Us</button>
        </div>
    </div>
);

const logActivity = async (userEmail: string, category: string, target: string, action: string, details: string) => {
    if (!userEmail) return;
    try { await addDoc(collection(db, "activity_logs"), { user: userEmail, category, target, action, details, timestamp: serverTimestamp() }); } catch(e) { console.error(e); }
};

const logHistory = async (busNumber: string, action: string, details: string, userEmail: string) => {
    if (!busNumber) return;
    try { 
        await addDoc(collection(db, "buses", busNumber, "history"), { action, details, user: userEmail, timestamp: serverTimestamp() }); 
        await logActivity(userEmail, 'BUS', `Bus #${busNumber}`, action, details);
    } catch (err) { console.error(err); }
};

const formatTime = (ts: any) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString() : 'Just now';
const getBusSpecs = (num: string) => parseInt(num) > 1950 && parseInt(num) < 1960 ? { length: "30'" } : parseInt(num) < 1936 ? { length: "35'" } : { length: "40'" };
const calculateDaysOOS = (start: string) => start ? Math.max(0, Math.ceil((new Date().getTime() - new Date(start).getTime()) / (1000 * 3600 * 24))) : 0;

const BusDetailView = ({ bus, onClose, showToast, darkMode, isAdmin, statusOptions }: { bus: any; onClose: () => void; showToast: any, darkMode: boolean, isAdmin: boolean, statusOptions: any[] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
    const [editData, setEditData] = useState({ status: bus.status || 'Active', location: bus.location || '', notes: bus.notes || '', oosStartDate: bus.oosStartDate || '', expectedReturnDate: bus.expectedReturnDate || '', actualReturnDate: bus.actualReturnDate || '' });
    
    useEffect(() => { if (showHistory) return onSnapshot(query(collection(db, "buses", bus.number, "history"), orderBy("timestamp", "desc")), (snap) => setHistoryLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [showHistory, bus.number]);
    
    const handleSave = async () => {
        const today = new Date(); today.setHours(23, 59, 59, 999);
        if (editData.oosStartDate) {
            const oos = new Date(editData.oosStartDate);
            if (oos > today) return showToast("Out of Service date cannot be a future date", 'error');
            if (editData.expectedReturnDate && new Date(editData.expectedReturnDate) < oos) return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            if (editData.actualReturnDate && new Date(editData.actualReturnDate) < oos) return showToast("Actual Return cannot be earlier than OOS Date", 'error');
        }
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
    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';
    const type = statusOptions.find(o=>o.label===bus.status)?.type || (bus.status==='Active'?'ready':(bus.status==='In Shop'?'shop':'hold'));
    const statusColorText = type==='ready' ? 'text-green-500' : type==='shop' ? 'text-orange-500' : 'text-red-500';
    const statusColorBadge = type==='ready' ? 'bg-green-500' : type==='shop' ? 'bg-orange-500' : 'bg-red-500';

    if (showHistory) return (<div className={`p-6 rounded-xl shadow-2xl w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95 border ${bgClass}`}><div className={`flex justify-between items-center mb-4 border-b pb-4 font-black uppercase ${statusColorText}`}><span>History: #{bus.number}</span><button onClick={()=>setShowHistory(false)} className="text-xs">Back</button></div><div className="flex-grow overflow-y-auto space-y-3">{historyLogs.map(l => (<div key={l.id} className={`p-3 rounded-lg border relative group ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}><div className={`flex justify-between text-[8px] font-black uppercase mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><span>{l.action}</span><span>{formatTime(l.timestamp)}</span></div><p className="text-xs font-bold whitespace-pre-wrap leading-tight">{l.details}</p>{isAdmin && <button onClick={() => handleDeleteLog(l.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">DELETE</button>}</div>))}</div></div>);
    if (isEditing) return (<div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}><h3 className={`text-2xl font-black mb-6 uppercase italic ${statusColorText}`}>Edit Bus #{bus.number}</h3><div className="grid grid-cols-2 gap-4 mb-4"><select className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.status} onChange={e=>setEditData({...editData, status:e.target.value})}><option value="Active">Active</option>{statusOptions.map((o,i)=><option key={i} value={o.label}>{o.label}</option>)}</select><input className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.location} onChange={e=>setEditData({...editData, location:e.target.value})} placeholder="Location" /></div><textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-4 font-bold ${inputClass}`} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} placeholder="Maintenance Notes" /><div className="grid grid-cols-3 gap-4 mb-6 text-[9px] font-black uppercase"><div>OOS Date<input type="date" onClick={handleDateClick} max={new Date().toISOString().split('T')[0]} className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.oosStartDate} onChange={e=>setEditData({...editData, oosStartDate:e.target.value})} /></div><div>Exp Return<input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.expectedReturnDate} onChange={e=>setEditData({...editData, expectedReturnDate:e.target.value})} /></div><div>Act Return<input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.actualReturnDate} onChange={e=>setEditData({...editData, actualReturnDate:e.target.value})} /></div></div><div className="flex gap-4"><button onClick={()=>setIsEditing(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>Cancel</button><button onClick={handleSave} className="w-1/2 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg">Save</button></div></div>);
    return (
        <div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}>
            <div className="flex justify-between items-start mb-6 border-b border-slate-500/20 pb-4">
                <div><h3 className={`text-4xl font-black italic uppercase ${statusColorText}`}>Bus #{bus.number}</h3><span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white ${statusColorBadge}`}>{bus.status}</span></div>
                <div className="flex gap-2"><button onClick={handleResetBus} className="text-red-500 text-xs font-black uppercase border border-red-500/30 bg-red-500/10 px-3 py-1 rounded">Reset</button><button onClick={onClose} className="text-slate-400 text-2xl font-bold">✕</button></div>
            </div>
            <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}><p className="text-[10px] font-black uppercase mb-2 opacity-50">Fault Details</p><p className="text-lg font-medium">{bus.notes || "No active faults."}</p></div>
            <div className="grid grid-cols-3 gap-4 mb-6"><div><p className="text-[9px] font-black uppercase opacity-50">OOS Date</p><p className="text-xl font-black text-[#002d72]">{bus.oosStartDate || '--'}</p></div><div><p className="text-[9px] font-black uppercase opacity-50">Exp Return</p><p className="text-xl font-black text-[#ef7c00]">{bus.expectedReturnDate || '--'}</p></div><div><p className="text-[9px] font-black uppercase opacity-50">Act Return</p><p className="text-xl font-black text-green-500">{bus.actualReturnDate || '--'}</p></div></div>
            <div className="flex justify-between pt-6 border-t border-slate-500/20"><button onClick={()=>setShowHistory(true)} className={`px-5 py-3 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>📜 History</button><div className="flex gap-3"><button onClick={()=>setIsEditing(true)} className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-slate-700 text-[#ef7c00]' : 'bg-slate-100 text-[#002d72]'}`}>Edit</button><button onClick={onClose} className="px-8 py-3 bg-[#002d72] text-white rounded-lg text-[10px] font-black uppercase">Close</button></div></div>
        </div>
    );
};

const AccessManager = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
    const [usersList, setUsersList] = useState<any[]>([]);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [newStatus, setNewStatus] = useState({ label: '', type: 'hold' });
    const [selectedUserHistory, setSelectedUserHistory] = useState<string | null>(null);
    const [userLogs, setUserLogs] = useState<any[]>([]);

    useEffect(() => {
        const uSub = onSnapshot(collection(db, "users"), s => setUsersList(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const sSub = onSnapshot(doc(db, "settings", "status_options"), s => { if (s.exists()) setStatusOptions(s.data().list || []); });
        return () => { uSub(); sSub(); };
    }, []);

    const handleAddStatus = async () => {
        if (!newStatus.label) return;
        const updated = [...statusOptions, { label: newStatus.label, type: newStatus.type }];
        await setDoc(doc(db, "settings", "status_options"), { list: updated }, { merge: true });
        setNewStatus({ label: '', type: 'hold' }); showToast("Status added", "success");
    };

    const handleRemoveStatus = async (idx: number) => {
        const updated = statusOptions.filter((_, i) => i !== idx);
        await setDoc(doc(db, "settings", "status_options"), { list: updated }, { merge: true });
    };

    const toggleApproval = async (uid: string, current: string) => updateDoc(doc(db, "users", uid), { status: current === 'approved' ? 'pending' : 'approved' });
    const toggleRole = async (uid: string, current: string) => updateDoc(doc(db, "users", uid), { role: current === 'admin' ? 'user' : 'admin' });
    const deleteUser = async (uid: string) => { if (confirm("Delete user permanently?")) await deleteDoc(doc(db, "users", uid)); };
    const fetchUserHistory = async (email: string) => {
        setSelectedUserHistory(email);
        const snap = await getDocs(query(collection(db, "activity_logs"), where("user", "==", email)));
        setUserLogs(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a:any, b:any) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4">
            <div><h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Admin Panel</h2></div>
            <div className={`p-8 rounded-2xl border shadow-xl ${bgClass}`}>
                <h3 className={`text-xl font-black uppercase italic mb-6 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Status Menu Customization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-50 mb-4">Add New Option</p>
                        <div className="flex gap-2">
                            <input className={`flex-grow p-3 rounded-lg border font-bold outline-none ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} placeholder="Label (e.g. Parts Hold)" value={newStatus.label} onChange={e=>setNewStatus({...newStatus, label: e.target.value})} />
                            <select className={`p-3 rounded-lg border font-bold outline-none ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} value={newStatus.type} onChange={e=>setNewStatus({...newStatus, type: e.target.value})}><option value="ready">Ready (Green)</option><option value="shop">In Shop (Orange)</option><option value="hold">Hold/Down (Red)</option></select>
                            <button onClick={handleAddStatus} className="px-6 bg-[#ef7c00] text-white font-black rounded-lg">+</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase opacity-50 mb-4">Active Dropdown List</p>
                        {statusOptions.map((s, i) => (
                            <div key={i} className={`flex justify-between items-center p-3 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${s.type==='ready'?'bg-green-500':s.type==='shop'?'bg-orange-500':'bg-red-500'}`}></div><span className="font-bold">{s.label}</span></div>
                                <button onClick={()=>handleRemoveStatus(i)} className="text-red-500 text-xs font-black">REMOVE</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className={`rounded-2xl border shadow-xl overflow-hidden ${bgClass}`}>
                <table className="w-full text-left text-sm"><thead className={`font-black uppercase text-[10px] tracking-widest border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}><tr><th className="p-4">User (Click for Log)</th><th className="p-4 text-center">Role</th><th className="p-4 text-center">Access</th><th className="p-4 text-center">Actions</th></tr></thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                    {usersList.map(u => {
                        const isMaster = ADMIN_EMAILS.includes(u.email?.toLowerCase());
                        return (
                            <tr key={u.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}><td className="p-4 font-bold cursor-pointer text-[#ef7c00] hover:underline" onClick={()=>fetchUserHistory(u.email)}>{u.email} {isMaster && <span className="text-[8px] bg-purple-500 text-white px-1 py-0.5 rounded ml-2">MASTER</span>}</td><td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${u.role==='admin'||isMaster?'bg-purple-100 text-purple-700':'bg-slate-100 text-slate-500'}`}>{u.role==='admin'||isMaster?'Admin (OP)':'Standard'}</span></td><td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase text-white ${u.status==='approved'||isMaster?'bg-green-500':'bg-orange-500'}`}>{u.status==='approved'||isMaster?'Approved':'Pending'}</span></td><td className="p-4 text-center space-x-2">{!isMaster && (<><button onClick={()=>toggleApproval(u.id, u.status)} className={`px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm ${u.status==='approved'?'bg-orange-100 text-orange-700':'bg-green-500 text-white'}`}>{u.status==='approved'?'Revoke':'Approve'}</button><button onClick={()=>toggleRole(u.id, u.role)} className={`px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm ${u.role==='admin'?'bg-slate-200 text-slate-700':'bg-purple-600 text-white'}`}>{u.role==='admin'?'De-OP':'OP'}</button><button onClick={()=>deleteUser(u.id)} className="px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm bg-red-600 text-white">Delete</button></>)}</td></tr>
                        );
                    })}
                </tbody></table>
            </div>
            {selectedUserHistory && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border ${bgClass}`}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="text-xl font-black uppercase italic">{selectedUserHistory} History</h3><button onClick={()=>setSelectedUserHistory(null)} className="text-2xl font-bold">✕</button></div>
                        <div className="overflow-y-auto custom-scrollbar space-y-3">
                            {userLogs.map(log => (<div key={log.id} className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}><div className="flex justify-between text-[10px] font-black opacity-50 mb-1"><span>{log.category} • {log.target}</span><span>{formatTime(log.timestamp)}</span></div><p className="text-xs font-bold"><span className={`px-1 py-0.5 rounded text-[8px] uppercase mr-2 ${log.action === 'CREATED' ? 'bg-green-500/20 text-green-600' : log.action === 'UPDATE' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>{log.action}</span> {log.details}</p></div>))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PersonnelManager = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'dashboard' | 'log'>('dashboard');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [newEmpName, setNewEmpName] = useState('');
    const [incData, setIncData] = useState({ type: 'Sick', date: '', count: 1, docReceived: false, notes: '' });
    const [rosterSearch, setRosterSearch] = useState('');
    const [logFilter, setLogFilter] = useState({ search: '', type: 'All', sort: 'desc' });

    useEffect(() => { return onSnapshot(query(collection(db, "personnel"), orderBy("name")), (snap) => setPersonnel(snap.docs.map(d => ({ ...d.data(), id: d.id })))); }, []);
    const handleDateClick = (e: any) => e.currentTarget.showPicker?.();

    const allIncidents = useMemo(() => {
        let logs: any[] = []; personnel.forEach(p => { if (p.incidents) p.incidents.forEach((inc: any) => logs.push({ ...inc, employeeName: p.name, employeeId: p.id })); });
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
        return logs.sort((a, b) => logFilter.sort === 'asc' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allIncidents, logFilter]);

    const filteredRoster = useMemo(() => { if (!rosterSearch) return stats.topOffenders; return stats.topOffenders.filter(p => p.name.toLowerCase().includes(rosterSearch.toLowerCase())); }, [stats.topOffenders, rosterSearch]);
    const jumpToLog = (typeFilter: string = 'All') => { setLogFilter(prev => ({ ...prev, type: typeFilter, search: '' })); setViewMode('log'); };

    const handleAddEmployee = async (e: React.FormEvent) => { 
        e.preventDefault(); if(!newEmpName) return; 
        try { await addDoc(collection(db, "personnel"), { name: newEmpName, totalOccurrences: 0, incidents: [], timestamp: serverTimestamp() }); await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', newEmpName, 'CREATED', `Added new employee`); showToast(`Added ${newEmpName}`, 'success'); setNewEmpName(''); setShowAddModal(false); } catch(err) { showToast("Failed to add employee", 'error'); } 
    };

    const handleLogIncident = async () => {
        const targetId = selectedEmp ? selectedEmp.id : selectedEmpId; if(!targetId) return showToast("Select an employee", 'error');
        try {
            const empName = personnel.find(p => p.id === targetId)?.name || 'Unknown Emp';
            const newLog = { type: incData.type, date: incData.date || new Date().toISOString().split('T')[0], count: Number(incData.count), docReceived: incData.docReceived, notes: incData.notes, loggedAt: new Date().toISOString() };
            await updateDoc(doc(db, "personnel", targetId), { totalOccurrences: increment(Number(incData.count)), incidents: arrayUnion(newLog) });
            await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', empName, 'INCIDENT', `Logged ${incData.type} (${incData.count} pts) on ${incData.date}. Notes: ${incData.notes}`);
            showToast("Incident Saved", 'success'); setShowIncidentModal(false); setIncData({ type: 'Sick', date: '', count: 1, docReceived: false, notes: '' });
        } catch(err) { showToast("Failed to save", 'error'); }
    };

    const handleDeleteIncident = async (empId: string, incident: any) => {
        if(!confirm("Permanently delete this incident record?")) return;
        try {
            const empSnap = await getDoc(doc(db, "personnel", empId)); if (!empSnap.exists()) return;
            const empName = empSnap.data().name; const updatedIncidents = (empSnap.data().incidents || []).filter((i: any) => i.loggedAt !== incident.loggedAt);
            const newTotal = updatedIncidents.reduce((sum: number, i: any) => sum + (Number(i.count) || 0), 0);
            await updateDoc(doc(db, "personnel", empId), { incidents: updatedIncidents, totalOccurrences: newTotal });
            await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', empName, 'DELETED', `Deleted ${incident.type} record from ${incident.date}`);
            showToast("Incident Deleted", 'success'); if (selectedEmp && selectedEmp.id === empId) setSelectedEmp({ ...selectedEmp, incidents: updatedIncidents, totalOccurrences: newTotal });
        } catch (err) { showToast("Delete Failed", 'error'); }
    };

    const handleExportWord = () => {
        if(!selectedEmp) return;
        const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const rollingIncidents = (selectedEmp.incidents || []).filter((inc:any) => { const d = new Date(inc.date); return d >= oneYearAgo; }).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let activePoints = 0; let incidentListHTML = "";
        rollingIncidents.forEach((inc: any, index: number) => {
            const points = parseInt(inc.count) || 0; activePoints += points;
            const d = new Date(inc.date);
            const formattedDate = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
            incidentListHTML += `<p style="margin:0; margin-left: 60pt; font-family: 'Arial'; font-size: 10pt;">${index + 1}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${formattedDate} - ${inc.type}</p>`;
        });
        let disciplineLevel = activePoints >= 6 ? "Discharge" : activePoints >= 5 ? "Final Written Warning" : activePoints >= 4 ? "Written Warning" : activePoints >= 3 ? "Verbal Warning" : "None";
        const nameParts = selectedEmp.name.split(' '); const formalName = nameParts.length > 1 ? `${nameParts[nameParts.length-1]}, ${nameParts[0]}` : selectedEmp.name;
        const today = new Date(); const reportDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Notice of Discipline</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #000000; line-height: 1.1; margin: 0; padding: 0; } p { margin: 0; padding: 0; margin-bottom: 6pt; } .header-center { text-align: center; font-weight: bold; margin-bottom: 12pt; text-transform: uppercase; font-size: 11pt; } .indent-row { margin-left: 60pt; font-family: 'Arial'; font-size: 10pt; }</style></head><body>`;
        const content = `<br><table style="width:100%; border:none; margin-bottom: 8pt;"><tr><td style="width:60%; font-family: 'Arial'; font-size: 10pt;">TO: ${formalName}</td><td style="width:40%; text-align:right; font-family: 'Arial'; font-size: 10pt;">DATE: ${reportDate}</td></tr></table><div class="header-center"><p>ATTENDANCE PROGRAM<br>NOTICE OF DISCIPLINE</p></div><p>The Attendance Program states that an employee who accumulates excessive occurrences of absence within any twelve month period (rolling year) will be disciplined according to the following:</p><br><p style="margin-left: 30pt;">Number of Occurrences&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Level of Discipline</p><p class="indent-row">1-2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;None</p><p class="indent-row">3&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Verbal Warning</p><p class="indent-row">4&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Written Warning</p><p class="indent-row">5&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Final Written Warning</p><p class="indent-row">6&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Discharge</p><br><p>My records indicate that you have accumulated <strong>${activePoints} occurrences</strong> during the past rolling twelve months. The Occurrences are as follows:</p><p style="margin-left: 60pt; text-decoration: underline;">Occurrences</p>${incidentListHTML || '<p class="indent-row">None recorded.</p>'}<br><p>Therefore, in accordance with the schedule of progressive discipline, this is your <strong>${disciplineLevel}</strong> for excessive absenteeism under the rule.</p><br><p>Please be advised that your rate of absenteeism is not acceptable and YOUR corrective action is required. Additional occurrences will result in the progressive disciplinary action indicated above.</p><br><div style="text-align:center; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:3pt 0; width:50%; margin:auto; font-weight:bold; margin-top:10pt; margin-bottom:10pt;">ACKNOWLEDGEMENT</div><p>I acknowledge receipt of this Notice of Discipline and that I have been informed of the potential for progressive discipline, up to and including discharge.</p><br><table style="width:100%; border:none; margin-top: 15pt;"><tr><td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%; border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top; padding-top:2px;">Employee</td><td></td><td style="vertical-align:top; padding-top:2px;">Date</td></tr></table><table style="width:100%; border:none; margin-top: 20pt;"><tr><td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%; border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top; padding-top:2px;">Foreman/Supervisor/Superintendent</td><td></td><td style="vertical-align:top; padding-top:2px;">Date</td></tr></table><table style="width:100%; border:none; margin-top: 20pt;"><tr><td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%; border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top; padding-top:2px;">General Foreman/Manager/General Superintendent</td><td></td><td style="vertical-align:top; padding-top:2px;">Date</td></tr></table></body></html>`;
        saveAs(new Blob(['\ufeff', header + content], { type: 'application/msword' }), `${selectedEmp.name.replace(' ','_')}_Notice.doc`); showToast("Notice Generated", 'success');
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex justify-between items-end mb-6 flex-wrap gap-2">
                <div><h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Attendance Tracker</h2><p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incident Dashboard & Logs</p></div>
                <div className="flex gap-2 flex-wrap">
                    <div className={`border rounded-lg p-1 flex ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><button onClick={()=>setViewMode('dashboard')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded ${viewMode==='dashboard'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400' : 'text-slate-500')}`}>Dashboard</button><button onClick={()=>setViewMode('log')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded ${viewMode==='log'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400' : 'text-slate-500')}`}>Master Log</button></div>
                    <button onClick={() => setShowIncidentModal(true)} className="px-6 py-2 bg-[#ef7c00] text-white rounded-lg font-black uppercase text-[10px] shadow-lg">+ Log Incident</button>
                    <button onClick={() => setShowAddModal(true)} className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] shadow-lg ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>+ Emp</button>
                </div>
            </div>

            {selectedEmp && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${darkMode ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-black'}`}>
                        <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><div><h3 className={`text-2xl font-black uppercase ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{selectedEmp.name}</h3><p className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Occurrences: <span className="text-red-500">{selectedEmp.totalOccurrences || 0}</span></p></div><div className="flex gap-2"><button onClick={handleExportWord} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase shadow hover:bg-blue-700 transition-colors">📄 Export Notice</button><button onClick={()=>setSelectedEmp(null)} className="text-2xl text-slate-400 hover:text-red-500">✕</button></div></div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className={`p-4 rounded-xl border mb-6 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-blue-50/50 border-blue-100'}`}>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-[#ef7c00]' : 'text-blue-800'}`}>Log New Incident</h4>
                                <div className="grid grid-cols-2 gap-4 mb-3"><select className={`p-2 border rounded font-bold text-xs ${inputClass}`} value={incData.type} onChange={e=>setIncData({...incData, type:e.target.value})}><option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option></select><input type="number" className={`p-2 border rounded font-bold text-xs ${inputClass}`} placeholder="Count" value={incData.count} onChange={e=>setIncData({...incData, count:Number(e.target.value)})} /></div>
                                <div className="flex gap-2 mb-3"><input type="date" onClick={handleDateClick} className={`p-2 border rounded font-bold text-xs flex-grow cursor-pointer ${inputClass}`} value={incData.date} onChange={e=>setIncData({...incData, date:e.target.value})} /><div className={`p-2 border rounded cursor-pointer font-bold text-xs flex items-center gap-2 ${incData.docReceived?(darkMode?'bg-green-900/50 border-green-700 text-green-400':'bg-green-100 border-green-200 text-green-700'):inputClass}`} onClick={()=>setIncData({...incData, docReceived:!incData.docReceived})}><span>Doc?</span>{incData.docReceived && '✓'}</div></div>
                                <input className={`w-full p-2 border rounded font-bold text-xs mb-3 ${inputClass}`} placeholder="Notes..." value={incData.notes} onChange={e=>setIncData({...incData, notes:e.target.value})} />
                                <button onClick={handleLogIncident} className="w-full py-2 bg-[#002d72] text-white rounded font-black text-xs hover:bg-[#ef7c00] transition-colors">Add Record</button>
                            </div>
                            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incident History</h4>
                            <div className={`border rounded-xl overflow-hidden overflow-x-auto ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <table className="w-full text-left text-xs min-w-[400px]">
                                    <thead className={`font-black ${darkMode ? 'bg-slate-900 text-slate-400 border-b border-slate-700' : 'bg-slate-50 text-slate-500 border-b border-slate-200'}`}><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3 text-center">Pts</th><th className="p-3">Notes</th><th className="p-3 text-center">Action</th></tr></thead><tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                        {selectedEmp.incidents?.map((inc: any, i: number) => {
                                            const isOld = (new Date().getTime() - new Date(inc.date).getTime()) / (1000 * 60 * 60 * 24) > 365;
                                            return (<tr key={i} className={isOld ? (darkMode ? "bg-red-900/20 text-red-400 font-medium" : "bg-red-50 text-red-600 font-medium") : ""}><td className="p-3 font-mono">{inc.date} {isOld && <span className="text-[8px] font-black uppercase ml-1">(>1yr)</span>}</td><td className="p-3 font-bold">{inc.type}</td><td className="p-3 text-center font-black">{inc.count}</td><td className={`p-3 italic truncate max-w-[150px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{inc.notes}</td><td className="p-3 text-center"><button onClick={() => handleDeleteIncident(selectedEmp.id, inc)} className="text-red-500 font-bold">🗑️</button></td></tr>);
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'dashboard' && (
                <div className="space-y-6 overflow-y-auto pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><p className="text-[10px] font-black uppercase tracking-widest mb-1">Total Occurrences</p><p className="text-4xl font-black text-[#ef7c00]">{stats.totalOccurrences}</p></div>
                        <div className={`p-6 rounded-2xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><p className="text-[10px] font-black uppercase tracking-widest mb-1">Employees Tracked</p><p className="text-4xl font-black">{personnel.length}</p></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[400px] ${bgClass}`}>
                            <div className="p-4 border-b flex justify-between items-center"><h3 className="text-xs font-black uppercase tracking-widest text-[#ef7c00]">Employee Roster</h3></div>
                            <div className="overflow-y-auto flex-grow custom-scrollbar"><table className="w-full text-left text-xs"><thead className="font-black uppercase border-b sticky top-0 z-10"><tr><th className="p-3">Employee Name</th><th className="p-3 text-right">Count</th></tr></thead><tbody className="divide-y">{filteredRoster.map(emp => (<tr key={emp.id} onClick={() => setSelectedEmp(emp)} className="cursor-pointer"><td className="p-3 font-bold">{emp.name}</td><td className="p-3 text-right font-black">{emp.totalOccurrences}</td></tr>))}</tbody></table></div>
                        </div>
                    </div>
                </div>
            )}
            {viewMode === 'log' && (
                <div className={`rounded-2xl shadow-lg border flex-grow overflow-hidden flex flex-col ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="overflow-x-auto flex-grow custom-scrollbar"><div className="min-w-[700px] border-b p-3 grid grid-cols-12 gap-2 text-[9px] font-black uppercase tracking-widest"><div className="col-span-3">Employee Name</div><div className="col-span-2">Incident Type</div><div className="col-span-2">Date</div><div className="col-span-1 text-center">Count</div><div className="col-span-1 text-center">Doc?</div><div className="col-span-2">Notes</div><div className="col-span-1 text-center">Action</div></div><div className="min-w-[700px] divide-y">{filteredLog.map((log, i) => (<div key={i} className="grid grid-cols-12 gap-2 p-3 items-center text-xs"><div className="col-span-3 font-bold cursor-pointer hover:underline text-[#ef7c00]" onClick={() => setSelectedEmp(personnel.find(p => p.id === log.employeeId))}>{log.employeeName}</div><div className="col-span-2 font-medium">{log.type}</div><div className="col-span-2 font-mono">{log.date}</div><div className="col-span-1 text-center font-black">{log.count}</div><div className="col-span-1 text-center">{log.docReceived ? '✅' : '❌'}</div><div className="col-span-2 truncate italic opacity-70">{log.notes || '-'}</div><div className="col-span-1 text-center"><button onClick={() => handleDeleteIncident(log.employeeId, log)} className="text-red-500 font-bold">🗑️</button></div></div>))}</div></div>
                </div>
            )}
        </div>
    );
};

const PartsInventory = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
    const [searchTerm, setSearchTerm] = useState(''); const [displayLimit, setDisplayLimit] = useState(100); const [isLargeText, setIsLargeText] = useState(false);
    const filteredParts = useMemo(() => { let r = localParts; if (searchTerm) r = r.filter((p: any) => (p.partNumber && String(p.partNumber).toLowerCase().includes(searchTerm.toLowerCase())) || (p.name && String(p.name).toLowerCase().includes(searchTerm.toLowerCase()))); return r.slice(0, displayLimit); }, [searchTerm, displayLimit]);
    const inputClass = darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-gray-400';
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative">
            <div className="flex justify-between items-end mb-6 px-2 flex-wrap gap-4">
                <div><h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Parts Registry</h2><p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Local Reference</p></div>
                <div className="flex items-center gap-3 w-full max-w-lg"><button onClick={() => setIsLargeText(!isLargeText)} className={`h-12 w-12 flex items-center justify-center rounded-2xl border-2 font-black transition-all ${isLargeText ? 'bg-[#002d72] border-[#002d72] text-white' : inputClass}`}>Aa</button><input type="text" placeholder="Search Part #..." className={`w-full p-4 rounded-2xl font-bold border-2 outline-none focus:border-[#ef7c00] transition-all shadow-sm ${inputClass}`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            </div>
            <div className={`rounded-3xl shadow-xl border flex-grow overflow-hidden flex flex-col relative ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="bg-[#002d72] grid grid-cols-12 gap-4 p-5 text-[10px] font-black uppercase text-white tracking-widest select-none"><div className="col-span-3">Part Number</div><div className="col-span-8">Description</div><div className="col-span-1 text-center">View</div></div>
                <div className="overflow-y-auto flex-grow custom-scrollbar"><div className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>{filteredParts.map((p: any, i: number) => (<div key={i} className={`grid grid-cols-12 gap-4 p-4 transition-all items-center ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}><div onClick={() => { navigator.clipboard.writeText(p.partNumber); showToast(`Copied!`, 'success'); }} className={`col-span-3 font-mono font-black rounded-lg cursor-pointer transition-all shadow-sm ${darkMode ? 'bg-slate-900 text-[#ef7c00]' : 'bg-blue-50 text-[#002d72]'} ${isLargeText ? 'text-xl px-4 py-2' : 'text-sm px-3 py-1'}`}>{p.partNumber}</div><div className={`col-span-8 font-bold uppercase flex items-center ${darkMode ? 'text-slate-200' : 'text-slate-700'} ${isLargeText ? 'text-lg leading-normal' : 'text-[11px] leading-tight'}`}>{p.name}</div><div className="col-span-1 flex justify-center"><a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} target="_blank" rel="noopener noreferrer" className={`text-[#ef7c00] hover:scale-125 transition-transform ${isLargeText ? 'text-2xl' : 'text-lg'}`}>👁️</a></div></div>))}</div></div>
            </div>
        </div>
    );
};

const StatusCharts = ({ buses }: { buses: any[] }) => {
    const statusCounts: {[key: string]: number} = { 'Active': 0, 'In Shop': 0, 'On Hold': 0, 'Engine': 0, 'Body Shop': 0, 'Vendor': 0, 'Brakes': 0, 'Safety': 0 };
    buses.forEach(b => { if (statusCounts[b.status] !== undefined) statusCounts[b.status]++; else statusCounts['Active']++; });
    const maxCount = Math.max(...Object.values(statusCounts), 1);
    const trendData = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const ds = d.toISOString().split('T')[0]; return { label: ds.slice(5), count: buses.filter(b => b.oosStartDate === ds).length }; });
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">Status Breakdown</h3><div className="flex items-end gap-3 h-40">{Object.entries(statusCounts).map(([s, c]) => (<div key={s} className="flex-1 flex flex-col justify-end items-center group relative"><div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{c}</div><div className={`w-full rounded-t-md transition-all duration-500 ${s==='Active'?'bg-green-500':s==='In Shop'?'bg-orange-500':'bg-red-500'}`} style={{ height: `${(c/maxCount)*100 || 2}%` }}></div><p className="text-[8px] font-black text-slate-400 uppercase mt-2 -rotate-45 origin-left translate-y-2 whitespace-nowrap">{s}</p></div>))}</div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-[10px] font-black text-[#002d72] uppercase tracking-widest mb-6">7-Day Intake Trend</h3><div className="flex items-end gap-2 h-40">{trendData.map((d, i) => (<div key={i} className="flex-1 flex flex-col justify-end items-center group relative"><div className="absolute -top-6 text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</div><div className="w-full bg-blue-100 hover:bg-[#002d72] rounded-t-sm transition-all" style={{ height: `${(d.count/Math.max(...trendData.map(t=>t.count),1))*100 || 2}%` }}></div><p className="text-[8px] font-bold text-slate-400 mt-2">{d.label}</p></div>))}</div></div>
        </div>
    );
};

const AnalyticsDashboard = ({ buses, showToast }: { buses: any[], showToast: any }) => {
    const [shopQueens, setShopQueens] = useState<{number: string, count: number}[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    useEffect(() => { const fetchRankings = async () => { const rankings: {number: string, count: number}[] = []; const sampleBuses = buses.slice(0, 50); for (const bus of sampleBuses) { const hSnap = await getDocs(query(collection(db, "buses", bus.number, "history"), limit(20))); if (hSnap.size > 0) rankings.push({ number: bus.number, count: hSnap.size }); } setShopQueens(rankings.sort((a,b) => b.count - a.count).slice(0, 5)); }; if(buses.length > 0) fetchRankings(); }, [buses]);
    
    const handleResetMetrics = async () => { 
        if(!confirm("⚠️ WARNING: This will permanently wipe ALL bus history, personnel incidents, and global audit logs. Proceed?")) return; 
        setIsResetting(true); let errorCount = 0;
        try { 
            showToast("Wiping databases... please wait.", "success");
            const aSnap = await getDocs(collection(db, "activity_logs"));
            for (let i = 0; i < aSnap.docs.length; i += 250) await Promise.all(aSnap.docs.slice(i, i + 250).map(d => deleteDoc(d.ref).catch(e => { console.error(e); errorCount++; })));
            for (const bus of buses) { const hSnap = await getDocs(collection(db, "buses", bus.number, "history")); for (let i = 0; i < hSnap.docs.length; i += 250) await Promise.all(hSnap.docs.slice(i, i + 250).map(d => deleteDoc(d.ref).catch(e => { console.error(e); errorCount++; }))); } 
            const pSnap = await getDocs(collection(db, "personnel"));
            for (let i = 0; i < pSnap.docs.length; i += 250) await Promise.all(pSnap.docs.slice(i, i + 250).map(d => updateDoc(d.ref, { incidents: [], totalOccurrences: 0 }).catch(e => { console.error(e); errorCount++; })));
            if (errorCount > 0) showToast(`Wiped, but ${errorCount} items failed. (Check console)`, 'error'); else showToast(`All databases wiped successfully.`, 'success'); setShopQueens([]); 
        } catch (err: any) { showToast(`Failed: ${err.message}`, 'error'); } 
        setIsResetting(false); 
    };

    const avgOOS = buses.reduce((acc, b) => acc + (b.status !== 'Active' ? 1 : 0), 0);
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Availability</p><p className="text-4xl font-black text-[#002d72] italic">{Math.round(((buses.length - avgOOS) / Math.max(buses.length, 1)) * 100)}%</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Down Units</p><p className="text-4xl font-black text-red-500 italic">{avgOOS}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex justify-between items-center mb-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Admin</p><button onClick={handleResetMetrics} disabled={isResetting} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase border border-red-200 rounded px-2 py-1 bg-red-50 disabled:opacity-50">{isResetting ? "..." : "Wipe All Databases"}</button></div><div className="space-y-2">{shopQueens.map((queen, i) => (<div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1"><span className="font-bold text-slate-700">#{queen.number}</span><span className="font-mono text-red-500">{queen.count} logs</span></div>))}</div></div>
        </div>
    );
};

const ShiftHandover = ({ buses, showToast }: { buses: any[], showToast: any }) => {
    const [report, setReport] = useState<any[]>([]);
    useEffect(() => { const fetchRecent = async () => { const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000); let logs: any[] = []; for (const b of buses.filter(x => x.status !== 'Active' || x.notes).slice(0,30)) { const hSnap = await getDocs(query(collection(db, "buses", b.number, "history"), orderBy("timestamp", "desc"), limit(2))); hSnap.forEach(d => { if((d.data().timestamp?.toMillis() || 0) > twelveHoursAgo) logs.push({ bus: b.number, ...d.data() }); }); } setReport(logs.sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))); }; if(buses.length > 0) fetchRecent(); }, [buses]);
    const copy = () => { const txt = report.map(r => `[Unit ${r.bus}] ${r.action}: ${r.details}`).join('\n'); navigator.clipboard.writeText(`SHIFT REPORT - ${new Date().toLocaleDateString()}\n\n${txt}`); showToast("Report copied!", 'success'); };
    return (
        <div className="max-w-4xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4"><div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-[#002d72] uppercase italic">Shift Handover</h2><button onClick={copy} className="px-6 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-[#ef7c00] transition-all transform active:scale-95">Copy Report</button></div><div className="space-y-4">{report.map((l, i) => (<div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex gap-6 items-center"><div className="w-16 h-16 bg-[#002d72]/5 rounded-xl flex items-center justify-center font-black text-[#002d72] text-lg">#{l.bus}</div><div className="flex-grow"><div className="flex justify-between mb-1"><span className="text-[10px] font-black text-[#ef7c00] uppercase">{l.action}</span><span className="text-[10px] font-bold text-slate-500">{formatTime(l.timestamp)}</span></div><p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{l.details}</p><p className="text-[9px] text-slate-400 mt-2 uppercase tracking-widest">{l.user}</p></div></div>))}</div></div>
    );
};

const BusInputForm = ({ showToast, darkMode, buses, isAdmin, statusOptions }: { showToast: any, darkMode: boolean, buses: any[], isAdmin: boolean, statusOptions: any[] }) => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newBusData, setNewBusData] = useState({ number: '', status: 'Active' });

    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleDateClick = (e: any) => e.target.showPicker?.();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        const today = new Date(); today.setHours(23,59,59,999);
        if (formData.oosStartDate) {
            const oos = new Date(formData.oosStartDate);
            if (oos > today) return showToast("Out of Service date cannot be a future date", 'error');
            if (formData.expectedReturnDate && new Date(formData.expectedReturnDate) < oos) return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            if (formData.actualReturnDate && new Date(formData.actualReturnDate) < oos) return showToast("Actual Return cannot be earlier than OOS Date", 'error');
        }

        const busRef = doc(db, "buses", formData.number); const busSnap = await getDoc(busRef);
        if (!busSnap.exists()) return showToast(`⛔ Bus #${formData.number} not found. Please add it first.`, 'error');
        
        const old = busSnap.data(); let changes = []; 
        if (old.status !== formData.status) changes.push(`STATUS: ${old.status} ➝ ${formData.status}`); 
        if (old.notes !== formData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${formData.notes}"`); 
        if (old.oosStartDate !== formData.oosStartDate) changes.push(`OOS: ${old.oosStartDate || '—'} ➝ ${formData.oosStartDate}`);
        
        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        await logHistory(formData.number, "UPDATE", changes.length > 0 ? changes.join('\n') : "Routine Update via Terminal", auth.currentUser?.email || 'Unknown');
        showToast(`Bus #${formData.number} Updated`, 'success'); 
        setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    };

    const handleAddNewBus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBusData.number) return showToast("Bus number required", 'error');
        const busRef = doc(db, "buses", newBusData.number);
        const snap = await getDoc(busRef);
        if (snap.exists()) return showToast(`⛔ Bus #${newBusData.number} already exists!`, 'error');

        await setDoc(busRef, { number: newBusData.number, status: newBusData.status, location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() });
        await logHistory(newBusData.number, "CREATED", "Bus added to registry.", auth.currentUser?.email || 'Unknown');
        showToast(`Bus #${newBusData.number} Added`, 'success');
        setShowAddModal(false); setNewBusData({ number: '', status: 'Active' });
    };

    const populateFleet = async () => {
        if (!confirm(`Initialize database with ${HAMILTON_FLEET.length} Hamilton buses?`)) return;
        const existingBusNumbers = new Set(buses.map(b => b.number));
        const batch = writeBatch(db);
        let count = 0;
        for (const b of HAMILTON_FLEET) {
            if (!existingBusNumbers.has(b)) {
                batch.set(doc(db, "buses", b), { number: b, status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() });
                count++;
            }
        }
        if (count > 0) { await batch.commit(); showToast(`Added ${count} missing buses!`, 'success'); } 
        else showToast("All Hamilton buses already in system.", 'success');
    };

    const resetAllFleet = async () => {
        if (!confirm("⚠️ Master Reset: Set all buses to Active?")) return;
        showToast("Resetting fleet... please wait.", "success");
        for (let i = 0; i < buses.length; i += 250) {
            await Promise.all(buses.slice(i, i + 250).map(bus => 
                updateDoc(doc(db, "buses", bus.docId), { status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() }).catch(e => console.error(e))
            ));
        }
        await logActivity(auth.currentUser?.email || 'Unknown', 'SYSTEM', 'Entire Fleet', 'UPDATE', 'Master Reset triggered.');
        showToast("Fleet successfully reset.", 'success');
    };

    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-gray-400';
    
    return (
        <div className={`max-w-2xl mx-auto mt-4 md:mt-10 p-6 md:p-8 rounded-2xl shadow-xl border-t-8 border-[#ef7c00] animate-in slide-in-from-bottom-4 duration-500 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
                <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Data Entry</h2>
                <div className="flex gap-2 flex-wrap">
                    {isAdmin && <button type="button" onClick={resetAllFleet} className="px-3 py-2 rounded-lg font-black uppercase text-[9px] bg-red-600 hover:bg-red-700 text-white shadow-md">🚨 Reset Fleet</button>}
                    {isAdmin && <button type="button" onClick={populateFleet} className={`px-3 py-2 rounded-lg font-black uppercase text-[9px] border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>⚙️ Init Fleet</button>}
                    <button type="button" onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-black uppercase text-[10px] shadow-md">+ Add Bus</button>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <input type="text" placeholder="Unit # to Update" className={`p-4 border-2 rounded-xl font-black outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.number} onChange={handleChange} name="number" required />
                    <select className={`p-4 border-2 rounded-xl font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.status} onChange={handleChange} name="status">
                        <option value="Active">Active</option>
                        {statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}
                    </select>
                </div>
                <input type="text" placeholder="Location" className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.location} onChange={handleChange} name="location" />
                <textarea placeholder="Maintenance Notes" className={`w-full p-4 border-2 rounded-xl h-24 outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.notes} onChange={handleChange} name="notes" />
                <div className="grid grid-cols-3 gap-4">
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>OOS Date</label><input name="oosStartDate" type="date" onClick={handleDateClick} max={new Date().toISOString().split('T')[0]} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer ${inputClass}`} value={formData.oosStartDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exp Return</label><input name="expectedReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer ${inputClass}`} value={formData.expectedReturnDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Act Return</label><input name="actualReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer ${inputClass}`} value={formData.actualReturnDate} onChange={handleChange} /></div>
                </div>
                <button className="w-full py-4 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg">Update Record</button>
            </form>
            {showAddModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`p-8 rounded-xl shadow-2xl w-full max-w-md border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h3 className={`text-2xl font-black mb-6 uppercase italic ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Add New Bus</h3>
                        <form onSubmit={handleAddNewBus} className="space-y-4">
                            <div><label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Unit Number *</label><input type="text" className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.number} onChange={e => setNewBusData({...newBusData, number: e.target.value})} required placeholder="e.g., 2001" /></div>
                            <div><label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Initial Status</label><select className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.status} onChange={e => setNewBusData({...newBusData, status: e.target.value})}><option value="Active">Active</option>{statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}</select></div>
                            <div className="flex gap-4 mt-8"><button type="button" onClick={() => setShowAddModal(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-black'}`}>Cancel</button><button type="submit" className="w-1/2 py-3 bg-green-600 text-white rounded-xl font-black uppercase text-xs shadow-lg">Save Bus</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function FleetManager() {
    const [user, setUser] = useState<any>(null);
    const [userStatus, setUserStatus] = useState<'loading' | 'approved' | 'pending' | 'rejected'>('loading');
    const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
    const [view, setView] = useState<'inventory' | 'tracker' | 'input' | 'analytics' | 'handover' | 'personnel' | 'parts' | 'admin'>('inventory');
    const [inventoryMode, setInventoryMode] = useState<'list' | 'grid' | 'tv'>('grid');
    const [buses, setBuses] = useState<any[]>([]);
    const [selectedBusDetail, setSelectedBusDetail] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'number', direction: 'asc' });
    const [activeFilter, setActiveFilter] = useState('Total Fleet');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [legalType, setLegalType] = useState<'privacy'|'about'|null>(null);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [darkMode, setDarkMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const tvBoardRef = useRef<HTMLDivElement>(null);

    const isMasterAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');
    const isAdmin = isMasterAdmin || userRole === 'admin';
    const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); };

    useEffect(() => { onAuthStateChanged(auth, u => setUser(u)); }, []);

    useEffect(() => {
        if (!user) { setUserStatus('loading'); return; }
        if (ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
            setUserStatus('approved'); setUserRole('admin'); return;
        }
        return onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserStatus(data.status || 'pending');
                setUserRole(data.role || 'user');
            } else {
                setDoc(doc(db, "users", user.uid), { email: user.email?.toLowerCase() || '', status: 'pending', role: 'user', createdAt: serverTimestamp() });
                setUserStatus('pending'); setUserRole('user');
            }
        });
    }, [user]);

    useEffect(() => { 
        if (!user || userStatus !== 'approved') return; 
        const uBuses = onSnapshot(query(collection(db, "buses"), orderBy("number", "asc")), s => setBuses(s.docs.map(d => ({...d.data(), docId: d.id})))); 
        const uOpts = onSnapshot(doc(db, "settings", "status_options"), s => { if (s.exists()) setStatusOptions(s.data().list || []); });
        return () => { uBuses(); uOpts(); };
    }, [user, userStatus]);

    const getStatusType = (label: string) => {
        const opt = statusOptions.find(o => o.label === label);
        return opt ? opt.type : (label === 'Active' ? 'ready' : (label === 'In Shop' ? 'shop' : 'hold'));
    };

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement && tvBoardRef.current) tvBoardRef.current.requestFullscreen().catch(e => console.error(e));
        else if (document.fullscreenElement) document.exitFullscreen();
    };

    useEffect(() => {
        let animationFrameId: number; let isPaused = false; let scrollPos = 0;
        const scroll = () => {
            if (inventoryMode === 'tv' && isFullscreen && tvBoardRef.current && !isPaused) {
                const el = tvBoardRef.current;
                if (el.scrollHeight > el.clientHeight) {
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
                        isPaused = true;
                        setTimeout(() => { if(tvBoardRef.current) { tvBoardRef.current.scrollTop = 0; scrollPos = 0; } setTimeout(() => { isPaused = false; }, 2000); }, 4000); 
                    } else {
                        scrollPos += 1.2; el.scrollTop = scrollPos;
                        if (Math.abs(el.scrollTop - Math.round(scrollPos)) > 2) scrollPos = el.scrollTop;
                    }
                }
            }
            animationFrameId = requestAnimationFrame(scroll);
        };
        if (inventoryMode === 'tv' && isFullscreen) animationFrameId = requestAnimationFrame(scroll);
        return () => { if(animationFrameId) cancelAnimationFrame(animationFrameId); };
    }, [inventoryMode, isFullscreen]);

    const sortedBuses = [...buses].filter(b => {
        if (!b.number.includes(searchTerm)) return false;
        if (activeFilter === 'Total Fleet') return true;
        if (activeFilter === 'Ready') return b.status === 'Active' || getStatusType(b.status) === 'ready';
        if (activeFilter === 'On Hold') return getStatusType(b.status) === 'hold';
        if (activeFilter === 'In Shop') return getStatusType(b.status) === 'shop';
        return true;
    }).sort((a, b) => {
        if (sortConfig.key === 'number') {
            const numA = parseInt(a.number) || 0; const numB = parseInt(b.number) || 0;
            return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
        let aV = a[sortConfig.key] || ''; let bV = b[sortConfig.key] || '';
        if (sortConfig.key === 'daysOOS') { aV = calculateDaysOOS(a.oosStartDate); bV = calculateDaysOOS(b.oosStartDate); }
        return aV < bV ? (sortConfig.direction === 'asc' ? -1 : 1) : (sortConfig.direction === 'asc' ? 1 : -1);
    });

    const requestSort = (key: string) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });

    const exportExcel = async () => {
        const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('OOS Detail');
        ws.columns = [{header:'Bus #',key:'number',width:10},{header:'Status',key:'status',width:15},{header:'Location',key:'location',width:15},{header:'Fault',key:'notes',width:30},{header:'OOS Start',key:'start',width:15}];
        buses.forEach(b => ws.addRow({number:b.number, status:b.status, location:b.location||'', notes:b.notes||'', start:b.oosStartDate||''}));
        const buf = await wb.xlsx.writeBuffer(); saveAs(new Blob([buf]), `Fleet_Status_Report.xlsx`); showToast("Excel Downloaded", 'success');
    };

    const handleAuth = async (e: any) => {
        e.preventDefault();
        try {
            if (isSignUp) {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "users", cred.user.uid), { email: email.toLowerCase(), status: 'pending', role: 'user', createdAt: serverTimestamp() });
                showToast("Account Created. Pending Approval.", "success");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch(e: any) { showToast(e.message.replace('Firebase: ', ''), "error"); }
    };

    const [isSignUp, setIsSignUp] = useState(false);

    if (!user) return (
        <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
            <div className="flex-grow flex items-center justify-center p-4">
                <form onSubmit={handleAuth} className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-[#ef7c00]">
                    <h2 className="text-3xl font-black text-white italic mb-8 uppercase text-center">{isSignUp ? 'Join Fleetflow' : 'Fleet Operations'}</h2>
                    <input className="w-full p-4 mb-4 rounded-xl bg-slate-900 border-2 border-slate-700 text-white outline-none focus:border-[#ef7c00]" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
                    <input className="w-full p-4 mb-6 rounded-xl bg-slate-900 border-2 border-slate-700 text-white outline-none focus:border-[#ef7c00]" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
                    <button className="w-full py-5 bg-[#ef7c00] text-white font-black uppercase rounded-xl shadow-lg hover:bg-orange-600 transition-colors">{isSignUp ? 'Register' : 'Login'}</button>
                    <button type="button" onClick={()=>setIsSignUp(!isSignUp)} className="w-full mt-6 text-slate-400 text-xs font-bold hover:text-white transition-colors">{isSignUp ? 'Back to Login' : "Don't have an account? Sign Up"}</button>
                </form>
            </div>
            <Footer onShowLegal={setLegalType} darkMode={true} />
        </div>
    );

    if (userStatus === 'pending' || userStatus === 'rejected') return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
            <h2 className="text-4xl font-black uppercase italic mb-4">Pending Approval</h2>
            <p className="opacity-50 font-bold mb-8">Administrators have been notified of your registration.</p>
            <button onClick={()=>signOut(auth)} className="px-10 py-4 bg-slate-800 rounded-xl font-black uppercase">Sign Out</button>
            <div className="absolute bottom-0 w-full"><Footer onShowLegal={setLegalType} darkMode={true} /></div>
        </div>
    );

    return (
        <div className={`flex flex-col min-h-screen font-sans selection:bg-[#ef7c00] selection:text-white transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
            {selectedBusDetail && (<div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={showToast} darkMode={darkMode} isAdmin={isAdmin} statusOptions={statusOptions} /></div>)}
            {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} darkMode={darkMode} />}

            <nav className={`backdrop-blur-md border-b sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
                <div className="flex items-center gap-2"><div className="w-2 h-6 bg-[#ef7c00] rounded-full"></div><span className="font-black italic uppercase">Fleet Manager</span></div>
                <div className="flex gap-4 items-center">
                    {['inventory', 'input', 'tracker', 'handover', 'parts'].concat(isAdmin ? ['analytics', 'personnel', 'admin'] : []).map(v => (
                        <button key={v} onClick={()=>setView(v as any)} className={`text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${view === v ? 'border-[#ef7c00] text-[#ef7c00]' : 'border-transparent text-slate-400 hover:text-[#ef7c00]'}`}>{v.replace('admin','panel')}</button>
                    ))}
                    <button onClick={()=>setDarkMode(!darkMode)} className="px-3 py-1 rounded-full border text-[10px]">{darkMode ? '☀️' : '🌙'}</button>
                    <button onClick={()=>signOut(auth)} className="text-red-500 font-black text-[10px] uppercase">Logout</button>
                </div>
            </nav>

            <main className="flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-6">
                {view === 'admin' ? <AccessManager showToast={showToast} darkMode={darkMode} /> :
                 view === 'input' ? <BusInputForm showToast={showToast} darkMode={darkMode} buses={buses} isAdmin={isAdmin} statusOptions={statusOptions} /> :
                 view === 'analytics' ? <div className="space-y-10"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={showToast} /></div> :
                 view === 'parts' ? <PartsInventory showToast={showToast} darkMode={darkMode} /> :
                 view === 'handover' ? <ShiftHandover buses={buses} showToast={showToast} /> :
                 view === 'personnel' ? <PersonnelManager showToast={showToast} darkMode={darkMode} /> :
                 view === 'tracker' ? <div className="h-[85vh] rounded-2xl border overflow-hidden relative"><BusTracker /></div> : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {['Total', 'Ready', 'In Shop', 'Hold'].map(l => {
                                const count = l==='Total' ? buses.length : buses.filter(b=> {
                                    const type = getStatusType(b.status);
                                    if (l==='Ready') return type === 'ready' || b.status === 'Active';
                                    if (l==='In Shop') return type === 'shop';
                                    if (l==='Hold') return type === 'hold';
                                    return false;
                                }).length;
                                return (
                                    <div key={l} onClick={()=>setActiveFilter(l==='Total'?'Total Fleet':l)} className={`cursor-pointer p-6 rounded-2xl border shadow-sm ${activeFilter === (l==='Total'?'Total Fleet':l) ? (darkMode ? 'border-[#ef7c00] bg-slate-800' : 'border-[#002d72] bg-blue-50') : (darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white')}`}>
                                        <p className="text-[10px] font-black uppercase opacity-50 mb-1">{l}</p>
                                        <p className={`text-4xl font-black ${l==='Ready'?'text-green-500':l==='In Shop'?'text-orange-500':l==='Hold'?'text-red-500':''}`}>{count}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between items-center mb-6">
                            <input className={`w-full max-w-md p-4 rounded-xl border-2 font-bold outline-none focus:border-[#ef7c00] ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'}`} placeholder="Filter Unit #..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                            <div className="flex gap-2 p-1 border rounded-xl bg-black/5">
                                {['list', 'grid', 'tv'].map(m => <button key={m} onClick={()=>setInventoryMode(m as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${inventoryMode === m ? 'bg-[#ef7c00] text-white shadow' : 'text-slate-400 hover:text-white'}`}>{m}</button>)}
                            </div>
                        </div>
                        
                        <div ref={tvBoardRef} className={`rounded-3xl border shadow-xl overflow-hidden min-h-[60vh] ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            {inventoryMode === 'tv' || inventoryMode === 'grid' ? (
                                <div className={`p-6 grid gap-6 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}`}>
                                    {sortedBuses.map(b => {
                                        const type = getStatusType(b.status);
                                        const color = type==='ready'?'text-green-500':type==='shop'?'text-orange-500':'text-red-500';
                                        const borderColor = type==='ready'?'border-green-500/30':type==='shop'?'border-orange-500/30':'border-red-600/30';
                                        return (
                                            <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`cursor-pointer p-6 rounded-2xl border-4 flex flex-col shadow-lg transition-transform hover:scale-105 ${borderColor} ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className={`text-5xl font-black leading-none ${color}`}>#{b.number}</span>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase text-white ${type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-500'}`}>{b.status}</span>
                                                </div>
                                                <div className="text-sm font-black mb-2">📍 {b.location || 'Location Unavailable'}</div>
                                                <div className="text-xs font-bold opacity-70 mb-4 h-20 overflow-hidden leading-relaxed">{b.notes || 'No faults recorded.'}</div>
                                                {b.status !== 'Active' && <div className={`mt-auto py-2 text-center text-xs font-black text-white rounded-lg ${type==='shop'?'bg-orange-500':'bg-red-600'}`}>{calculateDaysOOS(b.oosStartDate)} DAYS DOWN</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className={`font-black uppercase text-[10px] tracking-widest border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                            <tr><th className="p-4 cursor-pointer" onClick={()=>requestSort('number')}>Unit #</th><th className="p-4">Status</th><th className="p-4">Location</th><th className="p-4">Notes</th><th className="p-4 cursor-pointer" onClick={()=>requestSort('daysOOS')}>Days OOS</th></tr>
                                        </thead>
                                        <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                            {sortedBuses.map(b => {
                                                const type = getStatusType(b.status);
                                                return (
                                                    <tr key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`cursor-pointer ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}>
                                                        <td className="p-4 font-black text-lg">#{b.number}</td>
                                                        <td className="p-4"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase text-white ${type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-500'}`}>{b.status}</span></td>
                                                        <td className="p-4 font-bold text-xs">{b.location}</td>
                                                        <td className="p-4 italic text-xs opacity-70">{b.notes}</td>
                                                        <td className="p-4 font-black">{b.status !== 'Active' ? calculateDaysOOS(b.oosStartDate) : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        {inventoryMode === 'tv' && (
                             <div className="mt-4 flex justify-end">
                                 <button onClick={toggleFullScreen} className="px-6 py-3 bg-[#ef7c00] text-white rounded-xl font-black uppercase text-xs shadow-lg">⛶ Fullscreen TV</button>
                             </div>
                        )}
                    </>
                 )}
            </main>
            {view !== 'input' && view !== 'admin' && view !== 'personnel' && view !== 'analytics' && <Footer onShowLegal={setLegalType} darkMode={darkMode} />}
        </div>
    );
}