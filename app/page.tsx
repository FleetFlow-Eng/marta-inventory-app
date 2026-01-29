"use client";
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig'; 
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";

export default function MartaInventory() {
  const [buses, setBuses] = useState([]);
  const [busNumber, setBusNumber] = useState('');
  const [status, setStatus] = useState('Active');
  const [notes, setNotes] = useState('');

  // 1. READ data from Firebase in real-time
  useEffect(() => {
    const q = query(collection(db, "buses"), orderBy("id", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let busesArr = [];
      querySnapshot.forEach((doc) => {
        busesArr.push({ ...doc.data(), docId: doc.id });
      });
      setBuses(busesArr);
    });
    return () => unsubscribe();
  }, []);

  // 2. WRITE data to Firebase
  const addBus = async (e) => {
    e.preventDefault();
    if (!busNumber) return;
    
    try {
      await addDoc(collection(db, "buses"), {
        id: Date.now(),
        number: busNumber,
        status: status,
        notes: notes
      });
      setBusNumber('');
      setNotes('');
    } catch (error) {
      console.error("Error adding bus: ", error);
    }
  };

  // 3. DELETE data from Firebase (Optional bonus)
  const deleteBus = async (id) => {
    await deleteDoc(doc(db, "buses", id));
  };

  return (
    <main className="p-8 max-w-5xl mx-auto font-sans bg-white min-h-screen">
      <header className="mb-10 border-b pb-4">
        <h1 className="text-3xl font-bold text-blue-700">MARTA Bus Inventory</h1>
        <p className="text-gray-500 text-sm italic">Superintendent Admin Console</p>
      </header>

      {/* ADMIN CONSOLE FORM */}
      <section className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-10 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Log New Equipment</h2>
        <form onSubmit={addBus} className="flex flex-col gap-4 md:flex-row">
          <input 
            type="text"
            placeholder="Bus #"
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={busNumber}
            onChange={(e) => setBusNumber(e.target.value)}
          />
          <select 
            className="p-3 border rounded-lg bg-white cursor-pointer"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Active">🟢 Active</option>
            <option value="On Hold">🔴 On Hold</option>
            <option value="In Shop">🔧 In Shop</option>
          </select>
          <input 
            type="text"
            placeholder="Add notes (e.g. Cummins Insite Check)"
            className="flex-[2] p-3 border rounded-lg"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
            Add to Database
          </button>
        </form>
      </section>

      {/* INVENTORY LIST */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-left bg-white">
          <thead className="bg-gray-100 text-gray-600 text-sm uppercase">
            <tr>
              <th className="p-4">Bus Number</th>
              <th className="p-4">Status</th>
              <th className="p-4">Notes</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {buses.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400">Loading MARTA database...</td></tr>
            ) : (
              buses.map((bus) => (
                <tr key={bus.docId} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-bold text-blue-900">{bus.number}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      bus.status === 'Active' ? 'bg-green-100 text-green-700' : 
                      bus.status === 'On Hold' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {bus.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">{bus.notes}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => deleteBus(bus.docId)} 
                      className="text-red-400 hover:text-red-600 text-sm underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}