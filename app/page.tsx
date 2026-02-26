"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, addDoc, deleteDoc, getDoc, getDocs, limit, writeBatch, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

import localParts from './partsData.json';

// --- FLEET DATA FROM PDF ---
const HAMILTON_FLEET = [
  "1625","1628","1629","1631","1632","1633","1634","1635","1636","1637","1638","1639","1640","1641","1642","1643","1644","1645","1646","1647","1648","1660",
  "1802","1803","1804","1805","1806","1807","1808","1809","1810","1811","1812","1813","1815","1817","1818","1819","1820","1821","1822","1823","1824","1826","1827","1828","1829","1830","1831","1832","1833","1834","1835","1836","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1850","1851","1852","1853","1854","1855","1856","1858","1859","1860","1861","1862","1863","1864","1865","1867","1868","1870","1871","1872","1873","1874","1875","1876","1877","1878","1879","1880","1881","1883","1884","1885","1887","1888","1889","1895",
  "1909","1912","1913","1921","1922","1923","1924","1925","1926","1927","1928","1929","1930","1931","1932","1933","1935","1951","1958","1959",
  "7021","7022","7023","7024","7025","7026","7027","7028","7029","7030","7031","7033",
  "7092","7093","7094","7095","7096","7097","7098","7099",
  "7102","7103","7104","7105",
  "1406","1408","1434","1440",
  "2326","2343",
  "2593"
];

// --- MASTER ADMIN EMAILS ---
const ADMIN_EMAILS = ['anetowestfield@gmail.com', 'admin@fleetflow.services'];

// --- DYNAMIC IMPORTS ---
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

// --- HELPER COMPONENTS ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-[8000] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 border-l-8 ${type === 'success' ? 'bg-white border-green-500 text-slate-800' : 'bg-white border-red-500 text-slate-800'}`}>
            <span className="text-2xl">{type === 'success' ? '✅' : '📋'}</span>
            <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{type === 'success' ? 'Success' : 'Notice'}</p><p className="text-sm font-bold text-slate-800">{message}</p></div>
        </div>
    );
};

const LegalModal = ({ type, onClose, darkMode }: { type: 'privacy'|'about', onClose: ()=>void, darkMode: boolean }) => {
    const title = type === 'privacy' ? 'Privacy Policy' : 'About Us';
    const content = type === 'privacy' 
        ? "LLC Fleetflow Transit Solutions values your privacy. We collect minimal data necessary for internal fleet management, diagnostic tracking, and attendance coordination. We do not sell or share your data with unauthorized third parties. All data is securely handled via industry-standard encrypted databases."
        : "LLC Fleetflow Transit Solutions is dedicated to modernizing fleet operations. Our management systems provide real-time tracking, inventory analytics, and seamless personnel coordination to keep your transit systems moving safely and efficiently. Built for reliability and high visibility on the shop floor.";
    
    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className={`p-8 rounded-2xl w-full max-w-lg shadow-2xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-500/20">
                    <h3 className={`text-2xl font-black uppercase italic ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{title}</h3>
                    <button onClick={onClose} className="text-2xl font-bold hover:text-red-500 transition-colors">✕</button>
                </div>
                <p className="font-medium leading-relaxed text-sm opacity-90">{content}</p>
                <button onClick={onClose} className="mt-8 w-full py-3 bg-[#002d72] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#ef7c00] transition-colors shadow-lg">Acknowledge & Close</button>
            </div>
        </div>
    );
};

