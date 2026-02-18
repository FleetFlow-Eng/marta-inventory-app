"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, addDoc, deleteDoc, getDoc, getDocs, limit, writeBatch, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

// Ensure partsData.json is in the same 'app' folder
import localParts from './partsData.json';

// --- DYNAMIC IMPORTS ---
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

// --- HELPER COMPONENTS ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-[3000] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 border-l-8 ${type === 'success' ? 'bg-white border-green-500 text-slate-800' : 'bg-white border-red-500 text-slate-800'}`}>
            <span className="text-2xl">{type === 'success' ? '✅' : '📋'}</span>
            <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{type === 'success' ? 'Success' : 'Notice'}</p><p className="text-sm font-bold text-slate-800">{message}</p></div>
        </div>
    );
};

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

// --- MODULE 1: PERSONNEL MANAGER ---
const PersonnelManager = ({ showToast }: { showToast: (msg: string, type: 'success'|'error') => void }) => {
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
        const q = query(collection(db, "personnel"), orderBy("name"));
        return onSnapshot(q, (snap) => setPersonnel(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    }, []);

    const allIncidents = useMemo(() => {
        let logs: any[] = [];
        personnel.forEach(p => {
            if (p.incidents) {
                p.incidents.forEach((inc: any) => {
                    logs.push({ ...inc, employeeName: p.name, employeeId: p.id });
                });
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
                const dateObj = new Date(inc.date);
                const month = monthNames[dateObj.getMonth()];
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
        return logs.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return logFilter.sort === 'asc' ? dateA - dateB : dateB - dateA;
        });
    }, [allIncidents, logFilter]);

    const jumpToLog = (typeFilter: string = 'All') => {
        setLogFilter(prev => ({ ...prev, type: typeFilter, search: '' }));
        setViewMode('log');
    };

    const filteredRoster = useMemo(() => {
        if (!rosterSearch) return stats.topOffenders;
        return stats.topOffenders.filter(p => p.name.toLowerCase().includes(rosterSearch.toLowerCase()));
    }, [stats.topOffenders, rosterSearch]);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newEmpName) return;
        try {
            await addDoc(collection(db, "personnel"), { name: newEmpName, totalOccurrences: 0, incidents: [], timestamp: serverTimestamp() });
            showToast(`Added ${newEmpName}`, 'success'); setNewEmpName(''); setShowAddModal(false);
        } catch(err) { showToast("Failed to add employee", 'error'); }
    };

    const handleLogIncident = async () => {
        const targetId = selectedEmp ? selectedEmp.id : selectedEmpId;
        if(!targetId) return showToast("Select an employee", 'error');
        try {
            const empRef = doc(db, "personnel", targetId);
            const newLog = {
                type: incData.type, date: incData.date || new Date().toISOString().split('T')[0],
                count: Number(incData.count), docReceived: incData.docReceived, supervisorReviewDate: incData.supervisorReviewDate, notes: incData.notes, loggedAt: new Date().toISOString()
            };
            await updateDoc(empRef, { totalOccurrences: increment(Number(incData.count)), incidents: arrayUnion(newLog) });
            showToast("Incident Saved", 'success'); setShowIncidentModal(false);
            setIncData({ type: 'Sick', date: '', count: 1, docReceived: false, supervisorReviewDate: '', notes: '' });
        } catch(err) { showToast("Failed to save", 'error'); }
    };

    const handleDeleteIncident = async (empId: string, incident: any) => {
        if(!confirm("Are you sure you want to permanently delete this incident record?")) return;
        try {
            const empRef = doc(db, "personnel", empId);
            const empSnap = await getDoc(empRef);
            if (!empSnap.exists()) return;
            const currentIncidents = empSnap.data().incidents || [];
            const updatedIncidents = currentIncidents.filter((i: any) => i.loggedAt !== incident.loggedAt);
            const newTotal = updatedIncidents.reduce((sum: number, i: any) => sum + (Number(i.count) || 0), 0);
            await updateDoc(empRef, { incidents: updatedIncidents, totalOccurrences: newTotal });
            showToast("Incident Deleted", 'success');
            if (selectedEmp && selectedEmp.id === empId) { setSelectedEmp({ ...selectedEmp, incidents: updatedIncidents, totalOccurrences: newTotal }); }
        } catch (err) { console.error(err); showToast("Delete Failed", 'error'); }
    };

    // --- NOTICE OF DISCIPLINE GENERATOR (STRICT MATCH) ---
    const handleExportWord = () => {
        if(!selectedEmp) return;
        
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const rollingIncidents = (selectedEmp.incidents || []).filter((inc:any) => {
            const d = new Date(inc.date);
            return d >= oneYearAgo;
        }).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let activePoints = 0;
        let incidentListHTML = "";
        
        rollingIncidents.forEach((inc: any, index: number) => {
            const points = parseInt(inc.count) || 0;
            activePoints += points;
            const d = new Date(inc.date);
            const formattedDate = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
            // Use paragraphs with non-breaking spaces for tab emulation
            incidentListHTML += `<p style="margin:0; margin-left: 40pt; font-family: 'Arial'; font-size: 11pt;">${index + 1}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${formattedDate}</p>`;
        });

        let disciplineLevel = "None";
        if(activePoints >= 3) disciplineLevel = "Verbal Warning";
        if(activePoints >= 4) disciplineLevel = "Written Warning";
        if(activePoints >= 5) disciplineLevel = "Final Written Warning";
        if(activePoints >= 6) disciplineLevel = "Discharge";

        // Reverse Name
        const nameParts = selectedEmp.name.split(' ');
        const formalName = nameParts.length > 1 ? `${nameParts[nameParts.length-1]}, ${nameParts[0]}` : selectedEmp.name;
        
        const today = new Date();
        const reportDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;

        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Notice of Discipline</title><style>
            @page { margin: 1.0in; }
            body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.15; color: #000000; }
            p { margin: 6pt 0; }
            .header-center { text-align: center; font-weight: bold; margin-top: 15pt; margin-bottom: 20pt; text-transform: uppercase; }
            .section-title { font-weight: bold; margin-left: 40pt; margin-top: 10pt; }
            .signatures { margin-top: 30pt; width: 100%; }
            .sig-line { border-bottom: 1px solid #000; width: 250px; display: inline-block; }
        </style></head><body>`;
        
        const content = `
            <table style="width:100%; border:none; margin-bottom:10pt;">
                <tr><td style="text-align:left;">TO: ${formalName}</td><td style="text-align:right;">DATE: ${reportDate}</td></tr>
            </table>

            <div class="header-center">
                <p>MARTA ATTENDANCE PROGRAM</p>
                <p>NOTICE OF DISCIPLINE</p>
            </div>

            <p>MARTA's Attendance Program states that an employee who accumulates excessive occurrences of absence within any twelve month period (rolling year) will be disciplined according to the following:</p>
            <br>
            
            <p style="margin-left: 40pt;">Number of Occurrences&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Level of Discipline</p>
            <p style="margin-left: 80pt;">1-2&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;None</p>
            <p style="margin-left: 80pt;">3&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Verbal Warning</p>
            <p style="margin-left: 80pt;">4&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Written Warning</p>
            <p style="margin-left: 80pt;">5&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Final Written Warning</p>
            <p style="margin-left: 80pt;">6&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Discharge</p>
            <br>

            <p>My records indicate that you have accumulated <strong>${activePoints} occurrences</strong> during the past rolling twelve months. The Occurrences are as follows:</p>

            <p style="margin-left: 40pt; font-weight:bold; text-decoration:underline;">Occurrences</p>
            ${incidentListHTML || '<p style="margin-left: 40pt;">None recorded.</p>'}
            <br>

            <p>Therefore, in accordance with the schedule of progressive discipline, this is your <strong>${disciplineLevel}</strong> for excessive absenteeism under the rule.</p>

            <p>Please be advised that your rate of absenteeism is not acceptable and YOUR corrective action is required. Additional occurrences will result in the progressive disciplinary action indicated above.</p>

            <p>If you have a personal problem that is affecting your attendance, it is recommended that you call Humana, MARTA's Employee Assistance Program (EAP), at 1-800-448-4358. MARTA sincerely hopes that you will improve your attendance and that further discipline will not be necessary.</p>
            <br>

            <div style="text-align:center; border-top:1px solid #000; border-bottom:1px solid #000; padding:3pt 0; width:50%; margin:auto; font-weight:bold; margin-top:20pt; margin-bottom:10pt;">ACKNOWLEDGEMENT</div>

            <p>I acknowledge receipt of this Notice of Discipline and that I have been informed of the help available to me through MARTA's EAP and of potential for progressive discipline, up to and including discharge.</p>
            <br><br>

            <table style="width:100%; border:none;">
                <tr>
                    <td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td>
                    <td style="width:5%;">&nbsp;</td>
                    <td style="width:45%; border-bottom:1px solid #000;">&nbsp;</td>
                </tr>
                <tr>
                    <td style="vertical-align:top;">Employee</td>
                    <td></td>
                    <td style="vertical-align:top;">Date</td>
                </tr>
            </table>
            <br>

            <table style="width:100%; border:none;">
                <tr>
                    <td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td>
                    <td style="width:5%;">&nbsp;</td>
                    <td style="width:45%; border-bottom:1px solid #000;">&nbsp;</td>
                </tr>
                <tr>
                    <td style="vertical-align:top;">Foreman/Supervisor/Superintendent</td>
                    <td></td>
                    <td style="vertical-align:top;">Date</td>
                </tr>
            </table>
            <br>

            <table style="width:100%; border:none;">
                <tr>
                    <td style="width:50%; border-bottom:1px solid #000;">&nbsp;</td>
                    <td style="width:5%;">&nbsp;</td>
                    <td style="width:45%; border-bottom:1px solid #000;">&nbsp;</td>
                </tr>
                <tr>
                    <td style="vertical-align:top;">General Foreman/Manager/General Superintendent</td>
                    <td></td>
                    <td style="vertical-align:top;">Date</td>
                </tr>
            </table>
        </body></html>`;

        const blob = new Blob(['\ufeff', header + content], { type: 'application/msword' });
        saveAs(blob, `${selectedEmp.name.replace(' ','_')}_Notice.doc`);
        showToast("Notice Generated", 'success');
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-[#ef7c00] selection:text-white">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            {selectedBusDetail && (<div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={triggerToast} /></div>)}

            <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm overflow-x-auto">
                <div className="flex items-center gap-2 flex-shrink-0"><div className="w-2 h-6 bg-[#002d72] rounded-full"></div><span className="font-black text-lg italic uppercase tracking-tighter text-[#002d72]">Fleet Manager</span></div>
                <div className="flex gap-4 items-center flex-nowrap">
                {['inventory', 'input', 'tracker', 'handover', 'parts'].concat(isAdmin ? ['analytics', 'personnel'] : []).map(v => (
                    <button key={v} onClick={() => setView(v as any)} className={`text-[9px] font-black uppercase tracking-widest border-b-2 pb-1 transition-all whitespace-nowrap ${view === v ? 'border-[#ef7c00] text-[#002d72]' : 'border-transparent text-slate-400 hover:text-[#002d72]'}`}>{v.replace('input', 'Data Entry').replace('parts', 'Parts List').replace('personnel', 'Personnel')}</button>
                ))}
                <button onClick={exportExcel} className="text-[#002d72] text-[10px] font-black uppercase hover:text-[#ef7c00] whitespace-nowrap">Excel</button>
                <button onClick={() => signOut(auth)} className="text-red-500 text-[10px] font-black uppercase whitespace-nowrap">Logout</button>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-4 md:p-6 overflow-x-hidden">
                {view === 'tracker' ? <div className="h-[85vh] bg-white rounded-2xl shadow-sm border overflow-hidden relative"><BusTracker /></div> :
                view === 'input' ? <BusInputForm showToast={triggerToast} /> :
                view === 'analytics' ? (isAdmin ? <div className="animate-in fade-in duration-500"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={triggerToast} /></div> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) :
                view === 'handover' ? <ShiftHandover buses={buses} showToast={triggerToast} /> :
                view === 'parts' ? <PartsInventory showToast={triggerToast} /> :
                view === 'personnel' ? (isAdmin ? <PersonnelManager showToast={triggerToast} /> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">{[{label:'Total Fleet',val:buses.length,c:'text-slate-900'},{label:'Ready',val:buses.filter(b=>b.status==='Active'||b.status==='In Shop').length,c:'text-green-600'},{label:'On Hold',val:buses.filter(b=>holdStatuses.includes(b.status)).length,c:'text-red-600'},{label:'In Shop',val:buses.filter(b=>b.status==='In Shop').length,c:'text-[#ef7c00]'}].map(m=>(<div key={m.label} onClick={()=>setActiveFilter(m.label)} className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col items-center cursor-pointer transition-all hover:scale-105 ${activeFilter===m.label?'border-[#002d72] bg-blue-50':'border-slate-100'}`}><p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">{m.label}</p><p className={`text-2xl font-black ${m.c}`}>{m.val}</p></div>))}</div>
                    <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4"><input type="text" placeholder="Search Unit #..." className="w-full max-w-md pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-[#002d72] text-black outline-none shadow-sm placeholder:text-gray-400" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /><div className="bg-white border rounded-lg p-1 flex w-full md:w-auto"><button onClick={()=>setInventoryMode('list')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded ${inventoryMode==='list'?'bg-[#002d72] text-white shadow-md':'text-slate-400'}`}>List</button><button onClick={()=>setInventoryMode('grid')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded ${inventoryMode==='grid'?'bg-[#002d72] text-white shadow-md':'text-slate-400'}`}>Grid</button></div></div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                        {inventoryMode === 'list' ? (<div className="overflow-x-auto"><div className="grid grid-cols-10 gap-4 p-5 border-b bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 tracking-widest min-w-[800px]"><div onClick={()=>requestSort('number')} className="cursor-pointer hover:text-[#002d72]">Unit #</div><div>Series</div><div>Status</div><div>Location</div><div className="col-span-2">Fault Preview</div><div>Exp Return</div><div>Act Return</div><div>Days OOS</div></div><div className="divide-y divide-slate-100 min-w-[800px]">{sortedBuses.map(b => (<div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`grid grid-cols-10 gap-4 p-5 items-center cursor-pointer hover:bg-slate-50 transition-all border-l-4 ${b.status==='Active'?'border-green-500':'border-red-500'}`}><div className="text-lg font-black text-[#002d72]">#{b.number}</div><div className="text-[9px] font-bold text-slate-400">{getBusSpecs(b.number).length}</div><div className={`text-[9px] font-black uppercase px-2 py-1 rounded-full w-fit ${b.status==='Active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{b.status}</div><div className="text-xs font-bold text-slate-600">{b.location||'—'}</div><div className="col-span-2 text-xs font-bold text-slate-500 truncate italic">{b.notes||'No faults.'}</div><div className="text-xs font-bold text-slate-700">{b.expectedReturnDate||'—'}</div><div className="text-xs font-bold text-slate-700">{b.actualReturnDate||'—'}</div><div className="text-xs font-black text-red-600">{b.status!=='Active' ? `${calculateDaysOOS(b.oosStartDate)} days` : '—'}</div></div>))}</div></div>) : (<div className="p-4 md:p-8 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">{sortedBuses.map(b => (<div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`h-14 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 shadow-sm ${b.status==='Active'?'bg-green-50 border-green-200 text-green-800':'bg-red-50 border-red-200 text-red-800'}`}><span className="text-xs font-black italic">#{b.number}</span>{b.status!=='Active'&&<span className="text-[7px] font-bold uppercase opacity-60 leading-none">{b.status}</span>}</div>))}</div>)}
                    </div>
                </>
                )}
            </main>
        </div>
    );
};

