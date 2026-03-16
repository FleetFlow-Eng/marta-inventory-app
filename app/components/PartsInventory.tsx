import React, { useState, useMemo, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import localParts from '../partsData.json';

// --- SUB-COMPONENT: MOBILE CAMERA SCANNER ---
const ScannerModal = ({ onScan, onClose, darkMode }: { onScan: (text: string) => void, onClose: () => void, darkMode: boolean }) => {
    useEffect(() => {
        // Initialize the scanner on the 'reader' div
        const html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 100 } }; // Wide box for barcodes

        html5QrCode.start(
            { facingMode: "environment" }, // Forces the rear camera
            config,
            (decodedText) => {
                // Success! Stop the camera and pass the text back
                html5QrCode.stop().then(() => onScan(decodedText)).catch(console.error);
            },
            (errorMessage) => {
                // Background scan errors happen constantly while searching for a code, ignore them
            }
        ).catch((err) => {
            console.error("Camera permission denied or not supported.", err);
            alert("Camera access is required to scan barcodes.");
            onClose();
        });

        // Cleanup: Stop camera when modal is closed
        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(console.error);
            }
        };
    }, [onScan, onClose]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in zoom-in-95 duration-200">
            <div className="w-full max-w-md relative flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-4">
                    <h3 className="text-white font-black uppercase tracking-widest text-lg italic">Scan Part Barcode</h3>
                    <button onClick={onClose} className="text-red-500 font-black uppercase tracking-widest text-xs bg-red-500/20 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-colors">Cancel</button>
                </div>
                
                {/* The camera feed injects here */}
                <div id="reader" className="w-full rounded-3xl overflow-hidden shadow-[0_0_50px_#ef7c00] border-4 border-[#ef7c00]/50 bg-black min-h-[300px]"></div>
                
                <p className="text-[#ef7c00] font-black uppercase tracking-widest mt-8 animate-pulse text-sm">Align Barcode within frame...</p>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT: PARTS INVENTORY ---
export const PartsInventory = ({ showToast, darkMode }: { showToast: (msg: string, type: 'success'|'error') => void, darkMode: boolean }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [displayLimit, setDisplayLimit] = useState(100);
    const [isScanning, setIsScanning] = useState(false);

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
    const inputClass = darkMode ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-2 focus:ring-[#ef7c00]/50' : 'bg-slate-50 border-slate-200 text-black focus:ring-2 focus:ring-[#002d72]/30';

    const handleCopy = (num: string) => {
        navigator.clipboard.writeText(num);
        showToast(`Part #${num} copied!`, 'success');
    };

    const handleScanResult = (scannedText: string) => {
        // Clean up the scanned text (sometimes scanners pick up extra spaces)
        const cleanText = scannedText.trim();
        setSearchTerm(cleanText);
        setIsScanning(false);
        showToast(`Scanned: ${cleanText}`, 'success');
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
            
            {/* SCANNER MODAL */}
            {isScanning && <ScannerModal onScan={handleScanResult} onClose={() => setIsScanning(false)} darkMode={darkMode} />}

            {/* --- HEADER --- */}
            <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Parts Registry</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tap to copy part number</p>
                </div>
                <div className={`px-5 py-2 rounded-2xl border font-black text-sm hidden sm:block ${bgClass}`}>
                    <span className="opacity-50 mr-2 text-[10px] uppercase">Results:</span>
                    {filteredParts.length}
                </div>
            </div>

            {/* --- SEARCH BAR WITH CAMERA BUTTON --- */}
            <div className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-md sm:shadow-xl flex gap-2 ${bgClass}`}>
                <div className="relative flex-grow">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 sm:text-xl opacity-30">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search by part number or description..." 
                        className={`w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold sm:text-lg outline-none transition-all ${inputClass}`} 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <button 
                    onClick={() => setIsScanning(true)} 
                    className="px-4 sm:px-6 bg-[#002d72] hover:bg-[#ef7c00] text-white rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors shadow-lg group"
                    title="Scan Barcode"
                >
                    {/* Camera Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                </button>
            </div>

            {/* --- DESKTOP LIST VIEW --- */}
            <div className={`hidden md:flex flex-col flex-grow overflow-hidden rounded-3xl border shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="overflow-y-auto custom-scrollbar flex-grow">
                    <table className="w-full text-left border-collapse">
                        <thead className={`sticky top-0 z-10 border-b shadow-sm ${darkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            <tr>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest w-40">Part Number</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Description</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest w-24 text-center">Image</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {filteredParts.map((p: any, i: number) => (
                                <tr key={i} onClick={() => handleCopy(p.partNumber)} className={`group cursor-pointer transition-all duration-150 ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-blue-50/50'}`}>
                                    <td className="p-5"><span className={`font-mono font-black text-sm px-3 py-1.5 rounded-lg transition-colors group-active:bg-[#ef7c00] group-active:text-white ${darkMode ? 'bg-slate-800 text-[#ef7c00]' : 'bg-orange-50 text-[#ef7c00]'}`}>{p.partNumber}</span></td>
                                    <td className={`p-5 font-bold uppercase text-sm tracking-tight leading-relaxed ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{p.name}</td>
                                    <td className="p-5 text-center">
                                        <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex p-2.5 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MOBILE STACKED VIEW --- */}
            <div className="md:hidden flex flex-col gap-3 pb-10">
                {filteredParts.map((p: any, i: number) => (
                    <div key={i} onClick={() => handleCopy(p.partNumber)} className={`flex flex-col p-4 rounded-2xl border shadow-sm active:scale-[0.98] transition-transform ${bgClass}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`font-mono font-black text-sm px-3 py-1.5 rounded-lg ${darkMode ? 'bg-slate-800 text-[#ef7c00]' : 'bg-orange-50 text-[#ef7c00]'}`}>#{p.partNumber}</span>
                            <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name + " " + p.partNumber + " bus part")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </a>
                        </div>
                        <h4 className={`font-bold uppercase text-sm leading-snug ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{p.name}</h4>
                    </div>
                ))}
                {filteredParts.length === 0 && <p className="text-center italic opacity-50 p-10 font-bold">No parts match your search.</p>}
            </div>

            {/* --- LOAD MORE --- */}
            {filteredParts.length >= displayLimit && (
                <div className="flex justify-center pb-10">
                    <button onClick={() => setDisplayLimit(prev => prev + 100)} className={`px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${darkMode ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700' : 'bg-white border-2 border-slate-200 hover:border-[#002d72] hover:text-[#002d72] shadow-md'}`}>Load More Results</button>
                </div>
            )}
        </div>
    );
};