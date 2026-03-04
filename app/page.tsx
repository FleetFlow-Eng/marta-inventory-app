"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

// --- IMPORT COMPONENTS ---
import { Toast, LegalModal, Footer } from './components/SharedComponents';
import { PartsInventory } from './components/PartsInventory';
import { ShiftHandover } from './components/ShiftHandover';
import { AdminPanel } from './components/AdminPanel';
import { AnalyticsDashboard, StatusCharts } from './components/AnalyticsDashboard';
import { PersonnelManager } from './components/PersonnelManager';
import { BusInputForm } from './components/BusInputForm';
import { BusDetailView } from './components/BusDetailView';
import { DispositionReport } from './components/DispositionReport';
import { ADMIN_EMAILS, calculateDaysOOS, getBusSpecs } from './utils';

// --- DYNAMIC IMPORTS ---
const BusTracker = dynamic(() => import('./BusTracker'), { 
    ssr: false, 
    loading: () => <div className="flex items-center justify-center h-[50vh] bg-slate-100 rounded-2xl"><div className="w-12 h-12 border-4 border-[#002d72] border-t-transparent rounded-full animate-spin"></div></div> 
});

// --- ICONS (Inline SVGs for zero dependencies) ---
const Icons = {
    Grid: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    Edit: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    Map: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    Clipboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    Wrench: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    Route: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M15 6a9 9 0 0 0-9 9"/></svg>,
    Activity: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    Users: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    Menu: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
};