// --- COMPONENT: DATA ENTRY (Mobile Fixes) ---
const BusInputForm = ({ showToast }: { showToast: (m:string, t:'success'|'error')=>void }) => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const busRef = doc(db, "buses", formData.number); const busSnap = await getDoc(busRef);
        if (!busSnap.exists()) return showToast(`⛔ ACCESS DENIED: Bus #${formData.number} not in registry.`, 'error');
        const old = busSnap.data(); let changes = [];
        if (old.status !== formData.status) changes.push(`STATUS: ${old.status} ➝ ${formData.status}`);
        if (old.notes !== formData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${formData.notes}"`);
        if (old.oosStartDate !== formData.oosStartDate) changes.push(`OOS: ${old.oosStartDate || '—'} ➝ ${formData.oosStartDate}`);
        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        if (changes.length > 0) await logHistory(formData.number, "UPDATE", changes.join('\n'), auth.currentUser?.email || 'Unknown');
        else await logHistory(formData.number, "UPDATE", "Routine Update via Terminal", auth.currentUser?.email || 'Unknown');
        showToast(`Bus #${formData.number} Updated`, 'success'); setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '' });
    };
    return (
        <div className="max-w-2xl mx-auto mt-4 md:mt-10 p-6 md:p-8 bg-white rounded-2xl shadow-xl border-t-8 border-[#002d72] animate-in slide-in-from-bottom-4 duration-500"><h2 className="text-3xl font-black text-[#002d72] italic uppercase mb-8 text-center tracking-tighter">Data Entry Terminal</h2><form onSubmit={handleSubmit} className="space-y-6"><div className="grid grid-cols-2 gap-6"><input type="text" placeholder="Unit #" className="p-4 bg-white border-2 border-slate-200 rounded-xl font-black text-black outline-none focus:border-[#002d72] transition-colors placeholder:text-gray-400" value={formData.number} onChange={handleChange} name="number" required /><select className="p-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-black outline-none focus:border-[#002d72] transition-colors" value={formData.status} onChange={handleChange} name="status"><option value="Active">Ready for Service</option><option value="On Hold">Maintenance Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option></select></div><input type="text" placeholder="Location" className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-[#002d72] text-black transition-colors placeholder:text-gray-400" value={formData.location} onChange={handleChange} name="location" /><textarea placeholder="Maintenance Notes" className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl h-24 outline-none focus:border-[#002d72] text-black transition-colors placeholder:text-gray-400" value={formData.notes} onChange={handleChange} name="notes" /><div className="grid grid-cols-3 gap-4"><div><label className="text-[9px] font-black uppercase text-slate-400 block mb-1">OOS Date</label><input name="oosStartDate" type="date" className="w-full p-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold text-black" value={formData.oosStartDate} onChange={handleChange} /></div><div><label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Exp Return</label><input name="expectedReturnDate" type="date" className="w-full p-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold text-black" value={formData.expectedReturnDate} onChange={handleChange} /></div><div><label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Act Return</label><input name="actualReturnDate" type="date" className="w-full p-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold text-black" value={formData.actualReturnDate} onChange={handleChange} /></div></div><button className="w-full py-4 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded-xl font-black uppercase tracking-widest transition-all transform active:scale-95 shadow-lg">Update Record</button></form></div>
    );
};

