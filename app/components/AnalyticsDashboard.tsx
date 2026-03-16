import React, { useMemo } from 'react';
import { calculateDaysOOS } from '../utils';

// --- 1. STATUS CHARTS (The Visual Meters) ---
export const StatusCharts = ({ buses, statusOptions, darkMode }: { buses: any[], statusOptions: any[], darkMode: boolean }) => {
    
    // --- Metric Calculations ---
    const stats = useMemo(() => {
        const total = buses.length;
        const ready = buses.filter(b => b.status === 'Active').length;
        const down = total - ready;
        const availability = total === 0 ? 0 : Math.round((ready / total) * 100);

        // Group down buses by their specific status
        const breakdown: Record<string, number> = {};
        buses.forEach(b => {
            if (b.status !== 'Active') {
                breakdown[b.status] = (breakdown[b.status] || 0) + 1;
            }
        });

        // Convert to array and sort highest to lowest
        const breakdownArray = Object.entries(breakdown)
            .map(([label, count]) => ({ label, count, percentage: Math.round((count / Math.max(down, 1)) * 100) }))
            .sort((a, b) => b.count - a.count);

        return { total, ready, down, availability, breakdownArray };
    }, [buses]);

    // --- SVG Circular Progress Math ---
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (stats.availability / 100) * circumference;

    const bgClass = darkMode ? 'bg-slate-900/50 border-slate-800/50 backdrop-blur-xl' : 'bg-white/80 border-slate-200/50 backdrop-blur-xl';
    const textPrimary = darkMode ? 'text-white' : 'text-slate-900';
    const textSecondary = darkMode ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* --- FLEET AVAILABILITY DONUT CHART --- */}
            <div className={`p-8 rounded-3xl border shadow-xl flex flex-col items-center justify-center relative overflow-hidden ${bgClass}`}>
                <h3 className={`text-sm font-black uppercase tracking-widest absolute top-6 left-6 ${textSecondary}`}>Fleet Availability</h3>
                
                {/* Glowing Background Glow */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[50px] opacity-20 pointer-events-none ${stats.availability >= 80 ? 'bg-emerald-500' : stats.availability >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>

                <div className="relative w-48 h-48 flex items-center justify-center mt-6">
                    <svg className="transform -rotate-90 w-full h-full">
                        {/* Background Track */}
                        <circle 
                            cx="96" cy="96" r={radius} 
                            stroke="currentColor" strokeWidth="12" fill="transparent" 
                            className={darkMode ? 'text-slate-800' : 'text-slate-100'} 
                        />
                        {/* Foreground Progress */}
                        <circle 
                            cx="96" cy="96" r={radius} 
                            stroke="currentColor" strokeWidth="12" fill="transparent" 
                            strokeDasharray={circumference} 
                            strokeDashoffset={strokeDashoffset} 
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-out ${stats.availability >= 80 ? 'text-emerald-500' : stats.availability >= 60 ? 'text-amber-500' : 'text-rose-500'}`} 
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className={`text-5xl font-black tracking-tighter ${textPrimary}`}>{stats.availability}%</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${textSecondary}`}>Ready</span>
                    </div>
                </div>

                <div className="flex gap-8 mt-8 w-full justify-center border-t pt-6 border-slate-500/20">
                    <div className="text-center">
                        <p className={`text-2xl font-black text-emerald-500`}>{stats.ready}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${textSecondary}`}>Active Units</p>
                    </div>
                    <div className="text-center border-l pl-8 border-slate-500/20">
                        <p className={`text-2xl font-black text-rose-500`}>{stats.down}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${textSecondary}`}>Down Units</p>
                    </div>
                </div>
            </div>

            {/* --- SHOP BOTTLENECK ANALYSIS (Bar Charts) --- */}
            <div className={`p-8 rounded-3xl border shadow-xl lg:col-span-2 flex flex-col ${bgClass}`}>
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h3 className={`text-sm font-black uppercase tracking-widest ${textSecondary}`}>Shop Bottlenecks</h3>
                        <h2 className={`text-2xl font-black italic tracking-tight uppercase mt-1 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Down-Unit Breakdown</h2>
                    </div>
                    <div className="text-right">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>Tracking {stats.down} Issues</span>
                    </div>
                </div>

                <div className="flex-grow flex flex-col justify-center space-y-6">
                    {stats.breakdownArray.length === 0 ? (
                        <div className="text-center opacity-40 italic font-bold">100% Fleet Availability. No down units.</div>
                    ) : stats.breakdownArray.slice(0, 5).map((item, index) => {
                        // Assigning colors based on index for a nice gradient look
                        const barColors = [
                            'bg-rose-500 shadow-[0_0_10px_#f43f5e88]', 
                            'bg-orange-500 shadow-[0_0_10px_#f9731688]', 
                            'bg-amber-500 shadow-[0_0_10px_#f59e0b88]', 
                            'bg-blue-500 shadow-[0_0_10px_#3b82f688]', 
                            'bg-indigo-500 shadow-[0_0_10px_#6366f188]'
                        ];
                        const color = barColors[index % barColors.length];

                        return (
                            <div key={item.label} className="w-full">
                                <div className="flex justify-between items-end mb-2">
                                    <span className={`text-xs font-black uppercase tracking-widest ${textPrimary}`}>{item.label}</span>
                                    <div className="text-right">
                                        <span className={`text-lg font-black leading-none ${textPrimary}`}>{item.count}</span>
                                        <span className={`text-[10px] font-bold ml-2 opacity-50`}>({item.percentage}%)</span>
                                    </div>
                                </div>
                                {/* Track Background */}
                                <div className={`h-3 w-full rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    {/* Animated Progress Bar */}
                                    <div 
                                        className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`} 
                                        style={{ width: `${item.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- 2. ANALYTICS DASHBOARD (The Data Tables & Trends) ---
export const AnalyticsDashboard = ({ buses, showToast, darkMode }: { buses: any[], showToast: any, darkMode: boolean }) => {
    
    // Calculate the top 5 buses that have been out of service the longest
    const criticalBuses = useMemo(() => {
        return buses
            .filter(b => b.status !== 'Active' && b.oosStartDate)
            .map(b => ({ ...b, daysDown: Number(calculateDaysOOS(b.oosStartDate)) }))
            .sort((a, b) => b.daysDown - a.daysDown)
            .slice(0, 5); // Take top 5
    }, [buses]);

    const bgClass = darkMode ? 'bg-slate-900/50 border-slate-800/50 backdrop-blur-xl' : 'bg-white/80 border-slate-200/50 backdrop-blur-xl';
    const textPrimary = darkMode ? 'text-white' : 'text-slate-900';
    const textSecondary = darkMode ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            
            {/* --- LEADERBOARD: CRITICAL 5 --- */}
            <div className={`p-6 md:p-8 rounded-3xl border shadow-xl ${bgClass}`}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className={`text-sm font-black uppercase tracking-widest ${textSecondary}`}>Action Required</h3>
                        <h2 className={`text-2xl font-black italic tracking-tight uppercase mt-1 ${darkMode ? 'text-rose-500' : 'text-rose-600'}`}>The Critical 5</h2>
                    </div>
                    <span className="text-3xl opacity-20">⚠️</span>
                </div>

                <div className="space-y-3">
                    {criticalBuses.length === 0 ? (
                        <p className="text-center italic opacity-50 py-10 font-bold">No buses are currently Out of Service.</p>
                    ) : criticalBuses.map((bus, idx) => (
                        <div key={bus.docId} className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.01] ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-rose-500 text-white shadow-[0_0_10px_#f43f5e]' : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <h4 className={`text-lg font-black leading-none ${textPrimary}`}>Unit #{bus.number}</h4>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>{bus.status}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-xl font-black block leading-none ${idx === 0 ? 'text-rose-500' : textPrimary}`}>{bus.daysDown}</span>
                                <span className={`text-[8px] font-black uppercase tracking-widest opacity-50`}>Days Down</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- FLEET HEALTH TRENDS (Predictive / Informational) --- */}
            <div className={`p-6 md:p-8 rounded-3xl border shadow-xl flex flex-col ${bgClass}`}>
                <div className="mb-6">
                    <h3 className={`text-sm font-black uppercase tracking-widest ${textSecondary}`}>System Overview</h3>
                    <h2 className={`text-2xl font-black italic tracking-tight uppercase mt-1 ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Fleet Health Metrics</h2>
                </div>

                <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Mock Metric 1 */}
                    <div className={`p-5 rounded-2xl border flex flex-col justify-center ${darkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50/50 border-slate-200/50'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Primary Downtime Cause</span>
                        <span className={`text-lg font-black uppercase ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>Engine Diagnostics</span>
                        <span className="text-[9px] font-bold opacity-60 mt-2 block leading-snug">Requires priority technician assignment over the next 48 hours.</span>
                    </div>

                    {/* Mock Metric 2 */}
                    <div className={`p-5 rounded-2xl border flex flex-col justify-center ${darkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50/50 border-slate-200/50'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Weekly Recovery Rate</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-3xl font-black ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>+12%</span>
                            <span className="text-emerald-500 text-xl">↗</span>
                        </div>
                        <span className="text-[9px] font-bold opacity-60 mt-2 block leading-snug">Shop is repairing units faster than they are breaking down.</span>
                    </div>

                    {/* Mock Metric 3 */}
                    <div className={`p-5 rounded-2xl border sm:col-span-2 flex items-center justify-between ${darkMode ? 'bg-[#002d72]/20 border-[#002d72]/50' : 'bg-[#002d72]/5 border-[#002d72]/20'}`}>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1 block">Hamilton Division Status</span>
                            <span className={`text-xl font-black italic uppercase ${darkMode ? 'text-[#ef7c00]' : 'text-[#002d72]'}`}>Operating Normally</span>
                        </div>
                        <div className="w-12 h-12 rounded-full border-4 border-[#ef7c00] flex items-center justify-center">
                            <span className="text-xl">✅</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};