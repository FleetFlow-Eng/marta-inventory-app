"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, addDoc, deleteDoc, getDoc, getDocs, limit, where, writeBatch, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

import localParts from './partsData.json';

// --- CONSTANTS ---
const ADMIN_EMAILS = ['anetowestfield@gmail.com', 'admin@fleetflow.services'];

const HAMILTON_FLEET = ["1625","1628","1629","1631","1632","1633","1634","1635","1636","1637","1638","1639","1640","1641","1642","1643","1644","1645","1646","1647","1648","1660","1802","1803","1804","1805","1806","1807","1808","1809","1810","1811","1812","1813","1815","1817","1818","1819","1820","1821","1822","1823","1824","1826","1827","1828","1829","1830","1831","1832","1833","1834","1835","1836","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1850","1851","1852","1853","1854","1855","1856","1858","1859","1860","1861","1862","1863","1864","1865","1867","1868","1870","1871","1872","1873","1874","1875","1876","1877","1878","1879","1880","1881","1883","1884","1885","1887","1888","1889","1895","1909","1912","1913","1921","1922","1923","1924","1925","1926","1927","1928","1929","1930","1931","1932","1933","1935","1951","1958","1959","7021","7022","7023","7024","7025","7026","7027","7028","7029","7030","7031","7033","7092","7093","7094","7095","7096","7097","7098","7099","7102","7103","7104","7105","1406","1408","1434","1440","2326","2343","2593"];

// --- DYNAMIC IMPORTS ---
const BusTracker = dynamic(() => import('./BusTracker'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[50vh] bg-slate-100 rounded-2xl animate-pulse text-xs uppercase font-black">Loading Map...</div>
});

// --- HELPER COMPONENTS ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-[9999] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 border-l-8 ${type === 'success' ? 'bg-white border-green-500 text-slate-800' : 'bg-white border-red-500 text-slate-800'}`}>
            <span className="text-2xl">{type === 'success' ? '✅' : '📋'}</span>
            <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{type === 'success' ? 'Success' : 'Notice'}</p><p className="text-sm font-bold text-slate-800">{message}</p></div>
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

// --- GLOBAL LOGGING ---
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

// --- CORE UTILS ---
const calculateDaysOOS = (start: string) => {
    if (!start) return 0;
    const now = new Date();
    const s = new Date(start);
    return Math.max(0, Math.ceil((now.getTime() - s.getTime()) / (1000 * 3600 * 24)));
};

const formatTime = (ts: any) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString() : 'Just now';

// --- MODULES ---