// --- MAIN APPLICATION ---
export default function FleetManager() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'inventory' | 'tracker' | 'input' | 'analytics' | 'handover' | 'parts' | 'personnel'>('inventory');
  const [inventoryMode, setInventoryMode] = useState<'list' | 'grid'>('grid');
  const [buses, setBuses] = useState<any[]>([]);
  const [selectedBusDetail, setSelectedBusDetail] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'number', direction: 'asc' });
  const [activeFilter, setActiveFilter] = useState('Total Fleet');
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const holdStatuses = ['On Hold', 'Engine', 'Body Shop', 'Vendor', 'Brakes', 'Safety'];
  
  // ADMIN CHECK: Add your emails here
  const isAdmin = user && (
      user.email === 'anetowestfield@gmail.com' || 
      user.email === 'supervisor@fleet.com' ||
      user.email === 'admin@admin.com'
  );

  const triggerToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); };

  useEffect(() => { onAuthStateChanged(auth, u => setUser(u)); }, []);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, "buses"), orderBy("number", "asc")), s => setBuses(s.docs.map(d => ({...d.data(), docId: d.id})))); }, [user]);

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

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('OOS Detail');
    ws.columns = [{header:'Bus #',key:'number',width:10},{header:'Status',key:'status',width:15},{header:'Location',key:'location',width:15},{header:'Fault',key:'notes',width:30},{header:'OOS Start',key:'start',width:15}];
    buses.forEach(b => ws.addRow({number:b.number, status:b.status, location:b.location||'', notes:b.notes||'', start:b.oosStartDate||''}));
    const buf = await wb.xlsx.writeBuffer(); saveAs(new Blob([buf]), `Fleet_Status_Report.xlsx`);
    setToast({msg:"Excel Downloaded", type:'success'});
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#001a3d] p-4 relative overflow-hidden">
      <form onSubmit={async e => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); } catch(e){} }} className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[12px] border-[#ef7c00] relative z-10 animate-in fade-in zoom-in">
        <h2 className="text-4xl font-black text-[#002d72] italic mb-8 text-center leading-none uppercase">FLEET OPS</h2>
        <div className="space-y-4">
          <input className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-black placeholder:text-gray-400" placeholder="supervisor@fleet.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-black placeholder:text-gray-400" placeholder="password123" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button className="w-full bg-[#002d72] text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-[#ef7c00] transition-all transform active:scale-95 shadow-xl">Authorized Login</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-[#ef7c00] selection:text-white">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {selectedBusDetail && (<div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"><BusDetailView bus={selectedBusDetail} onClose={() => setSelectedBusDetail(null)} showToast={triggerToast} /></div>)}

      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0"><div className="w-2 h-6 bg-[#002d72] rounded-full"></div><span className="font-black text-lg italic uppercase tracking-tighter text-[#002d72]">Fleet Manager</span></div>
        <div className="flex gap-4 items-center flex-nowrap">
          {['inventory', 'input', 'tracker', 'handover', 'parts'].concat(isAdmin ? ['analytics', 'personnel'] : []).map(v => (
            <button key={v} onClick={() => setView(v as any)} className={`text-[9px] font-black uppercase tracking-widest border-b-2 pb-1 transition-all whitespace-nowrap ${view === v ? 'border-[#ef7c00] text-[#002d72]' : 'border-transparent text-slate-400 hover:text-[#002d72]'}`}>{v.replace('input', 'Data Entry').replace('parts', 'Parts List').replace('personnel', 'Personnel')}</button>
          ))}
          <button onClick={exportExcel} className="text-[#002d72] text-[10px] font-black uppercase hover:text-[#ef7c00] whitespace-nowrap">Excel</button>
          <button onClick={() => signOut(auth)} className="text-red-500 text-[10px] font-black uppercase whitespace-nowrap">Logout</button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6 overflow-x-hidden">
        {view === 'tracker' ? <div className="h-[85vh] bg-white rounded-2xl shadow-sm border overflow-hidden relative"><BusTracker /></div> :
         view === 'input' ? <BusInputForm showToast={triggerToast} /> :
         view === 'analytics' ? (isAdmin ? <div className="animate-in fade-in duration-500"><StatusCharts buses={buses} /><AnalyticsDashboard buses={buses} showToast={triggerToast} /></div> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) :
         view === 'handover' ? <ShiftHandover buses={buses} showToast={triggerToast} /> :
         view === 'parts' ? <PartsInventory showToast={triggerToast} /> :
         view === 'personnel' ? (isAdmin ? <PersonnelManager showToast={triggerToast} /> : <div className="p-20 text-center text-red-500 font-black">ACCESS DENIED</div>) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">{[{label:'Total Fleet',val:buses.length,c:'text-slate-900'},{label:'Ready',val:buses.filter(b=>b.status==='Active'||b.status==='In Shop').length,c:'text-green-600'},{label:'On Hold',val:buses.filter(b=>holdStatuses.includes(b.status)).length,c:'text-red-600'},{label:'In Shop',val:buses.filter(b=>b.status==='In Shop').length,c:'text-[#ef7c00]'}].map(m=>(<div key={m.label} onClick={()=>setActiveFilter(m.label)} className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col items-center cursor-pointer transition-all hover:scale-105 ${activeFilter===m.label?'border-[#002d72] bg-blue-50':'border-slate-100'}`}><p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">{m.label}</p><p className={`text-2xl font-black ${m.c}`}>{m.val}</p></div>))}</div>
            <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4"><input type="text" placeholder="Search Unit #..." className="w-full max-w-md pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-[#002d72] text-black outline-none shadow-sm placeholder:text-gray-400" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /><div className="bg-white border rounded-lg p-1 flex w-full md:w-auto"><button onClick={()=>setInventoryMode('list')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded ${inventoryMode==='list'?'bg-[#002d72] text-white shadow-md':'text-slate-400'}`}>List</button><button onClick={()=>setInventoryMode('grid')} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-black uppercase rounded ${inventoryMode==='grid'?'bg-[#002d72] text-white shadow-md':'text-slate-400'}`}>Grid</button></div></div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                {inventoryMode === 'list' ? (<div className="overflow-x-auto"><div className="grid grid-cols-10 gap-4 p-5 border-b bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 tracking-widest min-w-[800px]"><div onClick={()=>requestSort('number')} className="cursor-pointer hover:text-[#002d72]">Unit #</div><div>Series</div><div>Status</div><div>Location</div><div className="col-span-2">Fault Preview</div><div>Exp Return</div><div>Act Return</div><div>Days OOS</div></div><div className="divide-y divide-slate-100 min-w-[800px]">{sortedBuses.map(b => (<div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`grid grid-cols-10 gap-4 p-5 items-center cursor-pointer hover:bg-slate-50 transition-all border-l-4 ${b.status==='Active'?'border-green-500':'border-red-500'}`}><div className="text-lg font-black text-[#002d72]">#{b.number}</div><div className="text-[9px] font-bold text-slate-400">{getBusSpecs(b.number).length}</div><div className={`text-[9px] font-black uppercase px-2 py-1 rounded-full w-fit ${b.status==='Active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{b.status}</div><div className="text-xs font-bold text-slate-600">{b.location||'—'}</div><div className="col-span-2 text-xs font-bold text-slate-500 truncate italic">{b.notes||'No faults.'}</div><div className="text-xs font-bold text-slate-700">{b.expectedReturnDate||'—'}</div><div className="text-xs font-bold text-slate-700">{b.actualReturnDate||'—'}</div><div className="text-xs font-black text-red-600">{b.status!=='Active' ? `${calculateDaysOOS(b.oosStartDate)} days` : '—'}</div></div>))}</div></div>) : (<div className="p-4 md:p-8 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">{sortedBuses.map(b => (<div key={b.docId} onClick={()=>setSelectedBusDetail(b)} className={`h-14 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 shadow-sm ${b.status==='Active'?'bg-green-50 border-green-200 text-green-800':'bg-red-50 border-red-200 text-red-800'}`}><span className="text-xs font-black italic">#{b.number}</span>{b.status!=='Active'&&<span className="text-[7px] font-bold uppercase opacity-60 leading-none">{b.status}</span>}</div>))}</div>)}
                    </div>
                </>
                )}
            </main>
        </div>
    );
}