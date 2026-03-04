import React, { useState, useMemo } from 'react';
import localParts from '../partsData.json';

export const PartsInventory = ({ showToast, darkMode }: { showToast: (msg: string, type: 'success'|'error') => void, darkMode: boolean }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [displayLimit, setDisplayLimit] = useState(100);

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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col space-y-6 max-w-[1400px] mx-auto">
            {/* --- HEADER --- */}
            <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Parts Registry</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Click any row to copy part number</p>
                </div>
                <div className={`px-5 py-2 rounded-2xl border font-black text-sm ${bgClass}`}>
                    <span className="opacity-50 mr-2 text-[10px] uppercase">Results:</span>
                    {filteredParts.length}
                </div>
            </div>

            {/* --- SEARCH BAR --- */}
            <div className={`p-4 rounded-3xl border shadow-xl ${bgClass}`}>
                <div className="relative w-full">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search by part number or full description..." 
                        className={`w-full pl-14 pr-6 py-4 rounded-2xl font-bold text-lg outline-none transition-all ${inputClass}`} 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            {/* --- LIST VIEW (No Cards) --- */}
            <div className={`flex-grow overflow-hidden rounded-3xl border shadow-2xl flex flex-col ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="overflow-y-auto custom-scrollbar flex-grow">
                    <table className="w-full text-left border-collapse">
                        <thead className={`sticky top-0 z-10 border-b shadow-sm ${darkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            <tr>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest w-40">Part Number</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Description</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest w-20 text-center">Preview</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {filteredParts.map((p: any, i: number) => (
                                <tr 
                                    key={i} 
                                    onClick={() => handleCopy(p.partNumber)}
                                    className={`group cursor-pointer transition-all duration-150 ${darkMode ? 'hover:bg-[#ef7c00]/5' : 'hover:bg-blue-50/50'}`}
                                >
                                    <td className="p-5">
                                        <span className={`font-mono font-black text-sm px-3 py-1.5 rounded-lg transition-colors group-active:bg-[#ef7c00] group-active:text-white ${darkMode ? 'bg-slate-800 text-[#ef7c00]' : 'bg-orange-50 text-[#ef7c00]'}`}>
                                            {p.partNumber}
                                        </span>
                                    </td>
                                    <td className={`p-5 font-bold uppercase text-sm tracking-tight leading-relaxed ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                        {p.name}
                                    </td>
                                    <td className="p-5 text-center">
                                        <a 
                                            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            onClick={(e) => e.stopPropagation()} // Prevent copying when just trying to view image
                                            className="inline-flex p-2.5 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredParts.length === 0 && (
                        <div className="p-20 text-center flex flex-col items-center">
                            <span className="text-4xl mb-4 opacity-20">⚙️</span>
                            <p className="font-bold opacity-40 uppercase tracking-widest text-xs">No parts match your search</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- LOAD MORE --- */}
            {filteredParts.length >= displayLimit && (
                <div className="flex justify-center pb-10">
                    <button 
                        onClick={() => setDisplayLimit(prev => prev + 100)} 
                        className={`px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${darkMode ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700' : 'bg-white border-2 border-slate-200 hover:border-[#002d72] hover:text-[#002d72] shadow-md'}`}
                    >
                        Load More Results
                    </button>
                </div>
            )}
        </div>
    );
};