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
    const type = statusOptions.find(o=>o.label===bus.status)?.type || (bus.status==='Active'?'ready':(['In Shop','Engine','Body Shop','Brakes'].includes(bus.status)?'shop':'hold'));
    const statusColorText = type==='ready' ? 'text-green-500' : type==='shop' ? 'text-orange-500' : 'text-red-500';
    const statusColorBadge = type==='ready' ? 'bg-green-500' : type==='shop' ? 'bg-orange-500' : 'bg-red-500';

    if (showHistory) return (
        <div className={`p-6 rounded-xl shadow-2xl w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95 border ${bgClass}`}>
            <div className={`flex justify-between items-center mb-4 border-b pb-4 font-black uppercase ${statusColorText}`}>
                <span>History: #{bus.number}</span><button onClick={()=>setShowHistory(false)} className="text-xs">Back</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                {historyLogs.map(l => (
                    <div key={l.id} className={`p-3 rounded-lg border relative group ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className={`flex justify-between text-[8px] font-black uppercase mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><span>{l.action}</span><span>{formatTime(l.timestamp)}</span></div>
                        <p className="text-xs font-bold whitespace-pre-wrap leading-tight">{l.details}</p>
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
                <select className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.status} onChange={e=>setEditData({...editData, status:e.target.value})}>
                    <option value="Active">Ready for Service</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option>
                    {statusOptions.map((o,i)=><option key={i} value={o.label}>{o.label}</option>)}
                </select>
                <input className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.location} onChange={e=>setEditData({...editData, location:e.target.value})} placeholder="Location" />
            </div>
            <textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-4 font-bold ${inputClass}`} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} placeholder="Maintenance Notes" />
            <div className="grid grid-cols-3 gap-4 mb-6 text-[9px] font-black uppercase">
                <div>OOS Date<input type="date" max={new Date().toISOString().split('T')[0]} className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.oosStartDate} onChange={e=>setEditData({...editData, oosStartDate:e.target.value})} /></div>
                <div>Exp Return<input type="date" min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.expectedReturnDate} onChange={e=>setEditData({...editData, expectedReturnDate:e.target.value})} /></div>
                <div>Act Return<input type="date" min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold ${inputClass}`} value={editData.actualReturnDate} onChange={e=>setEditData({...editData, actualReturnDate:e.target.value})} /></div>
            </div>
            <div className="flex gap-4">
                <button onClick={()=>setIsEditing(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>Cancel</button>
                <button onClick={handleSave} className="w-1/2 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg">Save</button>
            </div>
        </div>
    );

    return (
        <div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}>
            <div className="flex justify-between items-start mb-6 border-b border-slate-500/20 pb-4">
                <div>
                    <h3 className={`text-4xl font-black italic uppercase ${statusColorText}`}>Bus #{bus.number}</h3>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white ${statusColorBadge}`}>{bus.status}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleResetBus} className="text-red-500 text-xs font-black uppercase border border-red-500/30 bg-red-500/10 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition-colors">Reset</button>
                    <button onClick={onClose} className="text-slate-400 text-2xl font-bold hover:text-slate-500 transition-colors">✕</button>
                </div>
            </div>
            <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                <p className="text-[10px] font-black uppercase mb-2 opacity-50">Fault Details</p>
                <p className="text-lg font-medium">{bus.notes || "No active faults."}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div><p className="text-[9px] font-black uppercase opacity-50">OOS Date</p><p className="text-xl font-black text-[#002d72]">{bus.oosStartDate || '--'}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-50">Exp Return</p><p className="text-xl font-black text-[#ef7c00]">{bus.expectedReturnDate || '--'}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-50">Act Return</p><p className="text-xl font-black text-green-500">{bus.actualReturnDate || '--'}</p></div>
            </div>
            <div className="flex justify-between pt-6 border-t border-slate-500/20">
                <button onClick={()=>setShowHistory(true)} className={`px-5 py-3 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>📜 History</button>
                <div className="flex gap-3">
                    <button onClick={()=>setIsEditing(true)} className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-slate-700 text-[#ef7c00] hover:bg-slate-600' : 'bg-slate-100 text-[#002d72] hover:bg-slate-200'}`}>Edit</button>
                    <button onClick={onClose} className="px-8 py-3 bg-[#002d72] hover:bg-blue-800 text-white rounded-lg text-[10px] font-black uppercase">Close</button>
                </div>
            </div>
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
            <div>
                <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Admin Panel</h2>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mt-1">Manage System Settings</p>
            </div>
            <div className={`p-8 rounded-2xl border shadow-xl ${bgClass}`}>
                <h3 className={`text-xl font-black uppercase italic mb-6 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Status Menu Customization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-50 mb-4">Add New Option</p>
                        <div className="flex gap-2">
                            <input className={`flex-grow p-3 rounded-lg border font-bold outline-none ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} placeholder="Label (e.g. Parts Hold)" value={newStatus.label} onChange={e=>setNewStatus({...newStatus, label: e.target.value})} />
                            <select className={`p-3 rounded-lg border font-bold outline-none ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} value={newStatus.type} onChange={e=>setNewStatus({...newStatus, type: e.target.value})}>
                                <option value="ready">Ready (Green)</option><option value="shop">In Shop (Orange)</option><option value="hold">Hold/Down (Red)</option>
                            </select>
                            <button onClick={handleAddStatus} className="px-6 bg-[#ef7c00] hover:bg-orange-600 text-white font-black rounded-lg transition-colors">+</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase opacity-50 mb-4">Active Custom Dropdown List</p>
                        {statusOptions.map((s, i) => (
                            <div key={i} className={`flex justify-between items-center p-3 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${s.type==='ready'?'bg-green-500':s.type==='shop'?'bg-orange-500':'bg-red-500'}`}></div><span className="font-bold">{s.label}</span></div>
                                <button onClick={()=>handleRemoveStatus(i)} className="text-red-500 text-xs font-black hover:underline">REMOVE</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className={`rounded-2xl border shadow-xl overflow-hidden ${bgClass}`}>
                <table className="w-full text-left text-sm">
                    <thead className={`font-black uppercase text-[10px] tracking-widest border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        <tr><th className="p-4">User (Click for Log)</th><th className="p-4 text-center">Role</th><th className="p-4 text-center">Access</th><th className="p-4 text-right pr-6">Actions</th></tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {usersList.map(u => {
                            const isMaster = ADMIN_EMAILS.includes(u.email?.toLowerCase());
                            return (
                                <tr key={u.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}>
                                    <td className="p-4 font-bold cursor-pointer text-[#ef7c00] hover:underline" onClick={()=>fetchUserHistory(u.email)}>{u.email} {isMaster && <span className="text-[8px] bg-purple-500 text-white px-1 py-0.5 rounded ml-2">MASTER</span>}</td>
                                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${u.role==='admin'||isMaster?'bg-purple-100 text-purple-700 border border-purple-200':'bg-slate-100 text-slate-500 border border-slate-200'}`}>{u.role==='admin'||isMaster?'Admin (OP)':'Standard'}</span></td>
                                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase text-white ${u.status==='approved'||isMaster?'bg-green-500':'bg-orange-500'}`}>{u.status==='approved'||isMaster?'Approved':'Pending'}</span></td>
                                    <td className="p-4 text-right pr-6 space-x-2">
                                        {!isMaster && (
                                            <>
                                                <button onClick={()=>toggleApproval(u.id, u.status)} className={`px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm ${u.status==='approved'?'bg-orange-100 text-orange-700':'bg-green-500 text-white'}`}>{u.status==='approved'?'Revoke':'Approve'}</button>
                                                <button onClick={()=>toggleRole(u.id, u.role)} className={`px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm ${u.role==='admin'?'bg-slate-200 text-slate-700':'bg-purple-600 text-white'}`}>{u.role==='admin'?'De-OP':'OP'}</button>
                                                <button onClick={()=>deleteUser(u.id)} className="px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm bg-red-600 hover:bg-red-700 text-white">Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedUserHistory && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border ${bgClass}`}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-500/20">
                            <div><h3 className="text-xl font-black uppercase italic">{selectedUserHistory} History</h3></div>
                            <button onClick={()=>setSelectedUserHistory(null)} className="text-2xl font-bold hover:text-red-500">✕</button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar space-y-3 pr-2">
                            {userLogs.length === 0 ? <p className="text-center p-10 italic opacity-50">No logs found.</p> : userLogs.map(log => (
                                <div key={log.id} className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex justify-between items-center text-[10px] font-black opacity-50 mb-2">
                                        <span>{log.category} • {log.target}</span><span>{formatTime(log.timestamp)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${log.action === 'CREATED' ? 'bg-green-500/20 text-green-600' : log.action === 'UPDATE' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>{log.action}</span> 
                                        <span className="text-xs font-bold leading-snug">{log.details}</span>
                                    </div>
                                </div>
                            ))}
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
    
    const [logFilter, setLogFilter] = useState({ search: '', type: 'All' });
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    useEffect(() => { return onSnapshot(query(collection(db, "personnel"), orderBy("name")), (snap) => setPersonnel(snap.docs.map(d => ({ ...d.data(), id: d.id })))); }, []);
    
    const handleDateClick = (e: any) => e.currentTarget.showPicker?.();

    const allIncidents = useMemo(() => {
        let logs: any[] = []; personnel.forEach(p => { if (p.incidents) p.incidents.forEach((inc: any) => logs.push({ ...inc, employeeName: p.name, employeeId: p.id })); });
        return logs;
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
        
        return logs.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (sortConfig.key === 'date') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); } 
            else if (sortConfig.key === 'count') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; } 
            else if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase(); }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [allIncidents, logFilter, sortConfig]);

    const filteredRoster = useMemo(() => { if (!rosterSearch) return stats.topOffenders; return stats.topOffenders.filter(p => p.name.toLowerCase().includes(rosterSearch.toLowerCase())); }, [stats.topOffenders, rosterSearch]);
    const jumpToLog = (typeFilter: string = 'All') => { setLogFilter(prev => ({ ...prev, type: typeFilter, search: '' })); setViewMode('log'); };
    
    const requestSort = (key: string) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    const SortArrow = ({ columnKey }: { columnKey: string }) => sortConfig.key !== columnKey ? <span className="opacity-30 inline-block ml-1">↕</span> : <span className="inline-block ml-1 text-[#ef7c00]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;

    const handleAddEmployee = async (e: React.FormEvent) => { 
        e.preventDefault(); if(!newEmpName) return; 
        try { await addDoc(collection(db, "personnel"), { name: newEmpName, totalOccurrences: 0, incidents: [], timestamp: serverTimestamp() }); await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', newEmpName, 'CREATED', `Added new employee record`); showToast(`Added ${newEmpName}`, 'success'); setNewEmpName(''); setShowAddModal(false); } catch(err) { showToast("Failed to add employee", 'error'); } 
    };

    const handleDeleteEmployee = async (empId: string, empName: string) => {
        if(!confirm(`Are you sure you want to completely delete ${empName}? This action cannot be undone.`)) return;
        try { await deleteDoc(doc(db, "personnel", empId)); await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', empName, 'DELETED', `Deleted entire employee profile.`); showToast(`${empName} deleted.`, 'success'); setSelectedEmp(null); } catch(err) { showToast("Failed to delete employee", 'error'); }
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
        const rollingIncidents = (selectedEmp.incidents || []).filter((inc:any) => new Date(inc.date) >= oneYearAgo).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let activePoints = 0; let incidentListHTML = "";
        rollingIncidents.forEach((inc: any, index: number) => {
            const points = parseInt(inc.count) || 0; activePoints += points;
            const d = new Date(inc.date);
            const formattedDate = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
            incidentListHTML += `<p style="margin:0; margin-left: 60pt; font-family: 'Arial'; font-size: 10pt;">${index + 1}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${formattedDate} - ${inc.type}</p>`;
        });
        let dL = activePoints >= 6 ? "Discharge" : activePoints >= 5 ? "Final Written Warning" : activePoints >= 4 ? "Written Warning" : activePoints >= 3 ? "Verbal Warning" : "None";
        const parts = selectedEmp.name.split(' '); const fN = parts.length > 1 ? `${parts[parts.length-1]}, ${parts[0]}` : selectedEmp.name;
        const t = new Date(); const rD = `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}/${t.getFullYear()}`;
        const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Notice of Discipline</title><style>body{font-family:'Arial',sans-serif;font-size:10pt;color:#000;line-height:1.1;margin:0;padding:0}p{margin:0;padding:0;margin-bottom:6pt}.hc{text-align:center;font-weight:bold;margin-bottom:12pt;text-transform:uppercase;font-size:11pt}.ir{margin-left:60pt;font-family:'Arial';font-size:10pt}</style></head><body><br><table style="width:100%;border:none;margin-bottom:8pt;"><tr><td style="width:60%;font-family:'Arial';font-size:10pt;">TO: ${fN}</td><td style="width:40%;text-align:right;font-family:'Arial';font-size:10pt;">DATE: ${rD}</td></tr></table><div class="hc"><p>ATTENDANCE PROGRAM<br>NOTICE OF DISCIPLINE</p></div><p>The Attendance Program states that an employee who accumulates excessive occurrences of absence within any twelve month period (rolling year) will be disciplined according to the following:</p><br><p style="margin-left: 30pt;">Number of Occurrences&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Level of Discipline</p><p class="ir">1-2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;None</p><p class="ir">3&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Verbal Warning</p><p class="ir">4&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Written Warning</p><p class="ir">5&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Final Written Warning</p><p class="ir">6&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Discharge</p><br><p>My records indicate that you have accumulated <strong>${activePoints} occurrences</strong> during the past rolling twelve months. The Occurrences are as follows:</p><p style="margin-left: 60pt; text-decoration: underline;">Occurrences</p>${incidentListHTML || '<p class="ir">None recorded.</p>'}<br><p>Therefore, in accordance with the schedule of progressive discipline, this is your <strong>${dL}</strong> for excessive absenteeism under the rule.</p><br><p>Please be advised that your rate of absenteeism is not acceptable and YOUR corrective action is required. Additional occurrences will result in the progressive disciplinary action indicated above.</p><br><div style="text-align:center;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:3pt 0;width:50%;margin:auto;font-weight:bold;margin-top:10pt;margin-bottom:10pt;">ACKNOWLEDGEMENT</div><p>I acknowledge receipt of this Notice of Discipline and that I have been informed of the potential for progressive discipline, up to and including discharge.</p><br><table style="width:100%;border:none;margin-top:15pt;"><tr><td style="width:50%;border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%;border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top;padding-top:2px;">Employee</td><td></td><td style="vertical-align:top;padding-top:2px;">Date</td></tr></table><table style="width:100%;border:none;margin-top:20pt;"><tr><td style="width:50%;border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%;border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top;padding-top:2px;">Foreman/Supervisor/Superintendent</td><td></td><td style="vertical-align:top;padding-top:2px;">Date</td></tr></table><table style="width:100%;border:none;margin-top:20pt;"><tr><td style="width:50%;border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%;border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top;padding-top:2px;">General Foreman/Manager/General Superintendent</td><td></td><td style="vertical-align:top;padding-top:2px;">Date</td></tr></table></body></html>`;
        saveAs(new Blob(['\ufeff', html], { type: 'application/msword' }), `${selectedEmp.name.replace(' ','_')}_Notice.doc`); showToast("Notice Generated", 'success');
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex justify-between items-end mb-6 flex-wrap gap-4">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Attendance Tracker</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incident Dashboard & Logs</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <div className={`border rounded-lg p-1 flex shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <button onClick={()=>setViewMode('dashboard')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${viewMode==='dashboard'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Dashboard</button>
                        <button onClick={()=>setViewMode('log')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${viewMode==='log'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Master Log</button>
                    </div>
                    <button onClick={() => setShowIncidentModal(true)} className="px-6 py-2 bg-[#ef7c00] text-white rounded-lg font-black uppercase text-[10px] shadow-lg hover:bg-orange-600 transition-transform active:scale-95">+ Log Incident</button>
                    <button onClick={() => setShowAddModal(true)} className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] shadow-sm transition-transform active:scale-95 ${darkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>+ Emp</button>
                </div>
            </div>

            {selectedEmp && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${darkMode ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-black'}`}>
                        <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <div>
                                <h3 className={`text-2xl font-black uppercase ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{selectedEmp.name}</h3>
                                <p className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Occurrences: <span className="text-red-500">{selectedEmp.totalOccurrences || 0}</span></p>
                            </div>
                            <div className="flex gap-2 items-center">
                                <button onClick={handleExportWord} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase shadow transition-colors">📄 Export Notice</button>
                                <button onClick={()=>handleDeleteEmployee(selectedEmp.id, selectedEmp.name)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-[10px] uppercase shadow transition-colors">Delete Employee</button>
                                <button onClick={()=>setSelectedEmp(null)} className="text-2xl text-slate-400 hover:text-red-500 ml-2">✕</button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className={`p-4 rounded-xl border mb-6 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-blue-50/50 border-blue-100'}`}>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-[#ef7c00]' : 'text-blue-800'}`}>Log New Incident</h4>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <select className={`p-2 border rounded font-bold text-xs outline-none focus:border-[#ef7c00] ${inputClass}`} value={incData.type} onChange={e=>setIncData({...incData, type:e.target.value})}><option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option><option>Vacation</option><option>Bereavement</option><option>Other</option></select>
                                    <input type="number" className={`p-2 border rounded font-bold text-xs outline-none focus:border-[#ef7c00] ${inputClass}`} placeholder="Count" value={incData.count} onChange={e=>setIncData({...incData, count:Number(e.target.value)})} />
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <input type="date" onClick={handleDateClick} className={`p-2 border rounded font-bold text-xs flex-grow cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={incData.date} onChange={e=>setIncData({...incData, date:e.target.value})} />
                                    <div className={`p-2 border rounded cursor-pointer font-bold text-xs flex items-center gap-2 transition-colors ${incData.docReceived?(darkMode?'bg-green-900/50 border-green-700 text-green-400':'bg-green-100 border-green-200 text-green-700'):inputClass}`} onClick={()=>setIncData({...incData, docReceived:!incData.docReceived})}><span>Doc?</span>{incData.docReceived && '✓'}</div>
                                </div>
                                <input className={`w-full p-2 border rounded font-bold text-xs mb-3 outline-none focus:border-[#ef7c00] ${inputClass}`} placeholder="Notes..." value={incData.notes} onChange={e=>setIncData({...incData, notes:e.target.value})} />
                                <button onClick={handleLogIncident} className="w-full py-3 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded font-black text-xs uppercase tracking-widest shadow-lg transition-colors">Add Record</button>
                            </div>
                            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incident History</h4>
                            <div className={`border rounded-xl overflow-hidden overflow-x-auto ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <table className="w-full text-left text-xs min-w-[400px]">
                                    <thead className={`font-black ${darkMode ? 'bg-slate-900 text-slate-400 border-b border-slate-700' : 'bg-slate-50 text-slate-500 border-b border-slate-200'}`}><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3 text-center">Pts</th><th className="p-3">Notes</th><th className="p-3 text-center">Action</th></tr></thead>
                                    <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                        {selectedEmp.incidents && selectedEmp.incidents.length > 0 ? selectedEmp.incidents.map((inc: any, i: number) => {
                                            const isOld = (new Date().getTime() - new Date(inc.date).getTime()) / (1000 * 60 * 60 * 24) > 365;
                                            return (
                                                <tr key={i} className={isOld ? (darkMode ? "bg-red-900/20 text-red-400 font-medium" : "bg-red-50 text-red-600 font-medium") : ""}>
                                                    <td className="p-3 font-mono">{inc.date} {isOld && <span className="text-[8px] font-black uppercase ml-1">(>1yr)</span>}</td>
                                                    <td className="p-3 font-bold">{inc.type}</td><td className="p-3 text-center font-black">{inc.count}</td><td className={`p-3 italic truncate max-w-[150px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{inc.notes}</td><td className="p-3 text-center"><button onClick={() => handleDeleteIncident(selectedEmp.id, inc)} className="text-red-500 hover:text-red-400 font-bold">🗑️</button></td>
                                                </tr>
                                            );
                                        }) : <tr><td colSpan={5} className={`p-4 text-center italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No history found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`p-6 rounded-2xl w-full max-w-sm shadow-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h3 className={`text-xl font-black mb-4 uppercase ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Add Employee</h3>
                        <input className={`w-full p-3 border-2 rounded-lg mb-4 font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} placeholder="Full Name (e.g. John Doe)" value={newEmpName} onChange={e=>setNewEmpName(e.target.value)} />
                        <div className="flex gap-2">
                            <button onClick={()=>setShowAddModal(false)} className={`flex-1 py-3 rounded-lg font-bold text-xs ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-black hover:bg-slate-200'}`}>Cancel</button>
                            <button onClick={handleAddEmployee} className="flex-1 py-3 bg-[#002d72] hover:bg-blue-800 text-white rounded-lg font-bold text-xs transition-colors">Add Employee</button>
                        </div>
                    </div>
                </div>
            )}

            {showIncidentModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`p-8 rounded-2xl w-full max-w-md shadow-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h3 className="text-2xl font-black text-[#ef7c00] mb-6 uppercase">Log Attendance</h3>
                        <label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Employee</label>
                        <select className={`w-full p-3 border-2 rounded-lg font-bold mb-4 outline-none focus:border-[#ef7c00] ${inputClass}`} value={selectedEmpId} onChange={e=>setSelectedEmpId(e.target.value)}><option value="">-- Select Employee --</option>{personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div><label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Type</label><select className={`w-full p-3 border-2 rounded-lg font-bold text-sm outline-none focus:border-[#ef7c00] ${inputClass}`} value={incData.type} onChange={e=>setIncData({...incData, type:e.target.value})}><option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option><option>Vacation</option><option>Bereavement</option><option>Other</option></select></div>
                            <div><label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Occurrences</label><input type="number" className={`w-full p-3 border-2 rounded-lg font-bold text-sm outline-none focus:border-[#ef7c00] ${inputClass}`} value={incData.count} onChange={e=>setIncData({...incData, count:Number(e.target.value)})} /></div>
                        </div>
                        <label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Date</label>
                        <input type="date" onClick={handleDateClick} className={`w-full p-3 border-2 rounded-lg font-bold mb-4 text-sm outline-none focus:border-[#ef7c00] cursor-pointer ${inputClass}`} value={incData.date} onChange={e=>setIncData({...incData, date:e.target.value})} />
                        <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg border cursor-pointer ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-blue-50 border-blue-100'}`} onClick={()=>setIncData({...incData, docReceived:!incData.docReceived})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${incData.docReceived ? 'bg-[#ef7c00] border-[#ef7c00] text-white' : (darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300')}`}>{incData.docReceived && '✓'}</div><span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-blue-800'}`}>Documentation Received?</span></div>
                        <textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-6 font-medium text-sm outline-none focus:border-[#ef7c00] ${inputClass}`} placeholder="Additional notes..." value={incData.notes} onChange={e=>setIncData({...incData, notes:e.target.value})} />
                        <div className="flex gap-4"><button onClick={()=>setShowIncidentModal(false)} className={`w-1/3 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-black hover:bg-slate-200'}`}>Cancel</button><button onClick={handleLogIncident} className="w-2/3 py-3 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded-xl font-black uppercase text-xs shadow-lg transition-colors">Save Record</button></div>
                    </div>
                </div>
            )}

            {viewMode === 'dashboard' && (
                <div className="space-y-6 overflow-y-auto pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div onClick={()=>jumpToLog('All')} className={`p-6 rounded-2xl shadow-sm border cursor-pointer transition-all hover:-translate-y-1 ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-[#ef7c00]' : 'bg-white border-slate-200 hover:border-[#002d72] hover:bg-blue-50'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Occurrences</p>
                            <p className={`text-4xl font-black ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{stats.totalOccurrences}</p>
                        </div>
                        <div onClick={()=>jumpToLog('All')} className={`p-6 rounded-2xl shadow-sm border cursor-pointer transition-all hover:-translate-y-1 ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-[#ef7c00]' : 'bg-white border-slate-200 hover:border-[#002d72] hover:bg-blue-50'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Employees Tracked</p>
                            <p className={`text-4xl font-black ${darkMode ? 'text-white' : 'text-slate-700'}`}>{personnel.length}</p>
                        </div>
                        <div className={`p-6 rounded-2xl shadow-sm border ${bgClass}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incidents by Type</p>
                            <div className="space-y-1">
                                {Object.entries(stats.typeCounts).slice(0,3).map(([k,v]) => (
                                    <div key={k} onClick={()=>jumpToLog(k)} className={`flex justify-between text-xs font-bold cursor-pointer transition-colors ${darkMode ? 'text-slate-300 hover:text-[#ef7c00]' : 'text-slate-600 hover:text-[#ef7c00]'}`}>
                                        <span>{k}</span><span>{v as React.ReactNode}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className={`rounded-2xl shadow-sm border overflow-hidden ${bgClass}`}>
                            <div className={`p-4 border-b ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <h3 className={`text-xs font-black uppercase tracking-widest ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Monthly Incident Summary</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className={`font-black uppercase border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-200'}`}>
                                        <tr><th className="p-3">Month</th><th className="p-3 text-right">Sick</th><th className="p-3 text-right">FMLA</th><th className="p-3 text-right">No Show</th><th className="p-3 text-right">Total</th></tr>
                                    </thead>
                                    <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-50'}`}>
                                        {stats.monthNames.map(month => { 
                                            const data = stats.monthlyCounts[month] || {}; 
                                            if (!data.Total) return null; 
                                            return (
                                                <tr key={month} className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                                                    <td className="p-3 font-bold">{month}</td>
                                                    <td className="p-3 text-right font-mono text-orange-500">{data['Sick'] || 0}</td>
                                                    <td className="p-3 text-right font-mono text-blue-500">{data['FMLA'] || 0}</td>
                                                    <td className="p-3 text-right font-mono text-red-500">{(data['No Call/No Show'] || 0) + (data['Failure to Report'] || 0)}</td>
                                                    <td className="p-3 text-right font-black">{data.Total || 0}</td>
                                                </tr>
                                            ); 
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[400px] ${bgClass}`}>
                            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <h3 className={`text-xs font-black uppercase tracking-widest ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Employee Roster</h3>
                                <input type="text" placeholder="Search Name..." className={`text-xs p-2 border rounded w-32 font-bold outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={rosterSearch} onChange={e=>setRosterSearch(e.target.value)} />
                            </div>
                            <div className="overflow-y-auto flex-grow custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className={`font-black uppercase border-b sticky top-0 z-10 ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                        <tr><th className="p-3">Employee Name</th><th className="p-3 text-right">Count</th></tr>
                                    </thead>
                                    <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                        {filteredRoster.map(emp => (
                                            <tr key={emp.id} onClick={() => setSelectedEmp(emp)} className={`cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}>
                                                <td className="p-3 font-bold">{emp.name}</td>
                                                <td className={`p-3 text-right font-black ${emp.totalOccurrences > 5 ? 'text-red-500' : ''}`}>{emp.totalOccurrences}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'log' && (
                <div className={`rounded-2xl shadow-lg border flex-grow overflow-hidden flex flex-col ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className={`p-4 border-b flex gap-4 flex-wrap ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <input className={`p-2 border rounded font-bold text-xs flex-grow min-w-[150px] outline-none focus:border-[#ef7c00] ${inputClass}`} placeholder="Search Employee..." value={logFilter.search} onChange={e=>setLogFilter({...logFilter, search:e.target.value})} />
                        <select className={`p-2 border rounded font-bold text-xs outline-none focus:border-[#ef7c00] ${inputClass}`} value={logFilter.type} onChange={e=>setLogFilter({...logFilter, type:e.target.value})}><option value="All">All Types</option><option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option><option>Vacation</option><option>Bereavement</option><option>Other</option></select>
                    </div>
                    <div className="overflow-x-auto flex-grow custom-scrollbar">
                        <div className={`min-w-[700px] border-b p-3 grid grid-cols-12 gap-2 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <div className="col-span-3 cursor-pointer flex items-center hover:text-[#ef7c00] transition-colors" onClick={() => requestSort('employeeName')}>Employee Name <SortArrow columnKey="employeeName" /></div>
                            <div className="col-span-2 cursor-pointer flex items-center hover:text-[#ef7c00] transition-colors" onClick={() => requestSort('type')}>Incident Type <SortArrow columnKey="type" /></div>
                            <div className="col-span-2 cursor-pointer flex items-center hover:text-[#ef7c00] transition-colors" onClick={() => requestSort('date')}>Date <SortArrow columnKey="date" /></div>
                            <div className="col-span-1 text-center cursor-pointer flex items-center justify-center hover:text-[#ef7c00] transition-colors" onClick={() => requestSort('count')}>Count <SortArrow columnKey="count" /></div>
                            <div className="col-span-1 text-center cursor-pointer flex items-center justify-center hover:text-[#ef7c00] transition-colors" onClick={() => requestSort('docReceived')}>Doc? <SortArrow columnKey="docReceived" /></div>
                            <div className="col-span-2 flex items-center">Notes</div>
                            <div className="col-span-1 text-center flex items-center justify-center">Action</div>
                        </div>
                        <div className={`min-w-[700px] divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {filteredLog.length === 0 ? <div className={`p-10 text-center italic font-bold ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>No records found.</div> : filteredLog.map((log, i) => (
                                <div key={i} className={`grid grid-cols-12 gap-2 p-3 items-center transition-colors text-xs ${darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-blue-50 text-slate-700'}`}>
                                    <div className={`col-span-3 font-bold cursor-pointer hover:underline ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`} onClick={() => setSelectedEmp(personnel.find(p => p.id === log.employeeId))}>{log.employeeName}</div>
                                    <div className="col-span-2 font-medium"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${log.type==='Sick'?'bg-orange-500/20 text-orange-500':log.type==='FMLA'?'bg-blue-500/20 text-blue-500':'bg-red-500/20 text-red-500'}`}>{log.type}</span></div>
                                    <div className="col-span-2 font-mono">{log.date}</div>
                                    <div className="col-span-1 text-center font-black">{log.count}</div>
                                    <div className="col-span-1 text-center">{log.docReceived ? '✅' : '❌'}</div>
                                    <div className="col-span-2 truncate italic opacity-70">{log.notes || '-'}</div>
                                    <div className="col-span-1 text-center"><button onClick={() => handleDeleteIncident(log.employeeId, log)} className="text-red-500 hover:text-red-400 font-bold">🗑️</button></div>
                                </div>
                            ))}
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
                <div className="flex items-center gap-3 w-full max-w-lg"><button onClick={() => setIsLargeText(!isLargeText)} className={`h-12 w-12 flex items-center justify-center rounded-2xl border-2 font-black transition-all ${isLargeText ? 'bg-[#002d72] border-[#002d72] text-white' : inputClass}`}>Aa</button><input type="text" placeholder="Search Part #..." className={`w-full p-4 rounded-2xl font-bold border-2 outline-none focus:border-[#ef7c00] transition-colors shadow-sm ${inputClass}`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            </div>
            <div className={`rounded-3xl shadow-xl border flex-grow overflow-hidden flex flex-col relative ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="bg-[#002d72] grid grid-cols-12 gap-4 p-5 text-[10px] font-black uppercase text-white tracking-widest select-none"><div className="col-span-3">Part Number</div><div className="col-span-8">Description</div><div className="col-span-1 text-center">View</div></div>
                <div className="overflow-y-auto flex-grow custom-scrollbar"><div className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>{filteredParts.map((p: any, i: number) => (<div key={i} className={`grid grid-cols-12 gap-4 p-4 transition-colors items-center ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}><div onClick={() => { navigator.clipboard.writeText(p.partNumber); showToast(`Copied!`, 'success'); }} className={`col-span-3 font-mono font-black rounded-lg cursor-pointer transition-all shadow-sm ${darkMode ? 'bg-slate-900 text-[#ef7c00]' : 'bg-blue-50 text-[#002d72]'} ${isLargeText ? 'text-xl px-4 py-2' : 'text-sm px-3 py-1'}`}>{p.partNumber}</div><div className={`col-span-8 font-bold uppercase flex items-center ${darkMode ? 'text-slate-200' : 'text-slate-700'} ${isLargeText ? 'text-lg leading-normal' : 'text-[11px] leading-tight'}`}>{p.name}</div><div className="col-span-1 flex justify-center"><a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} target="_blank" rel="noopener noreferrer" className={`text-[#ef7c00] hover:scale-125 transition-transform ${isLargeText ? 'text-2xl' : 'text-lg'}`}>👁️</a></div></div>))}</div></div>
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><div className="flex justify-between items-center mb-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Admin</p><button onClick={handleResetMetrics} disabled={isResetting} className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase border border-red-200 rounded px-2 py-1 bg-red-50 disabled:opacity-50 transition-colors">{isResetting ? "..." : "Wipe All Databases"}</button></div><div className="space-y-2">{shopQueens.map((queen, i) => (<div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1"><span className="font-bold text-slate-700">#{queen.number}</span><span className="font-mono text-red-500">{queen.count} logs</span></div>))}</div></div>
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
        const todayStr = new Date().toISOString().split('T')[0];
        if (formData.oosStartDate) {
            if (formData.oosStartDate > todayStr) return showToast("Out of Service date cannot be a future date", 'error');
            if (formData.expectedReturnDate && formData.expectedReturnDate < formData.oosStartDate) return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            if (formData.actualReturnDate && formData.actualReturnDate < formData.oosStartDate) return showToast("Actual Return cannot be earlier than OOS Date", 'error');
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
                    {isAdmin && <button type="button" onClick={resetAllFleet} className="px-3 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all bg-red-600 hover:bg-red-700 text-white shadow-md">🚨 Reset Fleet</button>}
                    {isAdmin && <button type="button" onClick={populateFleet} className={`px-3 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest border transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[#002d72]'}`}>⚙️ Init Fleet</button>}
                    <button type="button" onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-black uppercase text-[10px] tracking-widest shadow-md transition-all">+ Add Bus</button>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <input type="text" placeholder="Unit # to Update" className={`p-4 border-2 rounded-xl font-black outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.number} onChange={handleChange} name="number" required />
                    <select className={`p-4 border-2 rounded-xl font-bold outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.status} onChange={handleChange} name="status">
                        <option value="Active">Ready for Service</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option>
                        {statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}
                    </select>
                </div>
                <input type="text" placeholder="Location" className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.location} onChange={handleChange} name="location" />
                <textarea placeholder="Maintenance Notes" className={`w-full p-4 border-2 rounded-xl h-24 outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.notes} onChange={handleChange} name="notes" />
                <div className="grid grid-cols-3 gap-4">
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>OOS Date</label><input name="oosStartDate" type="date" onClick={handleDateClick} max={new Date().toISOString().split('T')[0]} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.oosStartDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exp Return</label><input name="expectedReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.expectedReturnDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Act Return</label><input name="actualReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.actualReturnDate} onChange={handleChange} /></div>
                </div>
                <button className="w-full py-4 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest transition-transform active:scale-95 shadow-lg">Update Record</button>
            </form>

            {showAddModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`p-8 rounded-xl shadow-2xl w-full max-w-md border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h3 className={`text-2xl font-black mb-6 uppercase italic ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Add New Bus</h3>
                        <form onSubmit={handleAddNewBus} className="space-y-4">
                            <div><label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Unit Number *</label><input type="text" className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.number} onChange={e => setNewBusData({...newBusData, number: e.target.value})} required placeholder="e.g., 2001" /></div>
                            <div><label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Initial Status</label><select className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.status} onChange={e => setNewBusData({...newBusData, status: e.target.value})}><option value="Active">Ready for Service</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option>{statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}</select></div>
                            <div className="flex gap-4 mt-8"><button type="button" onClick={() => setShowAddModal(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-black hover:bg-slate-200'} transition-colors`}>Cancel</button><button type="submit" className="w-1/2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase text-xs shadow-lg transition-transform active:scale-95">Save Bus</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function FleetManager() {
    const [user, setUser] = useState<any>(null);
    const [isSignUp, setIsSignUp] = useState(false);
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
        if (ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) { setUserStatus('approved'); setUserRole('admin'); return; }
        return onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                setUserStatus(docSnap.data().status || 'pending');
                setUserRole(docSnap.data().role || 'user');
            } else {
                setDoc(doc(db, "users", user.uid), { email: user.email?.toLowerCase() || '', status: 'pending', role: 'user', createdAt: serverTimestamp() });
                setUserStatus('pending'); setUserRole('user');
            }
        });
    }, [user]);

    useEffect(() => { 
        if (!user || userStatus !== 'approved') return; 
        const uBuses = onSnapshot(query(collection(db, "buses"), orderBy("number", "asc")), s => setBuses(s.docs.map(d => ({...d.data(), docId: d.id})))); 
        const uOpts = onSnapshot(doc(db, "settings", "status_options"), s => { if(s.exists()) setStatusOptions(s.data().list || []); });
        return () => { uBuses(); uOpts(); };
    }, [user, userStatus]);

    const getStatusType = (label: string) => {
        const opt = statusOptions.find(o => o.label === label);
        return opt ? opt.type : (label === 'Active' ? 'ready' : (['In Shop','Engine','Body Shop','Brakes'].includes(label) ? 'shop' : 'hold'));
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
        if (activeFilter === 'Hold') return getStatusType(b.status) === 'hold';
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

    if (!user) return (
        <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
            <div className="flex-grow flex items-center justify-center p-4">
                <form onSubmit={handleAuth} className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-[#ef7c00] animate-in fade-in zoom-in">
                    <h2 className="text-3xl font-black text-white italic mb-8 uppercase text-center">{isSignUp ? 'Join Fleetflow' : 'Fleet Operations'}</h2>
                    <input className="w-full p-4 mb-4 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold outline-none focus:border-[#ef7c00] transition-colors" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
                    <input className="w-full p-4 mb-6 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold outline-none focus:border-[#ef7c00] transition-colors" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
                    <button className="w-full py-5 bg-[#ef7c00] text-white font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-orange-600 transition-colors">{isSignUp ? 'Register' : 'Login'}</button>
                    <button type="button" onClick={()=>setIsSignUp(!isSignUp)} className="w-full mt-6 text-slate-400 text-xs font-bold hover:text-white transition-colors">{isSignUp ? 'Back to Login' : "Don't have an account? Sign Up"}</button>
                </form>
            </div>
            <Footer onShowLegal={setLegalType} darkMode={true} />
        </div>
    );

    if (userStatus === 'pending' || userStatus === 'rejected') return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center font-sans">
            <div className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-red-500 animate-in zoom-in-95">
                <h2 className="text-3xl font-black uppercase italic mb-4">Access Restricted</h2>
                <p className="opacity-50 font-bold mb-8">Account pending administrator approval.</p>
                <button onClick={()=>signOut(auth)} className="w-full py-4 bg-[#002d72] rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-colors">Sign Out</button>
            </div>
            <div className="absolute bottom-0 w-full"><Footer onShowLegal={setLegalType} darkMode={true} /></div>
        </div>
    );

    return (
        <div className={`flex flex-col min-h-screen font-sans selection:bg-[#ef7c00] selection:text-white transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
            {selectedBusDetail && (<div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={showToast} darkMode={darkMode} isAdmin={isAdmin} statusOptions={statusOptions} /></div>)}
            {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} darkMode={darkMode} />}

            <nav className={`backdrop-blur-md border-b sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm overflow-x-auto ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
                <div className="flex items-center gap-2 flex-shrink-0"><div className="w-2 h-6 bg-[#ef7c00] rounded-full"></div><span className="font-black text-lg italic uppercase tracking-tighter">Fleet Manager</span></div>
                <div className="flex gap-4 items-center flex-nowrap">
                    {['inventory', 'input', 'tracker', 'handover', 'parts'].concat(isAdmin ? ['analytics', 'personnel', 'admin'] : []).map(v => (
                        <button key={v} onClick={()=>setView(v as any)} className={`text-[9px] font-black uppercase tracking-widest border-b-2 pb-1 transition-all whitespace-nowrap ${view === v ? 'border-[#ef7c00] text-[#ef7c00]' : (darkMode ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-[#002d72]')}`}>{v.replace('admin','panel').replace('input', 'Data Entry').replace('parts', 'Parts List')}</button>
                    ))}
                    <button onClick={()=>setDarkMode(!darkMode)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${darkMode ? 'bg-slate-800 text-yellow-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
                    <button onClick={exportExcel} className={`text-[10px] font-black uppercase whitespace-nowrap transition-colors ${darkMode ? 'text-green-400 hover:text-green-300' : 'text-[#002d72] hover:text-[#ef7c00]'}`}>Excel</button>
                    <button onClick={()=>signOut(auth)} className="text-red-500 font-black text-[10px] uppercase whitespace-nowrap hover:text-red-400 transition-colors">Logout</button>
                </div>
            </nav>

            <main className="flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-6 overflow-x-hidden">
                {view === 'admin' ? <AccessManager showToast={showToast} darkMode={darkMode} /> :
                 view === 'input' ? <BusInputForm showToast={showToast} darkMode={darkMode} buses={buses} isAdmin={isAdmin} statusOptions={statusOptions} /> :
                 view === 'analytics' ? <div className="space-y-10 animate-in fade-in duration-500"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={showToast} /></div> :
                 view === 'parts' ? <PartsInventory showToast={showToast} darkMode={darkMode} /> :
                 view === 'handover' ? <ShiftHandover buses={buses} showToast={showToast} /> :
                 view === 'personnel' ? <PersonnelManager showToast={showToast} darkMode={darkMode} /> :
                 view === 'tracker' ? <div className={`h-[85vh] rounded-2xl border shadow-sm overflow-hidden relative ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}><BusTracker /></div> : (
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
                                    <div key={l} onClick={()=>setActiveFilter(l==='Total'?'Total Fleet':l)} className={`cursor-pointer p-5 rounded-2xl border shadow-sm transition-all hover:-translate-y-1 ${activeFilter === (l==='Total'?'Total Fleet':l) ? (darkMode ? 'border-[#ef7c00] bg-slate-800' : 'border-[#002d72] bg-blue-50') : (darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white')}`}>
                                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{l}</p>
                                        <p className={`text-3xl font-black ${l==='Ready'?'text-green-500':l==='In Shop'?'text-orange-500':l==='Hold'?'text-red-500':(darkMode ? 'text-white' : 'text-slate-900')}`}>{count}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                            <input className={`w-full max-w-md p-3 rounded-lg border-2 font-bold outline-none transition-colors focus:border-[#ef7c00] ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-slate-400'}`} placeholder="Search Unit #..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                            <div className={`flex w-full md:w-auto gap-2 p-1 border rounded-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                {['list', 'grid', 'tv'].map(m => <button key={m} onClick={()=>setInventoryMode(m as any)} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${inventoryMode === m ? 'bg-[#ef7c00] text-white shadow-md' : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>{m}</button>)}
                                {inventoryMode === 'tv' && <button onClick={toggleFullScreen} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all flex items-center justify-center gap-1 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]'}`}>⛶ Fullscreen</button>}
                            </div>
                        </div>
                        
                        <div className={`rounded-3xl border shadow-xl overflow-hidden min-h-[500px] ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            {inventoryMode === 'tv' && (
                                <div ref={tvBoardRef} className={`p-4 sm:p-6 overflow-y-auto custom-scrollbar min-h-[75vh] h-full ${isFullscreen ? (darkMode ? 'bg-slate-900' : 'bg-slate-100') : ''}`}>
                                    {isFullscreen && (
                                        <div className={`flex justify-between items-end mb-6 border-b-2 pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                                            <div><h2 className="text-5xl font-black uppercase tracking-tighter text-[#ef7c00]">Fleet Status Board</h2><p className={`text-xl font-bold mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Units: {buses.length} | Down: <span className="text-red-500">{buses.filter(b=>b.status!=='Active').length}</span></p></div>
                                            <button onClick={toggleFullScreen} className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-2xl transition-all transform active:scale-95">Exit Fullscreen</button>
                                        </div>
                                    )}
                                    <div className={`grid gap-4 sm:gap-6 pb-20 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                                        {sortedBuses.map(b => {
                                            const type = getStatusType(b.status);
                                            const color = type==='ready'?'text-green-500':type==='shop'?'text-orange-500':'text-red-500';
                                            const borderColor = type==='ready'?'border-green-500':type==='shop'?'border-orange-500':'border-red-600';
                                            return (
                                                <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`cursor-pointer p-4 rounded-xl flex flex-col justify-between border-[3px] shadow-md transition-transform hover:scale-105 ${borderColor} ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                                                    <div className="flex justify-between items-start mb-3"><span className={`text-4xl font-black leading-none tracking-tighter ${color}`}>#{b.number}</span><span className={`w-fit px-2 py-1 rounded text-xs font-black uppercase tracking-wider shadow-sm text-white ${type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-600'}`}>{b.status}</span></div>
                                                    <div className={`text-sm font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>📍 {b.location || 'Location Unavailable'}</div>
                                                    <div className={`text-xs font-bold leading-snug mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{b.notes || 'No active faults recorded.'}</div>
                                                    <div className="mt-auto pt-2">{b.status !== 'Active' && <div className={`text-xs font-black text-white rounded px-2 py-1.5 text-center tracking-widest shadow-inner ${type==='shop'?'bg-orange-600':'bg-red-600'}`}>DOWN {calculateDaysOOS(b.oosStartDate)} DAYS</div>}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {inventoryMode === 'grid' && (
                                <div className={`p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${darkMode ? 'bg-slate-900' : 'bg-slate-50/50'}`}>
                                    {sortedBuses.map(b => {
                                        const type = getStatusType(b.status);
                                        const borderColor = type==='ready'?(darkMode?'border-green-600/50':'border-green-200'):type==='shop'?(darkMode?'border-orange-600/50':'border-orange-300'):(darkMode?'border-red-600/50':'border-red-200');
                                        const hoverBorder = type==='ready'?'hover:border-green-400':type==='shop'?'hover:border-orange-400':'hover:border-red-400';
                                        return (
                                            <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`cursor-pointer p-4 rounded-2xl border-2 flex flex-col shadow-sm transition-all hover:-translate-y-1 ${borderColor} ${hoverBorder} ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                                                <div className="flex justify-between items-start mb-3"><span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>#{b.number}</span><span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest text-white ${type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-500'}`}>{b.status}</span></div>
                                                <div className={`flex items-center gap-1 text-xs font-bold mb-2 truncate ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>📍 {b.location || 'Location Unavailable'}</div>
                                                <div className={`text-[10px] italic line-clamp-2 mb-3 h-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🔧 {b.notes || 'No active faults recorded.'}</div>
                                                {b.status !== 'Active' && <div className={`mt-auto text-[10px] font-black text-white p-1.5 rounded-lg text-center shadow-inner tracking-widest ${type==='shop'?'bg-orange-500 border border-orange-600':'bg-red-600 border border-red-700'}`}>⏱️ DOWN {calculateDaysOOS(b.oosStartDate)} DAYS</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {inventoryMode === 'list' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className={`font-black uppercase text-[10px] tracking-widest border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                            <tr><th className="p-4 cursor-pointer hover:text-[#ef7c00] transition-colors" onClick={()=>requestSort('number')}>Unit #</th><th className="p-4">Status</th><th className="p-4">Location</th><th className="p-4">Notes</th><th className="p-4 cursor-pointer hover:text-[#ef7c00] transition-colors" onClick={()=>requestSort('daysOOS')}>Days OOS</th></tr>
                                        </thead>
                                        <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                            {sortedBuses.map(b => {
                                                const type = getStatusType(b.status);
                                                return (
                                                    <tr key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}>
                                                        <td className="p-4 font-black text-lg">#{b.number}</td>
                                                        <td className="p-4"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase text-white ${type==='ready'?'bg-green-500':type==='shop'?'bg-orange-500':'bg-red-500'}`}>{b.status}</span></td>
                                                        <td className="p-4 font-bold text-xs">{b.location || '-'}</td>
                                                        <td className="p-4 italic text-xs opacity-70">{b.notes || '-'}</td>
                                                        <td className={`p-4 font-black ${type==='shop'?'text-orange-500':type==='hold'?'text-red-500':''}`}>{b.status !== 'Active' ? calculateDaysOOS(b.oosStartDate) : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                 )}
            </main>
            {view !== 'input' && view !== 'admin' && view !== 'personnel' && view !== 'analytics' && <Footer onShowLegal={setLegalType} darkMode={darkMode} />}
        </div>
    );
}