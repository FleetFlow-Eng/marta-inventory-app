import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from "firebase/firestore";

const INITIAL_ROUTES = [
    { route: "42 Pryor Road", planned: 4, cancelled: 1, unscheduled: 0 },
    { route: "49 McDonough Boulevard", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "55 Jonesboro Road", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "78 Cleveland Avenue", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "79 Sylvan Hills", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "81 Venetian Hills / Delowe Drive", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "82 Camp Creek / South Fulton Pkwy", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "83 Campleton Road", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "84 Washington Road / Camp Creek", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "89 Old National Highway", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "93 Headland Drive / Main Street", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "95 Metropolitan Parkway", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "155 Pittsburgh", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "162 Myrtle Drive / Alison Court", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "172 Sylvan Road / Virginia Avenue", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "178 Empire Boulevard", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "180 Roosevelt Highway", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "181 Washington Road / Fairburn", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "183 Greenbriar", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "188 Oakley Industrial", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "189 Flat Shoals Road / Scofield Road", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "191 Riverdale / ATL Intl Terminal", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "191 Old Dixie / Tara Boulevard", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "193 Morrow / Jonesboro", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "194 Conley Road / Mt Zion", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "195 Forest Parkway", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "197 Battle Creek Road", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "198 Southlake Parkway", planned: 6, cancelled: 2, unscheduled: 2 },
    { route: "295 Metropolitan Campus Express", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "800 Lovejoy", planned: 1, cancelled: 0, unscheduled: 0 },
    { route: "832 Grant Park", planned: 1, cancelled: 0, unscheduled: 0 }
];

