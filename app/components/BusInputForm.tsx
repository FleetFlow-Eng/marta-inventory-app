import React, { useState } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { logHistory, logActivity, HAMILTON_FLEET } from '../utils';

export const BusInputForm = ({ showToast, darkMode, buses, isAdmin, statusOptions }: { showToast: any, darkMode: boolean, buses: any[], isAdmin: boolean, statusOptions: any[] }) => {
    const [formData, setFormData] = useState({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', disposition: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newBusData, setNewBusData] = useState({ number: '', status: 'Active' });

    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleDateClick = (e: any) => e.target.showPicker?.();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (formData.oosStartDate) {
            if (formData.oosStartDate > todayStr) return showToast("Out of Service date cannot be a future date", 'error');
            if (formData.expectedReturnDate && formData.expectedReturnDate < formData.oosStartDate) return showToast("Expected Return cannot be earlier than OOS Date", 'error');
            if (formData.actualReturnDate && formData.actualReturnDate < formData.oosStartDate) return showToast("Actual Return cannot be earlier than OOS Date", 'error');
        }

        const busRef = doc(db, "buses", formData.number); 
        const busSnap = await getDoc(busRef);
        if (!busSnap.exists()) return showToast(`⛔ Bus #${formData.number} not found. Please add it first.`, 'error');
        
        const old = busSnap.data(); let changes = []; 
        if (old.status !== formData.status) changes.push(`STATUS: ${old.status} ➝ ${formData.status}`); 
        if (old.notes !== formData.notes) changes.push(`NOTES: "${old.notes || ''}" ➝ "${formData.notes}"`); 
        if (old.oosStartDate !== formData.oosStartDate) changes.push(`OOS: ${old.oosStartDate || '—'} ➝ ${formData.oosStartDate}`);
        if (isAdmin && old.disposition !== formData.disposition && formData.disposition !== '') changes.push(`DISP: ${old.disposition || '—'} ➝ ${formData.disposition}`);
        
        await setDoc(busRef, { ...formData, timestamp: serverTimestamp() }, { merge: true });
        await logHistory(formData.number, "UPDATE", changes.length > 0 ? changes.join('\n') : "Routine Update via Terminal", auth.currentUser?.email || 'Unknown');
        showToast(`Bus #${formData.number} Updated`, 'success'); 
        setFormData({ number: '', status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', disposition: '' });
    };

    const handleAddNewBus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBusData.number) return showToast("Bus number required", 'error');
        const busRef = doc(db, "buses", newBusData.number);
        const snap = await getDoc(busRef);
        if (snap.exists()) return showToast(`⛔ Bus #${newBusData.number} already exists!`, 'error');

        await setDoc(busRef, { number: newBusData.number, status: newBusData.status, location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() });
        await logHistory(newBusData.number, "CREATED", "Bus added to registry.", auth.currentUser?.email || 'Unknown');
        showToast(`Bus #${newBusData.number} Added`, 'success');
        setShowAddModal(false); setNewBusData({ number: '', status: 'Active' });
    };

    const populateFleet = async () => {
        if (!confirm(`Initialize database with ${HAMILTON_FLEET.length} Hamilton buses?`)) return;
        const existingBusNumbers = new Set(buses.map(b => b.number));
        const batch = writeBatch(db);
        let count = 0;
        for (const b of HAMILTON_FLEET) {
            if (!existingBusNumbers.has(b)) {
                batch.set(doc(db, "buses", b), { number: b, status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', timestamp: serverTimestamp() });
                count++;
            }
        }
        if (count > 0) { await batch.commit(); showToast(`Added ${count} missing buses!`, 'success'); } 
        else showToast("All Hamilton buses already in system.", 'success');
    };

    const resetAllFleet = async () => {
        if (!confirm("⚠️ Master Reset: Set all buses to Active?")) return;
        showToast("Resetting fleet... please wait.", "success");
        for (let i = 0; i < buses.length; i += 250) {
            await Promise.all(buses.slice(i, i + 250).map(bus => 
                updateDoc(doc(db, "buses", bus.docId), { status: 'Active', location: '', notes: '', oosStartDate: '', expectedReturnDate: '', actualReturnDate: '', disposition: '', timestamp: serverTimestamp() }).catch(e => console.error(e))
            ));
        }
        await logActivity(auth.currentUser?.email || 'Unknown', 'SYSTEM', 'Entire Fleet', 'UPDATE', 'Master Reset triggered.');
        showToast("Fleet successfully reset.", 'success');
    };

    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-black placeholder:text-gray-400';
    
    return (
        <div className={`max-w-2xl mx-auto mt-4 md:mt-10 p-6 md:p-8 rounded-2xl shadow-xl border-t-8 border-[#ef7c00] animate-in slide-in-from-bottom-4 duration-500 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
                <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Data Entry</h2>
                <div className="flex gap-2 flex-wrap">
                    {isAdmin && <button type="button" onClick={resetAllFleet} className="px-3 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all bg-red-600 hover:bg-red-700 text-white shadow-md">🚨 Reset Fleet</button>}
                    {isAdmin && <button type="button" onClick={populateFleet} className={`px-3 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest border transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[#002d72]'}`}>⚙️ Init Fleet</button>}
                    <button type="button" onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-black uppercase text-[10px] tracking-widest shadow-md transition-all">+ Add Bus</button>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <input type="text" placeholder="Unit # to Update" className={`p-4 border-2 rounded-xl font-black outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.number} onChange={handleChange} name="number" required />
                    <select className={`p-4 border-2 rounded-xl font-bold outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.status} onChange={handleChange} name="status">
                        <option value="Active">Ready for Service</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option>
                        {statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}
                    </select>
                </div>
                <input type="text" placeholder="Location" className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.location} onChange={handleChange} name="location" />
                {isAdmin && <input type="text" name="disposition" placeholder="Disposition / Fleet Status (Admin Only)" value={formData.disposition} onChange={handleChange} className={`w-full p-4 border-2 rounded-xl outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} />}
                <textarea placeholder="Maintenance Notes" className={`w-full p-4 border-2 rounded-xl h-24 outline-none focus:border-[#ef7c00] transition-colors ${inputClass}`} value={formData.notes} onChange={handleChange} name="notes" />
                <div className="grid grid-cols-3 gap-4">
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>OOS Date</label><input name="oosStartDate" type="date" onClick={handleDateClick} max={new Date().toISOString().split('T')[0]} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.oosStartDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exp Return</label><input name="expectedReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.expectedReturnDate} onChange={handleChange} /></div>
                    <div><label className={`text-[9px] font-black uppercase block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Act Return</label><input name="actualReturnDate" type="date" onClick={handleDateClick} min={formData.oosStartDate} className={`w-full p-2 border-2 rounded-lg text-xs font-bold cursor-pointer outline-none focus:border-[#ef7c00] ${inputClass}`} value={formData.actualReturnDate} onChange={handleChange} /></div>
                </div>
                <button className="w-full py-4 bg-[#ef7c00] hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest transition-transform active:scale-95 shadow-lg">Update Record</button>
            </form>

            {showAddModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`p-8 rounded-xl shadow-2xl w-full max-w-md border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h3 className={`text-2xl font-black mb-6 uppercase italic ${darkMode ? 'text-white' : 'text-[#002d72]'}`}>Add New Bus</h3>
                        <form onSubmit={handleAddNewBus} className="space-y-4">
                            <div><label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Unit Number *</label><input type="text" className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.number} onChange={e => setNewBusData({...newBusData, number: e.target.value})} required placeholder="e.g., 2001" /></div>
                            <div><label className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Initial Status</label><select className={`w-full p-3 mt-1 border-2 rounded-lg font-bold outline-none focus:border-[#ef7c00] ${inputClass}`} value={newBusData.status} onChange={e => setNewBusData({...newBusData, status: e.target.value})}><option value="Active">Ready for Service</option><option value="On Hold">On Hold</option><option value="In Shop">In Shop</option><option value="Engine">Engine</option><option value="Body Shop">Body Shop</option><option value="Vendor">Vendor</option><option value="Brakes">Brakes</option><option value="Safety">Safety</option>{statusOptions.map((opt, i) => <option key={i} value={opt.label}>{opt.label}</option>)}</select></div>
                            <div className="flex gap-4 mt-8"><button type="button" onClick={() => setShowAddModal(false)} className={`w-1/2 py-3 rounded-xl font-black uppercase text-xs transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-black'}`}>Cancel</button><button type="submit" className="w-1/2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black uppercase text-xs shadow-lg transition-transform active:scale-95">Save Bus</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};