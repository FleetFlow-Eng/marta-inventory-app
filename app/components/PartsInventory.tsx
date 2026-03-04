import React, { useState, useMemo } from 'react';
import localParts from '../partsData.json';

export const PartsInventory = ({ showToast, darkMode }: { showToast: (msg: string, type: 'success'|'error') => void, darkMode: boolean }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [displayLimit, setDisplayLimit] = useState(100);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredParts = useMemo(() => {
        let r = localParts;
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            r = r.filter((p: any) => 
                (p.partNumber && String(p.partNumber).toLowerCase().includes(lowSearch)) || 
                (p.name && String(p.name).toLowerCase().includes(lowSearch))
            );
        }
        return r.slice(0, displayLimit);
    }, [searchTerm, displayLimit]);

    const bgClass = darkMode ? 'bg-slate-900/50 border-slate-800/50 backdrop-blur-xl' : 'bg-white/80 border-slate-200/50 backdrop-blur-xl';
    const inputClass = darkMode 
        ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-2 focus:ring-[#ef7c00]/50' 
        : 'bg-slate-50 border-slate-200 text-black focus:ring-2 focus:ring-[#002d72]/30';

    const handleCopy = (num: string) => {
        navigator.clipboard.writeText(num);
        showToast(`Part #${num} copied!`, 'success');
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col space-y-6 max-w-[1600px] mx-auto">
            {/* --- HEADER & STATS --- */}
            <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Parts Registry</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Hamilton Parts & Inventory</p>
                </div>
                
                <div className="flex gap-4 items-center">
                    <div className={`px-4 py-2 rounded-xl border flex flex-col items-center min-w-[100px] ${bgClass}`}>
                        <span className="text-[9px] font-black uppercase opacity-50">Database</span>
                        <span className="text-lg font-black">{localParts.length}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-xl border flex flex-col items-center min-w-[100px] ${bgClass}`}>
                        <span className="text-[9px] font-black uppercase opacity-50">Filtered</span>
                        <span className="text-lg font-black text-[#ef7c00]">{filteredParts.length}</span>
                    </div>
                </div>
            </div>

            {/* --- SEARCH BAR --- */}
            <div className={`p-4 rounded-2xl border shadow-lg flex flex-col md:flex-row gap-4 items-center ${bgClass}`}>
                <div className="relative flex-grow w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search by part number or keyword (e.g. Brake, Filter, Sensor)..." 
                        className={`w-full pl-10 pr-4 py-3.5 rounded-xl font-bold outline-none transition-all ${inputClass}`} 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setViewMode('grid')} 
                        className={`flex-1 md:w-12 h-12 flex items-center justify-center rounded-xl border transition-all ${viewMode === 'grid' ? 'bg-[#ef7c00] text-white border-[#ef7c00]' : 'bg-slate-500/10 text-slate-500 border-transparent hover:bg-slate-500/20'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    </button>
                    <button 
                        onClick={() => setViewMode('list')} 
                        className={`flex-1 md:w-12 h-12 flex items-center justify-center rounded-xl border transition-all ${viewMode === 'list' ? 'bg-[#ef7c00] text-white border-[#ef7c00]' : 'bg-slate-500/10 text-slate-500 border-transparent hover:bg-slate-500/20'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </button>
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-grow overflow-hidden relative">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 overflow-y-auto h-full pb-10 pr-2 custom-scrollbar">
                        {filteredParts.map((p: any, i: number) => (
                            <div key={i} className={`group p-5 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${darkMode ? 'bg-slate-800/40 border-slate-700 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div 
                                        onClick={() => handleCopy(p.partNumber)}
                                        className={`cursor-pointer px-3 py-1.5 rounded-lg font-mono font-black text-xs transition-all ${darkMode ? 'bg-slate-900 text-[#ef7c00] hover:bg-slate-950' : 'bg-orange-50 text-[#ef7c00] hover:bg-orange-100'}`}
                                    >
                                        #{p.partNumber}
                                    </div>
                                    <a 
                                        href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </a>
                                </div>
                                <h4 className={`text-sm font-black uppercase leading-tight line-clamp-2 h-10 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {p.name}
                                </h4>
                                <div className="mt-4 pt-4 border-t border-slate-500/10 flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Hamilton Stock</span>
                                    <span className="text-[10px] font-bold text-emerald-500">Available</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* LIST VIEW */
                    <div className={`rounded-2xl border shadow-xl overflow-hidden h-full flex flex-col ${bgClass}`}>
                        <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className={`font-black uppercase text-[10px] tracking-widest border-b sticky top-0 z-10 ${darkMode ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    <tr>
                                        <th className="p-5">Part Number</th>
                                        <th className="p-5">Description</th>
                                        <th className="p-5 text-center">Visuals</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                    {filteredParts.map((p: any, i: number) => (
                                        <tr key={i} className={`transition-colors duration-200 ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-blue-50/50'}`}>
                                            <td className="p-5">
                                                <button 
                                                    onClick={() => handleCopy(p.partNumber)}
                                                    className={`font-mono font-black px-3 py-1.5 rounded-lg text-xs ${darkMode ? 'bg-slate-900 text-[#ef7c00]' : 'bg-orange-50 text-[#ef7c00]'}`}
                                                >
                                                    {p.partNumber}
                                                </button>
                                            </td>
                                            <td className={`p-5 font-black uppercase text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{p.name}</td>
                                            <td className="p-5 text-center">
                                                <a 
                                                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="inline-flex p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* --- INFINITE SCROLL / LOAD MORE SIMULATION --- */}
            {filteredParts.length >= displayLimit && (
                <div className="flex justify-center pb-10">
                    <button 
                        onClick={() => setDisplayLimit(prev => prev + 100)} 
                        className={`px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white border-2 border-slate-200 hover:border-[#002d72] hover:text-[#002d72] shadow-sm'}`}
                    >
                        Load More Results
                    </button>
                </div>
            )}
        </div>
    );
};