export const DispositionReport = ({ showToast, darkMode, isAdmin }: { showToast: any, darkMode: boolean, isAdmin: boolean }) => {
    const [routes, setRoutes] = useState<any[]>([]);
    const [editRoute, setEditRoute] = useState<any>(null);
    const [editForm, setEditForm] = useState({ planned: 0, cancelled: 0, unscheduled: 0 });

    useEffect(() => {
        return onSnapshot(collection(db, "route_disposition"), (snap) => {
            const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            fetched.sort((a:any,b:any) => a.route.localeCompare(b.route, undefined, {numeric: true}));
            setRoutes(fetched);
        });
    }, []);

    const initializeRoutes = async () => {
        if (!confirm("Load default Hamilton routes?")) return;
        const batch = writeBatch(db);
        INITIAL_ROUTES.forEach(r => { batch.set(doc(collection(db, "route_disposition")), r); });
        await batch.commit(); showToast("Routes Initialized", "success");
    };

    const handleResetRoutes = async () => {
        if (!confirm("⚠️ WARNING: This will reset all route counts to their defaults. Proceed?")) return;
        showToast("Resetting routes...", "success");
        try {
            const batch = writeBatch(db);
            INITIAL_ROUTES.forEach(defaultRoute => {
                const existingDoc = routes.find(r => r.route === defaultRoute.route);
                if (existingDoc) batch.update(doc(db, "route_disposition", existingDoc.id), { planned: defaultRoute.planned, cancelled: defaultRoute.cancelled, unscheduled: defaultRoute.unscheduled });
            });
            await batch.commit(); showToast("Routes reset to defaults", "success");
        } catch (e) { showToast("Failed to reset routes", "error"); }
    };

    const handleSave = async () => {
        if (!editRoute) return;
        try {
            await updateDoc(doc(db, "route_disposition", editRoute.id), { planned: Number(editForm.planned), cancelled: Number(editForm.cancelled), unscheduled: Number(editForm.unscheduled) });
            showToast(`Updated ${editRoute.route}`, "success"); setEditRoute(null);
        } catch(e) { showToast("Failed to save", "error"); }
    };

    const totals = useMemo(() => {
        let planned = 0, cancelled = 0, unscheduled = 0;
        routes.forEach(r => { planned += (Number(r.planned) || 0); cancelled += (Number(r.cancelled) || 0); unscheduled += (Number(r.unscheduled) || 0); });
        const delivered = planned - cancelled + unscheduled;
        const percent = planned === 0 ? 0 : Math.round((delivered / Math.max(planned, 1)) * 100);
        return { planned, cancelled, unscheduled, delivered, percent };
    }, [routes]);

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Route Disposition</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Hamilton (C) • Fleet Delivery</p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && routes.length > 0 && <button onClick={handleResetRoutes} className="px-6 py-2.5 border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors w-full sm:w-auto">Reset Routes</button>}
                    {isAdmin && routes.length === 0 && <button onClick={initializeRoutes} className="px-6 py-2.5 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md w-full sm:w-auto">Init Routes</button>}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                <div className={`p-4 rounded-2xl border shadow-sm ${bgClass}`}><p className="text-[9px] font-black uppercase opacity-50 mb-1">Total Planned</p><p className="text-2xl sm:text-3xl font-black text-[#002d72]">{totals.planned}</p></div>
                <div className={`p-4 rounded-2xl border shadow-sm ${bgClass}`}><p className="text-[9px] font-black uppercase opacity-50 mb-1">Less Cancelled</p><p className="text-2xl sm:text-3xl font-black text-red-500">{totals.cancelled}</p></div>
                <div className={`p-4 rounded-2xl border shadow-sm ${bgClass}`}><p className="text-[9px] font-black uppercase opacity-50 mb-1">Unscheduled</p><p className="text-2xl sm:text-3xl font-black text-blue-500">{totals.unscheduled}</p></div>
                <div className={`p-4 rounded-2xl border shadow-sm ${bgClass}`}><p className="text-[9px] font-black uppercase opacity-50 mb-1">Total Delivered</p><p className="text-2xl sm:text-3xl font-black text-green-500">{totals.delivered}</p></div>
                <div className={`p-4 rounded-2xl border shadow-sm col-span-2 md:col-span-1 ${bgClass}`}><p className="text-[9px] font-black uppercase opacity-50 mb-1">Delivery %</p><p className={`text-2xl sm:text-3xl font-black ${totals.percent >= 100 ? 'text-green-500' : 'text-[#ef7c00]'}`}>{totals.percent}%</p></div>
            </div>

            {/* --- DESKTOP TABLE VIEW --- */}
            <div className={`hidden md:flex rounded-3xl shadow-lg border overflow-hidden flex-col ${bgClass}`}>
                <div className="overflow-x-auto flex-grow custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className={`font-black uppercase text-[10px] tracking-widest border-b ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            <tr><th className="p-4">Route</th><th className="p-4 text-center">Planned/Req</th><th className="p-4 text-center">Less Cancelled</th><th className="p-4 text-center">Unscheduled</th><th className="p-4 text-center">Delivered</th><th className="p-4 text-center">Delivery %</th></tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                            {routes.map((r) => {
                                const delivered = (Number(r.planned) || 0) - (Number(r.cancelled) || 0) + (Number(r.unscheduled) || 0);
                                const percent = (Number(r.planned) || 0) === 0 ? 0 : Math.round((delivered / (Number(r.planned) || 0)) * 100);
                                return (
                                    <tr key={r.id} onClick={() => { if(isAdmin) { setEditRoute(r); setEditForm({ planned: r.planned, cancelled: r.cancelled, unscheduled: r.unscheduled || 0 }); } }} className={`transition-colors ${isAdmin ? 'cursor-pointer' : ''} ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}>
                                        <td className="p-4 font-bold">{r.route}</td><td className="p-4 text-center font-black">{r.planned}</td><td className="p-4 text-center font-black text-red-500">{r.cancelled}</td><td className="p-4 text-center font-black text-blue-500">{r.unscheduled || 0}</td><td className="p-4 text-center font-black text-green-500">{delivered}</td><td className="p-4 text-center"><span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${percent >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{percent}%</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MOBILE CARD VIEW --- */}
            <div className="md:hidden flex flex-col gap-3 pb-10">
                {routes.map((r) => {
                    const delivered = (Number(r.planned) || 0) - (Number(r.cancelled) || 0) + (Number(r.unscheduled) || 0);
                    const percent = (Number(r.planned) || 0) === 0 ? 0 : Math.round((delivered / (Number(r.planned) || 0)) * 100);
                    return (
                        <div key={r.id} onClick={() => { if(isAdmin) { setEditRoute(r); setEditForm({ planned: r.planned, cancelled: r.cancelled, unscheduled: r.unscheduled || 0 }); } }} className={`p-5 rounded-2xl border shadow-sm ${isAdmin ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${bgClass}`}>
                            <div className="flex justify-between items-start mb-4 border-b pb-3 border-slate-500/20">
                                <h3 className="font-black text-sm tracking-tight w-2/3">{r.route}</h3>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${percent >= 100 ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{percent}%</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}><p className="text-[8px] font-black uppercase opacity-50">Req</p><p className="text-sm font-black">{r.planned}</p></div>
                                <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-900/20' : 'bg-red-50'}`}><p className="text-[8px] font-black uppercase text-red-500 opacity-70">Cxl</p><p className="text-sm font-black text-red-500">{r.cancelled}</p></div>
                                <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}><p className="text-[8px] font-black uppercase text-blue-500 opacity-70">Ext</p><p className="text-sm font-black text-blue-500">{r.unscheduled || 0}</p></div>
                                <div className={`p-2 rounded-lg ${darkMode ? 'bg-green-900/20' : 'bg-green-50'}`}><p className="text-[8px] font-black uppercase text-green-500 opacity-70">Del</p><p className="text-sm font-black text-green-500">{delivered}</p></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {editRoute && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <div className={`p-8 rounded-3xl w-full max-w-md shadow-2xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-black'}`}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-500/20">
                            <h3 className={`text-xl font-black uppercase leading-tight w-5/6 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{editRoute.route}</h3>
                            <button onClick={() => setEditRoute(null)} className="text-2xl font-bold hover:text-red-500">✕</button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div><label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Planned / Required</label><input type="number" className={`w-full p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#ef7c00]/50 ${inputClass}`} value={editForm.planned} onChange={e => setEditForm({...editForm, planned: Number(e.target.value)})} /></div>
                            <div><label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Less Cancelled</label><input type="number" className={`w-full p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-red-500/50 ${inputClass}`} value={editForm.cancelled} onChange={e => setEditForm({...editForm, cancelled: Number(e.target.value)})} /></div>
                            <div><label className="text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1">Unscheduled (Extras)</label><input type="number" className={`w-full p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/50 ${inputClass}`} value={editForm.unscheduled} onChange={e => setEditForm({...editForm, unscheduled: Number(e.target.value)})} /></div>
                        </div>
                        <div className="flex gap-4"><button onClick={() => setEditRoute(null)} className={`w-1/2 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-black'}`}>Cancel</button><button onClick={handleSave} className="w-1/2 py-4 bg-[#002d72] hover:bg-blue-800 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-colors">Save Route</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};