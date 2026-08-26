"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";

export default function ManageCurriculumPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Data states
  const [years, setYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  // Selection states
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedModuleIdForTopic, setSelectedModuleIdForTopic] = useState("");

  // Form states
  const [moduleTitle, setModuleTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");

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

  // Fetching cascade
  async function fetchYears() {
    const { data } = await supabase.from("academic_years").select("*").order("created_at", { ascending: false });
    setYears(data || []);
    if (data && data.length > 0) {
      setSelectedYearId(data[0].id);
      fetchSemesters(data[0].id);
    } else {
      setSelectedYearId("");
      setSemesters([]);
      setSelectedSemesterId("");
      setCourses([]);
      setModules([]);
      setTopics([]);
      setSelectedModuleIdForTopic("");
    }
  }

  async function fetchSemesters(yearId: string) {
    const { data } = await supabase.from("semesters").select("*").eq("academic_year_id", yearId).order("created_at", { ascending: false });
    setSemesters(data || []);
    if (data && data.length > 0) {
      setSelectedSemesterId(data[0].id);
      fetchCourses(data[0].id);
    } else {
      setSelectedSemesterId("");
      setCourses([]);
      setModules([]);
      setTopics([]);
      setSelectedModuleIdForTopic("");
    }
  }

  async function fetchCourses(semesterId: string) {
    const { data } = await supabase.from("courses").select("*").eq("semester_id", semesterId).eq("status", "active").order("created_at", { ascending: false });
    setCourses(data || []);
    if (data && data.length > 0) {
      setSelectedCourseId(data[0].id);
      fetchCurriculum(data[0].id);
    } else {
      setSelectedCourseId("");
      setModules([]);
      setTopics([]);
      setSelectedModuleIdForTopic("");
    }
  }

  // Fetch modules and topics for a specific course
  async function fetchCurriculum(courseId: string) {
    const [modulesRes, topicsRes] = await Promise.all([
      supabase.from("modules").select("*").eq("course_id", courseId).order("created_at", { ascending: true }),
      supabase.from("topics").select("*, modules!inner(course_id)").eq("modules.course_id", courseId).order("created_at", { ascending: true })
    ]);
    
    setModules(modulesRes.data || []);
    setTopics(topicsRes.data || []);
    
    if (modulesRes.data && modulesRes.data.length > 0) {
      setSelectedModuleIdForTopic(modulesRes.data[0].id);
    } else {
      setSelectedModuleIdForTopic("");
    }
  }

  // Handle Selectors
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYearId(e.target.value);
    fetchSemesters(e.target.value);
  };
  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSemesterId(e.target.value);
    fetchCourses(e.target.value);
  };
  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCourseId(e.target.value);
    fetchCurriculum(e.target.value);
  };

  // Add Data Handlers
  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedCourseId) return alert("Select a course first");

    const trimmedTitle = moduleTitle.trim();
    if (!trimmedTitle) return alert("Module title is required.");

    const { error } = await supabase.from("modules").insert({
      user_id: userId, course_id: selectedCourseId, title: trimmedTitle
    });
    if (!error) {
      setModuleTitle("");
      fetchCurriculum(selectedCourseId);
    }
  }

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !selectedModuleIdForTopic) return alert("Select a module first");

    const trimmedTitle = topicTitle.trim();
    if (!trimmedTitle) return alert("Topic title is required.");

    const { error } = await supabase.from("topics").insert({
      user_id: userId, module_id: selectedModuleIdForTopic, title: trimmedTitle
    });
    if (!error) {
      setTopicTitle("");
      fetchCurriculum(selectedCourseId);
    }
  }

  if (!userId) return <div className="p-8 text-slate-100">Please log in.</div>;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300">
      <AppSidebar />
      <div className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Build Curriculum</h1>
          <p className="text-slate-400">Map out the modules and topics for your courses.</p>
        </header>

        {/* Target Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-900 p-4 rounded-lg border border-slate-800">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <select value={selectedYearId} onChange={handleYearChange} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none">
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Semester</label>
            <select value={selectedSemesterId} onChange={handleSemesterChange} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none">
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Course</label>
            <select value={selectedCourseId} onChange={handleCourseChange} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm outline-none font-medium text-blue-400">
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ADD FORMS */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-200 mb-3">1. Add Module</h2>
              <form onSubmit={handleAddModule} className="space-y-3">
                <input type="text" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="e.g. Arrays & Pointers" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none" required />
                <button type="submit" disabled={!selectedCourseId} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors disabled:opacity-50">Add Module</button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-200 mb-3">2. Add Topic</h2>
              <form onSubmit={handleAddTopic} className="space-y-3">
                <select value={selectedModuleIdForTopic} onChange={(e) => setSelectedModuleIdForTopic(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none">
                  {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <input type="text" value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} placeholder="e.g. Multidimensional Arrays" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm outline-none" required />
                <button type="submit" disabled={modules.length === 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors disabled:opacity-50">Add Topic</button>
              </form>
            </div>
          </div>

          {/* CURRICULUM TREE VIEW */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-200 mb-6">Course Overview</h2>
            
            {modules.length === 0 ? (
              <p className="text-slate-500 italic">No modules added yet.</p>
            ) : (
              <div className="space-y-6">
                {modules.map(module => (
                  <div key={module.id} className="border-l-2 border-slate-700 pl-4">
                    <h3 className="font-medium text-lg text-slate-200 mb-2">{module.title}</h3>
                    <div className="space-y-2">
                      {topics.filter(t => t.module_id === module.id).map(topic => (
                        <div key={topic.id} className="bg-slate-950 border border-slate-800 p-3 rounded flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
                          <span className="text-sm text-slate-300">{topic.title}</span>
                        </div>
                      ))}
                      {topics.filter(t => t.module_id === module.id).length === 0 && (
                        <p className="text-xs text-slate-500 italic">No topics in this module yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}