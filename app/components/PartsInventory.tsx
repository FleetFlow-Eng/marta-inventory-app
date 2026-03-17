import React, { useState, useMemo, useEffect, useRef } from 'react';
import localParts from '../partsData.json';

// --- SUB-COMPONENT: AI CAMERA SCANNER ---
const AICameraModal = ({ onAnalyze, onClose, darkMode }: { onAnalyze: (text: string) => void, onClose: () => void, darkMode: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Turn on the phone's rear camera
    useEffect(() => {
        let stream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera error:", err);
                alert("Please allow camera access to use the AI Part Finder.");
                onClose();
            }
        };
        startCamera();

        // Turn off camera when modal closes
        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [onClose]);

    const takePhotoAndAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        setIsAnalyzing(true);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current video frame onto the canvas
        const context = canvas.getContext('2d');
        if (context) context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to a base64 image string to send to the AI
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

      try {
            const response = await fetch('/api/analyze-part', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64 })
            });
            const data = await response.json();
            
            if (data.partName && data.partName !== "Unknown") {
                // If confidence is low, warn the user but still insert the guess
                if (data.confidence < 60) {
                    alert(`AI is only ${data.confidence}% sure. Double-check the result.\n\nReasoning: ${data.reasoning}`);
                }
                onAnalyze(data.partName);
            } else {
                alert("AI could not confidently identify this part. Try getting closer or improving lighting.");
                setIsAnalyzing(false);
            }
        } catch (error) {
            console.error("Analysis failed", error);
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in zoom-in-95 duration-200">
            <div className="w-full max-w-md relative flex flex-col items-center">
                
                <div className="w-full flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAnalyzing ? 'bg-purple-400' : 'bg-emerald-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${isAnalyzing ? 'bg-purple-500' : 'bg-emerald-500'}`}></span>
                        </span>
                        <h3 className={`font-black uppercase tracking-widest text-lg italic ${isAnalyzing ? 'text-purple-400' : 'text-emerald-400'}`}>
                            {isAnalyzing ? 'AI Processing...' : 'AI Part Lens'}
                        </h3>
                    </div>
                    <button onClick={onClose} disabled={isAnalyzing} className="text-white opacity-50 hover:opacity-100 font-bold text-2xl">✕</button>
                </div>
                
                {/* Camera Viewfinder */}
                <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_0_50px_#ef7c0044] border-2 border-slate-700 bg-black aspect-[3/4]">
                    <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isAnalyzing ? 'blur-sm opacity-50' : ''}`}></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>

                    {/* Sci-Fi Scanning Animation */}
                    {isAnalyzing && (
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            <div className="w-full h-1 bg-purple-500 shadow-[0_0_20px_#a855f7] animate-[scan_2s_ease-in-out_infinite]"></div>
                            <style>{`
                                @keyframes scan {
                                    0% { transform: translateY(0); }
                                    50% { transform: translateY(100vh); }
                                    100% { transform: translateY(0); }
                                }
                            `}</style>
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={takePhotoAndAnalyze} 
                    disabled={isAnalyzing}
                    className={`mt-8 w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isAnalyzing ? 'border-purple-500 bg-purple-500/20 scale-90' : 'border-emerald-500 bg-emerald-500/20 active:scale-95 shadow-[0_0_30px_#10b98166]'}`}
                >
                    <div className={`w-14 h-14 rounded-full ${isAnalyzing ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
                </button>
                <p className="text-slate-400 font-bold uppercase tracking-widest mt-6 text-xs text-center px-8">Center the part in the frame, ensure good lighting, and tap to analyze.</p>
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

    const handleAIResult = (identifiedPart: string) => {
        setSearchTerm(identifiedPart);
        setIsScanning(false);
        showToast(`AI Identified: ${identifiedPart}`, 'success');
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
            
            {/* AI CAMERA MODAL */}
            {isScanning && <AICameraModal onAnalyze={handleAIResult} onClose={() => setIsScanning(false)} darkMode={darkMode} />}

            {/* --- HEADER --- */}
            <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                    <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Parts Registry</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="text-emerald-500">✨ AI VISION ENABLED</span>
                    </p>
                </div>
                <div className={`px-5 py-2 rounded-2xl border font-black text-sm hidden sm:block ${bgClass}`}>
                    <span className="opacity-50 mr-2 text-[10px] uppercase">Results:</span>
                    {filteredParts.length}
                </div>
            </div>

            {/* --- SEARCH BAR WITH AI CAMERA BUTTON --- */}
            <div className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-md sm:shadow-xl flex gap-2 ${bgClass}`}>
                <div className="relative flex-grow">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 sm:text-xl opacity-30">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search part name or tap AI Lens..." 
                        className={`w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold sm:text-lg outline-none transition-all ${inputClass}`} 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <button 
                    onClick={() => setIsScanning(true)} 
                    className="px-4 sm:px-6 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-[0_0_15px_#10b98166] group"
                    title="AI Part Finder"
                >
                    {/* AI Sparkle Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform">
                        <path d="M12 3v3"></path>
                        <path d="M18.4 5.6l-2.1 2.1"></path>
                        <path d="M21 12h-3"></path>
                        <path d="M18.4 18.4l-2.1-2.1"></path>
                        <path d="M12 21v-3"></path>
                        <path d="M5.6 18.4l2.1-2.1"></path>
                        <path d="M3 12h3"></path>
                        <path d="M5.6 5.6l2.1 2.1"></path>
                        <circle cx="12" cy="12" r="4"></circle>
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