export default function FleetManager() {
    const [user, setUser] = useState<any>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [userStatus, setUserStatus] = useState<'loading' | 'approved' | 'pending' | 'rejected'>('loading');
    const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
    const [view, setView] = useState<'inventory' | 'tracker' | 'input' | 'analytics' | 'handover' | 'personnel' | 'parts' | 'disposition' | 'admin'>('inventory');
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
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
        const cols: any = [{header:'Bus #',key:'number',width:10},{header:'Status',key:'status',width:15},{header:'Location',key:'location',width:15},{header:'Fault',key:'notes',width:30},{header:'OOS Start',key:'start',width:15}];
        if (isAdmin) cols.push({header:'Disposition',key:'disposition',width:20});
        ws.columns = cols;
        buses.forEach(b => ws.addRow({number:b.number, status:b.status, location:b.location||'', notes:b.notes||'', start:b.oosStartDate||'', disposition: b.disposition||''}));
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

    // --- NAVIGATION STRUCTURE ---
    const navItems = [
        { id: 'inventory', label: 'Inventory', icon: <Icons.Grid />, adminOnly: false },
        { id: 'input', label: 'Data Entry', icon: <Icons.Edit />, adminOnly: false },
        { id: 'tracker', label: 'Live Map', icon: <Icons.Map />, adminOnly: false },
        { id: 'handover', label: 'Shift Report', icon: <Icons.Clipboard />, adminOnly: false },
        { id: 'parts', label: 'Parts DB', icon: <Icons.Wrench />, adminOnly: false },
        { id: 'disposition', label: 'Route Delivery', icon: <Icons.Route />, adminOnly: false },
        { id: 'analytics', label: 'Analytics', icon: <Icons.Activity />, adminOnly: true },
        { id: 'personnel', label: 'Personnel', icon: <Icons.Users />, adminOnly: true },
        { id: 'admin', label: 'Admin Panel', icon: <Icons.Shield />, adminOnly: true },
    ];

    if (!user) return (
        <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
            <div className="flex-grow flex items-center justify-center p-4">
                <form onSubmit={handleAuth} className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-[#ef7c00] animate-in fade-in zoom-in">
                    <div className="flex justify-center mb-6"><div className="w-4 h-10 bg-[#ef7c00] rounded-full mr-3"></div><h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">FleetFlow</h2></div>
                    <input className="w-full p-4 mb-4 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold outline-none focus:border-[#ef7c00] transition-colors" placeholder="Email Address" value={email} onChange={e=>setEmail(e.target.value)} required />
                    <input className="w-full p-4 mb-6 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold outline-none focus:border-[#ef7c00] transition-colors" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
                    <button className="w-full py-5 bg-[#ef7c00] text-white font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-orange-600 transition-colors">{isSignUp ? 'Register' : 'Login Securely'}</button>
                    <button type="button" onClick={()=>setIsSignUp(!isSignUp)} className="w-full mt-6 text-slate-400 text-xs font-bold hover:text-white transition-colors">{isSignUp ? 'Back to Login' : "Don't have an account? Sign Up"}</button>
                </form>
            </div>
            <Footer onShowLegal={setLegalType} darkMode={true} />
        </div>
    );

    if (userStatus === 'pending' || userStatus === 'rejected') return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center font-sans">
            <div className="bg-slate-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-red-500 animate-in zoom-in-95">
                <div className="flex justify-center mb-4"><Icons.Shield /></div>
                <h2 className="text-3xl font-black uppercase italic mb-4">Access Restricted</h2>
                <p className="opacity-50 font-bold mb-8">Your account is pending administrator approval. Please check back later.</p>
                <button onClick={()=>signOut(auth)} className="w-full py-4 bg-[#002d72] rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-colors">Sign Out</button>
            </div>
            <div className="absolute bottom-0 w-full"><Footer onShowLegal={setLegalType} darkMode={true} /></div>
        </div>
    );

    const activeNavStyles = darkMode ? 'bg-slate-800 text-[#ef7c00] border-l-4 border-[#ef7c00]' : 'bg-blue-50 text-[#002d72] border-l-4 border-[#002d72]';
    const inactiveNavStyles = darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white border-l-4 border-transparent' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent';

    return (
        <div className={`flex h-screen w-full font-sans overflow-hidden selection:bg-[#ef7c00] selection:text-white transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
            {selectedBusDetail && (<div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={showToast} darkMode={darkMode} isAdmin={isAdmin} statusOptions={statusOptions} /></div>)}
            {legalType && <LegalModal type={legalType} onClose={()=>setLegalType(null)} darkMode={darkMode} />}

            {/* --- DESKTOP SIDEBAR --- */}
            <aside className={`hidden md:flex flex-col w-64 flex-shrink-0 border-r ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {/* Logo Area */}
                <div className={`p-6 flex items-center gap-3 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="w-2 h-8 bg-[#ef7c00] rounded-full"></div>
                    <div>
                        <h1 className="font-black text-xl italic uppercase tracking-tighter leading-none">FleetFlow</h1>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Hamilton Division</p>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
                    <ul className="space-y-1 px-3">
                        {navItems.filter(item => !item.adminOnly || isAdmin).map(item => (
                            <li key={item.id}>
                                <button 
                                    onClick={() => setView(item.id as any)} 
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${view === item.id ? activeNavStyles : inactiveNavStyles}`}
                                >
                                    <span className={view === item.id ? 'opacity-100' : 'opacity-70'}>{item.icon}</span>
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Bottom Actions */}
                <div className={`p-4 border-t space-y-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <button onClick={exportExcel} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${darkMode ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        <Icons.Download /> Export Data
                    </button>
                    <div className="flex gap-2">
                        <button onClick={()=>setDarkMode(!darkMode)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors ${darkMode ? 'bg-slate-800 text-yellow-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                            {darkMode ? '☀️ Light' : '🌙 Dark'}
                        </button>
                        <button onClick={()=>signOut(auth)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors ${darkMode ? 'bg-red-900/20 text-red-400 border-red-900/30 hover:bg-red-900/40' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}>
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* --- MOBILE HEADER & DRAWER --- */}
            <div className={`md:hidden flex flex-col w-full h-full`}>
                <header className={`flex items-center justify-between p-4 border-b flex-shrink-0 z-50 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-[#ef7c00] rounded-full"></div>
                        <h1 className="font-black text-lg italic uppercase tracking-tighter">FleetFlow</h1>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button onClick={()=>setDarkMode(!darkMode)} className="text-xl">{darkMode ? '☀️' : '🌙'}</button>
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`p-2 rounded-lg ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-black'}`}>
                            <Icons.Menu />
                        </button>
                    </div>
                </header>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className={`absolute inset-0 top-[65px] z-40 flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-white'} animate-in slide-in-from-top-2 duration-200`}>
                        <nav className="flex-1 overflow-y-auto p-4">
                            <ul className="space-y-2">
                                {navItems.filter(item => !item.adminOnly || isAdmin).map(item => (
                                    <li key={item.id}>
                                        <button 
                                            onClick={() => { setView(item.id as any); setIsMobileMenuOpen(false); }} 
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl text-sm font-black uppercase tracking-widest ${view === item.id ? (darkMode ? 'bg-[#ef7c00] text-white' : 'bg-[#002d72] text-white') : (darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600')}`}
                                        >
                                            {item.icon} {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <div className={`p-6 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <button onClick={exportExcel} className={`w-full flex items-center justify-center gap-2 py-4 mb-3 rounded-xl text-sm font-black uppercase tracking-widest ${darkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`}><Icons.Download /> Export Data</button>
                            <button onClick={()=>signOut(auth)} className={`w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest ${darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>Logout</button>
                        </div>
                    </div>
                )}

                {/* Mobile Main Content Area */}
                <div className={`flex-1 overflow-hidden ${isMobileMenuOpen ? 'hidden' : 'block'}`}>
                    <main className="h-full overflow-y-auto p-4">
                        {/* --- CONTENT INJECTED HERE FOR MOBILE --- */}
                        {view === 'admin' ? <AdminPanel showToast={showToast} darkMode={darkMode} /> :
                         view === 'input' ? <BusInputForm showToast={showToast} darkMode={darkMode} buses={buses} isAdmin={isAdmin} statusOptions={statusOptions} /> :
                         view === 'analytics' ? <div className="space-y-10 animate-in fade-in duration-500"><StatusCharts buses={buses} statusOptions={statusOptions} darkMode={darkMode} /><AnalyticsDashboard buses={buses} showToast={showToast} darkMode={darkMode} /></div> :
                         view === 'parts' ? <PartsInventory showToast={showToast} darkMode={darkMode} /> :
                         view === 'handover' ? <ShiftHandover buses={buses} showToast={showToast} /> :
                         view === 'personnel' ? <PersonnelManager showToast={showToast} darkMode={darkMode} /> :
                         view === 'disposition' ? <DispositionReport showToast={showToast} darkMode={darkMode} isAdmin={isAdmin} /> :
                         view === 'tracker' ? <div className={`h-[80vh] rounded-2xl border shadow-sm overflow-hidden relative ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}><BusTracker /></div> : (
                            <InventoryView 
                                buses={buses} sortedBuses={sortedBuses} searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
                                inventoryMode={inventoryMode} setInventoryMode={setInventoryMode} activeFilter={activeFilter} 
                                setActiveFilter={setActiveFilter} sortConfig={sortConfig} requestSort={requestSort} 
                                getStatusType={getStatusType} setSelectedBusDetail={setSelectedBusDetail} 
                                toggleFullScreen={toggleFullScreen} isFullscreen={isFullscreen} tvBoardRef={tvBoardRef} 
                                darkMode={darkMode} isAdmin={isAdmin} 
                            />
                         )}
                    </main>
                </div>
            </div>

            {/* --- DESKTOP MAIN CONTENT AREA --- */}
            <main className="hidden md:block flex-1 h-full overflow-y-auto p-6 lg:p-10 relative">
                {view === 'admin' ? <AdminPanel showToast={showToast} darkMode={darkMode} /> :
                 view === 'input' ? <BusInputForm showToast={showToast} darkMode={darkMode} buses={buses} isAdmin={isAdmin} statusOptions={statusOptions} /> :
                 view === 'analytics' ? <div className="space-y-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"><StatusCharts buses={buses} statusOptions={statusOptions} darkMode={darkMode} /><AnalyticsDashboard buses={buses} showToast={showToast} darkMode={darkMode} /></div> :
                 view === 'parts' ? <PartsInventory showToast={showToast} darkMode={darkMode} /> :
                 view === 'handover' ? <ShiftHandover buses={buses} showToast={showToast} /> :
                 view === 'personnel' ? <PersonnelManager showToast={showToast} darkMode={darkMode} /> :
                 view === 'disposition' ? <DispositionReport showToast={showToast} darkMode={darkMode} isAdmin={isAdmin} /> :
                 view === 'tracker' ? <div className={`h-[85vh] rounded-2xl border shadow-sm overflow-hidden relative ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}><BusTracker /></div> : (
                    <InventoryView 
                        buses={buses} sortedBuses={sortedBuses} searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
                        inventoryMode={inventoryMode} setInventoryMode={setInventoryMode} activeFilter={activeFilter} 
                        setActiveFilter={setActiveFilter} sortConfig={sortConfig} requestSort={requestSort} 
                        getStatusType={getStatusType} setSelectedBusDetail={setSelectedBusDetail} 
                        toggleFullScreen={toggleFullScreen} isFullscreen={isFullscreen} tvBoardRef={tvBoardRef} 
                        darkMode={darkMode} isAdmin={isAdmin} 
                    />
                 )}
                 {view !== 'input' && view !== 'admin' && view !== 'personnel' && view !== 'analytics' && view !== 'disposition' && <div className="mt-12"><Footer onShowLegal={setLegalType} darkMode={darkMode} /></div>}
            </main>
        </div>
    );
}

// --- SUB-COMPONENT: INVENTORY VIEW (To keep code clean) ---
const InventoryView = ({ buses, sortedBuses, searchTerm, setSearchTerm, inventoryMode, setInventoryMode, activeFilter, setActiveFilter, sortConfig, requestSort, getStatusType, setSelectedBusDetail, toggleFullScreen, isFullscreen, tvBoardRef, darkMode, isAdmin }: any) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Fleet Inventory</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Live Status Board</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {['Total', 'Ready', 'In Shop', 'Hold'].map(l => {
                    const count = l==='Total' ? buses.length : buses.filter((b: any)=> {
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
            
            <div className="flex flex-col xl:flex-row justify-between items-end gap-4 mb-6">
                <input className={`w-full xl:max-w-md p-3 rounded-lg border-2 font-bold outline-none transition-colors focus:border-[#ef7c00] ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-slate-400'}`} placeholder="Search Unit #..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className={`flex w-full xl:w-auto gap-2 p-1 border rounded-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {['list', 'grid', 'tv'].map(m => <button key={m} onClick={()=>setInventoryMode(m as any)} className={`flex-1 xl:flex-none px-6 py-2 text-[10px] font-black uppercase rounded transition-all ${inventoryMode === m ? 'bg-[#ef7c00] text-white shadow-md' : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]')}`}>{m}</button>)}
                    {inventoryMode === 'tv' && <button onClick={toggleFullScreen} className={`flex-1 xl:flex-none px-4 py-2 text-[10px] font-black uppercase rounded transition-all flex items-center justify-center gap-1 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#002d72]'}`}>⛶ Fullscreen</button>}
                </div>
            </div>
            
            <div className={`rounded-3xl border shadow-xl overflow-hidden min-h-[500px] ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {inventoryMode === 'tv' && (
                    <div ref={tvBoardRef} className={`p-4 sm:p-6 overflow-y-auto custom-scrollbar min-h-[75vh] h-full ${isFullscreen ? (darkMode ? 'bg-slate-900' : 'bg-slate-100') : ''}`}>
                        {isFullscreen && (
                            <div className={`flex justify-between items-end mb-6 border-b-2 pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                                <div><h2 className="text-5xl font-black uppercase tracking-tighter text-[#ef7c00]">Fleet Status Board</h2><p className={`text-xl font-bold mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Units: {buses.length} | Down: <span className="text-red-500">{buses.filter((b:any)=>b.status!=='Active').length}</span></p></div>
                                <button onClick={toggleFullScreen} className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-2xl transition-all transform active:scale-95">Exit Fullscreen</button>
                            </div>
                        )}
                        <div className={`grid gap-4 sm:gap-6 pb-20 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'}`}>
                            {sortedBuses.map((b: any) => {
                                const type = getStatusType(b.status);
                                const color = type==='ready'?'text-green-500':type==='shop'?'text-orange-500':'text-red-500';
                                const borderColor = type==='ready'?'border-green-500/30':type==='shop'?'border-orange-500/30':'border-red-600/30';
                                return (
                                    <div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`cursor-pointer p-4 rounded-xl flex flex-col justify-between border-[3px] shadow-md transition-transform hover:scale-105 ${borderColor} ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
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
                        {sortedBuses.map((b: any) => {
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
                                {sortedBuses.map((b: any) => {
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
        </div>
    );
}