// 1. DYNAMIC ACCESS & STATUS MANAGER
const AccessManager = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
    const [usersList, setUsersList] = useState<any[]>([]);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [newStatus, setNewStatus] = useState({ label: '', type: 'hold' });
    const [selectedUserHistory, setSelectedUserHistory] = useState<string | null>(null);
    const [userLogs, setUserLogs] = useState<any[]>([]);

    useEffect(() => {
        const uSub = onSnapshot(collection(db, "users"), s => setUsersList(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const sSub = onSnapshot(collection(db, "settings"), s => {
            const data = s.docs.find(d => d.id === 'status_options');
            if (data) setStatusOptions(data.data().list || []);
        });
        return () => { uSub(); sSub(); };
    }, []);

    const handleAddStatus = async () => {
        if (!newStatus.label) return;
        const updatedList = [...statusOptions, { label: newStatus.label, type: newStatus.type }];
        await setDoc(doc(db, "settings", "status_options"), { list: updatedList });
        setNewStatus({ label: '', type: 'hold' });
        showToast("Status option added", "success");
    };

    const handleRemoveStatus = async (idx: number) => {
        const updatedList = statusOptions.filter((_, i) => i !== idx);
        await setDoc(doc(db, "settings", "status_options"), { list: updatedList });
    };

    const toggleApproval = async (uid: string, current: string) => {
        await updateDoc(doc(db, "users", uid), { status: current === 'approved' ? 'pending' : 'approved' });
    };

    const deleteUser = async (uid: string) => {
        if (confirm("Delete user permanently?")) await deleteDoc(doc(db, "users", uid));
    };

    const fetchUserHistory = async (email: string) => {
        setSelectedUserHistory(email);
        const q = query(collection(db, "activity_logs"), where("user", "==", email));
        const snap = await getDocs(q);
        setUserLogs(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a:any, b:any) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';

    return (
        <div className="space-y-10 max-w-6xl mx-auto pb-20">
            {/* Status Dropdown Manager */}
            <div className={`p-8 rounded-2xl border shadow-xl ${bgClass}`}>
                <h3 className="text-xl font-black uppercase italic mb-6 text-[#ef7c00]">Status Menu Customization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-50 mb-4">Add New Option</p>
                        <div className="flex gap-2">
                            <input className="flex-grow p-3 rounded-lg border bg-black/10 font-bold outline-none" placeholder="Label (e.g. Parts Hold)" value={newStatus.label} onChange={e=>setNewStatus({...newStatus, label: e.target.value})} />
                            <select className="p-3 rounded-lg border bg-black/10 font-bold" value={newStatus.type} onChange={e=>setNewStatus({...newStatus, type: e.target.value})}>
                                <option value="ready">Ready (Green)</option>
                                <option value="shop">In Shop (Orange)</option>
                                <option value="hold">Hold/Down (Red)</option>
                            </select>
                            <button onClick={handleAddStatus} className="px-6 bg-[#ef7c00] text-white font-black rounded-lg">+</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase opacity-50 mb-4">Active Dropdown List</p>
                        {statusOptions.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-black/5 border border-black/10">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${s.type==='ready'?'bg-green-500':s.type==='shop'?'bg-orange-500':'bg-red-500'}`}></div>
                                    <span className="font-bold">{s.label}</span>
                                </div>
                                <button onClick={()=>handleRemoveStatus(i)} className="text-red-500 text-xs font-black">REMOVE</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* User Access Manager */}
            <div className={`rounded-2xl border shadow-xl overflow-hidden ${bgClass}`}>
                <table className="w-full text-left text-sm">
                    <thead className="bg-black/5 font-black uppercase text-[10px] tracking-widest border-b">
                        <tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Access</th><th className="p-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                        {usersList.map(u => (
                            <tr key={u.id} className="hover:bg-black/5">
                                <td className="p-4 font-bold cursor-pointer text-[#ef7c00]" onClick={()=>fetchUserHistory(u.email)}>{u.email}</td>
                                <td className="p-4 uppercase text-[10px] font-black">{u.role || 'user'}</td>
                                <td className="p-4 uppercase text-[10px] font-black">{u.status}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={()=>toggleApproval(u.id, u.status)} className="px-3 py-1 bg-blue-600 text-white rounded text-[10px] font-black uppercase">Flip Access</button>
                                    <button onClick={()=>deleteUser(u.id)} className="px-3 py-1 bg-red-600 text-white rounded text-[10px] font-black uppercase">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User History Modal */}
            {selectedUserHistory && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95">
                    <div className={`p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border ${bgClass}`}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-black uppercase italic">{selectedUserHistory} History</h3>
                            <button onClick={()=>setSelectedUserHistory(null)} className="text-2xl font-bold">✕</button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar space-y-3">
                            {userLogs.map(log => (
                                <div key={log.id} className="p-3 rounded-lg border bg-black/5">
                                    <div className="flex justify-between text-[10px] font-black opacity-50 mb-1">
                                        <span>{log.category} • {log.target}</span>
                                        <span>{formatTime(log.timestamp)}</span>
                                    </div>
                                    <p className="text-xs font-bold">{log.action}: {log.details}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DATA ENTRY ---
const BusInputForm = ({ showToast, darkMode, buses, isAdmin }: { showToast: any, darkMode: boolean, buses: any[], isAdmin: boolean }) => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    const [statusOptions, setStatusOptions] = useState<any[]>([]);

    useEffect(() => {
        return onSnapshot(doc(db, "settings", "status_options"), s => {
            if (s.exists()) setStatusOptions(s.data().list || []);
        });
    }, []);

    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleDateClick = (e: any) => e.target.showPicker?.();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        const today = new Date(); today.setHours(23,59,59,999);
        if (formData.oosStartDate && new Date(formData.oosStartDate) > today) return showToast("OOS Date cannot be in the future", "error");

        const busRef = doc(db, "buses", formData.number);
        const snap = await getDoc(busRef);
        if (!snap.exists()) return showToast("Bus not found. Add it first.", "error");

        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        await logHistory(formData.number, "UPDATE", `Status changed to ${formData.status}`, auth.currentUser?.email || 'Unknown');
        showToast(`Unit #${formData.number} Updated`, 'success');
        setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    };

    const resetAll = async () => {
        if (!confirm("Wipe all fleet status to Active?")) return;
        await Promise.all(buses.map(b => updateDoc(doc(db, "buses", b.docId), { status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() })));
        showToast("Fleet Reset Complete", "success");
    };

    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-black';

    return (
        <div className={`max-w-2xl mx-auto mt-10 p-8 rounded-2xl shadow-xl border-t-8 border-[#ef7c00] ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black italic uppercase">Data Entry</h2>
                {isAdmin && <button onClick={resetAll} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase">🚨 Reset All</button>}
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <input name="number" placeholder="Bus #" value={formData.number} onChange={handleChange} required className={`p-4 border-2 rounded-xl font-black outline-none focus:border-[#ef7c00] ${inputClass}`} />
                    <select name="status" value={formData.status} onChange={handleChange} className={`p-4 border-2 rounded-xl font-bold outline-none focus:border-[#ef7c00] ${inputClass}`}>
                        <option value="Active">Active</option>
                        {statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}
                    </select>
                </div>
                <input name="location" placeholder="Location" value={formData.location} onChange={handleChange} className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] ${inputClass}`} />
                <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} className={`w-full p-4 border-2 rounded-xl h-32 outline-none focus:border-[#ef7c00] ${inputClass}`} />
                <div className="grid grid-cols-3 gap-4">
                    {['oosStartDate', 'expectedReturnDate', 'actualReturnDate'].map(f => (
                        <div key={f}>
                            <label className="text-[9px] font-black uppercase opacity-50 block mb-1">{f.replace(/([A-Z])/g, ' $1')}</label>
                            <input name={f} type="date" onClick={handleDateClick} value={(formData as any)[f]} onChange={handleChange} className={`w-full p-2 border-2 rounded-lg text-xs font-bold ${inputClass}`} />
                        </div>
                    ))}
                </div>
                <button className="w-full py-4 bg-[#ef7c00] text-white rounded-xl font-black uppercase shadow-lg hover:bg-orange-600 transition-all">Update Unit</button>
            </form>
        </div>
    );
};

// --- MAIN APP ---
export default function FleetManager() {
    const [user, setUser] = useState<any>(null);
    const [userStatus, setUserStatus] = useState('loading');
    const [isAdmin, setIsAdmin] = useState(false);
    const [view, setView] = useState('inventory');
    const [inventoryMode, setInventoryMode] = useState('grid');
    const [buses, setBuses] = useState<any[]>([]);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [darkMode, setDarkMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [legalType, setLegalType] = useState<'privacy'|'about'|null>(null);
    const [toast, setToast] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const tvBoardRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string, type: 'success'|'error') => setToast({ message: msg, type });

    useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

    useEffect(() => {
        if (!user) { setUserStatus('loading'); return; }
        const master = ADMIN_EMAILS.includes(user.email?.toLowerCase());
        setIsAdmin(master);
        return onSnapshot(doc(db, "users", user.uid), s => {
            if (s.exists()) {
                setUserStatus(s.data().status);
                if (s.data().role === 'admin') setIsAdmin(true);
            } else {
                setDoc(doc(db, "users", user.uid), { email: user.email.toLowerCase(), status: 'pending', role: 'user', createdAt: serverTimestamp() });
                setUserStatus('pending');
            }
        });
    }, [user]);

    useEffect(() => {
        if (!user || userStatus !== 'approved') return;
        const qBuses = query(collection(db, "buses"), orderBy("number", "asc"));
        const qOpts = doc(db, "settings", "status_options");
        const uBuses = onSnapshot(qBuses, s => setBuses(s.docs.map(d => ({...d.data(), docId: d.id}))));
        const uOpts = onSnapshot(qOpts, s => { if(s.exists()) setStatusOptions(s.data().list || []); });
        return () => { uBuses(); uOpts(); };
    }, [user, userStatus]);

    const getStatusType = (label: string) => {
        const opt = statusOptions.find(o => o.label === label);
        return opt ? opt.type : 'hold';
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
        } catch(e: any) { showToast(e.message, "error"); }
    };

    if (!user) return (
        <div className="min-h-screen flex flex-col bg-slate-900">
            {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
            <div className="flex-grow flex items-center justify-center p-4">
                <form onSubmit={handleAuth} className="bg-slate-800 p-10 rounded-2xl w-full max-w-md border-t-[12px] border-[#ef7c00]">
                    <h2 className="text-3xl font-black text-white italic mb-8 uppercase text-center">{isSignUp ? 'Join Fleetflow' : 'Fleet Operations'}</h2>
                    <input className="w-full p-4 mb-4 rounded-xl bg-slate-900 border-2 border-slate-700 text-white outline-none focus:border-[#ef7c00]" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
                    <input className="w-full p-4 mb-6 rounded-xl bg-slate-900 border-2 border-slate-700 text-white outline-none focus:border-[#ef7c00]" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
                    <button className="w-full py-5 bg-[#ef7c00] text-white font-black uppercase rounded-xl shadow-lg">{isSignUp ? 'Register' : 'Login'}</button>
                    <button type="button" onClick={()=>setIsSignUp(!isSignUp)} className="w-full mt-6 text-slate-400 text-xs font-bold hover:text-white transition-colors">
                        {isSignUp ? 'Back to Login' : "Don't have an account? Sign Up"}
                    </button>
                </form>
            </div>
            <Footer onShowLegal={setLegalType} darkMode={true} />
        </div>
    );

    if (userStatus === 'pending') return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
            <h2 className="text-4xl font-black uppercase italic mb-4">Pending Approval</h2>
            <p className="opacity-50 font-bold mb-8">Administrators have been notified of your registration.</p>
            <button onClick={()=>signOut(auth)} className="px-10 py-4 bg-slate-800 rounded-xl font-black uppercase">Sign Out</button>
            <Footer onShowLegal={setLegalType} darkMode={true} />
        </div>
    );

    return (
        <div className={`flex flex-col min-h-screen transition-colors ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
            {legalType && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className={`p-8 rounded-2xl w-full max-w-lg shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                        <h3 className="text-2xl font-black uppercase mb-6">{legalType === 'privacy' ? 'Privacy Policy' : 'About Us'}</h3>
                        <p className="mb-8 opacity-70 leading-relaxed text-sm">
                            {legalType === 'privacy' 
                                ? "LLC Fleetflow Transit Solutions protects your data. Internal tracking is used strictly for maintenance and attendance efficiency. We do not sell user data." 
                                : "LLC Fleetflow Transit Solutions provides next-generation transit management software built for reliability, visibility, and speed."}
                        </p>
                        <button onClick={()=>setLegalType(null)} className="w-full py-3 bg-[#002d72] text-white rounded-xl font-black uppercase">Close</button>
                    </div>
                </div>
            )}

            <nav className={`backdrop-blur-md border-b sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
                <div className="flex items-center gap-2"><div className="w-2 h-6 bg-[#ef7c00] rounded-full"></div><span className="font-black italic uppercase">Fleet Manager</span></div>
                <div className="flex gap-4 items-center">
                    {['inventory', 'input', 'handover', 'parts'].concat(isAdmin ? ['analytics', 'admin'] : []).map(v => (
                        <button key={v} onClick={()=>setView(v)} className={`text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${view === v ? 'border-[#ef7c00] text-[#ef7c00]' : 'border-transparent text-slate-400'}`}>{v.replace('admin','panel')}</button>
                    ))}
                    <button onClick={()=>setDarkMode(!darkMode)} className="px-3 py-1 rounded-full border text-[10px]">{darkMode ? '☀️' : '🌙'}</button>
                    <button onClick={()=>signOut(auth)} className="text-red-500 font-black text-[10px] uppercase">Logout</button>
                </div>
            </nav>

            <main className="flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-6">
                {view === 'admin' ? <AccessManager showToast={showToast} darkMode={darkMode} /> :
                 view === 'input' ? <BusInputForm showToast={showToast} darkMode={darkMode} buses={buses} isAdmin={isAdmin} /> :
                 view === 'analytics' ? <div className="space-y-10"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={showToast} /></div> :
                 view === 'parts' ? <PartsInventory showToast={showToast} darkMode={darkMode} /> :
                 view === 'handover' ? <ShiftHandover buses={buses} showToast={showToast} /> : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {['Total', 'Ready', 'In Shop', 'Hold'].map(l => {
                                const count = l==='Total' ? buses.length : buses.filter(b=>l==='Ready'?b.status==='Active':getStatusType(b.status)===(l==='In Shop'?'shop':'hold')).length;
                                return (
                                    <div key={l} className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                        <p className="text-[10px] font-black uppercase opacity-50 mb-1">{l}</p>
                                        <p className={`text-4xl font-black ${l==='Ready'?'text-green-500':l==='In Shop'?'text-orange-500':l==='Hold'?'text-red-500':''}`}>{count}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between items-center mb-6">
                            <input className={`w-full max-w-md p-4 rounded-xl border-2 font-bold outline-none focus:border-[#ef7c00] ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} placeholder="Filter Unit #..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                            <div className="flex gap-2 p-1 border rounded-xl bg-black/5">
                                {['list', 'grid', 'tv'].map(m => <button key={m} onClick={()=>setInventoryMode(m)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${inventoryMode === m ? 'bg-[#ef7c00] text-white shadow' : 'text-slate-400'}`}>{m}</button>)}
                            </div>
                        </div>
                        
                        <div ref={tvBoardRef} className={`rounded-3xl border shadow-xl overflow-hidden min-h-[60vh] ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            {inventoryMode === 'tv' ? (
                                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                    {buses.filter(b => b.number.includes(searchTerm)).map(b => {
                                        const type = getStatusType(b.status);
                                        const color = type==='ready'?'text-green-500':type==='shop'?'text-orange-500':'text-red-500';
                                        const borderColor = type==='ready'?'border-green-500/30':type==='shop'?'border-orange-500/30':'border-red-500/30';
                                        return (
                                            <div key={b.docId} className={`p-6 rounded-2xl border-4 flex flex-col shadow-lg transition-transform hover:scale-105 ${borderColor} ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
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
                            ) : <div className="p-20 text-center opacity-20 font-black italic uppercase tracking-widest">Switch to TV Mode for live board</div>}
                        </div>
                    </>
                 )}
            </main>
            <Footer onShowLegal={setLegalType} darkMode={darkMode} />
        </div>
    );
}