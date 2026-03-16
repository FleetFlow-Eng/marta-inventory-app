import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, getDocs, where, setDoc } from "firebase/firestore";
import { formatTime, ADMIN_EMAILS } from '../utils';

export const AdminPanel = ({ showToast, darkMode }: { showToast: any, darkMode: boolean }) => {
    const [usersList, setUsersList] = useState<any[]>([]);
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [newStatus, setNewStatus] = useState({ label: '', type: 'hold' });
    const [selectedUserHistory, setSelectedUserHistory] = useState<string | null>(null);
    const [userLogs, setUserLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

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
    const updateRole = async (uid: string, newRole: string) => updateDoc(doc(db, "users", uid), { role: newRole });
    const deleteUser = async (uid: string) => { if (confirm("Delete user permanently?")) await deleteDoc(doc(db, "users", uid)); };
    
    const fetchUserHistory = async (email: string) => {
        setSelectedUserHistory(email);
        setLoadingLogs(true);
        try {
            const snap = await getDocs(query(collection(db, "activity_logs"), where("user", "==", email)));
            setUserLogs(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a:any, b:any) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
        } catch(e) { console.error(e); }
        setLoadingLogs(false);
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
                        {statusOptions.length === 0 && <p className="text-xs italic opacity-50">No custom statuses added yet.</p>}
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
                                    <td className="p-4 font-bold cursor-pointer text-[#ef7c00] hover:underline" onClick={()=>fetchUserHistory(u.email)}>
                                        {u.email} {isMaster && <span className="text-[8px] bg-purple-500 text-white px-1 py-0.5 rounded ml-2">MASTER</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${isMaster ? 'bg-purple-100 text-purple-700 border border-purple-200' : u.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : u.role === 'basic' ? 'bg-slate-200 text-slate-600 border border-slate-300' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                            {isMaster ? 'Master Admin' : u.role === 'admin' ? 'Admin' : u.role === 'basic' ? 'Basic (View)' : 'Standard'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase text-white ${u.status==='approved'||isMaster?'bg-green-500':'bg-orange-500'}`}>{u.status==='approved'||isMaster?'Approved':'Pending'}</span></td>
                                    <td className="p-4 pr-6">
                                        {!isMaster && (
                                            <div className="flex justify-end gap-2 items-center">
                                                <button onClick={()=>toggleApproval(u.id, u.status)} className={`px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm ${u.status==='approved'?'bg-orange-100 text-orange-700':'bg-green-500 text-white'}`}>{u.status==='approved'?'Revoke':'Approve'}</button>
                                                <select value={u.role || 'user'} onChange={(e)=>updateRole(u.id, e.target.value)} className={`px-2 py-1.5 rounded font-black text-[9px] uppercase outline-none shadow-sm border ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-200'}`}>
                                                    <option value="basic">Basic</option>
                                                    <option value="user">Standard</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                <button onClick={()=>deleteUser(u.id)} className="px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-sm bg-red-600 hover:bg-red-700 text-white">Delete</button>
                                            </div>
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
                            {loadingLogs ? (
                                <p className="text-center p-10 italic opacity-50 animate-pulse">Loading logs...</p>
                            ) : userLogs.length === 0 ? (
                                <p className="text-center p-10 italic opacity-50">No logs found.</p>
                            ) : userLogs.map(log => (
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