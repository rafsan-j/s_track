"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

export default function ManagePage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  
  // State for our data
  const [years, setYears] = useState<any[]>([]);
  
  // State for forms
  const [newYearName, setNewYearName] = useState("");
  const [newSemesterName, setNewSemesterName] = useState("");
  const [selectedYearId, setSelectedYearId] = useState("");

  // Load user and existing data on page load
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchYears();
      }
    }
    loadData();
  }, []);

  async function fetchYears() {
    const { data } = await supabase.from("academic_years").select("*").order("created_at", { ascending: false });
    if (data) {
      setYears(data);
      if (data.length > 0) setSelectedYearId(data[0].id); // Auto-select the first year for the semester form
    }
  }

  async function handleAddYear(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return alert("Please log in first!");

    const { error } = await supabase.from("academic_years").insert({
      user_id: userId,
      name: newYearName,
      is_current: true
    });

    if (error) alert(error.message);
    else {
      setNewYearName("");
      fetchYears(); // Refresh the list
    }
  }

  async function handleAddSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedYearId) return alert("Missing user or academic year!");

    const { error } = await supabase.from("semesters").insert({
      user_id: userId,
      academic_year_id: selectedYearId,
      name: newSemesterName,
      is_current: true
    });

    if (error) alert(error.message);
    else {
      setNewSemesterName("");
      alert("Semester added successfully!");
    }
  }

  if (!userId) return <div className="p-8 text-slate-100">Please log in via /login first.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300">
      <AppSidebar />
      <div className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Manage Academic Data</h1>
          <p className="text-slate-400">Add your academic years and semesters here.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ADD ACADEMIC YEAR FORM */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Add Academic Year</h2>
            <form onSubmit={handleAddYear} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Year Name (e.g. 2026-27)</label>
                <input 
                  type="text" 
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors">
                Create Year
              </button>
            </form>
          </div>

          {/* ADD SEMESTER FORM */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Add Semester</h2>
            <form onSubmit={handleAddSemester} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Assign to Academic Year</label>
                <select 
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                >
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Semester Name (e.g. Semester 1)</label>
                <input 
                  type="text" 
                  value={newSemesterName}
                  onChange={(e) => setNewSemesterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors">
                Create Semester
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}