import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, onSnapshot, doc, serverTimestamp, addDoc, deleteDoc, getDoc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { logActivity } from '../utils';
import { saveAs } from 'file-saver';

export const PersonnelManager = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
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

    // --- THE FIX: Fetch raw data and sort locally to bypass Firebase Index errors ---
    useEffect(() => { 
        const unsubscribe = onSnapshot(collection(db, "personnel"), (snap) => {
            const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            // Sort locally instead of using orderBy("name")
            raw.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
            setPersonnel(raw);
        }, (error) => {
            console.error("Firebase fetch error in Personnel:", error);
        }); 
        return () => unsubscribe();
    }, []);
    
    const handleDateClick = (e: any) => e.currentTarget.showPicker?.();

    const allIncidents = useMemo(() => {
        let logs: any[] = []; 
        personnel.forEach(p => { 
            if (p.incidents) p.incidents.forEach((inc: any) => logs.push({ ...inc, employeeName: p.name, employeeId: p.id })); 
        });
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
        if (logFilter.search) logs = logs.filter(l => (l.employeeName||'').toLowerCase().includes(logFilter.search.toLowerCase()));
        if (logFilter.type !== 'All') logs = logs.filter(l => l.type === logFilter.type);
        return logs.sort((a, b) => {
            let aVal = a[sortConfig.key]; let bVal = b[sortConfig.key];
            if (sortConfig.key === 'date') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); } 
            else if (sortConfig.key === 'count') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; } 
            else if (typeof aVal === 'string') { aVal = (aVal||'').toLowerCase(); bVal = (bVal||'').toLowerCase(); }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [allIncidents, logFilter, sortConfig]);

    const filteredRoster = useMemo(() => { 
        if (!rosterSearch) return stats.topOffenders; 
        return stats.topOffenders.filter(p => (p.name||'').toLowerCase().includes(rosterSearch.toLowerCase())); 
    }, [stats.topOffenders, rosterSearch]);

    const jumpToLog = (typeFilter: string = 'All') => { setLogFilter(prev => ({ ...prev, type: typeFilter, search: '' })); setViewMode('log'); };
    const requestSort = (key: string) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    const SortArrow = ({ columnKey }: { columnKey: string }) => sortConfig.key !== columnKey ? <span className="opacity-30 inline-block ml-1">↕</span> : <span className="inline-block ml-1 text-[#ef7c00]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;

    const handleAddEmployee = async (e: React.FormEvent) => { 
        e.preventDefault(); if(!newEmpName) return; 
        try { 
            await addDoc(collection(db, "personnel"), { name: newEmpName, totalOccurrences: 0, incidents: [], timestamp: serverTimestamp() }); 
            await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', newEmpName, 'CREATED', `Added new employee record`); 
            showToast(`Added ${newEmpName}`, 'success'); 
            setNewEmpName(''); 
            setShowAddModal(false); 
        } catch(err) { showToast("Failed to add employee", 'error'); } 
    };

    const handleDeleteEmployee = async (empId: string, empName: string) => {
        if(!confirm(`Are you sure you want to completely delete ${empName}? This action cannot be undone.`)) return;
        try { 
            await deleteDoc(doc(db, "personnel", empId)); 
            await logActivity(auth.currentUser?.email || 'Unknown', 'PERSONNEL', empName, 'DELETED', `Deleted entire employee profile.`); 
            showToast(`${empName} deleted.`, 'success'); 
            setSelectedEmp(null); 
        } catch(err) { showToast("Failed to delete employee", 'error'); }
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
            const points = parseInt(inc.count) || 0; activePoints += points; const d = new Date(inc.date);
            incidentListHTML += `<p style="margin:0; margin-left: 60pt; font-family: 'Arial'; font-size: 10pt;">${index + 1}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} - ${inc.type}</p>`;
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
        </div>
    );
};