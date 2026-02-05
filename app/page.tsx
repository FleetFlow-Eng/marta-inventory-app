"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig'; 
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';

// FIXED: The dynamic import with ssr: false is required for Leaflet/Maps to prevent crashes
const BusTracker = dynamic(() => import('./BusTracker'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[85vh] bg-slate-900 rounded-2xl border border-slate-700">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-blue-400 font-black uppercase tracking-widest text-xs">Initializing Live MARTA Feed...</p>
      </div>
    </div>
  )
});

// Reusable Edit Form Component (Used in List Row and Grid Modal)
const EditBusForm = ({ bus, onClose }: { bus: any; onClose: () => void }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-2xl font-black text-[#002d72] italic uppercase">Editing Bus #{bus.number}</h3>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 font-bold transition-colors">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400">Current Status</label>
                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold mt-1 outline-none focus:border-[#002d72] focus:bg-white transition-all" 
                            value={bus.status}
                            onChange={async (e) => await setDoc(doc(db, "buses", bus.docId), { status: e.target.value, timestamp: serverTimestamp() }, { merge: true })}>
                            <option value="Active">Ready for Service</option>
                            <option value="On Hold">Maintenance Hold</option>
                            <option value="In Shop">In Shop</option>
                            <option value="Engine">Engine</option>
                            <option value="Body Shop">Body Shop</option>
                            <option value="Vendor">Vendor</option>
                            <option value="Brakes">Brakes</option>
                            <option value="Safety">Safety</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400">Location</label>
                        <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold mt-1 outline-none focus:border-[#002d72] focus:bg-white transition-all" 
                            value={bus.location || ''} placeholder="e.g. Hamilton"
                            onChange={async (e) => await setDoc(doc(db, "buses", bus.docId), { location: e.target.value }, { merge: true })} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400">OOS Start Date</label>
                        <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold mt-1 outline-none focus:border-[#002d72] focus:bg-white transition-all" 
                            value={bus.oosStartDate || ''}
                            onChange={async (e) => await setDoc(doc(db, "buses", bus.docId), { oosStartDate: e.target.value }, { merge: true })} />
                    </div>
                </div>
                <div className="flex flex-col space-y-4">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-1">Fault Details / Notes</label>
                        <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-[#002d72] focus:bg-white transition-all h-28 resize-none" 
                            placeholder="Enter technical details here..." value={bus.notes || ''}
                            onChange={async (e) => await setDoc(doc(db, "buses", bus.docId), { notes: e.target.value }, { merge: true })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400">Exp Return</label>
                            <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold mt-1 outline-none focus:border-[#002d72] focus:bg-white transition-all" 
                                value={bus.expectedReturnDate || ''}
                                onChange={async (e) => await setDoc(doc(db, "buses", bus.docId), { expectedReturnDate: e.target.value }, { merge: true })} />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400">Act Return</label>
                            <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold mt-1 outline-none focus:border-[#002d72] focus:bg-white transition-all" 
                                value={bus.actualReturnDate || ''}
                                onChange={async (e) => await setDoc(doc(db, "buses", bus.docId), { actualReturnDate: e.target.value }, { merge: true })} />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                <button 
                    onClick={async () => {
                        if(confirm('Clear data for this unit?')) {
                            await updateDoc(doc(db, "buses", bus.docId), {
                                notes: '', location: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: ''
                            });
                        }
                    }}
                    className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-black uppercase transition-colors"
                >
                    Clear Data
                </button>
                <button 
                    onClick={onClose} 
                    className="px-8 py-3 bg-[#002d72] hover:bg-[#001a3d] text-white rounded-lg text-xs font-black uppercase transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    Save & Close
                </button>
            </div>
        </div>
    );
};

export default function MartaInventory() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'inventory' | 'tracker'>('inventory');
  
  // DEFAULT: GRID VIEW
  const [inventoryMode, setInventoryMode] = useState<'list' | 'grid'>('grid');
  
  const [buses, setBuses] = useState<any[]>([]);
  const [expandedBus, setExpandedBus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'number', direction: 'asc' });
  const [activeFilter, setActiveFilter] = useState<string>('Total Fleet');

  const holdStatuses = ['On Hold', 'Engine', 'Body Shop', 'Vendor', 'Brakes', 'Safety'];

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "buses"), orderBy("number", "asc"));
    return onSnapshot(q, (snap) => {
      setBuses(snap.docs.map(doc => ({ ...doc.data(), docId: doc.id })));
    });
  }, [user]);

  // LOGIN SCREEN: Navy background with centered card
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#001a3d] p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-[#ef7c00]"></div>
        <form 
          onSubmit={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); } catch (err) {} }} 
          className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-[10px] border-[#ef7c00] z-10 animate-in fade-in zoom-in duration-300"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-[#002d72] italic uppercase tracking-tighter">MARTA Ops</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fleet Management Portal</p>
          </div>
          <div className="space-y-4">
            <input type="email" placeholder="Supervisor Email" className="w-full p-4 border-2 rounded-xl font-bold outline-none focus:border-[#002d72] transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-4 border-2 rounded-xl font-bold outline-none focus:border-[#002d72] transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="w-full bg-[#002d72] text-white font-black py-4 rounded-xl uppercase tracking-widest hover:bg-[#ef7c00] transition-all shadow-lg transform active:scale-95">Login</button>
          </div>
        </form>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#ef7c00]/10 rounded-full blur-3xl"></div>
      </div>
    );
  }

  const sortedBuses = [...buses].filter(b => {
    const matchesSearch = b.number.includes(searchTerm);
    if (!matchesSearch) return false;
    if (activeFilter === 'Total Fleet') return true;
    if (activeFilter === 'Ready') return b.status === 'Active';
    if (activeFilter === 'Ghost Bus') return holdStatuses.includes(b.status);
    if (activeFilter === 'In Shop') return b.status === 'In Shop';
    return true;
  }).sort((a, b) => {
    let aValue: any = a[sortConfig.key] || '';
    let bValue: any = b[sortConfig.key] || '';
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    return sortConfig.direction === 'asc' ? 1 : -1;
  });

  const expandedBusObj = expandedBus ? buses.find(b => b.docId === expandedBus) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#ef7c00] selection:text-white relative">
      
      {inventoryMode === 'grid' && expandedBus && expandedBusObj && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <EditBusForm bus={expandedBusObj} onClose={() => setExpandedBus(null)} />
            </div>
        </div>
      )}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-[1001] px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-2 h-6 bg-[#002d72] rounded-full"></div>
            <span className="font-black text-lg italic uppercase tracking-tighter text-[#002d72]">Fleet Manager</span>
        </div>
        <div className="flex gap-6 items-center">
          <button onClick={() => setView(view === 'inventory' ? 'tracker' : 'inventory')} className="text-[#002d72] hover:text-[#ef7c00] text-[10px] font-black uppercase transition-all tracking-widest border-b-2 border-transparent hover:border-[#ef7c00] pb-1">{view === 'inventory' ? 'Route Viewer' : 'Back to Inventory'}</button>
          <button onClick={() => signOut(auth)} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase transition-all tracking-widest">Logout</button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6">
        {view === 'tracker' ? (
          <div className="h-[85vh] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
             <BusTracker />
          </div>
        ) : (
          <>
            {/* SLENDER METRICS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Fleet', val: buses.length, color: 'text-slate-900' },
                { label: 'Ready', val: buses.filter(b => b.status === 'Active').length, color: 'text-green-600' },
                { label: 'Ghost Bus', val: buses.filter(b => holdStatuses.includes(b.status)).length, color: 'text-red-600' },
                { label: 'In Shop', val: buses.filter(b => b.status === 'In Shop').length, color: 'text-[#ef7c00]' }
              ].map((m, i) => (
                <div key={i} onClick={() => setActiveFilter(m.label)} className={`bg-white py-4 px-6 rounded-xl shadow-sm border flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.02] ${activeFilter === m.label ? 'border-[#002d72] bg-blue-50 shadow-inner' : 'border-slate-100 hover:border-slate-300'}`}>
                    <p className="text-[8px] font-black uppercase text-slate-400 mb-0.5 tracking-widest">{m.label}</p>
                    <p className={`text-2xl font-black tabular-nums ${m.color}`}>{m.val}</p>
                </div>
              ))}
            </div>

            <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
                <div className="relative w-full max-w-md">
                    <input type="text" placeholder="Search Unit #..." className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-[#002d72] transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">🔍</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-1 flex">
                        <button onClick={() => setInventoryMode('list')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${inventoryMode === 'list' ? 'bg-[#002d72] text-white shadow-md' : 'text-slate-400 hover:text-[#002d72]'}`}>List</button>
                        <button onClick={() => setInventoryMode('grid')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${inventoryMode === 'grid' ? 'bg-[#002d72] text-white shadow-md' : 'text-slate-400 hover:text-[#002d72]'}`}>Grid</button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                {inventoryMode === 'grid' && (
                    <div className="p-8">
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                            {sortedBuses.map((bus) => {
                                let colors = "bg-green-50 border-green-200 text-green-800 hover:border-green-400";
                                if (holdStatuses.includes(bus.status)) colors = "bg-red-50 border-red-200 text-red-800 hover:border-red-400";
                                else if (bus.status !== 'Active') colors = "bg-orange-50 border-orange-200 text-orange-800 hover:border-orange-400";

                                return (
                                    <div key={bus.docId} onClick={() => setExpandedBus(bus.docId)} className={`h-14 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-105 ${colors}`}>
                                        <span className="text-xs font-black italic tracking-tighter">#{bus.number}</span>
                                        {bus.status !== 'Active' && <span className="text-[7px] font-bold uppercase opacity-60 leading-none mt-0.5">{bus.status === 'On Hold' ? 'GHOST' : bus.status}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}