const Footer = ({ onShowLegal, darkMode }: { onShowLegal: (type: 'privacy'|'about')=>void, darkMode?: boolean }) => (
    <div className={`w-full py-6 text-center text-[10px] font-bold tracking-widest uppercase mt-auto border-t ${darkMode ? 'border-slate-800 text-slate-500 bg-slate-900' : 'border-slate-200 text-slate-400 bg-slate-100'}`}>
        <p>© {new Date().getFullYear()} LLC Fleetflow Transit Solutions.</p>
        <div className="flex justify-center gap-6 mt-3">
            <button onClick={() => onShowLegal('privacy')} className={`transition-colors ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>Privacy Policy</button>
            <button onClick={() => onShowLegal('about')} className={`transition-colors ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>About Us</button>
        </div>
    </div>
);

// --- UTILITY FUNCTIONS ---
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

// --- COMPONENT DEFINITIONS ---

const BusDetailView = ({ bus, onClose, showToast, darkMode }: { bus: any; onClose: () => void; showToast: (m:string, t:'success'|'error')=>void, darkMode: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
    const [editData, setEditData] = useState({ status: bus.status || 'Active', location: bus.location || '', notes: bus.notes || '', oosStartDate: bus.oosStartDate || '', expectedReturnDate: bus.expectedReturnDate || '', actualReturnDate: bus.actualReturnDate || '' });
    
    useEffect(() => { if (showHistory) return onSnapshot(query(collection(db, "buses", bus.number, "history"), orderBy("timestamp", "desc")), (snap) => setHistoryLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); }, [showHistory, bus.number]);
    
    const handleSave = async () => {
        if (editData.oosStartDate) {
            const oos = new Date(editData.oosStartDate);
            if (editData.expectedReturnDate && new Date(editData.expectedReturnDate) < oos) {
                return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            }
            if (editData.actualReturnDate && new Date(editData.actualReturnDate) < oos) {
                return showToast("Actual Return cannot be earlier than OOS Date", 'error');
            }
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

    const handleDateClick = (e: React.MouseEvent<HTMLInputElement>) => {
        if ('showPicker' in HTMLInputElement.prototype) {
            (e.currentTarget as any).showPicker();
        }
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';
    const statusColorText = bus.status === 'Active' ? 'text-green-600' : bus.status === 'In Shop' ? 'text-orange-500' : 'text-red-600';
    const statusColorBadge = bus.status === 'Active' ? 'bg-green-500' : bus.status === 'In Shop' ? 'bg-orange-500' : 'bg-red-500';

    if (showHistory) return (<div className={`p-6 rounded-xl shadow-2xl w-full max-w-lg h-[600px] flex flex-col animate-in zoom-in-95 border ${bgClass}`}><div className={`flex justify-between items-center mb-4 border-b pb-4 font-black uppercase ${statusColorText}`}><span>History: #{bus.number}</span><button onClick={()=>setShowHistory(false)} className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Back</button></div><div className="flex-grow overflow-y-auto space-y-3">{historyLogs.map(l => (<div key={l.id} className={`p-3 rounded-lg border relative group ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}><div className={`flex justify-between text-[8px] font-black uppercase mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><span>{l.action}</span><span>{formatTime(l.timestamp)}</span></div><p className={`text-xs font-bold whitespace-pre-wrap leading-tight ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{l.details}</p><button onClick={() => handleDeleteLog(l.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">DELETE</button></div>))}</div></div>);
    if (isEditing) return (<div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}><h3 className={`text-2xl font-black mb-6 uppercase italic ${statusColorText}`}>Edit Bus #{bus.number}</h3><div className="grid grid-cols-2 gap-4 mb-4"><select className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.status} onChange={e=>setEditData({...editData, status:e.target.value})}><option value="Active">Ready</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option></select><input className={`p-3 border-2 rounded-lg font-bold ${inputClass}`} value={editData.location} onChange={e=>setEditData({...editData, location:e.target.value})} placeholder="Location" /></div><textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-4 font-bold ${inputClass}`} value={editData.notes} onChange={e=>setEditData({...editData, notes:e.target.value})} placeholder="Maintenance Notes" /><div className={`grid grid-cols-3 gap-4 mb-6 text-[9px] font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}><div>OOS Date<input type="date" onClick={handleDateClick} className={`w-full p-2 border rounded mt-1 font-bold cursor-pointer ${inputClass}`} value={editData.oosStartDate} onChange={e=>setEditData({...editData, oosStartDate:e.target.value})} /></div><div>Exp Return<input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold cursor-pointer ${inputClass}`} value={editData.expectedReturnDate} onChange={e=>setEditData({...editData, expectedReturnDate:e.target.value})} /></div><div>Act Return<input type="date" onClick={handleDateClick} min={editData.oosStartDate} className={`w-full p-2 border rounded mt-1 font-bold cursor-pointer ${inputClass}`} value={editData.actualReturnDate} onChange={e=>setEditData({...editData, actualReturnDate:e.target.value})} /></div></div><div className="flex gap-4"><button onClick={()=>setIsEditing(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-black'}`}>Cancel</button><button onClick={handleSave} className="w-1/2 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg">Save Changes</button></div></div>);
    return (
        <div className={`p-8 rounded-xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 border ${bgClass}`}>
            <div className="flex justify-between items-start mb-6 border-b border-slate-500/20 pb-4">
                <div><h3 className={`text-4xl font-black italic uppercase ${statusColorText}`}>Bus #{bus.number}</h3><span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white ${statusColorBadge}`}>{bus.status}</span></div>
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

// --- DEDICATED ADMIN PANEL FOR USER APPROVALS ---
const AccessManager = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
    const [usersList, setUsersList] = useState<any[]>([]);
    
    useEffect(() => {
        return onSnapshot(collection(db, "users"), snap => {
            setUsersList(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
    }, []);

    const toggleApproval = async (uid: string, current: string) => {
        const newStatus = current === 'approved' ? 'pending' : 'approved';
        try {
            await updateDoc(doc(db, "users", uid), { status: newStatus });
            showToast(`User status updated to ${newStatus}`, 'success');
        } catch(err) {
            showToast("Failed to update status", 'error');
        }
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-6 flex-wrap gap-2">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Admin Panel</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage Registration Access</p>
                </div>
            </div>
            
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${bgClass}`}>
                <table className="w-full text-left text-sm">
                    <thead className={`font-black uppercase tracking-widest text-[10px] border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        <tr>
                            <th className="p-4">User Email</th>
                            <th className="p-4 text-center">Current Status</th>
                            <th className="p-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {usersList.length === 0 ? <tr><td colSpan={3} className="p-10 text-center italic text-slate-500">No users found.</td></tr> : usersList.map(u => (
                            <tr key={u.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}>
                                <td className="p-4 font-bold">{u.email}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'approved' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={()=>toggleApproval(u.id, u.status)} 
                                        className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 shadow-md ${u.status === 'approved' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                    >
                                        {u.status === 'approved' ? 'Revoke Access' : 'Approve Access'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- PERSONNEL MANAGER ---
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

    useEffect(() => { 
        return onSnapshot(query(collection(db, "personnel"), orderBy("name")), (snap) => {
            setPersonnel(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        }); 
    }, []);

    const handleDateClick = (e: React.MouseEvent<HTMLInputElement>) => {
        if ('showPicker' in HTMLInputElement.prototype) {
            (e.currentTarget as any).showPicker();
        }
    };

    const allIncidents = useMemo(() => {
        let logs: any[] = [];
        personnel.forEach(p => { 
            if (p.incidents) { 
                p.incidents.forEach((inc: any) => { logs.push({ ...inc, employeeName: p.name, employeeId: p.id }); }); 
            } 
        });
        return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [personnel]);

    const stats = useMemo(() => {
        const typeCounts: {[key: string]: number} = {}; 
        const monthlyCounts: {[key: string]: {[key: string]: number}} = {}; 
        let totalOccurrences = 0;
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        allIncidents.forEach(inc => {
            const c = parseInt(inc.count) || 1; 
            totalOccurrences += c; 
            typeCounts[inc.type] = (typeCounts[inc.type] || 0) + c;
            if (inc.date) {
                const month = monthNames[new Date(inc.date).getMonth()];
                if (!monthlyCounts[month]) monthlyCounts[month] = { Total: 0, Sick: 0, FMLA: 0, "No Call/No Show": 0, "Other": 0 };
                if(inc.type === 'Sick' || inc.type === 'Late Reporting') monthlyCounts[month]['Sick'] += c; 
                else if(inc.type === 'FMLA') monthlyCounts[month]['FMLA'] += c; 
                else if(inc.type === 'No Call/No Show' || inc.type === 'Failure to Report') monthlyCounts[month]['No Call/No Show'] += c; 
                else monthlyCounts[month]['Other'] += c;
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

    const filteredRoster = useMemo(() => { 
        if (!rosterSearch) return stats.topOffenders; 
        return stats.topOffenders.filter(p => p.name.toLowerCase().includes(rosterSearch.toLowerCase())); 
    }, [stats.topOffenders, rosterSearch]);

    const jumpToLog = (typeFilter: string = 'All') => { 
        setLogFilter(prev => ({ ...prev, type: typeFilter, search: '' })); 
        setViewMode('log'); 
    };

    const handleAddEmployee = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if(!newEmpName) return; 
        try { 
            await addDoc(collection(db, "personnel"), { name: newEmpName, totalOccurrences: 0, incidents: [], timestamp: serverTimestamp() }); 
            showToast(`Added ${newEmpName}`, 'success'); 
            setNewEmpName(''); 
            setShowAddModal(false); 
        } catch(err) { showToast("Failed to add employee", 'error'); } 
    };

    const handleLogIncident = async () => {
        const targetId = selectedEmp ? selectedEmp.id : selectedEmpId; 
        if(!targetId) return showToast("Select an employee", 'error');
        try {
            const newLog = { type: incData.type, date: incData.date || new Date().toISOString().split('T')[0], count: Number(incData.count), docReceived: incData.docReceived, supervisorReviewDate: incData.supervisorReviewDate, notes: incData.notes, loggedAt: new Date().toISOString() };
            await updateDoc(doc(db, "personnel", targetId), { totalOccurrences: increment(Number(incData.count)), incidents: arrayUnion(newLog) });
            showToast("Incident Saved", 'success'); 
            setShowIncidentModal(false); 
            setIncData({ type: 'Sick', date: '', count: 1, docReceived: false, supervisorReviewDate: '', notes: '' });
        } catch(err) { showToast("Failed to save", 'error'); }
    };

    const handleDeleteIncident = async (empId: string, incident: any) => {
        if(!confirm("Are you sure you want to permanently delete this incident record?")) return;
        try {
            const empSnap = await getDoc(doc(db, "personnel", empId)); 
            if (!empSnap.exists()) return;
            const updatedIncidents = (empSnap.data().incidents || []).filter((i: any) => i.loggedAt !== incident.loggedAt);
            const newTotal = updatedIncidents.reduce((sum: number, i: any) => sum + (Number(i.count) || 0), 0);
            await updateDoc(doc(db, "personnel", empId), { incidents: updatedIncidents, totalOccurrences: newTotal });
            showToast("Incident Deleted", 'success'); 
            if (selectedEmp && selectedEmp.id === empId) setSelectedEmp({ ...selectedEmp, incidents: updatedIncidents, totalOccurrences: newTotal });
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

        let disciplineLevel = "None"; 
        if(activePoints >= 3) disciplineLevel = "Verbal Warning"; 
        if(activePoints >= 4) disciplineLevel = "Written Warning"; 
        if(activePoints >= 5) disciplineLevel = "Final Written Warning"; 
        if(activePoints >= 6) disciplineLevel = "Discharge";
        
        const nameParts = selectedEmp.name.split(' ');
        const formalName = nameParts.length > 1 ? `${nameParts[nameParts.length-1]}, ${nameParts[0]}` : selectedEmp.name;
        const today = new Date();
        const reportDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Notice of Discipline</title><style>body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #000000; line-height: 1.1; margin: 0; padding: 0; } p { margin: 0; padding: 0; margin-bottom: 6pt; } .header-center { text-align: center; font-weight: bold; margin-bottom: 12pt; text-transform: uppercase; font-size: 11pt; } .indent-row { margin-left: 60pt; font-family: 'Arial'; font-size: 10pt; }</style></head><body>`;
        const content = `<br><table style="width:100%; border:none; margin-bottom: 8pt;"><tr><td style="width:60%; font-family: 'Arial'; font-size: 10pt;">TO: ${formalName}</td><td style="width:40%; text-align:right; font-family: 'Arial'; font-size: 10pt;">DATE: ${reportDate}</td></tr></table><div class="header-center"><p>ATTENDANCE PROGRAM<br>NOTICE OF DISCIPLINE</p></div><p>The Attendance Program states that an employee who accumulates excessive occurrences of absence within any twelve month period (rolling year) will be disciplined according to the following:</p><br><p style="margin-left: 30pt;">Number of Occurrences&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Level of Discipline</p><p class="indent-row">1-2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;None</p><p class="indent-row">3&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Verbal Warning</p><p class="indent-row">4&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Written Warning</p><p class="indent-row">5&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Final Written Warning</p><p class="indent-row">6&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Discharge</p><br><p>My records indicate that you have accumulated <strong>${activePoints} occurrences</strong> during the past rolling twelve months. The Occurrences are as follows:</p><p style="margin-left: 60pt; text-decoration: underline;">Occurrences</p>${incidentListHTML || '<p class="indent-row">None recorded.</p>'}<br><p>Therefore, in accordance with the schedule of progressive discipline, this is your <strong>${disciplineLevel}</strong> for excessive absenteeism under the rule.</p><br><p>Please be advised that your rate of absenteeism is not acceptable and YOUR corrective action is required. Additional occurrences will result in the progressive disciplinary action indicated above.</p><br><div style="text-align:center; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:3pt 0; width:50%; margin:auto; font-weight:bold; margin-top:10pt; margin-bottom:10pt;">ACKNOWLEDGEMENT</div><p>I acknowledge receipt of this Notice of Discipline and that I have been informed of the potential for progressive discipline, up to and including discharge.</p><br><table style="width:100%; border:none; margin-top: 15pt;"><tr><td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%; border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top; padding-top:2px;">Employee</td><td></td><td style="vertical-align:top; padding-top:2px;">Date</td></tr></table><table style="width:100%; border:none; margin-top: 20pt;"><tr><td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%; border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top; padding-top:2px;">Foreman/Supervisor/Superintendent</td><td></td><td style="vertical-align:top; padding-top:2px;">Date</td></tr></table><table style="width:100%; border:none; margin-top: 20pt;"><tr><td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td><td style="width:10%;">&nbsp;</td><td style="width:40%; border-bottom:1px solid #000;">&nbsp;</td></tr><tr><td style="vertical-align:top; padding-top:2px;">General Foreman/Manager/General Superintendent</td><td></td><td style="vertical-align:top; padding-top:2px;">Date</td></tr></table></body></html>`;
        
        const blob = new Blob(['\ufeff', header + content], { type: 'application/msword' });
        saveAs(blob, `${selectedEmp.name.replace(' ','_')}_Notice.doc`);
        showToast("Notice Generated", 'success');
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex justify-between items-end mb-6 flex-wrap gap-2">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Attendance Tracker</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Incident Dashboard & Logs</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <div className={`border rounded-lg p-1 flex ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <button onClick={()=>setViewMode('dashboard')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${viewMode==='dashboard'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Dashboard</button>
                        <button onClick={()=>setViewMode('log')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all ${viewMode==='log'?'bg-[#002d72] text-white shadow':(darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>Master Log</button>
                    </div>
                    <button onClick={() => setShowIncidentModal(true)} className="px-6 py-2 bg-[#ef7c00] text-white rounded-lg font-black uppercase text-[10px] shadow-lg hover:bg-orange-600 transition-all">+ Log Incident</button>
                    <button onClick={() => setShowAddModal(true)} className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] shadow-lg transition-all ${darkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>+ Emp</button>
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
                            <div className="flex gap-2">
                                <button onClick={handleExportWord} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase shadow hover:bg-blue-700 transition-colors">📄 Export Notice</button>
                                <button onClick={()=>setSelectedEmp(null)} className="text-2xl text-slate-400 hover:text-red-500 transition-colors">✕</button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className={`p-4 rounded-xl border mb-6 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-blue-50/50 border-blue-100'}`}>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-[#ef7c00]' : 'text-blue-800'}`}>Log New Incident</h4>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <select className={`p-2 border rounded font-bold text-xs ${inputClass}`} value={incData.type} onChange={e=>setIncData({...incData, type:e.target.value})}><option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option></select>
                                    <input type="number" className={`p-2 border rounded font-bold text-xs ${inputClass}`} placeholder="Count" value={incData.count} onChange={e=>setIncData({...incData, count:Number(e.target.value)})} />
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <input type="date" onClick={handleDateClick} className={`p-2 border rounded font-bold text-xs flex-grow cursor-pointer ${inputClass}`} value={incData.date} onChange={e=>setIncData({...incData, date:e.target.value})} />
                                    <div className={`p-2 border rounded cursor-pointer font-bold text-xs flex items-center gap-2 ${incData.docReceived?(darkMode?'bg-green-900/50 border-green-700 text-green-400':'bg-green-100 border-green-200 text-green-700'):inputClass}`} onClick={()=>setIncData({...incData, docReceived:!incData.docReceived})}><span>Doc?</span>{incData.docReceived && '✓'}</div>
                                </div>
                                <input className={`w-full p-2 border rounded font-bold text-xs mb-3 ${inputClass}`} placeholder="Notes..." value={incData.notes} onChange={e=>setIncData({...incData, notes:e.target.value})} />
                                <button onClick={handleLogIncident} className="w-full py-2 bg-[#002d72] text-white rounded font-black text-xs hover:bg-[#ef7c00] transition-colors">Add Record</button>
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
                                                    <td className="p-3 font-bold">{inc.type}</td>
                                                    <td className="p-3 text-center font-black">{inc.count}</td>
                                                    <td className={`p-3 italic truncate max-w-[150px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{inc.notes}</td>
                                                    <td className="p-3 text-center"><button onClick={() => handleDeleteIncident(selectedEmp.id, inc)} className="text-red-500 hover:text-red-400 font-bold">🗑️</button></td>
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
                    <div className={`p-6 rounded-2xl w-full max-w-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
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
                        <select className={`w-full p-3 border-2 rounded-lg font-bold mb-4 outline-none focus:border-[#ef7c00] ${inputClass}`} value={selectedEmpId} onChange={e=>setSelectedEmpId(e.target.value)}>
                            <option value="">-- Select Employee --</option>
                            {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Type</label>
                                <select className={`w-full p-3 border-2 rounded-lg font-bold text-sm outline-none focus:border-[#ef7c00] ${inputClass}`} value={incData.type} onChange={e=>setIncData({...incData, type:e.target.value})}>
                                    <option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Occurrences</label>
                                <input type="number" className={`w-full p-3 border-2 rounded-lg font-bold text-sm outline-none focus:border-[#ef7c00] ${inputClass}`} value={incData.count} onChange={e=>setIncData({...incData, count:Number(e.target.value)})} />
                            </div>
                        </div>
                        <label className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Date</label>
                        <input type="date" onClick={handleDateClick} className={`w-full p-3 border-2 rounded-lg font-bold mb-4 text-sm outline-none focus:border-[#ef7c00] cursor-pointer ${inputClass}`} value={incData.date} onChange={e=>setIncData({...incData, date:e.target.value})} />
                        <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg border cursor-pointer ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-blue-50 border-blue-100'}`} onClick={()=>setIncData({...incData, docReceived:!incData.docReceived})}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${incData.docReceived ? 'bg-[#ef7c00] border-[#ef7c00] text-white' : (darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300')}`}>{incData.docReceived && '✓'}</div>
                            <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-blue-800'}`}>Documentation Received?</span>
                        </div>
                        <textarea className={`w-full p-3 border-2 rounded-lg h-24 mb-6 font-medium text-sm outline-none focus:border-[#ef7c00] ${inputClass}`} placeholder="Additional notes..." value={incData.notes} onChange={e=>setIncData({...incData, notes:e.target.value})} />
                        <div className="flex gap-4">
                            <button onClick={()=>setShowIncidentModal(false)} className={`w-1/3 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-black hover:bg-slate-200'}`}>Cancel</button>
                            <button onClick={handleLogIncident} className="w-2/3 py-3 bg-[#002d72] text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-[#ef7c00] transition-colors">Save Record</button>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'dashboard' && (
                <div className="space-y-6 overflow-y-auto pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div onClick={()=>jumpToLog('All')} className={`p-6 rounded-2xl shadow-sm border cursor-pointer transition-all ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-[#ef7c00]' : 'bg-white border-slate-200 hover:border-[#002d72] hover:bg-blue-50'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Occurrences</p>
                            <p className={`text-4xl font-black ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{stats.totalOccurrences}</p>
                        </div>
                        <div onClick={()=>jumpToLog('All')} className={`p-6 rounded-2xl shadow-sm border cursor-pointer transition-all ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-[#ef7c00]' : 'bg-white border-slate-200 hover:border-[#002d72] hover:bg-blue-50'}`}>
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
                                <input type="text" placeholder="Search Name..." className={`text-xs p-1 border rounded w-32 font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={rosterSearch} onChange={e=>setRosterSearch(e.target.value)} />
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
                        <select className={`p-2 border rounded font-bold text-xs outline-none focus:border-[#ef7c00] ${inputClass}`} value={logFilter.type} onChange={e=>setLogFilter({...logFilter, type:e.target.value})}><option value="All">All Types</option><option>Sick</option><option>FMLA</option><option>Failure to Report</option><option>Late Reporting</option><option>NC/NS</option></select>
                        <select className={`p-2 border rounded font-bold text-xs outline-none focus:border-[#ef7c00] ${inputClass}`} value={logFilter.sort} onChange={e=>setLogFilter({...logFilter, sort:e.target.value})}><option value="desc">Newest First</option><option value="asc">Oldest First</option></select>
                    </div>
                    <div className="overflow-x-auto flex-grow custom-scrollbar">
                        <div className={`min-w-[700px] border-b p-3 grid grid-cols-12 gap-2 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <div className="col-span-3">Employee Name</div><div className="col-span-2">Incident Type</div><div className="col-span-2">Date</div><div className="col-span-1 text-center">Count</div><div className="col-span-1 text-center">Doc?</div><div className="col-span-2">Notes</div><div className="col-span-1 text-center">Action</div>
                        </div>
                        <div className={`min-w-[700px] divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {filteredLog.length === 0 ? <div className={`p-10 text-center italic font-bold ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>No records found.</div> : filteredLog.map((log, i) => (
                                <div key={i} className={`grid grid-cols-12 gap-2 p-3 items-center transition-colors text-xs ${darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-blue-50 text-slate-700'}`}>
                                    <div 
                                        className={`col-span-3 font-bold cursor-pointer hover:underline ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}
                                        onClick={() => {
                                            const emp = personnel.find(p => p.id === log.employeeId);
                                            if (emp) setSelectedEmp(emp);
                                        }}
                                    >
                                        {log.employeeName}
                                    </div>
                                    <div className="col-span-2 font-medium">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${log.type==='Sick'?'bg-orange-500/20 text-orange-500':log.type==='FMLA'?'bg-blue-500/20 text-blue-500':'bg-red-500/20 text-red-500'}`}>{log.type}</span>
                                    </div>
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

// --- COMPONENT: DATA ENTRY & BUS CREATION ---
const BusInputForm = ({ showToast, darkMode, buses, isAdmin }: { showToast: (m:string, t:'success'|'error')=>void, darkMode: boolean, buses: any[], isAdmin: boolean }) => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newBusData, setNewBusData] = useState({ number: '', status: 'Active' });

    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleDateClick = (e: React.MouseEvent<HTMLInputElement>) => {
        if ('showPicker' in HTMLInputElement.prototype) {
            (e.currentTarget as any).showPicker();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        
        // Date Validations
        if (formData.oosStartDate) {
            const oos = new Date(formData.oosStartDate);
            if (formData.expectedReturnDate && new Date(formData.expectedReturnDate) < oos) {
                return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            }
            if (formData.actualReturnDate && new Date(formData.actualReturnDate) < oos) {
                return showToast("Actual Return cannot be earlier than OOS Date", 'error');
            }
        }

        const busRef = doc(db, "buses", formData.number); const busSnap = await getDoc(busRef);
        if (!busSnap.exists()) return showToast(`⛔ Bus #${formData.number} not found. Please add it first.`, 'error');
        
        const old = busSnap.data(); let changes = []; 
        if (old.status !== formData.status) changes.push(`STATUS: ${old.status} ➝ ${formData.status}`); 
        if (old.notes !== formData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${formData.notes}"`); 
        if (old.oosStartDate !== formData.oosStartDate) changes.push(`OOS: ${old.oosStartDate || '—'} ➝ ${formData.oosStartDate}`);
        
        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        
        if (changes.length > 0) await logHistory(formData.number, "UPDATE", changes.join('\n'), auth.currentUser?.email || 'Unknown'); 
        else await logHistory(formData.number, "UPDATE", "Routine Update via Terminal", auth.currentUser?.email || 'Unknown');
        
        showToast(`Bus #${formData.number} Updated`, 'success'); 
        setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    };

    const handleAddNewBus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBusData.number) return showToast("Bus number required", 'error');
        
        const busRef = doc(db, "buses", newBusData.number);
        const snap = await getDoc(busRef);
        if (snap.exists()) {
            return showToast(`⛔ Bus #${newBusData.number} already exists!`, 'error');
        }

        try {
            await setDoc(busRef, {
                number: newBusData.number,
                status: newBusData.status,
                location: '',
                notes: '',
                oosStartDate: '',
                expectedReturnDate: '',
                actualReturnDate: '',
                timestamp: serverTimestamp()
            });
            await logHistory(newBusData.number, "CREATED", "Bus added to registry via Admin Panel.", auth.currentUser?.email || 'Unknown');
            showToast(`Bus #${newBusData.number} Added`, 'success');
            setShowAddModal(false);
            setNewBusData({ number: '', status: 'Active' });
        } catch (err) {
            showToast("Failed to add bus", 'error');
        }
    };

    const populateFleet = async () => {
        if (!confirm(`Are you sure you want to initialize the database with ${HAMILTON_FLEET.length} Hamilton buses?`)) return;
        
        let addedCount = 0;
        const existingBusNumbers = new Set(buses.map(b => b.number));
        const batch = writeBatch(db);

        for (const busNumber of HAMILTON_FLEET) {
            if (!existingBusNumbers.has(busNumber)) {
                const busRef = doc(db, "buses", busNumber);
                batch.set(busRef, {
                    number: busNumber,
                    status: 'Active',
                    location: '',
                    notes: '',
                    oosStartDate: '',
                    expectedReturnDate: '',
                    actualReturnDate: '',
                    timestamp: serverTimestamp()
                });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            try {
                await batch.commit();
                showToast(`Successfully added ${addedCount} missing buses!`, 'success');
            } catch (err) {
                console.error(err);
                showToast("Failed to populate fleet.", 'error');
            }
        } else {
            showToast("All Hamilton buses are already in the system.", 'success');
        }
    };

    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-gray-400';
    
    return (
        <div className={`max-w-2xl mx-auto mt-4 md:mt-10 p-6 md:p-8 rounded-2xl shadow-xl border-t-8 border-[#ef7c00] animate-in slide-in-from-bottom-4 duration-500 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-end mb-8">
                <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Data Entry</h2>
                <div className="flex gap-2">
                    {isAdmin && <button type="button" onClick={populateFleet} className={`px-3 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest border transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[#002d72]'}`}>⚙️ Init Fleet</button>}
                    <button type="button" onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-black uppercase text-[10px] tracking-widest shadow-md transition-all">+ Add New Bus</button>
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <input type="text" placeholder="Unit # to Update" className={`p-4 border-2 rounded-xl font-black outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.number} onChange={handleChange} name="number" required />
                    <select className={`p-4 border-2 rounded-xl font-bold outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.status} onChange={handleChange} name="status"><option value="Active">Ready for Service</option><option value="On Hold">Maintenance Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option></select>
                </div>
                <input type="text" placeholder="Location" className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.location} onChange={handleChange} name="location" />
                <textarea placeholder="Maintenance Notes" className={`w-full p-4 border-2 rounded-xl h-24 outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.notes} onChange={handleChange} name="notes" />
                <div className="grid grid-cols-3 gap-4">
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>OOS Date</label><input name="oosStartDate" type="date" onClick={handleDateClick} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer ${inputClass}`} value={formData.oosStartDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exp Return</label><input name="expectedReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer ${inputClass}`} value={formData.expectedReturnDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Act Return</label><input name="actualReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer ${inputClass}`} value={formData.actualReturnDate} onChange={handleChange} /></div>
                </div>
                <button className="w-full py-4 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest transition-all transform active:scale-95 shadow-lg">Update Record</button>
            </form>

            {/* ADD NEW BUS MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`p-8 rounded-xl shadow-2xl w-full max-w-md border animate-in zoom-in-95 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h3 className={`text-2xl font-black mb-6 uppercase italic ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Add New Bus</h3>
                        <form onSubmit={handleAddNewBus} className="space-y-4">
                            <div>
                                <label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Unit Number *</label>
                                <input type="text" className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.number} onChange={e => setNewBusData({...newBusData, number: e.target.value})} required placeholder="e.g., 2001" />
                            </div>
                            <div>
                                <label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Initial Status</label>
                                <select className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.status} onChange={e => setNewBusData({...newBusData, status: e.target.value})}>
                                    <option value="Active">Ready for Service</option>
                                    <option value="On Hold">Maintenance Hold</option>
                                    <option value="In Shop">In Shop</option>
                                </select>
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => setShowAddModal(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-black'}`}>Cancel</button>
                                <button type="submit" className="w-1/2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase text-xs shadow-lg transform active:scale-95 transition-all">Save Bus</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN APPLICATION ENTRY ---
export default function FleetManager() {
  const [user, setUser] = useState<any>(null);
  
  // NEW: State for Auth Toggle & Access Approval
  const [isSignUp, setIsSignUp] = useState(false);
  const [userStatus, setUserStatus] = useState<'loading' | 'approved' | 'pending' | 'rejected'>('loading');

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
  
  // DARK MODE & FULLSCREEN
  const [darkMode, setDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tvBoardRef = useRef<HTMLDivElement>(null);

  const holdStatuses = ['On Hold', 'Engine', 'Body Shop', 'Vendor', 'Brakes', 'Safety'];
  
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');
  const triggerToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); };

  // AUTHENTICATION STATE & ACCESS CONTROL
  useEffect(() => { onAuthStateChanged(auth, u => setUser(u)); }, []);

  useEffect(() => {
      if (!user) {
          setUserStatus('loading');
          return;
      }

      // Hardcoded admins automatically get approved
      if (ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
          setUserStatus('approved');
          return;
      }

      // Check access status for standard users
      const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
              setUserStatus(docSnap.data().status);
          } else {
              // Create a pending doc if one somehow doesn't exist for a logged-in user
              setDoc(doc(db, "users", user.uid), {
                  email: user.email?.toLowerCase() || '',
                  status: 'pending',
                  createdAt: serverTimestamp()
              });
              setUserStatus('pending');
          }
      });
      return () => unsubscribe();
  }, [user]);

  useEffect(() => { 
      if (!user || userStatus !== 'approved') return; 
      return onSnapshot(query(collection(db, "buses"), orderBy("number", "asc")), s => setBuses(s.docs.map(d => ({...d.data(), docId: d.id})))); 
  }, [user, userStatus]);

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

  // Auto-scroll TV Board Marquee
  useEffect(() => {
      let animationFrameId: number;
      let isPaused = false;
      let scrollPos = 0;
      
      const scroll = () => {
          if (inventoryMode === 'tv' && isFullscreen && tvBoardRef.current && !isPaused) {
              const el = tvBoardRef.current;
              if (el.scrollHeight > el.clientHeight) {
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
                      scrollPos += 1.2; 
                      el.scrollTop = scrollPos;
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
    if (activeFilter === 'On Hold') return b.status === 'On Hold';
    if (activeFilter === 'In Shop') return b.status === 'In Shop';
    return true;
  }).sort((a, b) => {
    if (sortConfig.key === 'number') {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    }
    
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

  // --- AUTHENTICATION HANDLER ---
  const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (isSignUp) {
              const cred = await createUserWithEmailAndPassword(auth, email, password);
              // Store user safely in firestore with 'pending' status
              await setDoc(doc(db, "users", cred.user.uid), {
                  email: email.toLowerCase(),
                  status: 'pending',
                  createdAt: serverTimestamp()
              });
              triggerToast("Account created successfully! Pending admin approval.", 'success');
          } else {
              await signInWithEmailAndPassword(auth, email, password);
          }
      } catch (error: any) {
          triggerToast(error.message.replace('Firebase: ', ''), 'error');
      }
  };

  if (!user) return (
    <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex-grow flex items-center justify-center p-4 relative overflow-hidden">
          <form onSubmit={handleAuth} className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-[#ef7c00] relative z-10 animate-in fade-in zoom-in">
            <h2 className="text-4xl font-black text-white italic mb-8 text-center leading-none uppercase">
                {isSignUp ? 'REGISTER' : 'FLEET OPS'}
            </h2>
            <div className="space-y-4">
              <input className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-xl font-bold text-white placeholder:text-gray-500 outline-none focus:border-[#ef7c00]" placeholder="Email Address" value={email} onChange={e=>setEmail(e.target.value)} required />
              <input className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-xl font-bold text-white placeholder:text-gray-500 outline-none focus:border-[#ef7c00]" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="submit" className="w-full bg-[#ef7c00] text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all transform active:scale-95 shadow-xl">
                  {isSignUp ? 'Create Account' : 'Authorized Login'}
              </button>
            </div>
            
            <div className="mt-8 text-center">
                <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-slate-400 hover:text-white text-xs font-bold transition-colors">
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
            </div>
          </form>
      </div>

      <Footer onShowLegal={setLegalType} darkMode={true} />
      {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} darkMode={true} />}
    </div>
  );

  // --- ACCESS BLOCKERS ---
  if (userStatus === 'loading') return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="w-16 h-16 border-4 border-[#ef7c00] border-t-transparent rounded-full animate-spin"></div>
      </div>
  );

  if (userStatus === 'pending' || userStatus === 'rejected') return (
      <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
          <div className="flex-grow flex items-center justify-center p-4">
              <div className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-red-500 text-center animate-in zoom-in-95">
                  <h2 className="text-3xl font-black text-white italic mb-4 uppercase">Access Restricted</h2>
                  <p className="text-slate-400 font-bold mb-8">
                      {userStatus === 'pending' 
                          ? "Your account has been created but is waiting for an administrator to grant access. Please check back later." 
                          : "Your access has been revoked by an administrator."}
                  </p>
                  <button onClick={() => signOut(auth)} className="w-full bg-[#002d72] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl">Sign Out</button>
              </div>
          </div>
          <Footer onShowLegal={setLegalType} darkMode={true} />
          {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} darkMode={true} />}
      </div>
  );

  return (
    <div className={`flex flex-col min-h-screen font-sans selection:bg-[#ef7c00] selection:text-white transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {selectedBusDetail && (<div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={triggerToast} darkMode={darkMode} /></div>)}
      {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} darkMode={darkMode} />}

      {/* TOP NAV BAR */}
      <nav className={`backdrop-blur-md border-b sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm overflow-x-auto ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="flex items-center gap-2 flex-shrink-0"><div className="w-2 h-6 bg-[#ef7c00] rounded-full"></div><span className={`font-black text-lg italic uppercase tracking-tighter ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Fleet Manager</span></div>
        <div className="flex gap-4 items-center flex-nowrap">
          {['inventory', 'input', 'tracker', 'handover', 'parts']
            .concat(isAdmin ? ['analytics', 'personnel', 'admin'] : [])
            .map(v => (
            <button key={v} onClick={() => setView(v as any)} className={`text-[9px] font-black uppercase tracking-widest border-b-2 pb-1 transition-all whitespace-nowrap ${view === v ? 'border-[#ef7c00] text-[#ef7c00]' : (darkMode ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-[#002d72]')}`}>
                {v.replace('input', 'Data Entry').replace('parts', 'Parts List').replace('personnel', 'Personnel').replace('admin', 'Admin Panel')}
            </button>
          ))}
          <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${darkMode ? 'bg-slate-800 text-yellow-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
          <button onClick={exportExcel} className={`text-[10px] font-black uppercase whitespace-nowrap ${darkMode ? 'text-green-400 hover:text-green-300' : 'text-[#002d72] hover:text-[#ef7c00]'}`}>Excel</button>
          <button onClick={() => signOut(auth)} className="text-red-500 text-[10px] font-black uppercase whitespace-nowrap">Logout</button>
        </div>
      </nav>

      <main className="flex-grow max-w-[1600px] w-full mx-auto p-4 md:p-6 overflow-x-hidden">
        {view === 'tracker' ? <div className={`h-[85vh] rounded-2xl shadow-sm border overflow-hidden relative ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><BusTracker /></div> :
         view === 'input' ? <BusInputForm showToast={triggerToast} darkMode={darkMode} buses={buses} isAdmin={isAdmin} /> :
         view === 'parts' ? <PartsInventory showToast={triggerToast} darkMode={darkMode} /> :
         view === 'analytics' ? (isAdmin ? <div className="animate-in fade-in duration-500"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={triggerToast} /></div> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) :
         view === 'handover' ? <ShiftHandover buses={buses} showToast={triggerToast} /> :
         view === 'personnel' ? (isAdmin ? <PersonnelManager showToast={triggerToast} darkMode={darkMode} /> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) : 
         view === 'admin' ? (isAdmin ? <AccessManager showToast={triggerToast} darkMode={darkMode} /> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) : (
          <>
            {/* STAT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[{label:'Total Fleet',val:buses.length,c: darkMode?'text-white':'text-slate-900'},{label:'Ready',val:buses.filter(b=>b.status==='Active'||b.status==='In Shop').length,c:'text-green-500'},{label:'On Hold',val:buses.filter(b=>b.status==='On Hold').length,c:'text-red-500'},{label:'In Shop',val:buses.filter(b=>b.status==='In Shop').length,c:'text-orange-500'}].map(m=>(
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
                                <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`grid grid-cols-10 gap-4 p-5 items-center cursor-pointer transition-all border-l-4 ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} ${b.status==='Active' ? 'border-green-500' : (b.status === 'In Shop' ? 'border-orange-500' : 'border-red-500')}`}>
                                    <div className={`text-lg font-black ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>#{b.number}</div>
                                    <div className={`text-[9px] font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{getBusSpecs(b.number).length}</div>
                                    <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-full w-fit ${b.status==='Active' ? 'bg-green-500 text-white' : (b.status === 'In Shop' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white')}`}>{b.status}</div>
                                    <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{b.location || 'Location Unavailable'}</div>
                                    <div className={`col-span-2 text-xs font-medium truncate italic ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{b.notes||'No faults.'}</div>
                                    <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{b.expectedReturnDate||'—'}</div>
                                    <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{b.actualReturnDate||'—'}</div>
                                    <div className={`text-xs font-black ${b.status!=='Active' ? (b.status==='In Shop' ? 'text-orange-500' : 'text-red-500') : ''}`}>{b.status!=='Active' ? `${calculateDaysOOS(b.oosStartDate)} days` : '—'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. STANDARD GRID VIEW */}
                {inventoryMode === 'grid' && (
                    <div className={`p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${darkMode ? 'bg-slate-900' : 'bg-slate-50/50'}`}>
                        {sortedBuses.map(b => (
                            <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`p-4 rounded-2xl border-2 flex flex-col cursor-pointer hover:-translate-y-1 transition-all shadow-sm ${darkMode ? 'bg-slate-800' : 'bg-white'} ${b.status==='Active' ? (darkMode ? 'border-green-600/50 hover:border-green-400' : 'border-green-200 hover:border-green-500') : (b.status === 'In Shop' ? (darkMode ? 'border-orange-600/50 hover:border-orange-400' : 'border-orange-300 hover:border-orange-500') : (darkMode ? 'border-red-600/50 hover:border-red-400' : 'border-red-200 hover:border-red-500'))}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>#{b.number}</span>
                                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${b.status==='Active' ? 'bg-green-500 text-white' : (b.status === 'In Shop' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white')}`}>{b.status}</span>
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-bold mb-2 truncate ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>📍 {b.location || 'Location Unavailable'}</div>
                                <div className={`text-[10px] italic line-clamp-2 mb-3 h-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🔧 {b.notes || 'No active faults recorded.'}</div>
                                {b.status !== 'Active' && <div className={`mt-auto text-[10px] font-black text-white p-1.5 rounded-lg text-center shadow-inner tracking-widest ${b.status === 'In Shop' ? 'bg-orange-500 border border-orange-600' : 'bg-red-600 border border-red-700'}`}>⏱️ DOWN {calculateDaysOOS(b.oosStartDate)} DAYS</div>}
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
                                    : (b.status === 'In Shop' 
                                        ? (darkMode ? 'bg-slate-800 border-orange-500' : 'bg-white border-orange-500') 
                                        : (darkMode ? 'bg-slate-800 border-red-600' : 'bg-white border-red-600'))
                                }`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-4xl font-black leading-none tracking-tighter ${b.status==='Active' ? (darkMode?'text-green-400':'text-green-600') : (b.status==='In Shop' ? (darkMode?'text-orange-400':'text-orange-500') : (darkMode?'text-red-500':'text-red-600'))}`}>#{b.number}</span>
                                        <span className={`w-fit px-2 py-1 rounded text-xs font-black uppercase tracking-wider shadow-sm text-white ${b.status==='Active' ? 'bg-green-500' : (b.status === 'In Shop' ? 'bg-orange-500' : 'bg-red-600')}`}>{b.status}</span>
                                    </div>
                                    
                                    <div className={`text-sm font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>📍 {b.location || 'Location Unavailable'}</div>
                                    
                                    <div className={`text-xs font-bold leading-snug mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{b.notes || 'No active faults recorded.'}</div>
                                    
                                    <div className="mt-auto pt-2">
                                        {b.status !== 'Active' && <div className={`text-xs font-black text-white rounded px-2 py-1.5 text-center tracking-widest shadow-inner ${b.status === 'In Shop' ? 'bg-orange-600' : 'bg-red-600'}`}>DOWN {calculateDaysOOS(b.oosStartDate)} DAYS</div>}
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

      <Footer onShowLegal={setLegalType} darkMode={darkMode} />
    </div>
  );
}