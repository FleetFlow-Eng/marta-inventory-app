import React, { useEffect } from 'react';

export const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-[9999] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 border-l-8 ${type === 'success' ? 'bg-white border-green-500 text-slate-800' : 'bg-white border-red-500 text-slate-800'}`}>
            <span className="text-2xl">{type === 'success' ? '✅' : '📋'}</span>
            <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{type === 'success' ? 'Success' : 'Notice'}</p><p className="text-sm font-bold text-slate-800">{message}</p></div>
        </div>
    );
};

export const LegalModal = ({ type, onClose, darkMode }: { type: 'privacy'|'about', onClose: ()=>void, darkMode: boolean }) => (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className={`p-8 rounded-2xl w-full max-w-lg shadow-2xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-500/20">
                <h3 className={`text-2xl font-black uppercase italic ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{type === 'privacy' ? 'Privacy Policy' : 'About Us'}</h3>
                <button onClick={onClose} className="text-2xl font-bold hover:text-red-500">✕</button>
            </div>
            <p className="font-medium leading-relaxed text-sm opacity-90">{type === 'privacy' ? "LLC Fleetflow Transit Solutions values your privacy. We collect minimal data necessary for internal fleet management, diagnostic tracking, and attendance coordination. We do not sell or share your data with unauthorized third parties. All data is securely handled via industry-standard encrypted databases." : "LLC Fleetflow Transit Solutions is dedicated to modernizing fleet operations. Our management systems provide real-time tracking, inventory analytics, and seamless personnel coordination to keep your transit systems moving safely and efficiently. Built for reliability and high visibility on the shop floor."}</p>
            <button onClick={onClose} className="mt-8 w-full py-3 bg-[#002d72] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#ef7c00] shadow-lg">Acknowledge & Close</button>
        </div>
    </div>
);

export const Footer = ({ onShowLegal, darkMode }: { onShowLegal: (type: 'privacy'|'about')=>void, darkMode?: boolean }) => (
    <div className={`w-full py-6 text-center text-[10px] font-bold tracking-widest uppercase mt-auto border-t ${darkMode ? 'border-slate-800 text-slate-500 bg-slate-900' : 'border-slate-200 text-slate-400 bg-slate-100'}`}>
        <p>© {new Date().getFullYear()} LLC Fleetflow Transit Solutions.</p>
        <div className="flex justify-center gap-6 mt-3">
            <button onClick={() => onShowLegal('privacy')} className={`transition-colors ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>Privacy Policy</button>
            <button onClick={() => onShowLegal('about')} className={`transition-colors ${darkMode ? 'hover:text-white' : 'hover:text-[#002d72]'}`}>About Us</button>
        </div>
    </div>
);