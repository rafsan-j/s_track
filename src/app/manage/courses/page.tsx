"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

export default function ManageCoursesPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Data states
  const [years, setYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Selection states
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  // Form states
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseCredits, setCourseCredits] = useState("");

  // Edit states
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseCode, setEditCourseCode] = useState("");
  const [editCourseCredits, setEditCourseCredits] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchYears();
      }
    }
    init();
  }, []);

  // 1. Fetch Years
  async function fetchYears() {
    const { data } = await supabase.from("academic_years").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setYears(data);
      setSelectedYearId(data[0].id);
      fetchSemesters(data[0].id);
    }
  }

  // 2. Fetch Semesters when a Year is selected
  async function fetchSemesters(yearId: string) {
    const { data } = await supabase.from("semesters").select("*").eq("academic_year_id", yearId).order("created_at", { ascending: false });
    setSemesters(data || []);
    if (data && data.length > 0) {
      setSelectedSemesterId(data[0].id);
      fetchCourses(data[0].id);
    } else {
      setSelectedSemesterId("");
      setCourses([]);
    }
  }

  // 3. Fetch Courses when a Semester is selected
  async function fetchCourses(semesterId: string) {
    if (!semesterId) {
      setCourses([]);
      return;
    }

    const { data } = await supabase.from("courses").select("*").eq("semester_id", semesterId).order("created_at", { ascending: false });
    setCourses(data || []);
  }

  // Handle Dropdown Changes
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const yearId = e.target.value;
    setSelectedYearId(yearId);
    fetchSemesters(yearId);
  };

  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const semId = e.target.value;
    setSelectedSemesterId(semId);
    fetchCourses(semId);
  };

  // Add a new Course
  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedSemesterId) return alert("Please select a semester first.");

    const trimmedName = courseName.trim();
    if (!trimmedName) return alert("Course name is required.");

    const { error } = await supabase.from("courses").insert({
      user_id: userId,
      semester_id: selectedSemesterId,
      name: trimmedName,
      code: courseCode.trim() || null,
      credits: Number.parseFloat(courseCredits) || 0,
      status: 'active'
    });

    if (error) {
      alert(error.message);
    } else {
      setCourseName("");
      setCourseCode("");
      setCourseCredits("");
      fetchCourses(selectedSemesterId);
    }
  }

  function startEditingCourse(course: any) {
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseCode(course.code || "");
    setEditCourseCredits(course.credits ? String(course.credits) : "");
  }

  function cancelEditingCourse() {
    setEditingCourseId(null);
    setEditCourseName("");
    setEditCourseCode("");
    setEditCourseCredits("");
  }

  async function handleSaveCourse(courseId: string) {
    const trimmedName = editCourseName.trim();
    if (!trimmedName) {
      alert("Course name is required.");
      return;
    }

    const updatedCredits = Number.parseFloat(editCourseCredits) || 0;

    const { error } = await supabase.from("courses").update({
      name: trimmedName,
      code: editCourseCode.trim() || null,
      credits: updatedCredits
    }).eq("id", courseId);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEditingCourse();
    fetchCourses(selectedSemesterId);
  }

  async function handleDeleteCourse(courseId: string) {
    const isConfirmed = window.confirm("Delete this course? This action cannot be undone.");
    if (!isConfirmed) return;

    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    if (error) {
      alert(error.message);
      return;
    }

    fetchCourses(selectedSemesterId);
  }

  // Archive a Course
  async function handleArchiveCourse(courseId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    const { error } = await supabase.from("courses").update({ status: newStatus }).eq("id", courseId);
    
    if (!error) fetchCourses(selectedSemesterId);
  }

  if (!userId) return <div className="p-8 text-slate-100">Please log in via /login first.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300">
      <AppSidebar />
      <div className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Manage Courses</h1>
          <p className="text-slate-400">Add and organize your courses by semester.</p>
        </header>

        {/* Selectors */}
        <div className="flex gap-4 mb-8 bg-slate-900 p-4 rounded-lg border border-slate-800">
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Academic Year</label>
            <select value={selectedYearId} onChange={handleYearChange} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none">
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Semester</label>
            <select value={selectedSemesterId} onChange={handleSemesterChange} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none">
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* ADD COURSE FORM */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 p-6 rounded-lg h-fit">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Add Course</h2>
            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Course Name</label>
                <input type="text" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g. Linear Algebra" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none" required />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Course Code (Optional)</label>
                <input type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. MAT101" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Credits (Optional)</label>
                <input type="number" step="0.5" value={courseCredits} onChange={(e) => setCourseCredits(e.target.value)} placeholder="e.g. 3.0" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 outline-none" />
              </div>
              <button type="submit" disabled={!selectedSemesterId} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50">
                Create Course
              </button>
            </form>
          </div>

          {/* COURSE LIST */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Courses in Selected Semester</h2>
            {courses.length === 0 ? (
              <p className="text-slate-500 italic">No courses found for this semester. Add one!</p>
            ) : (
              <div className="space-y-3">
                {courses.map(course => {
                  const isEditing = editingCourseId === course.id;

                  return (
                    <div key={course.id} className={`p-4 rounded border ${course.status === 'active' ? 'bg-slate-950 border-slate-800' : 'bg-slate-950/50 border-slate-800/50 opacity-60'}`}>
                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Course Name</label>
                            <input
                              type="text"
                              value={editCourseName}
                              onChange={(e) => setEditCourseName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Course Code</label>
                            <input
                              type="text"
                              value={editCourseCode}
                              onChange={(e) => setEditCourseCode(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Credits</label>
                            <input
                              type="number"
                              step="0.5"
                              value={editCourseCredits}
                              onChange={(e) => setEditCourseCredits(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveCourse(course.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingCourse}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center gap-4">
                          <div>
                            <h3 className="font-medium text-slate-200">
                              {course.code && <span className="text-blue-400 mr-2">{course.code}</span>}
                              {course.name}
                            </h3>
                            {course.credits > 0 && <p className="text-xs text-slate-500 mt-1">{course.credits} Credits</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingCourse(course)}
                              className="text-sm px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveCourse(course.id, course.status)}
                              className="text-sm px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 transition-colors"
                            >
                              {course.status === 'active' ? 'Archive' : 'Restore'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCourse(course.id)}
                              className="text-sm px-3 py-1.5 rounded border border-red-700/50 text-red-300 hover:bg-red-900/20 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}